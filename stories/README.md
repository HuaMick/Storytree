# stories/ — storytree's own story tree (the seed)

This directory is the **seed of the self-building tree**. storytree's north star is to
build itself — agents author, test, and UAT-prove stories on a DAG. There is no
orchestrator or store yet (`packages/core` is a stub), so this first tree is authored
**by hand** — the bootstrap "midwife" step — by decomposing what was really built into
the [ADR-0002](../docs/decisions/0002-work-hierarchy-story-capability-contract.md)
work hierarchy. It is a hand-authored **specification of already-built code**, not the
output of a real orchestrator run.

The first (and currently only) story is **[`studio-foundation/`](studio-foundation/story.md)** —
`apps/studio`, decomposed into 7 capabilities and 80 contracts.

## The representation

A **file per unit**, as YAML-frontmatter markdown. Frontmatter carries the
identity/graph fields (machine-friendly, schema-ready for `packages/core`); the body
carries the prose proof (human-reviewable, and rendered natively by the studio, which
already reads markdown).

```
stories/
  README.md                          ← this file
  <story-slug>/
    story.md                         ← tier: story   — lists its capabilities + the dependency graph
    <capability-slug>.md             ← tier: capability — guidance + UAT + its contracts inline (the leaf)
```

Three tiers, one per ADR-0002 grain. **Stories** and **capabilities** each get a file;
**contracts** (the fine leaf — there are 80) live **inline** in their capability file as
a numbered list, each with its single assertion and the real code it covers. Keeping
contracts inline keeps the tree legible (8 files, not 88) while staying fully
ontology-aligned; promoting a contract to its own file later is a mechanical change.

Dependencies are **capability → capability** edges, stored inline as each capability's
`depends_on:` list (the story file also renders the whole graph with the UAT reason for
every edge). The graph is acyclic.

### Field → ADR-0002 / glossary mapping

| field | where | tier | meaning | source |
|---|---|---|---|---|
| `id` | frontmatter | all | unique slug | glossary *id* |
| `tier` | frontmatter | all | `story` / `capability` / `contract` | ADR-0002 |
| `title` | frontmatter | all | short human label (not load-bearing for proof) | glossary *title* |
| `outcome` | frontmatter | story, capability | one-sentence value statement, **no conjunctions** | glossary *outcome* |
| `status` | frontmatter | story, capability | lifecycle state | glossary *Lifecycle* |
| `proof_mode` | frontmatter | capability | `capability-UAT` / `contract-test` / `operator-attested` | [ADR-0007](../docs/decisions/0007-proof-model.md) |
| `capabilities` | frontmatter | story | the story's composition (the map grain) | ADR-0002 |
| `depends_on` | frontmatter | capability | UAT-generated upstream edges | glossary *dependency* |
| **Guidance** | body | capability | non-obvious context to rebuild the unit | glossary *guidance* |
| **UAT** | body | capability | prose walkthrough vs **real** collaborators (no mocks) | glossary *UAT* |
| **Contracts** | body | capability → contract | the test-proven leaf behaviours | glossary *contract* / *contract test* |
| `asserts` / `covers` | per contract | contract | the single isolated assertion + the real code it tests | ADR-0002, glossary *contract test* |

### The proof-mode boundary (the rule that tiers a unit)

- **story** — a grouping; proven purely when its capabilities are proven.
- **capability** — independently viable; proven by ≥1 integrated **UAT** against real
  collaborators (a standalone end-to-end walkthrough is honest for it). The unit
  dependencies are drawn between.
- **contract** — one **isolated automated test** (collaborators stubbed); no walkable
  journey of its own.

## Continuity with v1 (the Agentic corpus)

storytree v2 reshapes v1's two-tier `epic → story` into three tiers, and this seed reuses
v1's proven on-disk vocabulary so the lineage stays legible:

| v1 (`C:\code\Agentic`) | here (v2) |
|---|---|
| `epics/live/<slug>/epic.yml` (groups stories) | a **story** (`story.md`) — the map grain |
| `stories/<id>.yml` (UAT-proven unit) | a **capability** (`<slug>.md`) |
| `acceptance.tests[]` (test file + justification) | a **contract** (named, with `asserts` + `covers`) |
| `acceptance.uat` (prose walkthrough) | the capability's **UAT** section |
| `depends_on: [ids]` (inline, acyclic) | `depends_on:` (inline, acyclic) — unchanged |
| `outcome` / `status` / `guidance` | same field names |

