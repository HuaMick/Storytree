// Territory + tree sizing — the pure curves that turn a story's tile quota and
// capability count into pixel radii. The studio's CANONICAL numbers (ADR-0093):
// crown grows with capability count; island radius with the tile quota.

import { HEX_R, HEX_W } from './hex.js';

/** Hex rings a territory of `quota` tiles roughly fills (1 / 7 / 19 / 37 centred counts). */
export function ringsOf(quota: number): number {
  return quota <= 1 ? 0 : quota <= 7 ? 1 : quota <= 19 ? 2 : 3;
}

/** Rough px radius a territory will grow to from its tile quota. */
export function estRadius(quota: number): number {
  return Math.sqrt(quota) * HEX_W * 0.62 + HEX_R;
}

/** Crown radius of the central story tree — grows with capability count. */
export function crownRadius(capCount: number): number {
  return Math.min(32, 18 + 2.2 * capCount);
}

/**
 * How far above its base a story tree reaches, px — the withered bare branches
 * top out at 2.64·R and the canopy at ~2.7·R (StoryTree geometry); +18 covers
 * blob jitter and the signpost. buildWorld uses this for bounds.
 */
export function storyTreeReach(capCount: number): number {
  return 2.72 * crownRadius(capCount) + 18;
}
