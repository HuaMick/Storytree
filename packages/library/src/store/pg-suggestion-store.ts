import { z } from "zod";
import type { Pool, PoolClient } from "pg";

/**
 * The Postgres-backed suggestion store (ADR-0140): a suggestion is a proposed edit
 * targeting a specific block, carrying author, topic, proposed replacement, and original
 * text, with an open/accepted/rejected status state machine.
 *
 * History = `events.suggestion_event` (append-only), current state = `events.suggestion`
 * projection. Each write appends a typed event AND upserts the projection atomically.
 * The stored JSONB `doc` is the full {@link Suggestion} verbatim.
 *
 * PURE helpers (applySuggestionTransition, mergeSuggestionPatch, SuggestionSchema) are
 * offline-tested; the live SQL (list/create/transition) only runs behind STORYTREE_DB_LIVE.
 */

// ---------------------------------------------------------------------------
// Schema — the write boundary
// ---------------------------------------------------------------------------

/**
 * Zod schema for a suggestion record. Validates at the write boundary: refuses blank
 * author, blank proposed, blank block handle, and unknown status values.
 */
export const SuggestionSchema = z.object({
  id: z.string().min(1),
  topicKind: z.enum(["doc", "asset"]),
  topicId: z.string().min(1),
  block: z.string().min(1),
  proposed: z.string().min(1),
  original: z.string(),
  status: z.enum(["open", "accepted", "rejected"]),
  author: z.string().min(1),
  createdAt: z.string(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
});

/** A suggestion record — the full JSONB doc stored verbatim. */
export type Suggestion = z.infer<typeof SuggestionSchema>;

/** A partial update to a stored suggestion. `id` is fixed and never patched. */
export type SuggestionPatch = Partial<Omit<Suggestion, "id">>;

// ---------------------------------------------------------------------------
// applySuggestionTransition — the pure status state machine
// ---------------------------------------------------------------------------

/**
 * PURE: apply an accept or reject action to an open suggestion.
 *
 * - From `open` + `"accept"` → returns a new suggestion with `status: "accepted"`,
 *   `decidedBy`, and `decidedAt` stamped.
 * - From `open` + `"reject"` → returns a new suggestion with `status: "rejected"`,
 *   `decidedBy`, and `decidedAt` stamped.
 * - From a closed status (`"accepted"` or `"rejected"`) → throws: a closed suggestion
 *   cannot be re-decided.
 *
 * Does NOT mutate the input suggestion.
 */
export function applySuggestionTransition(
  current: Suggestion,
  action: "accept" | "reject",
  decidedBy: string,
  decidedAt: string,
): Suggestion {
  if (current.status !== "open") {
    throw new Error(
      `Cannot decide a closed suggestion (already ${current.status}); re-deciding is not allowed`,
    );
  }
  return {
    ...current,
    status: action === "accept" ? "accepted" : "rejected",
    decidedBy,
    decidedAt,
  };
}

// ---------------------------------------------------------------------------
// mergeSuggestionPatch — the pure patch-merge helper
// ---------------------------------------------------------------------------

/**
 * PURE: merge a patch into an existing suggestion doc. `id` is never overwritten.
 * Undefined patch fields are ignored (a real `null` — e.g. `decidedBy: null` — IS applied).
 * Does NOT mutate the input suggestion.
 */
export function mergeSuggestionPatch(existing: Suggestion, patch: SuggestionPatch): Suggestion {
  const merged = { ...existing } as Suggestion & Record<string, unknown>;
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (key === "id") continue;
    merged[key] = value;
  }
  merged["id"] = existing.id;
  return merged as Suggestion;
}

// ---------------------------------------------------------------------------
// PgSuggestionStore — the event-sourced persistence surface
// ---------------------------------------------------------------------------

/** Row shape of the `events.suggestion` projection. */
interface SuggestionRow {
  id: string;
  doc: unknown;
}

/** Filter for {@link PgSuggestionStore.list}: by topic id and/or topic kind. */
export interface SuggestionFilter {
  topicId?: string;
  topicKind?: "doc" | "asset";
  status?: "open" | "accepted" | "rejected";
}

const DEFAULT_ACTOR = "system";

export class PgSuggestionStore {
  readonly #pool: Pool;

  constructor(pool: Pool) {
    this.#pool = pool;
  }

  /**
   * Read the suggestion projection, optionally filtered by topic and/or status.
   * Filtering is done in JS on the stored doc, ordered by createdAt then id.
   */
  async list(filter?: SuggestionFilter): Promise<Suggestion[]> {
    const res = await this.#pool.query<SuggestionRow>(
      "SELECT id, doc FROM events.suggestion ORDER BY created_at, id",
    );
    let suggestions = res.rows.map((row) => row.doc as Suggestion);
    if (filter?.topicId !== undefined) {
      suggestions = suggestions.filter((s) => s.topicId === filter.topicId);
    }
    if (filter?.topicKind !== undefined) {
      suggestions = suggestions.filter((s) => s.topicKind === filter.topicKind);
    }
    if (filter?.status !== undefined) {
      suggestions = suggestions.filter((s) => s.status === filter.status);
    }
    return suggestions;
  }

  /**
   * Append a `created` event + upsert the projection, atomically.
   * Validates the suggestion doc at the write boundary. Returns the stored suggestion.
   */
  async create(suggestion: Suggestion, actor: string = DEFAULT_ACTOR): Promise<Suggestion> {
    const validated = SuggestionSchema.parse(suggestion);
    const docJson = JSON.stringify(validated);
    const client: PoolClient = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO events.suggestion_event (id, type, doc, actor) VALUES ($1, 'created', $2::jsonb, $3)",
        [validated.id, docJson, actor],
      );
      await client.query(
        `INSERT INTO events.suggestion (id, doc) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
        [validated.id, docJson],
      );
      await client.query("COMMIT");
      return validated;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Apply an accept or reject action to an open suggestion (via {@link applySuggestionTransition}),
   * append a `transitioned` event, upsert the projection — all in one transaction.
   * Returns the updated suggestion, or `null` if the id does not exist.
   * Throws if the suggestion is already closed.
   */
  async transition(
    id: string,
    action: "accept" | "reject",
    decidedBy: string,
    decidedAt: string,
    actor: string = DEFAULT_ACTOR,
  ): Promise<Suggestion | null> {
    const client: PoolClient = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<SuggestionRow>(
        "SELECT id, doc FROM events.suggestion WHERE id = $1",
        [id],
      );
      const row = existing.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }
      const current = row.doc as Suggestion;
      const updated = applySuggestionTransition(current, action, decidedBy, decidedAt);
      const docJson = JSON.stringify(updated);
      await client.query(
        "INSERT INTO events.suggestion_event (id, type, doc, actor) VALUES ($1, 'transitioned', $2::jsonb, $3)",
        [id, docJson, actor],
      );
      await client.query(
        `INSERT INTO events.suggestion (id, doc) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
        [id, docJson],
      );
      await client.query("COMMIT");
      return updated;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
