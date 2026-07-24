---
id: "traversal-event-vocabulary"
tier: capability
story: context-traversal-telemetry
arc: linked-session-context-arc
title: "Traversal observations record and replay strict metadata-only evidence"
outcome: "A deterministic boundary observation records and replays with strict stable identity, explicit relationships, and adapter-declared coverage."
status: proposed
proof_mode: integration-test
depends_on: []
decisions: [235, 192]
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/context-traversal-telemetry", "test"]
  scope:
    testGlobs: ["packages/context-traversal-telemetry/src/traversal-events.test.ts"]
    sourceGlobs: ["packages/context-traversal-telemetry/src/traversal-events.ts", "packages/context-traversal-telemetry/src/traversal-trace.ts"]
  real:
    testFile: "packages/context-traversal-telemetry/src/traversal-events.test.ts"
    sourceFile: "packages/context-traversal-telemetry/src/traversal-trace.ts"
    scope:
      testGlobs: ["packages/context-traversal-telemetry/src/traversal-events.test.ts"]
      sourceGlobs: ["packages/context-traversal-telemetry/src/traversal-events.ts", "packages/context-traversal-telemetry/src/traversal-trace.ts"]
    install: true
    proofCommand:
      file: pnpm
      args: ["--filter", "@storytree/context-traversal-telemetry", "test"]
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/context-traversal-telemetry", "typecheck"]
---

# Traversal observations record and replay strict metadata-only evidence

## Guidance

Define the browser-safe strict event vocabulary and append/replay trace in the story-owned
`packages/context-traversal-telemetry` package. A node visit separates canonical `nodeId` from
unique chronological `visitId` and stable `sessionId`. Front-matter inspection and full-payload
read are different event kinds, not a flag guessed downstream. A model-context observation may
carry cumulative input, input added since the preceding observation, and runtime-declared capacity;
absent capacity stays absent.

Spawn handoff and result return schemas carry explicit parent/child session identity plus an edge
identity, never payload or result content. They prove only a vocabulary that future adapters can
emit: spawn and return production adapters are omitted from this increment. An adapter coverage
declaration names supported event kinds and fields plus explicit omissions. All event variants are
strict: no arbitrary metadata bag provides a side door for prompts, bodies, tool results, hidden
reasoning, or credentials.

Replay orders observations chronologically but creates relationships only from explicit ids.
Timestamp proximity is never evidence. Child sessions retain independent token/capacity
observations even though this increment has no production spawn or return adapter.

## Contracts

1. **`canonical-and-chronological-identity-stay-separate`**
   - **asserts —** every node visit has non-empty `sessionId`, unique `visitId`, and canonical
     `nodeId`; revisiting the same node requires a new `visitId` and may name `priorVisitId`.
2. **`read-strength-is-an-event-kind`**
   - **asserts —** front-matter inspection and full-payload read parse as distinct kinds while
     storing identity, revision/count metadata only; any content-bearing or unknown field is
     refused.
3. **`capacity-is-runtime-declared-or-unknown`**
   - **asserts —** non-negative cumulative/added token observations parse; capacity is retained
     only when supplied by the runtime, with no default capacity and no 500k cutoff semantics.
4. **`spawn-edge-schemas-link-independent-sessions`**
   - **asserts —** schema fixtures for handoff/return events require explicit parent and child
     session ids plus their edge id, preserve independent windows, expose metadata counts at most,
     and reject payload/result bodies without asserting that a production spawn adapter emits them.
5. **`adapter-coverage-names-omissions`**
   - **asserts —** each adapter declares supported kinds/fields and explicit omissions;
     contradictory, unknown, or content-bearing coverage data is refused rather than normalized
     into completeness.
6. **`replay-does-not-infer-relationships`**
   - **asserts —** replay preserves chronological order and explicit prior/spawn/followed ids while
     never deriving an edge from timestamp adjacency; parent and child token windows remain
     separate.

## Integration evidence

`packages/context-traversal-telemetry/src/traversal-events.test.ts` parses a mixed session/child
trace through the story-owned schemas and structured trace store, exercises every refusal above,
and proves the resulting values contain metadata only. Explicit spawn/return edges and independent
windows are schema/replay proof only.
