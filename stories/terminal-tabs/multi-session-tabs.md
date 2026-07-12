---
id: "multi-session-tabs"
tier: capability
story: terminal-tabs
title: "TerminalDock becomes multi-session with a tab strip — N sessions, each its own xterm pane, created/switched/closed, the single-session behaviours held per tab, every session disposed on close AND unmount"
outcome: "The existing single-session `TerminalDock` becomes MULTI-SESSION with a tab strip: it holds N pty sessions, each its OWN xterm `Terminal` pane + `sessionId` over the already-per-session `desktopTerminal` bridge; a tab strip (a NEW horizontal strip between the dock header and the body) SWITCHES the active pane, a \"+\" opens a fresh session/tab, and a per-tab \"×\" disposes that session and reaps its tab. The eight `terminal-dock-panel` behaviours (spawn, input↔pty, data-in, resize, visibility-toggle, refocus, absent-bridge degrade, empty-session message) hold PER TAB — scoped to the active/first session — while the dock chrome (collapse/resize, the toggle, the `headerRight` slot) stays PER-DOCK, wrapping the tab set. EVERY session is disposed on tab-close AND on dock unmount (never orphan a pty)."
status: proposed
proof_mode: integration-test
depends_on: []
# Node-borne proof config (ADR-0057 keystone): authoring THIS block is what makes the capability
# inner-loop buildable — no NODE_BUILD_REGISTRY edit. This is an EDIT-EXISTING (editsExisting) node: the
# source (apps/studio/src/components/TerminalDock.tsx) and its test (TerminalDock.test.tsx) EXIST and are
# green at HEAD (embedded-terminal / PR #690, re-driven for headerRight + empty-session / PR #705) — a
# SINGLE-SESSION dock holding one sessionIdRef / one xterm. The RED the spine observes is authored by
# adding NEW cases that render `<TerminalDock/>` and drive a tab strip — a "+" that spawns a SECOND
# session, a tab switch, a "×" that disposes one session — which FAIL against the single-session dock at
# HEAD (it has no "+", no tab strip, one session; the new-tab / switch / close-one queries throw), so the
# edit is a real red→green over existing source. The EIGHT existing terminal-dock-panel contracts (tdp-*)
# stay GREEN — adapted so the per-session ones (spawn, input, data, resize, toggle, refocus, empty-session)
# exercise the FIRST/ACTIVE tab (the N=1 case of the tab model) and the per-dock ones (headerRight slot,
# absent-bridge degrade) exercise the chrome that wraps the strip. FRONTEND-BUILDER TWO-STAGE (ADR-0070):
# this `real:` arm proves GEOMETRY/BEHAVIOUR ONLY (create / switch / close+dispose / per-tab I/O scoping /
# dispose-all-on-unmount / chrome-per-dock) over the SAME mocked xterm + mocked `desktopTerminal` bridge
# the existing suite uses — the tab strip's APPEARANCE (reads as a coherent tab strip) is the story's
# operator-attested UAT leg, NOT a machine visual verdict here. The proof command is the studio VITEST
# suite, NOT node:test; the `real.proofCommand` runs the ONE test file under vitest (the terminal-dock-
# panel / terminal-dock-seed precedent — the node:test default cannot run a jsdom .test.tsx). `install:
# true` (fresh worktree: tsx + tsc + vitest need the lockfile-only install, ADR-0031 §2). editsExisting +
# a single literal sourceFile === the one sourceGlob (no wildcard), so the multi-file refine is satisfied;
# the explicit vitest proofCommand is required regardless (runner mismatch).
proof:
  command:
    file: pnpm
    args: ["--filter", "studio", "test"]
  scope:
    testGlobs: ["apps/studio/src/**/*.test.tsx", "apps/studio/src/**/*.test.ts"]
    sourceGlobs: ["apps/studio/src/**/*.ts", "apps/studio/src/**/*.tsx"]
  real:
    testFile: "apps/studio/src/components/TerminalDock.test.tsx"
    sourceFile: "apps/studio/src/components/TerminalDock.tsx"
    editsExisting: true
    scope:
      testGlobs: ["apps/studio/src/components/TerminalDock.test.tsx"]
      sourceGlobs: ["apps/studio/src/components/TerminalDock.tsx"]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "studio", "typecheck"]
    # The studio suite is vitest (jsdom), not node:test — so the default `node --test` real proof cannot
    # run this `.test.tsx`. Run the ONE test file under vitest (`--filter studio exec` → cwd apps/studio).
    proofCommand:
      file: pnpm
      args:
        - "--filter"
        - "studio"
        - "exec"
        - "vitest"
        - "run"
        - "src/components/TerminalDock.test.tsx"
