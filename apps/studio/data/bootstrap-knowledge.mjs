// ONE-TIME bootstrap: assets.json (runtime store, body=markdown) -> knowledge.json
// (structured Knowledge docs, the ADR-0017 structured source of truth).
//
//   npx tsx apps/studio/data/bootstrap-knowledge.mjs
//
// Reads apps/studio/data/assets.json, parses each non-template / non-adr unit's
// markdown `body` into the per-kind structured fields, and writes
// apps/studio/data/knowledge.json (an array of Knowledge docs). Every doc is
// validated against the packages/core zod schema; the script FAILS LOUDLY on the
// first unit that does not parse or validate.
//
// Parse is driven entirely by KIND_SPECS (the single per-kind field table), so it
// is the inverse of renderBody and cannot drift from the schema/renderer/template.
// The round-trip contract: parse(body) -> renderBody(doc) reproduces `body`
// byte-for-byte. To keep that contract, the whole `## See also` block is stored
// verbatim in `seeAlso` and `provenance` is left empty (the round-1 bodies fuse
// attribution into the See-also italic line for every kind).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  KIND_SPECS,
  Knowledge,
  renderBody,
} from '../../../packages/core/src/index.ts';

const dataDir = path.dirname(fileURLToPath(import.meta.url));
const assetsFile = path.join(dataDir, 'assets.json');
const outFile = path.join(dataDir, 'knowledge.json');

const KNOWLEDGE_KINDS = new Set(Object.keys(KIND_SPECS));

/**
 * Parse one asset body into structured fields for its kind, driven by KIND_SPECS.
 *
 * The body shape is: `${leadHeading} <lead value>` then a sequence of
 * `## <Heading>\n\n<value>` blocks. We split on `## ` headings, map each heading
 * to its field by exact heading text, and assign the trimmed block body.
 *
 * Returns a map of field -> markdown string for the present fields only.
 */
