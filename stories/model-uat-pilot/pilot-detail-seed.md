---
id: "pilot-detail-seed"
tier: capability
story: model-uat-pilot
arc: model-uat-promotion
title: "Every pilot criterion points at a seed-canonical detail artifact"
outcome: "Every pilot criterion carries a `(detail: …)` pointer to a validating seed-canonical detail artifact under the uat-criterion seed dir."
status: proposed
proof_mode: integration-test
depends_on: [uat-criterion-library-surface, pilot-criteria-classified]
decisions: [209, 55, 192]
# Corpus pair: (detail:) tags on the three story.md files + JSON under
# apps/studio/data/seed-kinds/uat-criterion/. Proof observes via parseCriterionPointers +
# UatCriterionDetail / reconcileDetails in the story-owned harness package.
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/model-uat-pilot", "test"]
  scope:
    testGlobs: ["packages/model-uat-pilot/src/pilot-detail-seed.test.ts"]
    sourceGlobs:
      [
        "stories/drive-machinery/story.md",
        "stories/library-review/story.md",
        "stories/library-tech-tree-overlay/story.md",
        "apps/studio/data/seed-kinds/uat-criterion/**",
      ]
  real:
    testFile: "packages/model-uat-pilot/src/pilot-detail-seed.test.ts"
    sourceFile: "stories/drive-machinery/story.md"
    editsExisting: true
    scope:
      testGlobs: ["packages/model-uat-pilot/src/pilot-detail-seed.test.ts"]
      sourceGlobs:
        [
          "stories/drive-machinery/story.md",
          "stories/library-review/story.md",
          "stories/library-tech-tree-overlay/story.md",
          "apps/studio/data/seed-kinds/uat-criterion/**",
        ]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/model-uat-pilot", "typecheck"]
    proofCommand:
      file: pnpm
      args: ["--filter", "@storytree/model-uat-pilot", "test"]
---

# Every pilot criterion points at a seed-canonical detail artifact

**Outcome —** Every pilot criterion carries a `(detail: …)` pointer to a validating
seed-canonical detail artifact under the uat-criterion seed dir.

## Guidance

- For each classified criterion on the three pilot stories, add a `(detail: <id>)` tag beside
  the witness/tier tags. Prefer stable ids `<story-id>#uat-<n>` matching `criterionId` from
  `@storytree/model-uat`.
- Author one JSON detail per criterion under `apps/studio/data/seed-kinds/uat-criterion/`,
  validating as `UatCriterionDetail` from `@storytree/uat-criterion`:
  - `kind: "uat-criterion"`
  - `id` matching the pointer
  - non-blank `action`, `successConditions`, `evidenceExpectations`
  - optional `refs: ["asset:…"]` to reusable principles/processes (reference, don't copy)
  - **no title field**
- Lift procedure prose out of long story criterion lines into the detail body when it is clearly
  action/success/evidence — keep the story line as the one-liner display title (ADR-0209 D7
  Studio already renders).
- Write-scope: prefer the widened story-author fence (`isStoryAuthorWriteAllowed`) if this leaf
  is authored through story-author; otherwise the prove-it-gate node's write-scope must admit
  both `stories/**` and the seed dir for this capability.
- AUTHOR_TEST in `pilot-detail-seed.test.ts`: parseCriterionPointers count equals parseCriteria
  count per story; every pointed id loads a detail that `UatCriterionDetail.parse` accepts;
  `displayTitle` stays the story one-liner.

## Contracts (3)

1. **`every-pilot-criterion-has-detail-pointer`** — full coverage
   - **asserts —** for each of the three stories, `#pointers === #criteria` after
     parseCriterionPointers / parseCriteria.
2. **`every-pilot-detail-validates`** — seed bodies are real
   - **asserts —** each pointed id has a seed file whose body parses as `UatCriterionDetail`
     with matching `id` (ADR-0209 D5).
3. **`detail-does-not-redefine-title`** — story stays display-canonical
   - **asserts —** `displayTitle` for each binding equals the criterion.title; detail bodies
     carry no title-shaped field that the harness treats as display-canonical (ADR-0209 D6).
