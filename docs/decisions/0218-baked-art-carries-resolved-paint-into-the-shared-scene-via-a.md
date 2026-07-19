---
status: accepted
decided: 2026-07-20
amends: [93]
arc: grounded-art-machinery-arc
---
# ADR-0218: Baked art carries resolved paint into the shared scene via a fenced node family

## Status

accepted (2026-07-20) — decided/directed by the owner in conversation on 2026-07-20. The owner,
looking at increment 5's buildings glued onto the island (`?factoryart=on`), called out that the map's
two big STANDING objects — the standing-stones and the central tree — still read as flat pastel
silhouettes beside the shaded isometric buildings, and directed (of three options put to them) that the
stones be driven through the same factory machinery so they become true isometric baked solids. That
choice knowingly OPENS the ADR-0093 colour fork increment 5 surfaced and left "decide later"
(ADR-0217's increment-5 consequence). This ADR records the mechanism for that fork. Design-time
alignment IS the ratification (ADR-0110); the LOOK verdict is separate and remains the owner's
(ADR-0070 stage 2), still outstanding. The fenced-node mechanism below is the orchestrator's
engineering realisation of the owner-directed decision, not a second decision.

## Context

Increment 5 (#831) baked the building factory's output onto the island behind `?factoryart=on`. It hit
a wall it recorded rather than crossed: **baked art cannot enter the shared scene-graph.** A baked
facade's fill is its material colour modulated by N·L, so two walls of one object carry DIFFERENT
colours and no CSS class can name them — but
[ADR-0093](0093-shared-forest-world-render-core-for-studio-and-the-public-we.md) Decision 1 keeps the
scene-graph's drawables carrying "no class strings, no live data", and Decision 4 shares "the LOOK
only", with colour resolved surface-side through each mapper's classes (`SceneNodeBase` in
`packages/forest-world/src/scene.ts` deliberately carries no `fill`/`stroke`). Increment 5 therefore
placed the buildings in studio **chrome** (`TreeView.tsx` `StudioWorldChrome`, where ADR-0102's flat
identity glyphs already lived, ADR-0093 Decision 2's line), behind the flag. That was tolerable because
a building stamp is a minor decoration: the public website losing it costs nothing, and
`packages/forest-world-r3f`'s mapper already emits `{ kind: 'skipped' }` for it.

**The stones cannot hide in chrome.** Unlike the buildings, the standing-stones are semantic UAT
markers already IN the shared scene-graph (`standing-stone-*` kinds, `buildUatMarkers` /
`standingStoneMarks`, ADR-0208) — one per UAT criterion, rendered by all three mappers and shown on the
public website. A chrome-only path would strip them from the website and fork the placement logic
(the scatter positions are computed inside the scene-graph). Driving them through the factory as
requested therefore FORCES a decision on whether baked, paint-carrying geometry may enter the shared
scene — the exact fork increment 5 flagged as "an owner call".

**Three findings shape the mechanism.**

1. **The stone body is state-INDEPENDENT.** A stone's proven/pending/failing state is carried entirely
   by its GLOW, rune, and moss overlays (`standingStoneMarks` draws the body identically in all three
   states; only the layered glow circles differ). So the baked SOLID that replaces the flat body is
   ONE shape for every stone — the "small finite set of states" the buildings' node-cost problem
   feared collapses to a single def. The glow/rune/moss stay CSS-side, unchanged, and keep carrying the
   verdict.

2. **R3F already skips stones.** `world-to-3d.ts` maps only tile/tree/trail/cave/wisp and emits an
   explicit `{ kind: 'skipped' }` for every other kind, `standing-stone-*` included. A baked-art stone
   node is likewise a non-core kind → also skipped → **zero R3F regression**. The "a flat isometric
   bake does not translate to a real 3D scene" problem is real ONLY for the central TREE, which R3F
   DOES render (`story-tree`) — and the tree is deliberately out of scope here (see Consequences).

3. **The ground is not the buildings' projection, and that is already accepted.** The island ground is
   a flat pointy-top hex lattice extruded straight DOWN by `TILE_DEPTH` (`buildGround`), not the
   buildings' true 30° isometric `project()`. "Match the buildings" and "match the ground" genuinely
   diverge — but increment 5's buildings already stand on this flat ground and the owner judged they
   "glue on cleanly". The stones inherit that same accepted relationship: they match the BUILDINGS
   (true iso), and the pre-existing ground mismatch is left untouched (the ground is a LIKED layer).

## Decision

**The shared scene-graph gains a single FENCED node family that carries resolved paint. Everything
else stays colour-class-driven; this family is the one, named, self-describing exception, justified
because a bake's fill is material × N·L — not a category a class can name.**

1. **Two new `SceneNode` shapes, and no change to `SceneNodeBase`.**
   - `SceneBakedDef` (`el: 'baked-def'`): `{ defId, nodes: BakedPaintNode[] }` — a definition carrying
     a list of resolved-paint drawables in painter order. `BakedPaintNode` is the factory's `BakedNode`
     vocabulary (`polygon`/`path`/`ellipse` with `fill`/`stroke`/`strokeWidth`/`fillRule`/`opacity`),
     DUPLICATED in `forest-world` rather than imported — the core stays a foundational root that
     depends on nothing (ADR-0093 Open call 2), exactly as it duplicates every other cross-boundary
     vocabulary. **This is the ONLY node type in the graph that carries paint.**
   - `SceneBakedUse` (`el: 'baked-use'`): `{ defId } & SceneNodeBase` — a paint-FREE placement that
     references a def by id. It carries the ordinary semantic fields (transform on its wrapper, the
     criterion `id` for delegation) and no colour.

   `SceneNodeBase` is untouched: no `fill`/`stroke` is added to it, so the colour-is-class invariant
   holds for every existing kind. The fence is that paint lives in exactly one place — inside a
   `baked-def`'s `nodes` — and nowhere else.

2. **Define-once, reference-many (ADR-0069).** One `baked-def` per distinct baked shape, `<use>`d N
   times. The surface SUPPLIES the baked def data (a build-time factory artifact) into `SceneInput`;
   the core PLACES it — the same "surface folds its data, core owns the shapes/placement" boundary
   ADR-0093 Decision 4 draws (the def is opaque surface-supplied data, like `coastPaths`). `forest-world`
   imports nothing new. Absent def ⇒ today's render, byte-for-byte (the back-compat / public-website
   safety lock, exactly like `parcels` and `uatCriteria`).

3. **The per-mapper contract.**
   - **studio** (`SceneView.tsx`) and **website** (the separate repo's string-SVG mapper) render a
     `baked-def` into `<defs><g id={defId}>…paint…</g>` and each `baked-use` into `<use href="#defId">`,
     verbatim — the paint is already resolved, so neither mapper computes colour.
   - **R3F** (`world-to-3d.ts`) SKIPS the baked-art family (its total-coverage explicit-skip contract),
     which for the stones is a no-op change — they were already skipped.

4. **First (and, this increment, only) consumer: the standing-stones.** The flat `standing-stone-body`
   /`-face`/`-cap` polygons are replaced by ONE baked isometric solid (a `baked-use` of the single
   `stone` def); the glow/rune/crack/moss/spark overlays are unchanged and keep carrying the state. The
   stone is authored through the SAME factory (`packages/procedural-architecture`, ADR-0217 D1: one
   module per object type — a `landscape/standing-stone.ts` sibling of `buildings/`), baked at build
   time with the shared sun `KIT_LIGHT_ANGLE` and the true-iso `project()`, and matches the buildings'
   TECHNIQUE (shaded solids, one light, 30°) at a deliberately SIMPLER detail level than the current
   buildings (the owner intends to simplify those later; simpler is on-brief). It ships behind the SAME
   `?factoryart=on` flag, default OFF (the look is the owner's verdict, ADR-0070 stage 2 / ADR-0159 —
   never self-signed).

Rejected: adding `fill`/`stroke` to `SceneNodeBase` (punctures the colour-is-class invariant globally
for one feature); inlining the baked solid per stone (node-cost, ADR-0069); a chrome-only path for the
stones (strips the website, forks placement); any machine-signed look verdict.

## Consequences

- **Good:** the fork increment 5 flagged is resolved with the invariant intact everywhere except one
  named, self-describing family — a reader who finds paint in the graph finds it only inside a
  `baked-def` and finds this ADR next to it. The website gains the CAPABILITY to render baked stones
  (its mapper reads the same def verbatim) whenever its fold opts in; until then it renders today's flat
  stones, unchanged.
- **Good:** the state machinery is untouched — proven/pending/failing still reads from the glow/rune,
  now sitting on a shaded solid instead of a flat slab. One def covers every stone.
- **Cost / DEFERRED — the central tree.** The tree is the other object the owner named, but it is
  explicitly NOT done here: (a) the owner is actively weighing REPLACING the middle tree with something
  flatter (a pond), so a tree factory might be deleted; and (b) unlike the stones, R3F RENDERS the tree
  (`story-tree`), so baking it forces either an R3F placeholder or the factory exposing its 3D part-tree
  for R3F to re-derive — a real cross-surface cost. Both are the owner's calls; this ADR's fenced
  mechanism is what a future tree increment would build on, but the tree decision is not taken.
- **Cost:** touching `packages/forest-world/src` trips `check:web-engine` (CI-only locally) — the web
  sync/publish/pin dance is part of landing this, unlike increment 5 which stayed in chrome. The change
  is ADDITIVE (a new optional `SceneInput.bakedStone` + two new `SceneNode` shapes), so it is visually
  inert on the live site until the web mapper maps it.
- **Unresolved, honestly:** whether the baked stones actually READ well next to the buildings and hold
  the existing island look is the owner's LOOK verdict and is not yet given. Every look defect in this
  arc was found by looking at a render, not by a green checker; this increment is landed default-off
  precisely so that verdict can be taken on a hosted render before anything ships.

## References

- [ADR-0093](0093-shared-forest-world-render-core-for-studio-and-the-public-we.md) — **amended**:
  Decision 1's "no class strings" and Decision 4's "shared = the LOOK only, colour surface-side" gain
  the fenced `baked-def`/`baked-use` exception. Decisions 2/3/5 and the three-mapper structure stand.
- [ADR-0217](0217-art-factories-are-per-object-type-parametric-kit-explicit-dr.md) — the arc's design:
  one factory per object type, parts bake at build time, the runtime performs no geometry (D4). Its
  increment-5 consequence "baked art cannot currently enter the shared scene-graph" is the open call
  this resolves. D1 (no factory connecting object types) is upheld — a stone is its own module.
- [ADR-0069](0069-parameterise-the-forest-world-geometry-as-a-procedural-pipel.md) — the node-count
  ceiling the define-once-reference-many contract serves.
- [ADR-0070](0070-frontend-as-an-inner-loop-role-the-two-stage-proof-for-visua.md) /
  [ADR-0159](0159-frontend-builder-proves-stage-1-through-the-inner-loop-visua.md) — the look is
  operator-attested, stage 2; the flag is default-off until the owner signs.
- [ADR-0123](0123-webgl-forest-world-renderer-via-react-three-fiber-website-fi.md) — the R3F mapper and
  its total-coverage explicit-skip contract the baked-art family joins.
- [ADR-0208](0208-art-asset-designer-swarm-fan-out-one-design-subagent-per-vis.md) — the standing-stone
  marker's frozen body-painter splice seam (`standingStoneMarks`) whose flat body this replaces with a
  baked solid.
- `packages/procedural-architecture` — the factory (ADR-0217 stations 1–4); `landscape/standing-stone.ts`
  is the new per-type module. `packages/forest-world/src/scene.ts` — the shared scene-graph the fenced
  family is added to.
</content>
</invoke>
