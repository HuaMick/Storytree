---
status: proposed
amends: [66]
---
# ADR-0093: Shared forest-world render core for studio and the public website

## Status

proposed — designed 2026-06-22 by the orchestrator session at the owner's request. After the session
hand-ported the studio's current map look (the relaxed Townscaper mesh + Chaikin-smoothed coastline)
into the public website, the owner said: *"I like the idea of sourcing everything from studio, so every
time we update studio it flows into the website."* Offered "spec it (ADR + shared core)" vs a quick
sync pipe vs leaving it manual, the owner chose **spec it**. This ADR **resolves [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md)
Open call #4** ("a shared render core for studio + web — leverage vs. coupling, a follow-on decision,
not this ADR") in favour of **leverage**. The *direction* — one shared core — is decided; the
*render-extraction strategy* (§Open call 1) is the load-bearing fork left for the owner. Nothing is
built by this ADR; it decides the shape.

## Context

Two render engines draw the **same forest-world metaphor**:

- the **studio** forest world ([ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md))
  — a large React component (`apps/studio/src/components/TreeView.tsx`) wired to the **live store**,
  with rich chrome on top (solar layout, the Shared-Islands panel, building stamps, the settings gear,
  per-node hover/click/focus);
- the **public website** demo — a pure, build-time engine (`web/src/lib/world.ts` +
  `worldSvg.ts`) that emits **string SVG** from **fictional** "Cohoot" data, in a separate *public*
  repo (the `web/` submodule).

They were deliberately **independent**: [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md)
Decision 3 set the boundary as *"the public site consumes parent-built artifacts, never private
source,"* and [ADR-0056](0056-ground-the-public-website-s-claims-to-the-corpus-via-data-gr.md) plus the
web repo's "original visual language" kept the site decoupled from the private internals.

