# ============================================================================
# storytree DBOS de-risking spike — automated crash test (ADR-0001).
#
# Proves: a 3-node fan-out/fan-in durable workflow survives a HARD KILL mid-run.
#   1. reset domain tables
#   2. launch `start` in the background (real node PID), nodes begin & sleep
#   3. poll until all 3 nodes are in-flight (genuinely mid-run)
#   4. snapshot mid-run state
#   5. HARD-KILL the process (Stop-Process -Force == ungraceful TerminateProcess)
#   6. show the stranded in-flight work
#   7. `resume` in a fresh process -> DBOS auto-recovers and runs to completion
#   8. `report` -> evaluate the 4 success criteria
#   9. scan all process logs for store-lock / contention errors (criterion 4)
#
# Usage (Postgres must be running in Docker as `storytree-pg`):
#   pnpm -C spike build
#   powershell -ExecutionPolicy Bypass -File spike/crash-test.ps1
# ============================================================================
$ErrorActionPreference = "Stop"

$env:DATABASE_URL = "postgres://postgres:storytree@localhost:5432/storytree"
$RunId = "crash-$(Get-Date -Format yyyyMMdd-HHmmss)"
$env:STORYTREE_RUN_ID = $RunId
$env:NODE_SLEEP_MS = "12000"          # long window so the kill reliably lands mid-run
$parentId = "${RunId}:parent"

$runner = Join-Path $PSScriptRoot "dist/runner.js"
$logDir = Join-Path $PSScriptRoot "crash-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$startOut  = Join-Path $logDir "$RunId.start.out.log"
$startErr  = Join-Path $logDir "$RunId.start.err.log"
$resumeOut = Join-Path $logDir "$RunId.resume.out.log"
$resumeErr = Join-Path $logDir "$RunId.resume.err.log"

function PgScalar([string]$sql) {
  return (docker exec storytree-pg psql -U postgres -d storytree -t -A -c $sql).Trim()
}
function PgTable([string]$sql) {
  docker exec storytree-pg psql -U postgres -d storytree -c $sql
}

Write-Host "================ DBOS CRASH TEST  run=$RunId ================" -ForegroundColor Cyan
Write-Host "node_sleep_ms=$($env:NODE_SLEEP_MS)  parent=$parentId`n"

# 1. clean slate (domain tables)
node $runner reset
if ($LASTEXITCODE -ne 0) { throw "reset failed" }

# 2. start the workflow in a background process; capture the REAL node pid
$p = Start-Process -FilePath "node" -ArgumentList @($runner, "start") -PassThru `
  -RedirectStandardOutput $startOut -RedirectStandardError $startErr
Write-Host "spawned `start` process, node pid=$($p.Id)"

# 3. poll until all 3 nodes are in-flight (started their step, not yet finished)
$inflight = 0
for ($i = 0; $i -lt 75; $i++) {
  Start-Sleep -Milliseconds 400
  if ($p.HasExited) { Write-Host (Get-Content $startErr -Raw); throw "start exited early (code $($p.ExitCode))" }
  $inflight = [int](PgScalar "SELECT count(*) FROM node_attempts WHERE workflow_id='$RunId' AND finished_at IS NULL")
  if ($inflight -ge 3) { break }
}
if ($inflight -lt 3) { throw "never reached 3 in-flight nodes (got $inflight)" }
Write-Host "all $inflight nodes are in-flight (mid-run)`n" -ForegroundColor Green

# 4. snapshot the mid-run state, the instant before the kill
Write-Host "--- MID-RUN SNAPSHOT (before kill) ---" -ForegroundColor Yellow
PgTable "SELECT node_id, pid, effect_inserted, (finished_at IS NULL) AS in_flight FROM node_attempts WHERE workflow_id='$RunId' ORDER BY node_id;"
Write-Host "node_effects already written pre-crash = $(PgScalar "SELECT count(*) FROM node_effects WHERE workflow_id='$RunId'")"
Write-Host "DBOS workflow_status (pre-kill):"
PgTable "SELECT right(workflow_uuid, 12) AS wf_tail, status, recovery_attempts, executor_id FROM dbos.workflow_status WHERE workflow_uuid LIKE '$RunId%' ORDER BY workflow_uuid;"

# 5. HARD KILL — ungraceful, no cleanup, mid-flight
Write-Host ">>> HARD-KILL pid $($p.Id) (Stop-Process -Force) <<<`n" -ForegroundColor Red
Stop-Process -Id $p.Id -Force
Start-Sleep -Milliseconds 700
Write-Host "killed; HasExited=$($p.HasExited)`n"

# 6. the in-flight work is now stranded in Postgres, unfinished
Write-Host "--- POST-KILL STATE (work stranded, nothing lost) ---" -ForegroundColor Yellow
PgTable "SELECT count(*) FILTER (WHERE finished_at IS NULL) AS unfinished, count(*) AS attempts, (SELECT count(*) FROM node_effects WHERE workflow_id='$RunId') AS effects FROM node_attempts WHERE workflow_id='$RunId';"

# 7. RESUME in a fresh process — DBOS.launch() auto-recovers the in-flight run
Write-Host "=== RESUME (fresh process; DBOS auto-recovers) ===" -ForegroundColor Cyan
$r = Start-Process -FilePath "node" -ArgumentList @($runner, "resume") -PassThru `
  -RedirectStandardOutput $resumeOut -RedirectStandardError $resumeErr
$exited = $r.WaitForExit(90000)
if (-not $exited) { Stop-Process -Id $r.Id -Force; throw "resume did not finish within 90s" }
Write-Host "resume exit code = $($r.ExitCode)"
Write-Host "resume log:" -ForegroundColor DarkGray
Get-Content $resumeOut | Where-Object { $_ -match "RUN_ID|RESUME|recover|Recover" } | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# 8. report — evaluate criteria 1-3 + C4 DB-side
node $runner report
$reportExit = $LASTEXITCODE

# 9. final DBOS status + criterion-4 log scan
Write-Host "--- FINAL DBOS workflow_status (note recovery_attempts > 0 = auto-resumed) ---" -ForegroundColor Yellow
PgTable "SELECT right(workflow_uuid, 12) AS wf_tail, status, recovery_attempts, executor_id FROM dbos.workflow_status WHERE workflow_uuid LIKE '$RunId%' ORDER BY workflow_uuid;"

Write-Host "--- C4: scanning all process logs for store-lock / contention errors ---" -ForegroundColor Yellow
$pattern = "deadlock|could not serialize|could not obtain lock|lock timeout|LockNotAvailable|store.?lock|write conflict|RUNNER_ERROR|UnhandledPromiseRejection"
$hits = Select-String -Path @($startOut, $startErr, $resumeOut, $resumeErr) -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue
if ($hits) {
  Write-Host "C4 FAIL: found contention/error markers:" -ForegroundColor Red
  $hits | ForEach-Object { Write-Host "  $($_.Filename): $($_.Line)" }
  $c4 = $false
} else {
  Write-Host "C4 PASS: no store-lock / contention / runtime-error markers in any log" -ForegroundColor Green
  $c4 = $true
}

$overall = ($reportExit -eq 0) -and $c4
Write-Host "`n================ OVERALL: $(if ($overall) {'ALL CRITERIA PASS'} else {'FAILURE'}) ================" -ForegroundColor $(if ($overall) {'Green'} else {'Red'})
Write-Host "logs: $logDir"
exit $(if ($overall) { 0 } else { 1 })
