---
id: "app-surface-semantic-growth"
tier: story
title: "One island grows through six honest states on the shared app surface"
outcome: "The shared app surface plays a deterministic, reversible six-state island-growth walkthrough across normal and reduced motion with identical honest semantic endpoints."
status: proposed
proof_mode: UAT
# Mixed witness: semantic state order, deterministic back/replay, reduced-motion equivalence,
# package ownership and Studio/art regressions are machine legs. The visible motion leg is an
# operator-held LOOK judgment under ADR-0070 and cannot be self-signed.
arc: chapter2-real-app-surface-arc
capabilities: [semantic-growth-replay-view]
depends_on: [app-surface]
consumed_by: []
decisions: [237, 93, 213, 215, 230, 70]
---

# One island grows through six honest states on the shared app surface

**Outcome —** The shared app surface plays a deterministic, reversible six-state island-growth
walkthrough across normal and reduced motion with identical honest semantic endpoints.

This is the next minimum-to-green increment of `chapter2-real-app-surface-arc` after
[`app-surface`](../app-surface/story.md). It proves the reusable product behaviour ADR-0237 D4 needs
before either consumer owns Chapter 2 pacing: one supplied fictional island advances through

`empty → land → proposed story → claimed/presence → signed proof → healthy`.

The package owns how those semantic deltas move. A later controller may choose when to advance or
which fictional frames to supply; it may not select product DOM and animate it itself.

## Journey and split

The consumer is a person watching one island become healthy, then using Back and Replay to revisit
the same growth. All six states share one supplied fixture, one `WorldSceneView` mount and one
observable semantic scene, so they form one coherent proof walkthrough rather than six stories.
Normal and reduced motion are two renderings of that same walkthrough, not separate journeys.

This story contains one capability because the state cursor, semantic transition plan and rendered
motion are one deep surface: separating them would expose a shallow timing protocol every controller
would have to reconstruct. The capability accepts already-built world-presentation frames and never
becomes a Chapter 2 controller.

## Design floor

- **The semantic order is honest.** Empty has no target island; land introduces its ground; proposed
  introduces a pale/non-healthy story; claimed/presence adds the real claim-wisp family without
  proof colour; signed proof adds the real signed-proof marker/bloom before roll-up; only healthy
  applies the healthy story/island presentation. A claim is never a bloom and neither arrival nor a
  controller timing signal can paint healthy.
- **Motion belongs to the app surface.** `@storytree/app-surface` maps semantic deltas to a small
  transform/opacity vocabulary, reusing the existing arrival, wisp, bloom, scene identity and
  sprite transforms. A consumer supplies frames and advance intent, never DOM selectors, CSS
  classes, keyframes or animation callbacks.
- **Replay is data-driven.** Next, Back, restart and replay choose a semantic frame by stable key and
  index. Time may interpolate between frames but cannot create or skip a state. Reapplying the same
  action trace yields the same frame keys and semantic render.
- **Reduced motion preserves meaning.** `prefers-reduced-motion` reaches every identical semantic
  state without spatial travel, orbit, scale sweep or delayed hidden content. Opacity may settle
  immediately; proof/presence/status remain visible through their real semantic forms.
- **Keep the current art contract.** Clean/default remains the already owner-attested Storybook
  sheet, explicit `?artStyle=vector` remains Vector, unknown explicit styles and uncovered sprite
  kinds retain the existing Vector fallbacks. No production art, frame sequence or new sprite
  family is created here.
- **Do not disturb Studio.** The live Studio controller, selection, arrival/replay escape, legend,
  inspector, chat, camera, chrome and layout retain their current behaviour. The full Studio suite
  is an observe wall even though this increment is package-local.
- **Keep the successor boundary explicit.** No website-local renderer/UI/art/animation, web artifact
  sync, Chapter 2 controller, fictional script/pacing, camera choreography, production art or broader
  legend/inspector/chat/chrome extraction belongs to this story.

## Capability

| # | capability | outcome | depends on |
|---|---|---|---|
| 1 | [`semantic-growth-replay-view`](semantic-growth-replay-view.md) | The shared view plays the six supplied semantic frames with deterministic Next/Back/Replay and app-owned normal/reduced motion. | — |

