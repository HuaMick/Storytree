---
id: "app-surface-world-view"
tier: capability
story: app-surface
arc: chapter2-real-app-surface-arc
title: "A deterministic typed world model delegates to the real shared SceneView"
outcome: "A compact `WorldSceneView` accepts a deterministic typed `WorldPresentationModel` plus separate optional `WorldPresentationEvents`, derives the relocated SceneView context without live authority, and delegates the representative semantic scene and event callbacks to the already-green shared renderer."
status: proposed
proof_mode: integration-test
depends_on: []
decisions: [237, 93, 230, 70]
# NET-NEW missing seam only. AUTHOR_TEST writes WorldSceneView.test.tsx against the missing wrapper;
# IMPLEMENT authors WorldSceneView.tsx. SceneView, sprite manifest/resolver/sizing/fallback and
# trail/arrival selectors are ALREADY relocated with 103 green package tests. They remain the
# package proofCommand's reliability regression evidence, not behaviours this test must recreate.
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/app-surface", "test"]
  scope:
    testGlobs: ["packages/app-surface/src/WorldSceneView.test.tsx"]
    sourceGlobs: ["packages/app-surface/src/WorldSceneView.tsx"]
  real:
    testFile: "packages/app-surface/src/WorldSceneView.test.tsx"
    sourceFile: "packages/app-surface/src/WorldSceneView.tsx"
    scope:
      testGlobs: ["packages/app-surface/src/WorldSceneView.test.tsx"]
      sourceGlobs: ["packages/app-surface/src/WorldSceneView.tsx"]
    install: true
    proofCommand:
      file: pnpm
      args: ["--filter", "@storytree/app-surface", "test"]
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/app-surface", "typecheck"]
---

# A deterministic typed world model delegates to the real shared SceneView

**Outcome —** A compact `WorldSceneView` accepts a deterministic typed
`WorldPresentationModel` plus separate optional `WorldPresentationEvents`, derives the relocated
`SceneView` context without live authority, and delegates the representative semantic scene and
event callbacks to the already-green shared renderer.

## Proof status and boundary

The first real-build attempts proved the original authored leaf was too broad: Codex reached a
genuine `CONFIRM_GREEN` red, while Claude exhausted 16 turns trying to author one oversized test.
The infrastructure beneath the missing seam is already present and independently green:
`SceneView`, sprite manifest/resolver/sizing/fallback, and `trailRevealPlan` /
`arrivalGrowPlan` have **103 passing package tests**.

This leaf therefore authors only the missing typed wrapper. The package proof command reruns those
103 tests as regression evidence after the new pair greens; `WorldSceneView.test.tsx` does not copy
their fixture matrix or re-prove every sprite, sizing, trail and arrival contract.

## Guidance

- Define one plain-data `WorldPresentationModel` containing exactly:
  - the `SceneNode` scene;
  - selected and emphasized story ids;
  - hidden statuses;
  - arrival ids;
  - the existing trail reveal plan;
  - the resolved sprite sheet; and
  - art scale.
- Normalize set-like inputs deterministically: stable, duplicate-free ids/statuses and stable
  defaults. Equal plain inputs must yield deeply equal models. Time and randomness are absent.
- Define `WorldPresentationEvents` separately. Its selection callbacks are optional so the same
  wrapper admits Studio's operable controller and a later Chapter 2 read-only controller without a
  fake mutation.
- `WorldSceneView` translates that model/events pair into the existing `SceneCtx`, then renders the
  already-relocated `SceneView`. It does not reproduce `renderNode`, sprite resolution/sizing,
  trail/arrival selection or any other renderer logic.
- The source imports only public browser-safe seams from this package and
  `@storytree/forest-world`. It imports no `apps/studio` module, API/store client, subscription,
  promise, clock, random source or DOM animation authority.
- Keep the story boundary unchanged: legend, inspector, chat, camera shell/controller, bulk CSS,
  six-state replay and reduced-motion visual proof remain later increments.

## Integration test

One compact `WorldSceneView.test.tsx` proves the missing seam:

1. Build the model twice from equal plain inputs, including unordered/duplicated set-like values.
   Assert deeply equal normalized output and stable defaults.
2. Render one representative semantic scene through `WorldSceneView`. Assert one existing semantic
   scene marker survives delegation, then activate one selectable node and assert the optional
   event callback receives its id.
3. Inspect/import the wrapper source boundary and assert it has no Studio-private or live-authority
   import. The package proof command then observes the existing 103 renderer/sprite/sizing/trail
   tests still green.

## Contracts

1. **`aswv-equal-plain-inputs-normalize-deterministically`**
   - **asserts —** equal scene/model inputs normalize to deeply equal output; selected/emphasized
     ids, hidden statuses and arrival ids are stable and duplicate-free, with deterministic defaults.
2. **`aswv-delegates-one-semantic-scene-and-event`**
   - **asserts —** `WorldSceneView` preserves one representative semantic marker from the relocated
     `SceneView`, and a selectable node reports its id through the separate optional events seam.
3. **`aswv-wrapper-has-no-private-or-live-authority`**
   - **asserts —** `WorldSceneView.tsx` imports no Studio-private module or network/store/
     subscription/clock authority and contains no duplicate scene/sprite/trail renderer.
