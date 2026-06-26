/**
 * Chat-stream adapter (ADR-0108 Phase 2):
 * Wraps the Phase-1 `orchestrate()` composition in an async-generator event stream suitable
 * for SSE delivery. The adapter never throws — errors are emitted as a terminal `error` event.
 *
 * Phase 2 surface shape (ADR-0108 d.1 / d.2):
 *   - intake: an HTTP POST body adapted by the route (the adapter itself is transport-agnostic)
 *   - stream: typed ChatStreamEvent values the route serialises as SSE
 *   - read/propose only — no signing, no building, no PR/gate/merge (ADR-0091 / Phase-2 wall)
 *
 * REUSES THE PHASE-1 COMPOSITION (ADR-0108 d.2): calls `orchestrate()` — the same composition
 * the programmatic entry and the terminal `orchestrate` command use. The adapter adapts the
 * composition's result into a stream; it does not re-render the prompt, re-wire the orientation
 * tools, or re-implement the session.
 *
 * OFFLINE-TESTABLE BY INJECTION: the `queryFn` seam is forwarded to `orchestrate()` so the
 * intake → session → stream is proven without live SDK spend (ADR-0010 §5).
 */

import type { Store } from "@storytree/storage-protocol";
import type { SdkQueryFn, OrientationRunner } from "@storytree/agent";

import { orchestrate } from "./orchestrate.js";

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** A terminal done event — the proposal text plus session metrics. */
export interface ChatStreamDoneEvent {
  type: "done";
  proposal: string;
  costUsd: number | undefined;
  turns: number | undefined;
}

/** A terminal error event — emitted instead of throwing when the session fails. */
export interface ChatStreamErrorEvent {
  type: "error";
  error: string;
}

/** All events the chat stream can emit (discriminated by `type`). */
export type ChatStreamEvent = ChatStreamDoneEvent | ChatStreamErrorEvent;

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

/** Arguments for {@link startChatStream}. */
export interface StartChatStreamArgs {
  /** The session intent: what the orchestrator is asked to orient and propose for. */
  intent: string;
  /** The store to render the `session-orchestrator` agent from (seed corpus or live pg store). */
  store: Store;
  /**
   * Injectable SDK query function — an offline scripted double proves the adapter without live
   * spend (ADR-0010 §5). Omit for a live run.
   */
  queryFn?: SdkQueryFn;
  /**
   * The orientation runner the headless session's tools dispatch through. Required for a live run
   * with real orientation; omit for offline tests (the scripted queryFn never dispatches tools).
   */
  runner?: OrientationRunner;
  /** Live SDK leaf model (live run only). */
  model?: string;
  /** Turn ceiling for the live session (live run only). */
  maxTurns?: number;
  /** Hard USD budget ceiling for the live session (live run only). */
  maxBudgetUsd?: number;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Start an orchestrate session and yield its outcome as a typed event stream.
 *
 * The stream always terminates — either with a `done` event carrying the proposal text and
 * session metrics, or with an `error` event when the session fails. The stream NEVER throws;
 * any failure (agent absent, SDK error, unexpected exception) is emitted as a typed `error`
 * event so the caller can forward it directly to the SSE client.
 */
export async function* startChatStream(
  args: StartChatStreamArgs,
): AsyncGenerator<ChatStreamEvent> {
  try {
    const result = await orchestrate({
      intent: args.intent,
      store: args.store,
      ...(args.queryFn !== undefined ? { queryFn: args.queryFn } : {}),
      ...(args.runner !== undefined ? { runner: args.runner } : {}),
      ...(args.model !== undefined ? { model: args.model } : {}),
      ...(args.maxTurns !== undefined ? { maxTurns: args.maxTurns } : {}),
      ...(args.maxBudgetUsd !== undefined ? { maxBudgetUsd: args.maxBudgetUsd } : {}),
    });

    if (!result.ok) {
      yield { type: "error", error: result.error ?? "orchestrate failed" };
      return;
    }

    yield {
      type: "done",
      proposal: result.proposal ?? "",
      costUsd: result.costUsd,
      turns: result.turns,
    };
  } catch (e) {
    yield {
      type: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
