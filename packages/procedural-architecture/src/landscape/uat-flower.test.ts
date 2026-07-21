// uat-flower.test.ts — the grounded UAT-marker flower's contract (grounded-art inc 14):
// physically sound in every verdict state, deterministic, and deliberately restrained in node
// count (a marker is drawn once per criterion, so a regression toward a busy solid would bite the
// map). Covered by the art-factory story's landscape-factory observe gate (landscape/*.test.ts).

import test from 'node:test';
import assert from 'node:assert/strict';

import { check } from '../invariants.js';
import { renderDetailed } from '../render-svg.js';
import { findDepthConflicts } from '../draw-order.js';
import { THEMES } from '../bake.js';
import { uatFlower, FLOWER_STATES, expectedFlowerPartCount, DEFAULTS } from './uat-flower.js';

test('every verdict state is physically sound and draws cleanly', () => {
  for (const state of FLOWER_STATES) {
    const model = uatFlower({ state });
    assert.deepEqual(check(model), [], `${state} is unsound`);
    const detail = renderDetailed(model, { showGround: false, theme: 'flower' });
    assert.deepEqual(findDepthConflicts(detail.polys), [], `${state} has depth conflicts`);
    assert.ok(!/NaN|Infinity/.test(detail.svg), `${state} has degenerate coordinates`);
    assert.equal(model.parts.length, expectedFlowerPartCount(state), `${state} part count drifted`);
  }
});

test('the flower stays sound across its parameter space', () => {
  for (const state of FLOWER_STATES) {
    for (const stemHeight of [7, 11, 16]) {
      for (const headRadius of [1.1, 1.55, 2.4]) {
        for (const petals of [6, 8, 10]) {
          const params = { state, stemHeight, headRadius, petals } as const;
          assert.deepEqual(check(uatFlower(params)), [], `unsound at ${JSON.stringify(params)}`);
        }
      }
    }
  }
});

test('each state reads as its own silhouette — the bud is much lighter than a bloom', () => {
  const nodesFor = (state: (typeof FLOWER_STATES)[number]): number =>
    (renderDetailed(uatFlower({ state }), { showGround: false, theme: 'flower' }).svg.match(
      /<(polygon|path|ellipse)/g,
    ) ?? []).length;
  const proven = nodesFor('proven');
  const pending = nodesFor('pending');
  // A closed bud has no petal ring, so it is far cheaper than a full bloom — the states are
  // genuinely different geometry, not a recolour.
  assert.ok(pending < proven / 3, `the bud (${pending}) should be far lighter than the bloom (${proven})`);
  // The bloom stays a marker, not a busy solid: a regression that explodes the split count fails here.
  assert.ok(proven < 1100, `the proven bloom baked to ${proven} nodes — a marker should stay soft, not busy`);
});

test('the flower is deterministic — same parameters, byte-identical SVG', () => {
  for (const state of FLOWER_STATES) {
    assert.equal(
      renderDetailed(uatFlower({ state }), { theme: 'flower' }).svg,
      renderDetailed(uatFlower({ state }), { theme: 'flower' }).svg,
      `${state} is not deterministic`,
    );
  }
});

test('the shipped defaults + theme are the ones under test', () => {
  assert.equal(DEFAULTS.style_theme, 'flower');
  assert.equal(DEFAULTS.state, 'proven');
  assert.ok('flower' in THEMES, 'the flower theme must ship');
  // the owner-attested `--flower-*` bloom colours are carried by the theme (cream petal, gold centre).
  const flower = THEMES.flower as Record<string, string>;
  assert.equal(flower['petal-proven'], '#fbf3e0');
  assert.equal(flower['center-proven'], '#eab94e');
});
