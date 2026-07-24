---
id: "app-surface-world-view"
tier: capability
story: app-surface
arc: chapter2-real-app-surface-arc
title: "A deterministic typed world model drives the real shared React scene view"
outcome: "A deterministic typed world-presentation model plus separate world-event callbacks drive the real React scene mapper, sprite manifest/resolver/sizing/fallback and existing trail/arrival selectors in `@storytree/app-surface`, with Storybook default, Vector fallback and semantic SVG/DOM identity preserved and no live authority in the view."
status: proposed
proof_mode: integration-test
depends_on: []
decisions: [237, 93, 230, 70]
# NET-NEW deep module in one package. AUTHOR_TEST writes WorldSceneView.test.tsx against the missing
# view/model; IMPLEMENT moves the real SceneView, sprite policy and trail/arrival selectors. The
# broad one-package extraction requires the package-suite proofCommand.
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/app-surface", "test"]
  scope:
    testGlobs: ["packages/app-surface/src/WorldSceneView.test.tsx", "packages/app-surface/src/trailReveal.test.ts"]
    sourceGlobs: ["packages/app-surface/src/**/*.ts", "packages/app-surface/src/**/*.tsx", "packages/app-surface/src/**/*.css"]
  real:
    testFile: "packages/app-surface/src/WorldSceneView.test.tsx"
    sourceFile: "packages/app-surface/src/WorldSceneView.tsx"
    scope:
      testGlobs: ["packages/app-surface/src/WorldSceneView.test.tsx", "packages/app-surface/src/trailReveal.test.ts"]
      sourceGlobs: ["packages/app-surface/src/**/*.ts", "packages/app-surface/src/**/*.tsx", "packages/app-surface/src/**/*.css"]
    install: true
    proofCommand:
      file: pnpm
      args: ["--filter", "@storytree/app-surface", "test"]
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/app-surface", "typecheck"]
---

# A deterministic typed world model drives the real shared React scene view

**Outcome —** A deterministic typed world-presentation model plus separate world-event callbacks
drive the real React scene mapper, sprite manifest/resolver/sizing/fallback and existing trail/arrival
selectors in `@storytree/app-surface`, with Storybook default, Vector fallback and semantic SVG/DOM
identity preserved and no live authority in the view.

## Guidance

- Derive the minimum model from what `TreeView` currently passes to `SceneView`: real scene/world
  data, art style, focus/selection ids, arrival ids and reveal plan. Reuse public/browser-safe
  forest-world and landed scene types; do not create a parallel world/status vocabulary.
- Keep immutable `WorldPresentationModel` data separate from `WorldPresentationEvents`. Scene
  selection/focus intent is a typed event supplied by the controller.
- The model/view carries no fetch client, store handle, subscription, promise, random source, clock,
  DOM node or mutation authority. A read-only controller may omit operable events.
- Move the existing React scene mapper and semantic SVG/DOM identity; do not recreate it as new JSX,
  string SVG, screenshot or website renderer. A compatibility wrapper may only delegate.
- Move the current sprite manifest/resolver/sizing/fallback with the scene. Preserve default
  Storybook, explicit Vector, unknown→Vector, uncovered-kind→per-node Vector, sizes, ground-contact
  anchors and painter-Y ordering.
- Move `trailRevealPlan` and `arrivalGrowPlan` unchanged with their tests because the view consumes
  them. Do not add a clock, six-state choreography, replay engine or new reduced-motion behaviour.
- Leave legend, inspector, chat, camera shell/controller, bulk TreeView chrome/layout and bulk CSS in
  Studio. Only scene-local styling inseparable from the mapper may move in this leaf.

## Integration test

1. Fold the same representative scene inputs twice and assert deeply equal models with stable ids/order.
2. Render `WorldSceneView` with nodes, claims/proof state, selection, arrival ids and reveal plan;
   assert the existing semantic SVG/DOM ids/classes/roles.
3. Activate a selectable scene node; assert only the typed world event fires and no network/store
   operation occurs.
4. Exercise default, explicit Vector, unknown and partial Storybook coverage; assert resolver,
   sizing, fallback, anchor and depth metadata match current fixtures.
5. Run the moved `trailRevealPlan` / `arrivalGrowPlan` cases and assert their deterministic outputs
   match the existing fixtures.
6. Assert the package imports no Studio-private API/store/controller module.

## Contracts

1. **`aswv-model-is-deterministic-and-authority-free`**
   - **asserts —** equal inputs produce deeply equal models/renders; functions, live handles, clocks
     and DOM nodes cannot enter presentation data.
2. **`aswv-model-carries-current-scene-state`**
   - **asserts —** world/scene, art style, focus/selection, arrival ids and reveal plan cross without
     a Studio-private API type.
3. **`aswv-renders-the-existing-scene-semantics`**
   - **asserts —** the shared package emits the existing semantic SVG/DOM identity, not a substitute.
4. **`aswv-emits-world-events-without-effects`**
   - **asserts —** scene selection/focus emits typed events; render/interaction performs no live I/O.
5. **`aswv-preserves-sprite-policy`**
   - **asserts —** Storybook/Vector resolution, graceful fallback, sizes, anchors and painter order
     match existing behaviour.
6. **`aswv-trail-arrival-selectors-move-unchanged`**
   - **asserts —** existing `trailRevealPlan` / `arrivalGrowPlan` fixtures remain deterministic and
     equivalent; no six-state choreography or clock is introduced.
7. **`aswv-has-no-studio-private-import`**
   - **asserts —** the package imports only public browser-safe seams below it.