function parseBody(kind, body) {
  const specs = KIND_SPECS[kind];
  const leadSpec = specs.find((s) => s.lead);
  if (!leadSpec) throw new Error(`kind ${kind} has no lead field`);

  // Heading text (without "## ") -> field name, for the non-lead section fields.
  const headingToField = new Map();
  for (const s of specs) {
    if (!s.lead) headingToField.set(s.heading, s.field);
  }

  // Split the body into a lead chunk + one chunk per "## Heading" section.
  // A heading line is `^## (.+)$`. Everything before the first heading is the lead.
  const lines = body.split('\n');
  const sections = []; // { heading: string|null, content: string[] }
  let current = { heading: null, content: [] };
  for (const line of lines) {
    const m = line.match(/^## (.+)$/);
    if (m) {
      sections.push(current);
      current = { heading: m[1], content: [] };
    } else {
      current.content.push(line);
    }
  }
  sections.push(current);

  const fields = {};

  // --- lead ---
  const leadChunk = sections.shift();
  if (leadChunk.heading !== null) {
    throw new Error(`${kind}: expected a lead block before the first heading`);
  }
  const leadRaw = leadChunk.content.join('\n').trim();
  const leadPrefix = `${leadSpec.heading} `;
  if (!leadRaw.startsWith(leadPrefix)) {
    throw new Error(
      `${kind}: lead block does not start with ${JSON.stringify(leadPrefix)} — got ${JSON.stringify(leadRaw.slice(0, 40))}`,
    );
  }
  fields[leadSpec.field] = leadRaw.slice(leadPrefix.length).trim();

  // --- sections ---
  for (const sec of sections) {
    const field = headingToField.get(sec.heading);
    if (!field) {
      throw new Error(`${kind}: unexpected "## ${sec.heading}" heading (not in KIND_SPECS)`);
    }
    const value = sec.content.join('\n').trim();
    if (value.length === 0) {
      throw new Error(`${kind}: empty "## ${sec.heading}" section`);
    }
    fields[field] = value;
  }

  return fields;
}

/** Which docs/glossary.md `## ` section each definition term sits under. */
const GLOSSARY_SECTION_BY_ID = {
  // The work hierarchy
  story: 'The work hierarchy',
  capability: 'The work hierarchy',
  contract: 'The work hierarchy',
  // Supporting terms
  node: 'Supporting terms',
  run: 'Supporting terms',
  uat: 'Supporting terms',
  'contract-test': 'Supporting terms',
  dependency: 'Supporting terms',
  boundary: 'Supporting terms',
  event: 'Supporting terms',
  'event-log': 'Supporting terms',
  'node-rollup': 'Supporting terms',
  'pi-event-stream': 'Supporting terms',
  'approval-event-promotion-event': 'Supporting terms',
  dag: 'Supporting terms',
  // Lifecycle (a capability's status)
  proposed: "Lifecycle (a capability's status)",
  building: "Lifecycle (a capability's status)",
  healthy: "Lifecycle (a capability's status)",
  unhealthy: "Lifecycle (a capability's status)",
  mapped: "Lifecycle (a capability's status)",
  retired: "Lifecycle (a capability's status)",
  // Proof, evidence & gating
  gate: 'Proof, evidence & gating',
  'operator-attested': 'Proof, evidence & gating',
  convergence: 'Proof, evidence & gating',
  'per-node-budget': 'Proof, evidence & gating',
  approval: 'Proof, evidence & gating',
  verdict: 'Proof, evidence & gating',
  evidence: 'Proof, evidence & gating',
  'proof-hash': 'Proof, evidence & gating',
  'mock-uat-seam': 'Proof, evidence & gating',
  'proof-mode': 'Proof, evidence & gating',
  // Principles & patterns (carried from v1) — definition members
  'inner-loop-outer-loop': 'Principles & patterns (carried from v1)',
  // Unit fields
  outcome: 'Unit fields',
  guidance: 'Unit fields',
  title: 'Unit fields',
  id: 'Unit fields',
  // Concurrency & isolation
  claim: 'Concurrency & isolation',
  'write-ownership': 'Concurrency & isolation',
  // Studio & tooling
  studio: 'Studio & tooling',
  orchestrator: 'Studio & tooling',
  spine: 'Studio & tooling',
  'leaf-step-leaf-judgment': 'Studio & tooling',
  'pi-adapter': 'Studio & tooling',
  trunk: 'Studio & tooling',
  steering: 'Studio & tooling',
  adr: 'Studio & tooling',
  fixture: 'Studio & tooling',
  ndjson: 'Studio & tooling',
  asset: 'Studio & tooling',
};

function main() {
  const assets = JSON.parse(readFileSync(assetsFile, 'utf8'));

  const docs = [];
  const skipped = { template: 0, adr: 0 };
  const failures = [];

  for (const a of assets) {
    if (a.category === 'template') {
      skipped.template++;
      continue;
    }
    if (a.category === 'adr') {
      skipped.adr++;
      continue;
    }
    if (!KNOWLEDGE_KINDS.has(a.category)) {
      throw new Error(`unit ${a.id}: unknown category ${JSON.stringify(a.category)}`);
    }

    const kind = a.category;
    let fields;
    try {
      fields = parseBody(kind, a.body);
    } catch (err) {
      failures.push({ id: a.id, stage: 'parse', message: String(err.message ?? err) });
      continue;
    }

    const doc = {
      kind,
      id: a.id,
      title: a.title,
      description: a.description,
      references: a.references ?? [],
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      // provenance intentionally omitted (fused into seeAlso for round-trip fidelity)
      ...fields,
    };
    if (kind === 'definition' && GLOSSARY_SECTION_BY_ID[a.id]) {
      doc.glossarySection = GLOSSARY_SECTION_BY_ID[a.id];
    }

    // Validate against the packages/core zod schema.
    const parsed = Knowledge.safeParse(doc);
    if (!parsed.success) {
      failures.push({
        id: a.id,
        stage: 'validate',
        message: JSON.stringify(parsed.error.issues, null, 2),
      });
      continue;
    }

    // Self-check the round-trip immediately: renderBody(doc) must equal the source body.
    const rendered = renderBody(parsed.data);
    if (rendered !== a.body) {
      failures.push({
        id: a.id,
        stage: 'round-trip',
        message:
          `renderBody != source body.\n--- source ---\n${a.body}\n--- rendered ---\n${rendered}`,
      });
      continue;
    }

    docs.push(parsed.data);
  }

  if (failures.length > 0) {
    console.error(`\nBOOTSTRAP FAILED: ${failures.length} unit(s) did not parse/validate/round-trip:\n`);
    for (const f of failures) {
      console.error(`  [${f.stage}] ${f.id}: ${f.message}\n`);
    }
    process.exit(1);
  }

  writeFileSync(outFile, JSON.stringify(docs, null, 2) + '\n', 'utf8');

  const byKind = docs.reduce((acc, d) => ((acc[d.kind] = (acc[d.kind] ?? 0) + 1), acc), {});
  console.log(`bootstrap OK — wrote ${docs.length} knowledge docs -> ${outFile}`);
  console.log('  by kind:', JSON.stringify(byKind));
  console.log(`  skipped: template=${skipped.template} adr=${skipped.adr}`);
}

main();
