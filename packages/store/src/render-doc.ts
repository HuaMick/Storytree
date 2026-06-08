import type { StoredDoc } from "@storytree/core";
import { renderBody, type Knowledge } from "@storytree/core";

/**
 * Render a {@link StoredDoc} from the runtime store into the GuidanceAsset wire shape the studio
 * client consumes (apps/studio/src/types.ts `GuidanceAsset`). This is the pg READ adapter for
 * `/api/assets`: it makes a stored Library doc look exactly like the JSON-backed dev API's assets,
 * so the React client is unchanged regardless of the backend.
 *
 * Two doc shapes flow through the store (see {@link https://|validateLibraryDoc}):
 *  - A doc that already carries a string `body` — a generated `template-*` artifact or a
 *    previously-edited (rendered) asset — is passed THROUGH verbatim. Its `category` is the doc's own
 *    `category` (falling back to the stored `kind` if absent).
 *  - Otherwise the doc is a structured {@link Knowledge} unit (definition / principle / …): its body
 *    is DERIVED via {@link renderBody}, and its `category` is the stored `kind` (the unit's kind).
 *
 * `createdAt` / `updatedAt` always come from the {@link StoredDoc} envelope (the store's clock),
 * not from inside the doc. Pure + offline.
 */

/** The GuidanceAsset-shaped object the studio `/api/assets` endpoint returns. */
export interface RenderedAsset {
  id: string;
  category: string;
  title: string;
  description: string;
  body: string;
  references: string[];
  createdAt: string;
  updatedAt: string;
}

/** A rendered (body-bearing) asset doc — template or previously-edited unit. */
interface AssetDocLike {
  id?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  body?: unknown;
  references?: unknown;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** True when the stored doc already carries a rendered string `body` (template / edited asset). */
function hasStringBody(doc: unknown): doc is AssetDocLike & { body: string } {
  return (
    typeof doc === "object" &&
    doc !== null &&
    typeof (doc as { body?: unknown }).body === "string"
  );
}

export function renderStoredDoc(stored: StoredDoc): RenderedAsset {
  const doc = stored.doc;

  if (hasStringBody(doc)) {
    // Pass-through: the body is authoritative; category is the doc's own, else the stored kind.
    const category = typeof doc.category === "string" ? doc.category : stored.kind;
    return {
      id: asString(doc.id) || stored.id,
      category,
      title: asString(doc.title),
      description: asString(doc.description),
      body: doc.body,
      references: asStringArray(doc.references),
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
  }

  // Structured Knowledge unit: derive the body from its per-kind fields; category = the kind.
  const knowledge = doc as Knowledge;
  return {
    id: knowledge.id ?? stored.id,
    category: stored.kind,
    title: asString(knowledge.title),
    description: asString(knowledge.description),
    body: renderBody(knowledge),
    references: asStringArray(knowledge.references),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}
