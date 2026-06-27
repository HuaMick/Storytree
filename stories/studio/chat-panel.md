---
id: "chat-panel"
tier: capability
story: studio
title: "The renderer chat panel — a thin client that POSTs /api/chat and renders the streamed done/error/refused SSE events"
outcome: "The studio renderer gains a chat panel that POSTs a chat message to the local backend's `POST /api/chat` route, reads the Server-Sent-Events stream, and renders the streamed terminal `done` proposal / `error` / `refused` events with in-flight (busy), error, and a distinct \"busy — try again\" (refused) state — a THIN CLIENT that never imports `@storytree/agent` (nor `@storytree/drive`) and holds no model path (ADR-0108 d.1 / ADR-0004); its only seam to the agent is the `fetch('/api/chat')` HTTP route."
status: proposed
proof_mode: integration-test
depends_on: [dev-server-persistence-backbone]
# Node-borne proof config (ADR-0057 keystone): authoring THIS block is what makes the capability
# inner-loop buildable — no NODE_BUILD_REGISTRY edit. NET-NEW (no editsExisting): the leaf authors a
# vitest component test that imports a NOT-YET-EXISTING `ChatPanel` from a NEW source file under
# apps/studio/src/components/ (red = module-not-found against the source that does not exist at HEAD),
# then writes that ONE new source file (green). The new component POSTs `{ intent }` to `POST /api/chat`
# via `fetch`, reads the `text/event-stream` ReadableStream, parses the `data: <json>\n\n` SSE frames into
# `ChatStreamEvent`s (`done`/`error`/`refused`), and renders the terminal event — with in-flight/busy,
# error, and a distinct "busy — try again" (refused) state. The proof is FULLY OFFLINE: the test mocks
# global `fetch` to return a scripted `text/event-stream` Response whose body is a ReadableStream of the
# `data: {...}\n\n` frames (the "inject the collaborator as a scripted double" discipline) — NO live SDK,
# NO DB, NO real socket. The panel's APPEARANCE is NOT machine-proven here (that is the desktop story's
# operator-attested UAT leg 7).
#
# RUNNER: the studio frontend test runner is VITEST (`pnpm --filter studio test` -> `vitest run`, with
# @testing-library/react + jsdom), NOT node:test. So `real.proofCommand` MUST be the studio vitest
# command — WITHOUT it the spine would default to `node --import tsx --test <testFile>`, which cannot run
# a jsdom/vitest `.tsx` test (vitest globals + the jsdom env would be undefined). This is the graduated
# "vitest-runner-mismatch" learning applied: the proof command is the package's real vitest runner.
# `install: true` + a `typecheck` wall because the test imports VALUE functions across the package boundary
# (react / @testing-library/react / vitest), the proof runs in a fresh worktree (tsx + tsc + vitest need
# the lockfile-only install, ADR-0031 §2), and tsx strips types so only a real `tsc --noEmit` catches a
# type-illegal-but-runtime-green panel.
# SCOPE = apps/studio (the panel lives in apps/studio/src/components/), NOT apps/desktop or packages/drive
# — the SSE/intake backend (chat-sse-mount) and the streaming core (chat-session-stream) are already green
# at their own scopes; THIS proves the renderer panel that consumes the route.
proof:
  command:
    file: pnpm
    args: ["--filter", "studio", "test"]
  scope:
    testGlobs: ["apps/studio/src/**/*.test.tsx"]
    sourceGlobs: ["apps/studio/src/**/*.tsx"]
  real:
    testFile: "apps/studio/src/components/ChatPanel.test.tsx"
    sourceFile: "apps/studio/src/components/ChatPanel.tsx"
    scope:
      testGlobs: ["apps/studio/src/components/ChatPanel.test.tsx"]
      sourceGlobs: ["apps/studio/src/components/ChatPanel.tsx"]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "studio", "typecheck"]
    proofCommand:
      file: pnpm
      args: ["--filter", "studio", "test"]
---

# The renderer chat panel — a thin client that POSTs /api/chat and renders the streamed SSE events

**Outcome —** The studio renderer gains a chat panel that POSTs a chat message to the local backend's
`POST /api/chat` route, reads the Server-Sent-Events stream, and renders the streamed terminal `done`
proposal / `error` / `refused` events with in-flight (busy), error, and a distinct "busy — try again"
(refused) state. It is a **thin client** that never imports `@storytree/agent` (nor `@storytree/drive`)
and holds no model path (ADR-0108 d.1 / ADR-0004) — its only seam to the agent is the
`fetch('/api/chat')` HTTP route, downstream of the desktop's
[`chat-sse-mount`](../desktop/chat-sse-mount.md) dispatcher and `static-server.ts`'s `/api/*` proxy.