That independence has a cost, and it bit concretely **2026-06-22**: the owner wanted the studio's
current look on the site, and it had to be **hand-ported** (this session re-implemented the mesh
substrate + smoothed coast in the web repo from first principles). Every studio look change otherwise
drifts from the site or demands another manual port. [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md)
foresaw exactly this (Consequences: *"Two render engines exist … graduating the web engine parent-side
invites — but this ADR does not decide — a shared render core consumed by both: real leverage, real
coupling"*; Open call #4). The owner now chooses the leverage.

The forces that shape *how*:

- **The studio render is React + live data + a superset of features;** the web render is pure
  string-SVG + fictional data + a **subset** of the world (just islands/trees/flora/coast/roads). The
  shareable thing is the **pure world render** — geometry and shapes — not the data, the store, or the
  framework chrome.
- **The boundary still holds** ([ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md)
  Decision 3 / [ADR-0056](0056-ground-the-public-website-s-claims-to-the-corpus-via-data-gr.md)): the
  public site must consume a parent-built **artifact**, never private source or live data. A shared
  core therefore lives **parent-side**; the site consumes its output; the fictional demo data stays in
  the web repo.
- **The web engine is, conveniently, already pure and at parity.** This session brought
  `web/src/lib/{world,worldSvg}.ts` to the studio's current look — a clean, framework-agnostic
  string-SVG renderer. That makes it the natural seed of a shared core rather than a throwaway.

## Decision

Adopt **one shared forest-world render core**, parent-side, consumed by both surfaces — resolving
[ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md) Open call #4 for
leverage.

1. **Extract the pure render core into a parent package** (the `packages/web-engine` that
   [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md) Decision 2 named,
   or a `packages/forest-world`): the deterministic **geometry** (`buildWorld` / the relaxed mesh /
   the Chaikin coast / ranking / territory growth) **and** the framework-agnostic **shape builders**
   (island cells, living tree, dead/withered tree, flora, conifer, signpost, bloom, wisp, roads). Pure,
   browser-safe, deterministic, **data-in → SVG-out**; no store, no React, no live data. Seeded from
   the studio's canonical geometry and the website's already-pure string-SVG render (now at parity).
   It earns inner-loop proofs parent-side ([ADR-0020](0020-red-green-enforcement-on-the-owned-loop.md) /
   [ADR-0057](0057-dogfood-the-inner-loop-as-the-default-node-borne-proof-confi.md)) — determinism,
   ranking, mesh/coast invariants — the dogfood [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md)
   Decision 2 wanted.

2. **The studio renders FROM the core** ([ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md)
   refactors): its world layer becomes the shared core's output, with the studio's chrome — panels,
   solar, building stamps, settings, live-store wiring, interactivity — layered **on top**. The studio
   stays the **canonical source of the look**: a change lands there first.

3. **The site consumes the core's ARTIFACT, not its source** (boundary intact). The public submodule
   takes the **built output** of the shared core via a sync step + a drift gate (`check:web-engine`,
   the [ADR-0051](0051-the-agent-renderer-shapes-claude-md-and-the-leaf-prompt-from.md) /
   [ADR-0052](0052-render-delegatable-agents-to-claude-agents-subagent-files.md) generated-view +
   drift pattern, at submodule-bump granularity like the existing `check:web-grounding`). The site
   keeps its **fictional Cohoot data** and its thin page shell. A studio look change thus **flows** to
   the site through one core — no hand-port.

4. **Shared = the LOOK only** (geometry + shapes). Never the live data, the store, the corpus, or the
   studio's interactive/feature chrome. This is the precise line that keeps
   [ADR-0056](0056-ground-the-public-website-s-claims-to-the-corpus-via-data-gr.md)'s decoupling intact
   (no private data crosses) while sharing the rendering logic.

5. **The wasteland mock rides the same flow.** The website-only "failing story → barren, dead-tree
   wasteland" prototype built this session **graduates into the core/studio** once the owner is happy,
   then flows back to the site as core output — the prototype → graduate → flow model the owner
   endorsed, rather than a permanent site-only fork.

## Consequences

**Good.**
- One **source of truth** for the look: studio changes flow to the site automatically — the owner's
  ask — and the two surfaces can never visually drift.
- No more hand-ports (this session's manual mesh port becomes the last one).
- The demo engine, untested today, becomes a proven parent-side core
  ([ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md) Decision 2's
  inner-loop dogfood, now shared).

**Bad / costs.**
- **Re-couples public ↔ private at the render layer.** Mitigated by Decision 3/4 (artifacts-not-source,
  look-only, no data), but a real publish/sync edge now exists with freshness + tooling cost — the same
  trade [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md) Open call #1
  flagged, now taken for the render core.
- **A studio render refactor** ([ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md)):
  moving its world layer onto a core-driven render (and its per-node interactivity onto event
  delegation, which the website already uses) is the load-bearing effort — surfaced as Open call 1.
- **Discipline cost:** the core must stay framework-agnostic and a strict **subset** API so the
  studio's extras never leak into the site bundle.

## Open modeling calls (for the owner)

1. **Render strategy — the load-bearing fork.**
   (A) Share **geometry only** (layout/mesh/coast → data); each surface keeps its own shape render →
   layout flows, shapes stay duplicated (*partial* flow).
   (B) Share **geometry + framework-agnostic string-SVG shapes** (the web's `worldSvg.ts` becomes the
   shared renderer; the studio renders it via `innerHTML` + event delegation) → **everything flows**; a
   real but bounded studio refactor.
   (C) Share **geometry + a scene-graph** description; each surface has a thin mapper (React / SVG
   string) → everything flows, cleanest separation, most work.
   **Recommendation: (B)** — the website is *already* a pure string-SVG renderer at parity with the
   studio, so it is the cheapest path to full flow; fall back to (C) if studio interactivity friction
   bites.
2. **Package identity.** A new `packages/forest-world`, the `packages/web-engine` that
   [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md) Decision 2 named,
   or extracted from the studio organism — under [ADR-0068](0068-make-the-organism-model-physical-real-story-isolation-and-th.md)
   organism boundaries / the no-cycle rule.
3. **Sync mechanism + cadence.** Build-artifact synced into the submodule on the core's change (a
   script + `check:web-engine` drift gate at bump time) vs a published package the web repo depends on.
   **Recommendation: sync-into-submodule + drift gate** — matches
   [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md) Decision 3/6 and the
   existing `check:web-grounding` granularity, and avoids publishing a private package.
4. **Studio interactivity under a shared render.** The studio's per-node hover/click/focus is React
   today; a string-SVG core needs event delegation on `data-id` (the website already does this).
   Confirm that's acceptable for the studio's richer interactions, or choose (C).

## References

- [ADR-0066](0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md) — the website-wiring
  ADR this **amends**: Open call #4 (the shared core, resolved here), Decision 2 (engine graduation),
  Decision 3 (the artifacts-not-source boundary).
- [ADR-0062](0062-the-forest-world-is-the-observability-layer-rendered-one-art.md) — the studio forest
  world; the canonical render that becomes the core's source and refactors to consume it.
- [ADR-0056](0056-ground-the-public-website-s-claims-to-the-corpus-via-data-gr.md) — the decoupling /
  `data-grounds` boundary this preserves (look shared, data never).
- [ADR-0068](0068-make-the-organism-model-physical-real-story-isolation-and-th.md) — organism boundaries / no-cycle rule for the new package.
- [ADR-0020](0020-red-green-enforcement-on-the-owned-loop.md) / [ADR-0057](0057-dogfood-the-inner-loop-as-the-default-node-borne-proof-confi.md)
  — the inner-loop proofs the shared core earns.
- [ADR-0051](0051-the-agent-renderer-shapes-claude-md-and-the-leaf-prompt-from.md) / [ADR-0052](0052-render-delegatable-agents-to-claude-agents-subagent-files.md)
  — the generated-view + drift-gate pattern the `check:web-engine` sync reuses.
- [ADR-0050](0050-adr-number-allocation.md) — how this ADR's number (0093) was allocated.
- `web/src/lib/world.ts`, `web/src/lib/worldSvg.ts` — the pure string-SVG render brought to studio
  parity 2026-06-22 (the seed of the shared core); `apps/studio/src/components/TreeView.tsx` — the
  studio render to share.
