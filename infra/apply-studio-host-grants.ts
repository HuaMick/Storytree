// Apply infra/studio-host-grants.sql as the schema owner (keyless, ADR-0021).
// Idempotent — safe to re-run after schema changes or a user recreate.
//
//   STORYTREE_DB_USER=hua.mick@gmail.com npx tsx infra/apply-studio-host-grants.ts
//
// (On Windows PowerShell: $env:STORYTREE_DB_USER='hua.mick@gmail.com'; npx tsx ...)

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Relative, not '@storytree/library/store': infra/ is not a workspace package, so the
// package name doesn't resolve from here; the library's own node_modules does. (ADR-0077: the
// Postgres connection substrate moved into the library organism's node-only ./store subpath.)
import { createPool, closePool } from "../packages/library/src/store/connection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(here, "studio-host-grants.sql"), "utf8");

const { pool, connector } = await createPool();
try {
  await pool.query(sql);
  console.log("studio-host grants applied (events schema → storytree-studio-host@…iam).");
} finally {
  await closePool(pool, connector);
}
