// @storytree/forest-world — the shared forest-world render core (ADR-0093,
// strategy C). Pure, browser-safe, deterministic GEOMETRY: data-in → geometry-out.
// Both the studio (React mapper) and the public website (string-SVG mapper) render
// FROM this. No store, no React, no live data, no node: imports. The scene-graph
// layer (the framework-agnostic drawable tree the two mappers walk) lands on top
// of this kernel in a follow-up unit.

export { hash, rand01 } from './rng.js';

export {
  type Pt,
  type Axial,
  HEX_R,
  HEX_W,
  TILE_DEPTH,
  axialKey,
  AXIAL_DIRS,
  hexCenter,
  pixelToHex,
  hexDist,
  hexCorners,
  hexPath,
  polyPath,
} from './hex.js';

export { ringsOf, estRadius, crownRadius, storyTreeReach } from './sizing.js';

export {
  type RankStory,
  type EdgeCapability,
  type EdgeStory,
  type StoryEdge,
  storyEdges,
  rankStories,
  descendantCounts,
} from './ranking.js';

export {
  type BoundarySeg,
  boundaryRingLoops,
  loopSignedArea,
  outsetLoop,
  chaikinClosed,
  smoothLoopPath,
  smoothCoast,
} from './coast.js';

export {
  type SubstrateMode,
  type SubstrateTuning,
  type RelaxedCell,
  type DrawTile,
  MESH_TUNING,
  buildRelaxedCells,
} from './substrate.js';
