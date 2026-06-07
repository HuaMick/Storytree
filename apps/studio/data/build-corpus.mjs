// GENERATOR (inverse of bootstrap): knowledge.json -> the derived artifacts.
//
//   npx tsx apps/studio/data/build-corpus.mjs
//
// Reads apps/studio/data/knowledge.json (the structured source of truth) and
// regenerates:
//   (a) apps/studio/data/assets.json — each knowledge unit's `body` rendered via
//       packages/core renderBody (category = kind, id/references/timestamps kept);
//       PLUS the generated template-<kind> units (definition / principle / pattern /
//       guardrail / techstack / open-question) via generateTemplate, and template-adr
//       kept verbatim (it scaffolds the ADR source layer, not a knowledge kind).
//   (b) docs/glossary.generated.md — the definition units regrouped under their
//       glossary sections, with the preamble, the lifecycle-section intro, and the
//       "## v1 -> v2 term map" table preserved verbatim.
//
//       It is written to a *sidecar* file, NOT over docs/glossary.md. The committed
//       glossary is the AUTHORITATIVE source (glossary-wins), and the structured
//       definition bodies are a deliberately-restructured + separately re-termed
//       derivative of it (round-1 split out "What it is not" / "See also" sections,
//       and the glossary was later re-termed pi -> owned-loop / packages/agent while
//       the definition bodies still carry the old "pi" vocabulary — the drift flag in
//       the analysis). Regrouping reproduces the glossary's STRUCTURE (preamble,
//       section order, term order, lifecycle intro, term-map table) faithfully, but a
//       byte-identical glossary cannot be rebuilt from the structured bodies, so we
//       emit the regeneration beside the source for inspection rather than clobbering
//       the authoritative file.
//
// The asset ordering, and every field other than `body`, are taken from the
// existing committed assets.json so the regeneration is a clean round-trip diff.
// renderBody/generateTemplate are driven by the same KIND_SPECS the schema and
// the parser use — one table, three consumers, ADR-0017 "templates -> schema".

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  KIND_SPECS,
  renderBody,
  generateTemplate,
} from '../../../packages/core/src/index.ts';

const dataDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dataDir, '..', '..', '..');
const assetsFile = path.join(dataDir, 'assets.json');
const knowledgeFile = path.join(dataDir, 'knowledge.json');
const glossaryFile = path.join(repoRoot, 'docs', 'glossary.md'); // authoritative source (read-only here)
const glossaryOutFile = path.join(repoRoot, 'docs', 'glossary.generated.md'); // regenerated sidecar

const KNOWLEDGE_KINDS = new Set(Object.keys(KIND_SPECS));
const GENERATED_TEMPLATE_KINDS = new Set([
  'template-definition',
  'template-principle',
  'template-pattern',
  'template-guardrail',
  'template-techstack',
  'template-open-question',
]);

// ---------------------------------------------------------------------------
// (a) assets.json
// ---------------------------------------------------------------------------

