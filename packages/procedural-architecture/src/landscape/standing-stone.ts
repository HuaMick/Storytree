// standing-stone.ts — a weathered monolith, grown parametrically.
//
// The FIRST landscape object type (ADR-0217 D1: one factory module per object type, no
// factory connecting them). A standing stone is a far simpler part-tree than a building:
// a single tapered slab, no apertures, no stacked parts. What it borrows from the building
// factory is the thing that matters — the ONE bake (shade → cull → order → project) that
// turns declared geometry into a real isometric solid, shaded by N·L under the island's
// shared sun (`KIT_LIGHT_ANGLE`). That is the whole point of driving it through here rather
// than hand-drawing a flat silhouette: the facets differ because the light hits them
// differently, not because a stylesheet named them.
//
// The state a UAT marker carries (proven / pending / failing) is NOT baked. It lives on the
// glow / rune / moss overlays the scene composes AROUND this solid (ADR-0208 splice seam),
// which is why one baked def serves every stone regardless of state (ADR-0218): the body is
// state-independent.
//
// Coordinates follow the factory convention (procedural-utils): Z is up, base centred on the
// origin. A 4-sided frustum spun so a CORNER faces the isometric camera (bearing 45) shows
// two flanking facets — one lit, one in shade — which is the two-tone read that makes an iso
// solid look solid, the same separation every building corner relies on.

import { building, frustum } from '../procedural-utils.js';
import type { BuildingModel } from '../procedural-utils.js';
import { KIT_LIGHT_ANGLE } from '../kit.js';
import { bakeBuilding } from '../bake.js';
import type { BakedBuilding } from '../bake.js';

export interface StandingStoneParams {
  /** the theme whose `stone` colour the monolith wears (resolved via material 'stone') */
  style_theme: string;
  /** azimuth of the shared island sun — always `KIT_LIGHT_ANGLE` in composition */
  light_angle: number;
  /** world-z height of the monolith (before projection) */
  height: number;
  /** circumradius at the foot */
  baseRadius: number;
  /** top circumradius as a fraction of the base — the taper toward a chipped crown */
  topScale: number;
  /** 4 reads as a hewn slab; more sides rounds it toward a pillar */
  sides: number;
}

export const DEFAULTS: StandingStoneParams = {
  style_theme: 'temple', // cool slate `stone` (#9aa1a6) — weathered-granite against the island green
  light_angle: 135, // KIT_LIGHT_ANGLE — overridden by the roster in composition, defaulted here for a solo bake
  height: 40,
  baseRadius: 9.5,
  topScale: 0.66,
  sides: 4,
};

/**
 * A standing stone as a single tapered slab.
 *
 * Deliberately one part: a menhir is not a stack, and the checker has nothing to catch that
 * derivation does not already prevent (a grounded part cannot float). It exists to be BAKED —
 * the shaded, ordered, projected solid is the deliverable, and the model is the shortest path
 * to it that still goes through the same pipeline the buildings do.
 */
export function standingStone(params: Partial<StandingStoneParams> = {}): BuildingModel {
  const p = { ...DEFAULTS, ...params };
  const sides = Math.max(3, Math.round(p.sides));
  const r0 = Math.max(1, p.baseRadius);
  const r1 = Math.max(0.5, r0 * p.topScale);

  // Spin so a CORNER (vertex), not a flat face, points at the bearing-45 camera: the two
  // facets flanking that corner then take two different N·L values — the lit/shade pair that
  // separates a solid from a card. (A flat face at the camera would light as one flat panel.)
  const rot = 180 / sides;

  const b = building({
    name: 'standing stone',
    style: p.style_theme,
    lightAngle: p.light_angle,
  });

  b.add('monolith', frustum({ sides, r0, r1, h: p.height, rot }), {
    ground: true,
    material: 'stone',
  });

  return b.model();
}

/** The scene-graph def id every stone `<use>` references (ADR-0218). One def serves every
 *  stone: the body is state-independent (proven/pending/failing lives on the glow overlays). */
export const STONE_DEF_ID = 'standing-stone';

/** A baked stone as the scene composes it: the resolved drawables, minus the world-space
 *  `polys` receipt (a debugging aid, and by far the largest thing in the bake). */
export interface BakedStone extends Omit<BakedBuilding, 'polys'> {
  id: string;
}

/**
 * Bake the ONE standing-stone def, under the island's shared sun and standing on the origin.
 *
 * BUILD-TIME work (ADR-0217 D4 — the runtime performs no geometry), committed as
 * `baked/stone.json` and drift-guarded. `showGround` is off: the scene composes its own
 * contact shadow around the marker (the `standingStoneMarks` `shadow` ellipse), so a baked
 * shadow here would double it.
 */
export function bakeStone(): BakedStone {
  const { polys: _polys, ...rest } = bakeBuilding(standingStone({ light_angle: KIT_LIGHT_ANGLE }), {
    normalize: true,
    showGround: false,
  });
  return { ...rest, id: STONE_DEF_ID };
}
