---
id: "uat-machine-proof-binding"
tier: capability
story: drive-machinery
title: "Per-UAT-leg machine proof binding"
outcome: "Each machine-witnessed Story UAT leg is observed and signed only through its explicitly declared reliability-gate proof command, and an unbound or invalid machine leg is refused."
status: proposed
proof_mode: integration-test
depends_on: [build-drive-cli]
decisions: [106]
# This is inherently a cross-package edit-existing unit: @storytree/library parses and resolves the
# binding, while @storytree/drive's runAdopt consumes it to observe/sign. The current inner loop's
# multi-file scope supports the literal file set, and one recursive filtered pnpm command proves both
# package suites together. The uat-tests pair is the required REAL spotlight; the declared suite is
# the actual multi-file oracle.
proof:
  command:
    file: pnpm
    args: ["-r", "--filter", "@storytree/library", "--filter", "@storytree/drive", "test"]
  scope:
    testGlobs:
      - "packages/library/src/uat-tests.test.ts"
      - "packages/library/src/witness-resolution.test.ts"
      - "packages/drive/src/adopt.test.ts"
    sourceGlobs:
      - "packages/library/src/uat-tests.ts"
      - "packages/library/src/witness-resolution.ts"
      - "packages/drive/src/adopt.ts"
  real:
    testFile: "packages/library/src/uat-tests.test.ts"
    sourceFile: "packages/library/src/uat-tests.ts"
    scope:
      testGlobs:
        - "packages/library/src/uat-tests.test.ts"
        - "packages/library/src/witness-resolution.test.ts"
        - "packages/drive/src/adopt.test.ts"
      sourceGlobs:
        - "packages/library/src/uat-tests.ts"
        - "packages/library/src/witness-resolution.ts"
        - "packages/drive/src/adopt.ts"
    install: true
    editsExisting: true
    proofCommand:
      file: pnpm
      args: ["-r", "--filter", "@storytree/library", "--filter", "@storytree/drive", "test"]
    typecheck:
      file: pnpm
      args: ["-r", "--filter", "@storytree/library", "--filter", "@storytree/drive", "typecheck"]
---

# Per-UAT-leg machine proof binding

**Outcome —** Each machine-witnessed Story UAT leg is observed and signed only through its
explicitly declared reliability-gate proof command, and an unbound or invalid machine leg is
refused.

**Depends on —** [`build-drive-cli`](build-drive-cli.md) — this extends the existing `runAdopt`
entry that loads the parsed story, observes declared commands, and appends one signed verdict per
machine UAT id.

> **Proof status (honest) — `proposed`.** Today
> [`resolveWitness`](../../packages/library/src/witness-resolution.ts) sends every explicit
> `machine` leg to the first declared `observe` gate. That is not evidence that the gate's suite
> proves that leg. The current drive-machinery UAT therefore keeps legs 3, 4, and 7
> `_(witness: human)_`; changing those labels before this capability lands would forge machine
> coverage. No verdict is claimed for this capability.

## Proof walkthrough (written first)

Given a story with two observe reliability gates whose commands prove different behaviour:

1. parse two machine UAT legs, each carrying an explicit
   `_(proof-gate: <full-gate-id>)_` annotation;
2. resolve each leg to the gate it names, not the first observe gate in story order;
3. run `runAdopt` and observe each distinct declared command once;
4. append each machine UAT verdict only after its own bound command is green;
5. make one bound command red and confirm only that gate/leg remains unsigned; and
6. remove a machine leg's annotation, name a missing/non-observe gate, or bind to a gate with no
   proof command, and confirm adoption refuses that machine obligation without guessing a fallback.

The observable is the command call log plus the appended verdict unit ids. This is one coherent
integration proof: parsed author declaration → pure resolution → drive observation → signed UAT id.

## Guidance

Add one optional field to the parsed `UatTest` model:

```ts
proofGateId?: string;
```

The prose syntax is `_(proof-gate: story-id#gate-n)_`. The parser preserves that full id exactly;
it does not infer a gate from ordering, title, package, or `(covers:)`. Human/either legs may omit
the annotation because the drive does not machine-sign them. A real, non-aspirational
`_(witness: machine)_` leg must name one gate before `runAdopt` can observe or sign it.

