-- DB privileges for the CI merge-time claim-release service account (ADR-0138 §4 / ADR-0200,
-- keyless WIF). The Cloud SQL IAM SA user (created by infra/ci-presence.tf's google_sql_user) is
-- a bare role; the CI writer (packages/notice-board/src/store/ingest-merge.ts →
-- PgClaimStore.releaseClaimsByBranch) needs ONLY to release a merged branch's claims: DELETE the
-- branch's `events.node_claim` rows (RETURNING needs SELECT; the in-transaction oldest-waiter
-- promotion needs UPDATE) and append one `events.claim_event` history row per cleared claim.
-- Nothing else — this is the tightest grant in the repo.
--
-- (The events.session/session_event grants that used to lead this file were REMOVED with the
-- presence retirement, ADR-0200 D7 — the tables are dropped by schema.sql. The SA's stale
-- `ci-presence` NAME is a flagged follow-up, not this sweep.)
--
-- Idempotent. Run as the schema owner (hua.mick@gmail.com, keyless) AFTER `terraform apply`:
--   STORYTREE_DB_USER=hua.mick@gmail.com npx tsx infra/apply-ci-presence-grants.ts

GRANT USAGE ON SCHEMA events TO "storytree-ci-presence@storytree-498613.iam";

-- The story-claim clear (ADR-0138 cap D / ADR-0142): the merge job's ingest-merge calls
-- releaseClaimsByBranch — DELETE ... RETURNING on the claim projection (RETURNING needs SELECT)
-- plus one append-only `released` history row per cleared claim. Added 2026-07-02: the clear had
-- been failing soft ("permission denied for table node_claim") on every merge since cap D landed.
-- UPDATE added 2026-07-16: the ADR-0200 graded ledger promotes the freed unit's oldest live
-- waiter inside the release transaction (`SELECT ... FOR UPDATE` + `UPDATE grade='work'` in
-- PgClaimStore.#promoteOldestWaiter) — FOR UPDATE alone requires UPDATE privilege, so without it
-- the whole release ROLLED BACK fail-soft on every merge since inc 1 (#741) landed.
GRANT SELECT, UPDATE, DELETE ON events.node_claim
  TO "storytree-ci-presence@storytree-498613.iam";
GRANT INSERT ON events.claim_event
  TO "storytree-ci-presence@storytree-498613.iam";

-- USAGE on sequences so the claim_event BIGSERIAL `seq` can advance on INSERT. Sequence-only
-- (no table INSERT elsewhere), so this cannot widen write access beyond the tables above.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA events
  TO "storytree-ci-presence@storytree-498613.iam";
