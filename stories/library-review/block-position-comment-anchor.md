---
id: "block-position-comment-anchor"
tier: capability
story: library-review
title: "A comment is anchored to a block position, not a text span"
outcome: "A comment's anchor records which BLOCK it attaches to (a stable block position within the rendered topic), not a text-quote span; the W3C text-quote anchor shape (quote/prefix/suffix/startOffset) is gone from the stored comment model, and a block-anchored comment validates at the store's write boundary."
status: proposed
proof_mode: integration-test
depends_on: []
# Node-borne proof config (ADR-0057 keystone): authoring THIS block is what makes the capability
# inner-loop buildable — no NODE_BUILD_REGISTRY edit. EDITS-EXISTING (R1, editsExisting): the
# CommentAnchor shape ALREADY exists in packages/library/src/store/pg-comment-store.ts (the stored
# mirror) — the leaf REPLACES its text-quote fields with a block-position anchor and adds the
# assertions into the EXISTING pg-comment-store.test.ts. The RED the spine observes is a NEW assertion
# that a block-anchored comment (`anchor.kind === 'block'`, a block handle, NO quote field) round-trips
# through `mergeCommentPatch` / is the canonical stored shape — failing at HEAD because the anchor
# still carries `kind: 'text'` + `quote`/`prefix`/`suffix` and has no block field (a value/shape red,
# not a missing module). The PURE helpers (mergeCommentPatch) + the module-imports-and-constructs
# checks already run OFFLINE in this suite (node:test, no DB) — the live SQL list/create/update/remove
# over events.comment* stays human-verified behind STORYTREE_DB_LIVE, exactly as today.
#
# install: true + a typecheck wall — the suite imports the package's own types across modules and the
# proof runs in a fresh worktree (tsx + tsc need the lockfile-only install, ADR-0031 §2). SINGLE
# LITERAL test file (no `*`), so the default node:test proof on the one file is legal — no proofCommand
# (the @storytree/library suite is node:test, NOT vitest, unlike the studio frontend caps).
#
# NOTE the studio-side mirror (apps/studio/src/types.ts CommentAnchor + apiRouter.ts readAnchor) is the
# SAME shape and is updated in lockstep, but the leaf's RED→GREEN oracle is the store shape in
# @storytree/library (one package, one suite); the studio readAnchor change is carried as part of the
# same edit and re-proven by capability 5 (the feed) + 7/9 (the frontend + removal). Keeping the leaf's
# proof to ONE package suite is the standalone-resilient-library discipline.
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/library", "test"]
  scope:
    testGlobs: ["packages/library/src/store/**/*.test.ts"]
    sourceGlobs: ["packages/library/src/store/**/*.ts"]
  real:
    editsExisting: true
    testFile: "packages/library/src/store/pg-comment-store.test.ts"
    sourceFile: "packages/library/src/store/pg-comment-store.ts"
    scope:
      testGlobs: ["packages/library/src/store/pg-comment-store.test.ts"]
      sourceGlobs: ["packages/library/src/store/pg-comment-store.ts"]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/library", "typecheck"]
---

# A comment is anchored to a block position, not a text span

**Outcome —** A comment's anchor records which BLOCK it attaches to (a stable block position within
the rendered topic), not a text-quote span; the W3C text-quote anchor shape
(`quote`/`prefix`/`suffix`/`startOffset`) is gone from the stored comment model, and a block-anchored
comment validates at the store's write boundary.

**Depends on —** (root — no within-story upstream)

> **Proof status (honest) — NOT BUILT, `proposed`.** This precedes the code. The `CommentAnchor`
> interface exists today in `packages/library/src/store/pg-comment-store.ts:19-28` (and its mirror in
> `apps/studio/src/types.ts:22-31`) carrying the text-quote model (`kind: 'topic'|'section'|'text'`,
> `quote`, `prefix`, `suffix`, `startOffset`). This capability REPLACES the `text` kind with a `block`
> kind anchored to a block position, and removes the quote-span fields from the stored shape. The pure
> `mergeCommentPatch` helper + the offline import/construct checks already run in
> `pg-comment-store.test.ts` (node:test, no DB); this adds the block-anchor assertions there.

