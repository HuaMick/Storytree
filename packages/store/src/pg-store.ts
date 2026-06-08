import type { Pool, PoolClient } from "pg";
import type { Store, StoredDoc, StoreEvent } from "@storytree/core";
import { validateLibraryDoc } from "@storytree/core";

/**
 * The Postgres-backed {@link Store} (ADR-0017): history = `events.library_event`, current-state =
 * the `events.library_artifact` projection. `upsertDoc` does BOTH atomically in one transaction
 * (append event + upsert projection). Relationships live as ID refs inside docs, never as FKs.
 *
 * The doc body is validated at the write boundary with {@link validateLibraryDoc} (loud failure)
 * before anything is persisted. Reads come from the projection; history comes from the event log.
 *
 * This class only RUNS behind the live-DB gate; it is constructed from a live `pg` Pool.
 */

const DEFAULT_ACTOR = "system";

/** Row shape of the `events.library_artifact` projection. */
interface ArtifactRow {
  id: string;
  kind: string;
  doc: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

/** Row shape of the `events.library_event` history log. */
interface EventRow {
  seq: string | number;
  id: string;
  kind: string;
  type: "created" | "updated" | "deleted";
  doc: unknown;
  actor: string;
  at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toStoredDoc(row: ArtifactRow): StoredDoc {
  return {
    id: row.id,
    kind: row.kind,
    doc: row.doc,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toStoreEvent(row: EventRow): StoreEvent {
  return {
    seq: typeof row.seq === "string" ? Number(row.seq) : row.seq,
    id: row.id,
    kind: row.kind,
    type: row.type,
    doc: row.doc,
    actor: row.actor,
    at: toIso(row.at),
  };
}

export class PgLibraryStore implements Store {
  readonly #pool: Pool;

  constructor(pool: Pool) {
    this.#pool = pool;
  }

  async upsertDoc(input: {
    id: string;
    kind: string;
    doc: unknown;
    actor?: string;
  }): Promise<StoredDoc> {
    // Loud write boundary: reject malformed docs before opening the transaction.
    validateLibraryDoc(input.doc);
    const actor = input.actor ?? DEFAULT_ACTOR;
    const docJson = JSON.stringify(input.doc);

    const client: PoolClient = await this.#pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM events.library_artifact WHERE id = $1) AS exists",
        [input.id],
      );
      const type = existing.rows[0]?.exists ? "updated" : "created";

      await client.query(
        `INSERT INTO events.library_event (id, kind, type, doc, actor)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [input.id, input.kind, type, docJson, actor],
      );

      const projected = await client.query<ArtifactRow>(
        `INSERT INTO events.library_artifact (id, kind, doc)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE
           SET kind = EXCLUDED.kind,
               doc = EXCLUDED.doc,
               updated_at = now()
         RETURNING id, kind, doc, created_at, updated_at`,
        [input.id, input.kind, docJson],
      );

      await client.query("COMMIT");

      const row = projected.rows[0];
      if (!row) throw new Error("upsertDoc: projection row missing after upsert");
      return toStoredDoc(row);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getDoc(id: string): Promise<StoredDoc | null> {
    const res = await this.#pool.query<ArtifactRow>(
      `SELECT id, kind, doc, created_at, updated_at
       FROM events.library_artifact WHERE id = $1`,
      [id],
    );
    const row = res.rows[0];
    return row ? toStoredDoc(row) : null;
  }

  async queryDocs(filter?: { kind?: string }): Promise<StoredDoc[]> {
    const res =
      filter?.kind === undefined
        ? await this.#pool.query<ArtifactRow>(
            `SELECT id, kind, doc, created_at, updated_at
             FROM events.library_artifact ORDER BY created_at, id`,
          )
        : await this.#pool.query<ArtifactRow>(
            `SELECT id, kind, doc, created_at, updated_at
             FROM events.library_artifact WHERE kind = $1 ORDER BY created_at, id`,
            [filter.kind],
          );
    return res.rows.map(toStoredDoc);
  }

  async deleteDoc(id: string): Promise<boolean> {
    const client: PoolClient = await this.#pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query<ArtifactRow>(
        `SELECT id, kind, doc, created_at, updated_at
         FROM events.library_artifact WHERE id = $1`,
        [id],
      );
      const row = existing.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return false;
      }

      await client.query(
        `INSERT INTO events.library_event (id, kind, type, doc, actor)
         VALUES ($1, $2, 'deleted', $3::jsonb, $4)`,
        [row.id, row.kind, JSON.stringify(row.doc), DEFAULT_ACTOR],
      );
      await client.query("DELETE FROM events.library_artifact WHERE id = $1", [id]);

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async appendEvent(e: {
    id: string;
    kind: string;
    type: "created" | "updated" | "deleted";
    doc: unknown;
    actor?: string;
  }): Promise<StoreEvent> {
    const res = await this.#pool.query<EventRow>(
      `INSERT INTO events.library_event (id, kind, type, doc, actor)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING seq, id, kind, type, doc, actor, at`,
      [e.id, e.kind, e.type, JSON.stringify(e.doc), e.actor ?? DEFAULT_ACTOR],
    );
    const row = res.rows[0];
    if (!row) throw new Error("appendEvent: no row returned");
    return toStoreEvent(row);
  }

  async readEvents(filter?: { id?: string }): Promise<StoreEvent[]> {
    const res =
      filter?.id === undefined
        ? await this.#pool.query<EventRow>(
            `SELECT seq, id, kind, type, doc, actor, at
             FROM events.library_event ORDER BY seq`,
          )
        : await this.#pool.query<EventRow>(
            `SELECT seq, id, kind, type, doc, actor, at
             FROM events.library_event WHERE id = $1 ORDER BY seq`,
            [filter.id],
          );
    return res.rows.map(toStoreEvent);
  }
}
