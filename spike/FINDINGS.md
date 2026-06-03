# Spike findings — DBOS durable-concurrency de-risk (ADR-0001)

**Date:** 2026-06-03 · **Status:** ✅ **PASS — DBOS holds up. Proceed.**
**Scope:** throwaway de-risking spike. Scratch code, kept out of `packages/*` and
`apps/*`. Lives entirely in `spike/`.

## The claim under test

ADR-0001 bets the foundation on **DBOS (Transact-TS, durable execution over
Postgres)** giving *crash-safe, concurrency-safe durable orchestration of multiple
concurrent coding-agent nodes*. This is the exact layer v1 got wrong (store-lock
races, in-process story-ID collisions). The spike proves it holds **before**
anything is built on top.

Success criteria (all four must hold under a hard mid-run crash):

| # | Criterion | Result |
|---|---|---|
| C1 | All 3 nodes complete after restart (resume works; in-flight work not lost) | ✅ PASS |
| C2 | No duplicate side-effects — each node's row appears exactly once (exactly-once effect) | ✅ PASS |
| C3 | The 3 nodes genuinely ran **concurrently**, not serialized | ✅ PASS |
| C4 | No store-lock / write-contention errors under concurrent writes | ✅ PASS |

Reproduced cleanly **twice** (`crash-20260603-201127`, `crash-20260603-201227`).

---

## What I built

A 3-node **fan-out → fan-in** durable workflow on DBOS, plus an automated
crash-test harness.

```
fanOutParent(runId, [alpha, beta, gamma])          ← durable parent workflow
  ├─ enqueue storyNode(runId,"alpha")  ┐
  ├─ enqueue storyNode(runId,"beta")   ├─ run CONCURRENTLY on a durable queue
  ├─ enqueue storyNode(runId,"gamma")  ┘   story_queue (worker_concurrency = 3)
  ├─ await all 3 results                ← fan-in (join)
  └─ fanin step → 1 aggregate row       ← idempotent, keyed by runId
```

Each `storyNode` wraps a **durable, idempotent, side-effecting** action as a DBOS
step. The crash window (a 12 s delay) lives inside that step.

Two domain tables carry the proof (our data, separate from DBOS's bookkeeping,
written via a plain `pg` pool):

- **`node_effects`** — PRIMARY KEY `(workflow_id, node_id)`. The idempotent,
  exactly-once effect. `INSERT … ON CONFLICT DO NOTHING`. The key is the dedup
  guard: a re-executed step can *attempt* the insert but cannot create a 2nd row.
- **`node_attempts`** — append-only, **one row per *physical* execution** of a node
  step (with `pid`, `effect_inserted`, `started_at`, `finished_at`). Because DBOS
  steps are *at-least-once*, a node killed mid-step re-executes on resume and
  appends a **second** row here. This is how we *detect* re-execution and prove the
  effect still landed exactly once. The timestamps give the concurrency intervals.

Files: [`spike/src/config.ts`](src/config.ts), [`spike/src/db.ts`](src/db.ts),
[`spike/src/workflow.ts`](src/workflow.ts), [`spike/src/runner.ts`](src/runner.ts),
[`spike/src/smoke.ts`](src/smoke.ts), harness
[`spike/crash-test.ps1`](crash-test.ps1).

### Stack as actually run

- `@dbos-inc/dbos-sdk` **4.19.8** (latest stable), functional API (no decorators).
- Postgres 16 in Docker (`storytree-pg`), `DATABASE_URL` from `.env.example`.
- Node 24.15.0, pnpm 9.15.0, TypeScript 6.0.3, Windows 11 / PowerShell 5.1.
- DBOS configured **purely programmatically** — no `dbos-config.yaml`, no CLI.
  Config field is **`systemDatabaseUrl`** (note: *not* `databaseUrl`). DBOS creates
  its own 14 system tables in the `dbos` schema on `launch()`.

---

## Node behaviour: option (B) simulated — and why

The brief offered **(A) a real `pi` coding-agent session per node** (preferred if
tractable) or **(B) a simulated durable step** (fallback if no model API key).

