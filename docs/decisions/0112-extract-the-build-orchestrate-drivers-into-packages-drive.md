---
status: accepted
decided: 2026-06-26
amends: [108]
load_bearing: true
---
# ADR-0112: Extract the build/orchestrate drivers into packages/drive

## Status

accepted (2026-06-26) — decided/directed by the owner in conversation on 2026-06-26. Design-time
alignment IS the ratification (ADR-0110); no second end-of-flow ask. Relates to ADR-0090 (the
UI-driven build worker that lazy-imports this surface), ADR-0074 (the organism boundary gate this
package now stands inside), and ADR-0004 (the single SDK import-site rule the move preserves).

## Context

The build/orchestrate drivers — `node build` / `story build`, `adopt`, the headless `orchestrate`
runtime, plus their private helpers (`wisp-smoke`, `oq-gate`, `resolve-report`, `curate`,
`noticeboard`, `ambient-presence`, `db-control`, the ADR-frontmatter parser) — grew up inside
`packages/cli/src`, the agent-facing command hub (ADR-0023). That left every NON-CLI consumer of the
build surface forced to depend on the whole CLI: `apps/studio`'s server lazy-imported
`@storytree/cli/build` and `@storytree/cli/secrets` (the ADR-0090 worker plumbing) and therefore
declared a `depends_on: cli` edge purely to reach the drivers — coupling a UI surface to the command
hub for code that has nothing to do with argument dispatch. As ADR-0108 stages a server-side
`session-orchestrator` runtime (Phase 2 — the studio worker that RUNS the loop), that coupling only
deepens: the worker needs the drive surface, not the CLI's verb router.

The drive surface is a deep module in its own right (the drivers that compose the orchestrator spine
+ the agent leaf + the live stores into builds, adoption, and the headless orchestrator, returning the
CLI `Envelope`) — it earns a boundary. Burying it in `cli` makes the most build-relevant code reachable
only through the command hub; leaving it there as ADR-0108's worker investment grows would force the
studio worker to keep importing `cli`. The boundary gate (ADR-0074) renders and enforces these
cross-story edges, so the misplacement is also a world-legibility problem: `studio → cli` reads as the
UI depending on the command surface, when what it actually needs is the build runtime.

## Decision

