---
status: superseded
decided: 2026-07-24
amends: [38, 40, 62, 222, 226]
arc: forest-parcels-arc
---
# ADR-0236: Forest flora counts observed automated tests, not declared contracts

## Status

superseded by [ADR-0238](0238-forest-flora-remains-an-algorithmically-compressed-proof-den.md)
after the owner rejected the staged exact-count appearance on 2026-07-25. The dense 1:1 planting
crowded the island and repeatedly appeared to grow beyond its coast. This file remains the record of
the considered direction. Its exact source-inventory and 1:1-count decisions did not land; the
scenery/signpost cleanup was re-decided and retained by ADR-0238.

**Amends [ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md)**: its
`tests → plants/flora` binding now means observed automated test cases, not authored contracts.
**Amends [ADR-0222](0222-split-the-art-factory-into-its-own-story-forest-world-gains.md)**: a capability
floor may stay coarse, but must not inflate its `## Contracts` list to make a large real suite visible.
**Amends [ADR-0226](0226-unified-world-art-vegetation-vocabulary-grass-proves-capabil.md)**: flora is
an exact one-mark-per-observed-test count; capability status may change a mark's health/form, never
its quantity.
**Amends [ADR-0038](0038-story-world-vocabulary-recalibration.md) /
[ADR-0040](0040-verdict-derived-green-and-the-human-witness-signpost.md)**: the studio forest no
longer renders scenery-only conifers/wheat or a story witness signpost. Proof remains visible through
status hue, with precise witness state in the detail/proof surfaces rather than duplicated on-island.

## Context

[ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md) settled the intended
forest binding as **tests → plants/flora**, specifically so an island's visible complexity emerges
from observable facts. The first garden implementation predated a test inventory and rendered one
plant per capability. The forest-parcels increment replaced that ring with capability parcels and
made flora density depend on a `testCount`, but its July 17 landing defined that field as
`spec.contracts.length` — the number of authored `## Contracts`.

Those numbers are not equivalent. A contract is one behavioural obligation in the proof hierarchy;
a real test surface can carry multiple regression, edge-case, parameterised, and infrastructure tests
for that behaviour. Conversely, retrospective or would-be contracts can exist without an executable
test. Using contract count therefore hides the exact signal the owner intended the forest to expose:
test bloat and capabilities whose proof surface has become disproportionately elaborate. The
`forest-world#render-core` example makes the drift concrete: seven declared contracts stand over more
than one hundred real automated cases, so contract-derived flora dramatically under-reports the suite.

The forest read must stay fast, deterministic and offline. Running every package suite during
`GET /api/tree` is therefore the wrong observation mechanism. The corpus already declares the
capability-to-test-surface boundary: contract `proven by` references name real test files, and a
buildable capability may additionally name `proof.real.testFile`. Static source observation can count
the cases in those explicitly claimed files without executing arbitrary code.

## Decision

1. **`testCount` means observed runnable automated test cases.** For each capability, collect the
   distinct repository-relative test files it explicitly claims through contract `proven by`
   references and `proof.real.testFile`. Parse those files with the existing TypeScript-AST test
   observer (ADR-0126 lineage) and count runnable `test` / `it` cases; `describe` suites,
   `.skip`/`.todo`, and non-test helper calls do not count. A statically enumerable `.each` table
   contributes one case per row. The inventory is source-observed, deterministic, and does not run
   the test command.
2. **Contracts remain a separate comparison signal.** The wire carries `contractCount` alongside
   `testCount`. Capability detail presents “N automated tests · M contracts”; the difference is
   deliberately visible as a diagnostic signal, not collapsed into a judgement or a synthetic
   complexity score.
3. **One observed case grows one flora mark.** Every parcel surface emits exactly `testCount` flora
   groups. Theme chooses the form and status may make the form healthy/withered, but neither changes
   the count. A capability with zero observed runnable tests grows zero test flora.
