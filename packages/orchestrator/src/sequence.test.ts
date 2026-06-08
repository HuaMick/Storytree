import { test } from "node:test";
import assert from "node:assert/strict";
import type { StepResult } from "@storytree/agent";
import { runSequence, runLoop } from "./sequence.js";

/** Build an `ok` StepResult double with the given output + optional structured output. */
function okStep<T>(output: string, structuredOutput?: T): StepResult<T> {
  const base = { ok: true as const, output, transcript: [] };
  return structuredOutput === undefined ? base : { ...base, structuredOutput };
}

/** Build a failing (halting) StepResult double. */
function failStep<T = unknown>(
  error: "NoTerminalResult" | "ValidationFailed" | "ModelError" = "NoTerminalResult",
): StepResult<T> {
  return { ok: false, error };
}

test("runSequence runs all steps in order and returns the full prefix on success", async () => {
  const calls: number[] = [];
  const run = await runSequence<string>((prev, index) => {
    return async () => {
      calls.push(index);
      return okStep(`step-${index}`);
    };
  }, 3);

  assert.deepEqual(calls, [0, 1, 2]);
  assert.equal(run.halted, false);
  assert.equal(run.steps.length, 3);
  assert.equal(run.haltedAt, undefined);
});

test("runSequence splices the previous result into the next step's input", async () => {
  // The build closure receives the previous result; we assert step 1 sees step 0's output.
  const seenPrevOutputs: (string | undefined)[] = [];
  await runSequence<string>((prev, index) => {
    return async () => {
      seenPrevOutputs.push(prev && prev.ok ? prev.output : undefined);
      return okStep(`out-${index}`);
    };
  }, 2);

  // Step 0 had no previous; step 1 saw step 0's "out-0".
  assert.deepEqual(seenPrevOutputs, [undefined, "out-0"]);
});

test("runSequence HALTS fail-closed on the first failing step and runs no later step", async () => {
  const ran: number[] = [];
  const run = await runSequence<string>((prev, index) => {
    return async () => {
      ran.push(index);
      // Step 1 halts.
      return index === 1 ? failStep<string>("NoTerminalResult") : okStep(`ok-${index}`);
    };
  }, 4);

  // Steps 0 and 1 ran; 2 and 3 were never invoked.
  assert.deepEqual(ran, [0, 1]);
  assert.equal(run.halted, true);
  assert.equal(run.haltedAt, 1);
  // Only the successful prefix (step 0) is retained.
  assert.equal(run.steps.length, 1);
  assert.ok(run.failure && run.failure.ok === false);
  assert.equal(run.failure.error, "NoTerminalResult");
});

test("runLoop passes when an iteration is ok and the verdict is green within budget", async () => {
  let observed = 0;
  const run = await runLoop<{ verdict: string }>({
    iterate: async (i) => {
      observed = i;
      // Iteration 0,1 are not-yet-green; iteration 2 is green.
      return i < 2
        ? okStep("running", { verdict: "fail" })
        : okStep("done", { verdict: "pass" });
    },
    passes: (v) => v?.verdict === "pass",
    maxIterations: 5,
  });

  assert.equal(run.passed, true);
  assert.equal(run.iterations, 3); // iterations 0,1,2 — stops on the first green
  assert.equal(run.halted, false);
  assert.equal(observed, 2);
});

test("runLoop returns passed:false when the budget is exhausted without a green", async () => {
  const run = await runLoop<{ verdict: string }>({
    iterate: async () => okStep("still red", { verdict: "fail" }),
    passes: (v) => v?.verdict === "pass",
    maxIterations: 3,
  });

  assert.equal(run.passed, false);
  assert.equal(run.iterations, 3);
  assert.equal(run.halted, false); // last iteration was ok, just not passing
});

// THE HARD-WON GUARD (ported in spirit from
// legacy/Agentic/crates/agentic-runtime/tests/loop_halt_no_false_pass.rs):
// a HALTING iteration must yield passed:false even when an earlier/inner value looked green.
// A false-green corrupts the spine's routing.
test("HARD GUARD: a halting iteration is NEVER a pass, even with a green-looking inner value", async () => {
  // Every iteration: the iterate fn does inner work that LOOKS green, but the iteration's own
  // returned StepResult HALTS (ok:false). The pass arm is gated on result.ok, so this can never
  // short-circuit to passed:true — it must run the full budget and report passed:false.
  let iterationsObserved = 0;
  const run = await runLoop<{ verdict: string }>({
    iterate: async () => {
      iterationsObserved += 1;
      // The LANDMINE: an inner value that the predicate WOULD accept...
      const innerLooksGreen = { verdict: "pass" } as const;
      void innerLooksGreen;
      // ...but the iteration HALTS, so its StepResult is ok:false.
      return failStep<{ verdict: string }>("NoTerminalResult");
    },
    // The predicate would accept "pass" — but it must NEVER be reached on a halted iteration.
    passes: (v) => v?.verdict === "pass",
    maxIterations: 2,
  });

  // No false green: passed is false, the full budget ran, and halted reflects the last iteration.
  assert.equal(run.passed, false, "a halting iteration must NEVER yield passed:true (false green)");
  assert.equal(run.iterations, 2, "the loop must run its full budget — not stop early on a false green");
  assert.equal(run.halted, true, "the last iteration halted");
  assert.equal(iterationsObserved, 2);
});

test("HARD GUARD corollary: passes() is never invoked for a halted iteration", async () => {
  let passesCalls = 0;
  await runLoop<{ verdict: string }>({
    iterate: async () => failStep<{ verdict: string }>("ModelError"),
    passes: (v) => {
      passesCalls += 1;
      return v?.verdict === "pass";
    },
    maxIterations: 3,
  });

  // The pass arm short-circuits on result.ok === false BEFORE evaluating passes().
  assert.equal(passesCalls, 0, "passes() must not be consulted for a halted (ok:false) iteration");
});