`resolveWitness` remains pure. For an explicit machine leg it looks up exactly
`leg.proofGateId`, and returns an observe resolution only when that id names a declared
`observe` reliability gate with a proof command. No binding, an unknown id, a non-observe gate,
or a commandless observe gate is a refusal result carrying the reason; there is no "first observe
gate" fallback and no silent downgrade to human. Explicit human and undecided `either` legs retain
the existing fail-closed human resolution.

`runAdopt` must resolve all real machine legs before signing any UAT leg. It observes/signs each
machine UAT id against only the command of its resolved gate, while retaining command memoization
so a gate and every leg explicitly bound to it share one observation at the same clean commit.
An invalid/unbound machine leg makes the adopt envelope fail and earns no UAT verdict. Existing
gate signing and the mapped→proposed adoption decision remain separate behaviours; this capability
must not invent coverage or mutate UAT witness labels.

## Why this is a multi-file unit

The implementation inherently crosses the organism boundary already declared by this story:

- `packages/library/src/uat-tests.ts` + `.test.ts` own the parsed UAT annotation and strict data
  shape;
- `packages/library/src/witness-resolution.ts` + `.test.ts` own deterministic binding resolution
  and fail-closed refusal; and
- `packages/drive/src/adopt.ts` + `.test.ts` own observation and signing at the command boundary.

A single literal pair would test only parsing or only drive routing and leave the actual
parse→resolve→sign contract unproved. The `proof:` block therefore uses the current
`multi-file-existing-source` shape: one required REAL spotlight pair, an explicit six-file scope,
and one recursive filtered `pnpm` command that runs both package suites. It does not widen to
package globs or unrelated files.

## Integration test

**Goal —** A parsed machine UAT leg's explicit gate id is the only route from its author
declaration to the command `runAdopt` observes and the UAT verdict it signs.

The test fixtures use at least two observe gates with distinguishable commands and reverse their
declaration order, so choosing "first observe" cannot accidentally pass. They exercise the real
parser, real resolver, real `runAdopt` core, recording observation seam, and recording verdict
store; no DB, git subprocess, or network is required.

## Contracts (3)

1. **`parses-explicit-uat-proof-gate`** — the Story UAT parser carries a full per-leg gate id into the strict UAT model.
   - **asserts —** `_(proof-gate: drive-machinery#gate-2)_` parses as
     `proofGateId: "drive-machinery#gate-2"`; absent stays absent; malformed/duplicate annotations
     are refused rather than dropped or guessed.
   - **covers —** `packages/library/src/uat-tests.ts`.
   - **proven by —** `packages/library/src/uat-tests.test.ts`, authored red first.
2. **`resolves-only-the-declared-gate`** — a machine leg resolves to its named observe gate, never the first observe gate.
   - **asserts —** with multiple gates, declaration order does not affect the selected id; unbound,
     unknown, non-observe, and commandless bindings produce an explicit refusal; human/either
     preserve the existing human resolution.
   - **covers —** `packages/library/src/witness-resolution.ts`.
   - **proven by —** `packages/library/src/witness-resolution.test.ts`.
3. **`adopt-signs-leg-against-bound-command`** — `runAdopt` observes and signs each machine UAT id only through its bound gate command.
   - **asserts —** differently bound legs invoke the matching commands and earn their own verdicts;
     shared explicit bindings remain memoized; a red bound command signs neither its gate nor its
     leg; any invalid/unbound machine leg makes the envelope fail and earns no UAT verdict, with no
     fallback to another gate.
   - **covers —** `packages/drive/src/adopt.ts`.
   - **proven by —** `packages/drive/src/adopt.test.ts`.

## Follow-up authoring (only after this capability lands)

Do not change the current UAT witnesses as part of this capability authoring. After the
parse→resolve→sign binding is built and proven, a separate story-author edit must:

1. add explicit `proof-gate` annotations to the already-machine legs 1, 2, 5, and 6, because the
   new fail-closed rule permits no unbound machine leg; and
2. change drive-machinery UAT legs 3, 4, and 7 from `human` to `machine` **only while adding each
   leg's explicit gate id**, chosen from the suite that demonstrably proves that leg.

That follow-up is the coverage claim. It must not mechanically point all seven legs at gate 1:
gate 1, gate 2, and gate 3 run different suites, and a leg may become machine only when its named
suite actually proves its success condition. If no existing gate command proves a leg, that leg
stays human until a real machine proof exists.
