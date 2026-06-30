---
status: accepted
decided: 2026-06-04
---

# ADR-0009: Concurrency, isolation & ID allocation

**Status:** accepted (2026-06-04; flipped from proposed 2026-06-21 under [ADR-0084](0084-agents-may-flip-an-adr-green.md)) — full rationale: v1 ADR-0013/0022/0025/0014.

**Correction ([ADR-0019](0019-library-tier-name-and-defer-dbos.md), per [ADR-0139](0139-the-accepted-adr-set-carries-no-stale-prose-correct-in-place.md)): the DBOS substrate this ADR assumes was DEFERRED.** The store is a plain typed Postgres connection now (ADR-0019), so the DBOS-based state-isolation and claim-row machinery described below is the deferred path, not the built one: git worktrees serve code-edit isolation (ADR-0012) and coordination claims are unbuilt. The CORE decision STANDS and is in fact built — parallel, conflict-free, **DB-allocated IDs** (the ADR-number allocator, [ADR-0050](0050-adr-number-allocation.md), realises exactly this).

## Decision

Back ADR-0001's "parallel + conflict-free IDs from day one" on DBOS/Postgres, and collapse v1's git+claims substrate (which only existed to fake a shared store v2 ships by default). *(The DBOS path was deferred by [ADR-0019](0019-library-tier-name-and-defer-dbos.md) — a plain typed Postgres connection now; the DB-allocated-IDs outcome below is nonetheless built, ADR-0050.)*

- **Isolation** = per-node DBOS workflow execution against **one shared Postgres event store** — *not* a git branch+worktree per session. *(Deferred by [ADR-0019](0019-library-tier-name-and-defer-dbos.md): DBOS is not built, and git worktrees ARE in fact the current code-edit isolation, ADR-0012.)*
- **Conflict detection** = a typed **claim** row naming write-ownership, checked under a serializable/unique constraint at **node-schedule time**; a conflict is a hard refusal (a typed event), never a warning.
- **One write-ownership vocabulary** (unifies v1's `declared_scope` / `does_not_touch`). *(Claims and this vocabulary are DBOS-DEFERRED — unbuilt per [ADR-0019](0019-library-tier-name-and-defer-dbos.md).)*
- **IDs are DB-allocated** (Postgres sequence or UUID + unique constraint), recorded as a typed event — dissolving **both** v1 collision classes, including *landed-but-unseen* (which a claims-gate structurally cannot catch). No hand-picked next integer. *(Built — [ADR-0050](0050-adr-number-allocation.md).)*
- The same discipline covers **v2's own ADR-number namespace** (the two-0021 / gap-0009 collisions were exactly this bug).

## Open

Git branch/worktree for the owned loop's *code edits*? · claim granularity / write-ownership shape · conflict-resolution ceremony · the ADR-number allocation scheme — all open-q §3 · channel open-q §5.
