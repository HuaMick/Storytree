---
id: "library-lens-minimise"
tier: capability
story: library-tech-tree-overlay
title: "The permanent lens carries a bottom handle bar (grip + Library wordmark + Minimise) and minimises to just that handle bar — a stable data- state marker, the body hidden, a restore control, still no scrim — restoring to the expanded state with the handed bodySlot intact; the inc-8 bottom selection-preview strip is RETIRED; the flag gate survives in both states"
outcome: "The permanent lens minimises to a drawer handle (ADR-0188 dec 6). In the EXPANDED state it carries a bottom HANDLE BAR — a grip, a \"Library\" wordmark, and a Minimise control. Firing Minimise enters the MINIMISED state: a stable `data-` state marker on the lens, the body not visible, the handle bar remaining (now carrying a restore control), and still NO dimming scrim (the map stays unobstructed and live). Firing restore returns to EXPANDED with the handed `bodySlot` content intact (state kept across the round-trip). The inc-8 bottom selection-preview strip (`library-drawer-selection-preview`, the in-drawer Open button) is RETIRED — its job moved to the side-panel selection card (ADR-0188 dec 3) — so its ABSENCE is asserted. The flag gate survives: `readLibraryOverlay` untouched, the lens renders only behind `?overlay=library`, in BOTH states. The minimise BEHAVIOUR is machine-witnessed; the handle bar's appearance is operator-attested."
status: proposed
proof_mode: integration-test
depends_on: [library-permanent-lens]
decisions: [188, 187, 185, 70, 23]
# Node-borne proof config (ADR-0057 keystone). BROWNFIELD (editsExisting: true) — this REWORKS the inc-8
# permanent lens (`apps/studio/src/components/LibraryDrawer.tsx`, authored inc 8) to add the minimise handle
# (ADR-0188 dec 6) and RETIRE the inc-8 bottom selection-preview strip (ADR-0188 dec 3 — that job moved to the
# side-panel `library-selection-card`). real.sourceFile = LibraryDrawer.tsx (single source; NO multi-sourceGlob).
# real.testFile = a NET-NEW LibraryLensMinimise.test.tsx that drives the expand/minimise/restore state machine,
# the strip's absence, and the flag gate in both states, in jsdom.
# The RED the spine observes is a FAILING-ASSERTION red (LibraryDrawer.tsx exists — NOT module-not-found): at
# HEAD (the inc-8 lens) there is no handle bar, no minimise/restore state machine, no `data-` state marker, and
# the bottom selection-preview strip IS present — so the new test fails on all counts.
# FRONTEND-BUILDER TWO-STAGE (ADR-0070): this `real:` arm proves the BEHAVIOUR ONLY — the handle bar present in
# the expanded state, the Minimise→minimised transition (state marker + body hidden + handle remains + restore
# control + no scrim), the restore→expanded round-trip with the bodySlot intact, the retired strip's ABSENCE,
# and the flag gate surviving in both states. The handle bar's APPEARANCE (the grip look, the wordmark styling,
# the minimised silhouette) is the story's operator-attested UAT leg (ADR-0188 dec 6/7, ADR-0070) — do NOT
# author a visual/colour/pixel/animation assertion here, and do NOT edit `TreeView.tsx` in this `real:` scope
# (the lens mount + the bodySlot composition is the orchestrator's supplement glue after PASS — plan §G).
#
# CRITICAL — apps/studio is VITEST + jsdom (@testing-library/react), NOT node:test (apps/studio/vitest.config.ts,
# include src/**/*.test.{ts,tsx}). The default `node --test` real proof cannot run a `.test.tsx`. So this cap
# declares a `real.proofCommand` running the ONE test file under vitest (cwd = apps/studio). install: true
# (fresh-worktree tsx + tsc + vitest, ADR-0031 §2) + a typecheck wall. SCOPE = apps/studio/src.
# COVERAGE (ADR-0122): `storytree coverage` scans ONLY real.testFile, so EVERY `lmin-`-named contract test lives
# in LibraryLensMinimise.test.tsx. Its TITLE must carry the unique `lmin-` id or coverage silently drops N-1/N
# past the signed green (`sdk-leaf-drops-contract-id-test-names` — this arc's 5th-occurrence class risk; the fix
# if it happens is TEST-TITLE-ONLY, never an assertion/source edit).
#
# RECONCILIATION (authored NOW by story-author, executing settled ADR-0188 dec 3/6 — NOT a re-decision, the
# inc-8 `lds-*` trim precedent): reworking LibraryDrawer.tsx to RETIRE the bottom selection-preview strip breaks
# the inc-8 permanent-lens contract `lpl-bottom-selection-preview-open-fires-onopen` (it asserts the strip's
# Open button, which no longer exists). That `it`-block is RETIRED from
# `apps/studio/src/components/LibraryPermanentLens.test.tsx` as part of THIS increment (story-author authored the
# trim; the other four `lpl-*` blocks survive verbatim). The behaviour is RE-HOMED across
# `library-selection-card` (the pinned Open button) + this cap's strip-absence contract. See the reconciliation
# note appended to `library-permanent-lens.md`. `LibraryPermanentLens.test.tsx` is OUTSIDE this cap's `real.scope`
# (its `testGlobs` is `LibraryLensMinimise.test.tsx` only), so the leaf does NOT edit it — the trim is already
# authored and its four survivors must stay green under the reworked source.
proof:
  command:
    file: pnpm
    args: ["--filter", "studio", "test"]
  scope:
    testGlobs: ["apps/studio/src/**/*.test.tsx", "apps/studio/src/**/*.test.ts"]
    sourceGlobs: ["apps/studio/src/**/*.ts", "apps/studio/src/**/*.tsx"]
  real:
    testFile: "apps/studio/src/components/LibraryLensMinimise.test.tsx"
    sourceFile: "apps/studio/src/components/LibraryDrawer.tsx"
    editsExisting: true
    scope:
      testGlobs: ["apps/studio/src/components/LibraryLensMinimise.test.tsx"]
      sourceGlobs: ["apps/studio/src/components/LibraryDrawer.tsx"]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "studio", "typecheck"]
    # The studio suite is vitest (jsdom), not node:test — run the ONE test file under vitest.
    proofCommand:
      file: pnpm
      args:
        - "--filter"
        - "studio"
        - "exec"
        - "vitest"
        - "run"
        - "src/components/LibraryLensMinimise.test.tsx"