4. **Fail closed on missing provenance.** If no claimed test surface can be observed, the inventory
   is explicitly unavailable and produces no test flora. It never falls back to declared contracts.
   Missing/unsupported claimed files are carried as inventory diagnostics; they are not silently
   interpreted as zero proven tests.
5. **Keep ownership boundaries.** Static inventory compute lives with the existing node-spec/proof
   observation machinery, not in the browser-safe forest render core. The studio server and desktop
   backend compose the same shared inventory function and pass only the folded count/provenance into
   the pure `SceneInput`.
6. **Remove non-observability scenery and stale witness vocabulary from the studio forest.** Studio
   islands no longer grow scenery-only conifers or wheat patches, and the studio fold no longer emits
   the human-witness signpost. The legend drops its decoration row and its
   `awaiting witness` / `witnessed` tiles, and names the flora row `automated tests`. This does not
   remove witness state or signing from the product; it removes a redundant map glyph from a world
   whose proof hue and detail surfaces already carry the operative facts. The shared core keeps its
   optional legacy drawables for other surface inputs, but the studio supplies none.

## Consequences

**Good.**

- The forest finally renders the signal ADR-0062 named: a 120-test capability looks materially denser
  than a seven-test capability even when both declare seven behavioural contracts.
- Test growth becomes observable without running a suite or opening source; capability detail gives
  the viewer the denominator needed to distinguish broad behaviour from a swollen proof surface.
- Removing status/theme multipliers from quantity makes cross-capability visual comparison honest.
- The explicit provenance and unavailable state prevent authored prose from manufacturing apparent
  automated proof.
- Retiring scenery-only marks leaves the island's visual budget to story, capability, test, proof,
  and live-work signals; the legend now describes only vocabulary that is actually on the studio map.

**Costs and limits.**

- This first implementation recognises the repository's TypeScript `node:test` / Vitest vocabulary.
  Dynamically generated cases whose cardinality is not statically enumerable contribute one declared
  case; another language/runner earns its own observer rather than a regex guess.
- A capability claims whole test files. If two capabilities deliberately cite the same file, each
  reports that shared surface; the file is deduplicated within one capability but not assigned
  fractionally across capabilities. That is honest about the claimed proof boundary and keeps
  attribution deterministic.
- Exact 1:1 flora can make a bloated capability visually crowded and increases SVG node count. That
  is partly the intended warning. If map performance becomes the limiting fact, a later rendering
  optimisation must preserve the exact count/provenance in interaction rather than changing the
  observed metric.

## References

- [ADR-0038](0038-story-world-vocabulary-recalibration.md) /
  [ADR-0040](0040-verdict-derived-green-and-the-human-witness-signpost.md) — earlier decoration and
  witness-sign vocabulary narrowed by decision 6.
- [ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md) — one art element
  per observed signal; tests bind to flora.
- [ADR-0122](0122-per-contract-coverage-check-map-each-declared-contract-to-an.md) /
  [ADR-0126](0126-static-ast-hollow-test-detection-a-contract-is-covered-only.md) — the existing
  static test-name/AST observation lineage reused for inventory.
- [ADR-0222](0222-split-the-art-factory-into-its-own-story-forest-world-gains.md) — the capability floor
  must not distort contracts to affect the forest.
- [ADR-0226](0226-unified-world-art-vegetation-vocabulary-grass-proves-capabil.md) — vegetation
  vocabulary amended from proportional proxy density to exact observed-test quantity.
- Arc `forest-parcels-arc` — the 2026-07-24 exact-inventory direction was superseded by the owner's
  2026-07-25 appearance rejection; its live end state follows ADR-0238.
- Expected implementation seams:
  `packages/library/src/contracts.ts`,
  `packages/orchestrator/src/proof/contract-coverage.ts`,
  `packages/orchestrator/src/test-inventory.ts`,
  `apps/studio/server/apiRouter.ts`,
  `apps/desktop/src/backend/tree-verdicts.ts`,
  `packages/forest-world/src/scene.ts`.
