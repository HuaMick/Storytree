# CI presence merge-retire — keyless WIF setup (ADR-0033 / ADR-0041)

When a session's PR merges, CI should AUTHORITATIVELY retire that session's `events.session`
presence row — the "session over" fact the racy `SessionEnd` hook misses when a fresh worktree
is deleted before the hook fires `done`. Without this, dead sessions accumulate in the studio
dock forever (parked, never retired). **The merge to main is the authoritative signal.**

This is wired in three pieces:

- **`packages/store/src/ingest-merge.ts`** — the fail-soft writer. Derives the `sessionId` from
  the merged PR's head ref (tail after the last `/`) and calls `PgPresenceStore.done()`. NEVER
  exits non-zero: the merge already landed, presence is advisory (ADR-0033).
- **`.github/workflows/ci.yml`** (`automerge` job) — after `gh pr merge`, authenticates to GCP
  via Workload Identity Federation (keyless — no JSON key, ADR-0021) and runs the writer. Every
  step is `continue-on-error: true` and gated on a `claude/*` head ref.
- **`infra/ci-presence.tf` + `infra/ci-presence-grants.sql`** — the WIF pool/provider, the
  dedicated CI service account, its Cloud SQL IAM user, and the tight DB grants (the two presence
  tables only).

## ⚠️ ONE-TIME OWNER STEP (BLOCKING — the PR is held draft until this is done)

Creating a Workload Identity Pool + project IAM bindings needs Owner-level ADC that an agent
session does not have, so this is owner-run, once. Run as the owner
(`gcloud auth login`, `gcloud auth application-default login`, project `storytree-498613`):

```bash
cd infra
terraform init      # picks up ci-presence.tf
terraform apply     # creates the pool, provider, SA, IAM bindings, and the Cloud SQL IAM user
```

Then apply the DB grants once (keyless, as the schema owner):

```bash
# bash
STORYTREE_DB_USER=hua.mick@gmail.com npx tsx infra/apply-ci-presence-grants.ts
# PowerShell
$env:STORYTREE_DB_USER='hua.mick@gmail.com'; npx tsx infra/apply-ci-presence-grants.ts
```

### Verify the apply matches ci.yml

The three constants hardcoded in `ci.yml` MUST equal the Terraform outputs (they were authored to
match; this is the paste-check):

```bash
terraform output ci_presence_provider_name    # == workload_identity_provider in ci.yml
terraform output ci_presence_service_account  # == service_account in ci.yml
terraform output ci_presence_db_user          # == STORYTREE_DB_USER in ci.yml
```

Expected values:

| ci.yml field                  | value                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `workload_identity_provider`  | `projects/635716509357/locations/global/workloadIdentityPools/github-actions/providers/github`     |
| `service_account`             | `storytree-ci-presence@storytree-498613.iam.gserviceaccount.com`                                    |
| `STORYTREE_DB_USER`           | `storytree-ci-presence@storytree-498613.iam`                                                        |

After the apply succeeds and the outputs match, **undraft this PR** (or remove the `hold` label).

## Why it is safe to merge even before the apply

The CI auth + writer steps are `continue-on-error: true`. Until the WIF resources exist, the GCP
auth step simply fails soft and the writer is skipped — **the merge still lands**; presence just
isn't retried that run. So a half-wired state degrades gracefully and never blocks merges. The PR
is held draft only so the owner reviews the IAM surface and runs the apply deliberately.

## Manual verification (proven 2026-06-13, against the live DB)

The writer was verified end-to-end as the owner (keyless), retiring a real zombie:

```bash
STORYTREE_DB_USER=hua.mick@gmail.com \
  npx tsx packages/store/src/ingest-merge.ts <sessionId-or-claude/head-ref> <iso-timestamp>
# → "[ingest-merge] retired presence for "<id>" (merged at …)."  then the session drops from:
STORYTREE_DB_USER=hua.mick@gmail.com pnpm storytree noticeboard --pg
```

A non-existent session logs `no presence row … nothing to retire (no-op)` and still exits 0.

## Scope

This retires presence ONLY. It deliberately does NOT append a per-unit `events.work_event`
'merged' row: merge-changed files don't map to story ids, and a synthetic row would break the
`.strict()` `WorkEventDoc` enum + pinned tests. The world's landed-work signal is verdict blooms
(a separate path), not merges.