## Guidance

WHY THIS IS A CAPABILITY, NOT A CONTRACT: it is a cohesive change to ONE module's anchor model — the
stored `CommentAnchor` shape, the pure merge that preserves it across a patch, and the canonical
block-anchored doc that the store persists — proven by integration over the store's pure surface (the
real `mergeCommentPatch` + the real module construction against a block-anchored `Comment`), not a
single isolated string assertion. It is the DATA-MODEL half of the block-position move; the inline
rendering of that anchor is the frontend `inline-comment-thread` cap, and the feed that serves it is
`review-refresh-feed`.

THE BLOCK ANCHOR SHAPE (the model — ADR-XXXX). The anchor gains `kind: 'block'` and a block handle
(the leaf's call between a block INDEX and a derived stable block ID — see the story's open call #1;
recommend the stable-id route, mirroring the heading slugs `Markdown.tsx` already mints). It KEEPS
`kind: 'topic'` (a whole-topic comment) and MAY keep `kind: 'section'` (a heading is just a coarse
block). It DROPS `kind: 'text'` and the `quote`/`prefix`/`suffix`/`startOffset` fields — a comment no
longer carries a text span. The consuming AI infers what a block comment refers to from the block
position + the block's text, NOT from a stored quote.

THE STORE IS THE ORACLE, the studio mirror rides along. The RED→GREEN proof lives in ONE package —
`@storytree/library`'s `pg-comment-store.ts` + its node:test suite. The studio-side mirror
(`apps/studio/src/types.ts` `CommentAnchor`, `apps/studio/server/apiRouter.ts` `readAnchor` ~:269) is
the SAME shape and must move in lockstep (the leaf carries that edit), but it is NOT this cap's proof
oracle — keeping the leaf's red→green inside one package suite is the standalone-resilient-library
discipline (a library exercised end-to-end by a test that imports it directly). The `readAnchor`
normalisation change is re-proven downstream by `review-refresh-feed` (cap 5) and the frontend/removal
caps (7/9).

OFFLINE-TESTABLE BY THE PURE SURFACE. Every assertion runs over the pure `mergeCommentPatch` + the
module's import/construct (a bare object stands in for a `Pool` — the constructor issues no SQL, exactly
as `pg-comment-store.test.ts:79-87` does today) against a block-anchored `Comment` literal — no store,
no clock, no DB. The live SQL (list/create/update/remove over `events.comment*`) stays human-verified
behind `STORYTREE_DB_LIVE`, unchanged by this cap.

## Integration test

**Goal —** Prove that the stored comment model anchors to a BLOCK position (not a text span): a
block-anchored `Comment` is the canonical stored shape (`anchor.kind === 'block'` with a block handle,
NO `quote`/`prefix`/`suffix`/`startOffset`), it round-trips through the real `mergeCommentPatch`
without losing or mutating its anchor, and the text-quote anchor shape is gone from the type.

The integration test exercises this capability against its **real in-store collaborator** — the real
`mergeCommentPatch` + the real `PgCommentStore` construction over a block-anchored `Comment` — no
stubs within the store module. It would:

1. Construct a block-anchored `Comment` (`anchor: { kind: 'block', block: <handle>, … }`, no quote
   fields) and assert it is a valid `Comment` (the type admits the block anchor; the text-quote fields
   are not required and not present).
2. Run `mergeCommentPatch(blockComment, { body: 'edited' })` → assert the body changes and the block
   anchor is preserved byte-for-byte (the anchor is not a patchable field; the merge leaves it intact).
3. Run `mergeCommentPatch(blockComment, { resolved: true, resolvedAt: <ts> })` → assert resolve
   toggles without disturbing the block anchor (the resolve fan-out the story UAT leg relies on).
4. Assert the input is not mutated and a new object is returned (the existing merge invariants hold for
   a block anchor exactly as for the old shape).
5. Assert the module imports and `new PgCommentStore({} as Pool)` constructs with `list`/`create`/
   `update`/`remove` present (the offline smoke that the shape change did not break the store surface).

## Contracts (3)

