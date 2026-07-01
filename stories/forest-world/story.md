---
id: "forest-world"
tier: story
title: "The forest-world render core — the shared deterministic geometry both surfaces draw from"
outcome: "The studio and the public website draw the same forest-world look from ONE pure, browser-safe, deterministic geometry core — data-in → geometry-out — so the metaphor can never visually drift and a studio look change flows to the site instead of being hand-ported. A foundational root the whole render rests on, depending on nothing."
status: mapped
proof_mode: UAT
# Machine-judged: a pure GEOMETRY core has no UAT journey (ADR-0085) — its green is an `observe`
# reliability gate (the core's own offline determinism/invariant suite), observe-and-signed into an
# `adopted` verdict. No DB, no API key, no browser — the geometry is exercised headless.
uat_witness: machine
# Lightweight + expandable (ADR-0074 §3, the foundational-root shape): this first unit extracted the
# geometry KERNEL (mesh / coast / ranking / hex / sizing) as ONE proven unit — no sub-capabilities yet.
# The framework-agnostic scene-graph and the studio/website thin mappers (ADR-0093 §1–§3) are the
# obvious next capabilities; the list grows there, and one case per real defect.
capabilities: []
# Foundational root organism (ADR-0093 §1, standing on ADR-0068 / ADR-0075): forest-world owns its OWN
# minimal input contract (a story is just an id + deps + its capabilities' deps), so it depends on
# NOTHING — `depends_on: []`, alongside proof-protocol and storage-protocol at the bottom of the order.
depends_on: []
# Consumed by `apps/studio` (a SURFACE, ADR-0100 — its edge is declared in the studio story), by the
# public website (a separate repo that takes the core's synced built output, never a package edge),
# AND — since the website-experience story's R3F mapper landed — by `packages/forest-world-r3f`, the
# first workspace PACKAGE organism to import this core. That real code edge is declared on both sides
# (consumer-side in website-experience's `depends_on`; here provider-side) so `check:boundaries`
# covers it either way.
consumed_by: [website-experience]
# Deciding ADRs (ADR-0037 §2): the shared render-core decision / this package's identity as a
# foundational root (93); the organism model it stands on (68); ports/shared cores as root organisms,
# the foundational-minimality rule (75); author-defined story green + mapped-as-bootstrap (83); the
# brownfield reliability gates + observe-and-sign that flip it off mapped (85).
decisions: [68, 75, 83, 85, 93]
---

# The forest-world render core — the shared deterministic geometry both surfaces draw from

**Outcome —** The studio and the public website draw the same forest-world look from ONE pure,
browser-safe, deterministic geometry core — *data-in → geometry-out* — so the metaphor can never
visually drift and a studio look change flows to the site instead of being hand-ported. A foundational
root the whole render rests on, depending on nothing.

## What this core is

`packages/forest-world` is the shared forest-world render core decided by
[ADR-0093](../../docs/decisions/0093-shared-forest-world-render-core-for-studio-and-the-public-we.md)
(accepted, strategy C — share the geometry *plus*, in follow-on units, a framework-agnostic
scene-graph with thin per-surface mappers). This first unit extracted the **geometry kernel**: pure,
browser-safe, **deterministic** geometry that BOTH the studio (React) and the public website
(string-SVG) render *from* — the relaxed Townscaper mesh substrate (`substrate.ts`), the
Chaikin-smoothed coastline (`coast.ts`), longest-path dependency ranking (`ranking.ts`), the hex math
(`hex.ts`), the seeded RNG (`rng.ts`), and the tree / territory sizing (`sizing.ts`). Same input →
byte-identical geometry; no store, no React, no live data, no `node:` imports.

It owns its **own minimal input contract** — a story is just an id + its `depends_on` + its
capabilities' deps — so it depends on **nothing**. Each surface adapts its own data (the studio's live
store; the website's fictional Cohoot demo data) to that contract; the core never reaches for either.
It defines the *look* and only the look — never the live data, the store, the corpus, or a surface's
interactive chrome ([ADR-0093](../../docs/decisions/0093-shared-forest-world-render-core-for-studio-and-the-public-we.md)
§4, the precise line that keeps the public ↔ private decoupling intact).

## Consumers

Three consumers, three different edge kinds. The studio app (`apps/studio`) renders from this core —
a consuming SURFACE (ADR-0100), its edge declared in the studio story's own `depends_on`. The public
website (a separate repo, the `web/` submodule) renders from the core's **synced artifact**
([ADR-0093](../../docs/decisions/0093-shared-forest-world-render-core-for-studio-and-the-public-we.md)
§2–§3) — a built-output edge held by the `check:web-engine` drift gate, never a package import. And
`packages/forest-world-r3f` — the R3F mapper the `website-experience` story owns
([ADR-0123](../../docs/decisions/0123-webgl-forest-world-renderer-via-react-three-fiber-website-fi.md))
— imports `@storytree/forest-world` directly: the first workspace **package** organism consumer, so
the core now draws a real inbound package-graph edge. That edge is declared consumer-side
(website-experience `depends_on: [forest-world]`) and provider-side (`consumed_by:
[website-experience]` above), and `pnpm check:boundaries` covers it. `depends_on: []` still draws no
outbound edge — the core remains a foundational root.

## Why it is a foundational root organism

