// Smoke test: validate the DBOS 4.19.8 functional API end-to-end before
// building the full crash harness. Proves programmatic setConfig/launch,
// a durable queue with concurrent children, fan-in via getResult, shutdown.
//
// Run: pnpm -C spike build && pnpm -C spike smoke
import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:storytree@localhost:5432/storytree";

// workerConcurrency: 3 => all three children allowed to run at once in-process.
const queue = new WorkflowQueue("smoke_queue", { workerConcurrency: 3 });

const SLEEP_MS = 1500;

async function childBody(n: number): Promise<string> {
  const startedAt = Date.now();
  await DBOS.runStep(
    async () => {
      await new Promise((r) => setTimeout(r, SLEEP_MS));
    },
    { name: "sleepStep" },
  );
  return `child-${n} pid=${process.pid} started+${startedAt}`;
}
const child = DBOS.registerWorkflow(childBody, { name: "smokeChild" });

async function parentBody(runId: string): Promise<string[]> {
  const handles = [];
  for (let i = 0; i < 3; i++) {
    handles.push(
      await DBOS.startWorkflow(child, {
        workflowID: `${runId}-node-${i}`,
        queueName: "smoke_queue",
      })(i),
    );
  }
  const results: string[] = [];
  for (const h of handles) results.push(await h.getResult());
  return results;
}
const parent = DBOS.registerWorkflow(parentBody, { name: "smokeParent" });

async function main(): Promise<void> {
  DBOS.setConfig({
    name: "storytree-spike-smoke",
    systemDatabaseUrl: DATABASE_URL,
    applicationVersion: "smoke-v1",
  });
  await DBOS.launch();

  const runId = `smoke-${Date.now()}`;
  const t0 = Date.now();
  const handle = await DBOS.startWorkflow(parent, { workflowID: runId })(runId);
  const res = await handle.getResult();
  const elapsed = Date.now() - t0;

  console.log("RESULTS:", res);
  console.log(
    `ELAPSED_MS=${elapsed} (three ${SLEEP_MS}ms sleeps; <${2 * SLEEP_MS}ms => CONCURRENT, ~${3 * SLEEP_MS}ms => serialized)`,
  );
  console.log(elapsed < 2 * SLEEP_MS ? "SMOKE_OK: concurrent" : "SMOKE_WARN: looks serialized");

  await DBOS.shutdown();
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE_FAILED:", e);
  process.exit(1);
});