Carve the build/orchestrate drivers and their private helpers out of `packages/cli/src` into a new
**`packages/drive`** package, owned by the EXISTING `drive-machinery` story (no new story; the drive
surface was already that story's `build-drive-cli` capability, merely physically resident in `cli`).

1. **`@storytree/drive` holds the drivers.** The moved modules (`node-build`, `story-build`, `adopt`,
   `orchestrate`, `build`, `secrets`, and the helpers above) live in `packages/drive/src`, with the
   barrel `.` export plus the narrow `./build` and `./secrets` subpaths. `drive` depends on
   `@storytree/orchestrator` (the spine), `@storytree/agent` (the leaf), `@storytree/library`,
   `@storytree/notice-board`, and the two root ports (`proof-protocol`, `storage-protocol`). HARD
   INVARIANT: `drive` imports **nothing** from `@storytree/cli` — the dependency runs cli → drive, never
   back.

2. **`cli` depends on `drive` and re-exports for back-compat.** `packages/cli` keeps thin shim
   re-exports (`build.ts` → `@storytree/drive/build`, `secrets.ts` → `@storytree/drive/secrets`,
   `envelope.ts`) and dispatches the drivers from `commands.ts` as before, so every existing
   `pnpm storytree …` build/orchestrate verb is unchanged. The CLI stays the agent-facing hub; the
   drivers it dispatches now live behind a package boundary.

3. **`apps/studio` drops its `cli` dependency.** The studio server lazy-imports `@storytree/drive`
   (`/build` + `/secrets`) directly and removes `@storytree/cli` from its deps — the ADR-0090 worker
   now reaches the build runtime, not the command hub.

4. **`renderAgentPrompt` + family move to `@storytree/library`** (`packages/library/src/store/
   render-agent.ts`) — the agent-prompt assembly is library/store concern (it reads the knowledge
   corpus), not a CLI primitive; relocating it keeps the new `drive` package from re-importing `cli`
   for prompt rendering.

5. **No new cross-story graph edges.** Because `drive` is owned by `drive-machinery` — the story
   `studio` and `cli` already couple to — the move adds no new story-to-story edge. The graph shape is
   unchanged; what moves is which PACKAGE carries the code.

This **resolves the open modeling fork flagged in `stories/headless-orchestrator/story.md`** ("when the
chat surface arrives, does the server-side runtime move to the ADR-0090 studio worker process, or stay
a CLI-hosted core the worker calls?") in favour of **a shared `drive` core the worker calls** — the
runtime is neither buried in `cli` nor duplicated in the studio. ADR-0108 decision 1 ("the runtime runs
ON the worker") and the Phase-1 "keep the core package-level and CLI-driven so the move is a
re-composition, not a rewrite" land cleanly: the core is now a package both the CLI and the studio
worker call. This is why this ADR `amends: [108]` — it settles the placement that ADR-0108 deferred to
the Phase-2 boundary.

## Consequences

**Good**
- The build runtime is a first-class package with its own boundary (a deep module, ADR-0074): the
  studio worker and the CLI both consume it, and the world renders `studio → drive-machinery` (already
  declared) instead of a misleading `studio → cli`.
- ADR-0108's Phase-2 worker reuses the package-level core rather than importing the command hub — the
  placement fork the headless-orchestrator story flagged is closed before Phase 2 needs it.
- ADR-0004's single SDK import-site rule is preserved: `drive` consumes `@storytree/agent`'s published
  seams; it does not import `@anthropic-ai/*` directly.
- Back-compat is total: `@storytree/cli/build` and `@storytree/cli/secrets` are unchanged shim subpaths,
  and every `pnpm storytree …` verb dispatches as before — no caller breaks.

**Bad / accepted costs**
- One more package in the workspace (its install/typecheck/test surface) and a thin re-export layer in
  `cli` to maintain — the deliberate price of the boundary.
- A second physical home pattern in `drive-machinery`: the spine lives in `packages/orchestrator`, the
  drive surface now in `packages/drive` — the story spans three packages (orchestrator + drive + the
  work/verdict store halves), the same multi-package organism shape as `library`.

**Neutral — one boundary correction.** The new, real `drive → notice-board` import edge (the drivers'
`ambient-presence` + `noticeboard` surface + `PgPresenceStore` moved into `@storytree/drive`, which
imports `@storytree/notice-board`) gives `drive-machinery` a genuine `depends_on: notice-board`. The
`notice-board` story previously carried a `depends_on: drive-machinery` that was UNBACKED by any code
edge (`@storytree/notice-board` imports only `@storytree/library`); paired with the new real reverse
edge it would have formed a forbidden cross-story cycle (ADR-0058). The unbacked edge is dropped — the
drive-resident presence reads the notice-board story's prose describes are done by code that lives in
`drive`/`cli`, declared on those organisms, not by `@storytree/notice-board` itself. The merged
declared graph stays acyclic.

## References

- [ADR-0108](0108-chat-driven-orchestration-a-server-side-session-orchestrator.md) — the server-side
  session-orchestrator runtime; **amended in part** (this settles the Phase-2 placement fork: a shared
  `drive` core the worker calls).
- [ADR-0090](0090-ui-driven-orchestration-hosted-build-capable-backend-thin-cl.md) — the UI-driven build
  worker that lazy-imports the drive surface; the consumer this move serves.
- [ADR-0074](0074-enforce-the-organism-boundary-gate-the-cross-story-dependenc.md) — the organism
  boundary gate that renders + enforces the cross-story edges this package now stands inside.
- [ADR-0058](0058-cross-story-dependency-direction-the-no-cycle-rule-and-the-b.md) — the no-cycle rule
  that forces the notice-board boundary correction.
- [ADR-0004](0004-orchestrator-agent-boundary.md) — the single SDK import-site rule the move preserves
  (`drive` consumes `@storytree/agent`, never `@anthropic-ai/*`).
- [ADR-0023](0023-library-cli-choose-your-own-adventure.md) — the CLI hub the drivers were carved out of;
  `cli` keeps the dispatch + back-compat shims.
- Code: `packages/drive/src/*` (the moved drivers + helpers), `packages/cli/src/{build,secrets,envelope}.ts`
  (back-compat shims), `packages/library/src/store/render-agent.ts` (`renderAgentPrompt` family),
  `apps/studio/server/*` (lazy-imports `@storytree/drive`), `repo-manifest.json`
  (`packageOwnership["@storytree/drive"] = "drive-machinery"`).
