# Library citations: unify "See also" + "References" into one grouped **Sources**

**Date:** 2026-06-08
**Status:** IMPLEMENTED on this branch (owner authorized "go with the strongest foundation").
Option A + author-order grouping + live-view were chosen; the gate (`pnpm -r typecheck && pnpm -r
test`) is green and the render was verified live in the studio and the CLI. The original proposal
text is kept below for the rationale; an **Implementation note** at the very end records what landed.
A runnable prototype (`docs/research/sources-grouping-prototype.mjs`) and the one-shot data
migration (`apps/studio/data/migrate-sources.mjs`) ship alongside.
**Owner problem (verbatim):** *"I'm not happy with 'See also' / 'reference' in the artifact
templates — should just pick one and stick to it."*
**Builds on:** `docs/research/library-template-alignment.md` (the pass that set the current
template shapes, including the trailing `## See also`). This proposal **revises** that pass's §2
decision to end every template with a prose `## See also` carrying "Source ADR(s), related
artifacts, and provenance."

---

## 0. TL;DR — the recommendation

1. **One mechanism, one name.** Retire the body `## See also` section and the separately-rendered
   "References" block. Make the structured **`references`** field the *single* citation source,
   and render it as one section titled **Sources**.
2. **Group by target type.** Resolve each pointer to the *kind of thing it points at* and render a
   sub-section per type — **Definitions / Principles / Patterns / Guardrails / Tech stack /
   Templates / Open questions / Decisions (ADRs) / Docs & references** — in that fixed order,
   empty groups omitted.
3. **Keep `references` as opaque strings; add a free-prose `provenance` line under Sources** for
   the residual annotation that a bare pointer can't carry ("Synthesised from ADR-0008", "Validated
   2026-06-08", "reads as this principle, not the noun `contract`"). This is the field that already
   exists but is unused (0/78 units populate it today).
4. **Sources is a live view, never stored.** The grouped section is computed at render time from
   `references`; it is *not* baked into any artifact `body`. (Decided — see §2b.)
5. **Migration is mostly mechanical with one human-judgement step:** lift the artifact-to-artifact
   cross-links that currently live *only in `## See also` prose* into `references` as `asset:` edges.

Why this shape: `references` is *already* the project's structured citation graph — the CLI's
`tree focus` builds the inbound/outbound DAG from it and the studio renders it as links. `## See
also` is a parallel prose channel that **duplicates** those pointers and **strands** the rest.
Picking `references` keeps the graph machine-usable; grouping-by-type fixes the "a definition and
an ADR don't belong under the same flat list" complaint the owner named.

