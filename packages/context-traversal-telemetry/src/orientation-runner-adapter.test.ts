import assert from "node:assert/strict";
import { test } from "node:test";

import { createContextTraversalTrace } from "./traversal-trace.js";
import {
  ORIENTATION_RUNNER_ADAPTER_COVERAGE,
  withContextTraversalTelemetry,
} from "./orientation-runner-adapter.js";
import type { OrientationEnvelope, OrientationRunner } from "./orientation-runner-adapter.js";

function harness(responses: Map<string, OrientationEnvelope> = new Map()) {
  const calls: string[] = [];
  const runner: OrientationRunner = async (argv) => {
    const key = argv.join(" ");
    calls.push(key);
    return responses.get(key) ?? { ok: true, body: `BODY:${key}`, next: [`next:${key}`] };
  };
  const trace = createContextTraversalTrace();
  let id = 0;
  const decorated = withContextTraversalTelemetry(runner, {
    sessionId: "session-1",
    trace,
    nodeStore: {
      async queryDocs(filter) {
        return filter?.kind === "principle"
          ? [{ id: "principle-a" }, { id: "principle-b" }]
          : [{ id: "all-a" }];
      },
    },
    nextVisitId: () => `visit-${++id}`,
    now: () => new Date(`2026-07-24T10:00:00.00${id}Z`),
  });
  return { calls, decorated, trace };
}

test("decorator delegates unchanged and emits distinct read strengths without content", async () => {
  const { calls, decorated, trace } = harness();
  const focused = await decorated(["tree", "story-a"], { marker: true });
  const full = await decorated(["tree", "spec", "story-a"], { marker: true });
  assert.deepEqual(calls, ["tree story-a", "tree spec story-a"]);
  assert.deepEqual(focused, { ok: true, body: "BODY:tree story-a", next: ["next:tree story-a"] });
  assert.deepEqual(full, {
    ok: true,
    body: "BODY:tree spec story-a",
    next: ["next:tree spec story-a"],
  });
  assert.deepEqual(
    trace.replay().events.map((event) => event.kind),
    ["front_matter_read", "full_payload_read"],
  );
  assert.equal(JSON.stringify(trace.replay()).includes("BODY:"), false);
});

test("artifact list uses structured canonical ids and never invents a followed edge", async () => {
  const { decorated, trace } = harness();
  await decorated(["library", "artifact", "list", "principle"], {});
  await decorated(["library", "artifact", "principle-a"], {});
  const replay = trace.replay();
  const search = replay.events.find((event) => event.kind === "search");
  assert.deepEqual(
    search?.kind === "search" ? search.resultNodeIds : [],
    ["principle-a", "principle-b"],
  );
  assert.equal(replay.relationships.some((edge) => edge.kind === "followed"), false);
});

test("coverage is fixed and unsupported or failed calls emit nothing", async () => {
  const responses = new Map<string, OrientationEnvelope>([
    ["tree spec missing", { ok: false, body: "miss" }],
  ]);
  const { decorated, trace } = harness(responses);
  assert.deepEqual(trace.replay().coverage, [ORIENTATION_RUNNER_ADAPTER_COVERAGE]);
  await decorated(["tree", "spec", "missing"], {});
  await decorated(["noticeboard"], {});
  await decorated(["agents", "session-orchestrator"], {});
  assert.equal(trace.replay().events.length, 0);
  assert.ok(trace.replay().coverage[0]?.omitted.includes("field:context_window_capacity"));
  assert.ok(trace.replay().coverage[0]?.omitted.includes("event:spawn_handoff"));
  assert.ok(trace.replay().coverage[0]?.omitted.includes("surface:direct_cli"));
});
