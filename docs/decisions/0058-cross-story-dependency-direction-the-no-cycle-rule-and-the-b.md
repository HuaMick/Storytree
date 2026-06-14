---
status: accepted
decided: 2026-06-15
amends: [10]
---
# ADR-0058: Cross-story dependency direction, the no-cycle rule, and the brownfield exit hatch

## Status

accepted (2026-06-15) — owner decisions in a design conversation (2026-06-15). **Amends**
[ADR-0010](0010-organism-model-story-bounded-context.md) (the organism model): ADR-0010 established
the two-altitude dependency model and the cross-story boundary, but left the *direction* of a
cross-story edge, the stance on *cycles*, and the *rollup* of capability-level boundary edges to the
story node undefined. This ADR fills those gaps and generalises the `journey-principle`'s "user" to
"consumer." It does not change the proof ladder, the boundary concept, or the mock seam — those stand.

## Context

`stories/ci-cd` landed modelling the CI/CD pipeline as a "trunk organism" like `stories/library`:
`depends_on: []`, with two capabilities reaching cross-story — `merge-presence-retire` →
notice-board's `presence-store`, and `deploy-on-merge` → studio-cloud's `cloud-run-iap`. The framing
was "CI/CD exists on its own and delivers nothing standalone, but everything's delivery rides on it."

That surfaced a modelling tension ADR-0010 did not settle:

- **The owner's rule** — a story depends on what it needs *upstream* to deliver *its* journey. By
  that rule ci-cd is **not** edgeless: `deploy-on-merge` needs a studio to deploy *to*, and
  `merge-presence-retire` needs a presence store to write *to*.
- **An apparent cycle** — studio-cloud's surface is *kept fresh* by ci-cd's `deploy-on-merge`, which
  reads as studio-cloud → ci-cd; combined with ci-cd → studio-cloud that is a story-level cycle
  ("symbiotic conjoined twins"). The landed story papered over it by asserting "studio-cloud doesn't
  depend on ci-cd" without a rule that forces the question.
- **A "trunk = depended-upon-by-many" intuition** that did not reconcile with "depends on what you
  need upstream," and a stalled guidance proposal to add an *exception* to the journey-principle for
  "substrate" organisms plus a "foundational (substrate) story" glossary term.

Investigating the live graph dissolved most of this; the rest needed a stated rule. dbt is the
reference point: dbt builds a model DAG from `ref()`/`source()` and **forbids cycles** — a cycle is a
compile/run error (`Found a cycle: …`), the build refuses, and the author must refactor to
one-directional flow. For *apparent* cross-project mutual dependency dbt forces a **stepwise acyclic
order through declared public model contracts** — the analogue of storytree's cross-story boundary.
dbt never needs a brownfield escape because every dbt node is authored; storytree is broader (it also
*maps* existing architecture, ADR-0010 `mapped`), which is the one place a real cycle can be ground
truth rather than a defect.

## Decision

### 1. The dependency-direction rule

**Story A depends on story B if and only if A needs B's *delivered outcome* (consumed through B's
declared boundary) as a precondition to pass A's own UAT.** This makes "depends on what you need
upstream" testable: take any pair and ask the question *both ways*; the answer that is "yes" gives the
edge direction. If both directions are "yes," you have a cycle (§4).

Worked on the trigger pair:

- Does **ci-cd** need studio-cloud's outcome to deliver its own? **Yes** — `deploy-on-merge` needs
  the Cloud Run + IAP service as a deploy *target*; `merge-presence-retire` needs notice-board's
  presence store as a write *target*. → **ci-cd → studio-cloud, notice-board.**
- Does **studio-cloud** need ci-cd's outcome to deliver its own? **No** — studio-cloud serves a
  snapshot image; a trusted dev signs in and comments against whatever is deployed, with no pipeline
  running. The "kept fresh" value is **ci-cd's** authored outcome ("the surfaces that ride on trunk
  *stay fresh*"), **not** studio-cloud's ("interacts with the *live* studio" — no freshness claim, no
  deploy leg in its UAT). → **no edge back.**

The apparent cycle was an artifact of **double-counting one outcome** ("freshness") into both
stories. Allocated to exactly one story (ci-cd), the direction falls out one-way and the graph is
acyclic.

### 2. "Trunk / substrate" is an emergent shape, not a distinct concept

A "trunk" or "substrate" story is simply the **emergent shape of a root** (`depends_on: []`) that
**many** other stories declare as a dependency — `library` is the exemplar (every other story depends
on it; it depends on nothing). There is no separate "foundational story" tier, no schema flag, and no
exception to any principle. A story earns the shape by *being depended upon*, not by declaration.

