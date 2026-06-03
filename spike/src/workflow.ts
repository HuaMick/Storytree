// The durable orchestration under test: a 3-node fan-out -> fan-in.
//
//   fanOutParent(runId, nodeIds)
//     ├─ enqueue storyNode(runId, "alpha")  ┐
//     ├─ enqueue storyNode(runId, "beta")   ├─ run CONCURRENTLY on story_queue
//     ├─ enqueue storyNode(runId, "gamma")  ┘   (worker_concurrency = 3)
//     ├─ await all 3 results                 ── fan-in (join)
//     └─ fanin step: write one aggregate row ── idempotent, keyed by runId
//
// Each storyNode does a durable, IDEMPOTENT, side-effecting action wrapped as a
// DBOS step. NODE OPTION (B): the "coding agent" is SIMULATED -- the step inserts
// the keyed effect row and sleeps. No model API key was available in this
// environment (no .env, none in shell), so per the spike brief we use (B), which
// still fully exercises the DBOS crash-safety question (the primary purpose).

import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { QUEUE_NAME, WORKER_CONCURRENCY, NODE_SLEEP_MS } from "./config.js";
import {
  recordAttemptStart,
  insertEffectIdempotent,
  markAttemptEffect,
  markAttemptFinished,
  insertFanin,
} from "./db.js";

// Durable queue with a concurrency cap. Registered at import time (before launch),
// exactly like the real orchestrator would cap concurrent pi sessions.
export const storyQueue = new WorkflowQueue(QUEUE_NAME, {
  workerConcurrency: WORKER_CONCURRENCY,
  minPollingIntervalMs: 250,
});

// The side-effecting body of one node. This runs INSIDE a DBOS step, so it is
// at-least-once: if the process is hard-killed during the sleep, the whole body
// re-executes on resume. The (workflow_id, node_id) PRIMARY KEY makes the *effect*
// exactly-once regardless.
async function nodeEffect(runId: string, nodeId: string): Promise<string> {
  const pid = process.pid;

  // (1) Append an attempt row -> witnesses THIS physical execution.
  const { attemptId } = await recordAttemptStart(runId, nodeId, pid);

  // (2) The idempotent, exactly-once effect. `inserted` is true only on the first
  //     physical execution; a post-crash re-execution hits ON CONFLICT -> false.
  const payload = `sim coding-agent wrote one line for node '${nodeId}'`;
  const inserted = await insertEffectIdempotent(runId, nodeId, payload, pid);
  await markAttemptEffect(attemptId, inserted);

  // (3) The crash window: a real, observable in-flight period. We hard-kill here.
  await new Promise((r) => setTimeout(r, NODE_SLEEP_MS));

  // (4) Mark this execution as having run to completion.
  await markAttemptFinished(attemptId);

  return `${nodeId}:${inserted ? "inserted" : "deduped"}@pid${pid}`;
}

async function storyNodeBody(runId: string, nodeId: string): Promise<string> {
  // Wrap the side-effect as a durable step. retriesAllowed defaults to false:
  // we want crash-RECOVERY to drive re-execution, not step auto-retry.
  return await DBOS.runStep(() => nodeEffect(runId, nodeId), { name: `nodeEffect:${nodeId}` });
}
export const storyNode = DBOS.registerWorkflow(storyNodeBody, { name: "storyNode" });

async function fanOutParentBody(runId: string, nodeIds: string[]): Promise<string[]> {
  // Fan out: enqueue each node as its own durable child workflow with a
  // DETERMINISTIC id (= idempotency key). On resume, the parent replays and
  // re-enqueues the same ids, so each node still runs exactly once.
  const handles = [];
  for (const nodeId of nodeIds) {
    handles.push(
      await DBOS.startWorkflow(storyNode, {
        workflowID: `${runId}:node:${nodeId}`,
        queueName: QUEUE_NAME,
      })(runId, nodeId),
    );
  }

  // Fan in: await every node.
  const results: string[] = [];
  for (const h of handles) results.push(await h.getResult());

  // Aggregate (idempotent, keyed by runId).
  await DBOS.runStep(() => insertFanin(runId, results.join(" | "), process.pid), {
    name: "fanin",
  });

  return results;
}
export const fanOutParent = DBOS.registerWorkflow(fanOutParentBody, { name: "fanOutParent" });
