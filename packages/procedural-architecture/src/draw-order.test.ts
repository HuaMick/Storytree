// draw-order.test.ts — station 3's red-green.
//
// The red these assert against is not hypothetical. Before this pass existed, the two
// shipped spike buildings carried 85 and 52 depth-order inversions respectively while
// `check()` returned [] on both — including the exact defect the swarm catalogued by
// hand in docs/research/forest-house-art/README.md: "the left sail blade draws behind
// the balcony railing where it should sweep in front".

import test from 'node:test';
import assert from 'node:assert/strict';

import { box, building, centroid, depthKey, faceNormal, facePoints, project, v3, add3, scale3, VIEW } from './procedural-utils.js';
import type { BuildingModel, Vec3 } from './procedural-utils.js';
import { findDepthConflicts, orderForPainter, viewOf } from './draw-order.js';
import { render, renderDetailed } from './render-svg.js';
import type { OrderPoly } from './draw-order.js';
import { forestWindmill } from './buildings/forest-windmill.js';
import { mushroomDwelling } from './buildings/mushroom-dwelling.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Every camera-facing, non-floor face of a model — what a renderer actually draws. */
function visibleFaces(model: BuildingModel): OrderPoly<string>[] {
  const out: OrderPoly<string>[] = [];
  for (const part of model.parts) {
    part.shape.faces.forEach((face, fi) => {
      if (face.kind === 'floor') return;
      const pts = facePoints(part.world, face);
      const n = faceNormal(pts);
      if (n.x + n.y + n.z <= 0.0001) return; // backface cull, as render-svg does
      out.push({ pts, meta: `${part.id}#${fi}` });
    });
  }
  return out;
}

/** The order station 3 replaces: each polygon sorted by its own centroid's depth. */
const centroidOrder = <M>(polys: readonly OrderPoly<M>[]): OrderPoly<M>[] =>
  [...polys].sort((a, b) => depthKey(centroid(a.pts)) - depthKey(centroid(b.pts)));

/** Two quads that pierce each other at right angles — the irreducible case.
 *  Neither is wholly in front: each is nearer on one side of the crossing line, so
 *  NO order over the two whole quads can be right. Only splitting them can be. */
const PIERCING: OrderPoly<string>[] = [
  { pts: [v3(-6, 0, 2), v3(6, 0, 2), v3(6, 0, 8), v3(-6, 0, 8)], meta: 'blade' },
  { pts: [v3(0, -6, 2), v3(0, 6, 2), v3(0, 6, 8), v3(0, -6, 8)], meta: 'rail' },
];

// ---------------------------------------------------------------------------
// the view basis
// ---------------------------------------------------------------------------

test('project() is orthographic along VIEW — the basis this whole file rests on', () => {
  // Sliding a point along the view axis must not move it on screen. If this ever
  // stops holding, `viewOf`'s w is no longer a depth and every ordering below is void.
  for (const p of [v3(3, -4, 5), v3(-11, 2, 0.5), v3(0, 0, 0)]) {
    const base = project(p);
    for (const t of [1, -3, 17.5]) {
      const slid = project(add3(p, scale3(VIEW, t)));
      assert.ok(Math.abs(slid.x - base.x) < 1e-9, 'screen x is invariant along VIEW');
      assert.ok(Math.abs(slid.y - base.y) < 1e-9, 'screen y is invariant along VIEW');
    }
  }
});

test('viewOf agrees with project(), and w grows toward the camera', () => {
  const p = v3(2, -3, 4);
  const v = viewOf(p);
  const s = project(p);
  assert.ok(Math.abs(v.u - s.x) < 1e-9);
  assert.ok(Math.abs(v.v - s.y) < 1e-9);
  assert.ok(viewOf(add3(p, VIEW)).w > v.w, 'moving toward the camera raises w');
});

// ---------------------------------------------------------------------------
// the irreducible case
// ---------------------------------------------------------------------------

test('RED: centroid sorting cannot order two piercing quads', () => {
  const conflicts = findDepthConflicts(centroidOrder(PIERCING));
  assert.ok(conflicts.length > 0, 'a centroid sort paints one of them wrongly on top');
});

