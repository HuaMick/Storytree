---
id: "act2-guided-walkthrough"
tier: capability
story: website-experience
title: "Act 2 — the visitor-paced walk opens on the loved single island and grows to the full legible forest"
outcome: "On the calm land, an auto-guided, VISITOR-PACED walkthrough (one Next-tap per beat, plain language — the tonal inverse of Act 1) OPENS on the loved single island (one story on one island — the non-overwhelming opening kept intact) and then GROWS PROGRESSIVELY to the full legible forest map ON THE REAL 2.5D MAP — the synced buildScene scene graph rendered as the site's SVG (ADR-0145), representative of the actual product — narrated by game-tutorial CALLOUT BOXES anchored to the exact map element each beat teaches, each reveal teaching a COVERED gripe: plant a story (intent on a label) → watch a wisp (presence without obligation) → it branches (limbs green ONLY on signed proof) → the wrong-way UI→DB road (coupling, visibly flagged, NOT duplication) → the forest grows (neighbor story-islands rise) → stories depend on each other (real inter-story roads draw the cross-story DAG over a genuinely mixed-status forest) → pull back (one legible forest: green = proven, sapling = in-progress, withered = broken, session wisps drifting) → the CTA to the real product — a stylized teaching diorama over fictional data, never the operable studio (ADR-0147)."
status: proposed
proof_mode: operator-attested
depends_on: [storm-to-forest-inflection, act2-beat-director, web-experience-sync]
decisions: [134, 145, 147]
# OPERATOR-ATTESTED (ADR-0070) — web-repo work. The choreography ENGINE is machine-proven upstream
# (act2-beat-director: visitor-paced advance, proof-gated green, the flagged wrong-way road, the
# multi-story grow-forest + tri-state status, the approved progressive default script — all
# parent-side contracts, re-built at the grown scope per ADR-0147), and the artifact freshness is the
# extended check:web-engine's job. What THIS capability owns is the experienced surface: the narration
# copy (site-side, plain language, keyed by beat id against the director's exported zod contract), the
# anchored-callout + map-motion feel, the Next affordance, the progressive grow-to-full-forest reveal,
# and whether each beat TEACHES its concept to a non-expert — irreducibly human judgements on the real
# site. NO `proof:` block — witnessed, not `--real`-built.
---

# Act 2 — the visitor-paced walk opens on the loved single island and grows to the full legible forest

**Outcome —** On the calm land, an auto-guided, **VISITOR-PACED** walkthrough (one Next-tap per beat,
**plain language** — the tonal inverse of Act 1's jargon) **opens on the loved single island** (one
story on one island — the non-overwhelming opening kept intact) and then **grows progressively to the
full legible forest map on the real 2.5D map** — the synced `buildScene` scene graph rendered as the
site's SVG
([ADR-0145](../../docs/decisions/0145-act-2-walks-the-real-2-5d-map-the-r3f-forest-retreats-to-far.md)),
so the visitor watches something representative of the actual product — narrated by **callout boxes
anchored to the exact map element each beat teaches**, each reveal teaching a **covered gripe**
([ADR-0147](../../docs/decisions/0147-act-2-grows-progressively-from-the-loved-single-island-to-th.md)),
ending on the **CTA** to the real product — a stylized teaching diorama over fictional data, never the
operable studio.

**Depends on —** [`storm-to-forest-inflection`](storm-to-forest-inflection.md) — the land it grows
on; [`act2-beat-director`](act2-beat-director.md) — the (grown) script it walks;
[`web-experience-sync`](web-experience-sync.md) — the artifact rail both ride to the site.