forest-world is a **foundational root organism**
([ADR-0093](../../docs/decisions/0093-shared-forest-world-render-core-for-studio-and-the-public-we.md)
§1, standing on [ADR-0068](../../docs/decisions/0068-make-the-organism-model-physical-real-story-isolation-and-th.md)'s
organism model and [ADR-0075](../../docs/decisions/0075-model-the-shared-ports-as-root-organisms-collapse-the-substr.md)'s
ports-as-root-organisms) — exactly like `proof-protocol` and `storage-protocol`: `depends_on: []`, the
bottom of the dependency order, depending on nothing. It is shared *studio + web*, not web-only, which
is why ADR-0093 named it `packages/forest-world` over the web-only-sounding `packages/web-engine`
([ADR-0066](../../docs/decisions/0066-wire-the-website-into-the-system-a-tracked-corpus-grounded-s.md)
Decision 2) — role-not-position ([ADR-0078](../../docs/decisions/0078-rename-root-ports-role-not-position.md)).
It is registered in `repo-manifest.json` `packageOwnership.organisms` (→ `forest-world`) and in the
`foundational` subset that carries the minimality rule.

## Design floor — foundational minimality

forest-world MUST stay browser-bundleable (the studio bundles it; the website emits string SVG from
its synced output), so it stays pure-geometry, zod/types-only, and **node-free** — no store, no React,
no live data, no `node:*` import. [ADR-0075](../../docs/decisions/0075-model-the-shared-ports-as-root-organisms-collapse-the-substr.md)'s
**foundational-minimality rule** the gate enforces — a foundational organism may only depend on other
foundational organisms — holds by construction here: forest-world depends on nothing. (Belt-and-
suspenders over two backstops: it is a bottom root, so any back-edge to a real organism would close a
cycle the gate already rejects (ADR-0058); and the studio browser build catches a node-only import the
gate cannot see.)

## Reliability Gates

A pure render core is deterministic GEOMETRY — there is no integrated user JOURNEY to walk, so
UAT-as-prose does not fit it ([ADR-0085](../../docs/decisions/0085-resolve-adr-0083-fork-b-brownfield-reliability-gates-author.md),
resolving [ADR-0083](../../docs/decisions/0083-author-defined-story-green-declared-obligations-machine-per.md)
Fork B). Instead this core declares the author-owned **reliability gates** that flip it off `mapped`:
the brownfield obligation set, machine-judged (a geometry kernel is a machine's job, not a human
attestation). The list is the **expandable floor** — start by adopting the existing green suite, and
add a `_(gate: build-tests)_` gate (a genuine red→green regression leg) the moment that observation
proves insufficient (a real geometry defect slips through to a surface), and again as the scene-graph
and the studio/website mappers ([ADR-0093](../../docs/decisions/0093-shared-forest-world-render-core-for-studio-and-the-public-we.md)
§1–§3) land as their own capabilities.

1. **The core's own geometry suite is green** _(gate: observe)_ `pnpm --filter @storytree/forest-world test`.
   The spine runs it at a clean committed HEAD and OBSERVES it green — the 18 offline tests covering
   determinism (same input → byte-identical mesh and coast), longest-path ranking (a dependent ranks
   strictly above every dependency, cycle-safe), and the mesh / coast invariants all pass offline (no
   DB, no API key, no browser) — then signs an `adopted` verdict
   (`storytree gate run forest-world#gate-1 --pg`). This is the
   [ADR-0093](../../docs/decisions/0093-shared-forest-world-render-core-for-studio-and-the-public-we.md)
   / [ADR-0020](../../docs/decisions/0020-red-green-enforcement-on-the-owned-loop.md) /
   [ADR-0057](../../docs/decisions/0057-dogfood-the-inner-loop-as-the-default-node-borne-proof-confi.md)
   inner-loop dogfood. Adopting this gate flips the core off `mapped`; the world's crown derives green
   from the signed verdict (ADR-0040), no faked red required.

## Proof

**Status off `mapped` is EARNED, not authored.** `packages/forest-world` already has a real, passing,
offline suite (18 tests today — determinism, ranking, mesh/coast invariants) that observationally
verifies the geometry kernel — that observational green is brownfield `mapped`. The core leaves
`mapped` exactly when its `observe` reliability gate above is **adopted**: the spine observes the suite
green at a clean committed HEAD and signs an `adopted` machine verdict
([ADR-0085](../../docs/decisions/0085-resolve-adr-0083-fork-b-brownfield-reliability-gates-author.md)).
`healthy` is non-authorable ([ADR-0020](../../docs/decisions/0020-red-green-enforcement-on-the-owned-loop.md))
— the authored frontmatter `status:` stays `mapped`; the world crown DERIVES green from the signed
verdict.

## Open modeling calls (for the owner)

1. **Capability granularity.** Kept to ZERO sub-capabilities for this first unit — the extracted
   geometry kernel is one proven thing (ADR-0074 §3 lightweight-and-expandable). The obvious next
   capabilities are the framework-agnostic **scene-graph** builder (`World` → typed drawables) and the
   thin **studio** (React) and **website** (string-SVG) mappers
   ([ADR-0093](../../docs/decisions/0093-shared-forest-world-render-core-for-studio-and-the-public-we.md)
   §1–§3) — author them as capabilities under this story when each lands, not before; the scene-graph
   and mappers are NOT built yet (only the geometry kernel is).
