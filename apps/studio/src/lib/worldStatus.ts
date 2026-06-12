// World-status presentation (ADR-0038): how an authored Status reaches the story
// world. Two owner calls, DISPLAY-level only — the schema and the authored
// frontmatter keep the full six-state vocabulary:
//
// - `retired` units don't render at all. A retired story loses its island, its
//   roads and its rank influence; a retired capability leaves the garden.
//   (Search/resurrection is later work — the data still holds them.)
// - `building` wears `proposed` in the world. Live work is already signalled by
//   session wisps (ADR-0033), and the proposed state keeps its freedom to
//   iterate — a separate hue bought nothing.

import type { TreeCapability, TreeStory, WorkStatus } from '../types';

/** The status a unit WEARS in the world: building reads as proposed. */
export function worldStatus(status: WorkStatus | null): WorkStatus | null {
  return status === 'building' ? 'proposed' : status;
}

/**
 * The stories the world renders: retired pruned (both tiers), building folded
 * into proposed. Everything downstream of the fetch — layout, roads, focus,
 * legend, panel — sees only this presented world.
 */
export function presentStories(stories: TreeStory[]): TreeStory[] {
  return stories
    .filter((s) => s.status !== 'retired')
    .map((s) => ({
      ...s,
      status: worldStatus(s.status),
      capabilities: s.capabilities
        .filter((c) => c.status !== 'retired')
        .map((c): TreeCapability => ({ ...c, status: worldStatus(c.status) })),
    }));
}
