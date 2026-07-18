---
id: "uat-criterion-library-surface"
tier: capability
story: model-uat-pilot
arc: model-uat-promotion
title: "Library recognizes uat-criterion as a first-class seed-canonical kind"
outcome: "Library recognizes `uat-criterion` as a first-class kind (`KnowledgeKind` + `KIND_SPECS`) and the seed-kinds directory layout is the admitted detail surface."
status: proposed
proof_mode: integration-test
depends_on: []
decisions: [209, 192, 55]
# Hosted in @storytree/library (ADR-0192 foreign-building honesty): deferred consumer glue from
# uat-criterion-detail. AUTHOR_TEST extends library knowledge/schema tests; IMPLEMENT adds the
# kind to KnowledgeKind + KIND_SPECS (+ minimal seed-path / sync recognition if required for
# validateLibraryDoc). Consumes the field shape already proven in @storytree/uat-criterion
# (action / successConditions / evidenceExpectations / refs) — do not fork a second schema.
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/library", "test"]
  scope:
    testGlobs: ["packages/library/src/knowledge.test.ts"]
    sourceGlobs: ["packages/library/src/knowledge.ts"]
  real:
    testFile: "packages/library/src/knowledge.test.ts"
    sourceFile: "packages/library/src/knowledge.ts"
    editsExisting: true
    scope:
      testGlobs: ["packages/library/src/knowledge.test.ts"]
      sourceGlobs: ["packages/library/src/knowledge.ts"]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/library", "typecheck"]
    proofCommand:
      file: pnpm
      args: ["--filter", "@storytree/library", "test"]
---

# Library recognizes uat-criterion as a first-class seed-canonical kind

**Outcome —** Library recognizes `uat-criterion` as a first-class kind (`KnowledgeKind` +
`KIND_SPECS`) and the seed-kinds directory layout is the admitted detail surface.

## Guidance

- Edit `packages/library/src/knowledge.ts`: add `"uat-criterion"` to `KnowledgeKind` and a
  `KIND_SPECS` entry whose required fields match the landed `@storytree/uat-criterion`
  `UatCriterionDetail` body — `action`, `successConditions`, `evidenceExpectations`, optional
  `refs` — and deliberately **omit** any title-shaped field (ADR-0209 D6).
- Keep schema parity with the port: Library's kind table is the Studio/CLI recognition surface;
  the zod authority for detail validation remains `@storytree/uat-criterion`. Prefer adapting /
  re-exporting over duplicating refine rules when a thin adapter suffices.
- Seed surface: `apps/studio/data/seed-kinds/uat-criterion/` is the directory
  `UAT_CRITERION_DETAIL_SEED_DIR` already names. Ensure create-on-demand is enough for later caps;
  do not invent a second seed root.
- Seed-canonical class (ADR-0209 D5 / ADR-0055): this kind reconciles like agents — if a
  `sync-…` / `check:…-sync` CLI surface is required for honesty, keep it minimal and kind-fenced
  (reuse `reconcileDetails` from the public uat-criterion barrel). Prefer landing sync in this
  capability only when Library recognition alone is insufficient for the pilot harness.
- Test-author ≠ code-author: extend `knowledge.test.ts` (KIND_SPECS ↔ zod parity) first.

## Contracts (3)

1. **`uat-criterion-is-knowledge-kind`** — the kind is enumerated
   - **asserts —** `"uat-criterion"` ∈ `KnowledgeKind` and `KIND_SPECS["uat-criterion"]` exists.
2. **`uat-criterion-kind-specs-match-detail-body`** — field table matches the port
   - **asserts —** required KIND_SPECS fields cover action / successConditions /
     evidenceExpectations; no title-shaped lead field is present (ADR-0209 D6).
3. **`uat-criterion-seed-dir-is-admitted-surface`** — one seed root
   - **asserts —** the admitted seed directory string equals
     `apps/studio/data/seed-kinds/uat-criterion/` (the constant `@storytree/uat-criterion`
     already exports), so Library recognition and the story-author scope predicate cannot drift.