**The structural win underneath it.** This is exactly what structured-data-over-markdown buys
(the project's own corpus-as-schema, markdown-as-generated-view direction): citations stored as
pointers, not prose, mean the *same* `references` field generates a studio render, a CLI graph, an
injected agent-context block, or a back-link query — each composed on demand. Markdown freezes one
rendering; structured data lets every consumer generate its own. "Sources" is the first of those
generated views; baking it back into the body would throw that advantage away.

---

## 1. Current state — two overlapping mechanisms

The corpus is **85 assets** = **78 structured knowledge units** (`knowledge.json`) + **7 generated
templates** (6 `template-<kind>` + `template-adr`). Knowledge units carry citations **two ways at
once**:

### 1a. Body `## See also` — prose, inside the rendered body
- Defined as the trailing field in almost every kind's spec in
  [`packages/core/src/knowledge.ts`](../../packages/core/src/knowledge.ts) (`KIND_SPECS`; the
  `seeAlso` field, `heading: "See also"`).
- Rendered by `renderBody` in
  [`packages/core/src/knowledge-render.ts`](../../packages/core/src/knowledge-render.ts) as a
  `## See also` markdown section appended to the body.
- **Every one of the 78 units populates `seeAlso`** (`withSeeAlso: 78`). Its placeholder invites
  "Source ADR(s), related artifacts, **and provenance**" — i.e. it's deliberately a grab-bag.

### 1b. Structured `references` — opaque pointers, rendered separately
- `references: string[]` on `commonShape` in `knowledge.ts`; pointers are `doc:<relpath>` or
  `asset:<id>`.
- Rendered as its **own** `<h4>References</h4>` block in
  [`apps/studio/src/components/AssetView.tsx:58`](../../apps/studio/src/components/AssetView.tsx)
  (`RefLink` resolves `doc:`→doc page, `asset:`→asset page).
- Edited via the comma-separated "References" input in
  [`apps/studio/src/components/AssetEditor.tsx`](../../apps/studio/src/components/AssetEditor.tsx)
  (~line 232).
- Consumed as the **citation graph** by the CLI: `treeFocus` in
  [`packages/cli/src/commands.ts:349`](../../packages/cli/src/commands.ts) builds outbound +
  inbound edges from `references`, resolving each `asset:` target to its `[kind]`.

### 1c. The unused third field: `provenance`
- `provenance: Markdown.optional()` on `commonShape`. **0 of 78 units use it** (`withProvenance:
  0`). The file header in `knowledge.ts` explains why: provenance was *fused into* `seeAlso`'s
  italic line instead. So a field built for provenance sits empty while the prose section carries
  its job — part of the same "two channels for one concern" smell.

### 1d. The duplication & inconsistency, measured across the 78 units

| Symptom | Count | Evidence |
|---|---|---|
| Units with a `references` list | 77 / 78 | `doc:` pointers dominate |
| Total `references` pointers | 153 | **151 `doc:`**, only **2 `asset:`** |
| Units whose `## See also` **literally re-prints `doc:`/`asset:` tokens** already in `references` | **14** | raw duplication |
| Units whose `## See also` **name-drops other artifacts in prose** that are *not* in `references` | **30** | stranded cross-links |
| Units populating `provenance` | 0 | the field exists but is dead |

Concrete (from the prototype run):

- **`prove-it-gate`** — `references: [doc:glossary.md, doc:decisions/0007-proof-model.md]`. Its
  `## See also` says: *"…from `docs/glossary.md` and ADR-0007 **(doc:glossary.md,
  doc:decisions/0007-proof-model.md)**. …rests on the definition `gate`…"* — the two pointers are
  duplicated **verbatim as prose**, and it *also* name-drops `never-bypass-the-gate` and `gate`,
  neither of which is in `references`.
- **`own-the-layers`** — `references: [doc:decisions/0001-foundational-stack.md]`; See also:
  *"Synthesised from ADR-0001 **(doc:decisions/0001-foundational-stack.md)**."* Pure restatement.
- **`event`** — See also: *"Related: `event-log`, `pi-event-stream`,
  `approval-event-promotion-event`, `node-rollup`."* Four artifact cross-links that exist **only**
  in prose — invisible to the CLI graph and the studio link resolver.

