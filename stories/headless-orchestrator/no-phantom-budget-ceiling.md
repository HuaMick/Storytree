---
id: "no-phantom-budget-ceiling"
tier: contract
story: headless-orchestrator
title: "The chat orchestrator passes no default USD budget ceiling to the SDK"
outcome: "runHeadlessOrchestrator passes maxBudgetUsd to the SDK ONLY when a caller explicitly threads one down — with no budget supplied, NO USD ceiling reaches the SDK options (the turn cap is the runaway brake); an explicit budget still flows through unchanged (the opt-in path)."
status: proposed
proof_mode: contract-test
depends_on: []
decisions: [132, 130, 108]
# Node-borne proof config (ADR-0057 keystone): authoring THIS block is what makes the node
# inner-loop buildable — no NODE_BUILD_REGISTRY edit. EDIT-EXISTING (ADR-0057 §3 expansion C):
# packages/agent/src/headless-orchestrator.ts already exists and is green (the §7 scale-down landed,
# PR #457), so this increment EDITS it rather than authoring a net-new file. The leaf authors a NEW
# regression test (a sibling of the existing `hsr-wires-read-only-options` harness) that FAILS against
# CURRENT behaviour — a genuine RUNTIME red, NOT module-not-found: at HEAD `runHeadlessOrchestrator`
# builds the SDK `Options` with `maxBudgetUsd: args.maxBudgetUsd ?? 1`, so a session driven with NO
# maxBudgetUsd captures `options.maxBudgetUsd === 1`; asserting it is `undefined` therefore fails until
# IMPLEMENT removes the `?? 1` default. `install: true` + a typecheck wall because the test imports the
# runner + the `SdkQueryFn` seam from @storytree/agent (the proof runs in a fresh worktree — tsx + tsc
# need the lockfile-only install, ADR-0031 §2). Single LITERAL source file (no `*`) whose one `sourceGlobs`
# entry equals `sourceFile`, so the default node:test proof on the one test file is legal — no proofCommand
# (the exempted edit-existing case, proof-config.ts §C refine). The scope stays within packages/agent
# (ADR-0087: one concrete package per write scope).
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/agent", "test"]
  scope:
    testGlobs: ["packages/agent/src/**/*.test.ts"]
    sourceGlobs: ["packages/agent/src/**/*.ts"]
  real:
    testFile: "packages/agent/src/headless-orchestrator.test.ts"
    sourceFile: "packages/agent/src/headless-orchestrator.ts"
    scope:
      testGlobs: ["packages/agent/src/headless-orchestrator.test.ts"]
      sourceGlobs: ["packages/agent/src/headless-orchestrator.ts"]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/agent", "typecheck"]
    editsExisting: true
---

# The chat orchestrator passes no default USD budget ceiling to the SDK

**Outcome —** `runHeadlessOrchestrator` passes `maxBudgetUsd` to the SDK **only when a caller
explicitly threads one down** — with no budget supplied, **NO USD ceiling** reaches the SDK options
(the turn cap `maxTurns ?? 16` is the runaway brake); an explicit budget still flows through unchanged
(the opt-in path).

