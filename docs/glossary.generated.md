# Glossary

Authoritative terminology for storytree. Every layer — `packages/core` types,
the orchestrator, the studio UI, and the ADRs — uses these words as defined
here. When a term's meaning is in question, **this file wins**. The reasoning
and the tier-boundary rules live in
[ADR-0002](decisions/0002-work-hierarchy-story-capability-contract.md).

## The work hierarchy

**story** — The top-level unit of work you watch grow, and a node on the DAG the studio renders. A **bounded context / organism** — self-contained and **independently deployable** (the microservice grain), *composed of capabilities*. The map grain: the thing a newcomer points at ("the event store", "the tree renderer"). A story is **proven as a whole by ≥1 integrated UAT** (acceptance walkthrough of the organism against real collaborators), not a pure rollup of its capabilities. Inside it capabilities share machinery (DRY is good); across stories behaviour is duplicated, not shared, except through a declared **boundary** (ADR-0010).

**capability** — An **organ within a story** (bounded context): independently viable, proven by ≥1 **integration test** against **real in-story collaborators** (no stubs within the organism), and composed of **contracts**. The within-story dependencies are drawn between capabilities (code-derived; see **dependency**). This is the unit v1 (Agentic) called a "story".

**contract** — A single **test-proven behaviour** within a capability: one automated, **isolated** unit test (collaborators stubbed). The leaf — the bottom rung of the proof ladder (unit → integration → UAT).

## Supporting terms

**node** — A unit being worked **on the DAG** — a story or capability under construction — driven by one owned-loop session inside a DBOS workflow. The coordination/scheduling grain: the thing the orchestrator schedules and the isolation/claim layer is keyed on.

**run** — A single per-node **execution** attempt, recorded as an event in the event store — many-per-node, never a new node. Here `run` is strictly the per-node execution attempt (ADR-0004; see `open-questions.md` §3, §8).

**UAT** — A prose journey, run end-to-end against *real* collaborators, that proves a **story** (the whole organism) meets its goal. Minimal-first: ship one that proves the goal, grow more as defects surface.

**contract test** — The automated test that proves a contract: the **isolated unit test** at the bottom rung of the proof ladder (unit → integration → UAT). Collaborators are stubbed, for fast feedback during the build.

**dependency** — A directed edge, defined at two altitudes (ADR-0010). **Within a story**, capability→capability edges are **code-derived** (static analysis of imports/calls): inside the boundary a dependency *is* the code coupling, read off the source, not hand-authored. **Across stories**, one story may depend on another **only** through a declared, documented **boundary** (§4) — hidden cross-story coupling is forbidden. You cannot prove a unit that stands on an unproven one.

**boundary** — The declared, documented seam between two stories — the **only** legal cross-story coupling: two organisms dependent to deliver an outcome but each still functioning in isolation against the seam, the way a frontend depends on a database.

**event** — A typed record of a state change (owned-loop events + orchestrator events) — the unit of observability. If a state change isn't an event the UI can render, it doesn't exist (ADR-0001, observability-first). Defined alongside the schema in `packages/core`. Includes operator-actor events (see **approval event / promotion event**), not just agent activity.

**event log** — The typed, **append-only** record in the event store — one row per state change — that is the single source of truth the studio renders and the only thing **written**. The artifact behind the `event` term.

**node rollup** — The current status and latest `verdict` **per** story / capability / contract, derived as a **projection** over the event log and never hand-maintained. A capability's lifecycle status (proposed / building / healthy; unhealthy computed) is *read off* the log, not written beside it. v2's answer to v1's per-build `runs`-grain mess (ADR-0006).

**owned-loop event stream** — The owned loop's structured lifecycle event stream (plus `edit`-tool diffs/patches) emitted as it works inside a node — the **agent-activity ingest channel** into the event store, normalized by `packages/agent`. One of exactly two defined ingest channels.

