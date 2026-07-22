// hero-kit.ts — the cosy-island HERO roster (grounded-art inc 10).
//
// Distinct from `kit.ts`. That kit is a set of interchangeable island-identity buildings a
// story is bucketed into; this is a fixed, NAMED garden set — one cottage, one gazebo, one
// autumn tree, one stepping stone — authored to match the cosy-island concept
// (docs/research/grounded-art-concept/cosy-island-concept.png). The composition increment
// (grounded-art inc 11) places these by name to remake one whole island as the concept
// garden; it does not bucket into them. Keeping them out of `KIT` is also what leaves the
// existing six buildings' committed bake byte-for-byte unchanged.
//
// What the roster still owns is the one property no single piece can carry — a SHARED SUN.
// Every hero is baked under `KIT_LIGHT_ANGLE`, the same island azimuth the buildings use, so
// a cottage and a tree standing on one island cast their light the same way. A test holds it.

import type { BuildingModel } from './procedural-utils.js';
import { bakeBuilding } from './bake.js';
import type { BakedBuilding, BakeOptions } from './bake.js';
import { KIT_LIGHT_ANGLE } from './kit.js';
import { cottage } from './buildings/cottage.js';
import { gazebo } from './buildings/gazebo.js';
import { forestHut } from './buildings/forest-hut.js';
import { autumnTree } from './landscape/autumn-tree.js';
import { steppingStone } from './landscape/stepping-stone.js';

export interface HeroEntry {
  /** stable identity — the bake is keyed on this, and inc 11 references heroes by it */
  id: string;
  /** what it is, in words, for a tooltip and the contact sheet */
  label: string;
  model: () => BuildingModel;
}

/**
 * The hero roster. Small and named on purpose: these are the specific pieces the concept
 * garden is made of, not a catalogue. Ids are stable so the composition increment can name
 * `cottage` / `gazebo` / `autumn-tree` / `stepping-stone` directly.
 */
export const HERO_KIT: HeroEntry[] = [
  { id: 'cottage', label: 'shingled cottage', model: () => cottage({ light_angle: KIT_LIGHT_ANGLE }) },
  { id: 'gazebo', label: 'garden gazebo', model: () => gazebo({ light_angle: KIT_LIGHT_ANGLE }) },
  { id: 'autumn-tree', label: 'big autumn tree', model: () => autumnTree({ light_angle: KIT_LIGHT_ANGLE }) },
  { id: 'stepping-stone', label: 'stepping stone', model: () => steppingStone({ light_angle: KIT_LIGHT_ANGLE }) },
  // Appended, not inserted: the four above keep their indices, so their committed bake
  // in kit.json stays byte-for-byte and only the new `forest-hut` entry moves.
  { id: 'forest-hut', label: 'cosy forest hut', model: () => forestHut({ light_angle: KIT_LIGHT_ANGLE }) },
];

/**
 * The soft, low-contrast light the whole hero kit bakes under. The style bible reads the
 * concept as low contrast ("nothing is near-black or pure white"), so the heroes raise the
 * ambient floor well above the buildings' crisp 0.42 and soften the flat-face outline. This
 * is the KIT/PALETTE half of the machinery-first ladder — a physically-sound piece that
 * reads too harsh is a shading gap, tuned in the machinery rather than reinterpreted.
 * Exported so the contact-sheet render bakes under exactly the same light.
 */
export const HERO_BAKE: BakeOptions = {
  normalize: true,
  showGround: true,
  ambient: 0.7,
  diffuse: 0.3,
  outlineShade: 0.74,
};

/** A hero after baking — drawables plus the box a caller scales against. */
export interface BakedHeroEntry extends BakedBuilding {
  id: string;
  label: string;
}

/**
 * Bake the whole hero roster, normalized to the placement contract (centred on x = 0,
 * standing on y = 0) with its own contact shadow, under the soft shared sun — the same
 * BUILD-TIME bake the buildings get (ADR-0217 D4: the runtime performs no geometry).
 */
export function bakeHeroKit(): BakedHeroEntry[] {
  return HERO_KIT.map((e) => ({
    ...bakeBuilding(e.model(), HERO_BAKE),
    id: e.id,
    label: e.label,
  }));
}

// ---------------------------------------------------------------------------
// the tree-spread's per-status crown colourways (ADR-0227, amends ADR-0226 / 0221)
// ---------------------------------------------------------------------------
//
// The tree-spread (ADR-0226 decision 1) makes the `autumn-tree` hero every non-garden island's
// central tree — but a baked hero's paint is FIXED (ADR-0218's fence), so every island's tree read
// one uniform autumn brown, LOSING the per-status crown hue the procedural `buildTree` carried through
// CSS (colour-is-class, ADR-0093 §4: green=healthy, red=unhealthy, amber=proposed, brown=mapped). The
// owner's verdict on the promoted look ("all the trees are brown?") is that loss.
//
// The fix is N baked colourways of the ONE authored silhouette: the crown (`foliage`) recolours per
// status; the trunk, shadow, geometry and node ORDER are identical across every variant (only the crown
// fills differ), so each is one baked-def, define-once/reference-many (ADR-0069), and the trunk stays
// byte-identical to the garden `autumn-tree` hero. The surface picks the variant by the story's status.
//
// Honesty wall (ADR-0045): only `healthy` — a proven story — wears green; a proposed/mapped/building
// tree is warm amber/gold/brown and a failing one is a muted brick-red, so a bud is never a bloom. The
// bases below are LIT tones (the soft `HERO_BAKE` light keeps N·L in [0.7, 1.0], so a facet reads
// ≈ the base at its brightest and a soft-shaded sibling below) — kin to the studio's `--crown-*-hi`
// family, warm and low-saturation per the style bible. The exact hues are the owner's stage-2 look call.

export const HERO_TREE_STATUS_VARIANTS: { status: string; foliage: string }[] = [
  { status: 'healthy',   foliage: '#5aa46e' }, // proven — a green summer canopy
  { status: 'building',  foliage: '#d1913a' }, // actively growing — a warm gold (echoes the ground tint)
  { status: 'proposed',  foliage: '#cf9350' }, // claimed, not yet grown — autumn amber
  { status: 'mapped',    foliage: '#96723f' }, // dormant / mapped — brown (≈ the retired autumn default)
  { status: 'unhealthy', foliage: '#b05a48' }, // failing — a muted brick-red, dying canopy
  { status: 'unknown',   foliage: '#93a58c' }, // status not known — a neutral sage grey-green
];

/** A baked tree colourway — a full {@link BakedBuilding} plus the status it paints. */
export interface BakedHeroTreeVariant extends BakedBuilding {
  status: string;
}

/**
 * Bake the `autumn-tree` hero once per status, recolouring ONLY its crown (`foliage`). Same model,
 * same {@link HERO_BAKE} light, same geometry and painter order — so every variant is byte-identical
 * to the others (and to the garden hero) except for the crown fills. That is what lets the surface
 * treat each as one cheap baked-def and select by status, restoring the tree's status hue.
 */
export function bakeHeroTreeVariants(): BakedHeroTreeVariant[] {
  return HERO_TREE_STATUS_VARIANTS.map((v) => ({
    ...bakeBuilding(autumnTree({ light_angle: KIT_LIGHT_ANGLE }), { ...HERO_BAKE, palette: { foliage: v.foliage } }),
    status: v.status,
  }));
}
