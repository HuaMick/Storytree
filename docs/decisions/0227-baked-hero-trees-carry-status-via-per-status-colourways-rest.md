---
status: accepted
decided: 2026-07-22
amends: [226]
arc: grounded-art-machinery-arc
---
# ADR-0227: Baked hero trees carry status via per-status colourways (restore the tree-spread crown hue)

## Status

accepted (2026-07-22) — decided/directed by the owner in conversation on 2026-07-22. Design-time
alignment IS the ratification (ADR-0110); no second end-of-flow ask. Amends ADR-0226 (the tree-spread
made the `autumn-tree` hero every island's central tree; this makes that hero carry the story's status
hue instead of one fixed brown).

## Context

ADR-0226 decision 1 (the tree-spread) replaced every non-garden island's procedural central tree
(`buildTree`) with a `<use>` of the baked `autumn-tree` hero, so the whole studio map reads as one
authored world. When that was promoted to the studio default, the owner looked at the map and said:
*"This looks good but all the trees are brown?"*

Two things were lost, and they are the same root cause. A baked hero's paint is **fixed at bake time**
(ADR-0218's fence: a bake's fill is its material × N·L, so paint lives in exactly one place — inside a
`baked-def` — and nowhere a CSS class can reach). The `autumn-tree` hero is authored with
`style_theme: 'autumn'`, i.e. a warm rust-brown crown. So every island's tree now renders that one
brown:

- **A monotony problem** — the map is a field of identical brown trees, which reads flat.
- **A lost SIGNAL** — the procedural `buildTree` it replaced coloured its crown PER STATUS through CSS
  (`.story-tree.st-<status> .crown-lo/hi`, colour-is-class per ADR-0093 §4): green = healthy, red =
  unhealthy, amber = proposed, brown = mapped, grey = unknown. The tree was carrying the story's proof
  state in its colour, and the baked hero threw that away — every tree, whatever its status, reads the
  same autumn brown.

The owner directed the fix (of three options put to them): restore the per-status hue by baking a small
set of colourways of the one authored silhouette and selecting per island by status — NOT a single green
default (which would still lose the signal and, worse, paint an unhealthy story's tree "healthy" green,
breaking the honesty wall), and NOT a separate status cue bolted onto the autumn tree (a second element
per signal, ADR-0062).

The tension the owner's choice has to resolve: baked-vector paint is fixed (ADR-0218), so "status colour"
means either N baked variants or a different mechanism. N baked variants it is — this ADR records how a
baked hero carries status.

## Decision

**The tree-spread's `autumn-tree` hero is baked once per status as a colourway — the SAME authored
silhouette with only its crown (`foliage`) recoloured — and a non-garden island's central tree `<use>`s
the colourway for THAT island's status.** Colour-is-class is restored, on the authored hero, within
ADR-0218's fixed-paint fence.

1. **Per-status colourways, one authored silhouette.** `bakeHeroTreeVariants()`
   (`packages/procedural-architecture/src/hero-kit.ts`) bakes the `autumnTree` model once per status,
   passing only a `palette: { foliage }` override to `bakeBuilding`. Every variant is byte-identical in
   GEOMETRY and painter order — same trunk, same shadow, same box — differing ONLY in the resolved crown
   fills. The set is written to `baked/kit.json` under a new `heroTreeVariants` key (a THIRD array beside
   `entries` and `heroes`); the existing `entries`/`heroes` bakes stay byte-for-byte, so the garden's
   `heroes['autumn-tree']` (the attested full-autumn garden centrepiece) is untouched.

2. **The status → crown mapping** (LIT-tone bases; the soft `HERO_BAKE` light keeps N·L in [0.7, 1.0]):
   - `healthy` → green (`#5aa46e`) — a proven story wears a summer canopy.
   - `building` → warm gold (`#d1913a`) — actively growing (echoes the ground-tint building hue).
   - `proposed` → autumn amber (`#cf9350`) — claimed, not yet grown.
   - `mapped` → brown (`#96723f`) — dormant / mapped (≈ the retired autumn default, so a correctly-brown
     status stays brown).
   - `unhealthy` → muted brick-red (`#b05a48`) — a failing, dying canopy.
   - `unknown` → sage grey-green (`#93a58c`) — status not known; also the surface's fallback for any
     unrecognised status.
   The trunk stays a fixed warm grey-brown across every variant (the procedural tree's trunk was likewise
   status-independent). The exact hues are the owner's stage-2 look call (ADR-0070) and tunable in the
   bake without touching the seam.

