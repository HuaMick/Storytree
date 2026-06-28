/**
 * Integration test for proposal-id threading through the chat-stream adapter
 * (packages/drive capability `proposal-id-threading`).
 *
 * Pins: `pit-done-event-carries-proposed-unit-id` — when the agent declares a unit via the
 * `propose_unit` tool during a scripted session, the terminal `done` event of `startChatStream`
 * surfaces the declared `proposedUnitId`, threading the value end-to-end:
 *   runHeadlessOrchestrator result (HeadlessOrchestratorResult.proposedUnitId)
 *     → OrchestrateResult (spread through, ADR-0108 Phase 1)
 *     → startChatStream's terminal `done` event (ChatStreamDoneEvent.proposedUnitId)
 *
 * This is the THREADING proof (ADR-0108 d.2): the value traverses the full composition in one
 * end-to-end assertion — from the runner result, through `orchestrate()`'s composition, onto the
 * stream's terminal event — not just the runner in isolation (that is `proposed-unit-signal.test.ts`
 * in @storytree/agent). Crossing both the composition AND the stream adapter makes this a capability
 * integration test against the real in-story collaborator.
 *
 * Drives the REAL `orchestrate()` composition with an injected `queryFn` scripted double —
 * OFFLINE, no live SDK spend (ADR-0010 §5). The live run is the Story UAT human-witness leg.
 *
 * RIGHT-KIND RED AT HEAD: `ChatStreamDoneEvent` has no `proposedUnitId` field → the terminal
 * `done` event's `proposedUnitId` is `undefined` at runtime (tsx strips types) → the assertion
 * `undefined === DECLARED_UNIT_ID` fails with a runtime assertion error, never a missing symbol.
 * ASSERT THE TYPED FIELD on the `done` event — not just that a `done` event arrived (that is
 * green at HEAD and would fail CONFIRM_RED).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryStore } from "@storytree/storage-protocol";
import { loadCorpus } from "@storytree/library/store";
import type { SdkQueryFn } from "@storytree/agent";

import { startChatStream } from "./chat-stream.js";
import type { ChatStreamEvent } from "./chat-stream.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Drain an async iterable of chat events into an array. */
async function drain(gen: AsyncIterable<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

function queryYielding(messages: unknown[]): SdkQueryFn {
  return () =>
    (async function* () {
      for (const m of messages) yield m;
    })();
}

/** A scripted success result message — the SDK terminal message on a successful session. */
function okResult(proposal: string): unknown {
  return {
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 2,
    total_cost_usd: 0.01,
    result: proposal,
  };
}

/**
 * A scripted assistant message carrying a `propose_unit` tool_use block — the structural
 * declaration `runHeadlessOrchestrator` captures into `result.proposedUnitId` via
 * `extractProposedUnit`. The tool name is the exact `mcp__proposal__propose_unit` the extraction
 * path keys on (mirrors the helper in `proposed-unit-signal.test.ts`).
 */
function proposeUnitMessage(unitId: string): unknown {
  return {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "tu_propose_1",
          name: "mcp__proposal__propose_unit",
          input: { unitId },
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// pit-done-event-carries-proposed-unit-id
// ---------------------------------------------------------------------------

test(
  "pit-done-event-carries-proposed-unit-id: the terminal done event surfaces proposedUnitId from the orchestrate result when the agent declares a unit",
  async () => {
    const store = new InMemoryStore();
    await loadCorpus(store);

    const DECLARED_UNIT_ID = "drive:proposal-id-threading/thread-id";

    // The scripted session declares a unit via propose_unit then returns a successful result.
    // This is the exact path the live agent takes: it calls propose_unit (tool_use message) and
    // ends with a final result message. The double drives extractProposedUnit in the real runner.
    const events = await drain(
      startChatStream({
        intent: "Orient and propose the next unit.",
        store,
        queryFn: queryYielding([
          proposeUnitMessage(DECLARED_UNIT_ID),
          okResult("I propose drive:proposal-id-threading/thread-id as the next unit."),
        ]),
      }),
    );

    const done = events.find((e) => e.type === "done");
    assert.ok(done !== undefined, "stream must contain a terminal `done` event");
    assert.equal(done.type, "done", "the terminal event must be `done`");

    // Threading assertion: proposedUnitId must flow from runHeadlessOrchestrator's result
    // → orchestrate()'s OrchestrateResult (spread through) → startChatStream's done event.
    //
    // At HEAD: ChatStreamDoneEvent has no proposedUnitId field → done.proposedUnitId is
    // undefined at runtime (types stripped by tsx) → assert.equal(undefined, DECLARED_UNIT_ID)
    // throws a runtime assertion error → right-kind red.
    //
    // After implementation: ChatStreamDoneEvent gains proposedUnitId?: string and the done
    // branch sets it from result.proposedUnitId → assertion passes → typecheck passes.
    assert.equal(
      done.type === "done" ? done.proposedUnitId : undefined,
      DECLARED_UNIT_ID,
      "the `done` event must surface proposedUnitId threaded through the full orchestrate " +
        "composition (HeadlessOrchestratorResult → OrchestrateResult → ChatStreamDoneEvent); " +
        "at HEAD ChatStreamDoneEvent.proposedUnitId is absent → undefined → assertion fails",
    );
  },
);
