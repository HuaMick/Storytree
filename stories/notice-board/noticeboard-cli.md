---
id: "noticeboard-cli"
tier: capability
story: notice-board
title: "The noticeboard command family — the board, declare, done"
outcome: "`storytree noticeboard` lists active sessions grouped by story node with staleness; `declare`/`done` write with worktree-derived identity."
status: proposed
proof_mode: integration-test
depends_on: [declare-presence, presence-store]
---

# The noticeboard command family — the board, declare, done

**Outcome —** `storytree noticeboard` lists active sessions grouped by story node with staleness;
`declare`/`done` write with worktree-derived identity.

> **Proof status (honest) — `proposed`, greenfield.** Nothing exists: no `noticeboard` command, no
> identity derivation, no board renderer. Every "proven by" below is a would-be test. ADR-0033 Decision 2
> fixes the design: the board is one of the CLI orientation surfaces, advisory only — it *shows*
> who is where; nothing refuses on overlap.

## Guidance

A new command family in `packages/cli` beside `library` and `node`/`story` builds, following the
ADR-0023 choose-your-own-adventure pattern (envelope with a `next` block of pointer commands —
e.g. `declare` points onward to `storytree tree <story>` to see the neighbours just joined).

- **Surface:** bare `storytree noticeboard` = the board — **active** sessions grouped by their
  declared story node, prose-only sessions under a no-node group, each row carrying the staleness
  band derived by `declare-presence`'s core logic (never recomputed ad hoc). Stale/done history is
  not the default view. `declare --working-on <prose> [--node <id>...]` and `done` are the writes.
- **Identity is derived, never typed (ADR-0033 Decision 1):** `declare` resolves `sessionId` from the
  enclosing worktree name and `branch` from git. There is deliberately **no flag** to type an
  identity — the flag's absence is the contract. Outside a recognisable worktree, `declare`
  refuses with guidance rather than inventing a name. No signer chain: presence is not proof.
- **Writes need `--pg`, reads degrade:** `declare`/`done` are refused without `--pg`, matching
  `library artifact edit` — refusal guidance (`pnpm db:up`, add `--pg`) goes in the envelope's
  `next`. This is the live-DB-only floor surfaced as a polite gate, not a crash.
- **Thin shell:** validation/merge/staleness live in `declare-presence` (core), persistence in
  `presence-store`; this capability owns only flag parsing, git/worktree resolution, grouping and
  rendering — so the board's truths are testable without a terminal.

## Integration test (would-be)

**Goal —** Against the store seam (in-memory), the command surface derives identity, gates writes
on `--pg`, renders the grouped + aged board, and `done` drops a session from the active view
without erasing its history.

Drive the command handlers with a fake git/worktree resolver and an `InMemoryStore`-backed
presence store: declare two sessions (one with `--node`, one prose-only), assert the board groups
and bands them; declare without `--pg` and outside a worktree, assert both refusals; run `done`
and assert the active board shrinks while the session's events remain readable via the store seam.

## Contracts (4)

1. **`identity-derived-not-typed`** — declare resolves identity from the worktree, never a flag
   - **asserts —** `declare` derives `sessionId` (worktree name) and `branch` from git; no flag
     exists to supply an identity; outside a recognisable worktree it refuses with guidance.
   - **proven by —** would-be `packages/cli/src/noticeboard.test.ts`
2. **`writes-need-pg`** — declare/done are refused without `--pg`
   - **asserts —** `declare` and `done` without `--pg` are refused (matching library artifact
     writes), with `pnpm db:up` guidance in the envelope's `next`; nothing is written.
   - **proven by —** would-be `packages/cli/src/noticeboard.test.ts`
3. **`board-groups-and-ages`** — the board groups by declared node and renders staleness
   - **asserts —** active sessions group under their declared story node, prose-only sessions
     under a no-node group, each row showing its derived staleness band; the default view is
     active-only.
   - **proven by —** would-be `packages/cli/src/noticeboard.test.ts`
4. **`done-drops-active-keeps-history`** — done leaves the board, history survives
   - **asserts —** after `done`, the session no longer appears on the active board, while its
     full event history remains readable via the store seam.
   - **proven by —** would-be `packages/cli/src/noticeboard.test.ts`
