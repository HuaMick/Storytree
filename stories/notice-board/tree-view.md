---
id: "tree-view"
tier: capability
story: notice-board
title: "The tree is the orientation surface — offline hierarchy, presence woven in when live"
outcome: "storytree tree [<story>] renders the work hierarchy offline and weaves the presence block in when the live store is reachable."
status: proposed
proof_mode: integration-test
depends_on: [declare-presence, presence-store]
---

# The tree is the orientation surface — offline hierarchy, presence woven in when live

**Outcome —** `storytree tree [<story>]` renders the work hierarchy offline and weaves the
presence block in when the live store is reachable.

> **Proof status (honest) — `proposed`, greenfield.** Nothing exists: no `tree` CLI area, no
> renderer, no tests. Every "proven by" below is a would-be test. ADR-0033 Decision 2 fixes the design:
> the tree is an orientation surface in the ADR-0023 choose-your-own-adventure pattern — the
> focused story view is the centerpiece where a session zoning into a node sees its neighbours.

## Guidance

A new `storytree tree` CLI area (`packages/cli`). Two views: **bare** (`storytree tree`) — all
stories with capability counts and statuses plus one presence summary line; **focused**
(`storytree tree <story-id>`) — the story's capability table, dependency edges, which nodes are
registered/REAL-buildable, derived verdict rollup when a live store is reachable, and the
presence block ("sessions here: …, last seen …") woven in.

- **Offline is the floor:** both views render entirely from `stories/*.md` frontmatter and
  `NODE_BUILD_REGISTRY` — no DB, no error. Presence and verdict rollup are live-only *additions*;
  their absence is silent (the story's design floor: degrade, never fail).
- **Cross-story boundary (ADR-0010 §4):** spec reading goes through the drive machinery's
  `findNodeSpecFile`/`loadNodeSpec` surface and the registry in `packages/orchestrator` —
  consumed, not reimplemented.
- **Presence is advisory:** the block *shows* who is here (staleness derived via
  `declare-presence`'s core logic, rows read from `presence-store`'s projection); nothing in the
  tree refuses or warns-as-gate on overlap. Identity rendered is whatever the worktree-derived
  declarations carry — the tree never invents or types identity.
- **The envelope steers:** like the library CLI, output carries `next` pointers so the surface is
  navigable just-in-time — the view itself tells a session what to do from here (declare, build,
  or zoom).

## Integration test (would-be)

**Goal —** Against the real `stories/` tree and registry (and a presence store fake/live-gated pg),
both views render offline without error, the focused view exposes the build surface, presence
appears only with `--pg`, and the next pointers point where the story says they should.

Render bare and focused views with no DB configured; assert clean output and exit 0. Register one
capability; assert the focused view distinguishes registered / REAL-buildable / unregistered.
Re-render with `--pg` against a store holding a declaration anchored to the story; assert the
presence block appears, and is silently absent without `--pg`.

## Contracts (4)

1. **`tree-renders-offline`** — bare and focused views render with no DB
   - **asserts —** both views render from `stories/` frontmatter + the registry with no DB
     reachable and no error; exit 0.
   - **proven by —** would-be `packages/cli/src/tree.test.ts`
2. **`focus-shows-build-surface`** — the focused view marks what can build next
   - **asserts —** each capability in the focused view is marked registered / REAL-buildable /
     unregistered from `NODE_BUILD_REGISTRY`, so "what can build next" is readable.
   - **proven by —** would-be `packages/cli/src/tree.test.ts`
3. **`presence-woven-when-live`** — presence appears with `--pg`, degrades silently without
   - **asserts —** with `--pg` the focused view includes the presence block for sessions whose
     `nodes` match the story or its capabilities; without `--pg` (or DB down) the block is
     silently absent — never an error.
   - **proven by —** would-be `packages/cli/src/tree.test.ts`
4. **`next-pointers-guide`** — the envelope `next` steers the session
   - **asserts —** the focused view's `next` offers `noticeboard declare --node <id>` and
     `node build <id>`; the bare view's `next` offers `tree <story-id>`.
   - **proven by —** would-be `packages/cli/src/tree.test.ts`
