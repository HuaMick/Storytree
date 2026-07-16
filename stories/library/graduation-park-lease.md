---
id: "graduation-park-lease"
tier: capability
story: library
title: "One pure, browser-safe park-lease compute in @storytree/library (root barrel, no node: imports) turns ADR-0202's parked-memory verdict into a lease: a content-hash + review-date + lease-length record, a `new | changed | expired | parked` classifier, and a worklist projection that counts only LIVE candidates. MACHINE-ONLY, no look leg."
outcome: "A single pure module `packages/library/src/graduation/park.ts` (sibling of the existing `graduation.ts` engine, same purity discipline — NO `node:`/`pg`/`fs` import, no clock; the caller passes `now`) realises ADR-0202's parked-memory lease over the existing `MemoryFile` type. It exports: `DEFAULT_LEASE_DAYS = 60` (D3); zod schemas + types `ParkRecord` (`{ verdict: 'wont-graduate', reason (non-empty), contentHash, reviewedAt (ISO yyyy-mm-dd), leaseDays (positive int) }`) and `ParkLedger` (`{ version: 1, parks: Record<memory-name, ParkRecord> }`), an `emptyParkLedger()` helper, and a fail-loud `parseParkLedger(raw)`; `hashMemoryContent(m)` — a pure deterministic content hash (FNV-1a in plain JS, NOT node:crypto) over the memory's description + type + body, with `name` EXCLUDED (a pure rename re-keys the ledger entry rather than reading as an edit); `makeParkRecord(m, { reason, now, leaseDays? })` — stamps hash + reviewedAt, defaults leaseDays to 60; `leaseExpiresOn(record)` — pure ISO-date math (reviewedAt + leaseDays, month/year rollover, no clock); `classifyMemoryPark(m, record, now)` → `new` (no record) | `changed` (hash mismatch — WINS over lease state, D2's immediate re-entry) | `expired` (hash matches AND now >= lease expiry) | `parked`; and `classifyWorklist(memories, ledger, { now })` whose `live` excludes ONLY `parked`, with consistent counts and empty-ledger → everything `new` (D4: the counter counts only live candidates). This is the PURE COMPUTE half of ADR-0202 — the ledger file I/O, the CLI subcommand, the `check:graduation-worklist` rewire, and the librarian guidance edit are all after-PASS supplement glue OUTSIDE this cap's real scope. MACHINE-ONLY — NO look leg, NO operator-attested UAT leg (exactly like the sibling arc's machine-only plumbing caps): the hash determinism, the schema validation, the lease date math, the four-way classification (with the precedence + boundary rules), the live-only worklist counting, and the browser-safe barrel export are all machine-witnessed."
status: proposed
proof_mode: integration-test
# depends_on: [] — the pure module imports ONLY the sibling `graduation.ts`'s `MemoryFile` type,
# WITHIN this same capability's package (`packages/library`), so there is no cross-capability code
# edge to declare (the `MemoryFile` import is intra-package guidance, cited in prose below, not a
# hierarchy edge; the graduation engine itself is not a specced capability of this story).
depends_on: []
# Deciding ADRs (ADR-0037 §2): ADR-0202 (the parked-memory lease this realises) amends ADR-0095
# (the memory→Library graduation loop the park verdict extends).
decisions: [202, 95]
# ── Node-borne proof config (ADR-0057 keystone) ─────────────────────────────────────────────────
# Authoring THIS block is what makes the capability inner-loop buildable — no NODE_BUILD_REGISTRY
# edit. This capability is FULLY NET-NEW (NOT editsExisting): both `real.sourceFile`
# (packages/library/src/graduation/park.ts) and `real.testFile`
# (packages/library/src/graduation/park.test.ts) are module-not-found at HEAD — the failing run that
# imports the absent `park.ts` subsumes the net-new source (the `library-lifecycle-wire` /
# `library-category-shelf` net-new-module precedent). real.scope.sourceGlobs names BOTH the net-new
# park.ts AND the EXISTING barrel index.ts (the barrel re-export the browser bundle consumes), so the
# write fence admits every file the leaf touches; every contract's `covers` stays INSIDE these
# sourceGlobs. real.testFile is the ONE net-new `packages/library/src/graduation/park.test.ts` holding
# EVERY `gpl-` contract (coverage scans ONE file).
#
# CRITICAL — the RED must be a RUNTIME behaviour, not type-only. The proof runs under tsx
# (`node --import tsx --test`), which strips types WITHOUT typechecking — so a type-only import would
# NOT fail at runtime. The legitimate observed red is `import { classifyMemoryPark } from "./park.js"`
# (or from the barrel `./index.js`) being MODULE-NOT-FOUND at HEAD, and every assertion is a VALUE
# check over the returned object / classifier verdict — never a type check (the `library-typed-edges`
# runtime-witness precedent). At GREEN the module exists, is re-exported from the barrel, and every
# `gpl-` assertion holds.
#
# install: true + a typecheck wall — the suite imports the package's own types across modules and the
# proof runs in a fresh worktree (tsx + tsc need the lockfile-only install, ADR-0031 §2).
#
# real.scope.sourceGlobs names TWO source files (net-new park.ts + the edited barrel index.ts),
# broader than the single literal `sourceFile` — so the spec MUST declare a `real.proofCommand` (a
# suite that exercises the edited code), not lean on the default single-file node:test. The
# @storytree/library `test` suite (`node --import tsx --test "src/**/*.test.ts"`) runs park.test.ts —
# which imports park.ts AND (for the barrel-export contract) ./index.js — so the RED/GREEN it observes
# spans both edited files. Still node:test (NOT vitest — the @storytree/library package convention,
# unlike the studio-side siblings); coverage scans only real.testFile regardless.
#
# MACHINE-ONLY: this cap is a pure compute module — NO look leg, NO operator-attested UAT leg. The
# ledger file I/O (reading/writing `graduation-park.json` beside the harness memory dir), the
# `storytree library graduate park` CLI subcommand, the `check-graduation-worklist.ts` rewire, the
# `packages/cli/src/graduate.ts` display changes, the `node-build.test.ts` snapshot insert, and the
# librarian-curator agent-guidance edit are AFTER-PASS SUPPLEMENT GLUE — explicitly OUT of the leaf's
# `real:` scope (park.ts + park.test.ts + index.ts ONLY). The leaf must NOT edit graduate.ts,
# check-graduation-worklist.ts, node-build.test.ts, any agent artifact, or any other signed source.
#
# COVERAGE (ADR-0122): `storytree coverage` scans ONLY real.testFile, so EVERY `gpl-`-named contract
# test lives in this ONE file (packages/library/src/graduation/park.test.ts). Its TITLE must carry the
# unique `gpl-` id verbatim or coverage silently drops N-1/N past the signed green
# (`sdk-leaf-drops-contract-id-test-names` — the fix if it happens is TEST-TITLE-ONLY, never an
# assertion/source edit).
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/library", "test"]
  scope:
    testGlobs: ["packages/library/src/**/*.test.ts"]
    sourceGlobs: ["packages/library/src/**/*.ts"]
  real:
    editsExisting: false
    testFile: "packages/library/src/graduation/park.test.ts"
    sourceFile: "packages/library/src/graduation/park.ts"
    scope:
      testGlobs: ["packages/library/src/graduation/park.test.ts"]
      sourceGlobs:
        - "packages/library/src/graduation/park.ts"
        # The barrel re-export IS in scope: gpl-park-exported-and-browser-safe covers index.ts
        # (`export * from "./graduation/park.js"`), so the write fence must admit it — the
        # library-lifecycle-wire run failed CLOSED at CONFIRM_GREEN on exactly this omission
        # (scope-wall hits on index.ts). Every contract's `covers` stays inside these globs.
        - "packages/library/src/index.ts"
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/library", "typecheck"]
    # real.scope.sourceGlobs names TWO edited source files (net-new park.ts + the reworked barrel
    # index.ts), broader than the single literal `sourceFile` — so the spec MUST declare a
    # real.proofCommand (a suite that exercises the edited code), not lean on the default single-file
    # node:test. The @storytree/library `test` suite runs park.test.ts, which imports BOTH park.ts and
    # ./index.js — so the RED/GREEN it observes spans both edited files. Still node:test (NOT vitest);
    # coverage scans only real.testFile regardless.
    proofCommand:
      file: pnpm
      args: ["--filter", "@storytree/library", "test"]
