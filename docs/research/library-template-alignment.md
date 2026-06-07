# Library template-alignment pass

**Date:** 2026-06-07
**Scope:** Editorial/structural alignment of the cross-cutting knowledge "Library"
(`apps/studio/data/assets.json`) — the `GuidanceAsset` corpus. A **content** pass: no
schema, storage, or migration changes. ADR-0017's DEFERRED items (tier name, citing/
reciprocity, comments layer, templates-from-schema, store migration) are untouched; this
aligns to the prose templates **as they exist**.

**Result:** all 6 templates refined; all 82 content units restructured to their kind's
template; 17 units flagged for owner review (none silently force-fit, none recategorized).

---

## 1. Template-count mismatch (6 templates, 5 content kinds) — resolved

There are 6 `template` units but only 5 content kinds
(`definition` / `principle` / `pattern` / `guardrail` / `techstack`). The extra is
**`template-adr`**.

**Resolution: keep it — it is neither a stray nor a template-for-templates. It scaffolds a
different layer.** Per ADR-0017, **ADRs are the SOURCE layer** the knowledge tier *derives
from*, not a knowledge-unit kind; and there are **no `adr`-category content units in
`assets.json`** (the Library folds ADRs in read-only from `docs/decisions/` at render time).
So:

- The **5 kind-templates** (`template-definition/principle/pattern/guardrail/techstack`) map
  **1:1** to the 5 content kinds aligned in this pass.
- **`template-adr`** is the scaffold an author uses to write a *new ADR doc* under
  `docs/decisions/` — the only template whose output is a doc, not a knowledge unit.

Action taken: added a one-line lead note to `template-adr`'s body and rewrote its
`description` to state this role explicitly, so the mismatch is self-documenting rather than
looking like an orphan. (Templates themselves have no `template-template`; that is correct —
ADR-0017 marks "templates → schema" as deferred, so we are not generating templates from a
schema here.)

---

## 2. Template refinements made

All five kind-templates already shared a sound shape (a bold one-line lead + `##` sections
+ a closing `## See also`). Refinements kept that shape and tightened it for consistency:

| Template | Section shape (after) | Change |
|---|---|---|
| `template-definition` | **In one line.** / What it is / What it is not / See also | "What it is not" marked **omittable** when a term has no easily-confused neighbour (prevents padding thin glossary leaves); See also now explicitly invites **provenance**. |
| `template-principle` | **The principle.** / Why / How to apply / See also | Unchanged shape; See also standardized to "Source ADR(s), related artifacts, and provenance." |
| `template-pattern` | **The pattern.** / Problem / Approach / Tradeoffs / See also | Same. Tradeoffs section deliberately mirrors the `assess-tradeoffs-by-naming-both-sides` principle (name A vs B). |
| `template-guardrail` | **The boundary.** / Rule / **Enforced by** / Failure mode prevented / See also | Kept the load-bearing rule: **"If nothing deterministically enforces it, this is a `pattern`, not a guardrail."** This is the discriminator from `types.ts`. |
| `template-techstack` | **The choice.** / What it is / Why this / Constraints / See also | Same; "role it plays **in storytree**" sharpened. |
| `template-adr` | (ADR doc skeleton) | Added lead note + new description clarifying it scaffolds the **source layer** (see §1). Body skeleton (Status / Date / Context / Decision / Consequences / Alternatives considered / References) matches the real ADR files. |

Consistency rules now uniform across all kind-templates: bold one-liner lead → ordered `##`
sections → `## See also` carrying source ADR(s), related artifacts, **and provenance**
(import/attribution lines).

---

## 3. Units aligned per kind

Every content unit's `body` was restructured to its kind's template, **preserving
substantive content** (every claim, every `(ADR-XXXX)` citation, every attribution and v1-
provenance line — reworded/reorganized, never deleted). Standalone provenance/attribution
moved into `## See also`; claim-anchoring parentheticals stayed inline. `id`, `category`,
and `references` were left **untouched**; `updatedAt` bumped to 2026-06-07 on every changed
unit.

| Kind | Gloss | Units aligned |
|---|---|---|
| definition | what something is | 54 |
| pattern | a reusable approach | 11 |
| guardrail | a deterministically-enforced boundary | 8 |
| principle | how to judge | 5 |
| techstack | what we build on | 4 |
| **Total content** | | **82** |
| template (refined, not "aligned") | the shape an artifact conforms to | 6 |

No `title`/`description` field needed correcting except `template-adr`'s description (§1);
the subagents found no other clearly-wrong titles/descriptions.

---

## 4. MISFIT LIST (for owner review — not force-fit, not recategorized)

17 units carry a flag. **No category was changed and nothing was deleted** — each still
received a best-effort aligned body. These are recommendations only.

### 4a. Mis-categorized — rule/stance-shaped "definitions" (owner call: keep as glossary term, or recategorize)

These are legitimate `docs/glossary.md` terms, but their content reads as a rule/principle/
guardrail ("what to do / how to judge") rather than "what something is":

