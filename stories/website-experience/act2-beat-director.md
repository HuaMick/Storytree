---
id: "act2-beat-director"
tier: capability
story: website-experience
title: "The Act 2 beat director — the progressive teaching arc as pure, provable choreography"
outcome: "A pure, deterministic, visitor-paced director in @storytree/forest-world-r3f: beats are typed data (scene delta + camera target + narration key), advance() moves exactly one beat per call and parks on the final CTA state, the world holds MULTIPLE stories (a grow-forest delta raises sibling story-islands each carrying a tri-state status proven/building/broken → green/sapling/withered), a limb may turn green ONLY when its delta carries a signed-proof marker, the wrong-way UI→DB road is flagged as an antipattern from the data — and the exported default script IS the approved progressive arc: the loved single-island opening (plant → wisp → branch → wrong-way road) growing to the full legible forest (neighbor islands rise, inter-story dependency roads draw the cross-story DAG over a genuinely mixed-status forest, pull back to the whole map), walking end-to-end to the CTA."
status: proposed
proof_mode: integration-test
depends_on: [r3f-world-spike]
decisions: [134, 145, 147]
# Node-borne proof config (ADR-0057 keystone). The leaf authors a node:test file against the
# act2-director module and re-builds it red→green at the GROWN scope (ADR-0147): the world now holds
# multiple stories with a tri-state status, a grow-forest delta raises neighbor islands, and the
# default script is the progressive arc. The director stays PURE .ts — beats-as-data in, scene states
# out; no React, no three.js, no timers (visitor-paced means state changes ONLY on advance()) — so it
# is node:test-provable and rides the same sync artifact as the mapper. install: true (it builds World
# fixtures via @storytree/forest-world and the r3f package's own descriptor types) + the typecheck
# wall. The NARRATION COPY is deliberately NOT here: beats carry narration KEYS; the words are
# site-side fictional content (the Cohoot precedent) keyed by beat id — structure/choreography is
# parent-side and provable, words stay with the surface.
proof:
  command:
    file: pnpm
    args: ["--filter", "@storytree/forest-world-r3f", "test"]
  scope:
    testGlobs: ["packages/forest-world-r3f/src/**/*.test.ts"]
    sourceGlobs: ["packages/forest-world-r3f/src/**/*.ts"]
  real:
    editsExisting: true
    testFile: "packages/forest-world-r3f/src/act2-director.test.ts"
    sourceFile: "packages/forest-world-r3f/src/act2-director.ts"
    scope:
      testGlobs: ["packages/forest-world-r3f/src/act2-director.test.ts"]
      sourceGlobs: ["packages/forest-world-r3f/src/act2-director.ts"]
    install: true
    typecheck:
      file: pnpm
      args: ["--filter", "@storytree/forest-world-r3f", "typecheck"]
---

# The Act 2 beat director — the progressive teaching arc as pure, provable choreography

**Outcome —** A pure, deterministic, **visitor-paced** director in `@storytree/forest-world-r3f`:
beats are typed data (scene delta + camera target + narration key), `advance()` moves exactly one beat
per call and parks on the final CTA state, the world holds **MULTIPLE stories** (a `grow-forest` delta
raises sibling story-islands, each carrying a tri-state status `proven` / `building` / `broken` →
green / sapling / withered), a limb may turn green ONLY when its delta carries a signed-proof marker,
the wrong-way UI→DB road is flagged as an antipattern from the data — and the exported default script
IS the **approved progressive arc**: the loved single-island opening (plant → wisp → branch → wrong-way
road) growing to the full legible forest (neighbor islands rise, inter-story dependency roads draw the
cross-story DAG over a genuinely mixed-status forest, pull back to the whole map), walking end-to-end
to the CTA.

**Depends on —** [`r3f-world-spike`](r3f-world-spike.md) — the director lives in the mapper's
package and emits the World / scene inputs the mapper draws.

