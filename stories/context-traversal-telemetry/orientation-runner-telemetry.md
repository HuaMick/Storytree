---
id: "orientation-runner-telemetry"
tier: capability
story: context-traversal-telemetry
arc: linked-session-context-arc
title: "An orientation-runner adapter records honest read and search telemetry"
outcome: "A wrapper around an injected orientation runner records its successful metadata-only read and search observations while declaring every omitted surface."
status: proposed
proof_mode: integration-test
depends_on: [traversal-event-vocabulary]
decisions: [235, 192]
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/context-traversal-telemetry", "test"]
  scope:
    testGlobs: ["packages/context-traversal-telemetry/src/orientation-runner-adapter.test.ts"]
    sourceGlobs: ["packages/context-traversal-telemetry/src/orientation-runner-adapter.ts"]
  real:
    testFile: "packages/context-traversal-telemetry/src/orientation-runner-adapter.uat.test.ts"
    sourceFile: "packages/context-traversal-telemetry/src/orientation-runner-adapter.ts"
    scope:
      testGlobs: ["packages/context-traversal-telemetry/src/orientation-runner-adapter.uat.test.ts"]
      sourceGlobs: ["packages/context-traversal-telemetry/src/orientation-runner-adapter.ts"]
    install: true
    proofCommand:
      file: pnpm
      args: ["--filter", "@storytree/context-traversal-telemetry", "test"]
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/context-traversal-telemetry", "typecheck"]
---

# An orientation-runner adapter records honest read and search telemetry

## Guidance

Implement a wrapper/decorator adapter in the story-owned
`packages/context-traversal-telemetry` package. The adapter accepts an injected orientation runner,
stable `sessionId`, and structured trace store. It delegates each request unchanged and records an
observation only after a successful response. Focused-tree and Library-dashboard reads emit
front-matter observations; `tree spec` and `library artifact <id>` emit full-payload observations;
Library artifact listing emits a search/list observation with canonical result ids. Envelopes and
returned content never enter telemetry.

The adapter owns no drive source and does not alter `createOrientationRunner`. Its UAT composes the
wrapper with a runner returned by the real production `createOrientationRunner` factory, proving a
real-boundary integration seam without claiming that the desktop application activates it. The
runner adapter cannot observe model token usage or capacity, explicit followed-edge identity,
spawn handoffs/returns, or independent child windows, so its coverage declares those fields and
event kinds unsupported and emits none. Direct CLI, SDK, owned-loop, spawned-agent, agents, and
noticeboard adapters are omitted. Spawn/return support is schema-only.

## Contracts

1. **`decorated-production-runner-emits-read-strength`**
   - **asserts —** the adapter around an injected runner returned by the real
     `createOrientationRunner` factory emits focused-tree front-matter and `tree spec`/artifact
     full-payload as distinct visit kinds with stable session/canonical-node identity, unique visit
     ids, and no envelope body.
2. **`orientation-search-list-is-metadata-only`**
   - **asserts —** a successful Library artifact-list call records its operation plus canonical
     result ids only; requesting a result later does not create a followed edge.
3. **`orientation-coverage-is-honest`**
   - **asserts —** coverage names only supported tree/Library reads and list/search while explicitly
     omitting model capacity/tokens, followed edges, spawn/handoff/return, independent child
     windows, and every other production adapter.
4. **`telemetry-wrapper-is-additive`**
   - **asserts —** the wrapper preserves successful and unsuccessful runner envelopes; it writes
     observations only for successful calls and never changes bodies, `next` guidance, misses, or
     read-only refusals.

## Integration evidence

`packages/context-traversal-telemetry/src/orientation-runner-adapter.test.ts` injects deterministic
runner responses and a structured trace store into the wrapper, proving delegation, success-only
observation, metadata minimization, and honest coverage. The story UAT separately decorates a
runner created by the real production factory. Neither proof edits nor claims instrumentation
inside the drive package.
