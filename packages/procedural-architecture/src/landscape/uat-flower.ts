// uat-flower.ts — the UAT-criteria marker as a GROUNDED baked-vector flower (grounded-art inc 14).
//
// The owner's "grounded flower, still 1:1" direction (2026-07-21): keep one marker per UAT
// criterion with the verdict read from FORM exactly as the flat marker did — a bloomed daisy =
// proven, a closed bud = pending, a wilted nodding head = failing — but replace the flat 2D
// `tallFlowerMarks` decal (forest-world scene primitive, inc 7) with a soft, shaded isometric
// flower grown through the factory, so it sits in the cosy garden beside the hero kit rather than
// reading as a sticker. Match the cosy-island concept
// (docs/research/grounded-art-concept/cosy-island-concept.png) and the owner-attested `--flower-*`
// palette; the concept informs the KIT, it is never parsed (ADR-0217 D2 / ADR-0219).
//
// The fourth landscape object type (ADR-0217 D1: one factory module per object type), after the
// standing stone, the autumn tree, and the stepping stone. ONE parametric module, three verdict
// states: the GEOMETRY and the material NAMES vary by state, and the `flower` theme (bake.ts THEMES)
// carries the per-state colours, so the module never names a hex.
//
// Physical soundness is real, not decorative: the STEM carries ground, and every leaf / head /
// petal is `attached` to what it is fixed to (the checker's attachment-contact rule requires genuine
// contact, so a petal that floated clear of the head would be a violation). The bloom is a ring of
// small soft domes around a centre dome — rounded lobes, not sharp faceted petals — which keeps it
// the cosy, low-contrast read the owner accepted on the autumn tree, not the busy faceted look he
// rejected on the baked stones (#832).

import { building, frustum, dome } from '../procedural-utils.js';
import type { BuildingModel } from '../procedural-utils.js';
import { THEMES } from '../render-svg.js';

/** The UAT verdict a marker encodes, read from its form (ADR-0208 sign-blank/pass/fail precedent). */
export type FlowerState = 'proven' | 'pending' | 'failing';

export interface UatFlowerParams {
  style_theme: string;
  light_angle: number;
  /** which verdict the flower shows — bloomed / bud / wilted */
  state: FlowerState;
  /** stem height from grade, world units */
  stemHeight: number;
  /** stem circumradius at the foot */
  stemRadius: number;
  /** how far the petals ring out from the head centre */
  headRadius: number;
  /** petals in a full bloom (failing sheds a couple; a bud has none) */
  petals: number;
}

export const DEFAULTS: UatFlowerParams = {
  style_theme: 'flower',
  light_angle: 135,
  state: 'proven',
  stemHeight: 11,
  stemRadius: 0.62,
  headRadius: 1.55,
  petals: 8,
};

/**
 * Grow one UAT-marker flower for a given verdict state. The stem + leaves are shared across all
 * three states; only the HEAD differs — a full bloom (proven), a closed pointed bud (pending), or a
 * sparse nodding head slumped off-axis (failing). Same params in ⇒ byte-identical model (a fixed
 * petal ring, no seeded jitter — a marker is one specific silhouette, and determinism is what lets
 * the bake be pinned).
 */