**Diagnosis.** `references` is the structured graph but is *under-populated* (artifact→artifact
edges live in prose, not as `asset:` pointers — which is exactly why `tree focus` prints "no
intra-library edges here yet"). `## See also` is a prose channel that (a) re-prints what
`references` already holds, (b) holds genuine provenance prose, and (c) holds the artifact
cross-links that *should* be `references`. Three jobs, two of them redundant.

---

## 2. The design for **Sources**

### 2a. What it replaces — unify both into one, sourced from `references`

| Today | Becomes |
|---|---|
| body `## See also` section (prose) | **removed** from `KIND_SPECS` → disappears from every rendered body automatically |
| `<h4>References</h4>` block in AssetView | **renamed + restructured** to a grouped `## Sources` block |
| `provenance` (empty) | **the home for residual prose** — one optional italic line under Sources |
| `references: string[]` | **unchanged shape**, but becomes the *single* citation source and absorbs the stranded `asset:` cross-links |

So: **the structured `references` field is the single source of truth; "Sources" is its grouped
render; `## See also` is retired; `provenance` carries the leftover prose.** One concept, one name,
one edit surface (the references input), one graph the CLI already reads.

### 2b. How grouping-by-type works mechanically

`references` are opaque `doc:`/`asset:` strings. To group them we resolve each to its target's
**type** at render time:

```
resolveRef(ref, resolveAsset):
  asset:<id>            -> look up the artifact -> group = plural(its category)   // Definitions, Principles, …
  doc:decisions/NNNN-*  -> group = "Decisions (ADRs)"                              // path-classified, corpus-free
  doc:<other>.md        -> group = "Docs & references"                            // glossary.md, research/*, open-questions.md
  (unknown)             -> group = "Other"
```

Only the `asset:` branch needs the corpus (id → category); the `doc:` branch is pure string
classification. So the resolution splits cleanly:

- **Pure core (`packages/core`):** `groupSources(refs, resolveAsset)` — owns the `doc:`
  classification, the fixed group order, empty-group elision, and within-group ordering. Takes a
  `resolveAsset(id) -> {kind, title} | null` callback so it never imports the corpus.
- **Each renderer supplies the resolver from its own corpus view:**
  - **AssetView** — from `useAppData()` (it already has every asset; `RefLink` already does this
    lookup). This is the cleanest home for the *interactive* render.
  - **build-corpus.mjs / `renderBody`** — `renderBody` sees only one doc, so it **cannot** resolve
    `asset:` → category. **Decided: Sources is a live view, never baked into the body.** `renderBody`
    stays a pure single-doc function and emits no citation section; the body round-trip carries only
    the artifact's own prose fields. Sources is computed at each render site from `references`, the
    same way the studio Library grid and the CLI graph are views over structured data, not stored
    prose. (The rejected alternative — a corpus-aware `build-corpus` step that bakes a pre-grouped
    Sources section into each body — refreezes the data into markdown and goes stale the moment a
    cited artifact is recategorized or retitled; see §0 for the structural rationale.)
  - **CLI** — `treeFocus` already resolves `asset:`→`[kind]`; it would call the same
    `groupSources` to print grouped Sources, replacing its flat outbound list.

This is why the recommendation puts the grouping helper in `packages/core` (shared, pure, tested)
and the *resolver* at each call site — the same seam the CLI and studio already straddle.

### 2c. Ordering & empty-section policy

- **Group order (fixed):** Definitions → Principles → Patterns → Guardrails → Tech stack →
  Templates → Open questions → **Decisions (ADRs)** → **Docs & references** → Other. Mirrors
  `ASSET_CATEGORIES` in [`apps/studio/src/types.ts`](../../apps/studio/src/types.ts) (so the
  Library grid and the Sources block read in the same order), with the two doc-backed buckets and
  the catch-all appended last.
- **Within a group:** preserve `references` order (author intent), or sort by title — author order
  is simpler and lets the author hand-curate emphasis; pick one and state it.
- **Empty groups:** omitted entirely (no empty headings) — same rule `renderBody` already uses for
  absent optional fields.
- **No references at all:** omit the whole `## Sources` section (today AssetView already guards
  `references.length > 0`).

### 2d. Worked example (prototype output, real data)

`oq-anti-pattern-lessons` is the one unit that already carries `asset:` edges, so it shows the
grouping end-to-end:

```
## Sources

**Guardrails**
- Approval-gated trunk            asset:approval-gated-trunk
- Claims live in the shared store asset:claims-in-the-shared-store

**Decisions (ADRs)**
- decisions/0008-ui-drives-agents-approvals.md       doc:decisions/0008-…
- decisions/0009-concurrency-isolation-id-allocation.md  doc:decisions/0009-…

**Docs & references**
- research/library-template-alignment.md  doc:research/library-template-alignment.md
```

Run it yourself: `node docs/research/sources-grouping-prototype.mjs prove-it-gate event
oq-anti-pattern-lessons`.

### 2e. The one real design tension — opaque pointers vs. annotated links

A bare pointer loses the *annotation* `## See also` prose carries today ("Synthesised from
ADR-0008"; "the DBOS-backed mechanism is deferred by ADR-0019"; "reads as this principle, not the
noun `contract`"). Two ways to keep it, named on both sides:

- **Option A — pointers-only `references` + a `provenance` prose line (RECOMMENDED).** `references`
  stays `string[]`; the residual non-pointer prose moves into the existing `provenance` field,
  rendered as one italic line under Sources. *For:* zero schema-shape change, grouping is trivial,
  migration is mostly mechanical, `provenance` finally earns its place. *Against:* per-link "why
  this link matters" annotation gets pooled into one blob rather than sitting beside its link; most
  `seeAlso` values are already a single provenance sentence, so the loss is small but real.
- **Option B — structured reference objects.** `references: { ref, note?, rel? }[]` where `rel` is a
  typed edge (`derives-from` / `supersedes` / `consumes` / …). *For:* keeps per-link notes,
  captures the typed `derives_from`/`consumes` edges the CLI's `tree focus` TODO explicitly wants,
  richest graph. *Against:* a real schema change (zod, `validateLibraryDoc`, the AssetEditor input,
  the CLI `--set references=…` parser, all 153 pointers re-shaped), and grouping is still
  *by-target-type* not by-rel, so it doesn't directly serve the owner's stated ask. Heavier than
  the problem in front of us.

**Recommend A now, name B as the forward path** the typed-edge TODO already points at. A solves the
owner's complaint with the least blast radius; B is a clean follow-on if/when typed edges land.

---

## 3. Touch-point inventory & blast radius

| Area | File(s) | Change |
|---|---|---|
| Schema | `packages/core/src/knowledge.ts` | Remove the `seeAlso` field from all 6 `KIND_SPECS`. Keep `references` + `provenance` on `commonShape`. (`.strict()` means `knowledge.json` must drop `seeAlso` in the *same* change.) |
| Render core | `packages/core/src/knowledge-render.ts` | `renderBody` auto-drops `## See also` (it's driven by `KIND_SPECS`). Add pure `groupSources(refs, resolveAsset)` + group-order/labels. |
| Core exports | `packages/core/src/index.ts` | Export `groupSources` + types. |
| Studio render | `apps/studio/src/components/AssetView.tsx` | Replace `<h4>References</h4>` + flat `<ul>` with grouped **Sources** via `groupSources`, resolver from `useAppData`. Keep `RefLink`. |
| Studio editor | `apps/studio/src/components/AssetEditor.tsx` | Relabel "References" input → "Sources" (still comma-separated `doc:`/`asset:`). Optional: add a `provenance` textarea. No format change under Option A. |
| Studio types | `apps/studio/src/types.ts` | None for Option A (`references: string[]` unchanged). Add a `provenance?: string` to `GuidanceAsset`/`AssetInput` if surfacing the prose line. |
| Generator | `apps/studio/data/build-corpus.mjs` | If Sources stays a *view* (recommended 2b-i): no body change; the regenerated bodies just lose `## See also`. Glossary generation is unaffected (it reads `whatItIs`/`description`, never `seeAlso`). |
| Data | `apps/studio/data/knowledge.json` | All 78 units: drop `seeAlso`, enrich `references` with stranded `asset:` edges, move residual prose → `provenance`. (See §4.) |
| Generated | `apps/studio/data/assets.json`, `docs/glossary.md` | **Do not hand-edit** — regenerated by `build-corpus.mjs`. Bodies lose the `## See also` section automatically. |
| Postgres | `packages/store` | **No DDL change** — docs are JSONB (`schema.sql` stores `doc JSONB`, relationships *inside* the doc). Re-run the migration (`load-corpus.ts`) or CLI-upsert the edited units so the live DB matches. `validateLibraryDoc` enforces the new shape at the write boundary, so the migration must land in core + data together. |
| Tests | `packages/core/src/*.test.ts`, `packages/cli/src/cli.test.ts`, store parity suite | Update any fixture asserting a `## See also` body or the `seeAlso` field. Add a `groupSources` unit test. Keep `pnpm -r typecheck && pnpm -r test` green (offline). |

**Blast radius summary:** one schema field removed, one pure helper added, two render sites
restructured (studio + CLI), one input relabelled, 78 data units rewritten, a DB re-seed. No DDL,
no infra, no new dependency. The `renderBody`-driven design means the *body* change is a one-line
spec deletion — the bulk of the work is the data migration in §4.

---

## 4. Migration sketch (the 78 structured units)

Per unit, transform `{ seeAlso, references }` → `{ references', provenance? }`:

1. **Strip duplicated pointers (mechanical).** The 14 units whose `seeAlso` re-prints `doc:`/`asset:`
   tokens already have those in `references`; the tokens just vanish with the section.
2. **Lift stranded cross-links into `references` (HUMAN JUDGEMENT — the only non-mechanical step).**
   The 30 units that name-drop artifact ids in prose (`event`→`event-log`,…; `prove-it-gate`→`gate`,
   `never-bypass-the-gate`) need each name confirmed as a *real citation* vs. a passing mention,
   then added as an `asset:<id>` edge. A script can *propose* the edges (regex backticked kebab-ids
   that match an existing artifact id); a human accepts/rejects. This is the step that finally
   populates the artifact→artifact graph the CLI `tree focus` is waiting for.
3. **Move residual prose → `provenance` (mostly mechanical).** Whatever's left after removing
   pointers and confirmed cross-links — "Synthesised from ADR-0008", "Validated 2026-06-08…",
   "reads as this principle, not the noun `contract`" — becomes the `provenance` value. A pass to
   trim the boilerplate "Synthesised from ADR-N" (now redundant with the grouped ADR pointer) is
   optional polish.
4. **Delete `seeAlso`** from the unit.
5. **Regenerate** `assets.json` + `glossary.md` via `build-corpus.mjs`; **re-seed** the live DB.

Mechanical vs. judgement: steps 1, 3, 5 are scriptable; step 2 needs a human to disambiguate
"cited" from "mentioned" (≈30 units, a focused review pass — well-suited to the studio's own
comment/edit dogfooding loop). **Prototype scope:** apply the full transform to **1–2 units** (e.g.
`oq-anti-pattern-lessons`, already edge-rich, and `event`, prose-rich) and eyeball the rendered
Sources before any bulk rewrite. **Do not bulk-rewrite all 78 without owner sign-off.**

### Backward-compat / transition note
- `validateLibraryDoc` uses `.strict()`: removing `seeAlso` from the schema **rejects** any
  un-migrated unit that still has the field. So core + `knowledge.json` must change in one commit,
  and the DB re-seed must follow immediately (a live DB row with a stale `seeAlso` would fail
  re-validation on next write). There is no graceful "both fields tolerated" window unless we
  temporarily keep `seeAlso` as an ignored optional field during the rollout — a deliberate
  transition option if the data migration can't land atomically with the code.
- No reader breaks silently: the body simply stops emitting `## See also`; the studio/CLI Sources
  render degrades to "fewer groups" for un-enriched units, never to an error.

---

## 5. Recommendation, with tradeoffs named both sides

**Adopt "Sources" = grouped render of the structured `references` field; retire body `## See also`;
use `provenance` for residual prose (Option A). Migrate `references` to absorb the stranded
artifact cross-links.** This mirrors the project's own `assess-tradeoffs-by-naming-both-sides`
principle:

**For:**
- One mechanism, one name — directly answers the owner's "pick one and stick to it."
- Grouping-by-type fixes the "definitions don't fit under 'references'" complaint without inventing
  a new field.
- `references` is *already* the citation graph (CLI `tree focus`, studio links); this makes it the
  *only* one, and finally populates the artifact→artifact edges that today rot in prose.
- Smallest viable blast radius: one `KIND_SPECS` field deleted, one pure helper, no DDL.
- `provenance` (dead today) earns its keep; `renderBody` stays a pure single-doc function.

**Against:**
- The data migration's step 2 (lifting ~30 prose cross-links) needs human judgement — not a pure
  script, and the biggest chunk of the effort.
- Per-link annotation is pooled into one `provenance` blob rather than sitting beside each link
  (the price of keeping `references` as opaque strings; Option B buys it back at real schema cost).
- A hard cutover (`.strict()` schema) — needs core + data + DB to move together, or a deliberate
  transition window keeping `seeAlso` as an ignored field.
- Sources is a live-view computed at the render site, not stored in the body — a clean split that
  unlocks the structured-data-over-markdown advantage (§0), but a conceptual shift from "everything
  an artifact says is in its `body`" that the template-alignment pass assumed.

**Revises prior art:** `docs/research/library-template-alignment.md` §2 standardised every template
to end with a prose `## See also` carrying "source ADR(s), related artifacts, and provenance." This
proposal **removes that section** and re-homes its three jobs: pointers → `references` (grouped as
Sources), provenance → `provenance`. The template shapes otherwise stand.

**Deferred (out of scope here):** typed edges (Option B / `derives_from`/`consumes`); reciprocity
checks (v1's `current_consumers`); folding ADR docs' own "References" sections into the same model.

---

## 6. Suggested next step

Sources-as-live-view is **decided** (§2b). Two calls remain for the owner: **(a)** Option A
(pointers-only + `provenance` prose) vs B (typed reference objects); **(b)** within-group ordering
(author order vs title sort). On a yes, the smallest first slice is: add `groupSources` + test to
`packages/core`, restructure `AssetView` to render Sources live, and migrate the two prototype units
— leaving the full 78-unit migration as a reviewed follow-up.

---

## 7. Implementation note (what actually landed, 2026-06-08)

Decisions taken for the strongest foundation: **Option A** (pointers-only `references` +
`provenance` prose), **author-order** within groups, **live-view** (Sources never stored).

Changes:
- **`packages/core`** — new pure `knowledge-sources.ts` (`groupSources` + `SOURCE_GROUP_ORDER`),
  exported from `index.ts` and via a new `@storytree/core/sources` subpath (a node-dep-free entry so
  the studio browser bundle doesn't drag in `node:test`/`node:child_process` from the main index).
  `seeAlso` removed from all 6 `KIND_SPECS`, so `renderBody` no longer emits `## See also`. Tests:
  `knowledge-sources.test.ts`.
- **Data** — `apps/studio/data/migrate-sources.mjs` rewrote all 78 units in `knowledge.json`:
  dropped `seeAlso`, lifted the prose artifact cross-links into `references` as `asset:` edges
  (mechanical: backticked exact artifact-ids), and set a curated `provenance` on the 28 units whose
  prose carried genuine non-pointer substance. Regenerated `assets.json` + `glossary.md` via
  `build-corpus.mjs` (now passes `provenance` through). `glossary.md` is unaffected in shape (it
  reads `whatItIs`/`description`, never `seeAlso`).
- **Renderers** — studio `AssetView` renders a grouped **Sources** block (resolver from
  `useAppData`) + a `provenance` line; `AssetEditor` relabels the input to "Sources" and adds a
  provenance field; `types.ts`/`render-doc.ts`/`libraryBackend.ts`/`devApi.ts` thread the optional
  `provenance` through both backends. CLI `viewArtifact` prints grouped Sources + provenance.
- **Postgres** — no DDL (docs are JSONB); `provenance` rides inside the doc. Re-run
  `load-corpus.ts` (or CLI/studio upserts) to sync the live DB; `validateLibraryDoc` enforces the
  new shape at the write boundary.

Verified: `pnpm -r typecheck` + `pnpm -r test` green (incl. the offline corpus validation against
the migrated `knowledge.json`); studio render confirmed live (grouped Sources + provenance, zero
console errors, no `## See also` in any body); CLI render confirmed offline.

Not done (deliberately deferred): Option B typed edges; reciprocity/back-link checks; trimming the
~30 lifted cross-links for "cited vs merely mentioned" (the migration kept every exact-id match —
a later editorial pass can prune). The DB re-seed is left for whoever next brings the instance up.