---

# The minimise handle — the permanent lens collapses to a drawer handle and restores with state kept

**Outcome —** The permanent lens minimises to a drawer handle (ADR-0188 dec 6). In the EXPANDED state it carries
a bottom HANDLE BAR — a grip, a "Library" wordmark, and a Minimise control. Firing Minimise enters the MINIMISED
state: a stable `data-` state marker on the lens, the body not visible, the handle bar remaining (now carrying a
restore control), and still NO dimming scrim (the map stays unobstructed and live beneath). Firing restore
returns to EXPANDED with the handed `bodySlot` content intact (state kept across the round-trip). The inc-8
bottom selection-preview strip (`library-drawer-selection-preview`, the in-drawer Open button) is RETIRED — its
job moved to the side-panel selection card (ADR-0188 dec 3) — so its ABSENCE is asserted. The flag gate
survives: `readLibraryOverlay` untouched, the lens renders only behind `?overlay=library`, in BOTH states. The
minimise BEHAVIOUR is machine-witnessed; the handle bar's appearance is the story's operator-attested UAT leg.

**Depends on —** [`library-permanent-lens`](library-permanent-lens.md). This capability REWORKS the inc-8
permanent lens (`LibraryDrawer.tsx`) — it adds the minimise handle to the lens the permanent-lens cap authored,
and retires that cap's bottom selection-preview strip. It needs the delivered permanent lens (its flag-gated
render, its `bodySlot`, its no-scrim posture) as its precondition, so `depends_on: [library-permanent-lens]`. It
holds no backend seam — the lens reads only its props (`search`, `bodySlot`, the expand/minimise state it owns),
so it is deterministically drivable in jsdom.

