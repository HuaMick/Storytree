// Shared config + the per-run identifiers that tie the crash test together.
//
// RUN_ID is supplied by the harness via STORYTREE_RUN_ID and is IDENTICAL across
// the `start` (pre-crash) and `resume` (post-crash) invocations, so the restarted
// process re-attaches to the exact same durable workflow.
//
// APP_VERSION is derived from RUN_ID. This does double duty:
//   1. It is PINNED (not the md5-of-source default), so editing/rebuilding never
//      changes it across the crash -> DBOS will still recover the in-flight run.
//      (This is THE documented gotcha for DBOS crash recovery.)
//   2. Being per-run, it ISOLATES each test's recovery to its own workflows, so a
//      previous killed run's leftovers are never silently resumed into this one.

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:storytree@localhost:5432/storytree";

export const APP_NAME = "storytree-spike";
export const QUEUE_NAME = "story_queue";

// The 3 fan-out nodes.
export const NODE_IDS = ["alpha", "beta", "gamma"] as const;

// worker_concurrency >= NODE_IDS.length so all nodes may run at once in-process.
export const WORKER_CONCURRENCY = 3;

// Long enough that we can reliably hard-kill while all nodes are mid-step.
export const NODE_SLEEP_MS = Number(process.env.NODE_SLEEP_MS ?? 12_000);

export const RUN_ID = process.env.STORYTREE_RUN_ID ?? `run-${Date.now()}`;
export const APP_VERSION = process.env.STORYTREE_APP_VERSION ?? `v-${RUN_ID}`;
export const PARENT_ID = `${RUN_ID}:parent`;
export const childId = (nodeId: string): string => `${RUN_ID}:node:${nodeId}`;
