// apertures.ts — an opening is a HOLE in a wall, not a decal stuck to one.
//
// ADR-0217 decision 5: apertures are cut by subdividing the facade, never by a boolean
// kernel. That is not a compromise — increment 1 found it is what CGA actually does
// (facade subdivision and asset instancing), that Müller et al. deliberately avoided
// booleans citing their unreliability, and that zero of the nineteen catalogued house
// defects would have been prevented by a CSG subtraction.
//
// WHAT CHANGED AND WHY IT MATTERS TO STATION 3. The previous renderer drew an aperture
// as two quads nudged a few hundredths along the facet normal, floating in front of an
// intact wall, sorted by an explicit override against their host's depth. That override
// existed because a centroid sort put a ground-level door BEHIND the wall it was cut
// into. Cutting the wall properly retires the override: the strips, the jambs and the
// pane are ordinary geometry at honest positions, and station 3 orders them with no
// special case at all. One less thing that can silently regress.
//
// WHAT IT ANSWERS. ADR-0217 left one question open and named it the first thing to
// test: whether an opening cut this way reads acceptably where a wall's thickness
// should show as a reveal. It does, and `reveal()` below is the shape of the answer —
// the suspected painted trapezoid turns out to be a real recessed surface that costs
// two quads and needs no new machinery.

import { add3, facetPoint, scale3 } from './procedural-utils.js';
import type { Aperture, ApertureQuad, Facet, Vec3 } from './procedural-utils.js';

/** An aperture's extent in its host facet's (s, t) parameter space. */
export interface Opening {
  /** left edge at `t0` and at `t1` — they differ on a tapering facet */
  sLeft: [number, number];
  sRight: [number, number];
  t0: number;
  t1: number;
}

/** Where an aperture sits on its facet, in the facet's own parameter space. */
export function openingOf(ap: Aperture, quad: ApertureQuad): Opening {
  const sAt = (cu: number, t: number): number => 0.5 + cu / quad.widthAt(t);
  return {
    sLeft: [sAt(ap.cu - ap.w / 2, quad.t0), sAt(ap.cu - ap.w / 2, quad.t1)],
    sRight: [sAt(ap.cu + ap.w / 2, quad.t0), sAt(ap.cu + ap.w / 2, quad.t1)],
    t0: quad.t0,
    t1: quad.t1,
  };
}

/** Linear interpolation of an opening's edge between its own two t bounds. */
function edgeAt(edge: [number, number], o: Opening, t: number): number {
  const span = o.t1 - o.t0;
  const k = span < 1e-9 ? 0 : (t - o.t0) / span;
  return edge[0] + (edge[1] - edge[0]) * k;
}

const EPS = 1e-6;

/**
 * The solid part of a facade: the facet with its openings removed, as simple polygons.
 *
 * Cut into horizontal bands at every opening's sill and head, then across each band at
 * every opening edge. A facet with one window comes back as four quads — under, over,
 * and either side — which is exactly the classic facade subdivision and exactly what a
 * BSP can order without ever needing to know an aperture exists.
 */
export function facadeStrips(facet: Facet, openings: readonly Opening[]): Vec3[][] {
  const bands = [0, 1];
  for (const o of openings) {
    bands.push(Math.max(0, Math.min(1, o.t0)), Math.max(0, Math.min(1, o.t1)));
  }
  const cuts = [...new Set(bands.map((t) => Number(t.toFixed(9))))].sort((a, b) => a - b);

  const out: Vec3[][] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const ta = cuts[i];
    const tb = cuts[i + 1];
    if (ta === undefined || tb === undefined || tb - ta < EPS) continue;
    const mid = (ta + tb) / 2;

    // Openings that actually pierce THIS band, left to right.
    const cutting = openings
      .filter((o) => o.t0 <= mid + EPS && o.t1 >= mid - EPS)
      .map((o) => ({
        l0: edgeAt(o.sLeft, o, ta),
        l1: edgeAt(o.sLeft, o, tb),
        r0: edgeAt(o.sRight, o, ta),
        r1: edgeAt(o.sRight, o, tb),
      }))
      .sort((a, b) => a.l0 - b.l0 || a.l1 - b.l1);

    // Walk the band left to right, emitting the solid runs between the openings.
    let s0 = 0;
    let s1 = 0;
    for (const c of cutting) {
      if (c.l0 - s0 > EPS || c.l1 - s1 > EPS) {
        out.push([
          facetPoint(facet, s0, ta),
          facetPoint(facet, c.l0, ta),
          facetPoint(facet, c.l1, tb),
          facetPoint(facet, s1, tb),
        ]);
      }
      s0 = Math.max(s0, c.r0);
      s1 = Math.max(s1, c.r1);
    }
    if (1 - s0 > EPS || 1 - s1 > EPS) {
      out.push([
        facetPoint(facet, s0, ta),
        facetPoint(facet, 1, ta),
        facetPoint(facet, 1, tb),
        facetPoint(facet, s1, tb),
      ]);
    }
  }
  return out;
}

/** The surfaces an opening exposes once it has depth. */
export interface Reveal {
  /** the wall's thickness in section — jamb, head and sill of the opening */
  jambs: Vec3[][];
  /** the glazing or door leaf, set back by the reveal depth */
  pane: Vec3[];
}

/**
 * The recessed surfaces of an opening.
 *
 * Four quads bridge the outer rim to the inner one; backface culling keeps only the
 * two a viewer can actually see into, which at this projection is one side jamb and
 * one of head-or-sill. That pair is the "painted trapezoid" ADR-0217 suspected — the
 * difference being that here it is real geometry in the right place, so it shades
 * under the same N·L as everything else and can never drift out of register with the
 * hole it lines.
 */
export function reveal(quad: ApertureQuad, depth: number): Reveal {
  const inward = scale3(quad.facet.normal, -Math.max(0, depth));
  const outer = quad.pts;
  const inner = outer.map((p) => add3(p, inward));
  const jambs: Vec3[][] = [];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const ia = inner[i];
    const ib = inner[(i + 1) % inner.length];
    // Every index is in range by construction (the successor wraps); the guard is what
    // makes that provable rather than merely true.
    if (a === undefined || b === undefined || ia === undefined || ib === undefined) continue;
    // Wound so the quad faces ACROSS the opening — the surface you see when the
    // camera is off to one side of it.
    jambs.push([a, ia, ib, b]);
  }
  return { jambs, pane: inner };
}