The story-level dependency on `app-surface` is real: this walkthrough needs its delivered
`WorldPresentationModel`, `WorldSceneView`, shared scene mapper, sprite policy and existing semantic
scene identities to pass UAT. `app-surface` does not need this successor to pass its own UAT, so the
edge is one-way and acyclic.

## UAT Test Criteria

**Goal —** A representative fictional island can be walked forward, backward and replayed across
the six honest product states on the shared app surface, with reduced motion preserving the same
meaning.

1. **The forward walk exposes exactly six honest states.** _(witness: machine)_
   _(proof-gate: app-surface-semantic-growth#gate-1)_ Mount the public semantic-growth view with six
   representative `WorldPresentationModel` frames and advance from empty to healthy.
   **Success —** the observed keys are exactly `empty`, `land`, `proposed`, `claimed`,
   `signed-proof`, `healthy`; each render carries only its expected real scene markers; claim/presence
   never carries bloom/verdict classes and healthy presentation appears only in the final frame.
2. **Back and replay are deterministic.** _(witness: machine)_
   _(proof-gate: app-surface-semantic-growth#gate-1)_ Record the semantic render at every frame,
   walk back to empty, then replay the same action trace twice. **Success —** frame keys, semantic
   markers and terminal render are identical on each pass; no timer, random value or remount history
   changes the state sequence.
3. **Reduced motion reaches identical semantic states without spatial travel.** _(witness: machine)_
   _(proof-gate: app-surface-semantic-growth#gate-1)_ Repeat the full action trace with
   `prefers-reduced-motion: reduce`. **Success —** every frame key and semantic marker matches the
   normal-motion run while spatial transforms/orbits and delayed hidden content are absent.
4. **The shared boundary and current art contract remain intact.** _(witness: machine)_
   _(proof-gate: app-surface-semantic-growth#gate-1)_ Inspect the package source boundary and run its
   suite. **Success —** motion/replay code lives in and exports from `@storytree/app-surface`, imports
   no Studio/web/controller/live authority, and the existing Storybook default plus
   Vector/unknown/uncovered fallbacks remain green.
5. **The current Studio consumer does not regress.** _(witness: machine)_
   _(proof-gate: app-surface-semantic-growth#gate-2)_ Run the Studio suite against the shared-package
   change. **Success —** Studio's current forest controller, selection, arrival/replay escape, art
   policy and surrounding product behaviour remain green without a Studio source edit.
6. **The six transitions read as one legible product growth.** _(witness: human)_ Stand up and verify
   a deep-link that mounts the public shared view over the representative fixture. Walk forward,
   Back and Replay in normal motion using the current Storybook default, then sample the existing
   Vector fallback and the operating-system reduced-motion setting. **Success —** the operator judges
   the transform/opacity movement legible, each claim/proof/healthy change visually honest, replay
   coherent, and reduced motion calm without losing a state. This leg judges motion only; it does not
   reopen the already-held Storybook art verdict, and an agent never signs it.

## Reliability Gates

1. **The app-surface semantic-growth suite is green** _(gate: observe)_
   _(covers: semantic-growth-replay-view)_
   `pnpm --filter @storytree/app-surface test`.
2. **The Studio first-consumer regression suite is green** _(gate: observe)_
   _(covers: semantic-growth-replay-view)_
   `pnpm --filter studio test`.

The operator-held visible-motion leg remains separate. Authored status stays `proposed`; `healthy`
is derived only after the machine evidence and operator attestation are signed.

## Ready successors

After this story is green:

1. add the Chapter 2 read-only controller that supplies staged fictional frames, visitor-paced
   advance/back intent and semantic camera targets to this surface;
2. sync the shared app-surface artifact, its product CSS and existing art through the parent-to-web
   rail, then retire the website-local Chapter 2 product renderer/animation path;
3. extract the remaining real legend, inspector, chat, camera shell and product chrome into the
   shared surface; and
4. source or author production art only after the witnessed shared-surface iteration exposes a
   concrete gap.
