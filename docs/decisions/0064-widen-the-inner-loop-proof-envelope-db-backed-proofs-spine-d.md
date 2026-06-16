---
status: accepted
decided: 2026-06-16
amends: [31]
---
# ADR-0064: Widen the inner-loop proof envelope: DB-backed proofs, spine-driven dependency adds, and the visual-proof boundary

## Status

accepted (2026-06-16) — owner steer: "expand the inner loop's proving capabilities." Builds on
[ADR-0057](0057-dogfood-the-inner-loop-as-the-default-node-borne-proof-confi.md) (the spec-borne
`proof:` block), [ADR-0030](0030-all-in-on-claude-agent-sdk.md) (the live SDK leaf),
[ADR-0031](0031-real-pass-promotion-and-worktree-deps.md) (worktree deps + promotion), and reuses
[ADR-0054](0054-live-gated-tests-isolate-to-a-disposable-database-fail-close.md) (the disposable
test-DB isolation guard) and [ADR-0021](0021-keyless-agent-session-auth-and-db-bootstrap.md) (keyless Cloud SQL IAM).
**Amends ADR-0031 §2** — its rule "the leaf can never add a dependency" stands for the *leaf*, but
this ADR adds a SPINE-driven, declared dependency-add step (the spine adds, the leaf still cannot).

## Context

The inner loop (`storytree node build <id> --real`, ADR-0057/0031) cuts a fresh git worktree, the
SDK leaf authors the node's real test+impl under a per-phase write wall, the spine observes the
proof command red→green and signs a verdict. Two classes of work could not pass through it:

1. **Proofs that need a live database.** The worktree proof runs OFFLINE — no Postgres — so any
   store/pg adapter (e.g. the ADR-0016 `PgChangeStore`) had no way to prove itself in the loop. The
   ADR-0054 truncation incident makes the stakes explicit: a test that touches the *production*
   database can silently destroy the corpus and every signed verdict. So a DB-backed proof must be
   isolated by construction, never able to reach prod.
2. **Slices that need a NEW dependency.** The leaf's write walls are deny-by-default and exclude
   `package.json`/`pnpm-lock.yaml` (ADR-0031 §2), so any node whose implementation needs a
   dependency not already in the lockfile (e.g. tree-sitter for the ADR-0016 fork-C AST swap) could
   not be built in the loop at all — the impl would crash on a missing module before the proof ran.

A third question was posed but is a boundary, not a build: **can the inner loop drive a visual /
browser proof** (the studio "stale" hue, ADR-0016 fork)? Assessed below.

## Decision

### 1. DB-backed proof mode (`real.db: true`)

A node's `real:` arm may declare `db: true`. The spine then provisions an **isolated test-database
connection** for the worktree proof, reusing the ADR-0054 disposable-DB machinery:

- **The spine FORCES the proof's environment.** `STORYTREE_DB_NAME` (and the keyless
  `STORYTREE_DB_USER`) are injected onto the proof command via a new spine-only `env` field on the
  runtime `ShellCommand`, merged LAST in `runShellCommand` so it WINS over the inherited env. A
  db-backed proof therefore connects to the disposable test database **even if the parent process
  points at production** — the leaf never chooses the DB, and a spec-borne `proofCommand` cannot
  carry `env` (its schema is file/args/cwd only).
- **Two independent honesty walls.** (a) The CLI computes the DB name (`STORYTREE_DB_NAME` override
  or the canonical `storytree_test`) and **asserts it non-production** via `@storytree/store`'s
  `assertTestDatabase` (ADR-0054) before any worktree is cut. (b) The orchestrator's `resolveReal`
  **independently** refuses a `db:true` node whose injected env is missing or names `storytree`
  (a literal it carries, store-free) — so a CLI bug alone can never reach prod. The leaf's authored
  test should also use `createTestPool()`, which is fail-closed in-process — a third in-depth layer.
- **`db: true` requires `install: true`** (a db-backed proof imports `@storytree/store` / `pg` / the
  Cloud SQL connector from `node_modules`; a bare worktree has none) — and install:true already
  requires `real.typecheck`. The CLI/story-chain also bring the instance UP (`ensureLiveDb`) for a
  db-backed proof even under `--store memory`, since the proof connects to the test DB on that
  instance regardless of where verdicts persist.
- **Keyless auth note (ADR-0021):** the proof authenticates via ambient ADC (the *well-known* file),
  not the `GOOGLE_APPLICATION_CREDENTIALS` env pointer — which `scrubbedChildEnv` deliberately
  strips (the leaf-output-honesty rule). On a `gcloud auth application-default login` box and on
  Cloud Run (metadata SA) this is the norm; an ADC-by-env-var-only environment is not supported.

### 2. Spine-driven, declared dependency adds (`real.addDeps: [...]`)

A node's `real:` arm may declare `addDeps: ["tree-sitter", ...]`. The SPINE runs
`pnpm add <dep…>` in the worktree **after** the lockfile-only base install and **before** the leaf
authors. This is a deliberate, narrow relaxation of ADR-0031 §2:

