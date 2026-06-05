// Seed the Library with artifacts:
//   1. curated principles/guidelines — durable guidance synthesised from the ADRs
//      (each cites its source ADR via `references`) plus a few v1 imports;
//   2. one `definition` artifact per term in docs/glossary.md, auto-extracted.
//
//   node data/seed.assets.mjs            # writes data/assets.json if missing
//   node data/seed.assets.mjs --force    # overwrites
//
// Provenance only: data/assets.json is the runtime store the dev server reads
// and writes. Re-run this to reset the seed. ADRs themselves stay as documents
// (history) under docs/decisions — they are not artifacts.

import { writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const STAMP = '2026-06-05T00:00:00.000Z';
const dataDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dataDir, '..', '..', '..');
const docsDir = path.join(repoRoot, 'docs');
const decisionsDir = path.join(docsDir, 'decisions');

// --- map ADR number -> doc topic ref, from the decisions dir -----------------

const adrFiles = readdirSync(decisionsDir).filter((f) => f.endsWith('.md'));
const adrByNumber = new Map();
for (const f of adrFiles) {
  const m = f.match(/^(\d{4})-/);
  if (m) adrByNumber.set(m[1], `doc:decisions/${f}`);
}
const adr = (n) => adrByNumber.get(String(n).padStart(4, '0')) ?? null;
const GLOSSARY = 'doc:glossary.md';

// --- curated artifacts (principles & guidelines synthesised from ADRs) --------

const para = (...lines) => lines.join('\n\n');