The test-proven leaf behaviours — each **one isolated automated test** (`node:test`, the
`@storytree/library` suite), no DB. None exist yet; each is the assertion a contract test WILL prove
once authored (re-cite at real `file:line` when built). Per ADR-0122 each contract id leads a
distinctly-named test so `storytree coverage block-position-comment-anchor` reports 3/3.

1. **`bpa-block-anchor-is-the-stored-shape`** — a block-position anchor is a valid stored comment anchor
   - **asserts —** a `Comment` whose `anchor.kind === 'block'` with a block handle and NO
     `quote`/`prefix`/`suffix`/`startOffset` is a valid stored shape; the `text` kind and the
     quote-span fields are gone from the `CommentAnchor` type (a `kind: 'text'` anchor with a `quote`
     no longer type-checks / is no longer part of the model).
   - **covers —** `packages/library/src/store/pg-comment-store.ts` (`CommentAnchor`) *(provisional path)*
2. **`bpa-merge-preserves-the-block-anchor`** — patching a comment preserves its block anchor
   - **asserts —** `mergeCommentPatch` over a block-anchored comment changes `body` / toggles
     `resolved`+`resolvedAt` while leaving the block anchor intact (the anchor is not patchable), does
     not mutate the input, and returns a new object.
   - **covers —** `packages/library/src/store/pg-comment-store.ts` (`mergeCommentPatch`) *(provisional path)*
3. **`bpa-store-constructs-over-the-new-shape`** — the store surface is intact after the shape change
   - **asserts —** the module imports without throwing and `new PgCommentStore({} as Pool)` constructs
     with `list`/`create`/`update`/`remove` present (the constructor issues no SQL) — the block-anchor
     change did not break the store's surface.
   - **covers —** `packages/library/src/store/pg-comment-store.ts` (`PgCommentStore`) *(provisional path)*

## Guidance — the slice that earns the signed verdict

The bootstrap rung toward `healthy` (ADR-0057 §3, EDITS-EXISTING): replace the anchor model in place,
test-first.

- **The edited test —** `packages/library/src/store/pg-comment-store.test.ts` (`node:test` +
  `node:assert/strict`, the package convention). Add the block-anchor assertions above; rewrite the
  `sampleComment` anchor to the block shape (or add a `sampleBlockComment` helper). Name each test for
  its contract id (`bpa-…`) so `storytree coverage` reports 3/3 (ADR-0122).
- **The RED the spine observes (before IMPLEMENT) —** the new assertions fail against HEAD, where
  `CommentAnchor.kind` is `'topic'|'section'|'text'` with `quote`/`prefix`/`suffix`/`startOffset` and
  NO `block` field — a `kind: 'block'` anchor does not type-check / is not the stored shape (a
  value/shape red, not module-not-found).
- **The GREEN —** in `packages/library/src/store/pg-comment-store.ts`: change `CommentAnchor` to
  `kind: 'topic' | 'section' | 'block'`, add the block handle field, and remove
  `quote`/`prefix`/`suffix`/`startOffset`. Carry the SAME change into the studio mirror
  (`apps/studio/src/types.ts` `CommentAnchor`, and `apps/studio/server/apiRouter.ts` `readAnchor` so a
  POST normalises to a block anchor and a bare/under-specified anchor downgrades to `topic`, never an
  unfindable locator). After it, the assertions hold and the `@storytree/library` suite + typecheck
  stay green.

Rules:

- **Block, not span** — the stored anchor records WHICH block, never a `quote`/`prefix`/`suffix` text
  span. The text-quote fields are removed, not deprecated-in-place.
- **Keep the merge invariants** — `mergeCommentPatch` still never overwrites `id`, ignores `undefined`,
  applies explicit `null`, and does not mutate the input (the block anchor changes the shape, not the
  merge semantics).
- **The store is the proof oracle** — the red→green lives in `@storytree/library`'s node:test suite;
  the studio mirror moves in lockstep but is re-proven downstream (caps 5 / 7 / 9), not here.
- **No live DB in the proof** — the pure helpers + import/construct run offline; the live SQL stays
  human-verified behind `STORYTREE_DB_LIVE`.