**I used (B).** No model API key was available in this environment: there is no
`.env` file anywhere in the repo, and `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are
unset in the shell. The brief is explicit that this is the correct fallback ("If no
key is available, do NOT block — use (B)") and that (B) "still fully tests the DBOS
crash-safety question, which is the spike's PRIMARY purpose." That primary purpose —
durable, concurrency-safe, crash-safe orchestration — is **100 % exercised** by (B);
nothing about it depends on what runs inside the node step.

**How (A) would slot in later (no DBOS changes):** replace the body of `nodeEffect`
with a `pi` session (`createAgentSession` → `subscribe` to the event stream →
`prompt` a trivial task like writing one line). Two things must hold, both already
modelled here by (B):
1. The pi call is wrapped in a `DBOS.runStep`, so it inherits durable
   checkpointing and crash recovery.
2. The effect is made **idempotent on a deterministic key** (e.g. pi writes to a
   path/branch keyed by `(runId, nodeId)`, and the step records completion under
   that key) — because steps are *at-least-once*, a crash mid-pi-session re-runs the
   step, and the key prevents a duplicate commit. pi's own per-session durability
   complements, but does not replace, this discipline.

---

## The crash test — exact steps

Driver: [`spike/crash-test.ps1`](crash-test.ps1). One command, fully automated:

```
pnpm -C spike build
powershell -ExecutionPolicy Bypass -File spike/crash-test.ps1
```

1. **reset** — truncate the 3 domain tables.
2. **start (background)** — `node dist/runner.js start` launched via `Start-Process
   -PassThru`, capturing the **real node PID**. It launches DBOS, starts the parent
   workflow with a stable id `${RUN_ID}:parent`, and blocks on the result.
3. **poll until mid-run** — query `node_attempts` until **all 3 nodes are in-flight**
   (started their step, `finished_at IS NULL`). This guarantees the kill lands
   mid-run, not before/after.
4. **snapshot** the mid-run state.
5. **HARD KILL** — `Stop-Process -Id <pid> -Force` (Windows `TerminateProcess`,
   ungraceful, no cleanup) — the v1-style "pull the plug mid-flight".
6. **show stranded work** — the 3 in-flight attempts are now unfinished in Postgres.
7. **resume (fresh process)** — `node dist/runner.js resume`. `DBOS.launch()`
   auto-recovers the in-flight workflows, re-attaches to `${RUN_ID}:parent`, and runs
   to completion.
8. **report** — read the domain tables, evaluate C1–C3 + C4(DB-side).
9. **C4 log scan** — grep every process log for `deadlock | could not serialize |
   could not obtain lock | lock timeout | store-lock | write conflict | …`.

Reliability detail: `applicationVersion` is **pinned per run** (`v-${RUN_ID}`).
Without pinning, DBOS derives the app version from an md5 of the workflow source, so
*editing or rebuilding code between crash and restart changes the version and the
in-flight workflows are NOT recovered.* Pinning makes the version stable across the
crash and isolates each run's recovery to its own workflows. **This is the single
most important operational detail for crash recovery** (see Gotchas).

---

## Observed results (run `crash-20260603-201127`)

**Mid-run snapshot, the instant before the kill** — all 3 nodes concurrently
in-flight, effects already written, all PENDING in DBOS under executor `local`:

```
 node_id |  pid  | effect_inserted | in_flight
---------+-------+-----------------+-----------
 alpha   | 16316 | t               | t
 beta    | 16316 | t               | t
 gamma   | 16316 | t               | t
node_effects already written pre-crash = 3
DBOS: parent + 3 children all PENDING, recovery_attempts=1, executor_id=local
```

**Hard-kill** pid `16316`. **Resume** in a fresh process (pid `104616`):

```
Recovering 4 workflows from application version v-crash-20260603-201127
RESUME_COMPLETE RESULT=["alpha:deduped@pid104616","beta:deduped@pid104616","gamma:deduped@pid104616"]
```

**The centrepiece — `node_attempts` after resume (6 physical executions, 3 effects):**

```
 node_id | pid    | effect    | started -> finished                         state
---------+--------+-----------+---------------------------------------------+----------------------
 alpha   | 16316  | inserted  | 10:11:20.377 -> —                            UNFINISHED (killed)
 beta    | 16316  | inserted  | 10:11:20.654 -> —                            UNFINISHED (killed)
 gamma   | 16316  | inserted  | 10:11:20.656 -> —                            UNFINISHED (killed)
 alpha   | 104616 | deduped   | 10:11:25.511 -> 10:11:37.811                 finished (recovered)
 beta    | 104616 | deduped   | 10:11:25.787 -> 10:11:38.077                 finished (recovered)
 gamma   | 104616 | deduped   | 10:11:25.787 -> 10:11:38.077                 finished (recovered)
