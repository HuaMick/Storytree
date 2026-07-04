---
status: accepted
decided: 2026-07-04
amends: [137, 108]
load_bearing: true
---
# ADR-0152: Lift the Phase-2 landing wall: the desktop orchestrator runs the merge ceremony, at parity with the terminal session-orchestrator

## Status

accepted (2026-07-04) — decided/directed by the owner in conversation on 2026-07-04, as the third
increment of the desktop-orchestrator full-autonomy arc (after ADR-0151 lifted the orchestrator-session
turn cap). Design-time alignment IS the ratification (ADR-0110); no second end-of-flow ask. Amends
ADR-0137 (relaxes decision 3's "the human's button + merge are the direct gates" for the desktop
orchestrator) and completes ADR-0108's whole-loop authority for the desktop-chat path. Upholds
ADR-0091 / ADR-0020 (the spine is still the sole verdict signer) and ADR-0022 (CI still re-proves and
merges before the trunk) unchanged.

## Context

The terminal session-orchestrator and the desktop chat run the **same** rendered `session-orchestrator`
agent (ADR-0051) — ADR-0137 made that explicit: "the desktop chat becomes the SAME orchestrator the
Claude Code terminal session already is." But the BUILD is phased, and the desktop chat stops one step
short of the terminal agent. Today it can orient, propose, author ADRs, and SPAWN the inner loop
(story-author / builder, claim-gated — ADR-0137 Phase 3, `stories/chat-subagent-spawn`), and the spine
signs verdicts on a `claude/real/*` branch — but **nothing in the chat can run the gate, commit, push,
or open the landing PR.** That last mile is the terminal session-orchestrator's *merge ceremony*
(green unit → `pnpm gate` → commit → push → **non-draft** PR → CI automerges, ADR-0022). ADR-0137
decision 3 deliberately kept it out: "the human's button + merge are the direct gates."

The owner has now directed parity: the desktop orchestrator should carry the **whole** loop the terminal
agent carries, ending in the merge ceremony, so a full drive (chat builds a real thing and lands it)
completes from the chat. ADR-0108 already granted the desktop session-orchestrator "whole-loop
authority (orient → decide → decompose → route provable units to the inner loop → gate → librarian
pass → **open the landing PR**)"; this ADR is the BUILD of that last clause for the desktop path, not a
new grant.

**This is parity, not a new trust escalation.** Every safety property the corpus rests on is unchanged:

- **The spine is still the sole verdict signer** (ADR-0020 / ADR-0091). The orchestrator holds no
  signing key and hands in no verdict. Landing a PR is not signing a verdict — it is opening a change
  for the *independent* CI gate.
- **CI independently re-proves green before the trunk** (ADR-0022). A non-draft PR opened by the
  orchestrator lands only after CI runs the full suite on the merge with `main` — exactly as an
  agent-opened PR does today (the terminal session-orchestrator, and every `claude/*` branch, already
  works this way). The damage ceiling of a wrong local gate is a red CI check, not unproven code on
  `main`.
- **The human owns the outer loop** (human-owns-the-outer-loop). The owner directs the work, watches it
  stream, and can stop it; a landed PR is reviewable and revertible. The deliberate whole-story go-green
  (the forest-map Adopt/Build button, ADR-0094 / ADR-0136) and per-node accept-to-land (ADR-0108 d.3,
  ADR-0144 — no auto-PR per node accept) are untouched: this ADR is about the orchestrator running the
  *merge ceremony for a unit it drove to green*, the same act the terminal agent performs, not about
  auto-merging on a node click.

The residual concern ADR-0137 named — that the chat must not gain "raw `Write`/`Bash`" — is honoured:
the landing surface is a small set of **scoped, fail-closed MCP tools** (the same discipline as the
claim-gated spawn tools), never a raw shell.

## Decision

1. **The desktop orchestrator gains a scoped LANDING tool surface** — the git/gh/gate capability the
   terminal session-orchestrator already has, so it can run the merge ceremony end to end: run the gate,
   commit the working tree, push the branch, and open a **non-draft** PR (CI automerges, ADR-0022). This
   relaxes ADR-0137 decision 3 for the desktop orchestrator: the merge ceremony is now the
   orchestrator's, as ADR-0108's whole-loop authority always intended.

2. **The surface is scoped MCP tools, never raw `Write`/`Bash`** (upholds ADR-0137 d.1). It mirrors the
   spawn tool surface exactly: an OPTIONAL `LandingSurfaceDeps` injected into the headless orchestrator
   session; when absent the session is byte-identical to today's propose+spawn surface (the ADR-0108 §7
   scale-down mirror). Each tool is fail-closed — a non-zero gate/git/gh exit folds to conversation
   TEXT, never a throw and never a verdict-shaped payload. The chat session keeps `tools: []`; the
   landing tools are the ONLY sanctioned side-effecting surface, each a narrow, named action (not a
   general shell).

