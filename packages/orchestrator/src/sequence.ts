import type { StepResult } from "@storytree/agent";

/**
 * The deterministic step machine (ADR-0005 spine) — ported in spirit from
 * legacy/Agentic/crates/agentic-runtime/src/sequence.rs (`run_sequence` + `run_loop`).
 *
 * The spine OWNS control flow; the leaf only judges. These runners are generic over the
 * step's structured-output type and take the model-touching work as caller closures, so the
 * orchestrator never reaches into the owned loop directly — it composes {@link StepResult}s.
 */

/**
 * A step function: produces one {@link StepResult}. The caller closes over whatever it needs
 * (a model, a prompt spliced from the previous result) — the spine only sees the result.
 */
export type StepFn<S> = () => Promise<StepResult<S>>;

/**
 * The outcome of {@link runSequence}: the captured results in order, plus the fail-closed halt
 * point. `halted` is true iff a step returned `{ ok:false }`; `haltedAt` is its zero-based index
 * and `failure` the failing result. On full success `halted` is false and `steps` has one entry
 * per step.
 */
export interface SequenceRun<S> {
  steps: StepResult<S>[];
  halted: boolean;
  haltedAt?: number;
  failure?: Extract<StepResult<S>, { ok: false }>;
}

/**
 * Run an ordered sequence of steps, splicing the previous result into the next step's input.
 *
 * Each step is built by {@link build}, which receives the PREVIOUS step's result (undefined for
 * step 0) and the current index — the caller closure uses that to splice the prior output into
 * the next prompt (sequence.rs `run_sequence` splice composition). Steps run strictly in order.
 *
 * FAIL-CLOSED HALT (sequence.rs §fail-closed): the sequence HALTS on the first `{ ok:false }`
 * result, records it, and runs no later step. A step that did not reach a terminal result stops
 * the cascade — the partial prefix of successful results is returned.
 */
export async function runSequence<S>(
  build: (prev: StepResult<S> | undefined, index: number) => StepFn<S>,
  stepCount: number,
): Promise<SequenceRun<S>> {
  const steps: StepResult<S>[] = [];

  for (let index = 0; index < stepCount; index += 1) {
    const prev = index === 0 ? undefined : steps[index - 1];
    const step = build(prev, index);
    const result = await step();

    if (!result.ok) {
      // Fail-closed: halt here, returning the successful prefix and the failure.
      return { steps, halted: true, haltedAt: index, failure: result };
    }
    steps.push(result);
  }

  return { steps, halted: false };
}

/** The arguments to {@link runLoop}. */
export interface LoopArgs<V> {
  /** Run one iteration, producing a {@link StepResult}. `iteration` is zero-based. */
  iterate: (iteration: number) => Promise<StepResult<V>>;
  /** The verdict predicate, evaluated ONLY on an `ok` iteration's structured output. */
  passes: (v: V | undefined) => boolean;
  /** The iteration budget. The loop runs at most this many iterations. */
  maxIterations: number;
}

/** The outcome of {@link runLoop}. */
export interface LoopRun<V> {
  /** True iff an iteration was `ok` AND `passes` accepted its structured output. */
  passed: boolean;
  /** The number of iterations actually executed. */
  iterations: number;
  /**
   * True iff the last iteration HALTED (its {@link StepResult} was `{ ok:false }`). A halted
   * iteration can NEVER yield `passed:true` — see the pass-arm guard below.
   */
  halted: boolean;
  /** The last iteration's result (the one that passed, halted, or exhausted the budget). */
  last?: StepResult<V>;
}

/**
 * Repeat {@link LoopArgs.iterate} until an iteration is `ok` AND `passes` accepts its structured
 * output, OR the budget is hit (sequence.rs `run_loop`).
 *
 * THE HARD-WON GUARD — ported in spirit from
 * legacy/Agentic/crates/agentic-runtime/tests/loop_halt_no_false_pass.rs: if an iteration HALTS
 * (its {@link StepResult} is `{ ok:false }`), the loop can NEVER report `passed:true`. The pass
 * arm is gated on the iteration being `ok` — a halted iteration is a non-pass, full stop, even if
 * an inner/earlier value looked green. A false-green here corrupts the spine's routing (it would
 * treat an iteration that never reached its verdict as hardened). This is the single most
 * important invariant in this file.
 */
export async function runLoop<V>(args: LoopArgs<V>): Promise<LoopRun<V>> {
  const { iterate, passes, maxIterations } = args;
  let iterations = 0;
  let last: StepResult<V> | undefined;

  for (let i = 0; i < maxIterations; i += 1) {
    iterations += 1;
    const result = await iterate(i);
    last = result;

    // THE GUARD: the pass arm is reachable ONLY when this iteration is ok. A halted
    // (`ok:false`) iteration is a non-pass and the loop continues to the budget — it can
    // never short-circuit to passed:true.
    if (result.ok && passes(result.structuredOutput)) {
      return { passed: true, iterations, halted: false, last: result };
    }
  }

  // Budget exhausted without a passing verdict. `halted` reflects the LAST iteration's
  // disposition; either way `passed` is false (the guard above never fired). `last` is only
  // undefined when maxIterations <= 0 (no iteration ran) — omit it then (exactOptionalProperties).
  const halted = last !== undefined && !last.ok;
  return last === undefined
    ? { passed: false, iterations, halted }
    : { passed: false, iterations, halted, last };
}