---

# TerminalDock becomes multi-session with a tab strip

**Outcome —** The existing single-session `TerminalDock` becomes **MULTI-SESSION with a tab strip**: it
holds **N pty sessions**, each its OWN xterm `Terminal` pane + `sessionId` over the already-per-session
`desktopTerminal` bridge. A **tab strip** — a NEW horizontal strip **between** the dock header and the body
— **switches** the active pane, a **"+"** opens a fresh session/tab, and a per-tab **"×"** disposes that
session and reaps its tab. The eight `terminal-dock-panel` behaviours (spawn, input↔pty, data-in, resize,
visibility-toggle, refocus, absent-bridge degrade, empty-session message) hold **per tab** — scoped to the
active/first session — while the dock **chrome** (collapse/resize, the toggle, the `headerRight` slot) stays
**per-dock**, wrapping the tab set. **EVERY session is disposed on tab-close AND on dock unmount** (never
orphan a pty).

**Depends on —** nothing (within `terminal-tabs`; the sole in-story root). The dock reaches the pty ONLY
through the `window.desktopTerminal` bridge, which is ALREADY per-session — `PtySessionManager`
(`apps/desktop/src/backend/pty-session-manager.ts`) tracks a `Map<sessionId, Session>` and mints a fresh id
per `spawn`, and the bridge (`apps/desktop/electron/preload.ts`) addresses `write`/`resize`/`dispose`/
`onData`/`onExit` by `sessionId` — so multi-session is a pure RENDERER lift over an unchanged backend. No
`apps/desktop` change; no `pty-session-manager` edit.

