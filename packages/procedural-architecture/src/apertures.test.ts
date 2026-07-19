// apertures.test.ts — an opening is a hole, and a hole has depth.
//
// ADR-0217 left one question open and named it the first thing the building factory
// should test: whether an aperture cut as a compound path reads acceptably where a
// wall's thickness should show as a reveal. These are the properties that answer it —
// the LOOK verdict is the owner's (ADR-0070 stage 2), but "is it actually a hole with
// a recessed pane and correctly-facing jambs" is machine-checkable, and here it is.

import test from 'node:test';
import assert from 'node:assert/strict';

import { apertureQuad, box, building, dot3, faceNormal, frustum, gable, sub3, VIEW } from './procedural-utils.js';
import type { Facet, Vec3 } from './procedural-utils.js';
import { facadeStrips, openingOf, reveal } from './apertures.js';
import { check } from './invariants.js';
import { render, renderDetailed } from './render-svg.js';
import { findDepthConflicts, viewOf } from './draw-order.js';

/** Area of a planar polygon in 3D, by Newell's method. */
function area(pts: readonly Vec3[]): number {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a === undefined || b === undefined) continue;
    nx += a.y * b.z - a.z * b.y;
    ny += a.z * b.x - a.x * b.z;
    nz += a.x * b.y - a.y * b.x;
  }
  return Math.hypot(nx, ny, nz) / 2;
}

const facetOf = (shapeFacets: readonly Facet[], i: number): Facet => {
  const f = shapeFacets[i];
  if (f === undefined) throw new Error(`no facet ${i}`);
  return f;
};

function cottage(revealDepth = 0.34) {
  const b = building({ name: 'cottage', style: 'timber' });
  b.add('walls', box({ w: 14, d: 12, h: 9 }), { ground: true });
  b.add('roof', gable({ w: 14, d: 12, h: 5 }), { on: 'walls' });
  b.aperture('door', { host: 'walls', facet: 0, cu: 0, sill: 0, w: 3, h: 5, kind: 'door', reveal: revealDepth });
  b.aperture('w1', { host: 'walls', facet: 1, cu: -3.2, sill: 3.6, w: 2.6, h: 2.6, reveal: revealDepth });
  b.aperture('w2', { host: 'walls', facet: 1, cu: 3.2, sill: 3.6, w: 2.6, h: 2.6, reveal: revealDepth });
  return b.model();
}

// ---------------------------------------------------------------------------
// the facade is genuinely cut
// ---------------------------------------------------------------------------

test('a pierced wall renders as ONE compound path, not a patchwork', () => {
  // Subdividing the facade into strips would work geometrically and wreck the look:
  // every cut leaves a stroked seam across the wall. The hole stays a hole.
  const svg = render(cottage(), { showGround: false });
  const paths = svg.match(/<path [^>]*fill-rule="evenodd"/g) ?? [];
  assert.equal(paths.length, 2, 'one path per pierced facet — the door wall and the window wall');
  // The window wall carries two openings, so its path has three subpaths.
  const windowWall = (svg.match(/<path d="([^"]*)" fill-rule="evenodd"/g) ?? [])
    .map((p) => (p.match(/M/g) ?? []).length)
    .sort((a, b) => b - a);
  assert.deepEqual(windowWall, [3, 2], 'two holes in one wall, one in the other');
});

test('facade strips tile exactly the solid part of a facet', () => {
  // The strips are the fallback the ordering pass explodes a wall into. If they did
  // not conserve area the wall would gain or lose material the moment it was split.
  const b = building({ name: 'strip' });
  b.add('w', box({ w: 14, d: 12, h: 9 }), { ground: true });
  b.aperture('a', { host: 'w', facet: 1, cu: -3.2, sill: 3.6, w: 2.6, h: 2.6 });
  b.aperture('c', { host: 'w', facet: 1, cu: 3.2, sill: 3.6, w: 2.6, h: 2.6 });
  const model = b.model();
  const part = model.parts[0];
  assert.ok(part);
  const facet = facetOf(part.worldFacets, 1);
  const quads = model.apertures.map((ap) => apertureQuad(model, ap)).filter((q) => q !== null);
  const openings = model.apertures.map((ap, i) => {
    const q = quads[i];
    assert.ok(q);
    return openingOf(ap, q);
  });

  const facetArea = area([facet.bl, facet.br, facet.tr, facet.tl]);
  const holeArea = quads.reduce((s, q) => s + area(q.pts), 0);
  const stripArea = facadeStrips(facet, openings).reduce((s, p) => s + area(p), 0);
  assert.ok(Math.abs(stripArea - (facetArea - holeArea)) < 1e-6, `${stripArea} vs ${facetArea - holeArea}`);
});

