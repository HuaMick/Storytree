// PROTOTYPE (design exploration, not wired in): demonstrate the "Sources" grouped-by-type
// render proposed in docs/research/library-sources-unification.md.
//
//   node docs/research/sources-grouping-prototype.mjs [id ...]
//
// Reads apps/studio/data/knowledge.json (the structured source) and, for the given artifact
// ids (default: a representative pair), resolves each `references` pointer to its target TYPE
// and prints the grouped "## Sources" section that would replace the body `## See also`.
//
// It touches nothing: no schema, no build pipeline, no DB. Pure read + console output.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'studio', 'data');
const docs = JSON.parse(readFileSync(path.join(dataDir, 'knowledge.json'), 'utf8'));
const byId = new Map(docs.map((d) => [d.id, d]));

// Canonical group order + plural labels (mirrors ASSET_CATEGORIES in apps/studio/src/types.ts,
// with the two doc-backed buckets appended last).
const GROUP_ORDER = [
  'Definitions', 'Principles', 'Patterns', 'Guardrails', 'Tech stack',
  'Templates', 'Open questions', 'Decisions (ADRs)', 'Docs & references', 'Other',
];
const CATEGORY_LABEL = {
  definition: 'Definitions', principle: 'Principles', pattern: 'Patterns',
  guardrail: 'Guardrails', techstack: 'Tech stack', template: 'Templates',
  'open-question': 'Open questions', adr: 'Decisions (ADRs)',
};

// The CORPUS-FREE half (would live in packages/core): classify a doc: pointer and shape output.
// The asset: branch needs the corpus, so it takes a `resolveAsset` callback — exactly the seam
// AssetView (useAppData), build-corpus, and the CLI each fill from their own corpus view.
function resolveRef(ref, resolveAsset) {
  if (ref.startsWith('asset:')) {
    const id = ref.slice('asset:'.length);
    const hit = resolveAsset(id);
    return hit
      ? { group: CATEGORY_LABEL[hit.kind] ?? 'Other', label: hit.title, ref }
      : { group: 'Other', label: `${ref} (unknown asset)`, ref };
  }
  if (ref.startsWith('doc:')) {
    const rel = ref.slice('doc:'.length);
    const group = rel.startsWith('decisions/') ? 'Decisions (ADRs)' : 'Docs & references';
    return { group, label: rel, ref };
  }
  return { group: 'Other', label: ref, ref };
}

// The PURE grouping core (would live in packages/core): refs[] + resolver -> ordered groups.
// Empty groups are omitted; within a group, items keep reference order.
function groupSources(refs, resolveAsset) {
  const buckets = new Map();
  for (const r of refs) {
    const { group, label, ref } = resolveRef(r, resolveAsset);
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push({ label, ref });
  }
  return GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => ({ group: g, items: buckets.get(g) }));
}

function renderSources(doc) {
  const groups = groupSources(doc.references ?? [], (id) => byId.get(id));
  const lines = ['## Sources', ''];
  for (const { group, items } of groups) {
    lines.push(`**${group}**`, '');
    for (const it of items) lines.push(`- ${it.label}  \`${it.ref}\``);
    lines.push('');
  }
  if (doc.provenance) lines.push(`_${doc.provenance}_`); // residual prose, if any (none today)
  return lines.join('\n').trimEnd();
}

const ids = process.argv.slice(2);
const targets = ids.length ? ids : ['prove-it-gate', 'stack-cloud-sql-keyless-iam', 'event'];
for (const id of targets) {
  const doc = byId.get(id);
  console.log('='.repeat(70));
  if (!doc) { console.log(`(no artifact "${id}")`); continue; }
  console.log(`${doc.title}  [${doc.kind}]   id: ${id}`);
  console.log('-'.repeat(70));
  console.log('BEFORE — body `## See also` (prose, + a separate "References" list elsewhere):');
  console.log(`  See also: ${doc.seeAlso}`);
  console.log(`  references: ${JSON.stringify(doc.references)}`);
  console.log('');
  console.log('AFTER — one grouped `## Sources`, rendered from `references` alone:');
  console.log(renderSources(doc).split('\n').map((l) => '  ' + l).join('\n'));
  console.log('');
}