export function uatFlower(params: Partial<UatFlowerParams> = {}): BuildingModel {
  const p = { ...DEFAULTS, ...params };
  const style = p.style_theme in THEMES ? p.style_theme : 'flower';
  const stemH = Math.max(6, p.stemHeight);
  const stemR = Math.max(0.4, p.stemRadius);
  const headR = Math.max(1.0, p.headRadius);
  const petalCount = Math.max(0, Math.round(p.petals));

  const b = building({ name: `uat flower (${p.state})`, style, lightAngle: p.light_angle });

  // --- the stem: a slender tapering frustum to ground. Six sides + a small rotation read as an
  //     organic stalk rather than a machined post; it narrows a touch toward the head.
  b.add('stem', frustum({ sides: 6, r0: stemR * 1.25, r1: stemR, h: stemH, rot: 8 }), {
    ground: true,
    material: 'stem',
  });

  // --- two low leaf blobs part-way up the stalk, one either side, each genuinely touching it.
  //     Flattened domes so they read as soft foliage, not spheres.
  ([-1, 1] as const).forEach((side, i) => {
    b.add(`leaf-${i}`, dome({ r: 1.5, h: 0.62, sides: 7, rings: 2, bulge: 0.5 }), {
      attached: 'stem',
      dz: stemH * (0.36 + i * 0.14),
      at: { dx: side * 1.25, dy: side * 0.5 },
      material: 'leaf',
    });
  });

  if (p.state === 'pending') {
    // A closed pointed bud: a tapering frustum sitting on the stem top, with a small sepal collar
    // hugging its base — calm and unopened, the ABSENCE of bloom (the stone's dark-rune precedent).
    b.add('bud', frustum({ sides: 8, r0: headR * 0.72, r1: headR * 0.14, h: headR * 2.0, rot: 15 }), {
      attached: 'stem',
      dz: stemH - 0.2,
      material: 'bud',
    });
    b.add('sepal', dome({ r: headR * 0.62, h: 0.7, sides: 8, rings: 2, bulge: 0.4 }), {
      attached: 'stem',
      dz: stemH - 0.3,
      material: 'sepal',
    });
    return b.model();
  }

  // proven + failing share a bloom, but failing slumps it off-axis and low, sheds petals, and mutes
  // the colour — a wilted nodding head. The head anchor is where the receptacle sits relative to the
  // stem top; failing pushes it sideways + down so the whole bloom nods over.
  const failing = p.state === 'failing';
  const petalKind = failing ? 'petal-failing' : 'petal-proven';
  const centerKind = failing ? 'center-failing' : 'center-proven';
  const ringPetals = failing ? Math.max(4, petalCount - 3) : petalCount;
  const headDx = failing ? headR * 1.15 : 0;
  const headDz = failing ? stemH - headR * 0.9 : stemH;

  // the receptacle the petals + centre are fixed to — a low soft dome touching the stem top.
  b.add('head', dome({ r: headR * 0.9, h: 0.72, sides: 10, rings: 2, bulge: 0.3 }), {
    attached: 'stem',
    dz: headDz,
    at: { dx: headDx, dy: 0 },
    material: petalKind,
  });

  // the petal ring — small soft domes around the receptacle, each attached to it (so each genuinely
  // touches). A ring in the x–y plane reads as a daisy seen at the iso angle: rounded lobes facing up.
  // They sit LOW and flat and splay a touch wider than the receptacle, so the centre pokes up proud of
  // them and the gold eye reads (without it the bloom reads as a closed rose, not the concept's daisy).
  for (let i = 0; i < ringPetals; i++) {
    const a = (i / ringPetals) * Math.PI * 2;
    b.add(`petal-${i}`, dome({ r: headR * 0.7, h: 0.5, sides: 6, rings: 2 }), {
      attached: 'head',
      dz: 0.05,
      at: { dx: Math.cos(a) * headR * 1.02, dy: Math.sin(a) * headR * 0.9 },
      material: petalKind,
    });
  }

  // the centre disc — gold on a proven bloom, muted on a wilted one — raised proud of the petal ring
  // so the eye reads from the iso angle (a white ring around a gold centre = the concept's daisy).
  b.add('center', dome({ r: headR * 0.5, h: 1.0, sides: 9, rings: 3 }), {
    attached: 'head',
    dz: 0.42,
    material: centerKind,
  });

  return b.model();
}

/** The three verdict states, in the order a contact sheet and the roster present them. */
export const FLOWER_STATES: readonly FlowerState[] = ['proven', 'pending', 'failing'];

/** How many parts a state produces — the test's oracle. stem + 2 leaves, then the head assembly. */
export function expectedFlowerPartCount(state: FlowerState, petals = DEFAULTS.petals): number {
  const base = 3; // stem + two leaves
  if (state === 'pending') return base + 2; // bud + sepal
  const ring = state === 'failing' ? Math.max(4, Math.round(petals) - 3) : Math.round(petals);
  return base + 2 + ring; // head + centre + petal ring
}
