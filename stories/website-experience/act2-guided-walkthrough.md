---
id: "act2-guided-walkthrough"
tier: capability
story: website-experience
title: "Act 2 — the visitor-paced five-beat walkthrough grows the legible forest to the CTA"
outcome: "On the calm land, an auto-guided, VISITOR-PACED walkthrough (one Next-tap per beat, plain language — the tonal inverse of Act 1) grows the fictional forest through the five approved beats over the synced director + R3F mapper: plant a story (outcome on a label) → watch a wisp (presence without obligation) → it branches (limbs green ONLY on signed proof) → stories connect (roads, the wrong-way UI→DB road visibly flagged) → pull back (one legible forest: green = proven, sapling = in-progress, withered = broken) → the CTA to the real product — a stylized teaching diorama over fictional data, never the operable studio."
status: proposed
proof_mode: operator-attested
depends_on: [storm-to-forest-inflection, act2-beat-director, web-experience-sync]
decisions: [134]
# OPERATOR-ATTESTED (ADR-0070) — web-repo work. The choreography ENGINE is already machine-proven
# upstream (act2-beat-director: visitor-paced advance, proof-gated green, the flagged wrong-way
# road, the approved default script — all parent-side contracts), and the artifact freshness is the
# extended check:web-engine's job. What THIS capability owns is the experienced surface: the
# narration copy (site-side, plain language, keyed by beat id against the director's exported zod
# contract), the camera/interpolation feel, the Next affordance, and whether each beat TEACHES its
# concept to a non-expert — irreducibly human judgements on the real site. NO `proof:` block —
# witnessed, not `--real`-built.
---

# Act 2 — the visitor-paced five-beat walkthrough grows the legible forest to the CTA

**Outcome —** On the calm land, an auto-guided, **VISITOR-PACED** walkthrough (one Next-tap per
beat, **plain language** — the tonal inverse of Act 1's jargon) grows the fictional forest through
the five approved beats over the synced director + R3F mapper, ending on the **CTA** to the real
product — a stylized teaching diorama over fictional data, never the operable studio.

**Depends on —** [`storm-to-forest-inflection`](storm-to-forest-inflection.md) — the land it grows
on; [`act2-beat-director`](act2-beat-director.md) — the script it walks;
[`web-experience-sync`](web-experience-sync.md) — the artifact rail both ride to the site.

> **Proof status (honest) — `proposed`, operator-attested (ADR-0070).** The teaching claims are
> deliberately NOT left to this attestation: "green only on signed proof" and "the wrong-way road
> is flagged" are DATA CONTRACTS the parent spine already holds in `act2-beat-director` — the site
> cannot walk a script that contradicts the thesis. What a human must witness is what remains:
> does each beat land its concept, in plain words, at one tap of effort — the felt calm ADR-0134
> stakes the pitch on.

## Guidance

THE SURFACE (owner decisions 2026-07-02, decision 4 — the spec of the feel):

- **Visitor-paced, auto-guided.** The walkthrough proposes; the visitor disposes — one Next-tap
  advances one beat (the director's structural guarantee), nothing auto-plays past the visitor. The
  deliberate inverse of Act 1's all-at-once: same single gesture, opposite outcome. A Back
  affordance is welcome; auto-advance is a design violation, not a tweak.
- **Plain language.** The narration never uses insider vocabulary without showing it: say "a
  promise of what this piece will do" while the label appears, then name it a story. Site-side copy
  keyed by beat id, validated against the director's exported zod contract at build time — copy can
  be rewritten freely without touching the proven engine.
- **The five beats teach by watching, one concept each** (the research-table rows, verbatim in
  spirit): the seed→tree with the OUTCOME ON A LABEL answers orphaned intent; the drifting wisp
  answers babysitting (presence without obligation — the visitor does nothing and that is the
  point); the branch beat answers the verification gap (a limb greens only as a SIGNED PROOF lands
  — narrate exactly that); the roads beat answers illegible architecture (the wrong-way UI→DB road
  skipping the service layer appears visibly flagged the moment it is drawn); the pull-back answers
  terminal sprawl (one calm screen: green = proven, sapling = in-progress, withered = broken —
  the anti-storm, framed as the answer to Act 1's HUD).
- **The CTA ends it.** The final state offers the real product (get-involved / the repo / the
  studio pitch — per `info-pages-triage`'s outcome), honestly labelled: this was a diorama; the
  real thing is watched-live.
- **Diorama, not studio.** All data fictional (site-side, the Cohoot precedent); no live store, no
  real corpus, no operable affordances beyond the walkthrough — the boundary
  (ADR-0056/0066/0093) holds by construction because the site only HAS the synced artifacts.
- **Increment coherence.** Beats may land incrementally (the director is data-driven): each merge
  ships a complete-so-far arc that still ends on the CTA — never a dead-end Next.

BUILD SHAPE: `storytree-web` repo work on its own rail, `frontend-builder` driving; the canvas layer
interpolates between the director's discrete states (camera tweens, growth animations) — motion is
the site's job, STATE is the proven engine's.

## UAT (operator-attested)

1. **The pacing inverts the storm.** _(witness: human)_ From the empty land, the walkthrough
   advances ONLY on Next — five taps, five beats, no auto-play; effort never exceeds one tap.
2. **Each beat lands its concept.** _(witness: human)_ A non-expert reader can say back, per beat:
   intent lives on the map; I can see it working without watching it; green means proven, not
   claimed; that road is wrong and I can see why; the whole thing fits on one calm screen.
3. **The thesis moments read.** _(witness: human)_ The limb visibly greens WITH the signed-proof
   narration (never before); the wrong-way UI→DB road is instantly distinguishable from the good
   roads; the pull-back forest is legible at a glance (green / sapling / withered).
4. **The CTA closes honestly.** _(witness: human)_ The arc ends offering the real product, plainly
   labelled as the step out of the diorama; no beat dead-ends.