=> 6 attempt rows; 3 actually inserted, 3 deduped; 3 left UNFINISHED by the kill

node_effects => 3 rows (alpha, beta, gamma) — exactly one per node
fan-in       => present, written by the RECOVERY pid (104616)
distinct pids => [16316, 104616]   (>1 proves a real process restart)
DBOS final   => all 4 workflows SUCCESS, recovery_attempts 1 -> 2
```

### Against each criterion

**C1 — all 3 nodes complete after restart. ✅**
After the kill, 3 nodes were stranded unfinished. After `resume`, `DBOS.launch()`
logged *"Recovering 4 workflows"*, every node ran to completion (3/3 finished, all
3 effects, fan-in present), and `dbos.workflow_status` went PENDING → **SUCCESS**
with `recovery_attempts` incrementing — DBOS's own counter confirming auto-resume.
No code told it to resume; relaunching the process was enough.

**C2 — no duplicate side-effects (exactly-once effect). ✅**
The step physically executed **6 times** (3 pre-crash + 3 on recovery — proven by
the 6 `node_attempts` rows across two distinct pids), and the insert was therefore
**attempted 6 times**. Yet `node_effects` holds **exactly 3 rows**. The 3 recovery
executions all reported `effect=deduped` (the `(workflow_id, node_id)` key rejected
the duplicate). This is the implicit negative control: *without the key there would
be 6 effect rows.* At-least-once execution, exactly-once effect. The fan-in row was
written only by the recovery process — proving lost work genuinely re-ran rather
than being replayed from a cache.

**C3 — genuinely concurrent. ✅** Two independent proofs:
- *Pre-crash:* at kill time all 3 nodes were simultaneously in-flight (3 unfinished
  attempts, started within a 0.28 s window, all mid-sleep).
- *Post-recovery:* the 3 finished attempts overlap — `max(started)=…25.787` <
  `min(finished)=…37.811`, i.e. all three were running at the same instant;
  start-spread **0.276 s** over a 12 s step. Serialized execution would show ~36 s of
  non-overlapping intervals. (The crude wall-clock heuristic in the smoke test is
  *not* used here — concurrency is proven from overlapping DB intervals.)

**C4 — no store-lock / write-contention errors. ✅**
Three nodes wrote to `node_effects` / `node_attempts` concurrently, twice over
(original + recovery). Postgres MVCC serialized the row writes with **zero**
deadlocks, lock timeouts, or serialization failures — the automated log scan found
no contention markers in any of the four process logs, and every concurrent write
landed. The v1 "store-lock race" failure mode **did not reproduce**.

---

## What this de-risks for storytree

The two v1 scars named in ADR-0001, directly addressed:

- **Store-lock races** → gone. Shared state is Postgres rows under MVCC, not a
  single-writer lock. Concurrent node effects don't contend (different rows), and
  even contended rows would serialize cleanly, not deadlock (C4).
- **In-process story-ID collisions** → gone. Durable workflow IDs are the
  identity *and* the idempotency key. A deterministic `${runId}:node:${nodeId}`
  makes "start this node" exactly-once across crashes and replays — the parent
  re-enqueues the same ids on recovery and each node still runs once (C1/C2).

DBOS delivers exactly the one primitive the orchestrator was scoped down to need:
**durable, concurrency-safe, crash-safe multi-node scheduling**, as a library over
Postgres, with auto-resume and durable queues — no cluster, no extra services.

---

## Gotchas (Windows / Docker / DBOS / pi)

**DBOS**
- **Config field is `systemDatabaseUrl`, not `databaseUrl`.** Easy to mis-key from
  the `.env.example` var name (`DATABASE_URL`). DBOS auto-creates the DB + its 14
  system tables in the `dbos` schema; no manual migration/CLI/YAML needed.
- **`applicationVersion` controls recovery — pin it.** Default = md5 of workflow
  source code. Recovery only picks up workflows whose row matches *(executor_id,
  application_version)*. So **editing/rebuilding code between a crash and the
  restart silently prevents recovery** ("No workflows to recover from application
  version …"). For the real orchestrator: pin the version per deployment, and have
  an explicit plan for recovering work across a version bump (DBOS's admin/Conductor
  recovery, or drain-before-deploy).
- **Executor id** defaults to the literal `local` (stable across restarts) unless
  `DBOS__VMID` is set. Good for single-host; multi-host needs a deliberate id scheme
  so each host recovers its own work.
- **Steps are at-least-once.** A step crashed before its checkpoint **re-executes**
  in full on recovery. All side effects must be idempotent (keyed upsert), or use
  the datasource transaction (`@dbos-inc/postgres-datasource`, atomic write +
  checkpoint) for true exactly-once. We used the keyed-upsert path; it works.
- Durable queues poll (default ~1 s; set `minPollingIntervalMs: 250` here), so
  dispatch isn't instant. Not a correctness issue — just don't expect µs latency.
- One-off **cold-start latency**: the very first node on the very first run after
  DBOS ran its migrations took ~12 s instead of ~2 s (JIT / pool warmup). Not
  reproducible on subsequent runs and unrelated to concurrency — flagged for honesty.

**Windows / Docker / pnpm**
- Hard-kill: `Stop-Process -Id <pid> -Force` is a genuine ungraceful kill. Run
  `node dist/runner.js` **directly** (not via a pnpm/tsx wrapper) so the captured PID
  is the actual workflow process.
- No native build toolchain needed: `pg` and DBOS are pure-JS on Windows; nothing
  compiled with node-gyp.
- The spike is a **standalone pnpm project** nested under the monorepo. An empty
  `spike/pnpm-workspace.yaml` makes pnpm treat `spike/` as its own root (so its deps
  don't touch the real workspace); `pnpm -C spike add -w …` is then required.
- Node 24 works fine despite DBOS `engines: ">=20"`.

**pi (option A)** — not exercised (no API key). The integration shape is sketched
above; the DBOS-side contract it must satisfy (wrap in a step, idempotent on a
deterministic key) is exactly what (B) already validates.

---

## VERDICT

**DBOS holds up as storytree's durable-concurrency substrate. Proceed to build the
thin orchestrator on it.**

All four success criteria pass, reproducibly, under a real hard-kill mid-run:
crash-safe auto-resume, exactly-once effects despite at-least-once step
re-execution, genuine concurrency, and zero write-contention — i.e. the v1 failure
modes (store-lock races, ID collisions) **do not reproduce**. The cost ADR-0001
accepted ("we own the idempotent-retry / fan-in semantics on top of DBOS's
primitives") is real but small and well-supported: DBOS supplies the durable
workflow IDs, durable queues, and auto-recovery; we supply an **idempotency
discipline** (every node effect keyed and upserted) and a **version/executor
recovery policy**. Both are demonstrated here.

**Reconsider only if** the **Postgres dependency** itself becomes unwanted (e.g. a
desire for a single self-contained binary). In that case the reserved alternative is
**Restate** — it offers the same durable-execution model without a separate
Postgres. Nothing observed in this spike motivates that switch; Postgres-backed DBOS
behaved exactly as ADR-0001 hoped.

### Recommended follow-ups when building for real
1. **Idempotency as a rule**, not a case-by-case choice: every orchestrator effect
   keyed by `(workflow_id, node_id)` (or a transactional datasource step).
2. **Pin `applicationVersion`** per deployment and define cross-version recovery
   (drain-before-deploy, or DBOS admin recovery).
3. Decide the **executor-id scheme** before going multi-host.
4. When pi lands (option A), keep the node body inside a `runStep` and idempotent on
   a deterministic key, so a mid-session crash re-runs without a duplicate commit.

---

## How to reproduce

```powershell
# Postgres (matches .env.example DATABASE_URL)
docker run -d --name storytree-pg -e POSTGRES_PASSWORD=storytree -p 5432:5432 postgres:16

# Build + smoke-test the DBOS API
pnpm -C spike install
pnpm -C spike build
pnpm -C spike smoke

# Full automated crash test (reset → start → kill mid-run → resume → report)
powershell -ExecutionPolicy Bypass -File spike/crash-test.ps1

# Or drive the phases by hand:
$env:STORYTREE_RUN_ID = "manual-1"; $env:NODE_SLEEP_MS = "12000"
node spike/dist/runner.js reset
node spike/dist/runner.js start     # in one terminal; kill it mid-run (Stop-Process -Force)
node spike/dist/runner.js resume    # in another; auto-recovers to completion
node spike/dist/runner.js report
```
