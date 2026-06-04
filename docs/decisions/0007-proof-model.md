# ADR-0007: Proof model

**Status:** proposed (2026-06-04) — full rationale: v1 ADR-0005/0006/0008/0024/0027.

## Decision

Operationalize ADR-0002's three proof modes, and add a third.

| Tier | Proven by | Collaborators |
|---|---|---|
| contract | one isolated automated test | stubbed (mock-UAT seam permits it) |
| capability | ≥1 integrated UAT + its contracts green | **real** — also generates `dependency` edges |
| story | composition (its capabilities proven) | — |

- **Mock-UAT seam:** stubs are correct in a contract test, a **structural defect** in a UAT.
- **Red-before-green** is a structural discipline at the **contract** level, enforced by the spine over pi's stream (not by splitting agents). The red/green records are **forensic evidence, not a promotion gate**.
- **Third mode — `operator-attested`** (dogfood-only): for surfaces with neither an honest UAT nor an isolatable test (e.g. the orchestrator's own routing/approval discipline). Promotion is an explicit, per-unit, operator-granted **signed event**; an agent can **never** self-exempt; it is distinct in the audit trail from a UAT sign, and it reaches `healthy` (unlike `mapped`). **Overrules v1 0028-D16.**
- **Cold-rebuild = the health invariant:** a unit is `healthy` iff a cold agent (its spec + transitive upstream specs only) can drive it red→green. (Distinct from the DAG-stabilisation sense of convergence — open-q §4.)

## Open

Proof/attestation persistence + signer identity (open-q §1) · who signs a UAT promotion (ADR-0008) · brownfield `mapped` mechanism (open-q §2).
