// ChatPanel — the renderer-side THIN CLIENT for the desktop "an actual agent you can chat to"
// experience (chat-panel capability, ADR-0070 two-stage / ADR-0108). The operator types an intent;
// the panel POSTs it to /api/chat through the `api` streaming seam, consumes the SSE event stream,
// drives a busy state while the session is in flight, and renders the session's terminal outcome:
//
//   • a `done` frame   → the streamed proposal text (the success journey),
//   • an `error` frame → a DISTINCT failure state carrying the error (a dead/errored session),
//   • a `refused` frame → a DISTINCT "busy — try again" state carrying the reason (the single-session
//     guard, ADR-0108 d.6 — NOT a failure; the operator can retry),
//   • a REJECTED seam  → an honest disabled "chat is unavailable" state (the route is absent — the
//     studio-standalone case where /api/chat is not mounted), never a hung stream, never a crash.
//
// ACCEPT-TO-LAND AFFORDANCE (ADR-0108 d.3): a `done` frame that carries a `proposedUnitId` shows
// an explicit Build button. The ONLY trigger for a build dispatch is the operator CLICKING that
// button — never a free-text "yes" parsed from the conversation. The panel holds NO code path that
// auto-dispatches on stream-end or on any prose input. The accept affordance is absent when the
// `done` frame has no `proposedUnitId` (nothing safe to dispatch). The click POSTs through the
// `api.acceptBuild` seam to the DISTINCT /api/chat/accept route, which records accept-PROVENANCE —
// that the build came from a human accepting a chat proposal, not a generic build POST (ADR-0133 d.3;
// the routing is identical, only the provenance differs). After the click, the panel renders the run's
// coarse progress (polled via the SAME api.buildStatus) to a terminal state — the build journey in
// the same conversation (ADR-0108 d.7).
//
// THIN CLIENT — NO AGENT, NO DRIVE, NO MODEL PATH (ADR-0004 / ADR-0108 d.1). The panel's ONLY path to
// the chat route is the `api.chatStream` seam; it imports no agent/drive/model code and never imports
// `ChatStreamEvent` from @storytree/drive (forbidden in apps/studio/src by modelPathBoundary.test.ts).
// The SSE wire shape (the done/error/refused frames) is a plain-JSON cross-boundary contract owned by
// `chat-sse-mount` (apps/desktop) and re-declared studio-side in api.ts — the panel rides that type.
//
// APPEARANCE IS OPERATOR-ATTESTED, NOT ASSERTED HERE (ADR-0070): this proves geometry/behaviour only.
// The panel's look inside the native shell is the `desktop` story's operator-attested UAT leg 7 — the
// component author signs no visual verdict.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import type { ChatEvent } from '../api.js';
import type { BuildStatus } from '../types.js';

/** Poll cadence for the dispatched build run's coarse transcript (mirrors BuildSection's BUILD_POLL_MS).
 *  The interval must be < the test's tick(2_000) window so one tick drives exactly one poll. */
const CHAT_BUILD_POLL_MS = 1_500;

/** Local extension of the done frame shape that adds the optional `proposedUnitId` the wire carries
 *  when the agent proposes a specific capability to build (accept-to-land-affordance, ADR-0108 d.3).
 *  The base ChatDoneEvent in api.ts does not yet declare this field; we read it via a local
 *  intersection type so the panel can act on it without coupling to a future api.ts change. */
type ChatDoneWithUnitId = Extract<ChatEvent, { type: 'done' }> & { proposedUnitId?: string };

/** The panel's local chat phase: idle (offer the input) → busy (streaming; `streamed` accumulates the
 *  assistant text deltas as they arrive so the operator sees tokens live) → a terminal render, OR
 *  the honest absent-route degrade. The terminal frames map one-to-one onto the wire shape.
 *  `done` carries the optional `proposedUnitId` the accept affordance acts on. */
type Phase =
  | { kind: 'idle' }
  | { kind: 'busy'; streamed: string }
  | { kind: 'done'; proposal: string; costUsd?: number; turns?: number; proposedUnitId?: string }
  | { kind: 'error'; error: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'unavailable'; detail: string };

/** The panel's build dispatch phase — idle until the operator explicitly clicks the Build button
 *  (ADR-0108 d.3). Mirrors usePollableRun in BuildSection but scoped inline to the chat panel
 *  (the seam is the chat panel's, not the island's; the poll path is chat-scoped). */