**approval event / promotion event** — Typed events with `actor = operator` recorded in the event store: an **approval / steering event** (a human in-loop intervention) and a signed **promotion event** (the human accepting a unit's green result onto the trunk, carrying operator identity and, for a story, the UAT verdict). Part of the same observability record as the owned loop's own activity (ADR-0008).

**DAG** — The directed acyclic graph the studio renders and watches grow. Stories are its visible nodes; capability dependencies are the fine-grained edges beneath. The exact inter-level grain is open (see ADR-0002 → "What this does NOT decide").

## Lifecycle (a capability's status)

Status lives on every tier (story / capability / contract); a **story**'s state is
not a pure rollup — it carries its own UAT proof (ADR-0010) on top of its
capabilities'. Carried from v1's lifecycle, with
`under_construction` renamed to **building** and the health metaphor kept (we did
*not* rename `healthy` to "proven" — "proven" stays as general proof-mode
language, `healthy` is the status word).

**proposed** — Authored but not yet selected for implementation. The initial state.

**building** — Selected and under active implementation (v1: `under_construction`). Written at pickup as the first commit, before any code edits.

**healthy** — Proven: the unit reached `healthy` through its tier's proof mode at HEAD — a story by a UAT pass over fresh green capabilities, a capability by integration tests over fresh green contracts, a contract by its isolated unit test (or, where neither honest test exists, operator-attested) (ADR-0010).

**unhealthy** — A once-healthy capability that has drifted (a contract test now fails, owned files changed, or the proof no longer matches HEAD). **Computed** from evidence, never written to disk.

**mapped** — Brownfield: the capability is *observationally* verified by an existing target-repo test suite, without storytree driving a red→green flow. v2 **supports** brownfield; the exact mapping mechanism under the owned loop / DBOS is still to design (see `open-questions.md` §2).

**retired** — Terminal off-tree state: pruned from the active tree. May carry `retired_reason` (prose) and `superseded_by` (an edge to its replacement).

## Proof, evidence & gating

**gate** — A structural enforcement point that **refuses** invalid work rather than warning. storytree keeps the commit-time / promotion gate (ADR-0001 cites it as a proven v1 idea).

**Proof mode** — The mechanism by which a unit earns `healthy`, one rung per tier (ADR-0010). `packages/core` encodes these as a discriminated `proof_mode` union (ADR-0007). The four modes are:

- **UAT** (story) — an honest scripted acceptance walkthrough against *real* collaborators, proving the whole organism end to end.

- **integration-test** (capability) — the organs wired against *real in-story collaborators* (no stubs within the organism).

- **contract-test** (contract) — one isolated automated assertion (collaborators stubbed; the mock-UAT seam permits it).

- **operator-attested** — a per-unit, operator-granted signed event for surfaces with neither an honest UAT nor an isolatable test. An agent can never self-exempt.

**operator-attested** — A proof mode (alongside UAT, integration-test and contract-test) for behavioural/guardrail surfaces that have neither an honest scripted UAT nor an isolatable automated test — e.g. the orchestrator's own routing / approval / steering discipline. Promotion to `healthy` is an explicit, per-unit, **operator-granted** attestation recorded as a typed **signed event**; an agent can never self-exempt, and the attestation is distinguishable in the audit trail from a UAT walkthrough sign.

**convergence** — Two **distinct** senses v1 conflated and v2 keeps separate; always qualify which is meant. (1) *DAG-stabilisation* — the dependency DAG is iterated to a fixed point before any unit goes red (owned by the decomposition/scheduler loop; see `open-questions.md` §4). (2) *cold-rebuild* — see the separate `cold-rebuild` definition.

**per-node budget** — A code-enforced ceiling (iterations / token-cost / wall-cost — exact unit TBD) on a node's spine loop. The loop terminates on green **or** budget-exhausted, the latter a typed terminal event with per-round cost visible in the event store. Resurrected for pay-as-you-go (ADR-0005), inverting v1's "cascade rounds are not a cost".

**approval** — A first-class, typed operator act (`actor = operator`) in which the human accepts an agent action, or a capability's green result, **onto the trunk** via the studio. The trunk is **approval-gated**: a green signal is a *request for human diff-review*, not an automatic merge (inverts v1's auto-merge-on-green).

**verdict** — The Pass/Fail outcome of a story's UAT. Reserved for UAT outcomes.

**evidence** — The forensic record that a unit's tests went red→green and its story's UAT was signed: an audit trail.

**proof hash** — A hash of a unit's proof-bearing content (outcome, contracts, …) that invalidates a prior verdict when the content changes.

**mock-UAT seam** — **No mocks within an organism**: capability integration tests and the story UAT both run against real in-story collaborators. The one stubbable boundary is the declared cross-story **boundary** — a story's UAT may run against a stubbed / contract-tested version of an upstream story's interface (like acceptance-testing a frontend against a stubbed database). Isolated unit (contract) tests still stub freely.

## Principles & patterns (carried from v1)

**inner loop / outer loop** — **inner loop** = driving one unit from red to green (automatable, owned by an owned-loop node). **outer loop** = accepting a result onto the trunk, accepting a decomposition, or amending / retrying / abandoning a unit (held by **human judgment** in the studio). The human-in-the-loop gate sits at the outer loop; the north-star may later dissolve it.

## Unit fields

**outcome** — A capability's plain-English, single-sentence value statement, with no conjunctions — if it needs them, split the unit instead.

**guidance** — Non-obvious technical context needed to rebuild a unit; only what an agent could not derive from outcome + proof.

**title** — A short human label for a unit; it is not load-bearing for proof.

**id** — A unit's unique identifier. v2 must allocate these **conflict-free across concurrent sessions** — a stated goal; the DBOS spike validated durable, collision-free workflow IDs as one mechanism.

## Concurrency & isolation