3. **The spine is still the sole verdict signer; CI is still the independent gate.** The landing tools
   run `pnpm gate` and open a PR; they do NOT sign verdicts (ADR-0020 / ADR-0091 upheld) and do NOT
   `gh pr merge` (CI automerges, ADR-0022 upheld). `run_gate` observes pass/fail from a real subprocess
   exit code — the same red/green the spine and CI observe — and never authors a "healthy".

4. **Built as sequenced provable sub-increments**, each with an isolatable red→green unit test and each
   landed on its own through the gate/PR ceremony (the arc's perpetual-chain discipline):
   - the landing tool surface (`buildLandingTools` + `LandingSurfaceDeps`) mounted conditionally on
     `runHeadlessOrchestrator`, proven offline with recording fakes (this ADR's first unit);
   - the real deps composition (`buildLandingDeps` in `@storytree/drive`) that shells `pnpm gate` /
     `git` / `gh` behind an injected exec seam, threaded through `orchestrate()` / `startChatStream`;
   - the desktop sidecar wiring (`backend-entry.ts` glue, operator-attested) with its pure helpers
     unit-tested;
   - the live, owner-attested full-drive UAT walk (chat builds a real unit and lands it) — the owner's
     leg to witness (ADR-0070), never self-signed.

## Consequences

**Good**
- The desktop chat reaches full session-orchestrator parity: orient → decompose → spawn the inner loop
  → gate → librarian pass → **land** — the same loop the terminal agent runs, one model, no special
  subset. This is the highest-leverage inner-loop-adoption lever (ADR-0128 / ADR-0129) completed for the
  desktop path.
- The safety argument is unchanged from ADR-0091: no verdict handed in, CI re-proves before the trunk.
  A wrong local gate cannot place unproven code on `main`.

**Bad / accepted costs**
- The chat now has a side-effecting tool surface (gate/git/gh) it did not have before. The
  fail-closed / scoped-MCP discipline and the `tools: []` wall are what keep it from being a raw shell;
  that scoping must be enforced and tested (mirroring the spawn surface's wall tests).
- A wrong local `pnpm gate` PASS is possible (an OOM or environment quirk); the backstop is CI
  re-proving on the merge (ADR-0022). The orchestrator opening a red PR is a recoverable, visible state
  (a red check), not a trunk corruption.
- Landing is now an action the human-watched loop can take unattended within a session; the owner's
  ability to watch the stream and stop it, plus the reviewable/revertible PR, are the containment — the
  same containment the terminal agent already operates under.

**Neutral**
- The terminal session-orchestrator is unchanged (it already runs the merge ceremony). This ADR brings
  the desktop path up to it; it does not alter the terminal path or the boundaries ADR-0137 d.3 keeps
  for the human (the Adopt/Build button, per-node accept-to-land).

## References

- [ADR-0137](0137-chat-is-the-full-session-orchestrator-it-spawns-the-inner-lo.md) — chat is the full
  session-orchestrator (spawns the inner loop); decision 3's "the human's button + merge are the direct
  gates" is **relaxed here** for the merge ceremony, decision 1's spawn discipline and d.1's no-raw-write
  wall are **upheld**.
- [ADR-0108](0108-chat-driven-orchestration-a-server-side-session-orchestrator.md) — the whole-loop
  authority that already names "open the landing PR"; this ADR **completes** that clause for the desktop
  path. Accept-to-land (d.3) and the single-session guard (d.6) stand.
- [ADR-0091](0091-proof-bearing-builds-may-run-in-a-hosted-self-contained-work.md) /
  [ADR-0020](0020-red-green-enforcement-on-the-owned-loop.md) — the spine is the sole verdict signer,
  no verdict handed in — **upheld** (the landing tools run the gate and open a PR; they do not sign).
- [ADR-0022](0022-ci-green-gate-and-auto-merge.md) — CI re-proves green on the merge and auto-merges the
  non-draft PR — the independent gate, **unchanged** (the orchestrator never `gh pr merge`s).
- [ADR-0151](0151-lift-the-turn-cap-on-the-orchestrator-session-desktop-chat-t.md) — the prior increment
  of this arc (the orchestrator-session turn cap); sibling context.
- [ADR-0094](0094-go-green-is-a-status-transition-proposed-builds-mapped-adopt.md) / ADR-0136 /
  [ADR-0144](0144-chat-accepted-node-builds-run-the-real-proof-and-persist-the.md) — the human's
  forest-map Adopt/Build and per-node accept-to-land — **untouched** (this ADR is the merge ceremony for
  a driven unit, not auto-merge on a node click).
- Code: `packages/agent/src/spawn-tool-surface.ts` (the scoped-MCP / fail-closed pattern this landing
  surface mirrors); `packages/agent/src/headless-orchestrator.ts` (the mount seam);
  `packages/drive/src/spawn-deps.ts` (the real-deps composition pattern the landing deps mirror);
  `apps/desktop/electron/backend-entry.ts` (the operator-attested sidecar glue).
