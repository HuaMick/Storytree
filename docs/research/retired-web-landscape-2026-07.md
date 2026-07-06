# Retired web page — `/landscape/` (content salvage, 2026-07-06)

Salvage extraction from the public site's discarded landscape page, per the info-pages-triage owner
sign-off (2026-07-06). The owner directed that the useful content be preserved in the corpus before
the page code was deleted. Source: storytree-web @ `a87e8ed2` — `src/pages/landscape.astro`,
`src/data/landscape.json`, `src/components/Scorecard.astro`,
`src/components/ConvergenceTimeline.astro` (all deleted by the triage; full render code recoverable
in storytree-web git history).

**The survey research itself was never web-only and still lives here** —
`docs/research/three-surfaces-landscape/` (`three-surfaces.md`, `convergence-timeline.md`,
`sources.md`, `competitors/`, `raw/`) is the primary-sourced base the page rendered, and
`docs/research/industry-framing-2026.md` is the newer (2026-07-05) framing pass. What this file
preserves is the **page's authored editorial framing** — prose written for the public page that
existed nowhere else — plus the rendered scorecard/timeline data for one-glance resurrection.

Discard rationale (the signed disposition): a June-2026 field survey is the fastest-rotting page on
the site; it was not in the Nav; how-it-works' "why this is different" section carries the honest
positioning. `/landscape/` now redirects to `/how-it-works/`.

## The page's authored frame (from `landscape.json`)

**Heading:** Are we onto something — or just renaming it?

> Honesty is the whole point of this project, so here's the uncomfortable version: storytree didn't
> invent any of its parts. The interesting question is whether putting them together is a real
> advance or a tidy rename. We went and surveyed the field to find out — and we'll show you the case
> against, not just the case for.

The setup: the binding constraint on an AI coding agent isn't raw intelligence — it's the context
window and the lack of memory between sessions. The better move is to **manage attention, not expand
it**. storytree splits that map into **three surfaces**: a **library** (what's known), a **code
map** (what the system is), and a **work-board** (what's being done). The survey tested that model
against what the field actually shipped, scored from primary sources.

**Survey framing:** "Everyone's built a piece. We looked for who'd built all three." Each cohort
builds one axis and stops: the code-map cohort (Aider's repo map, CodeGraph, Augment, Cody), the
library cohort (Anthropic's Skills and memory, Letta's memory blocks), the work-board cohort (Steve
Yegge's Beads and Gas Town). Geoffrey Huntley's loom has raw components, none presented as an
integrated agent-facing surface.

**Coverage caution (verbatim class):** the board is *the surveyed sources at one date*. Cursor,
Cline, Devin, Factory, OpenHands, Windsurf produced no verified claims in that pass and were
deliberately left off. Absence of evidence isn't evidence of absence.

**"What might be new" — the two narrow claims:**

1. **The unification.** No surveyed tool builds all three surfaces as one coherent model — not a
   capability nobody else *could* build, just a combination the survey didn't find anyone holding.
2. **The altitude.** The code-map tools operate at *symbol altitude* — a bottom-up mirror of code as
   written. storytree's code map is authored top-down *as intent*, and the code has to satisfy *it*.
   Spec-driven tools (Spec Kit, Kiro) author intent top-down too — the closest neighbours — but
   flatten it into per-feature checklists thrown away when the feature ships.

Both claims were explicitly scoped: "distinctive" means "not found in this survey," not "proven
novel."

**The skeptical read (the page argued against itself, on purpose):** task trackers, docs-and-memory
tiers, and VCS-backed code views already exist in unintegrated form; maybe storytree just labels and
arranges primitives that Beads, Skills, and Aider already shipped, and the "unification" is a
presentation choice — the contribution mostly *naming*. The honest counter stayed narrow: the three
surfaces are a pattern the field independently converged on; no surveyed tool unifies all three; the
authored, architecture-altitude map is a genuinely different object from the bottom-up mirrors.
"Whether that adds up to a real advance or a tidy rename is the open question — and it's more useful
to leave it open than to answer it louder than the evidence allows."

**The caveats box (all five, compressed):** point-in-time snapshot (sources ~2023–mid-2026); the
surface mappings are storytree's framing, not the tools' self-description; coverage gaps exist;
some internals genuinely contested (the embedding-vs-graph reading of Augment/Cody was challenged in
verification — mark the surface, not the mechanism); "distinctive" ≠ "first."

**Sourcing note:** marks scored from primary sources, consolidated from three
adversarially-verified research passes (Jun 2026); claims refuted in verification — including two
"agent momentum" citations — were dropped rather than dressed up.

## The scorecard (as rendered, Jun 2026)

Marks: ● direct analog · ◐ partial/unintegrated · — not found.

| Tool | note | Library | Code map | Work-board |
|---|---|---|---|---|
| Aider | tree-sitter repo map | — | ● | — |
| CodeGraph | a queryable code graph | — | ● | — |
| Augment Code | real-time codebase index | — | ● | — |
| Sourcegraph Cody | code retrieval over repos | — | ● | — |
| Anthropic Skills + memory | loadable knowledge tier | ● | — | — |
| Letta / MemGPT | structured memory blocks | ● | — | — |
| Beads | dependency-aware task graph | — | — | ● |
| Gas Town | work-first orchestration | — | — | ● |
| loom | thread search + VCS tooling, unintegrated | ◐ | ◐ | — |
| **storytree** | one model, all three surfaces | ● | ● | ● |

Primary-source links per row: `docs/research/three-surfaces-landscape/three-surfaces.md`.

## The convergence timeline (as rendered)

The point it made: a tight cluster in H2-2025 — the honest backdrop storytree sits inside, not a
priority claim. Soft dates flagged `~`.

- **19 Dec 2024 — "Building effective agents"** (Anthropic): simple, composable patterns over
  heavyweight frameworks — the early "own the loop" signal.
- **~7 Jul 2025 — tdd-guard**: a harness that blocks implementation until a failing test exists.
- **14 Jul 2025 — AWS Kiro**: spec-driven IDE, generated tasks hard-link back to spec documents.
- **14 Jul 2025 — Ralph** (Geoffrey Huntley): the canonical unattended-loop recipe.
- **2 Sep 2025 — Spec Kit** (GitHub): four-phase spec-driven workflow, open-sourced.
- **29 Sep 2025 — "Effective context engineering"** (Anthropic): names the discipline.
- **16 Oct 2025 — Agent Skills** (Anthropic): loadable, progressively-disclosed knowledge units.
- **4 Nov 2025 — "Code execution with MCP"** (Anthropic): code-as-tooling over heavy tool surfaces.
- **~Jan 2026 — Ralph goes mainstream** (The Register): the inflection, not the invention.

Source links per entry: `docs/research/three-surfaces-landscape/convergence-timeline.md`.

## Related record

- The signed disposition set: the info-pages-triage sign-off ADR (2026-07-06, `docs/decisions/`).
- The surviving public positioning: how-it-works' "Why this is different" section, plus its
  industry-terms section (ADR-0165 §8) added by the same triage.