| id | Reads as | Recommendation |
|---|---|---|
| `cold-rebuild` | authoring guideline / principle | Keep as glossary def **or** recategorize `principle`. The body itself stresses it is a guideline, not a gate. |
| `red-green` | principle | Body literally says "a *principle*, not a synonym for `contract`." |
| `verification-wins` | principle / stance | Body opens "the stance that…". |
| `defects-amend-the-owning-story` | workflow rule | Imperative policy, not a noun. |
| `fail-closed-on-dirty-tree` | guardrail | Imperative rule that even names an enforcement behaviour (writes nothing, distinct exit code). Strongest recategorize candidate. |

### 4b. Mis-categorized — anti-patterns / v1-lessons filed as `pattern`

`pattern` = "a reusable approach you apply." These three instead recount **what v1 did
wrong**. Aligned with their "Approach" reframed as "what v2 does instead," but the fit is
poor:

| id | Issue | Recommendation |
|---|---|---|
| `auto-merge-on-green` | anti-pattern **and** redundant with the `approval-gated-trunk` guardrail (same ADR-0008 inversion) | Fold into / point at `approval-gated-trunk`, or reframe as an explicit "lesson." |
| `vibe-the-load-bearing-layers` | anti-pattern; overlaps the `own-the-layers` principle | Reframe as the failure-story `own-the-layers` warns against; cross-link or merge. |
| `store-lock-races-and-id-collisions` | anti-pattern; remedies already live in `claims-in-the-shared-store` + `durable-workflow-per-node` | Reframe as a "lesson," or fold the v1 evidence into those units. |

> **Owner decision worth surfacing:** the corpus has a recurring *"v1 scar / lesson"* shape
> that fits none of the five kinds cleanly. Options: (a) accept them as `principle`s stated
> in the negative, (b) fold each into its positive counterpart, or (c) note that a future
> "lesson"/"anti-pattern" kind is out of scope here (ADR-0017 owns kind changes).

### 4c. Redundant / overlapping pairs

| Units | Overlap | Recommendation |
|---|---|---|
| `inner-loop-outer-loop` (def) ↔ `human-owns-the-outer-loop` (guardrail) | Near-verbatim inner/outer-loop split, incl. the same "north-star may dissolve it" clause | Keep the **definition** as neutral vocabulary; let the **guardrail** carry the enforcement claim and *cite* the def instead of re-describing both loops. |
| `own-the-layers` (principle) ↔ `vibe-the-load-bearing-layers` (pattern) | Same ADR-0001 "don't vibe the load-bearing layers" rule, positive vs negative | Keep the principle; reframe the pattern as its anti-pattern, or merge. |
| `auto-merge-on-green` (pattern) ↔ `approval-gated-trunk` (guardrail) | Same trunk inversion | See 4b. |

### 4d. Thin (little content beyond restating the term)

| id | Note / recommendation |
|---|---|
| `proposed`, `building` | One-line lifecycle-status values. Consider folding the lifecycle states (proposed / building / healthy / unhealthy / mapped / retired) into **one "lifecycle status" definition** instead of one thin entry per value. |
| `title`, `id` | Trivial unit-field defs. Consider merging the unit-field defs (`title`, `id`, possibly `outcome` / `guidance`) into one "unit fields" reference. |
| `proof-hash` | Single-sentence leaf def. Either expand with the ADR-0016 staleness/anchor mechanism, or accept as a deliberately terse leaf. |
| `stack-pixijs-react-studio` | Documents an **intention**, not something built on — body says "no PixiJS yet." Keep as forward-looking, but mark deferred/not-yet-integrated in the description; enrich once `@pixi/react` is actually wired in. |

---

## 5. Open decisions for the owner

1. **The "v1-lesson / anti-pattern" shape (§4b).** Four-plus units don't fit the five kinds.
   Accept-as-negative-principle, fold-in, or defer to a future kind decision (ADR-0017)?
2. **Rule-shaped glossary terms (§4a).** Keep glossary definitions that state rules, or
   migrate the strongest (`fail-closed-on-dirty-tree`, `defects-amend-the-owning-story`) to
   `guardrail`/`principle`? (`fail-closed-on-dirty-tree` would need a stated enforcement
   mechanism to be a true guardrail.)
3. **Lifecycle-status consolidation (§4d).** Six thin status defs → one enum-style definition?
4. **Redundant pairs (§4c).** Trim-and-cross-link, or merge-and-retire one side?

None of these were actioned — all leave `id`/`category` intact pending owner direction.

---

## 6. Method & guardrails respected

- **Stayed in lane:** only `apps/studio/data/assets.json` was modified. No `infra/`,
  Cloud SQL, DB, or `packages/core` changes. No ADR-0017 DEFERRED item resolved.
- **ADR-0013 discipline preserved:** structured fields (`id`/`category`/`references`/
  timestamps) stayed structured and untouched; only the prose `body` view was reshaped.
- **Verified:** post-write, every unit's `id`, `category`, `references`, and `createdAt`
  matched `HEAD` exactly (0 drift); the only field-level change beyond `body`/`updatedAt`
  was `template-adr.description`. File re-parses as valid JSON, 88 units.
- Body authoring was fanned out across six subagents (one per disjoint id-set, each writing
  an isolated patch file), then assembled by a single script that controlled all structural
  fields — so no field outside `body`/`updatedAt`/`template-adr.description` could change.