- **The leaf still cannot touch `package.json`/`pnpm-lock.yaml`** — they remain outside every write
  scope. The dependency set is declared in the node's spec (explicit, auditable, reviewed), the
  SPINE performs the add, and the change lands in the **PR's lockfile diff** (the spine's
  post-green commit stages it with the authored files). A new dependency is explicit STORY work, not
  a leaf's silent workaround.
- **`addDeps` requires `install: true`** (`pnpm add` needs the workspace installed first), and each
  entry is a `pnpm add` package spec; a leading `-` is refused (no flag injection — the add is an
  `execFile` arg vector, never a shell string).
- A failed `pnpm add` tears the worktree down and throws (same fail-closed posture as the base
  install — a half-provisioned worktree must not look buildable).

### 3. The visual / browser proof: NOT built — orchestrator + human (the boundary)

The studio already has Playwright (`apps/studio/uat/`, `playwright.config.ts` with an auto-started
vite `webServer`) and vitest. The inner loop *could* run a `proofCommand` of `pnpm --filter studio
uat`, but it is **not easy** and, more importantly, **not the right honesty model**:

- Browser binaries are a separate ~hundreds-of-MB `playwright install` the lockfile-only worktree
  install does not fetch (absent in CI and fresh worktrees); plus a dev-server lifecycle and the
  attendant flakiness — a large escalation over the fast `node:test`/`pnpm test` proofs.
- **A visual UAT requires HUMAN sign-off anyway** (ADR-0040/0044 human-witness): a machine proof can
  assert *computed state* but never "the look is right." The studio tree must not go green on a
  machine claim about appearance.

**Recommendation (recorded, not built):** split visual work in two. The **machine-checkable computed
state** (e.g. `worldStatus.ts` returning a distinct `stale` state, never a silent green→brown) is
PURE LOGIC — prove it through the EXISTING inner loop (`node build --real` / vitest), no browser
needed. The **visual look** is delivered by the orchestrator + human: a session drives the studio
(`pnpm studio:up`), the owner eyeballs it and signs off (the human-witness attestation). This is the
owner's "else have it work with you to deliver." Revisit a browser-proof capability only if visual
work becomes frequent enough to amortise the browser/dev-server cost.

## Consequences

- The inner loop can now prove store/pg adapters (DB-backed) and dependency-bearing slices
  (spine-driven adds) — unblocking the ADR-0016 follow-on (`PgChangeStore` uses §1; the tree-sitter
  AST fingerprint swap uses §2). Both surfaces (`node build --real` and `story build --real`) are
  wired.
- The deny-by-default dependency rule is relaxed in EXACTLY one controlled way: declared in the
  spec, performed by the spine, visible in the lockfile diff, leaf still unprivileged. A new
  dependency remains a reviewable, deliberate act.
- A db-backed proof can never reach production: two independent guards (CLI `assertTestDatabase`;
  orchestrator literal-prod refusal) plus the forced env that overrides any inherited prod pointer.
- Offline coverage proves the wiring and the honesty walls (schema refines, env-force, prod
  refusals, lockfile-add seam with an injected runner); the live `pnpm install`/`pnpm add` and the
  real DB round-trip are exercised by real `--real` use, not the offline suite (the ADR-0031
  posture). The DB-backed mode landed first; the dependency-add mode is its own PR-landed unit.
- Cost: a db-backed proof needs the `storytree_test` database provisioned once
  (`gcloud sql databases create storytree_test --instance=storytree-pg`, already done) and the
  instance up; a dep-adding proof writes the lockfile, so its PR carries a (reviewable) lockfile
  diff.

## References

- [ADR-0057](0057-dogfood-the-inner-loop-as-the-default-node-borne-proof-confi.md) (spec-borne proof
  config), [ADR-0031](0031-real-pass-promotion-and-worktree-deps.md) (worktree deps — amended here),
  [ADR-0054](0054-live-gated-tests-isolate-to-a-disposable-database-fail-close.md) (disposable test
  DB), [ADR-0021](0021-keyless-agent-session-auth-and-db-bootstrap.md) (keyless IAM), [ADR-0030](0030-all-in-on-claude-agent-sdk.md)
  (live leaf), [ADR-0040](0040-verdict-derived-green-and-the-human-witness-signpost.md) /
  [ADR-0044](0044-per-uat-test-human-attestation.md) (human-witness for visual UAT).
- `packages/orchestrator/src/proof-config.ts` (`db` / `addDeps` schema), `shell-test-executor.ts`
  (`ShellCommand.env`), `resolve-prove-spec.ts` (the second honesty wall + env injection),
  `build-worktree.ts` (the `pnpm add` seam); `packages/cli/src/node-build.ts` (`resolveDbProofEnv`,
  the first wall) + `story-build.ts` (the chain).
- ADR-0016 (`docs/decisions/0016-knowledge-code-binding-and-staleness.md`) — the follow-on work
  these capabilities unblock.
