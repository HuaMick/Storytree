// hero-kit.test.ts — the hero roster's contract: a shared sun, a committed bake that cannot
// silently go stale, and the placement contract the composition (inc 11) reads.
//
// The staleness gate mirrors kit.test.ts: `baked/kit.json`'s `heroes` array is generated but
// committed, so someone tunes the cottage, the gate stays green, and the island keeps drawing
// last week's cottage. Re-baking and comparing here turns that into a failing test with an
// obvious fix (`pnpm --filter @storytree/procedural-architecture bake`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HERO_KIT, bakeHeroKit, bakeHeroTreeVariants, HERO_TREE_STATUS_VARIANTS } from './hero-kit.js';
import { KIT_LIGHT_ANGLE } from './kit.js';
import type { BakedNode } from './bake.js';

const here = dirname(fileURLToPath(import.meta.url));
const assetPath = resolve(here, '..', 'baked', 'kit.json');

interface HeroShape { id: string; label: string; name: string; nodes: BakedNode[]; width: number; height: number; minX: number; minY: number }
interface Asset {
  note: string;
  entries: unknown[];
  heroes: HeroShape[];
  heroTreeVariants: (Omit<HeroShape, 'id' | 'label'> & { status: string })[];
}

const readAsset = (): Asset => JSON.parse(readFileSync(assetPath, 'utf8')) as Asset;

// ---------------------------------------------------------------------------
// the shared sun
// ---------------------------------------------------------------------------

test('every hero is lit from the island sun', () => {
  for (const e of HERO_KIT) {
    assert.equal(e.model().lightAngle, KIT_LIGHT_ANGLE, `${e.id} is lit from ${e.model().lightAngle}°, not the island's ${KIT_LIGHT_ANGLE}°`);
  }
});

test('the hero roster has distinct, stable ids', () => {
  const ids = HERO_KIT.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  // Inc 11 references these by name; a rename is a breaking change worth catching here.
  assert.deepEqual(ids, ['cottage', 'gazebo', 'autumn-tree', 'stepping-stone', 'forest-hut']);
});

// ---------------------------------------------------------------------------
// the staleness gate
// ---------------------------------------------------------------------------

test('the committed hero bake matches a fresh one', () => {
  const asset = readAsset();
  const fresh = bakeHeroKit();
  assert.ok(Array.isArray(asset.heroes), 'kit.json carries a `heroes` array — run `pnpm --filter @storytree/procedural-architecture bake`');
  assert.equal(asset.heroes.length, fresh.length, 'the hero roster changed without a re-bake — run `pnpm --filter @storytree/procedural-architecture bake`');
  for (const [i, f] of fresh.entries()) {
    const committed = asset.heroes[i];
    assert.ok(committed, `no committed bake for ${f.id}`);
    assert.equal(committed.id, f.id);
    assert.deepEqual(
      committed.nodes,
      f.nodes,
      `${f.id} has drifted from its committed bake — run \`pnpm --filter @storytree/procedural-architecture bake\``,
    );
    assert.equal(committed.width, f.width, `${f.id}: committed width is stale`);
    assert.equal(committed.height, f.height, `${f.id}: committed height is stale`);
  }
});

test('the committed heroes carry no world-space receipt', () => {
  for (const e of readAsset().heroes) {
    assert.ok(!('polys' in e), `${e.id} shipped its world-space polys`);
  }
});

test('every hero stands on the origin and reports a usable box', () => {
  for (const e of readAsset().heroes) {
    assert.ok(e.height > 0 && e.width > 0, `${e.id} has an empty box`);
    assert.ok(e.nodes.length > 0, `${e.id} baked to nothing`);
    assert.ok(Math.abs(e.minX + e.width / 2) < 0.01, `${e.id} is not centred on x=0`);
    assert.ok(Math.abs(e.minY + e.height) < 0.01, `${e.id} does not stand on y=0`);
  }
});

// ---------------------------------------------------------------------------
// the tree-spread's per-status crown colourways (ADR-0227, amends 0226/0221)
// ---------------------------------------------------------------------------

test('the committed tree colourways match a fresh bake', () => {
  const asset = readAsset();
  const fresh = bakeHeroTreeVariants();
  assert.ok(Array.isArray(asset.heroTreeVariants), 'kit.json carries a `heroTreeVariants` array — run `pnpm --filter @storytree/procedural-architecture bake`');
  assert.equal(asset.heroTreeVariants.length, fresh.length, 'the tree colourways changed without a re-bake — run `pnpm --filter @storytree/procedural-architecture bake`');
  for (const [i, f] of fresh.entries()) {
    const committed = asset.heroTreeVariants[i];
    assert.ok(committed, `no committed bake for the ${f.status} tree`);
    assert.equal(committed.status, f.status);
    assert.deepEqual(
      committed.nodes,
      f.nodes,
      `the ${f.status} tree has drifted from its committed bake — run \`pnpm --filter @storytree/procedural-architecture bake\``,
    );
  }
});

test('the colourways cover the status set with distinct crowns and one shared silhouette', () => {
  const variants = readAsset().heroTreeVariants;
  // every SceneStatus a story can carry has a variant (the surface falls back to `unknown` only for
  // an unrecognised status).
  const statuses = variants.map((v) => v.status).sort();
  assert.deepEqual(statuses, ['building', 'healthy', 'mapped', 'proposed', 'unhealthy', 'unknown']);
  assert.deepEqual(
    HERO_TREE_STATUS_VARIANTS.map((v) => v.status).sort(),
    statuses,
    'HERO_TREE_STATUS_VARIANTS and the baked set agree',
  );
  // ONE authored silhouette: every variant is byte-identical in GEOMETRY (define-once/reference-many),
  // differing only in the resolved crown fills — so the trunk/shadow stay put and only the crown recolours.
  const geom = (v: (typeof variants)[number]): string =>
    v.nodes.map((n) => `${n.el}|${'points' in n ? n.points : 'd' in n ? n.d : `${n.cx},${n.cy}`}`).join(';');
  assert.equal(new Set(variants.map(geom)).size, 1, 'the colourways share one silhouette');
  assert.equal(new Set(variants.map((v) => `${v.width}x${v.height}`)).size, 1, 'the colourways share one box');
  // the healthy crown is green and the unhealthy crown is red — different fill sets, honesty wall (only
  // a proven story wears green).
  const crownFills = (status: string): Set<string> => {
    const v = variants.find((x) => x.status === status);
    assert.ok(v, `${status} colourway present`);
    return new Set(v.nodes.map((n) => n.fill).filter((fRaw): fRaw is string => !!fRaw && fRaw !== '#000' && fRaw !== 'none'));
  };
  const green = crownFills('healthy');
  const red = crownFills('unhealthy');
  // no green crown fill leaks into the unhealthy tree, and vice-versa — the crowns are genuinely distinct.
  assert.equal([...green].some((c) => red.has(c) && c.startsWith('#4')), false);
  assert.ok([...green].some((c) => c.startsWith('#4') || c.startsWith('#5')), 'healthy wears a green canopy');
});
