// The standing stone's contract: physically sound, deterministic, cheap, lit by the island's
// shared sun, and a committed asset that cannot quietly go stale (ADR-0218).
//
// The drift gate mirrors the kit's: `baked/stone.json` is generated but committed, a shape
// that rots silently — tune the model, the gate stays green, the map keeps drawing last
// week's stone. Re-baking and comparing turns that into a failing test with an obvious fix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { standingStone, bakeStone, STONE_DEF_ID, DEFAULTS } from './standing-stone.js';
import { check } from '../invariants.js';
import { KIT_LIGHT_ANGLE } from '../kit.js';
import type { BakedStone } from './standing-stone.js';

const here = dirname(fileURLToPath(import.meta.url));
const assetPath = resolve(here, '..', '..', 'baked', 'stone.json');

interface Asset {
  note: string;
  stone: BakedStone;
}

const readAsset = (): Asset => JSON.parse(readFileSync(assetPath, 'utf8')) as Asset;

// ---------------------------------------------------------------------------
// the model: sound, and lit by the shared sun
// ---------------------------------------------------------------------------

test('the standing stone is physically sound at its defaults', () => {
  assert.deepEqual(check(standingStone()), []);
});

test('the standing stone is sound across its parameter space', () => {
  for (const height of [30, 40, 50]) {
    for (const baseRadius of [7, 9.5, 12]) {
      for (const topScale of [0.5, 0.66, 0.85]) {
        for (const sides of [4, 5, 6]) {
          const v = check(standingStone({ height, baseRadius, topScale, sides }));
          assert.deepEqual(v, [], `sound check failed for ${JSON.stringify({ height, baseRadius, topScale, sides })}: ${JSON.stringify(v)}`);
        }
      }
    }
  }
});

test('the baked stone is lit from the island sun by default', () => {
  // The DEFAULT ships at the shared angle so a solo bake matches the island; composition
  // could still override it, but the two must not disagree by construction.
  assert.equal(DEFAULTS.light_angle, KIT_LIGHT_ANGLE);
});

// ---------------------------------------------------------------------------
// the bake: cheap, deterministic, a real solid
// ---------------------------------------------------------------------------

test('the stone bakes to a real isometric solid, not a flat card', () => {
  const baked = bakeStone();
  // A corner-to-camera tapered slab shows two flanking walls + the top cap — three faces,
  // each a distinct N·L, which is the two-tone-plus-cap read that makes it look solid.
  assert.ok(baked.nodes.length >= 3, `baked to only ${baked.nodes.length} nodes`);
  const fills = new Set(baked.nodes.map((n) => n.fill));
  assert.ok(fills.size >= 3, 'the facets did not separate by shading — it will read flat');
});

test('the stone is CHEAP — one def, referenced many, must stay far under the building cost', () => {
  // A stone is far simpler than a building (~1,400 nodes). It is the def every marker `<use>`s,
  // so its own cost barely matters, but a regression here (an accidental split explosion) is
  // worth catching: it should stay a couple dozen nodes at most.
  assert.ok(bakeStone().nodes.length < 40, `the stone baked to ${bakeStone().nodes.length} nodes — the slab should be a handful`);
});

test('the bake is deterministic', () => {
  assert.deepEqual(bakeStone().nodes, bakeStone().nodes);
});

test('the baked stone stands on the origin (the placement contract)', () => {
  const b = bakeStone();
  assert.ok(Math.abs(b.minX + b.width / 2) < 0.01, 'not centred on x=0');
  assert.ok(Math.abs(b.minY + b.height) < 0.01, 'does not stand on y=0');
  assert.equal(b.id, STONE_DEF_ID);
});

// ---------------------------------------------------------------------------
// the staleness gate
// ---------------------------------------------------------------------------

test('the committed bake matches a fresh one', () => {
  const asset = readAsset();
  const fresh = bakeStone();
  assert.equal(asset.stone.id, fresh.id);
  assert.deepEqual(
    asset.stone.nodes,
    fresh.nodes,
    'the stone has drifted from its committed bake — run `pnpm --filter @storytree/procedural-architecture bake`',
  );
  assert.equal(asset.stone.width, fresh.width, 'committed width is stale');
  assert.equal(asset.stone.height, fresh.height, 'committed height is stale');
});

test('the committed asset carries no world-space receipt', () => {
  assert.ok(!('polys' in readAsset().stone), 'the stone shipped its world-space polys');
});
