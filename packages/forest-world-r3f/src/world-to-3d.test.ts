// world-to-3d.test.ts — ADR-0123 THIRD forest-world mapper: node:test-provable
// descriptor mapping (scene semantic layer → typed 3D instance descriptors).
//
// The import of `./world-to-3d.js` is the RED anchor: the module does not exist
// yet. All tests fail with a "Cannot find module" error — the RIGHT-kind red
// (missing implementation, not a syntax error in the test).
//
// When the implementation lands, these tests pin:
//   • core kind-family mapping: tile hex ground → hex-ground, story tree →
//     story-tree, road → road-strip, in-flight wisp → wisp-sprite
//   • total coverage: non-core / structural SceneKinds yield an explicit
//     { kind: 'skipped', sceneKind: string } — never a throw, never a silent drop
//   • material variant flows from the territory's folded SceneStatus
//   • all instance descriptors carry a 3D transform { x, y, z } and an instancing
//     group string
//   • determinism: same scene → byte-identical descriptor array
//
// The fixtures use a real buildScene over @storytree/forest-world's SceneInput
// contract — not hand-rolled scene shapes — exercising the mapper end-to-end
// against the real core (ADR-0123 provability firewall).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScene,
  hexCenter,
  type SceneG,
  type SceneInput,
  type SceneKind,
  type SceneTerritoryInput,
} from '@storytree/forest-world';

import {
  worldTo3D,
  type Descriptor3D,
  type InstanceDescriptor,
  type SkippedDescriptor,
} from './world-to-3d.js';

// ---------------------------------------------------------------------------
// fixtures — real SceneInput, not a hand-rolled scene shape
// ---------------------------------------------------------------------------

function mkTerritory(over: Partial<SceneTerritoryInput> = {}): SceneTerritoryInput {
  return {
    id: 'library',
    status: 'healthy',
    caps: 3,
    centroid: { x: 100, y: 200 },
    radius: 60,
    treeSpot: { x: 100, y: 190 },
    labelY: 260,
    coastPaths: [],
    decor: [],
    plants: [],
    treeTitle: 'library — healthy',
    wisps: [],
    plate: {
      w: 120,
      h: 33,
      rx: 7,
      idY: 14,
      subY: 27,
      idText: 'library',
      subText: 'healthy · 3 caps',
      title: 'The library',
    },
    ...over,
  };
}

/** Classic hex-ground mode (relaxedCells: null) so the scene contains `tile`
 *  groups — the ground family the mapper must classify as hex-ground. */
function mkInput(over: Partial<SceneInput> = {}): SceneInput {
  return {
    offset: { x: 0, y: 0 },
    width: 1200,
    height: 900,
    empties: [],
    relaxedCells: null,
    drawTiles: [
      { h: { q: 0, r: 0 }, owner: 0 },
      { h: { q: 1, r: 0 }, owner: 0 },
    ],
    wheatSets: [new Set()],
    roads: [
      { from: 'library', to: 'cli', d: 'M 0 0 L 100 100', title: 'cli depends on library' },
    ],
    territories: [mkTerritory()],
    ...over,
  };
}

// type-guard helpers — TypeScript narrows through the discriminated union
const asInstance = (d: Descriptor3D): d is InstanceDescriptor => d.kind !== 'skipped';
const asSkipped = (d: Descriptor3D): d is SkippedDescriptor => d.kind === 'skipped';

/** Positional tolerance: the core rounds path coords to 0.1 (`toFixed(1)`), so a
 *  vertex-centroid recovery of a baked centre lands within ~0.05 per axis. */
const closeTo = (got: number, want: number, msg: string): void =>
  assert.ok(Math.abs(got - want) < 0.15, `${msg} (got ${got}, want ~${want})`);

// ---------------------------------------------------------------------------
// contract: r3f-mapping-is-deterministic
// ---------------------------------------------------------------------------

test('r3f-mapping-is-deterministic: same scene → deep-equal descriptor arrays, stable ordering', () => {
  const scene = buildScene(mkInput());
  assert.deepEqual(worldTo3D(scene), worldTo3D(scene));
  // A fresh scene from the same input maps identically too — the core's determinism
  // carried through the mapper end-to-end.
  assert.deepEqual(worldTo3D(buildScene(mkInput())), worldTo3D(scene));
});

// ---------------------------------------------------------------------------
// contract: r3f-semantic-layer-maps-faithfully
// ---------------------------------------------------------------------------

