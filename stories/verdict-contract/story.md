---
id: "verdict-contract"
tier: story
title: "The verdict-contract port — the shared verdict vocabulary at the root of the graph"
outcome: "Every organism that reads or writes a verdict speaks one zod-validated, browser-safe verdict SHAPE — the foundational root node the whole graph points at, depending on nothing."
status: mapped
proof_mode: UAT
uat_witness: machine
capabilities: []
# SPIKE (claude/spike-port-vs-root, ADR-0074 A-vs-B exploration): under Option B verdict-contract is
# an ordinary ROOT organism (a true sink), not an exempt `substrate` class. depends_on: [] makes it
# the bottom root the merged graph rests on; the cli HUB imports it, declared provider-side here so
# the hub stays de-noised (the same pattern library/store use). Domain organisms that import it
# declare it consumer-side in their own depends_on.
depends_on: []
consumed_by: [cli]
decisions: [68, 74]
---

# The verdict-contract port — the shared verdict vocabulary at the root of the graph

> **SPIKE STORY.** Authored on the throwaway `claude/spike-port-vs-root` branch to prove Option B of
> the ADR-0074 A-vs-B port-modelling fork is viable (root organism instead of an exempt `substrate`
> class). Not for landing — see the live-library open-question `oq-port-class-vs-root-node`.

**Outcome —** Every organism that reads or writes a verdict speaks one zod-validated, browser-safe
verdict SHAPE — the foundational root node the whole graph points at, depending on nothing.

`packages/verdict-contract` is the published verdict SHAPE (ADR-0068 §3): zod DATA shapes + validators
(`Verdict`/`ProofMode`/`SigningRow`/`EvidenceRef`/`ChangeEvent`/`DriftFlag`/`Attestation`/`anchor`,
plus the duplicated `Tier`/`Status`). Browser-safe, zod-only — readers `.safeParse()` verdict-DATA
across the boundary and never import the proof machinery. It depends on **nothing**: it is the true
sink at the bottom of the dependency order.

Under Option B this is modelled as a root organism (`depends_on: []`) exactly like `library`, rather
than as a member of an exempt `substrate` class. Everyone who imports it declares a real edge —
making the dependency UI-visible in the world, which is ADR-0074's whole thesis (visibility over
exemption, §2).

## Minimality (the property the `substrate` class used to guarantee)

verdict-contract MUST stay zod-only and node/pg-free so the studio's browser bundle works. Under the
`substrate` class this was a gate rule ("substrate may not depend on an organism"). Under Option B
that guarantee is carried by the **foundational-minimality** rule (a root/port may only depend on
other roots/ports) plus the studio browser build as the backstop — see the open-question for the
trade-off the owner is deciding.
