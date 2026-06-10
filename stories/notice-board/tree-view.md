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

The implementation is `packages/cli/src/tree.ts` — a SELF-CONTAINED command module (every handler
returns the `Envelope` from `./envelope.js`). Do NOT touch `commands.ts` or `main.ts` (outside
your write scope) — the spine wires the dispatch afterwards. Two views: **bare**
(`storytree tree`) — all stories; **focused** (`storytree tree <story-id>`) — one story's nodes,
edges, build surface and the presence block. (Verdict rollup detail is deliberately OUT of this
cut — story owner call 3; do not query verdicts.)

- **The exported surface (exactly this):**
  - `interface TreeDeps { storiesDir: string; lookupConfig: (id: string) => { real?: unknown } | null; presence: PresenceStoreLike | null; now: () => Date }`
    — import `type PresenceStoreLike` from `./noticeboard.js` (the sibling module, already at
    HEAD); `lookupConfig` is the registry seam (`NodeBuildConfig`-shaped: non-null = registered,
    `.real !== undefined` = REAL-buildable). Everything is injected — the test never touches the
    real `stories/` tree or the real registry, so future stories/registrations cannot break it.
  - `async function treeCommand(storyId: string | undefined, deps: TreeDeps): Promise<Envelope>`.
- **Reading specs (ADR-0010 §4 — consumed, not reimplemented):** import `loadNodeSpec` from
  `@storytree/orchestrator`. A story is a direct child directory of `deps.storiesDir` containing
  a `story.md`; its spec's frontmatter `capabilities` lists its capability ids, each at
  `<storyDir>/<capId>.md`. Tolerate a capability file that is missing or fails to load (render
  the id with a `(spec missing)` note — never throw).
- **Bare view:** one line per story — id, title, status, capability count — plus, when
  `deps.presence` is non-null, ONE summary line with the active-session count from
  `listActive()`. `next` offers `storytree tree <story-id>` for a real listed id.
- **Focused view:** unknown story id → `ok: false` listing the available story ids in `next`.
  Otherwise render: the story header (id, title, status, outcome); a capability table — each
  capability's id, status, `depends_on`, and its build-surface mark from `deps.lookupConfig`:
  `REAL-buildable` when `.real` exists, `registered` when non-null without `.real`, else
  `unregistered`; a dependency-edges section (`a → b` per `depends_on` entry). `next` offers
  `storytree noticeboard declare --working-on <prose> --node <storyId> --pg`,
  `storytree node build <id> --real` for a REAL-buildable capability when one exists, and
  `storytree tree` (back out).
- **The presence block (focused, advisory only):** when `deps.presence` is non-null, take
  `listActive()` docs whose `nodes` intersect `{storyId} ∪ capability ids` and weave in a
  `sessions here:` block — per session: `sessionId`, the band from
  `classifyPresence(doc.lastSeenAt, deps.now())` (import from `@storytree/core` — never recompute
  thresholds), an age like `4m`/`2h`, and the `workingOn` prose. When `deps.presence` is null,
  when the list is empty, or when ANY presence call throws (wrap it): the block is silently
  absent — the view still renders `ok: true`. Degrade, never fail; nothing here refuses or warns
  on overlap.
- **The test (`packages/cli/src/tree.test.ts`, the registered REAL proof — offline only):** build
  a TEMP stories dir with `node:fs` `mkdtempSync` (clean it up in `after`): write a `story.md`
  with frontmatter (`id`/`tier: story`/`title`/`outcome`/`status: proposed`/`proof_mode: UAT`/
  `capabilities: [cap-a, cap-b, cap-c]`) and capability files for `cap-a`/`cap-b` ONLY
  (`tier: capability`, `proof_mode: integration-test`, `cap-b` carrying
  `depends_on: [cap-a]`) — `cap-c` stays missing on purpose. Fake `lookupConfig`: `cap-a` →
  `{ real: {} }`, `cap-b` → `{}`, else null. Fake `PresenceStoreLike` with one active doc whose
  `nodes` names the story id and one whose `nodes` do not. Assert: bare and focused render `ok: true`
  with `presence: null` and the body carries no `sessions here:`; the focused table marks cap-a
  `REAL-buildable`, cap-b `registered`, cap-c `unregistered` and notes its missing spec; with the
  fake presence store the focused body has `sessions here:` with the matching sessionId and NOT
  the unrelated one; with a presence store whose every method throws, the view still renders
  `ok: true` with no presence block; the focused `next` includes a `noticeboard declare` pointer
  with `--node <storyId>` and a `node build` pointer; the bare `next` includes
  `storytree tree <storyId>`. Assert on fragments, never byte-exact bodies (you cannot run this
  test yourself; brittle assertions are how this build dies).

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