const curated = [
  {
    id: 'deep-modules',
    category: 'principle',
    title: 'Deep modules',
    description:
      "How to judge where a boundary belongs: a module's interface is a cost paid by every caller; its hidden functionality is the benefit. Pay the interface cost only when the hidden work justifies it.",
    body: para(
      "A module's **interface** is a cost paid by every caller (names to learn, invariants to preserve, parameters to thread). The **functionality** it hides is the benefit. Pay the interface cost only when the hidden functionality justifies it.",
      '- **Deep module** — small public surface, large hidden implementation. Callers see one concept and trust it.',
      '- **Shallow module** — wide public surface relative to the work it does; the boundary buys nothing.',
      '### The deletion test',
      '> Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.',
      '_Attribution: Ousterhout, via Matt Pocock. Imported from v1 `assets/principles/deep-modules.yml`. ADR-0002’s work-hierarchy model rests on this._',
    ),
    references: [adr(2)],
  },
  {
    id: 'edit-first-curation',
    category: 'guideline',
    title: 'Edit-first curation',
    description: 'Edit is the default; authoring a new artifact is the justified exception. Search before you write.',
    body: para(
      '**Rule.** Edit is the default. Writing a new artifact is the exception and must be justified: what search terms were run, what the closest existing artifact was, and why editing it was not the right move.',
      '- Duplicate artifacts split authority — a consumer does not know which to trust.',
      '- An edit keeps the revision history and evidence chain attached to the original.',
      '- Search-before-write is the cheapest duplication defence there is.',
      '_Imported from v1 `assets/guidelines/edit-first-curation.yml`._',
    ),
    references: [],
  },
  {
    id: 'assess-tradeoffs-by-naming-both-sides',
    category: 'guideline',
    title: 'Assess tradeoffs by naming both sides',
    description:
      'Every tradeoff surfaced must answer “what are we trading — A vs B?” with both sides in concrete, user-facing terms.',
    body: para(
      'Any tradeoff surfaced must answer **“what are we trading? — A vs B”**, with both sides in concrete user-facing terms: latency, blast radius, contract strength, observability, security posture, reversibility.',
      'Generic “more work” / “more complex” framings do **not** satisfy the rule. In an AI-coded corpus, cascade work amortises; the only durable “more work” cost is AI-illegible complexity guidance and tooling cannot solve.',
      '_Imported from v1. ADR-0001’s “Alternatives considered” follows it._',
    ),
    references: [adr(1)],
  },
  {
    id: 'prove-it-gate',
    category: 'principle',
    title: 'Prove-it gate',
    description: 'A unit reaches `healthy` only via earned, on-disk evidence — never a hand-edit.',
    body: para(
      'A unit reaches `healthy` only through earned, on-disk **evidence** produced by one of its proof modes — never a hand-edit. The gate **refuses** invalid work rather than warning about it.',
      'Corollary — **cold-rebuild** (the health invariant): a unit is `healthy` iff an agent starting *cold*, from the unit’s own spec plus its transitive upstream specs and nothing else, can drive it red→green.',
      '_storytree-native; from `docs/glossary.md` and ADR-0007._',
    ),
    references: [GLOSSARY, adr(7)],
  },
  {
    id: 'proof-mode',
    category: 'definition',
    title: 'Proof mode',
    description: 'The three ways a unit earns `healthy` — capability-UAT, contract-test, and operator-attested.',
    body: para(
      'How a unit earns `healthy`. `packages/core` encodes these as a discriminated `proof_mode` union (ADR-0007).',
      '- **capability-UAT** — an honest scripted walkthrough against *real* collaborators (also generates `dependency` edges).',
      '- **contract-test** — one isolated automated assertion (collaborators stubbed; the mock-UAT seam permits it).',
      '- **operator-attested** — a per-unit, operator-granted signed event for surfaces with neither an honest UAT nor an isolatable test. An agent can never self-exempt.',
    ),
    references: [adr(7), adr(2)],
  },
  {
    id: 'observability-first',
    category: 'principle',
    title: 'Observability-first',
    description:
      'If a state change isn’t a typed event the UI can render, it doesn’t exist. The event model is designed before features.',
    body: para(
      'The event model is designed **before** features. Every state change — pi events and orchestrator events alike — is a typed record in the event store, the single source of truth the studio renders. No external trace SaaS sits in the loop.',
      'Test of the principle: if a state change is not an event the UI can render, **it does not exist**. Observability is not a later pass; it is the foundation.',
      '_Synthesised from ADR-0001 (principles) and ADR-0006 (event store)._',
    ),
    references: [adr(1), adr(6)],
  },
  {
    id: 'own-the-layers',
    category: 'principle',
    title: 'Go slow, own the layers',
    description:
      'Own every load-bearing layer; stay model-agnostic and self-hosted. No vibing the parts the system rests on.',
    body: para(
      'v2’s bet, learned from v1: **design the load-bearing layers up front, go slow, own every layer, stay model-agnostic.** No vibing the parts the system rests on (the event model, concurrency-safe state, the orchestrator spine).',
      'Model-agnostic and self-hosted: API keys, not a subscription; your data and traces stay yours. The orchestrator owns only what pi does not — multi-node scheduling and durable, concurrency-safe shared state.',
      '_Synthesised from ADR-0001._',
    ),
    references: [adr(1)],
  },
  {
    id: 'one-model-boundary',
    category: 'guideline',
    title: 'Confine model calls to one boundary',
    description:
      'pi is reached only through packages/pi-adapter; only the orchestrator drives it; a run is an event, never a node; the orchestrator is the sole fan-out point.',
    body: para(
      'Confine every model call behind one orchestrator-driven boundary, so model-unavailability is a *local* failure, never a system outage.',
      '- pi is reached **only** through `packages/pi-adapter` — the sole place a model runtime is imported.',
      '- **Only** `packages/orchestrator` drives the adapter; `packages/core` and `apps/studio` have no path to a model runtime.',
      '- **Run ≠ node:** a pi run/attempt is an execution event, never a new tree node.',
      '- The orchestrator is the **sole fan-out point** — pi nodes never schedule child nodes.',
      '_Synthesised from ADR-0004._',
    ),
    references: [adr(4)],
  },
  {
    id: 'spine-sequences-leaf-judges',
    category: 'principle',
    title: 'The spine sequences, the leaf judges',
    description:
      'If a for-loop or a match could express the routing, the spine (code) owns it; if the routing needs the model to decide what comes next, the leaf (pi node) owns it.',
    body: para(
      'The discriminator for where control-flow lives (carried verbatim from v1):',
      '> If a for-loop or a match could express the routing, the **spine** owns it; if the routing needs the model to decide what comes next, the **leaf** (pi node) owns it.',
      'The spine is the code-sequenced orchestrator over DBOS workflows — closed, deterministic routing. A pi session’s own model loop is the leaf it delegates to.',
      '_Synthesised from ADR-0005._',
    ),
    references: [adr(5)],
  },
  {
    id: 'approval-gated-trunk',
    category: 'principle',
    title: 'Approval-gated trunk',
    description:
      'A green result is a request for human diff-review, not an automatic merge. The human holds the outer loop; content invariants are never bypassable.',
    body: para(
      'The studio **drives** agents; the human sits at the **outer loop**.',
      '- **Per-action approval** is first-class (inverts v1’s skip-permissions): approve / reject / steer individual pi actions in-loop.',
      '- **Approval-gated trunk** (inverts auto-merge-on-green): a green result surfaces for human diff-review and lands only on approval, as a signed promotion event.',
      '- Content invariants — contracts green, UAT signed, upstream healthy — are **never bypassable**.',
      '_Synthesised from ADR-0008._',
    ),
    references: [adr(8)],
  },
  {
    id: 'claims-in-the-shared-store',
    category: 'guideline',
    title: 'Claims live in the shared store',
    description:
      'Write-ownership is a typed claim checked at node-schedule time in the one shared store; a conflict is a hard refusal, never a warning.',
    body: para(
      'Coordination moves off git and into the one shared Postgres store (DBOS).',
      '- A **claim** is a typed write-ownership record naming what a node intends to write, checked under a serializable/unique constraint at **node-schedule time**.',
      '- A conflict is a **hard refusal** (a `claim-conflict-refused` event), never a warning.',
      '- DBOS workflow isolation replaces branch-per-session for coordination; DB-allocated ids dissolve the collision classes.',
      '_Synthesised from ADR-0009._',
    ),
    references: [adr(9)],
  },
];

