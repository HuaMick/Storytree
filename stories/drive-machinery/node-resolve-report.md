---
id: "node-resolve-report"
tier: contract
story: drive-machinery
title: "Resolve a node spec into a structured resolution report"
outcome: "A pure function resolves a node spec into a structured resolution report — provenance (spec-borne vs registry vs not-buildable), the proof command, the per-phase write scope, and the REAL arm — so an operator can see how a node would build without building or spending anything."
status: proposed
proof_mode: contract-test
depends_on: []
# Node-borne proof config (ADR-0057 keystone A): authoring THIS block is what makes the node
# inner-loop buildable — no NODE_BUILD_REGISTRY edit. NET-NEW file pair; `install: true` because the
# implementation imports VALUE functions from @storytree/orchestrator (resolveBuildConfig,
# mapProofMode, realProofCommand), so the worktree needs a lockfile-only install + a typecheck wall
# (tsx strips types — only `tsc --noEmit` catches type-illegal-but-runtime-green code, ADR-0031 §2).
# The red is genuine: resolve-report.ts does not exist at HEAD, so the authored test's
# `import { resolveReport } from "./resolve-report.js"` fails until IMPLEMENT writes it.
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/drive", "test"]
  scope:
    testGlobs: ["packages/drive/src/**/*.test.ts"]
    sourceGlobs: ["packages/drive/src/**/*.ts"]
  real:
    testFile: "packages/drive/src/resolve-report.test.ts"
    sourceFile: "packages/drive/src/resolve-report.ts"
    scope:
      testGlobs: ["packages/drive/src/resolve-report.test.ts"]
      sourceGlobs: ["packages/drive/src/resolve-report.ts"]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/drive", "typecheck"]
---

# Resolve a node spec into a structured resolution report

**Outcome —** A pure function resolves a node spec into a structured resolution report —
provenance (spec-borne vs registry vs not-buildable), the proof command, the per-phase write
scope, and the REAL arm — so an operator can see how a node would build **without building or
spending anything**.

> **The gap this closes (the blind dogfood test, 2026-06-15).** An agent authoring a
> self-registering node (a spec-borne `proof:` block, ADR-0057 A) had no FREE, dry way to confirm
> the node resolved correctly — `source: spec` vs `registry`, the real arm, REAL-buildability —
> before committing to a paid `--real` build; one probe wrote a throwaway 6-line script to fake it.
> This contract is the pure core of the read-only `storytree node resolve <id>` command (the spine
> wires the CLI dispatch + envelope AFTER promotion; the leaf's walls deliberately exclude
> `commands.ts` / `node-build.ts`). NET-NEW + dependency-bearing, so the prove-it-gate's red is
> genuine at build time.

## Guidance

ONE pure function (no I/O, no spawning, no filesystem) in `packages/drive/src/resolve-report.ts`:

```ts
import { resolveBuildConfig, mapProofMode, realProofCommand } from "@storytree/orchestrator";
import type { NodeSpec } from "@storytree/orchestrator";

export function resolveReport(spec: NodeSpec): ResolveReport;
```

It RESOLVES the spec the SAME way a build does — by delegating to `resolveBuildConfig(spec)` (the
single resolver, ADR-0057): spec-borne `proof:` block first, the test-command registry as fallback,
`null` when neither exists (not buildable). The function only RENDERS that resolution into a
structured report; it never re-implements the resolution and never decides red/green.

Export these two interfaces and the function from `resolve-report.ts`:

