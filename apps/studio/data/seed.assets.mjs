// Seed the guidance library with a few real, cross-referenced assets so the
// foundation isn't an empty shell. Two are imported/condensed from the v1
// (Agentic) `assets/` corpus; two are storytree-native (lifted from the
// glossary / ADR-0007) — showing the library holds both imported and new
// guidance, each referencing the live ADR corpus.
//
//   node data/seed.assets.mjs            # writes data/assets.json if missing
//   node data/seed.assets.mjs --force    # overwrites
//
// Provenance only: data/assets.json is the runtime store the dev server reads
// and writes. Re-run this to reset the seed.

import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const STAMP = '2026-06-05T00:00:00.000Z';

const assets = [
  {
    id: 'deep-modules',
    category: 'principle',
    title: 'Deep modules',
    description:
      "How to judge where a boundary belongs: a module's interface is a cost paid by every caller; its hidden functionality is the benefit. Pay the interface cost only when the hidden work justifies it.",
    body: [
      "A module's **interface** is a cost paid by every caller (names to learn, invariants to preserve, parameters to thread). The **functionality** it hides is the benefit. The deep-modules principle: pay the interface cost only when the hidden functionality justifies it.",
      '- **Deep module** — small public surface, large hidden implementation. Callers see one concept and trust it.',
      '- **Shallow module** — wide public surface relative to the work it does. Callers must understand the interface *and* the implementation it leaks; the boundary buys nothing.',
      '### The deletion test',
      '> Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.',
      '### Three friction signals (too shallow)',
      '1. Bouncing between many small modules to understand one concept.',
      '2. Interface nearly as complex as the implementation.',
      '3. Pure functions extracted solely for testability, where the real bugs hide in how they are called.',
      '_Attribution: Ousterhout, *A Philosophy of Software Design*, via Matt Pocock. Imported from v1 `assets/principles/deep-modules.yml`. ADR-0002’s work-hierarchy model rests on this._',
    ].join('\n\n'),
    tags: ['design', 'boundaries', 'judgement', 'v1-import'],
    references: ['doc:decisions/0002-work-hierarchy-story-capability-contract.md'],
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: 'edit-first-curation',
    category: 'guideline',
    title: 'Edit-first curation',
    description:
      'Edit is the default; authoring a new artifact is the justified exception. Search before you write.',
    body: [
      '**Rule.** Edit is the default. Writing a new artifact (a doc, an asset, a unit) is the exception and must be justified: what search terms were run, what the closest existing artifact was, and why editing it was not the right move.',
      '**Why.**',
      '- Duplicate artifacts split authority — a consumer does not know which to trust.',
      '- An edit keeps the revision history and evidence chain attached to the original.',
      '- Search-before-write is the cheapest duplication defence there is; this makes “I didn’t know it existed” an unacceptable answer.',
      '_Imported from v1 `assets/guidelines/edit-first-curation.yml`._',
    ].join('\n\n'),
    tags: ['curation', 'dry', 'authoring', 'v1-import'],
    references: [],
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: 'assess-tradeoffs-by-naming-both-sides',
    category: 'guideline',
    title: 'Assess tradeoffs by naming both sides',
    description:
      "Every tradeoff surfaced must answer “what are we trading — A vs B?” with both sides in concrete, user-facing terms.",
    body: [
      'Any tradeoff surfaced (to the owner, in an ADR, in a scope decision, in an implementation choice) must answer **“what are we trading? — A vs B”**, with both sides stated in concrete user-facing terms: latency, blast radius, contract strength, observability, security posture, reversibility.',
      'Generic “more work” / “more complex” framings do **not** satisfy the rule. In an AI-coded corpus, cascade work amortises and is not by itself a durable cost; the only durable “more work” cost is AI-illegible complexity that guidance and tooling cannot solve — and that bar is high.',
      '_Imported from v1 `assets/guidelines/assess-tradeoffs-by-naming-both-sides.yml`. The ADRs in this corpus follow it (see ADR-0001’s “Alternatives considered”)._',
    ].join('\n\n'),
    tags: ['communication', 'decisions', 'v1-import'],
    references: ['doc:decisions/0001-foundational-stack.md'],
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: 'prove-it-gate',
    category: 'principle',
    title: 'Prove-it gate',
    description:
      'A unit reaches `healthy` only via earned, on-disk evidence — never a hand-edit.',
    body: [
      'A unit reaches `healthy` only through earned, on-disk **evidence** produced by one of its proof modes — never a hand-edit. The gate **refuses** invalid work rather than warning about it.',
      'Corollary — **cold-rebuild** (the health invariant): a unit is `healthy` iff an agent starting *cold*, from the unit’s own spec plus its transitive upstream specs and nothing else, can drive it red→green.',
      '_storytree-native; lifted from `docs/glossary.md` (“prove-it-gate”, “cold-rebuild”) and ADR-0007._',
    ].join('\n\n'),
    tags: ['proof', 'gate', 'invariant', 'storytree'],
    references: ['doc:glossary.md', 'doc:decisions/0007-proof-model.md'],
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: 'proof-mode',
    category: 'definition',
    title: 'Proof mode',
    description:
      'What it is: the three ways a unit earns `healthy` — capability-UAT, contract-test, and operator-attested.',
    body: [
      'How a unit earns `healthy`. `packages/core` encodes these as a discriminated `proof_mode` union (ADR-0007).',
      '- **capability-UAT** — an honest scripted walkthrough against *real* collaborators (also generates `dependency` edges).',
      '- **contract-test** — one isolated automated assertion (collaborators stubbed; the mock-UAT seam permits it).',
      '- **operator-attested** — a per-unit, operator-granted signed event for surfaces with neither an honest UAT nor an isolatable test (e.g. the orchestrator’s own routing). An agent can never self-exempt; distinct in the audit trail from a UAT sign.',
      '_storytree-native; from `docs/glossary.md` and ADR-0007 §Decision._',
    ].join('\n\n'),
    tags: ['proof', 'schema', 'storytree'],
    references: [
      'doc:decisions/0007-proof-model.md',
      'doc:decisions/0002-work-hierarchy-story-capability-contract.md',
    ],
    createdAt: STAMP,
    updatedAt: STAMP,
  },
];

const force = process.argv.includes('--force');
const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets.json');

if (existsSync(outFile) && !force) {
  console.log(`assets.json already exists; pass --force to overwrite (${outFile})`);
} else {
  writeFileSync(outFile, JSON.stringify(assets, null, 2) + '\n', 'utf8');
  console.log(`wrote ${assets.length} seed assets → ${outFile}`);
}