test('r3f-semantic-layer-maps-faithfully: kind → mesh family, position → transform, status → variant', () => {
  const scene = buildScene(
    mkInput({
      territories: [mkTerritory({ wisps: [{ runId: 'r1', title: 'building unit-a' }] })],
    }),
  );
  const descs = worldTo3D(scene);

  // kind family → typed descriptor branch, transforms derived from the World geometry:
  // each hex-ground sits at ITS baked hex centre (distinct per tile, never collapsed).
  const grounds = descs.filter((d): d is InstanceDescriptor => d.kind === 'hex-ground');
  assert.equal(grounds.length, 2, 'one hex-ground per draw tile');
  const c0 = hexCenter({ q: 0, r: 0 });
  const c1 = hexCenter({ q: 1, r: 0 });
  closeTo(grounds[0]!.transform.x, c0.x, 'tile 0 x from its hex centre');
  closeTo(grounds[0]!.transform.z, c0.y, 'tile 0 z from its hex centre');
  closeTo(grounds[1]!.transform.x, c1.x, 'tile 1 x from its hex centre');
  closeTo(grounds[1]!.transform.z, c1.y, 'tile 1 z from its hex centre');
  assert.notDeepEqual(grounds[0]!.transform, grounds[1]!.transform, 'tiles do not collapse');

  // the story tree stands at its territory's treeSpot.
  const trees = descs.filter((d): d is InstanceDescriptor => d.kind === 'story-tree');
  assert.equal(trees.length, 1, 'one story-tree per territory');
  closeTo(trees[0]!.transform.x, 100, 'tree x = treeSpot.x');
  closeTo(trees[0]!.transform.z, 190, 'tree z = treeSpot.y');

  // the road carries its routed polyline on the ground plane, anchored at its centroid.
  const roads = descs.filter((d): d is InstanceDescriptor => d.kind === 'road-strip');
  assert.equal(roads.length, 1, 'one road-strip per road');
  const rd = roads[0]!;
  assert.ok(rd.points && rd.points.length >= 2, 'road-strip carries its polyline');
  closeTo(rd.points![0]!.x, 0, 'road start x');
  closeTo(rd.points![0]!.z, 0, 'road start z');
  closeTo(rd.points![rd.points!.length - 1]!.x, 100, 'road end x');
  closeTo(rd.points![rd.points!.length - 1]!.z, 100, 'road end z');
  closeTo(rd.transform.x, 50, 'road anchor at the polyline centroid');
  closeTo(rd.transform.z, 50, 'road anchor at the polyline centroid');

  // the wisp orbits its territory's centroid.
  const sprites = descs.filter((d): d is InstanceDescriptor => d.kind === 'wisp-sprite');
  assert.equal(sprites.length, 1, 'one wisp-sprite per in-flight wisp');
  closeTo(sprites[0]!.transform.x, 100, 'wisp x = territory centroid.x');
  closeTo(sprites[0]!.transform.z, 200, 'wisp z = territory centroid.y');

  // folded SceneStatus → a distinct material variant per status.
  for (const status of ['healthy', 'unhealthy', 'proposed', 'building'] as const) {
    const ds = worldTo3D(buildScene(mkInput({ territories: [mkTerritory({ status })] })));
    for (const gd of ds.filter((d): d is InstanceDescriptor => d.kind === 'hex-ground')) {
      assert.equal(gd.material, status, `hex-ground material reflects '${status}'`);
    }
    const tr = ds.filter((d): d is InstanceDescriptor => d.kind === 'story-tree');
    assert.equal(tr[0]!.material, status, `story-tree material reflects '${status}'`);
  }
});

// ---------------------------------------------------------------------------
// core kind families → typed instance descriptors
// ---------------------------------------------------------------------------

test('worldTo3D maps hex tile ground to hex-ground descriptors — one per draw tile', () => {
  // mkInput has relaxedCells: null + 2 drawTiles → 2 tile groups in the scene
  const descs = worldTo3D(buildScene(mkInput()));
  const grounds = descs.filter((d): d is InstanceDescriptor => d.kind === 'hex-ground');
  assert.equal(grounds.length, 2, 'one hex-ground descriptor per draw tile');
});

test('worldTo3D maps the story tree to a story-tree descriptor — one per territory', () => {
  // mkInput has 1 territory → 1 tree group in the scene
  const descs = worldTo3D(buildScene(mkInput()));
  const trees = descs.filter((d): d is InstanceDescriptor => d.kind === 'story-tree');
  assert.equal(trees.length, 1, 'one story-tree descriptor per territory');
});

test('worldTo3D maps a road to a road-strip descriptor — one per road in the scene', () => {
  // mkInput has 1 road
  const descs = worldTo3D(buildScene(mkInput()));
  const roads = descs.filter((d): d is InstanceDescriptor => d.kind === 'road-strip');
  assert.equal(roads.length, 1, 'one road-strip descriptor per road');
});

