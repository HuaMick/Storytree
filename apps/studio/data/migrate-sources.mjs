// ONE-SHOT MIGRATION (docs/research/library-sources-unification.md): retire the body `## See also`.
//
//   node apps/studio/data/migrate-sources.mjs --dry   # report only, writes nothing
//   node apps/studio/data/migrate-sources.mjs         # rewrite knowledge.json in place
//
// Per knowledge unit:
//   1. LIFT artifact cross-links named in `seeAlso` prose (backticked ids that match an existing
//      artifact id) into `references` as `asset:<id>` edges — the structured graph absorbs them.
//      (Mechanical + safe: an exact backticked artifact-id in the citation line is a citation.)
//   2. SET `provenance` from the curated PROVENANCE map below — the genuine attribution / "still
//      open" / deferral prose that a grouped pointer can't carry. Everything that was just a
//      restatement of a linked ADR/glossary pointer is intentionally dropped (that duplication is
//      exactly what this change removes). Units absent from the map get no provenance.
//   3. DELETE `seeAlso`.
// The body `## See also` then disappears automatically (renderBody is driven by KIND_SPECS, which
// no longer lists the field). `updatedAt` is bumped only on units that actually changed.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dry = process.argv.includes('--dry');
const dataDir = path.dirname(fileURLToPath(import.meta.url));
const knowledgeFile = path.join(dataDir, 'knowledge.json');
const docs = JSON.parse(readFileSync(knowledgeFile, 'utf8'));
const ids = new Set(docs.map((d) => d.id));
const NOW = '2026-06-08T00:00:00.000Z';

// Curated provenance: only prose NOT recoverable from the grouped Sources list or already in the
// body. Keys are artifact ids; absent = no provenance. (Derived by reviewing every `seeAlso` in the
// dry run and dropping pure pointer-restatements; see the design note.)
const PROVENANCE = {
  'deep-modules': 'Attribution: Ousterhout, via Matt Pocock. Imported from v1.',
  'edit-first-curation': 'Imported from v1.',
  'assess-tradeoffs-by-naming-both-sides': 'Imported from v1.',
  'spine-sequences-leaf-judges': 'The discriminator is carried verbatim from v1.',
  'claims-in-the-shared-store': 'The DBOS-backed mechanism is deferred by ADR-0019.',
  'stack-dbos-postgres': 'Deferred by ADR-0019 (reaffirmed ADR-0020).',
  'thin-wrapper-over-the-runtime':
    "Carries v1's own-a-thin-wrapper-over-the-agent-runtime principle.",
  'event-log-then-projection': "v2's answer to v1's per-build `runs`-grain mess.",
  'durable-workflow-per-node':
    'The DBOS workflow path is deferred by ADR-0019 (reaffirmed ADR-0020).',
  'standalone-resilient-library': 'Carried from v1.',
  'store-lock-races-and-id-collisions':
    'The DBOS-based remedy is deferred by ADR-0019 (reaffirmed ADR-0020).',
  run: 'See `open-questions.md` §3, §8.',
  'approval-event-promotion-event': 'Identity backing is open (`open-questions.md` §1).',
  'lifecycle-status': 'The brownfield `mapped` mechanism is open (`open-questions.md` §2).',
  'operator-attested': 'Persistence / identity backing is open (`open-questions.md` §1).',
  convergence: 'DAG-stabilisation ownership is open (`open-questions.md` §4).',
  'cold-rebuild': 'Carried from Agentic ADR-0006/0027.',
  'per-node-budget': 'The concrete unit and default ceiling stay open (`open-questions.md` §6).',
  approval: 'The identity backing the signature is open (`open-questions.md` §1).',
  evidence:
    'How v2 persists evidence (events vs files) and the attestation / identity model are open (`open-questions.md` §1).',
  'red-green':
    'Per the v1→v2 term map, v1\'s "story is a contract" / red-green reads as this principle, not the noun `contract`.',
  'verification-wins': "The learning loop's v2 home is open (`open-questions.md` §5).",
  claim: 'See `open-questions.md` §3.',
  'write-ownership': 'See `open-questions.md` §3.',
  orchestrator: 'DBOS deferred by ADR-0019.',
  spine: 'Carried verbatim from Agentic ADR-0026; DBOS deferred by ADR-0019.',
  'pi-adapter':
    "Carries v1's own-a-thin-wrapper-over-the-agent-runtime principle (Agentic ADR-0008/0026).",
  'stack-cloud-sql-keyless-iam':
    'Validated 2026-06-08: 73 units migrated keyless, then the instance stopped.',
};

/** Backticked ids in `seeAlso` that name a real artifact (and aren't self / already linked). */
function crossLinks(doc) {
  const sa = doc.seeAlso ?? '';
  const refs = doc.references ?? [];
  const ticks = [...sa.matchAll(/`([a-z][a-z0-9-]+)`/g)].map((m) => m[1]);
  return [...new Set(ticks)].filter(
    (t) => ids.has(t) && t !== doc.id && !refs.includes(`asset:${t}`),
  );
}

let changed = 0;
for (const doc of docs) {
  if (!('seeAlso' in doc)) continue;
  const adds = crossLinks(doc);
  const prov = PROVENANCE[doc.id];

  if (dry) {
    console.log(`\n${doc.id} [${doc.kind}]`);
    if (adds.length) console.log('  +asset refs:', adds.join(', '));
    console.log('  provenance:', prov ? JSON.stringify(prov) : '(none)');
    continue;
  }

  doc.references = [...(doc.references ?? []), ...adds.map((t) => `asset:${t}`)];
  if (prov) doc.provenance = prov;
  delete doc.seeAlso;
  doc.updatedAt = NOW;
  changed++;
}

if (!dry) {
  writeFileSync(knowledgeFile, JSON.stringify(docs, null, 2) + '\n', 'utf8');
  console.log(`migrate-sources: rewrote ${changed} units -> ${knowledgeFile}`);
} else {
  console.log('\n(dry run — nothing written)');
}
