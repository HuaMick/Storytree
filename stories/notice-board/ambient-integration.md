---
id: "ambient-integration"
tier: capability
story: notice-board
title: "Presence declares itself — spine-side, fail-silent hooks, a statusline glance"
outcome: "Presence declares itself: spine-side around SDK builds, fail-silent session hooks, a statusline glance — never via a blocking-capable hook."
status: proposed
proof_mode: integration-test
depends_on: [noticeboard-cli, tree-view]
---

# Presence declares itself — spine-side, fail-silent hooks, a statusline glance

**Outcome —** Presence declares itself: spine-side around SDK builds, fail-silent session hooks, a
statusline glance — never via a blocking-capable hook.

> **Proof status (honest) — `proposed`, greenfield.** Nothing exists: no spine wiring, no hook
> scripts, no statusline command. Every "proven by" below is a would-be test. ADR-0033 Decision 3
> fixes the design: the automation ladder is all advisory, and the V1 hook-loop lesson is encoded
> structurally — see the ADR for the lesson itself.

## Guidance

This is the automation rung of the board: presence appears without anyone typing `declare`. Every
path here is **advisory by construction** (ADR-0033 Decision 3) — a presence failure never fails,
blocks, or even speaks into the enclosing action.

- **Spine-side, no hooks:** `node build`/`story build` (`--live`/`--real` with `--store pg`)
  declare presence in plain code around the SDK leaf — node id in `nodes`, run id in the
  `workingOn` prose — and mark `done` in a `finally`. Deterministic, testable, hook-free; it goes
  through the same store path the `noticeboard` CLI uses.
- **Session hooks fire-and-forget:** `SessionStart`/`SessionEnd` shell wrappers around
  `noticeboard declare`/`done` always `exit 0`, bound their runtime with a short timeout, and stay
  silent when the DB is down (the live-DB-only / degrade-gracefully floor). They land SHARED in
  the repo's `.claude/settings.json` — every session gets them (owner call 4, resolved 2026-06-11
  — ADR-0033 Owner decisions); the fail-silent contract is what makes shared safe.
- **Statusline is the glance — and the heartbeat:** the read surface — one line (active count, own
  node, overlap warning) from the `events.session` projection; any failure renders an empty
  string, which cannot loop the agent. It ALSO bumps the session's `lastSeenAt` on render,
  debounced and fail-silent (owner call 2, resolved 2026-06-11 — ADR-0033 Owner decisions: a board
  that cries stale on live sessions teaches people to ignore it).
- **The guardrail is a contract, not a convention:** no notice-board automation may register on a
  blocking-capable hook (`Stop`, `PreToolUse`, `UserPromptSubmit`) — asserted by a config audit,
  so a future "helpful" hook fails red.

## Integration test (would-be)

**Goal —** Presence appears around a build, hooks and statusline degrade to silence, and nothing
notice-board-shaped sits on a blocking-capable hook.

Run a scripted `node build` with a presence store that records calls: assert declare-before-leaf
and done-in-finally; rerun with a store that throws and assert the build result is byte-identical.
Run the hook wrappers and statusline command with the DB unreachable: exit 0, no output, bounded
time. Audit `.claude/settings.json` for forbidden hook events.

## Contracts (4)

1. **`spine-declares-around-builds`** — builds declare presence; a presence failure never fails a build
   - **asserts —** `node build`/`story build` (`--live`/`--real`, `--store pg`) declare (node id,
     run id prose) before the leaf runs and mark done in a `finally`; with a presence store that
     throws on every call, the build result is unchanged.
   - **proven by —** would-be `packages/cli/src/ambient-presence.test.ts`
2. **`session-hooks-fail-silent`** — the SessionStart/SessionEnd wrappers cannot hurt a session
   - **asserts —** (offline legs) the declare/done wrapper scripts exit 0 on DB-down and bad
     input, complete within their timeout bound, and emit nothing when the DB is down; the
     successful pass-through is asserted against a faked store. The real DB-up pass-through is
     live-gated/human-verified, outside the registered proof.
   - **proven by —** would-be `packages/cli/src/ambient-presence.test.ts` (offline; DB-up leg
     live-gated)
3. **`statusline-glance`** — the statusline renders a one-line board summary or nothing
   - **asserts —** with a reachable projection the command prints one line (active count, own
     node, overlap warning) and bumps the session's `lastSeenAt` (debounced — repeated renders
     inside the debounce window write once); on any failure it prints the empty string, writes
     nothing, and exits 0.
   - **proven by —** would-be `packages/cli/src/ambient-presence.test.ts`
4. **`never-blocking-hooks`** — no notice-board hook on a blocking-capable event
   - **asserts —** a config audit of `.claude/settings.json` finds no notice-board hook registered
     on `Stop`, `PreToolUse`, or `UserPromptSubmit`.
   - **proven by —** would-be `packages/cli/src/ambient-presence.test.ts`