test('an unpierced facet is left alone entirely', () => {
  const b = building({ name: 'plain' });
  b.add('w', box({ w: 10, d: 10, h: 8 }), { ground: true });
  const facet = facetOf(b.part('w').worldFacets, 0);
  const strips = facadeStrips(facet, []);
  assert.equal(strips.length, 1, 'no openings, no subdivision');
  assert.ok(Math.abs(area(strips[0] ?? []) - area([facet.bl, facet.br, facet.tr, facet.tl])) < 1e-9);
});

// ---------------------------------------------------------------------------
// the hole has depth
// ---------------------------------------------------------------------------

test('the pane sits BEHIND the wall it is set into', () => {
  const model = cottage(0.34);
  for (const ap of model.apertures) {
    const q = apertureQuad(model, ap);
    assert.ok(q);
    const { pane } = reveal(q, ap.reveal);
    for (let i = 0; i < pane.length; i++) {
      const outer = q.pts[i];
      const inner = pane[i];
      assert.ok(outer && inner);
      // Behind means further along the wall's own inward normal, not merely different.
      const along = dot3(sub3(inner, outer), q.facet.normal);
      assert.ok(along < -0.3, `${ap.id} corner ${i} is set back by ${(-along).toFixed(2)}`);
    }
  }
});

test('reveal 0 collapses the jambs rather than inverting them', () => {
  const model = cottage(0);
  const ap = model.apertures[0];
  assert.ok(ap);
  const q = apertureQuad(model, ap);
  assert.ok(q);
  const { jambs, pane } = reveal(q, 0);
  assert.equal(jambs.length, 4);
  for (const j of jambs) assert.ok(area(j) < 1e-9, 'a flush opening has no thickness to show');
  assert.ok(Math.abs(area(pane) - area(q.pts)) < 1e-9);
});

test('the visible jambs are the ones facing the camera, and there are some', () => {
  // If the jamb winding were inverted the surviving quads would be the far side of the
  // opening, and the window would read EMBOSSED rather than recessed — the exact kind
  // of mirror-image bug an eye slides past.
  const model = cottage(0.34);
  let sawAny = false;
  for (const ap of model.apertures) {
    const q = apertureQuad(model, ap);
    assert.ok(q);
    const { jambs } = reveal(q, ap.reveal);
    const facing = jambs.filter((j) => dot3(faceNormal(j), VIEW) > 0.0001);
    assert.ok(facing.length >= 1 && facing.length <= 3, `${ap.id}: ${facing.length} jambs face the camera`);
    for (const j of facing) {
      // A camera-facing jamb must look ACROSS the opening, not out of the wall — its
      // normal is perpendicular to the facet's.
      assert.ok(Math.abs(dot3(faceNormal(j), q.facet.normal)) < 1e-6, 'a jamb is square to its wall');
      sawAny = true;
    }
  }
  assert.ok(sawAny);
});