---

# The parked-memory lease compute (machine-only plumbing)

**Outcome —** One pure, browser-safe module `packages/library/src/graduation/park.ts` — a sibling of the existing
`graduation.ts` engine, held to the same purity discipline (**NO `node:`/`pg`/`fs` import, no clock — the caller
passes `now`**) — turns ADR-0202's parked-memory verdict into a **lease**. Over the existing `MemoryFile` type it
exports: `DEFAULT_LEASE_DAYS = 60` (D3); the zod schemas + types `ParkRecord` and `ParkLedger`, `emptyParkLedger()`,
and a fail-loud `parseParkLedger`; `hashMemoryContent(m)` — a pure deterministic content hash (FNV-1a in plain JS,
NOT `node:crypto`) over description + type + body, with `name` EXCLUDED so a pure rename re-keys the ledger entry
rather than reading as an edit; `makeParkRecord(m, opts)` — stamps the current hash + `reviewedAt`, defaulting
`leaseDays` to 60; `leaseExpiresOn(record)` — pure ISO-date math with month/year rollover; `classifyMemoryPark`
returning exactly one of `new | changed | expired | parked` (with hash-invalidation taking precedence over lease
state — ADR-0202 D2's immediate re-entry); and `classifyWorklist` whose `live` set excludes ONLY `parked`, with
consistent counts and empty-ledger → everything `new` (ADR-0202 D4: the counter counts only live candidates). This
is the PURE COMPUTE half of ADR-0202 — the ledger file I/O, the CLI subcommand, the `check:graduation-worklist`
rewire, and the librarian guidance edit are after-PASS supplement glue OUTSIDE this cap's real scope. This is
**INVISIBLE PLUMBING** — **NO look leg, NO operator-attested UAT leg**. Every behaviour here is machine-witnessed.

**Depends on —** nothing (`depends_on: []`). The module is a standalone pure compute that imports ONLY the sibling
`graduation.ts`'s `MemoryFile` type, WITHIN this capability's own package (`packages/library`) — an intra-package
type reference, not a cross-capability code edge (the graduation engine itself is not a specced capability of this
story, so there is no capability node to depend on). This is the first increment of the `graduation-park-lease-arc`;
its `real:` red→green surface is `park.ts` + `index.ts` + `park.test.ts` only.

> **Proof status (honest) — `proposed`, FULLY NET-NEW.** `packages/library/src/graduation/park.ts` and
> `packages/library/src/graduation/park.test.ts` are both absent at HEAD. The new `gpl-` assertions in the net-new
> test call the real `park.ts` exports (`hashMemoryContent`, `makeParkRecord`, `leaseExpiresOn`, `classifyMemoryPark`,
> `classifyWorklist`, the zod schemas) over literal `MemoryFile` + ledger fixtures the test constructs, asserting
> VALUES — RED at HEAD (`import { classifyMemoryPark } from "./park.js"` is module-not-found), GREEN once `park.ts`
> is authored and re-exported from the barrel. The whole cap is machine-witnessed — NO look leg and NO
> operator-attested UAT leg. Status stays `proposed` — `healthy` is only ever DERIVED from signed verdicts
> (ADR-0020), never authored.

## Guidance

WHY THIS IS A CAPABILITY, NOT A CONTRACT: its honest proof is the PARKED-MEMORY LEASE AS A COHERENT WHOLE — a
content-hash change detector, a schema + defaults surface, ISO lease-expiry math, a four-way classifier with a
precedence rule and an expiry boundary, and a worklist projection that counts only live candidates. That is a
coherent behavioural surface (6 contracts) realising ADR-0202's decision, proven by one pure module, not a single
assertion. It is the COMPUTE half of ADR-0202; the ledger persistence, the CLI ceremony, and the gate rewire that
CONSUME this compute are after-PASS supplement glue (named below) — a later increment / the orchestrator's
supplement, not this leaf's scope.

MACHINE-ONLY — THERE IS NO LOOK LEG. This capability puts a pure compute module in the barrel. It has NO appearance
to witness and NO operator-attested UAT leg (exactly like the sibling arc's machine-only plumbing caps —
`library-lifecycle-wire`, `library-typed-edges`). Do NOT author any visual / colour / stroke / pixel / animation
assertion, and do NOT frame any part of this as owner-witnessed — the whole proof is machine-witnessed pure logic
over literal fixtures.

THE MODULE IS PURE AND BROWSER-SAFE — IT LIVES BESIDE `graduation.ts` AND IS RE-EXPORTED FROM THE ROOT BARREL.
Author `park.ts` in `packages/library/src/graduation/` (the sibling of `graduation.ts`), holding it to the SAME
purity discipline the graduation engine's header states: **no `node:` / `pg` / `fs` import, no filesystem, no
clock** — the caller passes `now` as an ISO `yyyy-mm-dd` string. Re-export it from the root barrel
(`packages/library/src/index.ts`, `export * from "./graduation/park.js";`) **beside** the existing graduation
re-export (`index.ts:52`, `export * from "./graduation/graduation.js";`), because the studio bundles the root
barrel (the barrel's own header invariant: "no `node:` imports in this entry"). Pin the browser-safe barrel export
in `gpl-park-exported-and-browser-safe`.

THE CONTENT HASH IS PLAIN-JS AND CHANGE-DETECTION, NOT SECURITY. `hashMemoryContent(m: MemoryFile): string` is a
pure deterministic hash (e.g. FNV-1a in plain JS) over the memory's `description` + `type` + `body` — **NOT
`node:crypto`**, because the module must stay browser-safe. The `name` is DELIBERATELY EXCLUDED from the hash: the
`name` is the ledger KEY, so a pure rename re-keys the ledger entry rather than reading as an edit (a rename is not
a content change). Same `MemoryFile` content → same hash; a changed body OR description OR type → a different hash.
This is change-detection (does this parked memory still match what the librarian reviewed?), not cryptographic
integrity. Pin this in `gpl-hash-deterministic-and-content-sensitive`.

THE PARK RECORD + LEDGER ARE ZOD, FAIL-LOUD. `ParkRecord` = `{ verdict: 'wont-graduate', reason: string (non-empty),
contentHash: string, reviewedAt: string (ISO yyyy-mm-dd), leaseDays: positive int }`; `ParkLedger` =
`{ version: 1, parks: Record<memory-name, ParkRecord> }`. Provide `emptyParkLedger()` (returns
`{ version: 1, parks: {} }`) and `parseParkLedger(raw: unknown): ParkLedger` that fail-LOUD on any shape violation
(a zod `.parse()` that throws — a malformed ledger is a bug to surface, not to silently coerce). `makeParkRecord(m,
{ reason, now, leaseDays? })` stamps `contentHash = hashMemoryContent(m)`, `reviewedAt = now`, `verdict =
'wont-graduate'`, and defaults `leaseDays` to `DEFAULT_LEASE_DAYS` (60). Pin schema validation + defaults in
`gpl-park-record-schema-and-defaults`.

THE LEASE EXPIRY IS PURE ISO-DATE MATH — NO CLOCK ANYWHERE. `leaseExpiresOn(record: ParkRecord): string` returns
the ISO `yyyy-mm-dd` date that is `reviewedAt` + `leaseDays` days, handling month and year rollover. It reads only
the record — NO `Date.now()`, NO ambient clock. `leaseExpiresOn({ reviewedAt: '2026-07-16', leaseDays: 60, … })`
→ `'2026-09-14'` (16 Jul + 60 days). Include month-rollover and year-rollover fixtures. Pin in
`gpl-lease-expiry-date-math`.

THE CLASSIFIER IS FOUR-WAY, WITH HASH INVALIDATION WINNING OVER LEASE STATE.
`classifyMemoryPark(m: MemoryFile, record: ParkRecord | undefined, now: string): 'new' | 'changed' | 'expired' |
'parked'`:

- no `record` → `'new'` (never reviewed).
- `record.contentHash !== hashMemoryContent(m)` → `'changed'` — an edited memory re-enters the worklist
  IMMEDIATELY (ADR-0202 D2). **Hash invalidation WINS over lease state:** a memory whose hash mismatches is
  `'changed'` even if its lease has ALSO lapsed (test this precedence explicitly).
- hash matches AND `now >= leaseExpiresOn(record)` → `'expired'` (the lease ran out; the inverted re-review is due,
  ADR-0202 D3). The boundary is inclusive: `now === leaseExpiresOn(record)` → `'expired'`; the day before →
  `'parked'`.
- otherwise → `'parked'` (reviewed, unchanged, lease still holds — excluded from the worklist count).

Pin the four verdicts + the precedence + the boundary in `gpl-classify-new-changed-expired-parked`.

THE WORKLIST COUNTS ONLY LIVE CANDIDATES (ADR-0202 D4).
`classifyWorklist(memories: readonly MemoryFile[], ledger: ParkLedger, opts: { now: string })` classifies each
memory (looking its record up by `name` in `ledger.parks`) and returns `{ entries, live, counts }` where: `entries`
pairs each memory with its status; `live` is EXACTLY the non-`parked` subset (`new` + `changed` + `expired`);
`counts` is `{ new, changed, expired, parked }`, consistent with `entries` (the four counts sum to the memory
count). An EMPTY ledger → every memory is `'new'` (nothing reviewed yet). The exact return SHAPE is the leaf's to
refine — the CONTRACT is: `live` excludes only `parked`, counts are consistent, empty ledger → all `new`. Pin in
`gpl-worklist-counts-only-live`.

THE LEDGER I/O + CLI + GATE REWIRE ARE AFTER-PASS GLUE, OUT OF THE `real:` SCOPE. ADR-0202's ledger is "machine-local
state alongside the memory it describes" whose exact shape and location are the plan's domain — this cap authors the
PURE COMPUTE over an in-memory `ParkLedger`, NOT its persistence. Explicitly OUT of the leaf's `real:` scope (do NOT
let the leaf wander into them): the ledger file I/O (reading/writing `graduation-park.json` beside the harness
memory dir), the `storytree library graduate park` CLI subcommand, the `check-graduation-worklist.ts` rewire to
count only `classifyWorklist(...).live`, the `packages/cli/src/graduate.ts` display changes, the
`node-build.test.ts` snapshot insert, and the librarian-curator agent-guidance edit. The leaf edits `park.ts` +
`park.test.ts` + `index.ts` ONLY — it must NOT edit `graduate.ts`, `check-graduation-worklist.ts`,
`node-build.test.ts`, any agent artifact, or any other signed source.

OFFLINE-TESTABLE, NODE:TEST (no DB, no vitest). `park.ts` is a pure module; the sibling `graduation.test.ts` is
`node:test` + `node:assert/strict` (the `@storytree/library` package convention — NOT vitest). Every new `gpl-`
assertion runs offline over literal fixtures the test constructs — NO store, NO clock, NO DB, NO socket. The test
imports the surface from `./park.js` and (for the barrel-export contract) `./index.js`.

COVERAGE — EVERY `gpl-` TEST TITLE CARRIES A UNIQUE ID (the coverage-drop trap). Per ADR-0122, `storytree coverage`
scans ONLY `real.testFile`, so all 6 `gpl-` contract tests live in the ONE file
`packages/library/src/graduation/park.test.ts`, each an isolated `node:test` `test(...)` whose title LEADS with its
exact `gpl-…` id below, verbatim. **Trap (`sdk-leaf-drops-contract-id-test-names`):** if two test titles share (or
drop, or rename) a contract id, coverage silently reports N-1/N. The fix is **TEST-TITLE-ONLY** — give each of the
6 `test(...)` a distinct title leading with its exact `gpl-…` id, verbatim. Do NOT invent new ids, do NOT rename
these, do NOT collapse two contracts into one test.

## Integration test

**Goal —** Prove the parked-memory lease compute end-to-end over literal fixtures under `node:test`: the content hash
is deterministic and content-sensitive (name-excluded); the `ParkRecord`/`ParkLedger` schemas validate and default
correctly; `leaseExpiresOn` does pure ISO date math with rollover; `classifyMemoryPark` returns the four verdicts
with hash-invalidation taking precedence over lease state and an inclusive expiry boundary; `classifyWorklist`
counts only the live (non-`parked`) subset with an empty ledger → all `new`; and the surface is re-exported
browser-safe from the `@storytree/library` root barrel. Entirely pure, over literal fixtures, under `node:test`.

The integration test exercises this capability against its own composition (no backend seam) — the pure compute is
the whole surface. The RED it observes is RUNTIME (the tsx runner strips types without typechecking): the `park.ts`
import is module-not-found at HEAD. It would:

1. Build a literal `MemoryFile`, call `hashMemoryContent` twice → equal; mutate `body` / `description` / `type` each
   → a different hash; rename (`name` only) → the SAME hash (name excluded).
2. Round-trip `emptyParkLedger()` through `parseParkLedger`; assert `parseParkLedger` THROWS on a bad `verdict`, an
   empty `reason`, a non-int `leaseDays`, and a wrong `version`; call `makeParkRecord(m, { reason, now })` and assert
   it stamps the current hash + `reviewedAt = now` and defaults `leaseDays` to `DEFAULT_LEASE_DAYS` (60).
3. Assert `leaseExpiresOn({ reviewedAt: '2026-07-16', leaseDays: 60 })` → `'2026-09-14'`, plus a month-rollover and
   a year-rollover fixture; confirm it reads only the record (no clock).
4. Call `classifyMemoryPark` for: no record → `'new'`; a matching record with a live lease → `'parked'`; a matching
   record whose lease lapsed (`now >= leaseExpiresOn`) → `'expired'`, and the exact boundary (`now ===
   leaseExpiresOn` → `'expired'`; the day before → `'parked'`); a record whose `contentHash` mismatches → `'changed'`,
   INCLUDING the precedence case (mismatched hash + lapsed lease → `'changed'`, not `'expired'`).
5. Call `classifyWorklist` over a mixed fixture (some new, some changed, some expired, some parked) and assert `live`
   is exactly the non-`parked` subset, `counts` is consistent (sums to the memory count), and an empty ledger →
   every memory `'new'`.
6. Import the surface from `./index.js` (the root barrel) and assert `classifyMemoryPark` is a function that
   classifies a sample correctly; read the `park.ts` source text and assert it contains NO `node:` / `pg` / `fs`
   import specifier (the browser-safe witness the studio bundle depends on).

## Contracts (6)

The test-proven leaf behaviours — each **one isolated automated test** in the `@storytree/library` suite (`node:test`
+ `node:assert/strict`, `packages/library/src/graduation/park.test.ts`), no DB. Per ADR-0122 (`storytree coverage`)
each contract id LEADS a distinctly-named test, so the coverage check reports 6/6 against the ONE `real.testFile`.
None of these is an APPEARANCE assertion — this capability is machine-only plumbing with NO look leg and NO
operator-attested UAT leg. **Use these exact ids verbatim as the authoritative list (the coverage-drop trap — do NOT
rename, drop, or merge any).**

1. **`gpl-hash-deterministic-and-content-sensitive`** — the content hash is deterministic, content-sensitive, and name-excluded
   - **asserts —** `hashMemoryContent(m)` returns the SAME string for the same `MemoryFile` content; a changed
     `body` OR `description` OR `type` yields a DIFFERENT hash; and a renamed-but-otherwise-identical memory (only
     `name` differs) yields the SAME hash (the `name` is the ledger key, excluded from the hash — a pure rename
     re-keys rather than reads as an edit). Plain-JS (FNV-1a), NOT `node:crypto`.
   - **covers —** `packages/library/src/graduation/park.ts` (`hashMemoryContent`)
   - **proven by —** `packages/library/src/graduation/park.test.ts` (net-new, node:test; imports `hashMemoryContent`).
2. **`gpl-park-record-schema-and-defaults`** — the ParkRecord/ParkLedger schemas validate fail-loud and makeParkRecord stamps the right defaults
   - **asserts —** the `ParkRecord`/`ParkLedger` zod schemas REJECT a bad `verdict`, an empty `reason`, a non-int
     `leaseDays`, and a wrong `version` (via `parseParkLedger` throwing); `emptyParkLedger()` round-trips through
     `parseParkLedger`; and `makeParkRecord(m, { reason, now })` stamps `contentHash = hashMemoryContent(m)`,
     `reviewedAt = now`, `verdict = 'wont-graduate'`, and defaults `leaseDays` to `DEFAULT_LEASE_DAYS === 60`.
   - **covers —** `packages/library/src/graduation/park.ts` (the zod schemas, `emptyParkLedger`, `parseParkLedger`, `makeParkRecord`, `DEFAULT_LEASE_DAYS`)
   - **proven by —** `packages/library/src/graduation/park.test.ts`.
3. **`gpl-lease-expiry-date-math`** — leaseExpiresOn is pure ISO date math with month/year rollover
   - **asserts —** `leaseExpiresOn({ reviewedAt: '2026-07-16', leaseDays: 60, … })` returns `'2026-09-14'`; a
     month-rollover fixture and a year-rollover fixture return the correct ISO `yyyy-mm-dd`; and the function reads
     ONLY the record — no `Date.now()` / ambient clock (pure).
   - **covers —** `packages/library/src/graduation/park.ts` (`leaseExpiresOn`)
   - **proven by —** `packages/library/src/graduation/park.test.ts`.
4. **`gpl-classify-new-changed-expired-parked`** — the four-way classifier, with hash-invalidation precedence and the expiry boundary
   - **asserts —** `classifyMemoryPark(m, record, now)` returns `'new'` for no record, `'parked'` for a matching
     record with a live lease, `'expired'` when the hash matches AND `now >= leaseExpiresOn(record)`, and `'changed'`
     when `record.contentHash !== hashMemoryContent(m)`; the PRECEDENCE rule (mismatched hash + lapsed lease →
     `'changed'`, not `'expired'`, ADR-0202 D2); and the boundary (`now === leaseExpiresOn` → `'expired'`; the day
     before → `'parked'`).
   - **covers —** `packages/library/src/graduation/park.ts` (`classifyMemoryPark`)
   - **proven by —** `packages/library/src/graduation/park.test.ts`.
5. **`gpl-worklist-counts-only-live`** — classifyWorklist's live set excludes only parked, counts are consistent, empty ledger → all new
   - **asserts —** `classifyWorklist(memories, ledger, { now })` over a mixed fixture (some `new`, some `changed`,
     some `expired`, some `parked`) returns a `live` set that is EXACTLY the non-`parked` subset (`new` + `changed`
     + `expired`), `counts` consistent with the entries (the four counts sum to the memory count), and — over an
     EMPTY ledger — classifies every memory as `'new'` (ADR-0202 D4: the counter counts only live candidates).
   - **covers —** `packages/library/src/graduation/park.ts` (`classifyWorklist`)
   - **proven by —** `packages/library/src/graduation/park.test.ts`.
6. **`gpl-park-exported-and-browser-safe`** — the park surface is re-exported from the root barrel and its module carries no node import
   - **asserts —** `import { classifyMemoryPark } from "./index.js"` resolves to a function that classifies a sample
     correctly (the root barrel re-exports the park surface, so the browser bundle can consume it); AND the `park.ts`
     source text contains NO `node:` / `pg` / `fs` import specifier (the browser-safe invariant the studio bundle
     depends on — the barrel's "no `node:` imports in this entry" header).
   - **covers —** `packages/library/src/graduation/park.ts` + `packages/library/src/index.ts` (the barrel re-export, browser-safe)
   - **proven by —** `packages/library/src/graduation/park.test.ts`.

## Guidance — the net-new slice that earns the signed verdict

The bootstrap rung toward `healthy` (ADR-0057 §3, NET-NEW): author the pure park-lease compute and re-export it
browser-safe — test-first.

- **The new test —** `packages/library/src/graduation/park.test.ts` (`node:test` + `node:assert/strict`, the package
  convention). Import the surface from `"./park.js"` (and `{ classifyMemoryPark }` from `"./index.js"` for the
  browser-safe re-export contract), and ADD the 6 `gpl-` assertions above, each over literal fixtures the test
  constructs. Name each test for its contract id (`gpl-…`) so `storytree coverage graduation-park-lease` reports 6/6
  (ADR-0122) — all 6 contracts live in THIS one file.
- **The RED the spine observes (before IMPLEMENT) —** `import { classifyMemoryPark } from "./park.js"` (or from the
  barrel) is module-not-found at HEAD (net-new `park.ts`). A RUNTIME WITNESS is required here, not optional: the
  proof runs under tsx (`node --import tsx --test`), which strips types WITHOUT typechecking, so author every
  assertion as a VALUE check over the returned object / classifier verdict, never as a type check (the
  `library-typed-edges` runtime-witness precedent).
- **The GREEN —** (1) author `packages/library/src/graduation/park.ts` with `DEFAULT_LEASE_DAYS`, the zod
  `ParkRecord`/`ParkLedger` schemas + `emptyParkLedger`/`parseParkLedger`, `hashMemoryContent` (FNV-1a plain JS, no
  `node:crypto`), `makeParkRecord`, `leaseExpiresOn`, `classifyMemoryPark`, and `classifyWorklist` — browser-safe
  (no `node:`/`pg`/`fs`), importing only the sibling `MemoryFile` type from `./graduation.js`; (2) re-export it from
  `packages/library/src/index.ts` (`export * from "./graduation/park.js";`, beside the graduation re-export at
  `index.ts:52`). After it, the assertions hold and `pnpm --filter @storytree/library test` +
  `pnpm --filter @storytree/library typecheck` stay green.

The ledger file I/O (`graduation-park.json`), the `storytree library graduate park` CLI subcommand, the
`check-graduation-worklist.ts` rewire (counting only `classifyWorklist(...).live`), the `packages/cli/src/graduate.ts`
display changes, the `node-build.test.ts` snapshot insert, and the librarian-curator agent-guidance edit are
AFTER-PASS SUPPLEMENT GLUE — explicitly OUT of the leaf's `real:` scope (which is `park.ts` + `park.test.ts` +
`index.ts` only). The leaf must NOT edit `graduate.ts`, `check-graduation-worklist.ts`, `node-build.test.ts`, any
agent artifact, or any other signed source.

Rules:

- **The compute is pure + browser-safe + barrel-exported — the lease logic's SINGLE home** — author `park.ts`
  beside `graduation.ts` (no `node:`/`pg`/`fs`, no clock — caller passes `now`), re-export from the root barrel
  (`gpl-park-exported-and-browser-safe`).
- **The content hash is plain-JS change-detection, name-excluded** — FNV-1a over description + type + body, NOT
  `node:crypto`; `name` is the ledger key, excluded so a pure rename re-keys rather than reads as an edit
  (`gpl-hash-deterministic-and-content-sensitive`).
- **The record/ledger are zod, fail-loud; makeParkRecord defaults leaseDays to 60** — `parseParkLedger` THROWS on
  shape violations; `DEFAULT_LEASE_DAYS = 60` (ADR-0202 D3) (`gpl-park-record-schema-and-defaults`).
- **Lease expiry is pure ISO date math, no clock** — `reviewedAt` + `leaseDays` with month/year rollover
  (`gpl-lease-expiry-date-math`).
- **The classifier is four-way with hash-invalidation winning over lease state** — no record → `new`; hash mismatch
  → `changed` (even if the lease also lapsed — ADR-0202 D2's immediate re-entry); hash matches + `now >=` expiry →
  `expired` (inclusive boundary); else `parked` (`gpl-classify-new-changed-expired-parked`).
- **The worklist counts only live candidates** — `live` = the non-`parked` subset, counts consistent, empty ledger
  → all `new` (ADR-0202 D4) (`gpl-worklist-counts-only-live`).
- **Machine-only — no look leg, no operator-attested UAT leg** — this capability is a pure compute module; do NOT
  author a visual / colour / stroke / pixel / animation assertion, and do NOT frame any part of it as owner-witnessed.
- **The ledger I/O + CLI + gate rewire + guidance edit are after-pass glue, out of the `real:` scope** — the leaf
  edits `park.ts` + `park.test.ts` + `index.ts` ONLY; the persistence, the CLI subcommand, the
  `check-graduation-worklist.ts` rewire, the `graduate.ts` display, the `node-build.test.ts` snapshot insert, and
  the librarian-curator agent edit are the orchestrator's supplement glue after PASS — the leaf must NOT edit them
  or any signed source.
- **Every `gpl-` test title carries a unique id, verbatim** — coverage scans only `real.testFile` and silently
  drops N-1/N on a shared / dropped / renamed id (`sdk-leaf-drops-contract-id-test-names`); the fix is
  TEST-TITLE-ONLY — 6 distinctly-titled `test(...)`, each leading with its exact `gpl-…` id above, so coverage
  reports 6/6.