> **Proof status (honest) — EDIT-EXISTING, `proposed`.** `TerminalDock.tsx` EXISTS and is green at HEAD
> (embedded-terminal / PR #690; re-driven for the `headerRight` slot + empty-session message / PR #705) — a
> SINGLE-session dock: one `sessionIdRef`, one xterm, spawned on first expand, input wired to
> `bridge.write(sessionIdRef.current, …)`. It has no way to hold more than one session. This capability
> rewrites it into a tabbed multi-session dock: a session table, a tab strip, and the per-tab lifecycle. The
> tab strip's LOOK/feel (does it read as terminal tabs, the active tab legible, "+"/"×" clear) is the
> story's operator-attested UAT leg (ADR-0070); this cap pins the STRUCTURE + WIRING only.

## Guidance

WHY THIS IS A CAPABILITY, NOT A CONTRACT: its honest proof is the MULTI-SESSION TAB LIFECYCLE AS A WHOLE —
a behavioural React component that holds a table of sessions (each `{ sessionId, term, fit, pending }`),
renders a tab strip that switches the active pane, spawns a fresh independent session on "+", disposes
exactly one session on "×" (reaping its tab), scopes input/data/resize to the right session, keeps the
dock chrome per-dock, and disposes EVERY session on unmount — while the eight existing single-session
behaviours hold per tab. It spans the session table AND the tab strip AND the per-tab I/O scoping AND the
dispose lifecycle, exercised over the two mocked seams — an integration test of the component's
multi-session behaviour, not one isolated assertion.

WHY IT IS A SEPARATE CAPABILITY FROM [`seed-opens-new-tab`](seed-opens-new-tab.md) (the splitting-rule,
ADR-0010): THIS proves the TAB SUBSTRATE — given user actions ("+", switch, "×", unmount), does the dock
create/switch/close/dispose independent sessions correctly, per tab? `seed-opens-new-tab` proves the SEED
SEMANTICS — given a `seed` prop, does the dock open a FRESH tab (never the active session) and pre-fill it?
Different trigger (user tab actions vs a `seed` prop), different observable (the tab lifecycle vs the
seed-to-fresh-tab route), different isolatable red. `seed-opens-new-tab` `depends_on` THIS (its "opens a
fresh tab" is meaningless without the tab substrate here), a real one-way precondition + shared-file
sequencing edge — but they are two distinct proofs, not one.

HOLD N SESSIONS IN A TABLE, NOT N REFS (the multi-session shape). Today the dock holds `sessionIdRef` /
`termRef` / `fitRef` / `pendingSeedRef` as single refs. Multi-session replaces them with a **session table**
— an ordered list of `{ sessionId, term, fit, pending }` records + an `activeId` — held in a ref (the live
values the bridge callbacks read) mirrored by state for the render. Each record OWNS its xterm `Terminal`
(a separate `term.open()` into that tab's mount div) and its `sessionId`. The bridge's `onData`/`onExit`
callbacks route a chunk to the record whose `sessionId` matches (the existing `sessionId === …` guard,
generalised to a table lookup) — so a chunk for tab A never writes tab B's pane (`mst-scopes-io-per-tab`).

THE TAB STRIP IS A NEW STRIP BETWEEN HEADER AND BODY; THE CHROME STAYS PER-DOCK (the placement wall). The
dock header today is the toggle chevron `<button>` + the optional `headerRight` slot (a sibling of the
toggle, hosting the repo-gate gear, #705). The tab strip is a NEW horizontal strip rendered BELOW that
header and ABOVE the body — one tab per session (the active highlighted), a "+" control to open a tab, a
"×" per tab to close it. The toggle + `headerRight` slot render **once per dock** (siblings of the strip,
NOT repeated per tab), and the collapse/resize geometry wraps the WHOLE tab set — the folded/expanded
state, the drag-to-resize, and the `maxHeight` clamp are dock-level, unchanged. Assert the chrome is
per-dock (one toggle, one `headerRight` container) with N tabs in the strip (`mst-chrome-stays-per-dock`).

RE-PROVE THE EIGHT tdp-* BEHAVIOURS PER TAB — DON'T DELETE THEM (the honest re-prove, ADR-0057 §3). The
existing eight `terminal-dock-panel` contracts stay in `TerminalDock.test.tsx` and stay GREEN under the new
source, adapted to the tab model: the per-session ones (`tdp-spawns-on-open-and-writes-data`,
`tdp-forwards-input-to-bridge`, `tdp-resizes-with-the-dock`, `tdp-toggles-visibility-keeping-terminal-
mounted`, `tdp-refocuses-after-window-focus-cycle`, `tdp-shows-message-on-empty-session`) exercise the
FIRST/ACTIVE tab (the N=1 case); the per-dock ones (`tdp-renders-header-right-slot`,
`tdp-degrades-when-bridge-absent`) exercise the chrome that wraps the strip. They are `terminal-dock-panel`'s
contracts (re-proven here), NOT this cap's — `storytree coverage multi-session-tabs` counts only the six
`mst-*` below; the tdp-* re-proof keeps that cap's crown honest under the rewritten bytes (the orchestrator
re-tenses `terminal-dock-panel.md` — a cross-story edit flagged in the story's Open modeling calls).

DISPOSE EVERY SESSION — ON CLOSE AND ON UNMOUNT (the never-orphan-a-pty wall). The single-session dock
disposes its one session on unmount. Multi-session must dispose EVERY open session's pty: `bridge.dispose`
for the closed tab's `sessionId` on "×" (and `fit.dispose()`/`term.dispose()` for its xterm), and
`bridge.dispose` for ALL remaining sessions on dock unmount. A leaked pty is a real resource bug (ADR-0186
Consequences: "reaping every session on close / app-quit"). Pin both the per-tab close dispose
(`mst-close-tab-disposes-its-session`) and the dispose-all-on-unmount (`mst-disposes-all-sessions-on-
unmount`).

THE DOCK STAYS A THIN CLIENT — NO AGENT, NO DRIVE, NO MODEL PATH (ADR-0004 / ADR-0108 d.1). Multiplying
xterm instances across tabs adds NO new seam — each pane is a `Terminal` over the SAME
`window.desktopTerminal` bridge. It imports no `@storytree/agent`/`@storytree/drive` and holds no model path
(`modelPathBoundary.test.ts` stays green). xterm.js is a third-party rendering library, not a model path.
(This is the interactive surface, never the prove-it-gate leaf — the dock composes no signing/build/PR;
ADR-0174 / ADR-0091.)

REUSE THE EXISTING SEAMS, THE EXISTING HARNESS. Author over the SAME mocked xterm + mocked `desktopTerminal`
bridge `TerminalDock.test.tsx` already installs (the `FakeTerminal` recording `write`/`onData`/`open`/
`resize`/`dispose`, and the scripted `window.desktopTerminal`). The `FakeTerminal.instances` array already
records EVERY instantiated terminal — perfect for asserting a SECOND tab spawns a second instance. The
bridge's `spawn` mock resolves `sess-1` today; to prove independent sessions, the leaf makes it resolve a
FRESH id per call (`sess-1`, `sess-2`, …) so `dispose`/`write` can be asserted against the right session.
Degrade honestly where the bridge is absent (the existing disabled state), unchanged and per-dock.

## Integration test

**Goal —** Prove that `<TerminalDock/>`, over a mocked xterm + mocked `desktopTerminal` bridge, holds N
independent sessions in a tab strip: "+" spawns a fresh session/tab, switching shows the right pane (others
mounted-but-hidden, sessions preserved), "×" disposes exactly that tab's session and reaps its tab, input/
data/resize are scoped per tab, the chrome (toggle + `headerRight`) stays per-dock, and unmount disposes
EVERY session — while the eight `terminal-dock-panel` behaviours hold on the active tab. Entirely in jsdom:
xterm + the bridge are mocked, the async spawn resolved under the existing flush, no real socket/pty/SDK/DB/
Electron.

The test exercises this capability against its **real collaborator shape** — the two mocked seams already
in `TerminalDock.test.tsx` (the `FakeTerminal` + a scripted `window.desktopTerminal`, its `spawn` resolving
a fresh id per call). No stubs within the component's own composition (the session table, the tab strip, the
per-tab I/O routing, the dispose lifecycle are all real).

The test would:

1. Install the scripted `window.desktopTerminal` (spawn → a fresh `sess-N` per call) + `vi.mock` xterm (the
   existing harness). Render `<TerminalDock/>`, expand it → assert ONE tab, one session spawned, one xterm
   instance (the N=1 base, the tdp-* active-tab behaviours holding).
2. **New tab** — click "+" → assert a SECOND `spawn`, a second `FakeTerminal` instance, two tabs in the
   strip, the new tab active (`mst-new-tab-spawns-independent-session`).
3. **Switch** — click tab 1 → assert tab 1's pane is shown and tab 2's is hidden (`hidden`, not unmounted —
   both `FakeTerminal` instances still present, undisposed; state preserved) (`mst-switch-shows-selected-
   tab-pane`).
4. **Per-tab I/O** — drive the bridge `onData` for `sess-2` → assert ONLY tab 2's `Terminal.write` received
   it; type into the active tab → assert `bridge.write` was called with the ACTIVE session's id, not the
   other's (`mst-scopes-io-per-tab`).
5. **Close** — click tab 2's "×" → assert `bridge.dispose('sess-2')` (and that instance's `dispose()`)
   fired, tab 2 reaped from the strip, tab 1 untouched (its session NOT disposed) and now active
   (`mst-close-tab-disposes-its-session`).
6. **Chrome per-dock** — assert exactly ONE toggle button and ONE `headerRight` container regardless of tab
   count, the tab strip a distinct element between the header and the body (`mst-chrome-stays-per-dock`).
7. **Unmount** — unmount the dock with two tabs open → assert `bridge.dispose` fired for BOTH session ids
   (`mst-disposes-all-sessions-on-unmount`).

## Contracts (6)

The test-proven leaf behaviours — each **one isolated automated test** in the `studio` suite (vitest jsdom,
`apps/studio/src/components/TerminalDock.test.tsx`), the xterm + bridge seams mocked/scripted. None exist
yet; each is the assertion a contract test WILL prove against the multi-session dock once authored
(provisional path — re-cite at real `file:line` when built). Per ADR-0122, each contract id leads a
distinctly-named test, so `storytree coverage multi-session-tabs` reports 6/6. None is an APPEARANCE
assertion — the tab strip's look is the story's operator-attested UAT leg (ADR-0070). (The eight `tdp-*`
`terminal-dock-panel` behaviours are re-proven per-tab in the SAME file but remain that cap's contracts, not
counted here.)

1. **`mst-new-tab-spawns-independent-session`** — the "+" control opens a fresh, independent session/tab
   - **asserts —** with the dock expanded (one tab), clicking "+" calls `bridge.spawn` AGAIN (a second
     session id), instantiates a SECOND xterm `Terminal`, adds a second tab to the strip, and makes it
     active — two independent sessions, not a re-use of the first.
   - **covers —** `apps/studio/src/components/TerminalDock.tsx` (the session table + the "+" new-tab path) *(provisional path)*
2. **`mst-switch-shows-selected-tab-pane`** — switching tabs shows the selected pane, others hidden but mounted (sessions preserved)
   - **asserts —** with two tabs open, clicking a tab shows its pane and hides the other's (`hidden`, not a
     conditional unmount — both `FakeTerminal` instances remain, undisposed), so a switch never re-spawns or
     loses a session's scrollback.
   - **covers —** `apps/studio/src/components/TerminalDock.tsx` (the activeId switch + per-tab pane visibility) *(provisional path)*
3. **`mst-close-tab-disposes-its-session`** — the per-tab "×" disposes exactly that tab's session and reaps its tab
   - **asserts —** clicking a tab's "×" calls `bridge.dispose(thatSessionId)` and that xterm instance's
     `dispose()`, removes the tab from the strip, and leaves the OTHER tabs' sessions untouched (not
     disposed); if the closed tab was active, another becomes active. Exactly one session reaped per "×".
   - **covers —** `apps/studio/src/components/TerminalDock.tsx` (the "×" close+dispose+reap path) *(provisional path)*
