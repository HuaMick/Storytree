---
status: accepted
decided: 2026-07-25
supersedes: [236]
amends: [38, 40]
arc: forest-parcels-arc
---
# ADR-0238: Forest flora remains an algorithmically compressed proof-density signal

## Status

accepted (2026-07-25) — decided/directed by the owner during the staged appearance UAT. Design-time
alignment IS the ratification (ADR-0110); no second end-of-flow ask.

**Supersedes [ADR-0236](0236-forest-flora-counts-observed-automated-tests-not-declared-co.md)**:
the proposed source inventory and exact one-flora-per-runnable-case renderer do not land.
**Amends [ADR-0038](0038-story-world-vocabulary-recalibration.md) /
[ADR-0040](0040-verdict-derived-green-and-the-human-witness-signpost.md)**: the studio forest no
longer renders scenery-only conifers/wheat or the story witness signpost.
**Reaffirms [ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md),
[ADR-0222](0222-split-the-art-factory-into-its-own-story-forest-world-gains.md), and
[ADR-0226](0226-unified-world-art-vegetation-vocabulary-grass-proves-capabil.md)**: the existing
declared-contract input and deterministic surface algorithms remain the accepted flora-density
signal.

## Context

The owner asked whether capability vegetation should literally equal the number of automated tests,
to expose test bloat or an over-engineered capability. ADR-0236 staged a source observer and an exact
1:1 renderer. On the real forest, the `forest-world#render-core` parcel grew 123 flora groups. The
result looked crowded and the tall marks frequently appeared beyond the island coast.

The landed forest-parcels design already carries a truthful, quieter signal. A capability's declared
leaf contracts are its behavioural proof obligations, and each contract is required to name one
isolated automated test. The three designer-authored surfaces translate that count through a
deterministic density algorithm into bounded drift beds. The algorithm is a visual encoding, not a
claim that one SVG group equals one source-level test case. It preserves comparison while leaving
room for the tree, proof markers, and live-work signals.

The same review also confirmed that scenery-only conifers and wheat, plus the awaiting/witnessed
signpost vocabulary, add no useful observability to the studio island.

## Decision

1. **Retain the landed flora input.** `TreeCapability.testCount` remains the parsed
   `## Contracts` count. No test-file provenance parser, static runnable-case inventory,
   tests-versus-contracts comparison, or unavailable-inventory state is added to the tree wire.
2. **Retain algorithmic density.** The meadow, woodland, and heath surface functions continue to
   translate `testCount` through their deterministic, status-aware density budgets and seeded drift
   placement. Flora quantity must remain monotonic for a fixed surface/seed; it is deliberately not
   exact 1:1 and its individual SVG groups are not a numeric legend.
3. **Teach the encoding honestly.** The legend calls the row `test coverage` and explains that flora
   density is a compressed view of declared test contracts. Capability detail keeps the declared
   contract count; it does not present an unobserved source-test total or a bloat score.
4. **Retire scenery-only island marks.** The studio world supplies no conifer decoration or wheat
   tiles. The shared browser-safe render core retains its optional legacy inputs for consumers that
   still provide them.
5. **Retire the witness signpost from the world vocabulary.** The studio fold emits no signpost and
   the legend contains no `awaiting witness` or `witnessed` tiles. Witness assignment, verdicts, and
   signing remain in their detail/proof surfaces; only the redundant island glyph is removed.

## Consequences

**Good.**

- The visually attested drift beds remain calm and readable rather than turning large brownfield
  suites into hundreds of overlapping SVG groups.
- The signal stays honest at its actual semantic boundary: more declared, test-proven behavioural
  obligations produce denser flora, without implying a literal source-test inventory.
- Removing scenery and signposts gives the remaining observability marks more room and makes the
  legend describe only vocabulary still present in the studio world.
- Studio and desktop retain their existing compact tree contract; no file-system scan is added to a
  tree read.

**Limits.**

- The forest does not diagnose low-level test bloat. Source-test totals remain available in test
  runner/reporting surfaces, not encoded on the island.
- Density is ordinal rather than a recoverable exact number. The capability panel is the precise
  source for its contract count.

## References

- [ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md) — tests/proof
  obligations bind to flora.
- [ADR-0222](0222-split-the-art-factory-into-its-own-story-forest-world-gains.md) — the
  `forest-world#render-core` capability floor.
- [ADR-0226](0226-unified-world-art-vegetation-vocabulary-grass-proves-capabil.md) — the existing
  vegetation vocabulary and algorithmic density.
- Arc `forest-parcels-arc` — owner appearance rejection and retained cleanup.