test('worldTo3D maps in-flight build wisps to wisp-sprite descriptors — one per wisp', () => {
  const scene = buildScene(
    mkInput({
      territories: [
        mkTerritory({
          wisps: [
            { runId: 'run-1', title: 'building unit-a' },
            { runId: 'run-2', title: 'building unit-b' },
          ],
        }),
      ],
    }),
  );
  const sprites = worldTo3D(scene).filter((d): d is InstanceDescriptor => d.kind === 'wisp-sprite');
  assert.equal(sprites.length, 2, 'one wisp-sprite descriptor per in-flight wisp');
});

// ---------------------------------------------------------------------------
// non-core / unknown kinds → explicit skip, never a throw
// ---------------------------------------------------------------------------

test('r3f-unknown-kind-skips-visibly: an unhandled SceneKind yields a named skip, never a throw', () => {
  // The real buildScene output contains many non-core structural kinds:
  // world, ground-hex, tile-side, tile-top, roads-layer, road-line, flora-layer,
  // territory, shadow, trunk, crown-lo, crown-hi, plate, plate-bg, plate-id,
  // plate-sub, hits-layer, hit, …  Each must produce { kind: 'skipped', sceneKind }
  // rather than throwing or silently disappearing.
  const descs = worldTo3D(buildScene(mkInput()));
  const skipped = descs.filter(asSkipped);
  assert.ok(skipped.length > 0, 'structural / non-core nodes must produce skipped descriptors');
  for (const s of skipped) {
    assert.equal(typeof s.sceneKind, 'string', 'each skipped descriptor carries the original SceneKind');
    assert.ok(s.sceneKind.length > 0, 'sceneKind is non-empty');
  }

  // A kind this mapper has never heard of (a FUTURE core addition) degrades to an
  // explicit named skip — the mapper may lag the core, never crash the site's 3D island.
  const novel: SceneG = {
    el: 'g',
    children: [{ el: 'g', children: [], kind: 'lava-flow' as SceneKind }],
  };
  const out = worldTo3D(novel);
  assert.deepEqual(
    out.filter(asSkipped).map((s) => s.sceneKind),
    ['lava-flow'],
    'the unknown kind is skipped BY NAME — visible in output, not silently dropped',
  );
});

// ---------------------------------------------------------------------------
// folded status flows to the material variant
// ---------------------------------------------------------------------------

test('worldTo3D folds the territory status into the material on hex-ground descriptors', () => {
  for (const status of ['healthy', 'unhealthy', 'proposed'] as const) {
    const descs = worldTo3D(
      buildScene(mkInput({ territories: [mkTerritory({ status })] })),
    );
    const grounds = descs.filter((d): d is InstanceDescriptor => d.kind === 'hex-ground');
    assert.ok(grounds.length > 0, `${status}: expected at least one hex-ground descriptor`);
    for (const g of grounds) {
      assert.equal(g.material, status, `hex-ground material must reflect '${status}' territory`);
    }
  }
});

test('worldTo3D folds the territory status into the material on the story-tree descriptor', () => {
  for (const status of ['healthy', 'unhealthy', 'proposed'] as const) {
    const descs = worldTo3D(
      buildScene(mkInput({ territories: [mkTerritory({ status })] })),
    );
    const trees = descs.filter((d): d is InstanceDescriptor => d.kind === 'story-tree');
    assert.equal(trees.length, 1, `${status}: expected exactly one story-tree descriptor`);
    assert.equal(trees[0]!.material, status, `story-tree material must reflect '${status}'`);
  }
});

// ---------------------------------------------------------------------------
// instance descriptor shape: 3D transform + instancing group
// ---------------------------------------------------------------------------

test('all instance descriptors carry a 3D transform with numeric x, y, z coordinates', () => {
  // Use a scene that exercises all four core families (ground, tree, road, wisp)
  const scene = buildScene(
    mkInput({
      territories: [mkTerritory({ wisps: [{ runId: 'r1', title: 'building' }] })],
    }),
  );
  const instances = worldTo3D(scene).filter(asInstance);
  assert.ok(instances.length > 0, 'at least one instance descriptor in a full scene');
  for (const inst of instances) {
    const { transform } = inst;
    assert.ok(transform != null, 'transform is present');
    assert.equal(typeof transform.x, 'number', 'transform.x is a number');
    assert.equal(typeof transform.y, 'number', 'transform.y is a number');
    assert.equal(typeof transform.z, 'number', 'transform.z is a number');
    assert.ok(
      Number.isFinite(transform.x) && Number.isFinite(transform.y) && Number.isFinite(transform.z),
      'transform coordinates are finite',
    );
  }
});

test('all instance descriptors carry a non-empty instancing group string', () => {
  const descs = worldTo3D(buildScene(mkInput()));
  const instances = descs.filter(asInstance);
  assert.ok(instances.length > 0, 'at least one instance descriptor');
  for (const inst of instances) {
    assert.equal(typeof inst.group, 'string', 'group is a string');
    assert.ok(inst.group.length > 0, 'group is non-empty');
  }
});
