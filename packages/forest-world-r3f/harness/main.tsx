// harness/main.tsx — the spike's dev harness (dev-only, never shipped): a REAL
// @storytree/forest-world scene — buildScene over a hand-authored SceneInput,
// the core's own minimal input contract (here the harness IS the surface, so it
// authors the layout the way any surface does) — mapped by the pure worldTo3D
// and drawn by <ForestWorldCanvas> under drei MapControls.
//
// FICTIONAL demo data throughout (the ADR-0056/0066/0093 boundary): three
// territories wearing three folded statuses, two depends_on roads, one in-flight
// build wisp — enough world for the eye to confirm the whole stack draws.

import { createRoot } from 'react-dom/client';
import {
  buildScene,
  hexCenter,
  type Axial,
  type SceneInput,
  type SceneTerritoryInput,
} from '@storytree/forest-world';

import { worldTo3D } from '../src/world-to-3d.js';
import { ForestWorldCanvas } from '../src/ForestWorldCanvas.js';

// ── the fictional world: three islands, three statuses ──────────────────────

interface DemoIsland {
  id: string;
  status: SceneTerritoryInput['status'];
  tiles: Axial[];
  caps: number;
  wisps: SceneTerritoryInput['wisps'];
}

const ring = (cq: number, cr: number): Axial[] => [
  { q: cq, r: cr },
  { q: cq + 1, r: cr },
  { q: cq - 1, r: cr },
  { q: cq, r: cr + 1 },
  { q: cq, r: cr - 1 },
  { q: cq + 1, r: cr - 1 },
  { q: cq - 1, r: cr + 1 },
];

const ISLANDS: DemoIsland[] = [
  {
    id: 'greenhouse',
    status: 'healthy',
    tiles: ring(0, 0),
    caps: 4,
    wisps: [{ runId: 'run-demo-1', title: 'building watering-loop', phase: 'IMPLEMENT' }],
  },
  { id: 'seed-catalogue', status: 'proposed', tiles: ring(7, -2), caps: 1, wisps: [] },
  { id: 'compost-works', status: 'unhealthy', tiles: ring(3, 5), caps: 2, wisps: [] },
];

function territoryOf(island: DemoIsland): SceneTerritoryInput {
  const centres = island.tiles.map(hexCenter);
  const cx = centres.reduce((s, c) => s + c.x, 0) / centres.length;
  const cy = centres.reduce((s, c) => s + c.y, 0) / centres.length;
  return {
    id: island.id,
    status: island.status,
    caps: island.caps,
    centroid: { x: cx, y: cy },
    radius: 40,
    treeSpot: { x: cx, y: cy - 6 },
    labelY: cy + 46,
    coastPaths: [],
    decor: [],
    plants: [],
    treeTitle: `${island.id} — ${island.status}`,
    wisps: island.wisps,
    plate: {
      w: 120,
      h: 33,
      rx: 7,
      idY: 14,
      subY: 27,
      idText: island.id,
      subText: `${island.status} · ${island.caps} caps`,
      title: island.id,
    },
  };
}

function demoInput(): SceneInput {
  const territories = ISLANDS.map(territoryOf);
  const road = (a: number, b: number): SceneInput['roads'][number] => ({
    from: ISLANDS[a]!.id,
    to: ISLANDS[b]!.id,
    d: `M ${territories[a]!.centroid.x.toFixed(1)} ${territories[a]!.centroid.y.toFixed(1)} L ${territories[b]!.centroid.x.toFixed(1)} ${territories[b]!.centroid.y.toFixed(1)}`,
    title: `${ISLANDS[b]!.id} depends on ${ISLANDS[a]!.id}`,
  });
  return {
    offset: { x: 0, y: 0 },
    width: 1400,
    height: 1000,
    empties: [],
    relaxedCells: null,
    drawTiles: ISLANDS.flatMap((island, owner) => island.tiles.map((h) => ({ h, owner }))),
    wheatSets: ISLANDS.map(() => new Set<string>()),
    roads: [road(0, 1), road(0, 2)],
    territories,
  };
}

// ── real core → pure mapping → canvas ────────────────────────────────────────

const descriptors = worldTo3D(buildScene(demoInput()));
const count = (k: string): number => descriptors.filter((d) => d.kind === k).length;
const summary =
  `hex-ground ${count('hex-ground')} · story-tree ${count('story-tree')} · ` +
  `road-strip ${count('road-strip')} · wisp-sprite ${count('wisp-sprite')} · ` +
  `skipped ${count('skipped')}`;
// The machine-checkable render signal (the harness look itself is witnessed by eyes).
console.log(`[forest-world-r3f harness] descriptors: ${summary}`);

function App() {
  return (
    <>
      <div id="hud">
        <strong>forest-world-r3f spike</strong> — real buildScene → worldTo3D →
        R3F/MapControls
        <br />
        {summary}
        <br />
        drag = pan · wheel = zoom · right-drag = rotate
      </div>
      <ForestWorldCanvas descriptors={descriptors} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
