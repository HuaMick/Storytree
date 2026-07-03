---
status: accepted
decided: 2026-07-03
amends: [134, 145]
---
# ADR-0147: Act 2 grows progressively from the loved single island to the full forest map

## Status

accepted (2026-07-03) — decided/directed by the owner in conversation on 2026-07-03. Design-time
alignment IS the ratification ([ADR-0110](0110-collapse-the-redundant-end-of-flow-adr-ratification.md));
no second end-of-flow ask.

Amends [ADR-0134](0134-public-website-as-a-two-act-vibe-coding-experience-terminal.md) (re-decides
§3's "five approved beats" — the Act 2 spine grows from five to a longer progressive arc) and
[ADR-0145](0145-act-2-walks-the-real-2-5d-map-the-r3f-forest-retreats-to-far.md) (extends its 2.5D
substrate — the substrate STANDS unchanged; only the beat structure grows on it). This is a NEW ADR,
not an in-place edit of 134/145 (copy-on-write, ADR-0086/0139): their bodies stay as history, with a
dated forward pointer added at each amended point.

## Context

Act 2 of the public site (ADR-0134) is a visitor-paced guided walkthrough that grows a fictional
forest to a CTA, tonally inverting Act 1's storm — one Next-tap per beat, plain language. ADR-0145
re-decided its SUBSTRATE onto the real 2.5D map (the synced `buildScene` scene-graph rendered as the
site's SVG, the product's own look) with anchored-callout narration, retiring the R3F 3D island to
far-future. That single-island walk — one story on one island through the **five approved beats**
(plant-story → wisp → branch-caps → wrong-way-road → pull-back → CTA) — is staged in storytree-web
draft PR #22, awaiting the owner's ADR-0070 stage-2 appearance gate.

The owner LIKES the single-island opening — verbatim, *"this makes it such that we dont overwhelm the
user"* — and at the same time directed an EXPANSION (2026-07-03, in conversation):

> the walk should **expand slowly to the full forest map as the tutorial goes, adding more of our UI
> elements until the visitor has a full forest map** — open minimal (one story on one island — KEEP
> the non-overwhelming opening intact), then each later beat reveals MORE real UI vocabulary: more
> story-islands, the real dependency roads BETWEEN stories, the status legend green/sapling/withered,
> session wisps, the pull-back to one whole legible forest. Each revealed element must TEACH a gripe
> storytree answers.

The forces:

1. **The loved opening must not be lost.** The reason the single island works is that it does not
   overwhelm a non-expert — the whole pitch (chaos → calm) collapses if Act 2 re-introduces overwhelm.
   So the expansion is strictly ADDITIVE: beats 1–4 stay the loved opening, verbatim in role, and the
   forest grows only AFTER them.

2. **Growing to a multi-island forest with real inter-story roads cannot be done site-side alone.**
   The proven beat director (`stories/website-experience/act2-beat-director.md`, the LEAF cap,
   `--real`-built @ `2358bc4`) holds the STATE that the site folds into the scene: its `WorldState`
   holds a **single** `storyId: string`, and its `plant-story` delta REPLACES it — a second story
   would overwrite the first. The beat VOCABULARY (the director's typed data model) has to grow, and
   that is parent-side work, provable through the `act2-beat-director` leaf. The site (the LOOK cap,
   `act2-guided-walkthrough.md`) owns only the FICTION and the fold; it cannot grow the forest past
   what the director's state can hold.

3. **The pull-back legend is a latent over-claim today.** The site's fold currently collapses every
   story's status to a single amber `'proposed'` hue and never folds `'healthy'` (honest — the
   fiction proves one CAPABILITY's green, not a whole story's) — and there is no representation of a
   `withered`/`broken` story anywhere in the director's data model. So a pull-back narrating "green =
   proven, sapling = in-progress, withered = broken" over a forest that is uniformly amber is a claim
   the data cannot back. The expansion is the moment to make the legend HONEST: a grown forest that
   genuinely holds all three states.

4. **Each new reveal must teach a COVERED gripe — no over-claim.** The gripe-mapping menu is
   [`docs/research/vibe-coding-coverage-map-2026.md`](../research/vibe-coding-coverage-map-2026.md)
   (its final section "How the walkthrough uses this map" pre-maps each reveal → the covered row it
   teaches). Its §C carries an explicit ⚠ flag: **beat 4 (the wrong-way road) must NOT claim it
   answers *duplication*** — roads show *coupling and layer-jumps*, not code clones; the corpus is
   silent on clone-detection (verified against `storytree adr list --load-bearing` / `--current`), so
   any duplication claim would be an over-claim the mechanism cannot back. The expansion's new roads
   (inter-story dependency roads) teach hidden coupling / blast-radius — still coupling, still NOT
   duplication.

This decision is design-time-ratified (the owner directed it in conversation, ADR-0110) — it is NOT
a fork to re-escalate. It fixes the HIERARCHY the direction implies: the grown director vocabulary
(the leaf) and the grown experienced walk (the LOOK), each honest at its tier.

## Decision

**Act 2 grows progressively from the loved single island to the full legible forest map.** The walk
opens minimal — one story on one island, the ADR-0134/0145 opening kept intact — then each later beat
reveals more of storytree's real UI vocabulary, until the visitor is looking at a whole legible
forest. Every revealed element teaches a *covered* gripe from the coverage-map menu.

1. **The opening is preserved verbatim in role (beats 1–4).** Plant a story (orphaned intent) → watch
   a wisp (babysitting) → it branches, green only on signed proof (the verification gap — THE teach) →
   the wrong-way road (layer-jumps / coupling — **not** duplication). These four beats keep their
   stable ids and their teaching roles; the non-overwhelming opening the owner loves is untouched.

2. **The forest then grows (new beats).** After the opening, neighbor stories rise as more islands
   (comprehension-debt / orphaned-architecture at scale, coverage-map C-13); real dependency roads
   draw the cross-story DAG BETWEEN stories and the forest now shows genuinely mixed status — a proven
   green story, building saplings, one withered/broken (hidden coupling / blast-radius, C-11/12); then
   the camera pulls all the way back to one legible forest with the green/sapling/withered legend
   **genuinely populated**, session wisps drifting over live stories (terminal sprawl, done-vs-
   in-flight — the anti-storm, D-18/19) → the CTA.

3. **The director's vocabulary grows (the LEAF re-spec).** The `act2-beat-director` capability is
   re-specced and re-built red→green at the grown scope. `WorldState` holds MULTIPLE stories (a
   `stories` array of per-story nodes each carrying `{ id, label, hasWisp, status, limbs }`) instead
   of one `storyId`; a NEW `grow-forest` delta kind adds sibling stories (each with a status) so the
   forest grows beat by beat; a three-state story STATUS (`proven` / `building` / `broken` →
   green / sapling / withered) makes the pull-back legend honest (the withered state is representable
   at last); and the exported `defaultScript` becomes the full progressive arc walking end-to-end to
   the CTA. The two load-bearing thesis contracts — **green-limb-requires-signed-proof** and
   **wrong-way-road-flagged-from-DATA** — are PRESERVED verbatim; inter-story roads reuse the existing
   `add-roads` road model (a road already accepts any node id as `from`/`to`), so no new road
   mechanism is introduced.

4. **The 2.5D substrate STANDS (ADR-0145 extended, not re-decided).** The walk still renders on the
   synced `buildScene` scene-graph as the site's 2.5D SVG; still visitor-paced (one Next-tap per beat,
   no auto-play); still anchored-callout narration in plain language; the fiction and words stay
   site-owned (narration keyed by beat id). What grows is the beat STRUCTURE on that substrate, not
   the substrate.

