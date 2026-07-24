import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createOrientationRunner } from "@storytree/drive";
import type { Store } from "@storytree/storage-protocol";
import {
  createContextTraversalTrace,
  ORIENTATION_RUNNER_ADAPTER_COVERAGE,
  withContextTraversalTelemetry,
} from "@storytree/context-traversal-telemetry";

function fixtureStories(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "context-traversal-uat-"));
  const storyDir = path.join(dir, "trace-story");
  mkdirSync(storyDir);
  writeFileSync(
    path.join(storyDir, "story.md"),
    [
      "---",
      'id: "trace-story"',
      "tier: story",
      'title: "Trace story"',
      'outcome: "A trace story exists."',
      "status: proposed",
      "proof_mode: UAT",
      "uat_witness: machine",
      "depends_on: []",
      "capabilities: []",
      "---",
      "# TRACE STORY PAYLOAD",
    ].join("\n"),
    "utf8",
  );
  return dir;
}

function fixtureStore(): Store {
  const docs = [
    {
      id: "context-node-a",
      kind: "principle",
      doc: { id: "context-node-a", title: "A", body: "SECRET CONTEXT A", references: [] },
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
    },
    {
      id: "context-node-b",
      kind: "principle",
      doc: { id: "context-node-b", title: "B", body: "SECRET CONTEXT B", references: [] },
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
    },
  ];
  return {
    async queryDocs(filter?: Parameters<Store["queryDocs"]>[0]) {
      return filter?.kind === undefined ? docs : docs.filter((doc) => doc.kind === filter.kind);
    },
    async getDoc(id: string) {
      return docs.find((doc) => doc.id === id) ?? null;
    },
    async upsertDoc() {
      throw new Error("read-only");
    },
    async deleteDoc() {
      throw new Error("read-only");
    },
    async appendEvent() {
      throw new Error("read-only");
    },
    async getEvents() {
      return [];
    },
  } as unknown as Store;
}

test("decorated-production-runner-emits-read-strength / orientation-search-list-is-metadata-only / orientation-coverage-is-honest / telemetry-wrapper-is-additive: a real runner yields one honest metadata-only traversal", async () => {
  const store = fixtureStore();
  const baseRunner = createOrientationRunner({
    store,
    storiesDir: fixtureStories(),
    lookupConfig: () => null,
  });
  const trace = createContextTraversalTrace();
  const ids = ["visit-front", "visit-full", "search-list", "visit-artifact"];
  const times = [
    "2026-07-24T10:00:00.000Z",
    "2026-07-24T10:00:00.001Z",
    "2026-07-24T10:00:00.002Z",
    "2026-07-24T10:00:00.003Z",
  ];
  const runner = withContextTraversalTelemetry(baseRunner, {
    sessionId: "parent-session",
    trace,
    nodeStore: store,
    nextVisitId: () => {
      const id = ids.shift();
      assert.ok(id);
      return id;
    },
    now: () => {
      const at = times.shift();
      assert.ok(at);
      return new Date(at);
    },
  });

  const focused = await runner(["tree", "trace-story"], {});
  const full = await runner(["tree", "spec", "trace-story"], {});
  const listed = await runner(["library", "artifact", "list", "principle"], {});
  const artifact = await runner(["library", "artifact", "context-node-a"], {});
  assert.ok(focused.ok && full.ok && listed.ok && artifact.ok);
  const eventCountBeforeMiss = trace.replay().events.length;
  const expectedMiss = await baseRunner(["tree", "missing-story"], {});
  const observedMiss = await runner(["tree", "missing-story"], {});
  assert.deepEqual(observedMiss, expectedMiss);
  assert.equal(trace.replay().events.length, eventCountBeforeMiss);

  // Schema/replay-only observations: the adapter truthfully declares these event kinds omitted.
  trace.append({
    kind: "full_payload_read",
    eventId: "event:visit-revisit",
    sessionId: "parent-session",
    visitId: "visit-revisit",
    nodeId: "trace-story",
    priorVisitId: "visit-full",
    at: "2026-07-24T10:00:00.004Z",
  });
  trace.append({
    kind: "spawn_handoff",
    eventId: "event:spawn",
    sessionId: "parent-session",
    edgeId: "spawn-edge",
    parentSessionId: "parent-session",
    childSessionId: "child-session",
    payloadTokenCount: 600,
    at: "2026-07-24T10:00:00.005Z",
  });
  trace.append({
    kind: "model_context",
    eventId: "event:parent-context",
    sessionId: "parent-session",
    cumulativeInputTokens: 240_900,
    addedInputTokens: 8_000,
    contextWindowCapacity: 1_000_000,
    at: "2026-07-24T10:00:00.006Z",
  });
  trace.append({
    kind: "model_context",
    eventId: "event:child-context",
    sessionId: "child-session",
    cumulativeInputTokens: 30_000,
    addedInputTokens: 3_000,
    at: "2026-07-24T10:00:00.007Z",
  });
  trace.append({
    kind: "result_return",
    eventId: "event:return",
    sessionId: "parent-session",
    edgeId: "return-edge",
    parentSessionId: "parent-session",
    childSessionId: "child-session",
    resultTokenCount: 900,
    at: "2026-07-24T10:00:00.008Z",
  });

  const replay = trace.replay();
  assert.deepEqual(
    replay.events.slice(0, 4).map((event) => event.kind),
    ["front_matter_read", "full_payload_read", "search", "full_payload_read"],
  );
  const search = replay.events[2];
  assert.deepEqual(
    search?.kind === "search" ? search.resultNodeIds : [],
    ["context-node-a", "context-node-b"],
  );
  assert.equal(JSON.stringify(replay).includes("TRACE STORY PAYLOAD"), false);
  assert.equal(JSON.stringify(replay).includes("SECRET CONTEXT"), false);
  assert.deepEqual(replay.coverage, [ORIENTATION_RUNNER_ADAPTER_COVERAGE]);
  assert.ok(replay.coverage[0]?.omitted.includes("field:context_window_capacity"));
  assert.ok(replay.coverage[0]?.omitted.includes("field:candidate_follow_causality"));
  assert.equal(replay.relationships.some((edge) => edge.kind === "followed"), false);
  assert.deepEqual(
    replay.relationships.map((edge) => edge.kind),
    ["revisit", "spawn_handoff", "result_return"],
  );

  const parent = replay.sessions.find((lane) => lane.sessionId === "parent-session");
  const child = replay.sessions.find((lane) => lane.sessionId === "child-session");
  assert.equal(parent?.modelContext[0]?.cumulativeInputTokens, 240_900);
  assert.equal(parent?.modelContext[0]?.contextWindowCapacity, 1_000_000);
  assert.equal(child?.modelContext[0]?.cumulativeInputTokens, 30_000);
  assert.equal(child?.modelContext[0]?.contextWindowCapacity, undefined);
  assert.equal(JSON.stringify(replay).includes("500000"), false);
});
