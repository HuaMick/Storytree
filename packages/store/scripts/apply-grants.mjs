// One-off privilege bootstrap (ADR-0021): apply infra/bootstrap-grants.sql as the privileged
// `postgres` builtin user, so the keyless IAM principal gains CREATE on the database.
//
// Lives in packages/store so pnpm resolves `pg` + the Cloud SQL connector. Connects with PASSWORD
// auth; the postgres password comes from $PG_BOOTSTRAP_PW (set + discarded in the same shell — never
// persisted). Run:  node packages/store/scripts/apply-grants.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Connector, AuthTypes } from '@google-cloud/cloud-sql-connector';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(here, '..', '..', '..', 'infra', 'bootstrap-grants.sql');
const sql = readFileSync(sqlPath, 'utf8');
const instanceConnectionName =
  process.env.STORYTREE_INSTANCE_CONNECTION_NAME ?? 'storytree-498613:australia-southeast1:storytree-pg';
const password = process.env.PG_BOOTSTRAP_PW;
if (!password) throw new Error('PG_BOOTSTRAP_PW not set');

const connector = new Connector();
const opts = await connector.getOptions({ instanceConnectionName, authType: AuthTypes.PASSWORD });
const pool = new pg.Pool({ ...opts, user: 'postgres', password, database: 'storytree' });
try {
  await pool.query(sql);
  console.log('bootstrap grants applied OK:', sqlPath);
} finally {
  await pool.end();
  connector.close();
}