3. **Select per island; define-once / reference-many.** `SceneVegetationInput.heroTree` (a single hero)
   becomes `heroTrees: Partial<Record<SceneStatus, SceneGardenHero>>` (`packages/forest-world/src/scene.ts`).
   `buildVegetationDefs` emits one `baked-def` (`veg-hero-autumn-tree-<status>`) per status ACTUALLY
   present among the islands on the map — never more defs than distinct statuses, so the node floor stays
   proportional (ADR-0069). `vegHeroTreeUse` places one paint-free `baked-use` per island referencing its
   status's def; an unrecognised status falls back to `unknown`, so every `<use>` points at a def that
   was emitted. The studio folds the colourways from `kit.json`'s `heroTreeVariants` (`loadHeroTreeVariants`)
   exactly as it folds the garden heroes.

Invariants preserved: colour-is-class (ADR-0093 §4 — values shift, geometry/placement never go inline;
the fenced baked-art family, ADR-0218, remains the one place paint lives); the honesty wall (ADR-0045 —
only `healthy`, a proven story, wears green; a proposed/mapped/building tree is warm amber/gold/brown and
a failing one is a muted red, so a bud is never a bloom); one-element-per-signal (ADR-0062 — the crown
IS the tree's status element, restored, not a second cue added beside it); and the back-compat lock —
absent `heroTrees` the scene renders byte-for-byte (the public website never sends `vegetation`, so its
render is unchanged; R3F already skips the `baked-art`/`baked-defs` kinds, so there is zero mapper/R3F
change).

## Consequences

Good:

- The map is legible again: a healthy island's tree reads green, a failing one red, a dormant one brown —
  the story's proof state is back in the tree's colour, on the authored hero silhouette rather than the
  flat procedural crown.
- "All the trees are brown" is resolved without abandoning the tree-spread: the world still reads as one
  authored place, but each tree carries its status.
- Cheap and bounded: the colourways share one silhouette, so each is one `baked-def`; the defs layer
  emits only the statuses present on the map (define-once / reference-many).

Trade-offs accepted:

- **Colour, not form, carries the status on the hero.** The procedural tree also encoded sub-signals in
  GEOMETRY — a withered (unhealthy) tree grew bare branches + litter, and a proposed / zero-capability
  tree was drawn SMALL (0.62×). The baked colourways recolour one fixed silhouette, so those geometry
  sub-signals are not reproduced (an unhealthy tree is a muted-red full canopy, not a bare one; a
  proposed tree is amber at full fitted size). The colour hue — the "all brown" complaint's core — is
  fully restored; the geometry sub-signals are a possible later increment (a bare-canopy `unhealthy`
  bake) only if they earn it.
- **N baked variants, not a CSS repaint.** Because ADR-0218 fixes a bake's paint, a status recolour is a
  new bake, not a class swap. Accepted: it is the price of the shaded-solid look, and the variants are
  cheap (one palette key, shared geometry).

Landing:

- Touches `packages/forest-world/src/scene.ts` (the input shape + the tree-spread seam) → claim
  `forest-world`; CI `check:web-engine` triggers the web-engine sync + submodule-pin + owner-gated deploy
  dance. The website render is unchanged (it never sends `vegetation`), so the publish is a source-sync,
  not a visible website change — the same posture as ADR-0226.
- The LOOK (the colourway hues) is operator-attested, stage 2 (ADR-0070) — landed behind the existing
  default-on studio vocabulary flag (`?veg`), with a hosted render for the owner's verdict; never
  self-signed.

## References

- **Amends ADR-0226** (the unified vegetation vocabulary / tree-spread — its decision-1 hero tree now
  carries status).
- ADR-0221 (autumn-tree hero as the garden central tree — the garden's own `heroes['autumn-tree']` bake
  is untouched; this ADR governs the tree-spread's per-island colourways).
- ADR-0218 (baked art carries resolved paint via a fenced node family — the fixed-paint fence this works
  within; N colourways is the answer to "how does a baked hero carry status").
- ADR-0093 §4 (colour-is-class — restored for the tree), ADR-0045 (only a signed verdict blooms — the
  honesty wall, only `healthy` wears green), ADR-0062 (one element per signal — the crown IS the
  element), ADR-0070 (operator-attested look verdicts).
- Arc: grounded-art-machinery-arc.
- Code: `packages/procedural-architecture/src/hero-kit.ts` (`HERO_TREE_STATUS_VARIANTS`,
  `bakeHeroTreeVariants`), `scripts/bake-kit.ts` + `baked/kit.json` (`heroTreeVariants`);
  `packages/forest-world/src/scene.ts` (`SceneVegHeroTrees`, `vegHeroTreeUse`, `buildVegetationDefs`,
  `vegHeroTreeDefId`); `apps/studio/src/lib/factoryBuildings.ts` (`loadHeroTreeVariants`),
  `apps/studio/src/components/TreeView.tsx` (`useVegetation`).