5. **Act 1 and the storm→land inflection are explicitly UNTOUCHED.** This decision changes only Act 2.
   Act 1 (`act1-terminal-storm`, the diegetic terminal storm and its finale rework), the inflection
   (`storm-to-forest-inflection`, the transform into the calm land + the R3F-island landing moment),
   and the "one calm gesture per act — same input, opposite outcome" thesis are unchanged.

6. **Honesty rules on the reveals.** Every new reveal maps to a *covered* row of the coverage map
   (cited above). Beat 4 stays coupling-only; no beat — old or new — claims storytree answers
   *duplication* / code-clone detection (corpus-silent; the coverage map's §C ⚠ over-claim flag). The
   walk, made watchable, IS the coverage map's *covered* side; the gaps (security, slopsquatting,
   duplication, the out-of-domain rows) are exactly what the walk deliberately does NOT show.

The gripe-mapping source of record for which reveal teaches which gripe is
[`docs/research/vibe-coding-coverage-map-2026.md`](../research/vibe-coding-coverage-map-2026.md)
("How the walkthrough uses this map (feeds Phase 2)").

## Consequences

**Good.**

- The pitch keeps its non-overwhelming front door AND ends on the full-forest payoff the product is
  actually about — the single island is the on-ramp, the full forest is the destination.
- The pull-back legend becomes HONEST: a grown forest genuinely holds proven/building/broken, so
  "green = proven, sapling = in-progress, withered = broken" is a claim the data now backs. The latent
  over-claim (uniform amber under a three-state legend) is retired.