**Depends on —**
- [`dev-server-persistence-backbone`](dev-server-persistence-backbone.md) — the panel's only path to the
  agent is a `fetch('/api/chat')` over the studio's `/api/*` middleware seam, exactly as `read-corpus`
  and `browse-library` ride the backbone's `/api/*` registration for their reads. The panel imports no
  build/agent code; it speaks to the route. (At runtime that route is served by the desktop's
  `chat-sse-mount` dispatcher when the studio bundle is rendered inside the desktop shell, and is absent
  in the bare studio dev server — see "Where the route comes from" below.)

> **Proof status (honest) — NOT BUILT, `proposed`. The FIRST forward-built studio capability.** The
> studio story's other seven capabilities are RETROSPECTIVE specs over already-working code (each
> describes the test that WOULD prove a built leaf). THIS capability is genuinely **NET-NEW /
> forward-built**: it precedes the code and carries a real `proof:`/`real:` block (proof-wired for
> vitest) so the spine can drive it red→green under its own gate. It is the realization of the renderer
> chat **PANEL** the corpus assigns to the `studio` story — the third of the chat surface's three layers
> (the streaming **backend** [`chat-session-stream`](../headless-orchestrator/chat-session-stream.md) is
> headless-orchestrator's Phase 2, BUILT/green; the desktop-side **mount**
> [`chat-sse-mount`](../desktop/chat-sse-mount.md) is a desktop capability, on `main` via PR #439; this
> **panel** is the studio frontend component, see the desktop story's "Renderer chat panel placement" +
> Open modeling call #1). Its provable geometry/behaviour is proven here; its *appearance inside the
> native shell* is the desktop story's operator-attested UAT leg 7 (the look is witnessed, never a
> machine visual verdict).

## Guidance

WHY THIS IS A CAPABILITY, NOT A CONTRACT: its honest proof is the CHAT PANEL AS A WHOLE — a renderer
component that, given a chat message, POSTs it to `POST /api/chat`, READS the `text/event-stream`
response body as a stream, PARSES the `data: <json>\n\n` SSE frames into typed events, and RENDERS the
terminal event into the right UI state (a `done` proposal, an `error` state, a distinct `refused`
"busy — try again" state), with an in-flight/busy state while the stream is open and a fail-closed
submit (a blank intent never POSTs). That spans the POST + the streamed-read + the per-terminal-state
render — an integration of the fetch/stream/parse/render path against an injected scripted SSE double,
not a single isolated assertion. It is proven at the studio's integration rung (a vitest component test
driving the real React render with global `fetch` mocked) — the studio runs vitest where the pure-Node
packages run node:test.

WHY THIS IS A SEPARATE CAPABILITY (the journey-principle + splitting-rule, ADR-0010): the panel proves a
DIFFERENT observable from the seven existing studio capabilities (read / annotate / resolve / browse /
author a corpus through `/api/*`) — it streams a live agent session and renders its terminal
`done`/`error`/`refused` outcome. Its precondition is distinct (a streamed `text/event-stream` POST, not
a one-shot JSON read/mutate), its observable is distinct (a rendered terminal-state from a *parsed SSE
stream*), and it has its own isolatable net-new red→green (a vitest component test driving the real
render with a scripted `fetch` double — no live SDK, no DB). It is the studio-surface half of the
desktop's "an actual agent you can chat to" arc.

THIN CLIENT — NEVER IMPORT THE AGENT, NOR `@storytree/drive` (ADR-0108 d.1 / ADR-0004; the studio
src model-path boundary): the panel's ONLY seam to the agent is the `fetch('/api/chat')` HTTP route. It
imports NO `@storytree/agent`, NO `@storytree/orchestrator`, NO `@storytree/cli`, and **NO
`@storytree/drive`** — `apps/studio/src/modelPathBoundary.test.ts` (ADR-0004 / ADR-0090 d.2) forbids all
four in the renderer bundle and scans the source text for `from '<pkg>'` (it catches an `import type`
too). The panel holds no model-invocation path; the agent boundary is the backend process (the desktop
sidecar, ADR-0113 §2). State this so a rebuild does not reach for the drive runtime to "reuse the type."