> **Proof status (honest) — `proposed`, BROWNFIELD re-author (editsExisting).** `LibraryDrawer.tsx` EXISTS and
> is green at HEAD on the inc-8 permanent lens (verified 2026-07-12 — flag-gated render, a `bodySlot`, a bottom
> `library-drawer-selection-preview` strip with an Open button, no minimise state). This capability reworks it:
> a NET-NEW vitest jsdom test (`LibraryLensMinimise.test.tsx`) drives the handle bar, the Minimise→minimised
> transition (state marker + hidden body + restore control + no scrim), the restore→expanded round-trip with the
> `bodySlot` intact, the retired strip's ABSENCE, and the flag gate in both states — RED at HEAD as a
> FAILING-ASSERTION red (the minimise machine is absent and the strip is still present, NOT module-not-found),
> GREEN once the lens is reworked. Its BEHAVIOUR is machine-witnessed; the handle bar's appearance is the
> story's operator-attested UAT leg (ADR-0070). Status stays `proposed` — `healthy` is only ever DERIVED from
> signed verdicts (ADR-0020), never authored.

## Guidance

WHY THIS IS A CAPABILITY, NOT A CONTRACT: its honest proof is the MINIMISE STATE MACHINE AS A WHOLE — a
behavioural rework of the permanent lens that renders a handle bar, collapses to just that handle bar (hiding
the body while keeping the map unobstructed and the state kept), restores to the expanded body, retires the
inc-8 selection-preview strip, and survives the flag gate in both states — spanning the handle bar, the
expand↔minimise transition, the state-kept round-trip, the strip retirement, and the flag gate, exercised in
jsdom. It is the minimise affordance ADR-0188 dec 6 settles (the explicit affordance ADR-0187 dec 1 left open);
the category shelf (`library-category-shelf`) and the pinned selection card (`library-selection-card`) are their
own increments.

THE HANDLE BAR IS PRESENT IN THE EXPANDED STATE. The lens carries a bottom handle bar — a grip, a "Library"
wordmark, and a Minimise control — visible when the lens is expanded (its default state on render). Assert the
handle bar and its Minimise control are present in the expanded state. Pin it in
`lmin-handle-bar-present-when-expanded`.

MINIMISE COLLAPSES TO THE HANDLE BAR (a stable `data-` state marker, the body hidden, a restore control, no
scrim). Firing the Minimise control transitions the lens to the MINIMISED state — a STABLE `data-` state marker
on the lens element (e.g. `data-lens-state="minimised"` / `"expanded"`, so the state is observable without
reading styling), the body NOT visible (the handed `bodySlot` content is not rendered/visible), the handle bar
STILL present (now carrying a restore control), and still NO full-screen dimming scrim (the permanent posture —
the map stays unobstructed and live beneath, exactly as `lpl-permanent-lens-over-live-map` guarantees for the
expanded lens). Assert the state marker, the hidden body, the surviving handle + restore control, and the
absent scrim. Pin it in `lmin-minimise-collapses-to-handle`.

RESTORE RETURNS TO EXPANDED WITH THE `bodySlot` INTACT (state kept). Firing the restore control (in the
minimised state) transitions the lens back to EXPANDED, and the handed `bodySlot` content renders again — the
state (the same `bodySlot` prop content) is KEPT across the minimise→restore round-trip (the lens minimises,
it does not unmount/re-fetch). Assert the round-trip: expanded body → minimise (body gone) → restore (the same
body back). Pin it in `lmin-restore-expands-with-body-intact`.

