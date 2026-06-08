-- One-time DB-privilege bootstrap for the storytree runtime store (ADR-0015 / ADR-0021).
--
-- Cloud SQL IAM users (created by Terraform's google_sql_user, type CLOUD_IAM_USER) connect
-- keylessly via IAM tokens but are bare roles with NO database-level CREATE. The keyless
-- runtime needs to create the `events` schema + its tables, so the operator IAM principal
-- must be granted CREATE on the database ONCE. This cannot be done by the IAM user itself
-- (bootstrap problem) — it must be run as a privileged role (the `postgres` builtin user,
-- whose password the Owner can set via `gcloud sql users set-password postgres`).
--
-- Idempotent: safe to re-run. After this, every keyless migration/connection works with no
-- per-session OAuth and no password.
--
-- Apply (one-time, as postgres):
--   gcloud sql users set-password postgres --instance=storytree-pg --project=storytree-498613 --password=<throwaway>
--   then connect as postgres (via the Cloud SQL connector, authType PASSWORD) and run this file.

GRANT CREATE ON DATABASE storytree TO "hua.mick@gmail.com";
