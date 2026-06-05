---
id: "seed-library-corpus"
tier: capability
story: studio-foundation
title: "Seed the Library corpus from the ADRs and glossary"
outcome: "Running the seeder produces the categorised, ADR-cited starter corpus the Library serves."
status: "proposed"
proof_mode: "capability-UAT"
depends_on: []
---

# Seed the Library corpus from the ADRs and glossary

**Outcome —** Running the seeder produces the categorised, ADR-cited starter corpus the Library serves.

**Depends on —** *(none — a root capability)*

> **Proof status (honest) —** Code exists and runs today, and is the lone studio unit whose proof is AUTOMATABLE NOW. seed.assets.mjs executes under `node apps/studio/data/seed.assets.mjs` and produces apps/studio/data/assets.json; the committed output is verified to match the spec — 81 artifacts, split {principle:5,pattern:11,guardrail:8,techstack:4,definition:53}, 80 of 81 with >=1 reference, all references doc:-prefixed, dup-slug 'proof mode' skipped, term-map table excluded, per-mention ADR refs present (e.g. 'node' cites ADR-0004 + ADR-0009). HOWEVER there is NO automated test and NO scripted UAT in the repo: the UAT and all 9 contracts are RETROSPECTIVE — they describe assertions that WOULD prove each behaviour; none are currently written or running. NOT proven, NOT healthy — author-built and manually observed only.

## Guidance

Run the seeder from anywhere: it derives paths from import.meta.url (dataDir → repoRoot two levels up → docs/, docs/decisions/), so it does not depend on cwd. The output count (81) and category split (principle 5, pattern 11, guardrail 8, techstack 4, definition 53) are EMERGENT, not configured: curated holds 28 hand-written entries (seed.assets.mjs:38-420), and definitions come from auto-extracting docs/glossary.md. The 53 definitions = 52 glossary-extracted + 1 curated ('proof-mode', seed.assets.mjs:95). FOUR glossary blocks are intentionally dropped as duplicate slugs — `proof-mode`, `prove-it-gate`, `deep-modules`, and `standalone-resilient-library` — because extractGlossaryDefinitions seeds its `seen` set with all curated ids (seed.assets.mjs:452), so any glossary term whose slug collides with a curated artifact id is skipped; this is the dup-slug-skip, and it is why curated must be assembled before definitions (seed.assets.mjs:491). (Audit-corrected: the field originally named only the 'proof mode' collision; the other three collide with curated principle/pattern/guardrail ids. The net 53 definitions = 52 glossary-extracted + 1 curated is unchanged.) A definition block is recognised only when it matches the anchored regex `^**term** [optional (aside)] —/– body` with an em/en dash (seed.assets.mjs:456); a hyphen will not match. The v1→v2 term-map table is excluded by a plain string indexOf cut on the exact heading '## v1 → v2 term map' (seed.assets.mjs:447-449) — renaming or re-glyphing that heading silently re-includes the table. References are emitted as `doc:` topic refs, never as ADR artifacts (ADRs stay as documents); adr(n) zero-pads to 4 digits and returns null on a miss, and nulls are stripped for curated (filter(Boolean), seed.assets.mjs:487) but glossary refs are only-ever-truthy by construction. Determinism comes from a hardcoded STAMP ('2026-06-05T00:00:00.000Z', seed.assets.mjs:17) applied to every artifact, so --force regenerates byte-identical output. The script has no test harness or output-path argument; assets.json is the runtime store the dev server (dev-server-persistence-backbone) later reads and mutates, so re-running --force is the documented reset. depends_on is empty: the UAT walks entirely against the filesystem + the two doc sources; it needs no other capability real, and the two Library app capabilities depend on THIS, not the reverse. (VERIFIED against apps/studio/data/assets.json: 81 total, byCat {principle:5,pattern:11,definition:53,guardrail:8,techstack:4}, 80 with refs, 1 without (edit-first-curation), 127 doc: refs, 0 asset: refs; 'node' definition cites doc:glossary.md + ADR-0004 + ADR-0009.)

## UAT — capability-UAT

**Goal —** Prove that running the seeder against the real on-disk docs produces the categorised, ADR-cited starter corpus the Library serves — with no React app and no dev server involved.

The single end-to-end walkthrough against **real** collaborators that proves this
capability's goal (minimal-first; mocks are forbidden here — the mock-UAT seam).

