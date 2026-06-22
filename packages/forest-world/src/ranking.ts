// The dependency graph the forest world reads bottom-up (ADR-0036 d.6a): the
// story-level edge set (declared `depends_on` ∪ derived cross-story capability
// deps), longest-path ranking (a dependent always ranks strictly above every
// dependency), and the load-bearing count that centres the foundation row.
//
// Pure graph code over this package's OWN minimal input contract (a story is just
// an id + its deps + its capabilities' deps) — NOT any app's story type. The
// studio's TreeStory and the website's Story are both structurally assignable, so
// each surface hands its own richer type straight in.

import { hash } from './rng.js';

/** The minimum a story must expose to be ranked. */
export interface RankStory {
  readonly id: string;
}

/** The minimum a capability must expose to derive cross-story edges. */
export interface EdgeCapability {
  readonly id: string;
  readonly dependsOn: readonly string[];
}

/** The minimum a story must expose to derive the world's edge set. */
export interface EdgeStory {
  readonly id: string;
  readonly dependsOn: readonly string[];
  readonly capabilities: readonly EdgeCapability[];
}

export interface StoryEdge {
  from: string;
  to: string;
  /** Human-readable trace of the derived capability edges that imply this road. */
  via: string[];
}

/**
 * The story-level edge set the world renders as roads: declared `depends_on`
 * UNION derived cross-story capability deps. Ranking uses the SAME set so a
 * derived-only road can never point downward.
 */
export function storyEdges(stories: readonly EdgeStory[]): StoryEdge[] {
  const ids = new Set(stories.map((s) => s.id));
  const capOwner = new Map<string, string>();
  for (const s of stories) for (const c of s.capabilities) capOwner.set(c.id, s.id);
  const edgeMap = new Map<string, StoryEdge>();
  for (const s of stories) {
    for (const dep of s.dependsOn) {
      if (dep !== s.id && ids.has(dep)) {
        edgeMap.set(`${dep}->${s.id}`, { from: dep, to: s.id, via: [] });
      }
    }
    for (const c of s.capabilities) {
      for (const d of c.dependsOn) {
        const ownerId = capOwner.get(d);
        if (!ownerId || ownerId === s.id) continue;
        const key = `${ownerId}->${s.id}`;
        const cur = edgeMap.get(key) ?? { from: ownerId, to: s.id, via: [] };
        cur.via.push(`${c.id} → ${d}`);
        edgeMap.set(key, cur);
      }
    }
  }
  return [...edgeMap.values()];
}

/**
 * Longest-path rank over the world's edge set (dep → dependent), cycle-safe.
 * Rank 0 = the most foundational stories; a dependent always ranks strictly
 * above every dependency, so the world reads bottom-up (ADR-0036 d.6a).
 */
export function rankStories(
  stories: readonly RankStory[],
  depsOf: ReadonlyMap<string, readonly string[]>,
): Map<string, number> {
  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // cycle in bad frontmatter — break the edge, stay finite
    visiting.add(id);
    let r = 0;
    for (const d of depsOf.get(id) ?? []) r = Math.max(r, visit(d) + 1);
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  for (const s of stories) visit(s.id);
  return rank;
}

/** Transitive dependent count — how load-bearing a story is (centres the foundation row). */
export function descendantCounts(
  stories: readonly RankStory[],
  dependentsOf: ReadonlyMap<string, readonly string[]>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of stories) {
    const seen = new Set<string>();
    const stack = [...(dependentsOf.get(s.id) ?? [])];
    for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(dependentsOf.get(id) ?? []));
    }
    counts.set(s.id, seen.size);
  }
  return counts;
}

// `hash` is re-exported so a ranking-adjacent consumer that orders ties by a
// stable hash (buildWorld's row sort) needn't reach into ./rng directly.
export { hash };
