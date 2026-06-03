// Domain tables + helpers for the spike. These live in the same Postgres that
// DBOS uses for its system tables, but are entirely OUR data (the orchestrator's
// "node_effects"), separate from DBOS bookkeeping. We talk to them with a plain
// `pg` pool, exactly as the real orchestrator's effect-writes would.
//
// Two tables carry the proof:
//   * node_effects  -- keyed by (workflow_id, node_id). The idempotent, exactly-once
//                      side-effect. PRIMARY KEY is the dedup guard. A duplicate
//                      execution can attempt the insert but cannot create a 2nd row.
//   * node_attempts -- append-only. ONE row per *physical execution* of a node step.
//                      Because DBOS steps are at-least-once, a node killed mid-step
//                      re-executes on resume and appends a SECOND attempt row here.
//                      This is how we DETECT that re-execution happened, and prove the
//                      keyed effect still landed exactly once. started_at/finished_at
//                      give us the concurrency intervals.

import pg from "pg";
import { DATABASE_URL } from "./config.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL, max: 8 });
  return pool;
}
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function ensureSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS node_effects (
      workflow_id    TEXT        NOT NULL,
      node_id        TEXT        NOT NULL,
      payload        TEXT        NOT NULL,
      created_by_pid INTEGER     NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (workflow_id, node_id)
    );

    CREATE TABLE IF NOT EXISTS node_attempts (
      attempt_id      BIGSERIAL   PRIMARY KEY,
      workflow_id     TEXT        NOT NULL,
      node_id         TEXT        NOT NULL,
      pid             INTEGER     NOT NULL,
      effect_inserted BOOLEAN,
      started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at     TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS fanin_results (
      workflow_id    TEXT        PRIMARY KEY,
      summary        TEXT        NOT NULL,
      created_by_pid INTEGER     NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function resetDomain(): Promise<void> {
  await getPool().query("TRUNCATE node_effects, node_attempts, fanin_results");
}

// --- helpers invoked INSIDE the node step (the side-effecting action) ---

export async function recordAttemptStart(
  workflowId: string,
  nodeId: string,
  pid: number,
): Promise<{ attemptId: string }> {
  const r = await getPool().query(
    `INSERT INTO node_attempts (workflow_id, node_id, pid)
     VALUES ($1, $2, $3) RETURNING attempt_id`,
    [workflowId, nodeId, pid],
  );
  return { attemptId: String(r.rows[0].attempt_id) };
}

// The idempotent, exactly-once side-effect. Returns true iff THIS call actually
// wrote the row (false => the (workflow_id, node_id) row already existed and the
// PRIMARY KEY / ON CONFLICT dropped the duplicate).
export async function insertEffectIdempotent(
  workflowId: string,
  nodeId: string,
  payload: string,
  pid: number,
): Promise<boolean> {
  const r = await getPool().query(
    `INSERT INTO node_effects (workflow_id, node_id, payload, created_by_pid)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workflow_id, node_id) DO NOTHING
     RETURNING workflow_id`,
    [workflowId, nodeId, payload, pid],
  );
  return (r.rowCount ?? 0) === 1;
}

export async function markAttemptEffect(attemptId: string, inserted: boolean): Promise<void> {
  await getPool().query(`UPDATE node_attempts SET effect_inserted = $2 WHERE attempt_id = $1`, [
    attemptId,
    inserted,
  ]);
}

export async function markAttemptFinished(attemptId: string): Promise<void> {
  await getPool().query(`UPDATE node_attempts SET finished_at = now() WHERE attempt_id = $1`, [
    attemptId,
  ]);
}

// The fan-in aggregation effect (idempotent, keyed by the run/workflow id).
export async function insertFanin(
  workflowId: string,
  summary: string,
  pid: number,
): Promise<boolean> {
  const r = await getPool().query(
    `INSERT INTO fanin_results (workflow_id, summary, created_by_pid)
     VALUES ($1, $2, $3)
     ON CONFLICT (workflow_id) DO NOTHING
     RETURNING workflow_id`,
    [workflowId, summary, pid],
  );
  return (r.rowCount ?? 0) === 1;
}

// --- read helpers for the live "is everyone in-flight yet?" poll + the report ---

// Count node attempts that have started their step but not yet finished (i.e.
// currently sleeping). The harness polls this to know when to hard-kill.
export async function countInflight(workflowId: string): Promise<number> {
  const r = await getPool().query(
    `SELECT count(*)::int AS n FROM node_attempts
     WHERE workflow_id = $1 AND finished_at IS NULL`,
    [workflowId],
  );
  return r.rows[0].n;
}

export interface ReportData {
  effects: Array<{ node_id: string; created_by_pid: number; created_at: string }>;
  attempts: Array<{
    node_id: string;
    pid: number;
    effect_inserted: boolean | null;
    started_at: string;
    finished_at: string | null;
  }>;
  fanin: { summary: string; created_by_pid: number } | null;
  effectInsertTrueCount: number;
  unfinishedCount: number;
  distinctPids: number[];
  // overlap among FINISHED attempts (post-recovery completions)
  finished: number;
  allOverlap: boolean | null;
  startSpreadSec: number | null;
}

export async function report(workflowId: string): Promise<ReportData> {
  const p = getPool();
  const effects = (
    await p.query(
      `SELECT node_id, created_by_pid, created_at FROM node_effects
       WHERE workflow_id = $1 ORDER BY node_id`,
      [workflowId],
    )
  ).rows;
  const attempts = (
    await p.query(
      `SELECT node_id, pid, effect_inserted, started_at, finished_at FROM node_attempts
       WHERE workflow_id = $1 ORDER BY started_at, node_id`,
      [workflowId],
    )
  ).rows;
  const faninRow = (
    await p.query(`SELECT summary, created_by_pid FROM fanin_results WHERE workflow_id = $1`, [
      workflowId,
    ])
  ).rows[0];
  const agg = (
    await p.query(
      `SELECT
         count(*) FILTER (WHERE effect_inserted IS TRUE)::int            AS effect_true,
         count(*) FILTER (WHERE finished_at IS NULL)::int                AS unfinished,
         coalesce(array_agg(DISTINCT pid ORDER BY pid), '{}')           AS pids
       FROM node_attempts WHERE workflow_id = $1`,
      [workflowId],
    )
  ).rows[0];
  const overlap = (
    await p.query(
      `SELECT
         count(*)::int                                                   AS finished,
         (max(started_at) < min(finished_at))                           AS all_overlap,
         EXTRACT(EPOCH FROM (max(started_at) - min(started_at)))::float  AS start_spread_sec
       FROM node_attempts
       WHERE workflow_id = $1 AND finished_at IS NOT NULL`,
      [workflowId],
    )
  ).rows[0];

  return {
    effects,
    attempts,
    fanin: faninRow ?? null,
    effectInsertTrueCount: agg.effect_true,
    unfinishedCount: agg.unfinished,
    distinctPids: agg.pids,
    finished: overlap.finished,
    allOverlap: overlap.all_overlap,
    startSpreadSec: overlap.start_spread_sec,
  };
}
