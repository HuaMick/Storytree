-- DB privileges for the CI presence merge-retire service account (ADR-0033/0041, keyless WIF).
-- The Cloud SQL IAM SA user (created by infra/ci-presence.tf's google_sql_user) is a bare role;
-- the CI writer (packages/store/src/ingest-merge.ts → PgPresenceStore.done) needs ONLY to retire
-- a session's presence row: SELECT + upsert the `events.session` projection and append one
-- `events.session_event` history row. Nothing else — this is the tightest grant in the repo.
--
-- Idempotent. Run as the schema owner (hua.mick@gmail.com, keyless) AFTER `terraform apply`:
--   STORYTREE_DB_USER=hua.mick@gmail.com npx tsx infra/apply-ci-presence-grants.ts

GRANT USAGE ON SCHEMA events TO "storytree-ci-presence@storytree-498613.iam";

-- The presence projection: read it, upsert it (INSERT ... ON CONFLICT DO UPDATE in done()).
GRANT SELECT, INSERT, UPDATE ON events.session
  TO "storytree-ci-presence@storytree-498613.iam";

-- The presence history: append-only — INSERT one `done` event per retire.
GRANT INSERT ON events.session_event
  TO "storytree-ci-presence@storytree-498613.iam";

-- USAGE on sequences so the session_event BIGSERIAL `seq` can advance on INSERT. Sequence-only
-- (no table INSERT elsewhere), so this cannot widen write access beyond the two tables above.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA events
  TO "storytree-ci-presence@storytree-498613.iam";
