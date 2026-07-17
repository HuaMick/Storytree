import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { SCHEMA_SQL_PATH } from "./migrate.js";

/**
 * Offline pin on the session-presence retirement DDL (ADR-0200 D7): the DB-free CI companion to
 * session-drop-migration.live.test.ts. It reads schema.sql as TEXT and asserts the presence
 * tables are DROPPED, not created — the live test proves the drop actually lands (and no-ops on
 * re-run) on a real Postgres.
 */

test("schema.sql: no events.session / events.session_event CREATE DDL remains (ADR-0200 D7)", async () => {
  const sql = await readFile(SCHEMA_SQL_PATH, "utf8");
  // The retired presence projection. `session\s` (not `session_event`) via a lookahead-free
  // boundary: match the exact table name followed by whitespace or '('.
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS events\.session[\s(]/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS events\.session_event/);
  // And no half-retirement: nothing ALTERs the retired tables either.
  assert.doesNotMatch(sql, /ALTER TABLE events\.session/);
});

test("schema.sql: carries the guarded idempotent DROP for both presence tables", async () => {
  const sql = await readFile(SCHEMA_SQL_PATH, "utf8");
  // IF EXISTS is the guard — first applySchema drops, every later one (and a fresh install,
  // which never created the tables) no-ops.
  assert.match(sql, /DROP TABLE IF EXISTS events\.session_event;/);
  assert.match(sql, /DROP TABLE IF EXISTS events\.session;/);
  // History drops BEFORE the projection (symmetry with the old creation order).
  const eventIdx = sql.indexOf("DROP TABLE IF EXISTS events.session_event;");
  const projIdx = sql.indexOf("DROP TABLE IF EXISTS events.session;");
  assert.ok(eventIdx >= 0 && projIdx >= 0 && eventIdx < projIdx);
});

test("schema.sql: the claim-ledger tables are untouched by the retirement", async () => {
  const sql = await readFile(SCHEMA_SQL_PATH, "utf8");
  // The LIVE session machinery stays: created, never dropped.
  assert.match(sql, /CREATE TABLE IF NOT EXISTS events\.node_claim/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS events\.claim_event/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS events\.claim_cursor/);
  assert.doesNotMatch(sql, /DROP TABLE IF EXISTS events\.node_claim/);
  assert.doesNotMatch(sql, /DROP TABLE IF EXISTS events\.claim_event/);
  assert.doesNotMatch(sql, /DROP TABLE IF EXISTS events\.claim_cursor/);
  // The ONLY drops in the whole file are the two retired presence tables.
  const drops = sql.match(/DROP TABLE/g) ?? [];
  assert.equal(drops.length, 2);
});