THE INC-8 BOTTOM SELECTION-PREVIEW STRIP IS RETIRED — ASSERT ITS ABSENCE (ADR-0188 dec 3). The inc-8 lens's
bottom selection-preview strip (the `library-drawer-selection-preview` section with the in-drawer Open button)
is RETIRED — its "what am I looking at" + Open job moved to the side-panel selection card
(`library-selection-card`, ADR-0188 dec 3). Prove the ABSENCE: no `library-drawer-selection-preview` section and
no in-drawer Open button on the lens. Pin it in `lmin-selection-preview-strip-retired`. This is executing
settled dec 3 — do NOT keep the strip "for convenience"; the reworked lens KEEPS `selection?`/`onOpen?` as
deprecated-accepted-IGNORED optional props (see the prop-preservation rule below), but renders NO strip from
them.

KEEP `selection?`/`onOpen?` AS DEPRECATED-ACCEPTED-IGNORED OPTIONAL PROPS (the `onCommitSearch?` precedent).
Removing the strip removes the only READER of the inc-8 `selection`/`onOpen` props — but the pre-rework
`TreeView.tsx` call site still PASSES them until a later glue increment updates it, and `TreeView.tsx` is
OUTSIDE this cap's `real.scope` (the leaf cannot edit it). So KEEP `selection?: SearchResult | null` and
`onOpen?: (r: SearchResult) => void` as optional, accepted-but-IGNORED props (exactly as the reworked lens
already keeps the retired `onCommitSearch?`/`peekSlot?`/`diveSlot?`) so the pre-rework call site compiles
byte-unchanged. The lens no longer renders a strip from them; the glue removes the now-dead props when it wires
the side-panel selection card (plan §G). Do NOT remove `selection`/`onOpen` from the component's prop type in
this cap.

THE FLAG GATE SURVIVES IN BOTH STATES — PRESERVE `readLibraryOverlay` (no Route variant). The pure
`readLibraryOverlay(search)` reader stays the sole invocation gate: the lens renders behind `?overlay=library`
and renders nothing without it — in BOTH the expanded and the minimised state (minimising collapses the lens to
its handle, it does NOT clear the flag; dismissal — clearing `?overlay` — is still the parent glue's
map-navigation job, not the lens's). Assert: with the flag the lens renders (expanded, then still present when
minimised); without it nothing renders. Pin it in `lmin-flag-gate-survives-both-states`. Do NOT add a variant to
the `Route` union (the query-flag precedent stands, ADR-0185).

REUSE THE EXISTING `SearchResult` — DEFINE NO NEW TYPE (the inc-7 fence). The retained (ignored) `selection`
prop uses the EXISTING `SearchResult` from `../lib/librarySearch`. Do NOT define a new type and do NOT touch
`apps/studio/src/types.ts` or `apps/studio/server/**` (the inc-6/7 lane, file-disjoint — plan §Lanes FENCE).

APPEARANCE IS OPERATOR-ATTESTED, NOT ASSERTED (ADR-0188 dec 6/7 + ADR-0070). The handle bar follows the map's
forest-cozy palette (the world's CSS variables). The grip look, the wordmark styling, the minimised silhouette,
and the transition animation are WITNESSED by the owner (the shared inc-9/10 attestation), never a machine
visual verdict — do NOT author a visual/colour/pixel/animation assertion in this cap's tests (assert the handle
bar's presence, the state marker, the hidden body, the restore round-trip, the strip's absence, and the flag
gate, never their styling). Use the STABLE `data-` state marker (not a CSS class / computed style) as the
machine-observable state so the assertion never leaks into appearance.

OFFLINE-TESTABLE IN JSDOM (the `LibraryPermanentLens.test.tsx` discipline). `@vitest-environment jsdom`,
`@testing-library/react` for render / `fireEvent` (click Minimise, click restore). No backend seam to mock — the
lens reads only its props. No real `fetch`, no socket, no DB, no Electron. The component imports no
agent/drive/model (the `modelPathBoundary.test.ts` wall stays green).

## Integration test