test('a recessed pane is drawn BEFORE the wall that frames it', () => {
  // The old renderer had to override the depth sort so a door would not vanish behind
  // its own wall. With a real hole the ordering is simply true: the pane is further
  // away, it paints first, and the hole is what lets it show.
  const detail = renderDetailed(cottage(0.34), { showGround: false });
  const wallAt = detail.polys.findIndex((p) => (p.holes?.length ?? 0) > 0);
  assert.ok(wallAt >= 0, 'a pierced wall survived the ordering pass with its holes intact');

  const wall = detail.polys[wallAt];
  assert.ok(wall);

  // Find THIS wall's own apertures and check each pane is both genuinely behind the
  // wall and painted before it. (Painter's correctness only ever constrains polygons
  // that overlap — `findDepthConflicts` is what holds the whole order to account.)
  const model = cottage(0.34);
  const key = (pts: readonly { x: number; y: number; z: number }[]): string =>
    pts.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`).join(';');
  const wallHoles = new Set((wall.holes ?? []).map(key));

  let checked = 0;
  for (const ap of model.apertures) {
    const q = apertureQuad(model, ap);
    assert.ok(q);
    if (!wallHoles.has(key(q.pts))) continue;
    const pane = reveal(q, ap.reveal).pane;
    const paneAt = detail.polys.findIndex((p) => key(p.pts) === key(pane));
    assert.ok(paneAt >= 0, `${ap.id}'s pane is drawn`);
    assert.ok(paneAt < wallAt, `${ap.id}'s pane paints before the wall it shows through`);
    const paneDepth = pane.reduce((s, p) => s + viewOf(p).w, 0) / pane.length;
    const rimDepth = q.pts.reduce((s, p) => s + viewOf(p).w, 0) / q.pts.length;
    assert.ok(paneDepth < rimDepth, `${ap.id}'s pane is further from the camera than its opening`);
    checked++;
  }
  assert.ok(checked > 0, 'at least one aperture belongs to the wall that kept its holes');
});

// ---------------------------------------------------------------------------
// it composes with station 3
// ---------------------------------------------------------------------------

test('cut apertures need no help from the draw-order pass', () => {
  for (const depth of [0, 0.18, 0.34, 0.7]) {
    const model = cottage(depth);
    assert.deepEqual(check(model), [], `reveal ${depth} is physically sound`);
    const detail = renderDetailed(model, { showGround: false });
    assert.deepEqual(findDepthConflicts(detail.polys), [], `reveal ${depth} orders cleanly`);
  }
});

test('a pierced wall that must be split falls back to strips and stays correct', () => {
  // The one case a compound path cannot survive: something interpenetrates the wall,
  // and a ring with a hole in it cannot be cut by a plane and stay a ring.
  const b = building({ name: 'pierced', style: 'timber' });
  b.add('walls', box({ w: 14, d: 12, h: 9 }), { ground: true });
  b.aperture('w1', { host: 'walls', facet: 1, cu: 0, sill: 3.6, w: 2.6, h: 2.6 });
  // A beam driven straight through the wall plane.
  b.add('beam', box({ w: 26, d: 1.2, h: 1.2 }), { ground: true, at: { dy: 5 }, dz: 0 });
  b.add('post', box({ w: 1.2, d: 1.2, h: 6 }), { ground: true, at: { dx: 0, dy: 6 } });
  const model = b.model();
  const detail = renderDetailed(model, { showGround: false });
  assert.deepEqual(findDepthConflicts(detail.polys), [], 'the split wall still orders honestly');
  assert.ok(detail.order.splits > 0, 'this case really did force splitting');
});

test('a tapered facet hosts a hole that follows the taper', () => {
  const b = building({ name: 'tower', style: 'concrete' });
  b.add('t', frustum({ sides: 8, r0: 7, r1: 5.6, h: 16 }), { ground: true });
  b.aperture('a', { host: 't', facet: 0, cu: 0, sill: 6.5, w: 2.4, h: 2.6 });
  const model = b.model();
  assert.deepEqual(check(model), []);
  const q = apertureQuad(model, model.apertures[0] as never);
  assert.ok(q);
  const bottomWidth = Math.hypot(q.pts[1].x - q.pts[0].x, q.pts[1].y - q.pts[0].y, q.pts[1].z - q.pts[0].z);
  const topWidth = Math.hypot(q.pts[2].x - q.pts[3].x, q.pts[2].y - q.pts[3].y, q.pts[2].z - q.pts[3].z);
  assert.ok(Math.abs(bottomWidth - topWidth) < 1e-9, 'the opening keeps its declared width up a taper');
  const detail = renderDetailed(model, { showGround: false });
  assert.deepEqual(findDepthConflicts(detail.polys), []);
});

test('the emitted markup is clean and the opening is a real hole', () => {
  const b = building({ name: 'smoke' });
  b.add('w', box({ w: 8, d: 8, h: 8 }), { ground: true });
  b.aperture('d', { host: 'w', facet: 0, cu: 0, sill: 0, w: 2, h: 4, kind: 'door' });
  const svg = render(b.model());
  assert.ok(!/NaN|Infinity|undefined/.test(svg), 'no degenerate output');
  assert.ok(svg.includes('fill-rule="evenodd"'), 'the opening is a real hole');
});
