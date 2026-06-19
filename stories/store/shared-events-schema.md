---
id: "shared-events-schema"
tier: capability
story: store
title: "One events schema hosts every organism's history plus current-state projection"
outcome: "One events schema hosts every organism's append-only history plus a current-state projection (library docs, presence, members, work verdicts) under transactional upsert."
status: mapped
proof_mode: integration-test
depends_on: [keyless-store-connection]
---

# One `events` schema hosts every organism's history plus current-state projection

**Outcome —** One `events` schema (`packages/store/src/schema.sql`) hosts every organism's
append-only history plus a one-row current-state projection — library docs, presence sessions,
members, work verdicts — written under transactional upsert.

## Guidance

- Every write appends an event AND updates the projection in the SAME transaction (the house
  event-sourced pattern), so history and current state can never diverge.
- The schema is shared substrate for the organisms that own the per-domain seams: `PgLibraryStore`
  (library docs/comments), `PgPresenceStore` (notice-board sessions), `PgUserStore` (studio-members),
  the work/verdict log (drive machinery's verdict-DATA, read via the `verdict-contract` port). The
  store is their live realization; the per-kind validation runs at the library write boundary, not
  here.
- The `InMemoryStore` reference impl (`@storytree/base`) and `PgLibraryStore` are held to ONE
  exported parity suite, so the Postgres impl is a real abstraction, not a 1-impl stub.

## Contracts (2)

1. **`event-plus-projection-atomic`** — a write is history + projection in one transaction
   - **asserts —** an upsert through the seam appends exactly one history event and leaves exactly
     one projection row; a re-read returns the latest; the parity suite holds for both `InMemoryStore`
     and `PgLibraryStore`.
2. **`schema-shape-stable`** — the DDL declares the events tables every organism reads
   - **asserts —** `schema.sql` applies cleanly and declares the history + projection tables the
     per-domain stores write (smoke-applied in the suite setup).