> **Proof status (honest) — the GROWN progressive-arc scope (ADR-0147) is BUILT and leaf-proven; the
> prior FIVE-beat build stands beneath it as append-only history.** The authored frontmatter status is
> `proposed` (leaf-proven lives in prose, not the frontmatter — `healthy` is earned through the story
> gate, never authored, ADR-0020). The grown re-build: the gated SDK leaf re-authored the director
> through the real prove-it-gate at the grown scope — the test observed RED at HEAD against the
> single-story module (`world.storyId` / the five-beat `defaultScript` — no `grow-forest` delta, no
> `WorldState.stories`, no tri-state `status`), then GREEN across all six contracts once the module grew
> (run `real-mr4gzkfu`, signed PASS @ `8aa8d0f` 2026-07-03, `editsExisting`, persisted to
> `events.verdict` via `--store pg`; package typecheck + suite observed green in the installed
> worktree). `storytree coverage act2-beat-director` reports **6/6** after the coverage-id consolidation
> (`b5bb800`). The two load-bearing thesis contracts (`abd-green-only-on-signed-proof`,
> `abd-wrong-way-road-is-flagged-from-data`) carried through the re-spec VERBATIM.
>
> The prior FIVE-beat build stands as HISTORY, not a claim on the grown scope, and is NOT amended
> (append-only, ADR-0044): the gated SDK leaf authored the NET-NEW director through the real
> prove-it-gate at the five-beat scope — the test observed red at HEAD (module-not-found,
> `act2-director.ts` did not exist), then the pure module green (run `real-mr32b6ib`, signed PASS @
> `2358bc4` 2026-07-02, persisted to `events.verdict`). That five-beat verdict is a true, signed
> historical fact beneath the grown `8aa8d0f` verdict — the re-build proved the grown vocabulary on top
> of it, never replacing it.
>
> Consolidated on top of the five-beat build (already landed, kept as the baseline the re-build grows):
> the `zod` dep (orchestrator glue, a leaf never touches package.json); the exported ZOD contract
> (`BeatScript` / `Beat` / `BeatDelta` / `LimbDelta` / `RoadDelta`) with `advance()` parsing each beat
> before applying it so a green-without-marker limb is REFUSED at runtime (`Beat.parse`; the `LimbDelta`
> refine) — the teaching claims are runtime contracts, not type hints; the named `defaultScript` export
> and the pure director surface re-exported from the root barrel
> (`packages/forest-world-r3f/src/index.ts`); and contract-id-led tests (`storytree coverage
> act2-beat-director`). The progressive arc is APPROVED CONTENT —
> [ADR-0147](../../docs/decisions/0147-act-2-grows-progressively-from-the-loved-single-island-to-th.md)
> (owner-directed 2026-07-03) fixes the grown structure, and the reveal→gripe mapping is
> [docs/research/vibe-coding-coverage-map-2026.md](../../docs/research/vibe-coding-coverage-map-2026.md)
> ("How the walkthrough uses this map"); the choreography is a provable ENGINE proven at the grown
> scope (`8aa8d0f`), rather than ad-hoc site script.

## Guidance

WHY THIS IS A CAPABILITY, NOT A CONTRACT: the beat contract, the advance state machine, and the
default progressive script are one organism — a script player — proven by integration (a full walk of
the real default script through the real state machine), not a single isolated assertion.

