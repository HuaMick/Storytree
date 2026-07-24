import test from "node:test";
import assert from "node:assert/strict";

import {
  ContextTraversalCoverage,
  ContextTraversalEvent,
  CoverageFeature,
} from "./traversal-events.js";
import { createContextTraversalTrace } from "./traversal-trace.js";

const AT = "2026-07-24T10:00:00.000Z";

function coverage(overrides: Partial<{ supported: string[]; omitted: string[] }> = {}) {
  const supported = overrides.supported ?? [
    "surface:create_orientation_runner",
    "event:front_matter_read",
    "event:full_payload_read",
    "event:search",
    "field:surface_id",
  ];
  return {
    adapterId: "desktop-orientation",
    supported,
    omitted:
      overrides.omitted ??
      CoverageFeature.options.filter((feature) => !supported.includes(feature)),
  };
}

test("canonical-and-chronological-identity-stay-separate / read-strength-is-an-event-kind: strict visits preserve stable identity and refuse content", () => {
  const front = ContextTraversalEvent.parse({
    kind: "front_matter_read",
    eventId: "event-1",
    sessionId: "session-parent",
    visitId: "visit-1",
    nodeId: "library-node",
    surfaceId: "tree",
    at: AT,
  });
  const full = ContextTraversalEvent.parse({
    kind: "full_payload_read",
    eventId: "event-2",
    sessionId: "session-parent",
    visitId: "visit-2",
    nodeId: "library-node",
    priorVisitId: "visit-1",
    at: AT,
  });
  assert.equal(front.kind, "front_matter_read");
  assert.equal(full.kind, "full_payload_read");
  assert.equal(front.nodeId, full.nodeId);
  assert.notEqual(front.visitId, full.visitId);

  assert.equal(
    ContextTraversalEvent.safeParse({ ...front, body: "# copied context" }).success,
    false,
  );
  assert.equal(
    ContextTraversalEvent.safeParse({ ...full, visitId: "visit-1", priorVisitId: "visit-1" })
      .success,
    false,
  );
});

test("capacity-is-runtime-declared-or-unknown: observed capacity is retained without a default or cutoff", () => {
  const known = ContextTraversalEvent.parse({
    kind: "model_context",
    eventId: "context-1",
    sessionId: "parent",
    at: AT,
    modelId: "claude-runtime-model",
    cumulativeInputTokens: 240_900,
    addedInputTokens: 8_000,
    contextWindowCapacity: 1_000_000,
  });
  const unknown = ContextTraversalEvent.parse({
    kind: "model_context",
    eventId: "context-2",
    sessionId: "child",
    at: AT,
    cumulativeInputTokens: 12_000,
    addedInputTokens: 2_000,
  });
  assert.equal(known.kind === "model_context" ? known.contextWindowCapacity : undefined, 1_000_000);
  assert.equal(
    unknown.kind === "model_context" ? unknown.contextWindowCapacity : "wrong-kind",
    undefined,
  );
  assert.equal(JSON.stringify(known).includes("500000"), false);
});

test("adapter-coverage-names-omissions: coverage is exhaustive and refuses contradictions or unknown features", () => {
  const parsed = ContextTraversalCoverage.parse(coverage());
  assert.ok(parsed.omitted.includes("event:model_context"));
  assert.equal(
    ContextTraversalCoverage.safeParse(
      coverage({
        supported: ["event:search"],
        omitted: CoverageFeature.options,
      }),
    ).success,
    false,
  );
  assert.equal(
    ContextTraversalCoverage.safeParse({
      ...coverage(),
      supported: ["event:search", "field:not-real"],
    }).success,
    false,
  );
  assert.equal(
    ContextTraversalCoverage.safeParse({
      adapterId: "incomplete",
      supported: ["event:search"],
      omitted: [],
    }).success,
    false,
  );
});