> **Proof status (honest) — `proposed`, operator-attested (ADR-0070).** The teaching claims are
> deliberately NOT left to this attestation: "green only on signed proof", "the wrong-way road is
> flagged", "the forest holds a genuinely mixed status (proven/building/broken)" are DATA CONTRACTS
> the parent spine holds in `act2-beat-director` (re-built at the grown scope, ADR-0147) — the site
> cannot walk a script that contradicts the thesis, and cannot fold a withered story the director's
> data does not carry. What a human must witness is what remains: does each beat land its concept, in
> plain words, at one tap of effort — the felt calm ADR-0134 stakes the pitch on — AND does the walk
> keep the loved non-overwhelming opening while growing to a legible full forest (not a second storm).
>
> **Attestation history (append-only, ADR-0044):** a first build (the five beats over the R3F 3D
> island, per ADR-0134 §3's original tech note) reached its owner gate 2026-07-03 with the machine
> floor green (61-check Playwright witness; storytree-web draft PR #20, closed superseded) and was
> **refused at stage 2** — the owner re-decided the substrate onto the real 2.5D map with
> anchored-callout narration
> ([ADR-0145](../../docs/decisions/0145-act-2-walks-the-real-2-5d-map-the-r3f-forest-retreats-to-far.md)).
> A single-island rebuild on the 2.5D map (the five kept beats) is staged in storytree-web draft
> **PR #22**, awaiting the appearance gate. At/around that gate the owner further directed the
> PROGRESSIVE EXPANSION (2026-07-03,
> [ADR-0147](../../docs/decisions/0147-act-2-grows-progressively-from-the-loved-single-island-to-th.md)):
> keep PR #22's loved single-island opening and grow it to the full forest. The `frontend-builder`
> builds the expansion ON TOP OF PR #22's baseline; the walkthrough HALT stands until the grown walk
> is attested.

## Guidance

THE SURFACE (owner decisions 2026-07-02 + the 2026-07-03 re-decisions, ADR-0145 substrate + ADR-0147
progressive growth — the spec of the feel):

- **The real 2.5D map (ADR-0145).** The forest renders on the synced `buildScene` scene graph as the
  site's 2.5D SVG — the `worldSvg`/`TreeWorld` rail the home map already rides — NOT the R3F 3D island
  (the product IS 2.5D; 3D stays far-future). Act 1 and the storm→land inflection stay exactly as
  built and attested — including the R3F-mounted landing moment if that is what the transition rides —
  and how the landing hands off to the 2.5D walk is this capability's design seam to resolve
  gracefully; the owner gate judges the result.
- **Open minimal, grow to the full forest (ADR-0147) — the core of the re-spec.** The walk OPENS on
  the loved single island (one story on one island) so the visitor is never overwhelmed at the start
  — the owner's non-overwhelming opening is kept INTACT. Then it grows PROGRESSIVELY: each later beat
  reveals more of storytree's real UI vocabulary (more story-islands, real inter-story dependency
  roads, the genuinely-populated status legend, session wisps) until the visitor is looking at one
  whole legible forest. The expansion is strictly ADDITIVE — it never re-introduces overwhelm; the
  single island is the on-ramp, the full forest is the destination.
- **Visitor-paced, auto-guided.** The walkthrough proposes; the visitor disposes — one Next-tap
  advances one beat (the director's structural guarantee), nothing auto-plays past the visitor. The
  deliberate inverse of Act 1's all-at-once: same single gesture, opposite outcome. A Back affordance
  is welcome; auto-advance is a design violation, not a tweak.
- **Anchored callouts, plain language.** The narration appears in game-tutorial **callout boxes
  anchored next to the actual map element** each beat teaches — the callout points to exactly where
  the eyes should go and talks to that item — never a fixed panel the visitor must read at the bottom.
  The copy never uses insider vocabulary without showing it: say "a promise of what this piece will
  do" while the label appears, then name it a story. Site-side copy keyed by beat id, validated
  against the director's exported zod contract at build time — copy can be rewritten freely without
  touching the proven engine. **The keys grow with the arc:** the four kept opening beats keep their
  ids/keys verbatim; the pull-back key is renamed to its new final id; the two new beats
  (`beat-5-grow-forest`, `beat-6-connect-stories`) get new keys — a stale/orphaned key FAILS the
  build-time coverage wall, so the lockstep is enforced.
- **Each reveal teaches ONE covered gripe** (from the menu,
  [vibe-coding-coverage-map-2026.md](../../docs/research/vibe-coding-coverage-map-2026.md) "How the
  walkthrough uses this map"):
  - **plant a story** → *orphaned intent / comprehension debt (C-13)* — the OUTCOME on a label; intent
    is a thing on the map, not buried in a chat log.
  - **watch a wisp** → *babysitting / botsitting (D-17)* — presence without obligation; the visitor
    does nothing and that is the point.
  - **it branches (green only on signed proof)** → *the verification gap (A-1/3/4)* — **the dominant
    pain, the arc's most load-bearing teach**; a limb greens only as a SIGNED PROOF lands (narrate
    exactly that).
  - **the wrong-way road** → *layer-jumps / god-modules / coupling (C-9/11/12)* — the wrong-way UI→DB
    road skipping the service layer appears visibly flagged the moment it is drawn. **NOT duplication**
    (coverage-map §C ⚠ — roads show coupling, not code clones; the corpus is silent on clone-detection,
    so the copy must never imply storytree answers duplication).
  - **the forest grows** *(NEW)* → *orphaned architecture at scale / comprehension debt (C-13)* —
    neighbor story-islands rise; the whole forest is legible at a glance, not just one tree.
  - **stories depend on each other** *(NEW)* → *hidden coupling / blast radius (C-11/12)* — real
    inter-story dependency roads draw the cross-story DAG, and the forest now reads as genuinely mixed
    status (a proven green story, building saplings, one withered/broken); a road from the proven story
    into the broken one is the blast-radius read. Still coupling, **never duplication**.
  - **pull back** → *terminal sprawl / done-vs-in-flight (D-18/19)* — one calm screen: green = proven,
    sapling = in-progress, withered = broken (the legend GENUINELY populated now — not uniform amber),
    session wisps drifting over the live stories — the anti-storm, framed as the answer to Act 1's HUD.
- **The CTA ends it.** The final state offers the real product (get-involved / the repo / the studio
  pitch — per `info-pages-triage`'s outcome), honestly labelled: this was a diorama; the real thing is
  watched-live.
- **Diorama, not studio.** All data fictional (site-side, the Cohoot precedent); no live store, no
  real corpus, no operable affordances beyond the walkthrough — the boundary (ADR-0056/0066/0093)
  holds by construction because the site only HAS the synced artifacts.
- **Increment coherence.** Beats may land incrementally (the director is data-driven): each merge
  ships a complete-so-far arc that still ends on the CTA — never a dead-end Next. The single-island
  opening (PR #22) is itself a coherent complete-so-far arc; the expansion adds beats on top.

BUILD SHAPE: `storytree-web` repo work on its own rail, `frontend-builder` driving, **building the
progressive expansion ON TOP OF PR #22's single-island baseline** (the loved opening, on the 2.5D
map). The map layer folds each `DirectorState.world` (now holding MULTIPLE stories with per-story
status) into a fresh `SceneInput` → the synced `buildScene` → the site's 2.5D SVG: the fold expands to
place multiple story-islands + inter-story roads + mixed-status trees (the fold reads the tri-state
`status` the grown director carries — the withered tree is real, not a hardcoded amber). Map motion
(viewBox tweens, growth transitions, callout placement from per-element `data-id` geometry) is the
site's job; STATE is the proven engine's. The FICTION (the demo stories, their labels, the neighbor
story names, all narration copy) stays site-owned.

## UAT (operator-attested)

1. **The pacing inverts the storm, and the opening stays non-overwhelming.** _(witness: human)_ From
   the empty land, the walkthrough advances ONLY on Next — one tap per beat, no auto-play; effort never
   exceeds one tap. The OPENING is the loved single island (one story on one island) — the visitor is
   never overwhelmed at the start; the forest grows only as the walk proceeds.
2. **Each opening beat lands its concept.** _(witness: human)_ Guided by a callout anchored to the
   element being taught, a non-expert reader can say back, per opening beat: intent lives on the map; I
   can see it working without watching it; green means proven, not claimed; that road is wrong and I
   can see why (a coupling/layer shortcut — the copy never claims it is about duplicated code).
3. **The forest grows legibly, without a second storm.** _(witness: human)_ After the opening, neighbor
   story-islands rise and real dependency roads draw BETWEEN stories — the visitor watches the map grow
   from one island to many and can read the growth as more of one coherent forest, NOT as a return to
   Act 1's overwhelm. The new beats each land a concept for a non-expert: more stories fit on one map;
   stories that depend on each other show their coupling and blast radius (a road from a proven story
   into a broken one).
4. **The thesis moments read.** _(witness: human)_ The walk happens on the real 2.5D map (the product's
   own look); the limb visibly greens WITH the signed-proof narration (never before); the wrong-way
   UI→DB road is instantly distinguishable from the good roads; the inter-story roads read as the
   cross-story DAG.
5. **The pull-back forest is legible at a glance, and the legend is genuinely populated.** _(witness:
   human)_ At full pull-back the whole forest reads at a glance with the green / sapling / withered
   legend TRULY backed by the map — there is at least one proven (green) story, building (sapling)
   stories, and a withered (broken) story actually present (not a uniform amber forest under a
   three-state legend); session wisps drift over the live stories — the anti-storm, one quiet view of
   everything that matters.
6. **The CTA closes honestly.** _(witness: human)_ The arc ends offering the real product, plainly
   labelled as the step out of the diorama; no beat dead-ends.