- The thesis moments the whole pitch rests on (green-only-on-signed-proof; the flagged wrong-way road)
  stay parent-side DATA CONTRACTS the spine holds — the grown walk still cannot ship a diorama that
  contradicts the thesis.
- The proof model is unchanged: the LEAF re-builds red→green through the real prove-it-gate at the
  grown scope (the prior `2358bc4` build stands as history; the re-build proves the grown vocabulary),
  and the LOOK stays ADR-0070 operator-attested (appearance and feel are never self-signed).

**Costs / risks (named).**

- The `act2-beat-director` exported contract CHANGES shape (`WorldState.storyId: string` →
  `WorldState.stories: StoryNode[]`; a new `grow-forest` delta kind; a story `status` field). This is
  a breaking change to the synced artifact the site consumes: the site's `walkthroughScript` (the
  fiction) and `foldWorldToScene` (the fold) must grow in lockstep (the `frontend-builder`'s job on
  storytree-web, on top of PR #22's baseline). The build-time narration wall (`act2-validate`) and the
  `check:web-engine` drift gate catch a stale fold or an orphaned narration key, so the lockstep is
  enforced, not hoped.
- The beat ids grow and the pull-back beat is RENUMBERED to its new final position (beats 1–4 keep
  their ids verbatim; the pull-back moves from `beat-5-…` to the final `beat-7-…`). The site's
  narration wall keys on beat id, so the corresponding site-side narration key is renamed in lockstep;
  a stale key FAILS `astro build` (exact-coverage wall), so the rename cannot silently drift. Beat ids
  stay position-honest (id number = position) — the deliberate call over leaving an id that says "5"
  in the 7th slot.
- A longer walk is more taps before the CTA. Mitigation: the beat COUNT is the owner's to tune at the
  ADR-0070 stage-2 gate — the director is data-driven, so the arc can be lengthened or shortened
  without re-proving the engine; and each merge still leaves a complete-so-far arc ending on the CTA
  (never a dead-end Next).
- The expansion does NOT close any coverage GAP (security, slopsquatting, duplication) — those stay
  owner-review items on the coverage map. The walk teaches only the covered side; this decision does
  not change what storytree does or doesn't answer.

**Unchanged (explicit).** Act 1, the storm→land inflection, the 2.5D substrate (ADR-0145), the
visitor-paced/Next-only pacing, the anchored-callout narration, the plain-language voice, the fictional
site-owned data (the boundary, ADR-0056/0066/0093), the two thesis data-contracts, and the ADR-0070
two-stage proof for the LOOK. Only Act 2's beat STRUCTURE grows.

## References

- [ADR-0134](0134-public-website-as-a-two-act-vibe-coding-experience-terminal.md) — the two-act
  experience concept; §3's "five approved beats" is what this ADR re-decides into a progressive arc
  (amended, not superseded — the concept stands; the beat count grows).
- [ADR-0145](0145-act-2-walks-the-real-2-5d-map-the-r3f-forest-retreats-to-far.md) — Act 2 walks the
  real 2.5D map; this ADR EXTENDS that substrate (the substrate stands; the beat structure grows on it).
- [ADR-0110](0110-collapse-the-redundant-end-of-flow-adr-ratification.md) — design-time alignment IS
  ratification (this ADR is born `accepted`, owner-directed 2026-07-03).
- [ADR-0070](0070-frontend-as-an-inner-loop-role-the-two-stage-proof-for-visua.md) — the two-stage
  proof for visual surfaces; the LOOK's grown scope is still operator-attested, never self-signed.
- [ADR-0020](0020-red-green-enforcement-on-the-owned-loop.md) — red→green enforcement; the LEAF
  re-builds red→green at the grown scope; `healthy` is earned through the gate, never authored.
- [ADR-0122](0122-per-contract-coverage-check-map-each-declared-contract-to-an.md) — per-contract
  coverage (one substantive test per declared contract id — the grown contract list drives the leaf's
  re-build tests).
- [`docs/research/vibe-coding-coverage-map-2026.md`](../research/vibe-coding-coverage-map-2026.md) —
  the gripe-mapping menu: each reveal → the covered row it teaches, and the §C ⚠ beat-4
  non-duplication honesty this ADR records.
- [`stories/website-experience/story.md`](../../stories/website-experience/story.md) — the story this
  arc lives in.
- [`stories/website-experience/act2-beat-director.md`](../../stories/website-experience/act2-beat-director.md)
  — the LEAF cap re-specced by this decision (the grown director vocabulary).
- [`stories/website-experience/act2-guided-walkthrough.md`](../../stories/website-experience/act2-guided-walkthrough.md)
  — the LOOK cap re-specced by this decision (the grown experienced walk).
