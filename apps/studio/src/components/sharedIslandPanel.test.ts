// Stage-1 red-green (ADR-0070) for the two owner-directed Shared Islands panel tweaks
// (ADR-0088 follow-on, owner ask 2026-06-22):
//
//   1. the bookshelf landmark glyph moves OUT of the name card to sit to its RIGHT, bigger
//      — a pure anchor helper `bookshelfAnchorRight` places it beyond the plate's right edge,
//      vertically aligned with the plate;
//   2. the panel island gets the SAME ground/grid substrate the map paints under the coast —
//      so `buildRelaxedCells` over the panel's one-island world yields owned ground cells.
//
// The APPEARANCE (exact scale, margin, ground look in the small card) is owner-attested; this
// file pins only the testable geometry/behaviour.

import { describe, it, expect } from 'vitest';
import {
  buildWorld,
  nameplateLayout,
  bookshelfAnchorRight,
  buildRelaxedCells,
  MESH_TUNING,
} from './TreeView.js';
import type { TreeStory } from '../types';

const cap = (id: string) => ({
  id,
  title: id,
  outcome: '',
  status: 'mapped' as const,
  proofMode: 'red-green',
  dependsOn: [],
});

const libraryStory = (): TreeStory => ({
  id: 'library',
  title: 'library',
  outcome: '',
  status: 'mapped',
  proofMode: 'red-green',
  uatWitness: 'machine',
  dependsOn: [],
  consumedBy: ['cli', 'alpha'],
  building: true,
  capabilities: [cap('library-a'), cap('library-b'), cap('library-c')],
});

describe('bookshelfAnchorRight — the external (right-of-card) bookshelf landmark (tweak 1)', () => {
  // A representative normal nameplate for the library id, centred on a centroid.
  const plate = nameplateLayout('library'.length, false);
  const centroidX = 120;
  const labelY = 200;
  const margin = 8;

  it('anchors the glyph BEYOND the nameplate box right edge, by the margin', () => {
    const anchor = bookshelfAnchorRight(plate, centroidX, labelY, margin);
    const plateRight = centroidX + plate.w / 2;
    expect(anchor.x).toBeGreaterThan(plateRight);
    expect(anchor.x).toBeCloseTo(plateRight + margin, 5);
  });

  it('vertically aligns the glyph with the nameplate box (sits within the plate band)', () => {
    const anchor = bookshelfAnchorRight(plate, centroidX, labelY, margin);
    // the glyph baseline sits inside the plate's vertical span (labelY .. labelY+h),
    // i.e. it lines up with the card rather than floating above/below it.
    expect(anchor.y).toBeGreaterThanOrEqual(labelY);
    expect(anchor.y).toBeLessThanOrEqual(labelY + plate.h);
  });

  it('is a pure function of its inputs (deterministic — same in → same out)', () => {
    const a = bookshelfAnchorRight(plate, centroidX, labelY, margin);
    const b = bookshelfAnchorRight(plate, centroidX, labelY, margin);
    expect(a).toEqual(b);
  });

  it('moves right when the margin grows (the owner can nudge the gap)', () => {
    const near = bookshelfAnchorRight(plate, centroidX, labelY, 4);
    const far = bookshelfAnchorRight(plate, centroidX, labelY, 24);
    expect(far.x).toBeGreaterThan(near.x);
  });
});

describe('panel ground — the one-island world has a substrate to render (tweak 2)', () => {
  it('yields mesh ground cells for the panel one-island world (the default substrate)', () => {
    const world = buildWorld([libraryStory()], { buildings: false });
    const cells = buildRelaxedCells(world, 'mesh', MESH_TUNING);
    // the panel island now HAS a ground layer to paint under its coast + flora
    expect(cells.length).toBeGreaterThan(0);
  });

  it('every ground cell is owned by the single territory (owner 0)', () => {
    const world = buildWorld([libraryStory()], { buildings: false });
    expect(world.territories.length).toBe(1);
    const cells = buildRelaxedCells(world, 'mesh', MESH_TUNING);
    expect(cells.every((c) => c.owner === 0)).toBe(true);
  });

  it('each ground cell is a closed polygon (≥ 3 points)', () => {
    const world = buildWorld([libraryStory()], { buildings: false });
    const cells = buildRelaxedCells(world, 'mesh', MESH_TUNING);
    expect(cells.every((c) => c.poly.length >= 3)).toBe(true);
  });

  it('is deterministic (ADR-0069) — the same story yields the same ground twice', () => {
    const a = buildRelaxedCells(buildWorld([libraryStory()], { buildings: false }), 'mesh', MESH_TUNING);
    const b = buildRelaxedCells(buildWorld([libraryStory()], { buildings: false }), 'mesh', MESH_TUNING);
    expect(a.length).toBe(b.length);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
