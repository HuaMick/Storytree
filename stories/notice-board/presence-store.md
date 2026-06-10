---
id: "presence-store"
tier: capability
story: notice-board
title: "Declarations persist as append-only events plus a one-row-per-session projection"
outcome: "Declarations persist through the store seam as append-only events plus a one-row-per-session projection, atomically."
status: proposed
proof_mode: integration-test
depends_on: [declare-presence]
---

# Declarations persist as append-only events plus a one-row-per-session projection

**Outcome —** Declarations persist through the store seam as append-only events plus a
one-row-per-session projection, atomically.

> **Proof status (honest) — `proposed`, greenfield.** Nothing exists: no DDL, no store class, no
> tests. Every "proven by" below is a would-be test. ADR-0033 Decision 1 fixes the design: the
> house event+projection pattern — `events.session_event` (history) + `events.session` (current
> state), siblings of `events.comment*`, written together atomically. The registered (REAL-build)
> proof is the OFFLINE leg only — pure helpers + a fake transactional client; live SQL is
> live-gated and human-verified, never attested by a worktree PASS.

## Guidance

The would-be implementation is `packages/store/src/presence-store.ts` — a `PgPresenceStore`
mirroring `PgCommentStore` (the pattern ADR-0033 names): pure row↔doc helpers exported and
offline-tested, live SQL behind the live gate and human-verified. DDL is **additive** in
`packages/store/src/schema.sql` — two new tables under the existing `events` schema, nothing
altered.

- **One transaction per declare:** the event append and the projection upsert commit together or
  not at all — a history row with no projection (or vice versa) must be unrepresentable. This is
  the `PgCommentStore` shape verbatim; do not invent a second pattern.
- **The doc comes from `declare-presence`:** validation and upsert-merge semantics are the core
  capability's pure functions — this store persists the merged doc, it does not re-derive or
  re-validate presence logic of its own (the dependency edge in the story graph).
- **No signer chain, advisory writes:** presence is not proof (ADR-0033 Decision 1) — rows carry the
  worktree-derived `sessionId`, nothing is signed, and nothing here refuses on overlap. Failure
  modes are connection-shaped (DB down → throw to the caller, who degrades gracefully), never
  conflict-shaped.
- **Live-gated tests truncate ONLY their own tables.** The existing live store suite truncates the
  live **library** tables — a known trap. Presence tests touch `events.session_event` +
  `events.session` exclusively and run **per-file**, never as part of a blanket live sweep.
- **Cross-story seam (ADR-0010 §4):** the connection comes from the `library` story's
  `event-sourced-store-seam` (`createPool`, keyless IAM) — consumed, not absorbed.

## Integration test (would-be)

**Goal —** OFFLINE, against a fake transactional client (the registered, REAL-buildable proof):
a declare issues exactly one event insert plus one projection upsert inside one transaction,
re-declares upsert while history grows, and the surface exposes no history rewrite. The same
sequence against the live pg store is the **live-gated parity leg** — run per-file behind the live
gate and human-verified (the `PgCommentStore` posture), explicitly OUTSIDE the registered
REAL-build proof, which a DB-less worktree could never run honestly.

Declare once and assert one `events.session_event` insert and one `events.session` upsert were
issued in the same transaction with the same doc; re-declare with changed `workingOn`/`nodes` and
assert the projection updated in place (still one row) while history holds two events; mark `done`
and assert it is a third event plus a projection status flip, with all three history events still
readable in order.

## Contracts (3)

1. **`presence-event-plus-projection-atomic`** — each declare appends one event AND upserts the
   projection in one transaction
   - **asserts —** against the fake transactional client, a declare issues exactly one
     `events.session_event` insert and the matching `events.session` upsert between one
     BEGIN/COMMIT; an induced mid-write failure rolls back leaving neither (abort-together).
   - **proven by —** would-be `packages/store/src/presence-store.test.ts` (offline; live parity
     live-gated per-file)
2. **`one-row-per-session`** — the projection is keyed by `sessionId`
   - **asserts —** a re-declare for the same `sessionId` updates that projection row, never
     duplicates it; history grows by exactly one event per declare.
   - **proven by —** would-be `packages/store/src/presence-store.test.ts`
3. **`history-append-only`** — no update/delete path exists for events
   - **asserts —** the store surface exposes no way to update or delete a `session_event`; `done`
     is one more event plus a projection status flip, and the full ordered history stays readable
     after it.
   - **proven by —** would-be `packages/store/src/presence-store.test.ts`