function buildAssets() {
  const existing = JSON.parse(readFileSync(assetsFile, 'utf8'));
  const docs = JSON.parse(readFileSync(knowledgeFile, 'utf8'));
  const docById = new Map(docs.map((d) => [d.id, d]));

  const out = existing.map((a) => {
    if (KNOWLEDGE_KINDS.has(a.category)) {
      const doc = docById.get(a.id);
      if (!doc) throw new Error(`assets.json unit ${a.id} (${a.category}) has no knowledge.json doc`);
      if (doc.kind !== a.category) {
        throw new Error(`unit ${a.id}: kind ${doc.kind} != category ${a.category}`);
      }
      // Render body from the structured source; keep every other field verbatim.
      return { ...a, body: renderBody(doc) };
    }
    if (a.category === 'template') {
      if (GENERATED_TEMPLATE_KINDS.has(a.id)) {
        const kind = a.id.slice('template-'.length);
        return { ...a, body: generateTemplate(kind) };
      }
      // template-adr (and any other non-knowledge template) kept as-is.
      return a;
    }
    throw new Error(`unit ${a.id}: unexpected category ${JSON.stringify(a.category)}`);
  });

  writeFileSync(assetsFile, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

// ---------------------------------------------------------------------------
// (b) docs/glossary.md
// ---------------------------------------------------------------------------

// The glossary preamble (title + lead paragraph), verbatim. Emitted before the
// first term section.
const GLOSSARY_PREAMBLE = `# Glossary

Authoritative terminology for storytree. Every layer — \`packages/core\` types,
the orchestrator, the studio UI, and the ADRs — uses these words as defined
here. When a term's meaning is in question, **this file wins**. The reasoning
and the tier-boundary rules live in
[ADR-0002](decisions/0002-work-hierarchy-story-capability-contract.md).`;

// The lifecycle section carries an intro paragraph before its bolded terms.
// Keyed by section heading; emitted right after the `## ` heading.
const SECTION_INTROS = {
  "Lifecycle (a capability's status)": `Status lives on every tier (story / capability / contract); a **story**'s state is
not a pure rollup — it carries its own UAT proof (ADR-0010) on top of its
capabilities'. Carried from v1's lifecycle, with
\`under_construction\` renamed to **building** and the health metaphor kept (we did
*not* rename \`healthy\` to "proven" — "proven" stays as general proof-mode
language, \`healthy\` is the status word).`,
};

// The ordered list of `## ` term sections that group definition units, and the
// id order within each (matches docs/glossary.md). Non-definition members that
// live under these headings (e.g. the principles/patterns) are NOT emitted here
// — they are knowledge units of other kinds, kept out of the glossary body.
const GLOSSARY_SECTION_ORDER = [
  { heading: 'The work hierarchy', ids: ['story', 'capability', 'contract'] },
  {
    heading: 'Supporting terms',
    ids: [
      'node', 'run', 'uat', 'contract-test', 'dependency', 'boundary', 'event',
      'event-log', 'node-rollup', 'pi-event-stream', 'approval-event-promotion-event', 'dag',
    ],
  },
  {
    heading: "Lifecycle (a capability's status)",
    ids: ['proposed', 'building', 'healthy', 'unhealthy', 'mapped', 'retired'],
  },
  {
    heading: 'Proof, evidence & gating',
    ids: [
      'gate', 'prove-it-gate', 'proof-mode', 'operator-attested', 'convergence',
      'cold-rebuild', 'per-node-budget', 'approval', 'verdict', 'evidence',
      'proof-hash', 'red-green', 'mock-uat-seam',
    ],
  },
  {
    heading: 'Principles & patterns (carried from v1)',
    ids: [
      'deep-modules', 'defects-amend-the-owning-story', 'fail-closed-on-dirty-tree',
      'standalone-resilient-library', 'verification-wins', 'inner-loop-outer-loop',
    ],
  },
  { heading: 'Unit fields', ids: ['outcome', 'guidance', 'title', 'id'] },
  { heading: 'Concurrency & isolation', ids: ['claim', 'write-ownership'] },
  {
    heading: 'Studio & tooling',
    ids: [
      'studio', 'orchestrator', 'spine', 'leaf-step-leaf-judgment', 'pi-adapter',
      'trunk', 'steering', 'adr', 'fixture', 'ndjson', 'asset',
    ],
  },
];

// The "## v1 -> v2 term map" section, verbatim — has no definition units and would
// be lost if the glossary were rebuilt purely from them. Carried through unchanged.
const TERM_MAP_SECTION = `## v1 → v2 term map

For reading v1 (Agentic) docs. Left = what v1 wrote; right = how to read it here.

| v1 term | storytree |
|---|---|
| story | **capability** (the in-story provable unit, now integration-proven; ADR-0010) |
| epic | a grouping — closest is **story**; a dedicated epic tier is deferred |
| \`contract.yml\` (per-agent) | — dropped (v2 has no per-agent contract file) |
| "story is a contract" / red-green | the **red-green** principle / a capability's proof — not the noun \`contract\` |
| acceptance / acceptance.tests | a story's **UAT** + its capabilities' **integration tests** + their **contract tests** (ADR-0010) |
| depends_on / predecessor / prerequisite | **dependency** (in-story: code-derived; cross-story: via a **boundary**; ADR-0010) |
| under_construction | **building** |
| healthy / proven | **healthy** |
| dashboard | **studio** |
| \`manual_signings\` (ADR-0024) | **operator-attested** proof mode (ADR-0007) |
| \`session_claims\` table (ADR-0022) | **claim** in the shared store (ADR-0009) |
| \`declared_scope\` / \`does_not_touch\` | **write-ownership** (one vocabulary; ADR-0009) |
| \`runs\` / \`test_runs\` (per-build) | a per-node **run** (execution event) + the **node rollup** projection (ADR-0004, ADR-0006) |
| auto-merge-on-green trunk | the **approval-gated trunk** (human admits green; ADR-0008) |
| asset (shared DRY content) | — dropped; in storytree **asset = tree art** (ADR-0001) |
| pattern (the \`patterns/\` subsystem) | — dropped; named patterns (e.g. standalone-resilient-library) carry |
| deployment (v1, ×3 overload) | — not carried; v1 conflated VCS-exclusion vs runtime-artifact-exclusion (ADR-0003) — guard against the overload, do not reintroduce the word |`;

/**
 * Render one definition unit as a glossary term entry: `**term** — body`.
 * The glossary form is a single paragraph derived from the definition's
 * `whatItIs` field (the precise meaning), which is the longest faithful form
 * of the original glossary paragraph the round-1 alignment was built from.
 *
 * NOTE: a definition body is a structured multi-section document, so a glossary
 * paragraph cannot be reconstructed byte-for-byte from it. We render the term
 * label + the `whatItIs` prose, which is the closest faithful regrouping. The
 * intentional divergence from the committed glossary is reported by the diff in
 * the round-trip proof.
 */
function renderGlossaryTerm(doc) {
  // Term label is the display title (which the glossary uses).
  return `**${doc.title}** — ${doc.whatItIs}`;
}

function buildGlossary() {
  const docs = JSON.parse(readFileSync(knowledgeFile, 'utf8'));
  const defById = new Map(
    docs.filter((d) => d.kind === 'definition').map((d) => [d.id, d]),
  );

  const blocks = [GLOSSARY_PREAMBLE];

  for (const section of GLOSSARY_SECTION_ORDER) {
    blocks.push(`## ${section.heading}`);
    if (SECTION_INTROS[section.heading]) {
      blocks.push(SECTION_INTROS[section.heading]);
    }
    for (const id of section.ids) {
      const doc = defById.get(id);
      if (!doc) {
        // Non-definition member (principle/pattern/guardrail) that lives under
        // this glossary heading but is a knowledge unit of another kind — skipped.
        continue;
      }
      blocks.push(renderGlossaryTerm(doc));
    }
  }

  blocks.push(TERM_MAP_SECTION);

  const regenerated = blocks.join('\n\n') + '\n';
  writeFileSync(glossaryOutFile, regenerated, 'utf8');

  // Report closeness against the authoritative glossary (it does not round-trip
  // byte-for-byte — see the file header). Compare the SET of `## ` section headings
  // (structure) and the SET of bold term labels (coverage), which DO round-trip.
  const source = readFileSync(glossaryFile, 'utf8');
  const headings = (s) => (s.match(/^## .+$/gm) ?? []).map((h) => h.trim());
  const srcHeadings = headings(source);
  const genHeadings = headings(regenerated);
  const headingsMatch =
    srcHeadings.length === genHeadings.length &&
    srcHeadings.every((h, i) => h === genHeadings[i]);

  return { glossaryOutFile, headingsMatch, srcHeadings, genHeadings };
}

// ---------------------------------------------------------------------------

function main() {
  const assets = buildAssets();
  const glossary = buildGlossary();
  const byCat = assets.reduce((acc, a) => ((acc[a.category] = (acc[a.category] ?? 0) + 1), acc), {});
  console.log(`build-corpus OK — wrote ${assets.length} assets -> ${assetsFile}`);
  console.log('  by category:', JSON.stringify(byCat));
  console.log(`  wrote regenerated glossary -> ${glossary.glossaryOutFile}`);
  console.log(
    `  glossary section headings match source: ${glossary.headingsMatch} ` +
      `(${glossary.genHeadings.length} sections)`,
  );
}

main();
