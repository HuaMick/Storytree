---
id: "storm-to-forest-inflection"
tier: capability
story: website-experience
title: "The inflection — one calm tap transforms the storm into soil and wakes the 3D land"
outcome: "At peak overload the storm dims and ONE calm storytree affordance appears amid the noise; a single click TRANSFORMS rather than navigates — the terminals fall silent, collapse, and their fragments drop into the ground as soil — while the R3F bundle lazy-loads behind the exhale (ssr:false, dynamic import only), and silence resolves into the calm, EMPTY 3D land the walkthrough will grow on."
status: proposed
proof_mode: operator-attested
depends_on: [act1-terminal-storm, web-experience-sync]
decisions: [134, 123]
# OPERATOR-ATTESTED (ADR-0070) — web-repo work; the transform is a felt, choreographed moment no
# machine can honestly judge. Its machine floor lives upstream: `check:web-experience` holds the
# lazy-load wall (the R3F island is reachable from Act 1 ONLY behind a dynamic import — a static
# chain reds the gate), and the extended `check:web-engine` holds that the R3F island it mounts is
# the byte-fresh synced artifact. NO `proof:` block — witnessed, not `--real`-built. This is also
# the FIRST mount of the R3F island on the public site (client-only, non-SSR, ADR-0123 §3): the
# island mount is deliberately FOLDED INTO this capability rather than split out, because the
# inflection IS the moment the island enters the experience — an island mounted anywhere else would
# violate the no-WebGL-in-Act-1 wall.
---

# The inflection — one calm tap transforms the storm into soil and wakes the 3D land

**Outcome —** At peak overload the storm dims and ONE calm storytree affordance appears amid the
noise; a single click **TRANSFORMS rather than navigates** — the terminals fall silent, collapse,
and their fragments drop into the ground as **soil** — while the **R3F bundle lazy-loads behind the
exhale** (`ssr:false`, dynamic import only), and silence resolves into the calm, **EMPTY** 3D land
the walkthrough will grow on.

**Depends on —** [`act1-terminal-storm`](act1-terminal-storm.md) — there is no peak to transform
without the storm; [`web-experience-sync`](web-experience-sync.md) — the R3F island it lazy-loads
must already be on the site as the synced artifact.

> **Proof status (honest) — `proposed`, operator-attested (ADR-0070).** The transform is the
> experience's hinge — ADR-0134 §2's "the way out" and the second half of the thesis gesture (same
> input, opposite outcome). Whether it LANDS — the dimming reads as relief, the collapse reads as
> the noise becoming the soil of the calm world, the load hides behind the exhale — is irreducibly
> a human judgement on the real site.

## Guidance

THE CHOREOGRAPHY (ADR-0134 §2 — the spec of the moment):

- **The affordance appears AT peak, not before.** The storm must be fully felt first; the dimming +
  the single calm affordance are the reward for having been buried. One affordance only — amid ten
  screaming terminals there is exactly one quiet thing to do, and it is obvious.
- **Transform, not navigate.** The click never changes URL context mid-gesture (no page swap the
  visitor perceives): terminals fall silent (audio decays, not cuts), collapse, and their fragments
  fall INTO the ground — the noise literally becomes the soil/seed of the calm world that fades up.
  The continuity is the argument: the calm world is built out of the same stuff, re-ordered.
- **The exhale buys the load.** The R3F bundle starts loading on the click (dynamic `import()` —
  the sanctioned seam `check:web-experience` recognises); the collapse/quiet beat is long enough to
  hide a realistic fetch on an ordinary connection, with a graceful still-loading posture (the
  soil rests) if the network is slower. Optionally prefetch on peak-reached; never load in Act 1.
- **It resolves EMPTY.** The land after the transform carries no story nodes — beat 1 of Act 2
  plants the first. Until `act2-guided-walkthrough` lands, the empty calm land carries the interim
  CTA/links (increment coherence, owner decision 6) so a visitor who arrives mid-arc is never
  stranded.
- **The island is the synced artifact.** The mounted canvas imports ONLY from the synced
  `web/src/lib/forest-world-r3f/` + `web/src/lib/forest-world/` copies (`@generated`) — never a
  re-implementation. The no-WebGL / reduced-motion fallback path bypasses the storm AND the
  transform entirely (straight to the static calm view — the same destination, bought statically).

BUILD SHAPE: `storytree-web` repo work on its own rail, `frontend-builder` driving; the collapse
animation is DOM/CSS (it animates Act 1's own elements), the fade-up is the island's first render.

## UAT (operator-attested)

1. **The dimming and the one calm thing.** _(witness: human)_ At peak, the storm dims and exactly
   one calm storytree affordance appears; it reads as the obvious way out, not another demand.
2. **The transform.** _(witness: human)_ One click: terminals silence and collapse, fragments drop
   into the ground as soil, the calm land fades up — perceived as one continuous transformation in
   place, not a navigation; audio resolves to quiet rather than cutting.
3. **The load hides in the exhale.** _(witness: human)_ On an ordinary connection the 3D land is
   ready as the quiet resolves (or a graceful resting-soil posture covers a slow fetch); DevTools
   confirms the R3F chunks were first fetched at the click, never during Act 1.
4. **The empty land is coherent.** _(witness: human)_ The resolved land is calm, empty of story
   nodes, navigable (drei MapControls), and — until Act 2 lands — carries the interim CTA/links so
   the increment leaves the live site whole.