ci-cd does **not** have that shape. It has two *outbound* cross-story dependencies and **zero
inbound** edges (no story's outcome needs ci-cd *delivered* — "landing through CI" is not part of any
story's journey). The "everything's delivery rides on ci-cd" truth is real but lives on a **different
axis** than the dependency DAG: the dependency graph models *"what must be delivered before I can
deliver my outcome"*; ci-cd's universality is a *process/delivery* fact (how any unit reaches `main`).
The dependency graph deliberately does **not** encode that process axis — drawing it as inbound edges
(everything → ci-cd) would be noise, and treating it as root-ness mislabels a consumer story as a
trunk.

### 3. Capability-level boundary edges roll up to the story's `depends_on`

When a capability of story A consumes a capability of story B through a declared boundary
(ADR-0010 §4), story A **depends on** story B, and B appears in A's story-frontmatter `depends_on`.
This is the convention already followed by `notice-board` (`[library, drive-machinery]`) and
`studio-cloud` (`[studio, library]`); it is now stated. A story's `depends_on` is the union of its
capabilities' cross-story boundary targets. Omitting a real outbound edge because the reliance "feels
foundational" (as ci-cd's `[]` did) is a modelling error.

### 4. The cross-story graph is acyclic on every proven path; cycles are resolved, not tolerated

Like dbt, storytree treats a **cycle in the proven/greenfield graph as a modelling error**, because
the prove-it-gate must topologically order the graph to drive units red→green in dependency order
(you cannot prove a unit that stands on an unproven one). An author hitting an apparent cycle works
the **resolution ladder**, cheapest first:

1. **Re-allocate the double-counted outcome.** The usual cause (and the cause here): one deliverable
   is being claimed by both stories. Assign it to exactly one; the direction goes one-way. *No
   structural change — just honest outcomes.*
2. **Extract a shared upstream.** If both genuinely need a common thing, factor it into a third
   upstream story both depend on (dbt's "extract the shared model"; storytree's existing trunk
   organisms like `library`).
3. **Re-bound into one story** — only if the `journey-principle` + `splitting-rule` say it is
   genuinely **one** journey (one consumer population, one rebuild brief). This is the last resort and
   is gated by those rules, so a cycle never *forces* a bad merge. *(For ci-cd + studio-cloud it does
   not apply: distinct consumer populations — a contributor landing code vs a trusted-circle member
   leaving a comment — and two separate rebuild briefs. Keep them separate.)*

Cross-story coupling is always a **directional declared boundary** (provider/consumer), never a
mutual edge. A machine acyclicity gate over the story graph is enabled by this rule but is **not built
here** (a candidate follow-up, the storytree analogue of dbt's compile-time cycle check).

### 5. The brownfield exit hatch is `mapped` — not a new construct

The acyclicity invariant binds where the graph is **topologically ordered** — i.e. driven through the
prove-it-gate toward `healthy` (greenfield). A **`mapped`** graph (ADR-0010: observational,
brownfield, "never short-circuits to proven") is only ever *observed*, never *driven*, so a cycle in
it cannot break the build ladder. A real architecture being mapped **may** contain a cycle; storytree
records it as a **flagged, visible cyclic-dependency defect** — never refused, never `healthy`. This
is the same greenfield/brownfield honesty seam storytree already runs, applied to topology:

- Mapping bad architecture and **surfacing its cycles** becomes a feature, not a failure.
- A cyclic unit **cannot** earn `healthy` (it cannot be topo-ordered/proven), so the recorded cycle
  is the explicit refactor backlog — healing a mapped cycle toward `healthy` *requires* breaking it.

There is **no** general per-edge "accepted cycle" override. The only escape is `mapped`, because that
is the only state where the acyclicity requirement does not bind.

### 6. The journey-principle is about a *consumer* journey; substrate stories are inside it

The `journey-principle` generalises **"user" → "consumer"**: a story encompasses one complete
*consumer* journey, where the consumer may be a **person, an agent, or another story/surface**.
Substrate stories (`library`, `ci-cd`) **have** a journey — their consumer is an agent or a
contributor, not an end-user — so they are **inside** the principle, not an exception. The stalled
proposal to add a journey-principle *exception* and a "foundational (substrate) story" glossary term
is **rejected** as drift: the shape is emergent (§2), and the sizing question (whether to split)
applies to substrate stories identically.

## Consequences

- **Amends ADR-0010** — adds the direction rule (§1), the trunk-as-emergent-shape clarification (§2),
  the edge-rollup convention (§3), the acyclicity invariant + resolution ladder (§4), and the
  brownfield `mapped` hatch (§5); generalises the journey-principle consumer wording (§6). ADR-0010's
  proof ladder, boundary concept, and mock seam are unchanged.
- **Library doctrine (live + seed, coordinated write):** `journey-principle` is reworded
  ("user" → "consumer"; no exception), and a new `cross-story-dependency` **principle** distils §1–§5
  for `story-author` to consume. Both are wired into the `story-author` agent and regenerate its
  `.claude/agents/story-author.md`.
- **`stories/ci-cd` graph corrected** — `depends_on: [] → [studio-cloud, notice-board]`; the
  "trunk/edgeless" framing is replaced by the §2 process-axis framing. Verified acyclic globally:
  studio-cloud → [studio, library] and notice-board → [library, drive-machinery] never reach ci-cd,
  and ci-cd has zero inbound edges. `library` remains the genuine trunk (root depended-upon by all).
- **A machine acyclicity gate becomes possible** (§4) but is deferred; today the rule is authoring
  doctrine enforced by review, like cold-rebuild.
- **Cost:** one more principle in the corpus, and a one-time correction of a just-landed story's
  frontmatter and prose. The benefit is that "trunk," "direction," and "cycle" are now decidable by a
  rule instead of intuition.

## References

- [ADR-0010](0010-organism-model-story-bounded-context.md) (organism model — amended here),
  [ADR-0002](0002-work-hierarchy-story-capability-contract.md) (work hierarchy).
- `docs/glossary.md` — `dependency`, `boundary`, `mapped`, `story`.
- Library principles `journey-principle`, `splitting-rule`, `cross-story-dependency`.
- `stories/ci-cd/story.md`, `stories/studio-cloud/story.md`, `stories/notice-board/story.md`,
  `stories/library/story.md`.
- dbt — cycle errors and project dependencies:
  https://docs.getdbt.com/docs/collaborate/govern/project-dependencies
- Design conversation, 2026-06-15 (the freshness-double-count diagnosis and the mapped-hatch call).