test('GREEN: the draw-order pass splits them and the inversion is gone', () => {
  const { polys, stats } = orderForPainter(PIERCING);
  assert.ok(stats.splits > 0, 'the pass had to split — this is not a re-sort');
  assert.ok(stats.output > stats.input, 'splitting produced fragments');
  assert.deepEqual(findDepthConflicts(polys), []);
});

test('both quads survive splitting — no fragment is silently dropped', () => {
  const { polys } = orderForPainter(PIERCING);
  assert.ok(polys.some((p) => p.meta === 'blade'), 'the blade still draws');
  assert.ok(polys.some((p) => p.meta === 'rail'), 'the rail still draws');
});

// ---------------------------------------------------------------------------
// the real buildings
// ---------------------------------------------------------------------------

for (const [label, build] of [
  ['forest-windmill', forestWindmill],
  ['mushroom-dwelling', mushroomDwelling],
] as const) {
  test(`RED: ${label} carries depth inversions under a centroid sort`, () => {
    const conflicts = findDepthConflicts(centroidOrder(visibleFaces(build())));
    assert.ok(
      conflicts.length > 0,
      `${label} is the evidence this station exists for — it must still reproduce the defect`,
    );
  });

  test(`GREEN: ${label} has no depth inversion after the draw-order pass`, () => {
    const { polys } = orderForPainter(visibleFaces(build()));
    const conflicts = findDepthConflicts(polys);
    assert.deepEqual(
      conflicts.map((c) => `${polys[c.later]?.meta} over ${polys[c.earlier]?.meta}`),
      [],
    );
  });
}

test('the windmill sail blade sweeps IN FRONT of the balcony railing', () => {
  // The named defect from the swarm's own catalogue, asserted directly rather than
  // only via the aggregate count — so a future regression reads as this sentence.
  const polys = visibleFaces(forestWindmill());
  const before = findDepthConflicts(centroidOrder(polys));
  const naive = centroidOrder(polys);
  const named = before.filter((c) => {
    const later = naive[c.later]?.meta ?? '';
    const earlier = naive[c.earlier]?.meta ?? '';
    return later.startsWith('gallery-rail') && earlier.startsWith('sail-');
  });
  assert.ok(named.length > 0, 'the centroid sort paints the railing over a sail');

  const { polys: fixed } = orderForPainter(polys);
  assert.deepEqual(findDepthConflicts(fixed), []);
});

// ---------------------------------------------------------------------------
// determinism and cost
// ---------------------------------------------------------------------------

