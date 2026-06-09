import { KIND_SPECS, type Knowledge, type KnowledgeKind } from "./knowledge.js";

/**
 * Render a knowledge unit's markdown `body` from its structured fields, EXACTLY in the
 * round-1 layout. Driven entirely by {@link KIND_SPECS} so it cannot drift from the schema
 * or the template generator.
 *
 * Layout: the lead field renders as `${heading} ${value}` (e.g. `**In one line.** ...`),
 * then each present non-lead field renders as `## ${heading}\n\n${value}`. Blocks are joined
 * by a blank line (`\n\n`). Optional fields that are absent emit nothing — never an empty
 * heading. Citations are NOT part of the body: there is no `## See also` section — related
 * material is the structured `references` field, rendered separately as a grouped "Sources"
 * view (see `groupSources` in knowledge-sources.ts).
 *
 * This is the inverse of the per-kind parse rules and reproduces the stored bodies
 * byte-for-byte for round-trip fidelity.
 */
export function renderBody(doc: Knowledge): string {
  const specs = KIND_SPECS[doc.kind as KnowledgeKind];
  const fields = doc as unknown as Record<string, string | undefined>;
  const blocks: string[] = [];
  for (const spec of specs) {
    const value = fields[spec.field];
    if (value == null) continue; // optional + absent -> emit nothing
    if (spec.lead) {
      blocks.push(`${spec.heading} ${value}`);
    } else {
      blocks.push(`## ${spec.heading}\n\n${value}`);
    }
  }
  return blocks.join("\n\n");
}

/**
 * Generate the BLANK template body for a kind — the lead marker + every heading, each
 * filled with its italic placeholder — from the SAME {@link KIND_SPECS}. This is the
 * ADR-0017 deliverable: templates become a generated view of the schema, not a parallel
 * hand-authored artifact. Reproduces the canonical `template-<kind>` bodies byte-for-byte.
 *
 * Unlike `renderBody`, the template emits ALL fields (including optional ones) so an author
 * sees every available section.
 */
export function generateTemplate(kind: KnowledgeKind): string {
  const specs = KIND_SPECS[kind];
  const blocks: string[] = [];
  for (const spec of specs) {
    if (spec.lead) {
      blocks.push(`${spec.heading} ${spec.placeholder}`);
    } else {
      blocks.push(`## ${spec.heading}\n\n${spec.placeholder}`);
    }
  }
  return blocks.join("\n\n");
}