**Goal —** Prove the minimise state machine: a handle bar (grip + "Library" wordmark + Minimise) is present when
expanded; firing Minimise enters the minimised state (a stable `data-` state marker, the body hidden, the handle
+ a restore control remaining, no scrim); firing restore returns to expanded with the handed `bodySlot` intact;
the retired inc-8 bottom selection-preview strip is ABSENT; and the `?overlay=library` flag gates the lens in
BOTH states — entirely in jsdom, driven by props.

The integration test exercises this capability against its own composition (no backend seam) — the handle bar,
the expand↔minimise transition, the state-kept round-trip, the strip retirement, and the flag gate are all real.
It would:

1. Render `<LibraryDrawer search="?overlay=library" bodySlot={…} />` in jsdom. Assert the lens renders expanded
   with a handle bar carrying a "Library" wordmark and a Minimise control, and the `bodySlot` content visible.
2. `fireEvent.click` the Minimise control. Assert the lens's stable `data-` state marker reads minimised, the
   `bodySlot` content is NOT visible, the handle bar (with a restore control) remains, and there is NO dimming
   scrim.
3. `fireEvent.click` the restore control. Assert the lens returns to expanded and the SAME `bodySlot` content is
   visible again (state kept across the round-trip).
4. Assert the retired inc-8 bottom selection-preview strip is ABSENT — no `library-drawer-selection-preview`
   section and no in-drawer Open button — even when `selection`/`onOpen` props are passed (accepted-but-ignored).
5. Render with `search=""` (flag absent) and assert nothing renders; render with the flag and minimise, and
   assert the lens is still present (minimised) — the flag gates both states, minimising never clears it.

## Contracts (5)

The test-proven leaf behaviours — each **one isolated automated test** in the `studio` suite (vitest jsdom,
`apps/studio/src/components/LibraryLensMinimise.test.tsx`). Per ADR-0122 (`storytree coverage`) each contract id
is the lead of a distinctly-named test, so the coverage check reports 5/5 against the ONE `real.testFile`. None
of these is an APPEARANCE assertion — the look (the grip, the wordmark styling, the minimised silhouette) is the
story's operator-attested UAT leg (ADR-0070).

1. **`lmin-handle-bar-present-when-expanded`** — the expanded lens carries a bottom handle bar (grip + "Library" wordmark + Minimise)
   - **asserts —** with the lens expanded (its default on render behind the flag), a bottom handle bar is
     present carrying a "Library" wordmark and a Minimise control.
   - **covers —** `apps/studio/src/components/LibraryDrawer.tsx` (the handle bar in the expanded state)
   - **proven by —** `apps/studio/src/components/LibraryLensMinimise.test.tsx` (net-new, vitest jsdom).
2. **`lmin-minimise-collapses-to-handle`** — firing Minimise enters the minimised state: a stable data- marker, the body hidden, a restore control, no scrim
   - **asserts —** `fireEvent.click` on Minimise transitions the lens to a stable `data-` state marker reading
     minimised, the handed `bodySlot` body NOT visible, the handle bar still present (now carrying a restore
     control), and NO full-screen dimming scrim (the map stays unobstructed — the permanent posture).
   - **covers —** `apps/studio/src/components/LibraryDrawer.tsx` (the minimise transition + minimised render)
   - **proven by —** `apps/studio/src/components/LibraryLensMinimise.test.tsx`.
3. **`lmin-restore-expands-with-body-intact`** — firing restore returns to expanded with the handed bodySlot intact (state kept)
   - **asserts —** from the minimised state, `fireEvent.click` on the restore control returns the lens to
     expanded and the SAME handed `bodySlot` content is visible again — the state is kept across the
     minimise→restore round-trip (the lens minimises, it does not unmount).
   - **covers —** `apps/studio/src/components/LibraryDrawer.tsx` (the restore transition + the state-kept body)
   - **proven by —** `apps/studio/src/components/LibraryLensMinimise.test.tsx`.