THE MODEL. A `Beat` = `{ id, narrationKey, camera, delta }` where `delta` describes what the world
GAINS this beat in the mapper's semantic vocabulary. `DirectorState` = `{ beatIndex, world, camera,
done }`. `advance(state, script)` is a pure function — no timers, no RNG, no auto-play: VISITOR-PACED
is a structural property (state changes only when the visitor's Next-tap calls advance), which is the
deliberate inverse of Act 1's all-at-once (ADR-0134 §3).

THE GROWN WORLD (ADR-0147). The world no longer holds ONE story. `WorldState.stories` is an array of
per-story nodes, each `{ id, label, hasWisp, status, limbs }`, where `status` is one of `proven` /
`building` / `broken` (rendering as green / sapling / withered — the legend the pull-back reads). The
opening beats operate on the FIRST story (the loved single island); the `grow-forest` delta raises
SIBLING stories (neighbor islands), each with its own status, so the forest becomes genuinely mixed —
a proven green story, building saplings, one withered/broken. `plant-story` establishes the first
story (it no longer OVERWRITES — it seeds `stories[0]`); `grow-forest` adds neighbors (upsert by id, so
a beat may raise a neighbor and a later beat may re-state its status). Roads (`add-roads`) already
accept any node id as `from` / `to`, so **inter-story** dependency roads (drawing the cross-story DAG)
reuse the existing road model — no new road mechanism. The withered/broken state is representable at
last, so the pull-back legend is HONEST (previously every story folded to a single amber hue and no
broken state existed — the latent over-claim ADR-0147 fixes).

THE APPROVED PROGRESSIVE ARC (the exported default script — the loved opening growing to the full
forest; each beat teaches a COVERED gripe, cited to
[vibe-coding-coverage-map-2026.md](../../docs/research/vibe-coding-coverage-map-2026.md)):

1. **Plant a story** (`beat-1-plant-story`, KEPT) — a seed grows into a tree with its OUTCOME on a
   label; `stories[0]` is established (intent is a thing on the map, not buried in a chat log —
   *orphaned intent, C-13*).
2. **Watch a wisp** (`beat-2-attach-wisp`, KEPT) — a soft wisp drifts over the first story
   (*babysitting, D-17* — presence without obligation).
3. **It branches** (`beat-3-branch-caps`, KEPT) — capability limbs appear on the first story; a limb
   turns green ONLY on a signed passing proof — the delta for a green limb MUST carry the signed-proof
   marker; a "done"-without-proof delta cannot colour it (*the verification gap, A-1/3/4* — the
   dominant pain; the arc's most load-bearing teach, enforced in data).
4. **Stories connect (the wrong-way road)** (`beat-4-add-roads`, KEPT) — roads draw the first story's
   DAG; one road is the wrong-way UI→DB road skipping the service layer, flagged as an antipattern
   FROM ITS DATA (a declared layer violation), visibly distinct the moment it is drawn (*layer-jumps /
   god-modules / coupling, C-9/11/12* — **NOT duplication**: roads show coupling, not code clones; the
   corpus is silent on clone-detection, coverage-map §C ⚠).
5. **The forest grows** (`beat-5-grow-forest`, NEW) — neighbor stories rise as more islands, each
   already carrying a status (building saplings + a proven green + one withered/broken), so the forest
   is honestly mixed the moment it grows (*comprehension-debt / orphaned architecture at scale, C-13* —
   the whole forest is legible at a glance, not just one tree).
6. **Stories depend on each other** (`beat-6-connect-stories`, NEW) — real inter-story dependency
   roads draw the cross-story DAG between the islands (reusing `add-roads` with story-id endpoints),
   making the coupling and its blast radius visible — a road from the proven story INTO the broken one
   is exactly the blast-radius read (*hidden coupling / blast radius, C-11/12* — still coupling, never
   duplication).
7. **Pull back** (`beat-7-pull-back`, KEPT ROLE, renumbered from `beat-5-pull-back`) — the camera
   widens to the whole legible forest with the green/sapling/withered legend GENUINELY populated (the
   mixed status is real, not uniform amber), session wisps drifting over the live stories, then
   `done: true` — the CTA state (*terminal sprawl, done-vs-in-flight, D-18/19* — the anti-storm,
   framed as the answer to Act 1's HUD).

BEAT-ID DISCIPLINE (ADR-0147). Beats 1–4 keep their ids VERBATIM (they map 1:1 to the loved opening,
and the site's narration wall keys on beat id). The pull-back is RENUMBERED `beat-5-pull-back` →
`beat-7-pull-back` so ids stay position-honest (id number = position); its teaching ROLE is unchanged.
The two new beats take `beat-5-grow-forest` and `beat-6-connect-stories`. The site's narration keys are
renamed in lockstep (a stale key FAILS the build-time coverage wall, so the rename cannot silently
drift). NO beat — old or new — claims storytree answers *duplication* (coverage-map §C ⚠).

WORDS STAY SITE-SIDE. Beats carry `narrationKey`s; the plain-language copy and the fictional story
names live in the web repo keyed by beat id (the fictional-data precedent, ADR-0093 §3/§4). The
exported zod contract is what keeps site-side data honest — the site parses its beat copy against it
at build time.

FENCES: no React, no three.js, no timers/tweens in this module (interpolation is the canvas layer's
job); no live data ever (the diorama is fictional by boundary); do not encode narration STRINGS here.

## Integration test

**Goal —** Prove the real default script (the progressive arc) through the real state machine: the
visitor-paced advance across every beat, the multi-story growth, the tri-state status, the proof-gated
green, the flagged wrong-way road, the CTA park.

1. Walk `advance()` from the initial empty-land state through the full exported default script →
   assert exactly one beat per call, the exact number of steps to `done: true` matching the script
   length, deterministic across two walks (deep-equal states), and no state change without a call
   (visitor-paced structurally).
2. After the `grow-forest` beat → assert `world.stories` holds MULTIPLE stories (the opening's first
   story plus the raised neighbors), each carrying a `status` in `{proven, building, broken}`; assert
   the forest holds all three states at pull-back (the legend is genuinely populated) and that
   `plant-story` established `stories[0]` without a second story overwriting it.
3. After the branch-caps beat → assert the branched limbs' proof states: every green limb's delta
   carried the signed-proof marker; construct a mutated script whose branch-caps delta claims green
   WITHOUT the marker → assert the director refuses it (contract violation), so a faked "done" cannot
   colour the tree even in fiction.
4. After the wrong-way-road beat → assert the road set contains exactly one antipattern-flagged road
   (the UI→DB skip), flagged because its data declares the layer violation — not by id or copy; and
   after the inter-story-roads beat, assert the cross-story roads connect story-id endpoints (the DAG
   between islands) and carry no spurious violation flag.
5. Parse the exported default script with the exported zod contract → assert it validates (the same
   contract the site uses for its narration keys), is exactly the approved progressive-arc beats in
   order (ids `beat-1-plant-story`, `beat-2-attach-wisp`, `beat-3-branch-caps`, `beat-4-add-roads`,
   `beat-5-grow-forest`, `beat-6-connect-stories`, `beat-7-pull-back`), and `advance()` past `done` is
   a no-op (the CTA state parks; no wrap-around).

## Contracts (6)

Each one isolated automated test (`node:test`, the `@storytree/forest-world-r3f` suite). Per
ADR-0122 each contract id leads a distinctly-named test so `storytree coverage act2-beat-director`
reports 6/6.

1. **`abd-advance-is-visitor-paced-and-deterministic`** — one tap, one beat, same walk every time
   - **asserts —** `advance()` moves exactly one beat per call, two walks of the same script are
     deep-equal, state never changes without a call, and past-`done` advances are parking no-ops.
   - **covers —** `packages/forest-world-r3f/src/act2-director.ts`
2. **`abd-green-only-on-signed-proof`** — the verification-gap thesis is a data contract, not copy
   - **asserts —** a limb renders green only when its delta carries the signed-proof marker; a
     green-without-marker delta is refused loudly. (LOAD-BEARING — carried through ADR-0147 verbatim.)
   - **covers —** `packages/forest-world-r3f/src/act2-director.ts`
3. **`abd-wrong-way-road-is-flagged-from-data`** — the antipattern is visible by construction
   - **asserts —** the wrong-way UI→DB road emits an antipattern-flagged road descriptor because its
     data declares the layer violation, distinct from every well-directed road (coupling, NOT
     duplication). (LOAD-BEARING — carried through ADR-0147 verbatim.)
   - **covers —** `packages/forest-world-r3f/src/act2-director.ts`
4. **`abd-forest-grows-multiple-stories`** — the world holds a forest, not one tree
   - **asserts —** `plant-story` establishes the first story without overwriting; a `grow-forest`
     delta raises sibling stories so `WorldState.stories` holds multiple coexisting story nodes (upsert
     by id), and inter-story `add-roads` connects story-id endpoints (the cross-story DAG). This is the
     contract the single-`storyId` model could not hold — the enabler of the progressive expansion.
   - **covers —** `packages/forest-world-r3f/src/act2-director.ts`
5. **`abd-story-status-is-tristate-proven-building-broken`** — the legend is honest
   - **asserts —** a story node carries a `status` of exactly `proven` / `building` / `broken`
     (green / sapling / withered), a raised neighbor can be `broken` (the withered state is
     representable — previously impossible), and a pulled-back forest can hold all three states
     simultaneously, so the pull-back legend is backed by data, not uniform amber.
   - **covers —** `packages/forest-world-r3f/src/act2-director.ts`
6. **`abd-default-script-is-the-approved-progressive-arc`** — the shipped choreography is the approved one
   - **asserts —** the exported default script validates against the exported contract, IS exactly the
     seven approved progressive-arc beats in order (the four kept opening ids, then
     `beat-5-grow-forest`, `beat-6-connect-stories`, `beat-7-pull-back`), grows the forest from one
     island to the full mixed-status map, and walks end-to-end to the CTA (`done: true`). (Renamed from
     `abd-default-script-is-the-five-approved-beats` — the arc is no longer five beats, ADR-0147.)
   - **covers —** `packages/forest-world-r3f/src/act2-director.ts`

## Guidance — the slice that earns the signed verdict

The re-build rung (ADR-0057 §3), growing the five-beat build (`2358bc4`) to the progressive arc:

- **The test —** `packages/forest-world-r3f/src/act2-director.test.ts` (`node:test` +
  `node:assert/strict`). Import `{ advance, initialState, defaultScript, BeatScript }` from
  `"./act2-director.js"`. Name each test for its contract id (`abd-…`). This file ALREADY EXISTS with
  the five-beat tests; author the whole file for the grown scope.
- **⚠ MIGRATE THE CARRIED TESTS, not just add new ones (the whole file must be green).** The three
  carried tests (`abd-advance-…`, `abd-green-only-…`, `abd-wrong-way-road-…`) currently read the
  SINGLE-STORY API — `initialState.world.storyId`, `world.limbs`/`world.roads` at the top level, the
  five-beat `defaultScript`. Growing `WorldState` to `stories: StoryNode[]` REMOVES `world.storyId` and
  moves limbs/status onto each story node, so those carried tests fail at runtime (tsx strips types —
  `world.storyId` becomes `undefined` and the assertion throws) and reds the whole proof. UPDATE every
  carried test to the multi-story API (read the first story via `world.stories[0]`) in the SAME
  AUTHOR_TEST pass, alongside the three new tests. A green requires ALL SIX contract tests passing
  against the grown module — a leftover single-story assertion is the trap that keeps the proof red.
- **The RED the spine observes —** at the grown scope: the tests naming the new contracts
  (`abd-forest-grows-multiple-stories`, `abd-story-status-is-tristate-proven-building-broken`) fail at
  HEAD because the five-beat module has no `grow-forest` delta, no `WorldState.stories`, and no tri-state
  `status` yet (the assertions cannot pass against the single-story model); the migrated carried tests
  fail too (they read `world.stories`, absent at HEAD).
- **The GREEN —** grow the pure module: `WorldState.stories: StoryNode[]` (each `{ id, label, hasWisp,
  status, limbs }`), the `status` enum, the new `grow-forest` delta kind (upsert-by-id), `plant-story`
  seeding `stories[0]` instead of overwriting (and `attach-wisp` / `branch-caps` operating on the
  first story so the opening beats still work), `initialState.world` seeding `{ stories: [], roads: [] }`,
  and the exported `defaultScript` rewritten as the seven-beat progressive arc. Iterate edit →
  `run_proof` until ALL tests pass — do NOT stop while `run_proof` is red. After it, the package suite +
  typecheck stay green; the artifact reaches the site through `web-experience-sync` unchanged.

Rules:

- **Pure and visitor-paced by construction** — no timers, no auto-play, no RNG in this module.
- **The teaching claims are contracts** — proof-gated green and the flagged wrong-way road live in the
  data model (carried through the re-spec verbatim), so the site cannot accidentally ship a diorama
  that contradicts the thesis; and no beat claims duplication (coverage-map §C ⚠).
- **The withered state is real, not decorative** — a `broken` story status must be representable and
  reachable via `grow-forest`, so the pull-back legend is honest.
- **Keys, not copy** — narration text never enters the parent package.
- **The mapper's vocabulary is the interface** — deltas speak scene-semantics (`kind` / status /
  road / story), never pixels.
