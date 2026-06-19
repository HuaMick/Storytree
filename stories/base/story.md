---
id: "base"
tier: story
title: "The base port — the universal Store/ChangeStore document-event seam"
outcome: "Every organism that persists a document or reads a change event speaks one narrow, browser-safe Store/ChangeStore contract — a foundational root node that depends only on the verdict-contract root."
status: mapped
proof_mode: UAT
uat_witness: machine
capabilities: []
# SPIKE (claude/spike-port-vs-root, ADR-0074 A-vs-B exploration): under Option B base is an ordinary
# ROOT organism, not an exempt `substrate` class. It is a near-root: it depends only on the
# verdict-contract root (declared below), and the cli HUB imports it (declared provider-side here so
# the hub stays de-noised). Domain organisms that import it declare it consumer-side.
depends_on: [verdict-contract]
consumed_by: [cli]
decisions: [68, 74]
---

# The base port — the universal Store/ChangeStore document-event seam

> **SPIKE STORY.** Authored on the throwaway `claude/spike-port-vs-root` branch to prove Option B of
> the ADR-0074 A-vs-B port-modelling fork is viable (root organism instead of an exempt `substrate`
> class). Not for landing — see the live-library open-question `oq-port-class-vs-root-node`.

**Outcome —** Every organism that persists a document or reads a change event speaks one narrow,
browser-safe Store/ChangeStore contract — a foundational root node that depends only on the
verdict-contract root.

`packages/base` is the universal, browser-safe base seam (ADR-0068 step 5): the narrow `Store` /
`ChangeStore` document-event contract, the `InMemoryStore` reference, and
`StoredDoc`/`StoreEvent`/`DeleteDocOpts`/`retiredEventDoc`. The reusable `node:test` parity suites
live behind the `./parity` subpath so the main entry carries no `node:` import.

base depends only on `verdict-contract` (a real, declared root→root edge under Option B). It is the
second root node — `verdict-contract` is the bottom sink, `base` sits one rung above it. Because both
are roots, the **foundational-minimality** rule (a root may only depend on other roots) is satisfied
by construction, which is what keeps base browser-bundleable.
