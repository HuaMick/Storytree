// Apply infra/ci-presence-grants.sql as the schema owner (keyless, ADR-0021).
// Idempotent — safe to re-run after a user recreate or schema change.
//
//   STORYTREE_DB_USER=hua.mick@gmail.com npx tsx infra/apply-ci-presence-grants.ts
//
// (On Windows PowerShell: $env:STORYTREE_DB_USER='hua.mick@gmail.com'; npx tsx ...)

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Relative, not '@storytree/store': infra/ is not a workspace package, so the
// package name doesn't resolve from here; the store's own node_modules does.
import { createPool, closePool } from "../packages/store/src/connection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(here, "ci-presence-grants.sql"), "utf8");

const { pool, connector } = await createPool();
try {
  await pool.query(sql);
  console.log("ci-presence grants applied (events.session{,_event} → storytree-ci-presence@…iam).");
} finally {
  await closePool(pool, connector);
}