**Deliberately *not* carried** (these are orchestrator / event-store concerns, not a
hand-authored seed's): the verdict database, `evidence/runs/*.jsonl`, `channels/`,
`also_owns` / `build_config` / `patterns` machinery, and signer identity. **Deliberately
changed:** pure-YAML → frontmatter-markdown (the studio renders markdown; UAT/guidance
are prose-first), and contracts are promoted from anonymous test entries to a **named
leaf tier**.

## Honest proof posture

`apps/studio` was built directly, by hand. It **runs** (`pnpm --filter studio dev`) but
has **no automated test suite and no scripted UAT** (`package.json` defines only
dev/build/preview/typecheck; there are zero `*.test`/`*.spec` files). So every unit here
is a **retrospective spec**: contracts describe the isolated tests that *would* prove
each behaviour (citing real code at `file:line`); UATs describe the walkthroughs that
*would* prove each capability. Every capability is `status: proposed`. **Nothing here is
`healthy` or `mapped`** — none of it has earned on-disk evidence through storytree's
prove-it gate.

## Open modeling calls (for the owner)

Surfaced rather than guessed — these are load-bearing and easy to revise (the
representation is plain files).

1. **Lifecycle status for retro-authored specs over built code (the big one).**
   `proposed` undersells reality (the code is built, runs, and was hand-exercised), but
   `mapped` overstates it (`mapped` means *verified by an existing test suite* — there is
   none) and `healthy` is out (no earned evidence). v1 never retro-authored specs over
   already-built code, so it offers no precedent. **Does the status enum need a tier
   between `proposed` and `healthy`** — e.g. `built-unproven` / `observed` — to honestly
   describe working-but-unproven code? *Default taken:* `proposed` + an honest per-unit
   proof note. Decide the enum when `packages/core` formalizes the schema.

2. **`resolve-comment` — own capability, or fold into `annotate-topic`?** Kept separate
   (a distinct verb with a genuine multi-surface propagation walk: header badge, row
   pill, hide-resolved toggle, section badge, gutter tick, sidebar count, on-disk
   `resolvedAt`). But its UAT renders a corpus doc for two of those surfaces, which is a
   `read-corpus` need it does not declare — an entanglement with `annotate-topic` (which
   *does* depend on `read-corpus`). *Recommendation:* defensible either way; I lean
   **keep separate** (the fan-out is a real standalone proof and a useful fine-grained
   example), but if kept, consider adding a `resolve-comment → read-corpus` edge, or fold
   resolve into `annotate-topic` as extra steps + contracts.

3. **`seed-library-corpus` — capability, or a contract-cluster?** Its honest proof is
   largely one observable effect (the written `assets.json`), which smells contract-ish,
   but it is a self-contained runnable journey with real branches (no-clobber vs
   `--force`, glossary extraction, dup-slug skip) against real collaborators (the `docs/`
   tree). *Recommendation:* **keep as a capability** — it has a genuine build-time
   walkthrough that needs no app running, and it is the data-provenance root the two
   Library capabilities depend on.

4. **Client platform substrate — promote to a capability?** The app bootstrap +
   `AppDataContext` + hash router (`App.tsx`, `lib/appData.ts`, `lib/route.ts`) is
   load-bearing but has no goal distinct from "the app loads the corpus". *Default:*
   folded as shared substrate across the read/browse capabilities. Promote it to a named
   upstream capability only if you want "the SPA loads the corpus into one typed context"
   to be its own provable unit.

5. **Lower-stakes notes.** *(a)* The 5-category **taxonomy** is modeled as a closed
   schema folded into `browse-library` (with one drift-guard contract asserting the
   server vs `types.ts` lists match), not its own unit — a taxonomy has no end-to-end
   walk; it could alternatively be a `definition` artifact. *(b)* `GuidanceAsset` is still
   a *live proposal* for the parked open-questions §9 knowledge tier, so the three Library
   capabilities sit on a model that isn't ratified yet. *(c)* The `slugify` parity
   invariant is asserted in two capabilities (`read-corpus`, `annotate-topic`); it could
   become one shared contract owned by `read-corpus`. *(d)* The whole story is **dev-only**
   (`vite build` is a static SPA with no `/api`); confirm that scope.

## How this was produced

A multi-agent **workflow** decomposed `apps/studio`: 5 readers proposed candidate
capabilities from different slices → a synthesis step deduped them into one coherent
story → one agent per capability decomposed it into contracts + a minimal UAT → an
assembly step finalized the UAT-generated dependency edges → an adversarial **tier-audit**
(one auditor per capability) tried to falsify every story/capability/contract boundary
call against the proof-mode rule. Two errors the audit caught were corrected in this seed
(a contract miscount in `browse-library`; the dup-slug explanation in
`seed-library-corpus`). Every cited `file:line` was verified against the real code.

It is **lean and reversible** by design: plain files, no tooling, no schema lock-in yet.
Merging/splitting a unit, renaming a status, or promoting contracts to their own files
are all mechanical edits.