test("append is atomic on malformed and duplicate identities", () => {
  const trace = createContextTraversalTrace();
  trace.append({
    kind: "front_matter_read",
    eventId: "event-1",
    sessionId: "parent",
    visitId: "visit-1",
    nodeId: "node-a",
    at: AT,
  });
  assert.throws(
    () =>
      trace.append({
        kind: "full_payload_read",
        eventId: "event-2",
        sessionId: "parent",
        visitId: "visit-1",
        nodeId: "node-a",
        at: AT,
      }),
    /duplicate traversal visitId/,
  );
  assert.throws(
    () =>
      trace.append({
        kind: "search",
        eventId: "event-3",
        sessionId: "parent",
        searchId: "search-1",
        surfaceId: "library",
        operation: "library_artifact_list",
        resultNodeIds: [],
        at: AT,
        prompt: "secret",
      }),
  );
  assert.equal(trace.replay().events.length, 1);
});

test("replay-does-not-infer-relationships: replay orders deterministically and derives relationships only from explicit ids", () => {
  const trace = createContextTraversalTrace();
  trace.declareCoverage(coverage());
  trace.append({
    kind: "full_payload_read",
    eventId: "event-2",
    sessionId: "parent",
    visitId: "visit-2",
    nodeId: "node-a",
    priorVisitId: "visit-1",
    at: AT,
  });
  trace.append({
    kind: "front_matter_read",
    eventId: "event-1",
    sessionId: "parent",
    visitId: "visit-1",
    nodeId: "node-a",
    at: "2026-07-24T09:59:59.999Z",
  });
  trace.append({
    kind: "full_payload_read",
    eventId: "event-3",
    sessionId: "parent",
    visitId: "visit-3",
    nodeId: "node-b",
    at: AT,
  });

  const replay = trace.replay();
  assert.deepEqual(
    replay.events.map((event) => event.eventId),
    ["event-1", "event-2", "event-3"],
  );
  assert.deepEqual(replay.relationships, [
    { kind: "revisit", fromVisitId: "visit-1", toVisitId: "visit-2" },
  ]);
  assert.equal(replay.coverage[0]?.adapterId, "desktop-orientation");
});

test("spawn-edge-schemas-link-independent-sessions: explicit edges join independent lanes without merging windows", () => {
  const trace = createContextTraversalTrace();
  trace.append({
    kind: "spawn_handoff",
    eventId: "spawn",
    sessionId: "parent",
    at: AT,
    edgeId: "spawn-edge",
    parentSessionId: "parent",
    childSessionId: "child",
    payloadTokenCount: 500,
  });
  trace.append({
    kind: "model_context",
    eventId: "parent-context",
    sessionId: "parent",
    at: "2026-07-24T10:00:01.000Z",
    cumulativeInputTokens: 240_900,
    addedInputTokens: 8_000,
    contextWindowCapacity: 1_000_000,
  });
  trace.append({
    kind: "model_context",
    eventId: "child-context",
    sessionId: "child",
    at: "2026-07-24T10:00:02.000Z",
    cumulativeInputTokens: 30_000,
    addedInputTokens: 3_000,
    contextWindowCapacity: 200_000,
  });
  trace.append({
    kind: "result_return",
    eventId: "return",
    sessionId: "parent",
    at: "2026-07-24T10:00:03.000Z",
    edgeId: "return-edge",
    parentSessionId: "parent",
    childSessionId: "child",
    resultTokenCount: 800,
  });

  const replay = trace.replay();
  const parent = replay.sessions.find((lane) => lane.sessionId === "parent");
  const child = replay.sessions.find((lane) => lane.sessionId === "child");
  assert.equal(parent?.modelContext[0]?.cumulativeInputTokens, 240_900);
  assert.equal(child?.modelContext[0]?.cumulativeInputTokens, 30_000);
  assert.deepEqual(
    replay.relationships.map((relationship) => relationship.kind),
    ["spawn_handoff", "result_return"],
  );
  const spawn = replay.events.find((event) => event.kind === "spawn_handoff");
  const returned = replay.events.find((event) => event.kind === "result_return");
  assert.equal(spawn !== undefined && "payload" in spawn, false);
  assert.equal(returned !== undefined && "result" in returned, false);
});