```ts
/** The REAL (`--real`) arm of a node's resolution, when it carries one. */
export interface ResolveRealReport {
  /** Repo-relative test file the REAL proof authors + runs. */
  testFile: string;
  /** Repo-relative implementation file the REAL build authors. */
  sourceFile: string;
  /** Lockfile-only worktree install (ADR-0031 §2). */
  install: boolean;
  /** Whether the node edits existing source (vs net-new). */
  editsExisting: boolean;
  /** The declared typecheck command shown as one string, or null when none is declared. */
  typecheck: string | null;
  /** The DECLARED proof command shown as one string, or null when the default node:test is used. */
  proofCommand: string | null;
  /** The RESOLVED real proof command display — reuse `realProofCommand(real, ...).display`. */
  proofDisplay: string;
}

/** How a node spec resolves for a build — the read-only report behind `storytree node resolve`. */
export interface ResolveReport {
  /** The node id (echoed from the spec). */
  id: string;
  /** The node's tier (contract | capability | story | ...). */
  tier: string;
  /** The spec's frontmatter proof-mode word, e.g. "contract-test". */
  proofModeWord: string;
  /** The mapped core ProofMode, e.g. "contract" (via `mapProofMode`). */
  proofMode: string;
  /** True iff the node has ANY proof config (spec-borne OR registry) — i.e. buildable at all. */
  buildable: boolean;
  /** Provenance: "spec" (a spec-borne proof: block), "registry" (fallback), or null (not buildable). */
  source: "spec" | "registry" | null;
  /** The resolved proof command (file + args + a joined display string), or null when not buildable. */
  command: { file: string; args: string[]; display: string } | null;
  /** The per-phase write scope, or null when not buildable. */
  scope: { testGlobs: string[]; sourceGlobs: string[] } | null;
  /** The REAL arm, or null when the node has no `real:` arm. */
  real: ResolveRealReport | null;
  /** True iff the node is REAL-buildable (its config carries a `real:` arm). */
  realBuildable: boolean;
}
```

How to fill it:

- `id` = `spec.id`; `tier` = `spec.tier`; `proofModeWord` = `spec.proofMode`; `proofMode` =
  `mapProofMode(spec.proofMode)`.
- `const resolved = resolveBuildConfig(spec)` — `{ config, source } | null`.
- **Not buildable** (`resolved === null`): `buildable: false`, `source: null`, `command: null`,
  `scope: null`, `real: null`, `realBuildable: false`. (The CLI renders the two routes out — author
  a `proof:` block, or add a registry entry — from this; the function just reports the absence.)
- **Buildable**: `buildable: true`, `source: resolved.source`, `command` =
  `{ file: c.command.file, args: c.command.args, display: \`${c.command.file} ${c.command.args.join(" ")}\` }`,
  `scope` = `{ testGlobs: c.scope.testGlobs, sourceGlobs: c.scope.sourceGlobs }`.
- **The real arm** (`resolved.config.real`): if absent, `real: null`, `realBuildable: false`. If
  present (`real`): `realBuildable: true`, and `real` is a `ResolveRealReport`:
  - `testFile` / `sourceFile` straight off `real`;
  - `install` = `real.install === true`; `editsExisting` = `real.editsExisting === true`;
  - `typecheck` = `real.typecheck` present ? `\`${real.typecheck.file} ${real.typecheck.args.join(" ")}\`` : `null`;
  - `proofCommand` = `real.proofCommand` present ? `\`${real.proofCommand.file} ${real.proofCommand.args.join(" ")}\`` : `null` (null means the default node:test command is used);
  - `proofDisplay` = `realProofCommand(real, "").display` — REUSE the orchestrator's one-true display
    (the `display` does not depend on the workspace arg, so any string, including `""`, is fine; do
    NOT hand-format the default `node --import tsx --test ...` string).

Keep it total and dependency-light: type-only `import type { NodeSpec }` so the function stays a pure
data transform. No `process`, no `fs`, no network. Copy array fields into the report (`[...]`) so the
report never aliases the spec's internal arrays.

## Contract

1. **`resolve-report-renders-the-resolution`** — `resolveReport` renders how a node spec resolves,
   honestly distinguishing spec-borne, registry, and not-buildable nodes.
   - **asserts —**
     - a node with a spec-borne `proof:` block (a `buildConfig` set on the `NodeSpec`) reports
       `buildable: true`, `source: "spec"`, the proof `command` (file/args/display) and the write
       `scope` straight off the block, and — when the block has a `real:` arm — `realBuildable: true`
       with `real.testFile`/`real.sourceFile`/`real.install`/`real.editsExisting`, the `typecheck`
       and `proofCommand` display strings (or `null`), and a `real.proofDisplay` equal to
       `realProofCommand(real, "").display`;
     - a node with NO `buildConfig` but a registry id (e.g. `"library-cli"`) reports
       `buildable: true`, `source: "registry"`;
     - a node with NO `buildConfig` and an unregistered id reports `buildable: false`,
       `source: null`, `command: null`, `scope: null`, `real: null`, `realBuildable: false`;
     - `proofMode` is the mapped core mode (`mapProofMode(spec.proofMode)`), distinct from
       `proofModeWord` (the raw frontmatter word).
   - **proven by —** `packages/drive/src/resolve-report.test.ts` (authored by the leaf inside the
     gate's AUTHOR_TEST phase; the red is observed by the spine before `resolve-report.ts` exists).