4. **`mst-scopes-io-per-tab`** — bridge data, terminal input, and resize are scoped to the right session
   - **asserts —** a bridge `onData` chunk for session B is written to tab B's `Terminal` only (never tab
     A's); typing into the active tab forwards to `bridge.write(activeSessionId, …)` (never another tab's
     id); a resize forwards `bridge.resize(activeSessionId, …)` — the per-tab I/O routing over the session
     table.
   - **covers —** `apps/studio/src/components/TerminalDock.tsx` (the per-session onData/input/resize routing) *(provisional path)*
5. **`mst-disposes-all-sessions-on-unmount`** — unmounting the dock disposes EVERY open session (never orphan a pty)
   - **asserts —** with two (or more) tabs open, unmounting the dock calls `bridge.dispose` for BOTH session
     ids (and disposes each xterm instance) — no pty is left orphaned when the dock (or app) goes away, the
     multi-session generalisation of the single-session dispose-on-unmount.
   - **covers —** `apps/studio/src/components/TerminalDock.tsx` (the unmount cleanup over the session table) *(provisional path)*
6. **`mst-chrome-stays-per-dock`** — the toggle + headerRight slot render once per dock; the tab strip sits between header and body
   - **asserts —** regardless of tab count, the dock renders exactly ONE toggle `<button>` and (when
     `headerRight` is provided) exactly ONE `headerRight` container — siblings of the tab strip, never
     repeated per tab; the tab strip is a distinct element rendered between the dock header and the body.
     The collapse/resize chrome wraps the whole tab set (dock-level height/clamp unchanged).
   - **covers —** `apps/studio/src/components/TerminalDock.tsx` (the per-dock chrome + the strip placement) *(provisional path)*

