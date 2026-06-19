---
id: "keyless-store-connection"
tier: capability
story: store
title: "One keyless Cloud SQL Postgres connection backs every --pg data access"
outcome: "One Cloud SQL Postgres connection authenticated by ambient keyless IAM (ADR-0021) backs every organism's --pg data access; a session pulls live data through it."
status: mapped
proof_mode: integration-test
depends_on: []
---

# One keyless Cloud SQL Postgres connection backs every `--pg` data access

**Outcome —** One Cloud SQL Postgres connection (`packages/store/src/connection.ts`) authenticated
by ambient keyless IAM ([ADR-0021](../../docs/decisions/0021-keyless-agent-session-auth-and-db-bootstrap.md)) backs
every organism's `--pg` data access; a session pulls live data through it.

## Guidance

- The connection uses the Cloud SQL Node connector with the session's Application Default
  Credentials — the IAM email is the DB user (`STORYTREE_DB_USER`, hydrated from
  `~/.storytree/secrets.json` when unset). No JSON key, no password sits in the process.
- It is a plain `node-pg` pool ([ADR-0019](../../docs/decisions/0019-library-tier-name-and-defer-dbos.md)):
  no DBOS, no durable workflows. Open → transact → close.
- A down/idle-stopped instance surfaces as a connection error the CLI maps to guidance (`pnpm
  db:up`), never a corruption — the offline-degrade posture.

## Contracts (2)

1. **`ambient-iam-auth`** — the pool authenticates from ADC, never a secret
   - **asserts —** the connector is constructed with the IAM email as user and no password/key
     material; the offline config audit (the default-skipped live parity's setup) confirms the
     keyless path.
2. **`pull-or-fail-closed`** — a live pull returns data; a down DB fails closed
   - **asserts —** against a reachable instance a projection read returns the row; against an
     unreachable one the call rejects with a connection error (no partial/forged success).