**claim** — A typed **write-ownership** record (a row/event in the one shared event store) naming what a node intends to write, checked under a serializable/unique constraint at **node-schedule time**; a conflict is a **hard refusal** (a `claim-conflict-refused` event), never a warning.

Granularity, the conflict-resolution ceremony, and whether code *edits* still use a git branch/worktree per node are open (`open-questions.md` §3).

**write-ownership** — The single vocabulary for *what surface/unit* a node claims the right to write, used by the claim / conflict-detection layer. It unifies v1's scattered terms (`declared_scope` vs per-agent `does_not_touch`) into one concept (ADR-0009); the exact shape (node-scoped vs file-glob) is open (`open-questions.md` §3).

## Studio & tooling

**studio** — The live PixiJS web IDE that renders the tree and **drives** the agents (diffs, approvals, steering, per-node chat).

**orchestrator** — The thin custom TypeScript layer (`packages/orchestrator`) over DBOS/Postgres (ADR-0001): it owns the story-DAG, the scheduler, and the event store, and is the **only** module that drives `packages/agent` (the owned loop). It is the code-sequenced **spine** and the sole **fan-out** point — it schedules nodes; owned-loop nodes never schedule child nodes.

**spine** — The code-sequenced control-flow layer (the orchestrator over DBOS workflows) that owns **closed, deterministic routing**: the order steps run in, when a loop iterates, which branch is taken. The discriminator (carried verbatim from Agentic ADR-0026): *if a for-loop or a match could express the routing, the spine owns it; if the routing needs the model to decide what comes next, the leaf (owned-loop node) owns it.*

**leaf step / leaf judgment** — A single step in a code-sequenced cascade whose work is owned by the **owned loop** (what to write, how to satisfy a contract) rather than by the spine — the **control-flow** sense of "leaf" (ADR-0005, ADR-0011).

**agent package** — The project-owned **thin wrapper** (`packages/agent`) and typed-event parser over the owned loop's surface (`prompt` / `steer` / `follow-up` + lifecycle events + `edit`-tool diffs). It owns the loop on the Messages API and is the **sole** surface through which the owned loop is invoked and the **only** place a model runtime is imported: it spawns/steers the owned loop, normalizes its stream into the typed events the event store renders, and exposes nothing model-shaped upward.

**trunk** — The canonical **integrated mainline** a capability lands on once **approved**. In v2 the trunk is **approval-gated** (a human admits a green result), never auto-merge-on-green, and never holds knowingly-broken intermediate states (ADR-0008).

**steering** — A first-class, typed operator act of **redirecting an in-flight owned-loop run mid-execution** (the owned loop's `steer` operation), recorded as an event in the event store.

**ADR** — An Architecture Decision Record under `docs/decisions/`, capturing a cross-cutting decision.

**fixture** — A test-supporting artifact (data file, scaffold, temp crate) created during a walkthrough and cleaned up before signing.

**ndjson** — Newline-delimited JSON; the line-delimited record format, a candidate backing for the event stream.

**asset** — In storytree, a **tree/game art asset** for the isometric renderer (ADR-0001, deferred).

## v1 → v2 term map

For reading v1 (Agentic) docs. Left = what v1 wrote; right = how to read it here.

| v1 term | storytree |
|---|---|
| story | **capability** (the in-story provable unit, now integration-proven; ADR-0010) |
| epic | a grouping — closest is **story**; a dedicated epic tier is deferred |
| `contract.yml` (per-agent) | — dropped (v2 has no per-agent contract file) |
| "story is a contract" / red-green | the **red-green** principle / a capability's proof — not the noun `contract` |
| acceptance / acceptance.tests | a story's **UAT** + its capabilities' **integration tests** + their **contract tests** (ADR-0010) |
| depends_on / predecessor / prerequisite | **dependency** (in-story: code-derived; cross-story: via a **boundary**; ADR-0010) |
| under_construction | **building** |
| healthy / proven | **healthy** |
| dashboard | **studio** |
| `manual_signings` (ADR-0024) | **operator-attested** proof mode (ADR-0007) |
| `session_claims` table (ADR-0022) | **claim** in the shared store (ADR-0009) |
| `declared_scope` / `does_not_touch` | **write-ownership** (one vocabulary; ADR-0009) |
| `runs` / `test_runs` (per-build) | a per-node **run** (execution event) + the **node rollup** projection (ADR-0004, ADR-0006) |
| auto-merge-on-green trunk | the **approval-gated trunk** (human admits green; ADR-0008) |
| asset (shared DRY content) | — dropped; in storytree **asset = tree art** (ADR-0001) |
| pattern (the `patterns/` subsystem) | — dropped; named patterns (e.g. standalone-resilient-library) carry |
| deployment (v1, ×3 overload) | — not carried; v1 conflated VCS-exclusion vs runtime-artifact-exclusion (ADR-0003) — guard against the overload, do not reintroduce the word |