4. **`lmin-selection-preview-strip-retired`** — the inc-8 bottom selection-preview strip (and its in-drawer Open button) is absent
   - **asserts —** the reworked lens renders NO `library-drawer-selection-preview` section and NO in-drawer Open
     button — the inc-8 strip is retired (ADR-0188 dec 3; the Open job moved to the side-panel selection card) —
     even when `selection`/`onOpen` props are passed (they are accepted-but-ignored; the strip is gone).
   - **covers —** `apps/studio/src/components/LibraryDrawer.tsx` (the retired bottom selection-preview strip)
   - **proven by —** `apps/studio/src/components/LibraryLensMinimise.test.tsx`.
5. **`lmin-flag-gate-survives-both-states`** — the `?overlay=library` flag gates the lens in both the expanded and minimised states
   - **asserts —** with `search="?overlay=library"` the lens renders (expanded, then still present when
     minimised — minimising never clears the flag); with `search=""` nothing renders. The flag is read by the
     SURVIVING pure `readLibraryOverlay(search)`, NOT a new `Route` variant.
   - **covers —** `apps/studio/src/components/LibraryDrawer.tsx` (the preserved flag gate across both states)
   - **proven by —** `apps/studio/src/components/LibraryLensMinimise.test.tsx`.

## Guidance — the brownfield slice that earns the signed verdict

The rung toward `healthy` (ADR-0057 §3, BROWNFIELD editsExisting): rework the inc-8 permanent lens to add the
minimise handle and retire the bottom strip, test-first, with the four surviving `lpl-*` contracts green.

- **The new test —** `apps/studio/src/components/LibraryLensMinimise.test.tsx` (`@vitest-environment jsdom`,
  vitest + `@testing-library/react` — the studio package convention, the `LibraryPermanentLens.test.tsx` shape;
  NO real `fetch`/socket/DB/Electron). Import `{ LibraryDrawer }` from `"./LibraryDrawer"` and, for the retained
  (ignored) `selection` fixture in the strip-absence contract, `import type { SearchResult } from
  "../lib/librarySearch"` — define NO new type. Name each test for its contract id (`lmin-…`) so
  `storytree coverage library-lens-minimise` reports 5/5 (ADR-0122).
- **The RED the spine observes (before IMPLEMENT) —** a FAILING-ASSERTION red (LibraryDrawer.tsx exists — NOT
  module-not-found): against the inc-8 lens there is no handle bar, no minimise/restore state machine, no
  `data-` state marker, and the bottom selection-preview strip IS still present — so the new test fails on all
  counts. This is the brownfield red the spine observes against the inc-8 lens at HEAD (ADR-0057).
- **The GREEN —** rework `apps/studio/src/components/LibraryDrawer.tsx`: add a bottom handle bar (grip +
  "Library" wordmark + a Minimise control) in the expanded state; add component-local expand/minimise state with
  a stable `data-` state marker on the lens; on Minimise hide the body and keep the handle + a restore control,
  with no scrim; on restore return to expanded with the handed `bodySlot` intact; REMOVE the
  `library-drawer-selection-preview` strip + its in-drawer Open button (retired, dec 3) while KEEPING
  `selection?`/`onOpen?` as accepted-but-ignored optional props (the `onCommitSearch?`/`peekSlot?`/`diveSlot?`
  precedent) so the pre-rework `TreeView.tsx` call site compiles byte-unchanged; preserve the pure
  `readLibraryOverlay(search)` gate in both states. WIRING the lens mount + the bodySlot composition into
  `TreeView.tsx` and the forest-cozy appearance are witnessed under the story's operator-attested UAT leg
  (ADR-0070), NOT asserted in CI and NOT in this `real:` scope. After it, the new test's assertions hold, the
  four surviving `lpl-*` contracts stay green, and `pnpm --filter studio test` + `pnpm --filter studio typecheck`
  stay green.

### Reconcile the inc-8 `lpl-bottom-selection-preview-open-fires-onopen` contract (part of THIS increment, executing settled ADR-0188 dec 3/6)