1. From the repo root, delete apps/studio/data/assets.json so the output starts absent.
2. Run `node apps/studio/data/seed.assets.mjs` and observe stdout print `wrote 81 artifacts → …/assets.json` followed by `by category: {"principle":5,"pattern":11,"definition":53,"techstack":4,"guardrail":8}` (categories summing to 81).
3. Open apps/studio/data/assets.json and confirm it parses as a JSON array of 81 objects, each carrying id, category (one of principle/pattern/guardrail/techstack/definition), title, description, body, references, createdAt, updatedAt.
4. Spot-check a curated artifact: 'deep-modules' (category principle) cites 'doc:decisions/0002-work-hierarchy-story-capability-contract.md' — proving the adr(n) helper resolved ADR-2 to the real file scanned from docs/decisions.
5. Spot-check the glossary auto-extraction: a 'definition' artifact such as 'node' exists, cites 'doc:glossary.md', and additionally carries the per-mention ADR refs found in its body (doc:decisions/0004-…, doc:decisions/0009-…); confirm 52 of the 53 definitions carry the doc:glossary.md ref (the 53rd, 'proof-mode', is curated).
6. Confirm no artifact derived from the v1→v2 term-map table exists (the table after the '## v1 → v2 term map' marker was cut before extraction) and that every reference string is doc:-prefixed (80 of 81 artifacts have >=1 ref; only 'edit-first-curation' has none).
7. Re-run `node apps/studio/data/seed.assets.mjs` (no flag) and observe it print `assets.json already exists; pass --force to overwrite (…)` and leave the file untouched — the no-clobber guard.
8. Re-run `node apps/studio/data/seed.assets.mjs --force` and observe it regenerate the identical 81-artifact corpus, proving --force overrides the guard and the output is deterministic (fixed STAMP timestamps).

## Contracts (9)

The test-proven leaf behaviours — each **one isolated automated test** with
collaborators stubbed (ADR-0002). No automated tests exist yet; each entry is the
assertion a contract test *would* prove, with the real code it covers.

1. **`slc-adr-helper-maps-number-to-scanned-ref`** — adr(n) maps an ADR number to the doc ref scanned from the decisions dir
   - **asserts —** Given the decisions dir contains 0002-work-hierarchy-story-capability-contract.md, adr(2) returns 'doc:decisions/0002-work-hierarchy-story-capability-contract.md' and adr(99) (no matching file) returns null.
   - **covers —** `apps/studio/data/seed.assets.mjs:25-31`
2. **`slc-glossary-block-parses-term-and-body`** — A `**term** — body` block becomes a definition artifact
   - **asserts —** Given a glossary string with a single block '**node** — a unit on the DAG.', extraction yields one artifact with id 'node', category 'definition', title 'node', and body 'a unit on the DAG.'
   - **covers —** `apps/studio/data/seed.assets.mjs:453-478`
3. **`slc-term-map-table-excluded-from-extraction`** — Content after the `## v1 → v2 term map` marker is cut before extraction
   - **asserts —** Given a glossary string whose only `**term** — body` block sits below a '## v1 → v2 term map' heading, extraction returns an empty array.
   - **covers —** `apps/studio/data/seed.assets.mjs:447-449`
4. **`slc-duplicate-slug-is-skipped`** — A block whose slug is already seen (curated or earlier) is skipped
   - **asserts —** Given usedIds already contains 'proof-mode' and the glossary fixture defines '**proof mode** — …', extraction does not emit a second 'proof-mode' artifact.
   - **covers —** `apps/studio/data/seed.assets.mjs:452,461-462`
5. **`slc-per-mention-adr-refs-appended-to-definition`** — Each ADR-NNNN mention in a definition body adds its resolved doc ref
   - **asserts —** Given a definition body containing 'ADR-0004' and 'ADR-0009', the artifact's references are ['doc:glossary.md','doc:decisions/0004-…','doc:decisions/0009-…'] with no duplicates.
   - **covers —** `apps/studio/data/seed.assets.mjs:464-468`
6. **`slc-first-sentence-strips-markdown-and-truncates`** — description is the first sentence, markdown-stripped and capped at 200 chars
   - **asserts —** firstSentence('**A** long *clause*; trailing.') returns 'A long clause;' (markup removed, cut at first ./;), and a >200-char input is truncated to 197 chars + '…'.
   - **covers —** `apps/studio/data/seed.assets.mjs:424-432`
7. **`slc-curated-references-drop-nulls`** — A curated artifact's null refs (unresolved adr) are filtered out
   - **asserts —** For a curated entry whose references include a null (adr() miss), the written artifact's references array contains only the truthy doc refs — no null entry.
   - **covers —** `apps/studio/data/seed.assets.mjs:485-490`
8. **`slc-no-clobber-without-force`** — An existing assets.json is not overwritten unless --force is passed
   - **asserts —** When existsSync(outFile) is true and argv lacks --force, writeFileSync is never called and the 'already exists; pass --force' branch is taken.
   - **covers —** `apps/studio/data/seed.assets.mjs:494-498`
9. **`slc-force-writes-and-logs-by-category`** — With --force (or no file), it writes the corpus and logs the by-category tally
   - **asserts —** When the write branch runs, writeFileSync is called once with the assembled array serialized as JSON, and a by-category count object is logged whose values sum to the artifact total.
   - **covers —** `apps/studio/data/seed.assets.mjs:499-502`