> **The gap this closes (ADR-0132 decision 4).** The chat/headless orchestrator session
> (`runHeadlessOrchestrator`, `packages/agent/src/headless-orchestrator.ts`) builds its SDK `Options`
> with `maxBudgetUsd: args.maxBudgetUsd ?? 1`. But the leaf is **subscription-funded** (ADR-0030), so
> the SDK's list-price `total_cost_usd` is a **phantom** — a $1 default ceiling on an **Opus** session
> (the orchestrator's standing model, ADR-0132 decision 2) halts real work almost immediately for no
> real saving. ADR-0130 already removed exactly this phantom default from the **build harness**
> (`packages/agent/src/sdk-author.ts` stopped defaulting `maxBudgetUsd` to `1`); decision 4 applies the
> SAME pattern to the chat orchestrator that ADR-0108 had left open. This unit makes the budget
> **opt-in**: no budget threaded → no ceiling; an explicit budget → honoured.

## Guidance

This is a **one-line edit** to the SDK options builder in
`packages/agent/src/headless-orchestrator.ts`, plus a JSDoc correction. It is the mirror of the
ADR-0130 build-harness change — read `packages/agent/src/sdk-author.ts` and
`docs/decisions/0130-remove-the-inner-loop-usd-budget-ceilings-subscription-funde.md` as the precedent
for the identical pattern.

At HEAD the `options` object in `runHeadlessOrchestrator` (around line 188) reads:

```ts
const options: Options = {
  cwd: args.cwd ?? process.cwd(),
  model: args.model ?? "claude-opus-4-8",
  maxTurns: args.maxTurns ?? 16,
  maxBudgetUsd: args.maxBudgetUsd ?? 1,   // ← the phantom default to remove
  ...
};
```

The change: pass `maxBudgetUsd` to the SDK **only when explicitly provided** — spread it conditionally,
the same absent-not-undefined idiom the file already uses for `includePartialMessages` and `mcpServers`:

```ts
const options: Options = {
  cwd: args.cwd ?? process.cwd(),
  model: args.model ?? "claude-opus-4-8",
  maxTurns: args.maxTurns ?? 16,
  // ADR-0132 d4 / ADR-0130: the leaf is subscription-funded, so the SDK's list-price total_cost_usd
  // is a phantom — a default $1 wall on an Opus session halts real work for no real saving. Pass a USD
  // ceiling to the SDK ONLY when a caller explicitly threads one down; absent, the turn cap is the brake.
  ...(args.maxBudgetUsd !== undefined ? { maxBudgetUsd: args.maxBudgetUsd } : {}),
  ...
};
```

That is the entire source change. Then update the `maxBudgetUsd` arg's JSDoc on
`HeadlessOrchestratorArgs` to state there is **no default ceiling** (the turn cap is the runaway brake;
a USD ceiling is opt-in), replacing the current `Default: 1.`

Rules:

- **Remove the `?? 1` default, do not relax anything else.** The turn cap (`maxTurns ?? 16`) STAYS —
  it is the genuine runaway brake (ADR-0130 / ADR-0132 d4). Touch nothing else in the options builder
  (not `model`, not `maxTurns`, not the streaming/MCP spreads).
- **Keep the opt-in path intact.** When a caller DOES pass `maxBudgetUsd`, it must still reach
  `options.maxBudgetUsd` unchanged — the door ADR-0108 left open for per-session controls stays open; it
  just is not a phantom by default (ADR-0132 d4, "per-session budget control survives as an opt-in").
- **EDIT-EXISTING, not net-new.** `headless-orchestrator.ts` EXISTS and is green; the red is a RUNTIME
  assertion on the captured options, NEVER a missing-symbol import.
- **No new authority.** This is read/propose-only plumbing (ADR-0091) — it changes a budget default, it
  wires no build/gate/PR/verdict path.

**The red the spine observes (before IMPLEMENT):** the new test drives `runHeadlessOrchestrator` with
**no** `maxBudgetUsd` and an injected scripted `queryFn` that captures the `options` it receives, then
asserts `captured.maxBudgetUsd === undefined`. At HEAD the builder sets `maxBudgetUsd: args.maxBudgetUsd
?? 1`, so the captured value is `1` → the assertion fails (a genuine runtime red on existing, green
code). After the `?? 1` default is removed, the captured value is `undefined` → it passes.

The capture harness already exists in the file — reuse it verbatim (the `hsr-wires-read-only-options`
and streaming tests use exactly this shape):

```ts
let capturedOptions: unknown;
const capturingQuery: SdkQueryFn = ({ options }) => {
  capturedOptions = options;
  return (async function* () {
    yield okResult;
  })();
};
```

## Contract

1. **`hsr-no-default-budget-ceiling`** — with no budget threaded, no USD ceiling reaches the SDK
   options; an explicit budget still flows through (the opt-in path)
   - **asserts —**
     - driving `runHeadlessOrchestrator({ systemPrompt, userPrompt, queryFn: capturingQuery })` with
       **no** `maxBudgetUsd` captures `options.maxBudgetUsd === undefined` (no phantom ceiling reaches
       the SDK — the genuine red at HEAD, where it is `1`);
     - driving it WITH `maxBudgetUsd: 5` captures `options.maxBudgetUsd === 5` (the opt-in path is
       pinned — an explicitly-threaded ceiling still reaches the SDK unchanged);
     - the turn cap is untouched: `options.maxTurns === 16` by default (the runaway brake stays, so the
       removed dollar wall is not silently swapped for no bound at all).
   - **proven by —** `packages/agent/src/headless-orchestrator.test.ts` (a NEW sibling test using the
     existing capturing-`queryFn` harness; authored by the leaf inside the gate's AUTHOR_TEST phase. The
     spine observes the red — the captured `maxBudgetUsd` is `1`, not `undefined`, on the unedited
     options builder — before IMPLEMENT removes the `?? 1` default). *(covers
     `packages/agent/src/headless-orchestrator.ts` — the SDK options builder; re-cite at real `file:line`
     when built.)*