## Guidance — the net-new slice that earns the signed verdict

The EDIT-EXISTING rung toward `healthy` (ADR-0057 §3, editsExisting): add the tab-lifecycle cases that fail
against the single-session dock at HEAD (the red), then rewrite the dock to a session table + tab strip (the
green), keeping the eight `tdp-*` behaviours green per-tab.

- **The edited test —** `apps/studio/src/components/TerminalDock.test.tsx`. Add the six `mst-…` cases over
  the EXISTING mocked xterm + bridge harness (the `spawn` mock resolving a fresh id per call so independent
  sessions are assertable). Name each test for its contract id so `storytree coverage multi-session-tabs`
  reports 6/6 (ADR-0122). Keep the eight `tdp-…` cases green, adapted to the active/first tab.
  **COVERAGE `.tsx` trap (ADR-0122):** the coverage tool parses the test source as `ScriptKind.TS`, so a
  test whose assertions follow an INLINE JSX object prop (e.g. `<TerminalDock headerRight={<X/>}/>`) can read
  as uncovered — hoist any inline object/element prop to a `const` before the assertions
  (`const headerRight = <X/>; render(<TerminalDock headerRight={headerRight}/>)`), the shape the existing
  suite already uses for `seed`.
- **The RED the spine observes —** the new cases drive a tab strip — a "+" that spawns a SECOND session, a
  tab switch, a per-tab "×" — none of which exist on the single-session dock at HEAD (no "+", no strip, one
  session), so `mst-new-tab-spawns-independent-session` (and the others) fail — a real edit-existing
  red→green.