// --- definitions auto-extracted from docs/glossary.md ------------------------

function firstSentence(text) {
  const plain = text
    .replace(/\s+/g, ' ')
    .replace(/[*_`]/g, '')
    .trim();
  const m = plain.match(/^(.+?[.;])(\s|$)/);
  const s = (m ? m[1] : plain).trim();
  return s.length > 200 ? s.slice(0, 197).trimEnd() + '…' : s;
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractGlossaryDefinitions(usedIds) {
  const raw = readFileSync(path.join(docsDir, 'glossary.md'), 'utf8');
  // Drop the v1→v2 term-map table at the end — it isn't term definitions.
  const cut = raw.indexOf('## v1 → v2 term map');
  const text = cut === -1 ? raw : raw.slice(0, cut);

  const out = [];
  const seen = new Set(usedIds);
  for (const block of text.split(/\n\s*\n/)) {
    const b = block.trim();
    // A definition block: **term** [(aside)] — body…   (em/en dash)
    const m = b.match(/^\*\*(.+?)\*\*\s*(?:\([^)]*\))?\s*[—–]\s*([\s\S]+)$/);
    if (!m) continue;
    const term = m[1].replace(/[*_`]/g, '').trim();
    const defBody = m[2].trim();
    const id = slugify(term);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const refs = [GLOSSARY];
    for (const am of defBody.matchAll(/ADR-(\d{4})/g)) {
      const ref = adr(am[1]);
      if (ref && !refs.includes(ref)) refs.push(ref);
    }
    out.push({
      id,
      category: 'definition',
      title: term,
      description: firstSentence(defBody),
      body: defBody,
      references: refs,
      createdAt: STAMP,
      updatedAt: STAMP,
    });
  }
  return out;
}

// --- assemble + write --------------------------------------------------------

const curatedFull = curated.map((a) => ({
  ...a,
  references: a.references.filter(Boolean),
  createdAt: STAMP,
  updatedAt: STAMP,
}));
const definitions = extractGlossaryDefinitions(curatedFull.map((a) => a.id));
const assets = [...curatedFull, ...definitions];

const force = process.argv.includes('--force');
const outFile = path.join(dataDir, 'assets.json');
if (existsSync(outFile) && !force) {
  console.log(`assets.json already exists; pass --force to overwrite (${outFile})`);
} else {
  writeFileSync(outFile, JSON.stringify(assets, null, 2) + '\n', 'utf8');
  const byCat = assets.reduce((acc, a) => ((acc[a.category] = (acc[a.category] ?? 0) + 1), acc), {});
  console.log(`wrote ${assets.length} artifacts → ${outFile}`);
  console.log('  by category:', JSON.stringify(byCat));
}
