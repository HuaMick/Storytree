/**
 * Tests for the non-spoofable proposed-unit signal (ADR-0108 d.3):
 * The headless orchestrator captures the unitId declared via a typed `propose_unit`
 * tool_use message — a structural declaration, not a regex scraped from free text.
 *
 * Behaviours pinned:
 *   A. A session that emits a `propose_unit` tool_use block has its declared unitId
 *      captured onto `result.proposedUnitId`.
 *   B. A session that never calls `propose_unit` returns `proposedUnitId: undefined`
 *      (no forged id, no default).
 *
 * Both tests are OFFLINE (injected queryFn, no live SDK spend — ADR-0010 §5).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { runHeadlessOrchestrator } from "./headless-orchestrator.js";
import type { SdkQueryFn } from "./sdk-author.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function queryYielding(messages: unknown[]): SdkQueryFn {
  return () =>
    (async function* () {
      for (const m of messages) yield m;
    })();
}

const okResult = {
  type: "result",
  subtype: "success",
  is_error: false,
  num_turns: 2,
  total_cost_usd: 0.01,
  result: "My proposal: build the proposed-unit-signal capability.",
};

/**
 * Build a scripted assistant message carrying a `propose_unit` tool_use block.
 * Mirrors the complete SDK assistant message shape (the loop sees these per turn,
 * distinct from the `stream_event` partial messages used for text deltas).
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
// A. Session emits a propose_unit tool_use → unitId captured on result
// ---------------------------------------------------------------------------

test("runHeadlessOrchestrator: captures proposedUnitId from a propose_unit tool_use message", async () => {
  const res = await runHeadlessOrchestrator({
    systemPrompt: "You are the orchestrator agent.",
    userPrompt: "Orient and propose the next unit.",
    queryFn: queryYielding([
      proposeUnitMessage("some-unit"),
      okResult,
    ]),
  });

  assert.equal(res.ok, true, "session must succeed");

  // proposedUnitId is the new field — cast to the expected shape so the file typechecks at
  // HEAD (the field is not yet on the interface) while the runtime assertion catches the
  // missing capture: at HEAD this is undefined, failing the assertion (the right-kind red).
  const proposedUnitId = (res as typeof res & { proposedUnitId?: string }).proposedUnitId;
  assert.equal(
    proposedUnitId,
    "some-unit",
    "proposedUnitId must be captured from the propose_unit tool_use message's unitId input — " +
      "a typed structural declaration, not a regex scraped from the proposal text (ADR-0108 d.3)",
  );
});

// ---------------------------------------------------------------------------
// B. Session with no propose_unit call → proposedUnitId: undefined (no forged id)
// ---------------------------------------------------------------------------

test("runHeadlessOrchestrator: returns proposedUnitId undefined when no propose_unit is called", async () => {
  const res = await runHeadlessOrchestrator({
    systemPrompt: "You are the orchestrator agent.",
    userPrompt: "Just think out loud without calling any tools.",
    queryFn: queryYielding([okResult]),
  });

  assert.equal(res.ok, true, "session must succeed");

  const proposedUnitId = (res as typeof res & { proposedUnitId?: string }).proposedUnitId;
  assert.equal(
    proposedUnitId,
    undefined,
    "proposedUnitId must be undefined when no propose_unit tool_use was emitted — " +
      "the runner must never forge a default id",
  );
});