Reworking `LibraryDrawer.tsx` to RETIRE the bottom selection-preview strip BREAKS the inc-8 permanent-lens
contract `lpl-bottom-selection-preview-open-fires-onopen` (it asserts the strip's title/description + Open button
firing `onOpen`, which no longer exist). As part of THIS increment, the
`lpl-bottom-selection-preview-open-fires-onopen` `describe`-block is RETIRED from
`apps/studio/src/components/LibraryPermanentLens.test.tsx` — this is NOT a re-decision (no ADR, no owner fork),
it is executing settled ADR-0188 dec 3/6 (the inc-8 `lds-*` trim precedent). story-author has authored the trim
already (removing that `describe` block and its now-unused `fireEvent`/`SearchResult`/`selection`-fixture
imports); the leaf keeps the four surviving `lpl-*` blocks green under the reworked source. Specifically:

- **RETIRE** (now-false — the strip is gone): `lpl-bottom-selection-preview-open-fires-onopen`. Its behaviour is
  RE-HOMED across `library-selection-card` (`lsel-open-button-fires-onopen` — the pinned Open button now on the
  side-panel card) + this cap's `lmin-selection-preview-strip-retired` (the strip's ABSENCE).
- **KEEP** (still-true against the reworked lens — flag gate, retired-affordance absence, no-scrim posture, body
  slot): `lpl-flag-gates-permanent-lens`, `lpl-no-closed-or-dive-mode-no-close-button`,
  `lpl-permanent-lens-over-live-map`, `lpl-body-slot-renders-content`. These four survive verbatim as
  `library-permanent-lens`'s contract set. `LibraryPermanentLens.test.tsx` is OUTSIDE this cap's `real.scope`
  (its `testGlobs` is `LibraryLensMinimise.test.tsx` only), so the leaf does NOT edit it — the trim is already
  authored, and the four survivors must stay green under the reworked source (they drive `search`, `bodySlot`,
  and `selection={null}` — none of which the minimise rework breaks; the handle bar and minimise state are
  additive and never touch the flag gate, the no-scrim posture, or the body-slot render).

Rules:

- **The handle bar is present when expanded** (`lmin-handle-bar-present-when-expanded`, ADR-0188 dec 6) — grip +
  "Library" wordmark + Minimise.
- **Minimise collapses to the handle** (`lmin-minimise-collapses-to-handle`) — a stable `data-` state marker,
  the body hidden, the handle + a restore control remaining, no scrim.
- **Restore returns to expanded with the `bodySlot` intact** (`lmin-restore-expands-with-body-intact`) — state
  kept across the round-trip.
- **The inc-8 bottom selection-preview strip is retired** (`lmin-selection-preview-strip-retired`, ADR-0188 dec 3)
  — assert its absence; keep `selection?`/`onOpen?` as accepted-but-ignored optional props (do NOT remove them).
- **The flag gate survives in both states** (`lmin-flag-gate-survives-both-states`) — preserve
  `readLibraryOverlay`, no Route variant; minimising never clears the flag.
- **Reuse the existing `SearchResult`, touch no `types.ts`/`server`** (inc-7 fence) — define no new type.
- **Appearance is operator-attested, not asserted here** (ADR-0070) — prove the handle/minimise/restore
  behaviour via a stable `data-` state marker; the grip look, the wordmark styling, and the minimised silhouette
  are the shared inc-9/10 look leg. Do NOT author a visual verdict, and do NOT edit `TreeView.tsx` in the
  `real:` scope (the mount is the orchestrator's supplement glue after PASS — plan §G).
- **Every `lmin-` contract test TITLE carries its unique id** or `storytree coverage` silently drops coverage
  (`sdk-leaf-drops-contract-id-test-names`, this arc's 5th-occurrence class risk — the fix if it happens is
  TEST-TITLE-ONLY, never an assertion/source edit).