- **The GREEN —** rewrite `apps/studio/src/components/TerminalDock.tsx`: replace the single
  `sessionIdRef`/`termRef`/`fitRef`/`pendingSeedRef` with a **session table** (an ordered list of
  `{ sessionId, term, fit, pending }` + an `activeId`, in a ref mirrored by state); render a tab strip
  between the header and the body ("+" → spawn a fresh session + a tab; per-tab "×" → dispose + reap; click
  a tab → set `activeId`); mount each session's xterm into its own pane, shown when active and `hidden`
  otherwise; route `onData`/`onExit` by a table lookup on `sessionId`; forward input/resize to the active
  session; dispose EVERY session on unmount. Keep the chrome (toggle, `headerRight`, collapse/resize) at the
  dock level. Keep the thin-client wall (`modelPathBoundary.test.ts`), the eight `tdp-*` contracts green
  (per active tab / per dock), and `pnpm --filter studio typecheck` green. The tab strip's LOOK is the
  story's operator-attested UAT leg — no visual assertion here.

Rules:

- **Multi-session over the already-per-session bridge — RENDERER only** — the backend + `desktopTerminal`
  bridge are unchanged; do NOT edit `apps/desktop`. A session table in the renderer, one xterm per tab.
- **Never orphan a pty** — dispose the closed tab's session on "×" (`mst-close-tab-disposes-its-session`)
  and EVERY session on unmount (`mst-disposes-all-sessions-on-unmount`).
- **Scope I/O per tab** — a chunk / keystroke / resize reaches only the intended session
  (`mst-scopes-io-per-tab`); never cross tabs.
- **Chrome per-dock, strip between header and body** — one toggle + one `headerRight`, N tabs
  (`mst-chrome-stays-per-dock`); the collapse/resize wraps the tab set.
- **Re-prove tdp-* per-tab, don't delete them** — keep the eight `terminal-dock-panel` contracts green
  (active-tab / per-dock); they remain that cap's contracts (the orchestrator re-tenses its spec).
- **Thin client, mock the seams, never assert the look** (ADR-0004 / ADR-0070) — prove the tab lifecycle
  over the mocked xterm + bridge; the tab strip's appearance is the story's UAT leg.
- **Tab substrate only (slow growth)** — create/switch/close/dispose/scope the sessions. Do NOT re-route the
  `seed` (that is [`seed-opens-new-tab`](seed-opens-new-tab.md)), do NOT touch the backend, and do NOT sign /
  build / open a PR (the interactive surface, never the prove-it-gate leaf).
