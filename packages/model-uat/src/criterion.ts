import { z } from "zod";

/**
 * The `three-kind-witness` capability (ADR-0209 D1/D8): a UAT criterion's `witness`
 * classifies as one of THREE distinct kinds — `machine`, `model`, `human` — or remains
 * the legacy pre-migration UNRESOLVED state `either`. Pure, no I/O — a parser + zod
 * validator, mirroring `@storytree/library`'s `uat-test-criteria.ts` id scheme and
 * prose-parsing shape, but with `model` as a genuinely new, distinct kind (never a
 * spelling of `machine`) and without defaulting an untagged legacy criterion into it.
 */

// ---------------------------------------------------------------------------
// Witness kinds
// ---------------------------------------------------------------------------

/**
 * The three CLASSIFIED witness kinds (ADR-0209 D1): who/what may attest a criterion
 * once it has been explicitly classified. `either` is deliberately excluded — it is
 * the legacy UNRESOLVED state, never a classified kind.
 */
export const CLASSIFIED_WITNESSES = ["machine", "model", "human"] as const;
export const ClassifiedWitness = z.enum(CLASSIFIED_WITNESSES);
export type ClassifiedWitness = z.infer<typeof ClassifiedWitness>;

/**
 * The full parseable witness set: the three classified kinds plus the legacy
 * unresolved `either` state (ADR-0209 D8) — the shape a `Criterion.witness` field
 * accepts.
 */
export const CRITERION_WITNESSES = ["machine", "model", "human", "either"] as const;
export const CriterionWitness = z.enum(CRITERION_WITNESSES);
export type CriterionWitness = z.infer<typeof CriterionWitness>;

/** True when `witness` is one of the three classified kinds (never `either`). */
export function isClassifiedWitness(witness: CriterionWitness): witness is ClassifiedWitness {
  return (CLASSIFIED_WITNESSES as readonly string[]).includes(witness);
}

/** True when `witness` is the legacy pre-migration unresolved state. */
export function isLegacyUnresolved(witness: CriterionWitness): witness is "either" {
  return witness === "either";
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * One addressable UAT criterion. `id` is the stable `<story>#uat-<n>` join key;
 * `witness` classifies who/what may attest it. Strict: unknown fields rejected.
 *
 * `witness` defaults to `either` — the conservative legacy default (ADR-0209 D8): an
 * omitted/untagged witness never defaults into `model` (or any classified kind); it
 * stays visibly unresolved until an explicit migration tags it.
 */
export const Criterion = z
  .object({
    /** Stable criterion id, `<story>#uat-<n>`. */
    id: z.string().min(1),
    /** Human-readable title (the prose item's bold lead). */
    title: z.string().min(1),
    /** Who/what may attest this criterion. */
    witness: CriterionWitness.default("either"),
  })
  .strict();

export type Criterion = z.infer<typeof Criterion>;

// ---------------------------------------------------------------------------
// Id scheme
// ---------------------------------------------------------------------------

/** PURE: the stable criterion id for a story's nth UAT criterion (1-based). */
export function criterionId(storyId: string, ordinal: number): string {
  return `${storyId}#uat-${ordinal}`;
}

// ---------------------------------------------------------------------------
// Prose parser
// ---------------------------------------------------------------------------

const STORY_UAT_HEADING = /^##[^\n\S]+(?:UAT Test Criteria|Story UAT)([^\n]*)$/im;
const NEXT_H2 = /^## /m;
const NUMBERED_ITEM = /^\d+\.[^\n\S]+(.*)$/;
const BOLD_LEAD = /^\*\*(.+?)\*\*/;
/**
 * Optional inline witness annotation, e.g. `(witness: model)`. Captures the raw value
 * loosely so an explicit-but-invalid value can be REFUSED (not silently defaulted).
 */
const WITNESS_TAG = /\(witness:\s*([A-Za-z]+)\)/i;

/** Extract the `## UAT Test Criteria` section (between its heading and the next `##`). `null` when absent. */
function criteriaSection(body: string): string | null {
  const heading = STORY_UAT_HEADING.exec(body);
  if (heading === null) return null;
  const after = body.slice(heading.index + heading[0].length);
  const next = NEXT_H2.exec(after);
  return (next === null ? after : after.slice(0, next.index)).trim();
}

/** Split a UAT section into its numbered items, preserving multi-line continuations. */
function splitItems(section: string): string[] {
  const items: string[] = [];
  let current: string[] | null = null;
  for (const line of section.split("\n")) {
    if (NUMBERED_ITEM.test(line)) {
      if (current !== null) items.push(current.join("\n"));
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
  }
  if (current !== null) items.push(current.join("\n"));
  return items;
}

/** Pull the title from a numbered item: the bold lead (colon stripped), else the first line. */
function itemTitle(item: string): string {
  const firstLine = (item.split("\n")[0] ?? "").replace(/^\d+\.[^\n\S]+/, "").trim();
  const bold = BOLD_LEAD.exec(firstLine);
  const raw = bold !== null ? bold[1]! : firstLine;
  return raw.replace(/:$/, "").trim();
}

/**
 * Pull the declared witness from an item. Absent → `either` (conservative legacy
 * default, ADR-0209 D8 — never `model`). An explicit but invalid value (e.g.
 * `(witness: nobody)`) THROWS, refused rather than defaulted.
 */
function itemWitness(item: string, id: string): CriterionWitness {
  const tag = WITNESS_TAG.exec(item);
  if (tag === null) return "either";
  const parsed = CriterionWitness.safeParse(tag[1]!.toLowerCase());
  if (!parsed.success) {
    throw new Error(
      `${id}: invalid witness "${tag[1]}" — must be one of ${CRITERION_WITNESSES.join("|")}`,
    );
  }
  return parsed.data;
}

/**
 * PURE: parse a story's markdown `body` into addressable {@link Criterion} units.
 * Each numbered item under `## UAT Test Criteria` becomes one criterion with a
 * positional, stable id (`<story>#uat-<n>`, 1-based). A story with no such section
 * yields `[]`; an item with no witness annotation defaults to `either`; an explicit
 * but invalid witness value throws at the parsing boundary.
 */
export function parseCriteria(storyId: string, body: string): Criterion[] {
  const section = criteriaSection(body);
  if (section === null) return [];
  const items = splitItems(section);
  return items.map((item, index) => {
    const id = criterionId(storyId, index + 1);
    return Criterion.parse({
      id,
      title: itemTitle(item),
      witness: itemWitness(item, id),
    });
  });
}