type BuildPhase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'building'; runId: string; transcript: string[] }
  | { kind: 'terminal'; status: BuildStatus }
  | { kind: 'error'; message: string };

/** A small return-arrow (corner-down-left) glyph — the send affordance, an icon not a "Send" button
 *  (terminal look). Inline SVG: the studio carries no icon webfont; sibling components draw SVG inline.
 *  `currentColor` so the icon inherits the send button's forest-sage colour from CSS. */
function SendIcon(): React.JSX.Element {
  return (
    <svg
      className="chat-send-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

export function ChatPanel(): React.JSX.Element {
  const [intent, setIntent] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [buildPhase, setBuildPhase] = useState<BuildPhase>({ kind: 'idle' });
  // The intent the operator submitted for the CURRENT exchange — echoed back as a terminal prompt line
  // (`› <what they typed>`) ABOVE the reply, so the single in-flight exchange reads as a mini
  // scrollback. NOT a multi-turn history (the backend is single-session per submit); it holds only the
  // one current intent and is cleared back to empty on idle.
  const [submitted, setSubmitted] = useState('');
  // A re-entrancy guard so a double-submit (two synchronous clicks before the stream starts) cannot
  // fire a second POST. State alone is racy across synchronous events in the same tick; the ref flips
  // immediately. Mirrors usePollableRun's single-in-flight guard in BuildSection.
  const inFlight = useRef(false);

  const busy = phase.kind === 'busy';
  // The input/Send are disabled while streaming AND once the route is proven absent (the panel does
  // not pretend to work where /api/chat is not mounted — the honest degrade, never a hung spinner).
  const disabled = busy || phase.kind === 'unavailable';

  const submit = useCallback((): void => {
    if (inFlight.current) return; // a second concurrent submit cannot fire a second POST
    const trimmed = intent.trim();
    if (!trimmed) return; // client-side empty-intent guard — never POST an empty intent

    inFlight.current = true;
    setSubmitted(trimmed); // echo it back as the terminal prompt line for this exchange
    // The terminal frame the stream delivers (the backend end()s after one terminal event). We keep
    // the LAST terminal frame and render it when the stream resolves — the contracts pin the terminal
    // render, which is the journey the operator sees.
    let terminal: ChatEvent | null = null;
    // The streamed assistant text, accumulated from `delta` frames as they arrive. Rendering it live
    // (rather than spinning until the whole session ends) is the responsiveness fix — the operator
    // sees tokens generate. On `done` we settle to the authoritative proposal.
    let streamed = '';
    setPhase({ kind: 'busy', streamed: '' });

    api
      .chatStream(trimmed, (event) => {
        if (event.type === 'delta') {
          // A non-terminal token fragment — append and re-render the live busy view.
          streamed += event.text;
          setPhase({ kind: 'busy', streamed });
          return;
        }
        terminal = event;
      })
      .then(() => {
        if (terminal === null) {
          // The stream ended without a typed terminal frame — treat as an honest failure, not a hang.
          setPhase({ kind: 'error', error: 'the chat session ended without a result' });
          return;
        }
        switch (terminal.type) {
          case 'done': {
            // Read the optional proposedUnitId the wire carries (accept-to-land-affordance, ADR-0108
            // d.3) via the local extension type — the base ChatDoneEvent doesn't declare it yet.
            const doneExt = terminal as ChatDoneWithUnitId;
            setPhase({
              kind: 'done',
              proposal: terminal.proposal,
              ...(terminal.costUsd !== undefined ? { costUsd: terminal.costUsd } : {}),
              ...(terminal.turns !== undefined ? { turns: terminal.turns } : {}),
              ...(doneExt.proposedUnitId !== undefined ? { proposedUnitId: doneExt.proposedUnitId } : {}),
            });
            break;
          }
          case 'error':
            setPhase({ kind: 'error', error: terminal.error });
            break;
          case 'refused':
            setPhase({ kind: 'refused', reason: terminal.reason });
            break;
        }
      })
      .catch((e: unknown) => {
        // A rejected seam = the route is absent (a 404 / fetch error — studio-standalone). Degrade to
        // an honest disabled state; never hang on a stream that never arrives, never crash the surface.
        setPhase({ kind: 'unavailable', detail: e instanceof Error ? e.message : String(e) });
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [intent]);

  /** The Build button's click handler — the human's deliberate accept gate (ADR-0108 d.3).
   *  ONLY an explicit click here dispatches a build; no prose text and no stream-end auto-dispatches.
   *  Calls api.acceptBuild(proposedUnitId) EXACTLY once — the DISTINCT /api/chat/accept route that
   *  records accept-PROVENANCE (this build came from a human accepting a chat proposal, not a generic
   *  build POST; ADR-0133 d.3). The routing is identical to build(); only the provenance differs. Then
   *  transitions the build phase to polling (the SAME api.buildStatus poll — one registry). */
  const handleBuildClick = useCallback((): void => {
    if (phase.kind !== 'done' || phase.proposedUnitId === undefined) return;
    if (buildPhase.kind !== 'idle') return; // guard against a second dispatch
    const unitId = phase.proposedUnitId;
    setBuildPhase({ kind: 'starting' });
    api
      .acceptBuild(unitId)
      .then(({ runId }) => {
        setBuildPhase({ kind: 'building', runId, transcript: [] });
      })
      .catch((e: unknown) => {
        setBuildPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      });
  }, [phase, buildPhase.kind]);

  /** Poll for the dispatched run's coarse transcript. Active ONLY while a run is building; the
   *  interval tears itself down the moment a terminal status (passed/failed) lands or the component
   *  unmounts — no further fetches after the run ends (ADR-0090 poll posture). `activeBuildRunId`
   *  is the stable key: it's non-null only when building, so the effect is a no-op at all other
   *  phases (idle/starting/terminal/error). */
  const activeBuildRunId = buildPhase.kind === 'building' ? buildPhase.runId : null;
  useEffect(() => {
    if (activeBuildRunId === null) return;
    const runId = activeBuildRunId;
    let cancelled = false;

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      let status: BuildStatus;
      try {
        status = await api.buildStatus(runId);
      } catch (e) {
        if (!cancelled) {
          setBuildPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
        }
        return;
      }
      if (cancelled) return;
      if (status.status === 'building') {
        setBuildPhase({ kind: 'building', runId, transcript: status.transcript });
      } else {
        // passed | failed — the effect cleans up on the next render (activeBuildRunId → null).
        setBuildPhase({ kind: 'terminal', status });
      }
    };

    const id = setInterval(() => void poll(), CHAT_BUILD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeBuildRunId]);

  return (
    <div className="chat-panel">
      <div className="chat-outcome" aria-live="polite">
        {/* Echo the submitted intent as a terminal prompt line ABOVE the reply: `› <what they typed>`,
            so the current exchange reads top-to-bottom like a terminal scrollback. Shown for every
            non-idle phase (the one current exchange); cleared back to idle resets it. */}
        {phase.kind !== 'idle' && submitted && (
          <p className="chat-echo">
            <span className="chat-prompt-glyph" aria-hidden="true">
              {'›'}
            </span>
            <span className="chat-echo-text">{submitted}</span>
          </p>
        )}

        {phase.kind === 'busy' && (
          // The non-terminal "thinking/streaming" affordance. Before any token arrives it shows an
          // indeterminate progress bar ("working…"); once deltas stream in, the live text itself is
          // the progress, so the panel renders the accumulating tokens ("streaming…"). The exact look
          // is operator-attested (ADR-0070); the animated parts are decorative (aria-hidden).
          <div className="chat-busy">
            <p className="small chat-busy-status">
              <span className="build-spinner" aria-hidden="true" />
              <span className="chat-busy-label">{phase.streamed ? 'streaming…' : 'working…'}</span>
            </p>
            {phase.streamed ? (
              // The assistant's text as it generates — tokens appear live (the responsiveness fix).
              <p className="chat-streaming-text">{phase.streamed}</p>
            ) : (
              <div className="build-progress" aria-hidden="true">
                <span className="build-progress-bar" />
              </div>
            )}
          </div>
        )}

        {phase.kind === 'done' && (
          <div className="chat-proposal">
            <p className="chat-proposal-body">{phase.proposal}</p>
            {(phase.costUsd !== undefined || phase.turns !== undefined) && (
              <p className="muted small chat-proposal-meta">
                {phase.turns !== undefined && <span>{phase.turns} turns</span>}
                {phase.costUsd !== undefined && (
                  <span> · ${phase.costUsd.toFixed(2)}</span>
                )}
              </p>
            )}
            {/* Accept affordance — shown ONLY when the agent attached a machine-actionable
                proposedUnitId (ADR-0108 d.3). A done frame WITHOUT proposedUnitId shows the
                proposal text and NO Build button — nothing safe to dispatch. The ONLY trigger for
                a build is the explicit button click; no prose text can substitute for it. */}
            {phase.proposedUnitId !== undefined && (
              <div className="chat-accept">
                {buildPhase.kind === 'idle' && (
                  <button
                    type="button"
                    className="btn chat-build-btn"
                    onClick={handleBuildClick}
                  >
                    Build
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {phase.kind === 'error' && (
          <div className="chat-error">
            <p className="small chat-error-label verdict-fail">The chat session failed.</p>
            <p className="small chat-error-detail">{phase.error}</p>
          </div>
        )}

        {phase.kind === 'refused' && (
          <div className="chat-refused">
            <p className="small chat-refused-label">Busy — try again in a moment.</p>
            <p className="small chat-refused-detail muted">{phase.reason}</p>
          </div>
        )}

        {phase.kind === 'unavailable' && (
          <div className="chat-unavailable">
            <p className="small chat-unavailable-label">Chat is unavailable here.</p>
            <p className="small chat-unavailable-detail muted">
              This studio isn't serving the chat route — chat runs inside the desktop app. ({phase.detail})
            </p>
          </div>
        )}

        {/* Build progress — rendered while the dispatched run is in-flight OR terminal. The build
            journey shows in the SAME conversation: proposal → accept → progress → landed (ADR-0108
            d.7). The panel owns no build logic; it polls api.buildStatus and renders what arrives. */}
        {(buildPhase.kind === 'building' || buildPhase.kind === 'terminal') && (
          <div className="chat-build-progress">
            {buildPhase.kind === 'building' && buildPhase.transcript.length > 0 && (
              <ol className="chat-build-transcript">
                {buildPhase.transcript.map((line, i) => (
                  <li key={i} className="chat-build-transcript-line">{line}</li>
                ))}
              </ol>
            )}
            {buildPhase.kind === 'terminal' && (
              <>
                {buildPhase.status.transcript.length > 0 && (
                  <ol className="chat-build-transcript">
                    {buildPhase.status.transcript.map((line, i) => (
                      <li key={i} className="chat-build-transcript-line">{line}</li>
                    ))}
                  </ol>
                )}
                {buildPhase.status.status === 'passed' && (
                  <div className="chat-build-passed">
                    <p className="small verdict-pass">Build passed</p>
                    {buildPhase.status.envelope !== undefined && (
                      <p className="small chat-build-envelope">{buildPhase.status.envelope}</p>
                    )}
                  </div>
                )}
                {buildPhase.status.status === 'failed' && (
                  <div className="chat-build-failed">
                    <p className="small verdict-fail">Build failed</p>
                    {buildPhase.status.reason !== undefined && (
                      <p className="small chat-build-reason">{buildPhase.status.reason}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* The terminal INPUT ROW — pinned below the scrollback. A forest-sage `›` prompt glyph, the
          full-width transparent input, and an icon send button (a return-arrow, not a "Send" label).
          Plain Enter submits; Shift+Enter inserts a newline (handled in onKeyDown below). */}
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className="chat-prompt-glyph chat-input-glyph" aria-hidden="true">
          {'›'}
        </span>
        <textarea
          className="chat-input"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What would you like to work on?"
          rows={1}
          disabled={disabled}
          spellCheck={false}
          // Terminal keybindings: plain Enter submits (preventDefault); Shift+Enter inserts a newline
          // (fall through to the default). The submit()'s own trim guard blocks an empty/whitespace
          // intent. Cmd/Ctrl+Enter also submits (kept for parity with the rest of the studio).
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="chat intent"
        />
        <button
          type="submit"
          className="chat-send"
          disabled={disabled}
          aria-label="send"
        >
          {busy ? (
            <span className="chat-spinner build-spinner build-spinner-inline" aria-hidden="true" />
          ) : (
            <SendIcon />
          )}
        </button>
      </form>
      <p className="chat-hint" aria-hidden="true">
        enter to send · shift+enter for newline
      </p>
    </div>
  );
}
