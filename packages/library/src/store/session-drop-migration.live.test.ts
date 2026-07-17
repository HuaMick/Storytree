import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";

/**
 * Live-gated proof of the ADR-0200 D7 session-presence retirement: an EXISTING database that
 * still carries the ADR-0033 presence tables (`events.session_event` history +
 * `events.session` projection) has them DROPPED by applySchema — the guarded-drop precedent
 * in schema.sql — a second applySchema no-ops, and the claim-ledger tables (the LIVE session
 * machinery) come through untouched, rows intact.
 *
 * Gated exactly like the sibling live suites: STORYTREE_DB_LIVE=1, and the connection goes
 * through createTestPool, which fails closed unless STORYTREE_DB_NAME names a disposable
 * database (ADR-0054 — this test DROPs/creates tables, so production is never touchable; the
 * post-merge apply against the live main database is the coordinator's step). Run per-file:
 *
 *   STORYTREE_DB_LIVE=1 STORYTREE_DB_NAME=storytree_test STORYTREE_DB_USER=<iam-email> \
 *     pnpm --filter @storytree/library exec node --import tsx --test --test-force-exit \
 *     src/store/session-drop-migration.live.test.ts
 */

const LIVE = process.env["STORYTREE_DB_LIVE"] === "1";

/** Recreate the retired ADR-0033 presence tables exactly as the old schema.sql declared them. */
async function createOldPresenceTables(pool: Pool): Promise<void> {
  await pool.query("CREATE SCHEMA IF NOT EXISTS events");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events.session_event (
      seq   BIGSERIAL PRIMARY KEY,
      id    TEXT NOT NULL,
      type  TEXT NOT NULL,
      doc   JSONB,
      actor TEXT NOT NULL,
      at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events.session (
      id         TEXT PRIMARY KEY,
      doc        JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

/** Whether `events.<name>` exists, straight from the catalog. */
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const res = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'events' AND c.relname = $1 AND c.relkind = 'r'`,
    [name],
  );
  return (res.rows[0]?.n ?? 0) > 0;
}

if (!LIVE) {
  test(
    "session-presence drop migration (skipped: set STORYTREE_DB_LIVE=1 + STORYTREE_DB_NAME=storytree_test to run)",
    { skip: true },
    () => {
      // The live DB is stopped by default; the offline companion (session-drop-schema.test.ts)
      // pins the DDL shape in CI. This placeholder keeps the gate visible in default output.
    },
  );
} else {
  test("ADR-0200 D7: applySchema drops the presence tables, no-ops on re-run, claim tables untouched", async () => {
    const { createTestPool } = await import("./test-db.js");
    const { applySchema } = await import("./migrate.js");
    const { closePool } = await import("./connection.js");
    const { pool, connector } = await createTestPool();
    try {
      // Yesterday's database: the presence tables still exist, with rows in them.
      await createOldPresenceTables(pool);
      await pool.query(
        "INSERT INTO events.session_event (id, type, doc, actor) VALUES ($1, $2, $3, $4)",
        ["session-old", "declared", "{}", "test"],
      );
      await pool.query("INSERT INTO events.session (id, doc) VALUES ($1, $2)", [
        "session-old",
        "{}",
      ]);
      assert.equal(await tableExists(pool, "session"), true);
      assert.equal(await tableExists(pool, "session_event"), true);

      // A pre-existing claim row — the LIVE machinery the drop must not disturb.
      await pool.query("DROP TABLE IF EXISTS events.node_claim");
      await pool.query("DELETE FROM events.claim_event WHERE unit_id = 'drop-test-unit'").catch(
        () => {
          /* claim_event may not exist yet on a bare test DB — applySchema creates it below */
        },
      );
      await applySchema(pool); // brings up the current shape (incl. node_claim) AND drops presence
      await pool.query(
        "INSERT INTO events.node_claim (unit_id, session_id, grade, branch) VALUES ($1, $2, $3, $4)",
        ["drop-test-unit", "session-1", "work", "claude/test"],
      );
      await pool.query(
        "INSERT INTO events.claim_event (unit_id, type, session_id, doc) VALUES ($1, $2, $3, $4)",
        ["drop-test-unit", "claimed", "session-1", "{}"],
      );

      // The migration already ran once above — the presence tables are GONE.
      assert.equal(await tableExists(pool, "session"), false);
      assert.equal(await tableExists(pool, "session_event"), false);

      // Idempotent: applySchema runs on every boot — a second pass is a clean no-op.
      await applySchema(pool);
      assert.equal(await tableExists(pool, "session"), false);
      assert.equal(await tableExists(pool, "session_event"), false);

      // The claim ledger came through untouched: tables exist, rows intact.
      assert.equal(await tableExists(pool, "node_claim"), true);
      assert.equal(await tableExists(pool, "claim_event"), true);
      assert.equal(await tableExists(pool, "claim_cursor"), true);
      const claim = await pool.query<{ grade: string; branch: string }>(
        "SELECT grade, branch FROM events.node_claim WHERE unit_id = 'drop-test-unit'",
      );
      assert.equal(claim.rows[0]?.grade, "work");
      assert.equal(claim.rows[0]?.branch, "claude/test");
      const audit = await pool.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM events.claim_event WHERE unit_id = 'drop-test-unit'",
      );
      assert.equal(audit.rows[0]?.n, 1);
    } finally {
      await closePool(pool, connector);
    }
  });

  test("ADR-0200 D7: a FRESH install never creates the presence tables", async () => {
    const { createTestPool } = await import("./test-db.js");
    const { applySchema } = await import("./migrate.js");
    const { closePool } = await import("./connection.js");
    const { pool, connector } = await createTestPool();
    try {
      // Fresh path: no presence tables beforehand — the guarded DROP IF EXISTS no-ops.
      await pool.query("DROP TABLE IF EXISTS events.session_event");
      await pool.query("DROP TABLE IF EXISTS events.session");
      await applySchema(pool);
      assert.equal(await tableExists(pool, "session"), false);
      assert.equal(await tableExists(pool, "session_event"), false);
      // ...while the current shape (the claim ledger) is up.
      assert.equal(await tableExists(pool, "node_claim"), true);
      assert.equal(await tableExists(pool, "claim_event"), true);
    } finally {
      await closePool(pool, connector);
    }
  });
}