THE EVENT TYPE IS A LOCAL STRUCTURAL TYPE, NOT A `@storytree/drive` IMPORT (the boundary call — decided
here, the story-author's layout domain): the wire events the panel parses are the same shape
`chat-sse-mount` / `chat-session-stream` emit — `{ type: 'done', proposal, costUsd, turns }` |
`{ type: 'error', error }` | `{ type: 'refused', reason }`. The drive package OWNS the canonical
`ChatStreamEvent` type, but importing it here is BOTH forbidden (the model-path boundary above) AND
unnecessary coupling for a thin client. So the panel declares its OWN local structural type (a narrow
`type ChatStreamEvent = …` in `ChatPanel.tsx`) matching the wire shape — exactly the thin-client posture
(the renderer is structurally decoupled from the agent runtime). This adds **NO new package import edge**
(slow growth): the panel speaks to the route at runtime via `fetch`, and the type it parses into is its
own. If the wire shape ever drifts, the contract that breaks is the desktop story's operator-attested
UAT leg 7 + the `chat-sse-mount` integration test (the route is the seam), not a compile edge here.

WHERE THE ROUTE COMES FROM (runtime, not a build edge): `POST /api/chat` is served by the desktop's
[`chat-sse-mount`](../desktop/chat-sse-mount.md) dispatcher (mounted on the local backend's `/api/*`
surface, proxied by `static-server.ts`) when the COMPILED studio bundle is rendered inside the desktop
shell — the desktop renders studio's compiled dist (ADR-0090 d.4 / ADR-0108 d.1). In the bare
`pnpm --filter studio dev` server the route is absent (the studio's own `/api/*` middleware does not mount
it), so the panel surfaces an honest error/unavailable state there — it does not crash. The panel makes
NO assumption about WHICH process serves the route; it POSTs and reads the stream. (This keeps the panel a
peer renderer component, not a consumer of the desktop's server source — the surface boundary holds.)

THE STREAM-READ CONTRACT — READ FRAMES, DON'T AWAIT ONE BODY: the panel reads the `200`
`text/event-stream` response BODY as a stream (`res.body.getReader()` over the `ReadableStream`,
decoding chunks and splitting on the SSE `\n\n` frame boundary), parsing each `data: <json>` line into a
`ChatStreamEvent` AS IT ARRIVES, and rendering the terminal event (`done`/`error`/`refused`) when it
lands. It does NOT `await res.json()` (the response is a stream of frames, not one JSON body). The
in-flight/busy state holds for the whole open stream and clears on the terminal event. (The test injects
a scripted `ReadableStream` so this is driven exactly, offline.)

THE TERMINAL STATES (pin these — the leaf authors to them, the test asserts them):
- **`done`** → render the proposal text (from `proposal`); the busy state clears; re-submit is enabled
  again. The happy path that PROVES the panel read the STREAM (the proposal arrived as a streamed SSE
  frame), not a one-shot JSON body.
- **`error`** → render a distinct error state surfacing the failure (fail-closed honesty surfaced to the
  user, inherited from the consumed core's terminal `error`). NOT a silent empty render.
- **`refused`** → render a DISTINCT "busy — try again" state (NOT a generic error), forwarding the
  single-session guard's UX (ADR-0108 d.6: one orchestration at a time; a second concurrent chat is
  `refused`, never a forged session). The user is told to try again, not shown a failure.

FAIL-CLOSED SUBMIT (no empty POST): a blank / whitespace-only intent is NOT submittable — the submit
control is disabled (or the submit is a no-op) and NO `fetch` fires. While a stream is in flight the
panel shows a busy state and the re-submit control is disabled, so a second concurrent POST cannot be
fired from the UI (the composition-level single-session guard is the authoritative brake server-side;
this is the UI's matching courtesy, and it keeps the test's fetch-call-count assertions exact).

SLOW GROWTH — MINIMUM TO GREEN (ADR-0108 / the journey-principle): the panel's net-new is the POST +
the SSE-stream read/parse + the terminal-state render + the busy/blank-submit guard. It is NOT styling,
NOT a conversation history / multi-turn transcript, NOT a markdown renderer for the proposal, NOT
read/propose→ACT wiring (Phases 3–5 are out of scope — the consumed core is read/propose only). The
appearance (does it read well, feel alive) is the desktop story's operator-attested leg, not machined
here. Build the smallest panel that proves the four contracts.

## Integration test

**Goal —** Prove that the chat panel, given a chat message, POSTs `{ intent }` to `POST /api/chat`, reads
the `text/event-stream` response as a STREAM, parses its `data: <json>\n\n` SSE frames into typed events,
and renders the terminal `done` proposal / `error` / `refused` state correctly — with an in-flight/busy
state while streaming and a fail-closed submit (a blank intent never POSTs). Entirely offline: the real
React render under jsdom, with global `fetch` mocked to return a scripted `text/event-stream` Response
whose body is a `ReadableStream` of the SSE frames — NO live SDK, NO DB, NO real socket.

The test exercises this capability against its **real collaborator boundary** — the real React component
render (`@testing-library/react` under jsdom) over an INJECTED scripted `fetch` double (the route is the
seam; the double scripts the SSE `ReadableStream` the desktop's `chat-sse-mount` would stream). This is
the SAME "inject the collaborator as a scripted double" discipline `chat-sse-mount.test.ts` /
`chat-stream.test.ts` use, in the studio's vitest idiom (mirroring `BuildSection.test.tsx` /
`StoreBanner.test.tsx`, which mock their collaborator and drive every transition exactly).

The integration test would:

1. Mock global `fetch` (`vi.stubGlobal('fetch', …)` or `vi.spyOn`) to return, for `POST /api/chat`, a
   `200` `Response` with `Content-Type: text/event-stream` whose `body` is a `ReadableStream` that
   enqueues a sequence of SSE frames `data: {...}\n\n` ending in a terminal `done`
   (`{ type: 'done', proposal: '<text>', costUsd, turns }`). Render `<ChatPanel />`, type an intent, and
   submit. Assert `fetch` was called ONCE with `/api/chat`, a `POST`, and a JSON body `{ intent }`; then
   assert the panel renders the streamed proposal text — proving it READ THE STREAM, not a one-shot body.
2. With a scripted stream whose terminal frame is `{ type: 'error', error: '<msg>' }`, assert the panel
   renders a distinct error state surfacing the message — never a silent empty render, never a forged
   proposal.
3. With a scripted stream whose terminal frame is `{ type: 'refused', reason: '<reason>' }`, assert the
   panel renders a DISTINCT "busy — try again" state (NOT the generic error state) — forwarding the
   single-session guard's UX.
4. Assert the in-flight/busy state: while the scripted stream is open (before the terminal frame), the
   panel shows a busy affordance and the submit control is disabled (a second submit cannot fire a second
   `fetch`); and a blank / whitespace-only intent is NOT submittable — NO `fetch` fires (the deletion
   test proving the panel never POSTs an empty intent).

## Contracts (4)

The test-proven leaf behaviours — each one assertion in the `studio` vitest suite
(`vitest` + `@testing-library/react` + jsdom, `// @vitest-environment jsdom`), the route injected as a
scripted `fetch` SSE-stream double. None exist yet; each is the assertion a contract test WILL prove
against the real `ChatPanel` once authored. Per ADR-0122 (`storytree coverage`), each contract id is the
LEAD TOKEN of a distinctly-named `it(...)` test in the single net-new test file, so
`storytree coverage chat-panel` reports 4/4. (The studio convention also marks the contract with a
`// ── <id> ──` comment, but coverage matches the `it(...)` STRING — so the id must lead the string.)

1. **`cp-renders-streamed-done-proposal`** — POSTs `{ intent }` to /api/chat and renders the terminal `done` proposal from the streamed SSE frames
   - **asserts —** submitting an intent POSTs ONCE to `POST /api/chat` with a JSON body `{ intent }`, then
     the panel reads the `text/event-stream` response as a STREAM, parses the `data: <json>\n\n` frames,
     and renders the terminal `done` event's `proposal` text. The happy path that proves it reads the
     STREAM (the proposal arrived as a streamed SSE frame), not a one-shot `res.json()` body. The
     "no model path" half is true BY CONSTRUCTION (thin client, ADR-0004): the panel's only collaborator
     is `fetch('/api/chat')`; it imports no agent/drive runtime, so there is no model-invocation path to
     observe being NOT taken.
   - **covers —** `apps/studio/src/components/ChatPanel.tsx` (the POST + the SSE-stream read/parse + the
     `done` render + the thin-client import surface) *(provisional path)*
2. **`cp-renders-error-frame-as-error`** — a terminal `error` SSE frame renders a distinct error state
   - **asserts —** a scripted stream whose terminal frame is `{ type: 'error', error }` renders a distinct
     error state surfacing the message — never a silent empty render, never a forged proposal — the
     fail-closed honesty inherited from the consumed core, surfaced to the user. Distinct from the
     `refused` state below.
   - **covers —** `apps/studio/src/components/ChatPanel.tsx` (the terminal `error` frame -> error state) *(provisional path)*
3. **`cp-renders-refused-as-busy-retry`** — a terminal `refused` SSE frame renders a distinct "busy — try again" state
   - **asserts —** a scripted stream whose terminal frame is `{ type: 'refused', reason }` renders a
     DISTINCT "busy — try again" state (NOT the generic error state of contract 2) — forwarding the
     single-session guard's UX (ADR-0108 d.6) so the user is told to retry, not shown a failure.
   - **covers —** `apps/studio/src/components/ChatPanel.tsx` (the terminal `refused` frame -> busy/retry state) *(provisional path)*
4. **`cp-busy-while-streaming-blank-not-submittable`** — a busy state while streaming disables re-submit, and a blank intent is not submittable (no empty POST)
   - **asserts —** while the scripted stream is open (before the terminal frame) the panel shows a busy
     affordance and the submit control is disabled (a second submit fires NO second `fetch`); AND a blank
     / whitespace-only intent is not submittable — NO `fetch` fires. The fail-closed submit (the deletion
     test proving the panel never POSTs an empty intent and never double-POSTs mid-stream).
   - **covers —** `apps/studio/src/components/ChatPanel.tsx` (the in-flight busy state + the blank/double-submit guard) *(provisional path)*

## Guidance — the net-new slice that earns the signed verdict

The brownfield bootstrap rung toward `healthy` (ADR-0057 §3, NET-NEW): author the chat panel as a new
component, test-first.

- **The new test —** `apps/studio/src/components/ChatPanel.test.tsx` (`// @vitest-environment jsdom`,
  `vitest` + `@testing-library/react` — drive the real React render, mock global `fetch` to return a
  scripted `text/event-stream` `ReadableStream`, exactly as `BuildSection.test.tsx` mocks its api client
  and `StoreBanner.test.tsx` drives its state machine; no DB, no network, no live SDK). Import
  `{ ChatPanel }` from `'./ChatPanel'`. Name each `it(...)` so its string LEADS with the contract id
  (`cp-…`) so `storytree coverage chat-panel` reports 4/4 (ADR-0122).
- **The RED the spine observes (before IMPLEMENT) —** the import resolves NOTHING — `ChatPanel.tsx` does
  not exist at HEAD, so the vitest run fails module-not-found (the net-new missing-symbol red, ADR-0057).
  Assert the POST + streamed-`done` render, the terminal `error` state, the distinct `refused`
  "busy — try again" state, and the busy/blank-submit guard.
- **The GREEN —** write `apps/studio/src/components/ChatPanel.tsx`: a React component that holds the
  intent input + submit, POSTs `{ intent }` to `POST /api/chat` via `fetch` (only on a non-blank intent),
  reads `res.body` as a stream (`getReader()` + `TextDecoder`, splitting on `\n\n`), parses each
  `data: <json>` frame into a LOCAL structural `ChatStreamEvent` (`done`/`error`/`refused`), and renders
  the terminal event into the matching state (proposal / error / busy-retry), with an in-flight busy state
  that disables re-submit. NO `@storytree/agent`, NO `@storytree/drive`, NO `@storytree/orchestrator`, NO
  `@storytree/cli` import (the model-path boundary). After it, the import resolves, the assertions hold,
  and the studio suite + typecheck stay green.

Rules:

- **Thin client — no agent/drive import** (the model-path boundary, `modelPathBoundary.test.ts`). The
  panel's only seam to the agent is `fetch('/api/chat')`; the event type is a LOCAL structural type, not
  a `@storytree/drive` import. The boundary test pins this (a `from '@storytree/drive'` here fails the
  studio suite — which is the proof command).
- **Read the stream, don't await one body** — read `res.body` as a `ReadableStream` and parse the
  `data: <json>\n\n` SSE frames as they arrive; render the terminal event. The test pins this
  (`cp-renders-streamed-done-proposal` asserts the proposal arrived via a streamed frame, not
  `res.json()`).
- **Three distinct terminal states** — `done` (proposal), `error` (error state),
  `refused` (DISTINCT "busy — try again", not a generic error). All three pinned
  (`cp-renders-streamed-done-proposal` / `cp-renders-error-frame-as-error` /
  `cp-renders-refused-as-busy-retry`).
- **Fail-closed submit** — a blank intent never POSTs; a busy stream disables re-submit (no double-POST).
  Pinned (`cp-busy-while-streaming-blank-not-submittable`).
- **Read/propose only, slow growth** — render the proposal; the panel triggers no build, signs nothing,
  opens no PR (it only POSTs to the read/propose-only `/api/chat`). NO conversation history, NO markdown
  renderer, NO styling pass in the net-new — the appearance is the desktop story's operator-attested UAT
  leg 7. Build the smallest panel that proves the four contracts.
- **The runner is vitest, NOT node:test** — the `proof:` block declares `real.proofCommand:
  pnpm --filter studio test` precisely because the default `node --import tsx --test` cannot run a
  jsdom/vitest `.tsx` test (the graduated vitest-runner-mismatch learning). Do not "simplify" it to a
  node:test file.