test('the pass is deterministic — same model, byte-identical order', () => {
  // The prove-it-gate needs a reproducible verdict (arc increment 1, owner call), so
  // every tie-break in the splitter chooser is on a stable sequence number.
  const key = (polys: OrderPoly<string>[]): string =>
    polys.map((p) => `${p.meta}:${p.pts.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)},${q.z.toFixed(6)}`).join('|')}`).join('\n');
  const a = orderForPainter(visibleFaces(forestWindmill()));
  const b = orderForPainter(visibleFaces(forestWindmill()));
  assert.equal(key(a.polys), key(b.polys));
  assert.deepEqual(a.stats, b.stats);
});

test('split inflation stays inside ADR-0069 headroom', () => {
  // ADR-0069 puts comfort at ~1,000-3,000 SVG nodes and pain at ~3,000-5,000. A
  // building is one object among many, so the guard is deliberately tighter than the
  // ceiling: this fails loudly if a change starts shredding geometry.
  for (const build of [forestWindmill, mushroomDwelling]) {
    const { stats } = orderForPainter(visibleFaces(build()));
    assert.ok(
      stats.output <= stats.input * 3,
      `${stats.input} -> ${stats.output} fragments is more than 3x inflation`,
    );
    assert.ok(stats.output < 1200, `${stats.output} fragments for one building crowds the node ceiling`);
  }
});

test('an empty or degenerate input orders without throwing', () => {
  assert.deepEqual(orderForPainter([]).polys, []);
  const degenerate: OrderPoly<string>[] = [{ pts: [v3(0, 0, 0), v3(1, 1, 1), v3(2, 2, 2)], meta: 'line' }];
  assert.doesNotThrow(() => orderForPainter(degenerate));
});

test('a single convex solid needs no splitting at all', () => {
  // The pass must not tax geometry that was already fine — a lone box's visible faces
  // meet only at edges, so BEST_ROOT should find planes that split nothing.
  const model = forestWindmill({ bladeCount: 3 });
  const one = visibleFaces(model).filter((p) => p.meta.startsWith('footing#'));
  const { stats } = orderForPainter(one);
  assert.equal(stats.splits, 0);
  assert.equal(stats.output, stats.input);
});

// ---------------------------------------------------------------------------
// splitting must be INVISIBLE
// ---------------------------------------------------------------------------

test('a cut edge is marked as not-an-outline, and inherited edges survive', () => {
  const { polys } = orderForPainter(PIERCING);
  const cut = polys.filter((p) => p.edges?.some((e) => !e) === true);
  assert.ok(cut.length > 0, 'splitting produced fragments carrying a cut edge');
  for (const frag of cut) {
    assert.equal(frag.edges?.length, frag.pts.length, 'one flag per edge');
    assert.ok(frag.edges?.some((e) => e), 'a fragment still inherits real outline to draw');
  }
});

test('the renderer closes a seam rather than outlining it', () => {
  // THE REGRESSION THIS EXISTS FOR: the first build of station 3 split the mushroom
  // dwelling's door into four fragments, each of which dutifully stroked its own cut
  // edges — painting a large dark X across the door. Splitting geometry to fix depth
  // order is worthless if the split itself is visible.
  const b = building({ name: 'seam', style: 'timber' });
  b.add('wall', box({ w: 14, d: 12, h: 9 }), { ground: true });
  b.add('beam', box({ w: 26, d: 1.2, h: 1.2 }), { ground: true, at: { dy: 5 } });
  const model = b.model();

  const detail = renderDetailed(model, { showGround: false });
  assert.ok(
    detail.polys.some((p) => p.edges?.some((e) => !e) === true),
    'this model really does force a split',
  );

  const svg = render(model, { showGround: false });
  // A fragment's fill is stroked in its OWN colour, so two fragments meeting along a
  // cut composite without the pale hairline SVG antialiasing would otherwise leave.
  assert.ok(
    /<polygon points="[^"]*" fill="(#[0-9a-f]{6})" stroke="\1"/.test(svg),
    'a split fragment is stroked in its own fill colour',
  );
  // What outline it does draw arrives as a separate stroke-only path over the edges it
  // inherited — never around the whole fragment.
  assert.ok(/<path d="[^"]*" fill="none" stroke="#[0-9a-f]{6}"/.test(svg), 'inherited edges are traced separately');
});

test('an unsplit polygon still draws as one stroked node', () => {
  // The cheap path must stay cheap: the overwhelming majority of faces are never cut,
  // and they must not pay two SVG nodes for the privilege.
  const b = building({ name: 'plain' });
  b.add('c', box({ w: 6, d: 6, h: 6 }), { ground: true });
  const svg = render(b.model(), { showGround: false });
  assert.equal(svg.split('<polygon').length - 1, 3, 'three visible faces, three nodes');
  assert.ok(!svg.includes('fill="none"'), 'nothing needed a separate outline pass');
});

test('the oracle only reports what a viewer could see', () => {
  // Two coplanar, non-overlapping quads can be drawn in either order.
  const flat: OrderPoly<string>[] = [
    { pts: [v3(0, 0, 0), v3(2, 0, 0), v3(2, 0, 2), v3(0, 0, 2)], meta: 'left' },
    { pts: [v3(5, 0, 0), v3(7, 0, 0), v3(7, 0, 2), v3(5, 0, 2)], meta: 'right' },
  ];
  assert.deepEqual(findDepthConflicts(flat), []);
  assert.deepEqual(findDepthConflicts([...flat].reverse()), []);
});
