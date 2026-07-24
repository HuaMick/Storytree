---
id: "semantic-growth-replay-view"
tier: capability
story: app-surface-semantic-growth
arc: chapter2-real-app-surface-arc
title: "The shared world view plays and replays one honest semantic growth sequence"
outcome: "A public app-surface growth view applies the six supplied world-presentation frames through `WorldSceneView`, owns their transform/opacity treatment, and makes Next, Back, Replay and reduced-motion rendering deterministic."
status: proposed
proof_mode: integration-test
depends_on: []
decisions: [237, 93, 213, 215, 230, 70]
# NET-NEW package-local leaf. AUTHOR_TEST creates SemanticGrowthWorldView.test.tsx against the
# missing public view/player. IMPLEMENT adds the view/player and its app-owned motion rules inside
# packages/app-surface, then exports the seam. The leaf may edit the package index only for that
# export; it does not touch Studio, web, forest-world, art, controllers or sync.
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/app-surface", "test"]
  scope:
    testGlobs: ["packages/app-surface/src/SemanticGrowthWorldView.test.tsx"]
    sourceGlobs: ["packages/app-surface/src/SemanticGrowthWorldView.tsx", "packages/app-surface/src/semantic-growth.css", "packages/app-surface/src/index.ts"]
  real:
    testFile: "packages/app-surface/src/SemanticGrowthWorldView.test.tsx"
    sourceFile: "packages/app-surface/src/SemanticGrowthWorldView.tsx"
    editsExisting: true
    scope:
      testGlobs: ["packages/app-surface/src/SemanticGrowthWorldView.test.tsx"]
      sourceGlobs: ["packages/app-surface/src/SemanticGrowthWorldView.tsx", "packages/app-surface/src/semantic-growth.css", "packages/app-surface/src/index.ts"]
    install: true
    proofCommand:
      file: pnpm
      args: ["--filter", "@storytree/app-surface", "test"]
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/app-surface", "typecheck"]
---

# The shared world view plays and replays one honest semantic growth sequence

**Outcome —** A public app-surface growth view applies the six supplied world-presentation frames
through `WorldSceneView`, owns their transform/opacity treatment, and makes Next, Back, Replay and
reduced-motion rendering deterministic.

## Proof walkthrough first

One integration test supplies six representative, already-built `WorldPresentationModel` frames to
the missing public semantic-growth view:

1. render `empty`, then advance through `land`, `proposed`, `claimed`, `signed-proof`, `healthy`;
2. assert the stable frame key and real semantic scene markers at each stop;
3. Back to empty, replay the same action trace twice and compare every semantic snapshot;
4. repeat under `prefers-reduced-motion: reduce`, compare the same semantic snapshots and assert no
   spatial travel/orbit/delayed-hidden treatment remains; and
5. inspect the package boundary and normal-motion hooks, then let the package proof command rerun the
   existing renderer, sprite, sizing, trail and arrival regression suite.

This is one writable red: the test imports a public growth player/view that does not exist at HEAD.
Green is the smallest package-local player/view plus motion stylesheet and public export. The test
does not build a Chapter 2 controller, duplicate `SceneView`, synthesize art or reach into Studio/web.

## Guidance

- Accept exactly six ordered entries keyed `empty`, `land`, `proposed`, `claimed`, `signed-proof`,
  `healthy`, each carrying an already-normalized `WorldPresentationModel`. Fail closed on missing,
  duplicate or reordered keys; do not silently invent a frame.
- Keep the cursor and transition selection pure. Next clamps at healthy, Back clamps at empty,
  restart selects empty, and Replay reapplies the same ordered keys. Time controls interpolation
  only; no timeout advances the cursor and no random value influences output.
- Delegate every frame to the existing `WorldSceneView`. Reuse the scene's real territory, tree,
  claim-wisp, signed-proof/bloom and status identities. Do not fork `SceneView`, sprite resolution,
  scene construction or `@storytree/forest-world`.
- Own one semantic transition vocabulary in `@storytree/app-surface`: transform/opacity staging over
  the current arrival/growth, wisp, proof-bloom and proposed-to-healthy hooks. Prefer existing
  transforms and CSS capabilities; add no animation framework, canvas/game engine, raster frame
  sequence or new art.
- Resolve the browser's `prefers-reduced-motion` signal inside the shared surface (an explicit test
  override is allowed). Reduced mode must suppress spatial translation/scale/orbit and delayed hidden
  content, including the real wisp's SVG orbit, while rendering the same scene/model markers
  immediately. The preference never changes the cursor or supplied model.
- Keep product authority out. Inputs are plain frames plus optional navigation callbacks; there is no
  fetch, store, subscription, claim mutation, proof mutation, clock-selected semantic state, website
  selector or Chapter 2 pacing/script.
- Export the public seam from the package root. Motion rules live beside it in the package, not in
  website code. Do not move Studio CSS or wire a consumer in this increment.
- Preserve current art and consumers through the full suite: Storybook remains clean/default; Vector
  remains the explicit, unknown-value and uncovered-kind fallback; existing Studio behaviour is
  observed by the story gate without a Studio source edit.

## Machine contracts

1. **`sgrv-six-ordered-frames-preserve-semantic-honesty`**
   - **asserts —** only the exact ordered key set is accepted; walking it renders land before a
     proposed tree, a real claim/presence wisp without bloom/verdict identity, a signed-proof marker
     before roll-up, and healthy status only at the final frame.
2. **`sgrv-back-restart-replay-are-deterministic`**
   - **asserts —** equal frame inputs plus equal navigation traces yield equal frame-key sequences and
     semantic DOM snapshots; Next/Back clamp at the ends and no timer/random/remount history changes
     the result.
3. **`sgrv-reduced-motion-keeps-identical-semantics-without-travel`**
   - **asserts —** a stubbed `prefers-reduced-motion: reduce` run yields the same six semantic
     snapshots as normal motion while emitting no active translate/scale/orbit instruction and never
     hiding settled state behind an animation delay.
4. **`sgrv-motion-and-authority-stay-in-the-shared-package`**
   - **asserts —** transition hooks/rules and reduced-motion handling live under
     `packages/app-surface`, the view delegates to `WorldSceneView`, and its source imports no
     Studio/web module, live data/store authority, Chapter 2 controller or duplicate renderer.
5. **`sgrv-existing-art-and-scene-contracts-do-not-regress`**
   - **asserts —** the full package command retains existing Storybook/Vector resolution and fallback,
     sprite sizing/anchors/depth order, semantic mapper, trail/arrival and event tests.

The fifth contract is a regression wall observed by the package command after the new integration
test greens; it does not ask the new test to duplicate the existing fixture matrices. Visible timing,
easing and legibility remain the story's operator-held UAT leg.
