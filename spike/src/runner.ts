// CLI driver for the crash test. Modes:
//
//   reset   truncate the domain tables for a clean run (pg only)
//   start   launch DBOS, start the parent workflow, then block on its result.
//           The harness HARD-KILLS this process mid-run (while nodes sleep).
//   resume  re-launch DBOS in a fresh process -> auto-recovers the in-flight run,
//           re-attaches to the same parent id, and awaits completion.
//   report  read the domain tables and evaluate the 4 success criteria (pg only).
//
// Importing ./workflow.js registers the workflows + queue (must happen before launch).
import { DBOS } from "@dbos-inc/dbos-sdk";
import { APP_NAME, APP_VERSION, DATABASE_URL, NODE_IDS, NODE_SLEEP_MS, PARENT_ID, RUN_ID } from "./config.js";
import { fanOutParent } from "./workflow.js";
import * as db from "./db.js";

const MODE = (process.argv[2] ?? "").toLowerCase();

function configureDBOS(): void {
  DBOS.setConfig({
    name: APP_NAME,
    systemDatabaseUrl: DATABASE_URL,
    applicationVersion: APP_VERSION, // pinned per-run: stable across the crash, isolates recovery
  });
}

async function cmdReset(): Promise<void> {
  await db.ensureSchema();
  await db.resetDomain();
  console.log("RESET_OK: node_effects / node_attempts / fanin_results truncated");
  await db.closePool();
}

async function cmdStart(): Promise<void> {
  await db.ensureSchema();
  configureDBOS();
  await DBOS.launch();
  console.log(`RUN_ID=${RUN_ID}`);
  console.log(`APP_VERSION=${APP_VERSION}`);
  console.log(`START pid=${process.pid} parent=${PARENT_ID} node_sleep_ms=${NODE_SLEEP_MS}`);

  const handle = await DBOS.startWorkflow(fanOutParent, { workflowID: PARENT_ID })(RUN_ID, [
    ...NODE_IDS,
  ]);
  console.log(`PARENT_STARTED ${PARENT_ID}`);

  // Block on completion. We expect to be hard-killed before this resolves.
  const res = await handle.getResult();
  console.log(`UNEXPECTED_COMPLETE_BEFORE_KILL ${JSON.stringify(res)}`);
  await DBOS.shutdown();
  await db.closePool();
  process.exit(0);
}

async function cmdResume(): Promise<void> {
  await db.ensureSchema();
  configureDBOS();
  // launch() runs recoverPendingWorkflows(['local']) for this app version.
  await DBOS.launch();
  console.log(`RUN_ID=${RUN_ID}`);
  console.log(`APP_VERSION=${APP_VERSION}`);
  console.log(`RESUME pid=${process.pid} parent=${PARENT_ID}`);

  // Re-attach to the recovered workflow by its stable id and wait for it to finish.
  const handle = DBOS.retrieveWorkflow(PARENT_ID);
  const res = await handle.getResult();
  console.log(`RESUME_COMPLETE RESULT=${JSON.stringify(res)}`);
  await DBOS.shutdown();
  await db.closePool();
  process.exit(0);
}

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toISOString().replace("T", " ").replace("Z", "");
}

async function cmdReport(): Promise<void> {
  await db.ensureSchema();
  const r = await db.report(RUN_ID);
  const expected = NODE_IDS.length;

  console.log(`\n================ CRASH-TEST REPORT  run=${RUN_ID} ================\n`);

  console.log(`node_effects (the idempotent, exactly-once side-effect):`);
  for (const e of r.effects) {
    console.log(`   • ${e.node_id.padEnd(6)} written_by_pid=${e.created_by_pid}  at ${fmt(e.created_at)}`);
  }
  console.log(`   => ${r.effects.length} effect row(s)\n`);

  console.log(`node_attempts (one row per PHYSICAL execution of a node step):`);
  for (const a of r.attempts) {
    const tag = a.finished_at ? "finished" : "UNFINISHED(killed mid-step)";
    const eff = a.effect_inserted === true ? "inserted" : a.effect_inserted === false ? "deduped " : "  ?     ";
    console.log(
      `   • ${a.node_id.padEnd(6)} pid=${String(a.pid).padEnd(6)} effect=${eff} ${fmt(a.started_at)} -> ${fmt(a.finished_at)}  [${tag}]`,
    );
  }
  console.log(
    `   => ${r.attempts.length} attempt row(s); ${r.effectInsertTrueCount} actually inserted, ${r.attempts.length - r.effectInsertTrueCount} deduped; ${r.unfinishedCount} left UNFINISHED by the kill\n`,
  );

  console.log(`fan-in: ${r.fanin ? `"${r.fanin.summary}" (pid ${r.fanin.created_by_pid})` : "MISSING"}`);
  console.log(`distinct OS pids across attempts: [${r.distinctPids.join(", ")}]  (>1 proves a real process restart)\n`);

  // ---- evaluate the 4 success criteria ----
  const finishedNodeIds = new Set(r.attempts.filter((a) => a.finished_at).map((a) => a.node_id));
  const c1 = r.effects.length === expected && finishedNodeIds.size === expected && r.fanin !== null;
  const c2 = r.effects.length === expected && r.effectInsertTrueCount === expected;
  const c3 = r.allOverlap === true && r.finished >= 2;
  // C4 is fully evaluated by the harness (scans process stderr for lock/deadlock/
  // serialization errors). DB-side evidence: every concurrent write landed and the
  // workflow completed, i.e. no write was lost or aborted by contention.
  const c4db = r.effects.length === expected && r.fanin !== null;

  const mark = (b: boolean): string => (b ? "PASS ✅" : "FAIL ❌");
  console.log(`---------------------------- CRITERIA ----------------------------`);
  console.log(`C1  all ${expected} nodes complete after restart (resume works)        ${mark(c1)}`);
  console.log(`      effects=${r.effects.length}/${expected}  finished-nodes=${finishedNodeIds.size}/${expected}  fanin=${r.fanin ? "yes" : "no"}`);
  console.log(`C2  no duplicate side-effects (exactly-once per node)            ${mark(c2)}`);
  console.log(`      ${r.effects.length} effect rows, ${r.effectInsertTrueCount} real inserts, ${r.attempts.length - r.effectInsertTrueCount} dup attempt(s) deduped by the key`);
  console.log(`C3  the nodes genuinely ran concurrently                         ${mark(c3)}`);
  console.log(`      finished attempts overlap=${r.allOverlap}  start-spread=${r.startSpreadSec?.toFixed(3)}s over ${r.finished} nodes (<< ${(NODE_SLEEP_MS / 1000).toFixed(0)}s sleep)`);
  console.log(`C4  no store-lock / write-contention errors (DB-side)            ${mark(c4db)}`);
  console.log(`      all concurrent writes landed; final runtime-error scan = harness's job`);
  console.log(`------------------------------------------------------------------`);

  const dbPass = c1 && c2 && c3 && c4db;
  console.log(`\nDB-SIDE VERDICT: ${dbPass ? "ALL DB-PROVABLE CRITERIA PASS ✅" : "SOME CRITERIA FAILED ❌"}\n`);

  await db.closePool();
  process.exit(dbPass ? 0 : 2);
}

async function main(): Promise<void> {
  switch (MODE) {
    case "reset":
      return cmdReset();
    case "start":
      return cmdStart();
    case "resume":
      return cmdResume();
    case "report":
      return cmdReport();
    default:
      console.error(`unknown mode '${MODE}'. use: reset | start | resume | report`);
      process.exit(64);
  }
}

main().catch((e) => {
  console.error("RUNNER_ERROR:", e);
  process.exit(1);
});
