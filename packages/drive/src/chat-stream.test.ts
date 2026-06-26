/**
 * Integration tests for the chat-stream adapter (packages/drive/src/chat-stream.ts).
 *
 * Pins:
 *   1. A successful orchestrate session → the stream terminates with a `done` event carrying
 *      the proposal text (the same text `orchestrate()` surfaces).
 *   2. Orchestrate fails (session-orchestrator absent from store) → stream terminates with a
 *      typed `error` event; the SDK is NOT called (fail-closed before any spend).
 *   3. The terminal `done` event surfaces `costUsd` and `turns` from the orchestrate result.
 *   4. The stream NEVER throws — errors are emitted as a terminal `error` event.
 *
 * IT REUSES THE PHASE-1 COMPOSITION (ADR-0108 d.2): the adapter calls `orchestrate()` — the
 * SAME composition the programmatic entry and terminal command use. It does not re-render the
 * prompt, re-wire the orientation tools, or re-implement the session.
 *
 * All tests are OFFLINE: the `queryFn` seam is injected; no live SDK spend (ADR-0010 §5).
 * The live chat run (real panel ↔ real SDK) is the operator-attested Story UAT leg.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryStore } from "@storytree/storage-protocol";
import { loadCorpus } from "@storytree/library/store";
import type { SdkQueryFn } from "@storytree/agent";

// RED: chat-stream.ts does not exist yet — module-not-found is the right-kind red.
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

const OK_SDK_RESULT = {
  type: "result",
  subtype: "success",
  is_error: false,
  num_turns: 3,
  total_cost_usd: 0.02,
  result: "I propose: build the chat-stream adapter as the next Phase-2 capability.",
};

// ---------------------------------------------------------------------------
// 1. Successful session → terminal `done` event with proposal
// ---------------------------------------------------------------------------

test(
  "startChatStream: successful session terminates with a `done` event carrying the proposal",
  async () => {
    const store = new InMemoryStore();
    await loadCorpus(store);

    const events = await drain(
      startChatStream({
        intent: "Orient and propose the next unit.",
        store,
        queryFn: queryYielding([OK_SDK_RESULT]),
      }),
    );

    assert.ok(events.length > 0, "stream must yield at least one event");

    const last = events[events.length - 1];
    assert.ok(last !== undefined, "stream must yield at least one event");

    assert.equal(
      last.type,
      "done",
      `last event must be 'done' (got '${last.type}'); a non-terminal or error event must not be the final one`,
    );

    // Narrow to the done branch and assert the proposal text
    assert.equal(
      last.type === "done" ? last.proposal : undefined,
      OK_SDK_RESULT.result,
      "done event must carry the proposal from the orchestrate composition's result message",
    );
  },
);

// ---------------------------------------------------------------------------
// 2. Orchestrate fails (agent absent) → terminal `error` event, no SDK call
// ---------------------------------------------------------------------------

test(
  "startChatStream: when session-orchestrator is absent, terminates with a typed `error` event without calling the SDK",
  async () => {
    const store = new InMemoryStore(); // empty — no agents seeded

    let sdkCalled = false;
    const sentinelQuery: SdkQueryFn = () => {
      sdkCalled = true;
      return (async function* () {
        yield OK_SDK_RESULT;
      })();
    };

    // must NOT throw — error is emitted as a typed terminal event
    const events = await drain(
      startChatStream({
        intent: "Orient and propose.",
        store,
        queryFn: sentinelQuery,
      }),
    );

    assert.ok(
      !sdkCalled,
      "the SDK must NOT be called when the agent render fails (fail-closed: no spend before the guard)",
    );

    assert.ok(events.length > 0, "stream must yield at least one event");

    const last = events[events.length - 1];
    assert.ok(last !== undefined, "stream must yield at least one event");

    assert.equal(
      last.type,
      "error",
      `last event must be 'error' when session-orchestrator is absent; got '${last.type}'`,
    );
    assert.ok(
      last.type === "error" && typeof last.error === "string" && last.error.length > 0,
      "the error event must carry a non-empty error string describing what went wrong",
    );
  },
);

// ---------------------------------------------------------------------------
// 3. Done event surfaces costUsd and turns from the orchestrate result
// ---------------------------------------------------------------------------

test(
  "startChatStream: done event surfaces costUsd and turns from the orchestrate result",
  async () => {
    const store = new InMemoryStore();
    await loadCorpus(store);

    const events = await drain(
      startChatStream({
        intent: "Orient and propose.",
        store,
        queryFn: queryYielding([OK_SDK_RESULT]),
      }),
    );

    const done = events.find((e) => e.type === "done");
    assert.ok(done !== undefined, "stream must contain a terminal `done` event");

    assert.equal(
      done.type === "done" ? done.costUsd : undefined,
      OK_SDK_RESULT.total_cost_usd,
      "done event must surface costUsd from the orchestrate result (total_cost_usd)",
    );
    assert.equal(
      done.type === "done" ? done.turns : undefined,
      OK_SDK_RESULT.num_turns,
      "done event must surface turns from the orchestrate result (num_turns)",
    );
  },
);
