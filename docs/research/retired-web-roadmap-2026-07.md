# Retired web page — `/roadmap/` (content salvage, 2026-07-06)

Salvage extraction from the public site's discarded roadmap page, per the info-pages-triage owner
sign-off (2026-07-06). The owner directed that the useful content be preserved in the corpus before
the page code was deleted ("still useful and might come back to life later"), so future sessions find
the substance here instead of re-deriving it from web-repo git archaeology. Source: storytree-web @
`a87e8ed2` — `src/pages/roadmap.astro`, `src/data/roadmap.json`, `src/data/roadmap-page.json`,
`src/components/RoadmapDag.astro` (all deleted by the triage; full render code recoverable in
storytree-web git history).

Discard rationale (the signed disposition): the map data was hand-authored and had not moved since
2026-06-18 while the system moved daily; the ADR-0066 D4(c) generate-from-source follow-on was never
wired; a stale public roadmap is exactly the over-claim the site bans. `/roadmap/` now redirects to
`/get-involved/`.

If the page comes back to life, the honest version is the ADR-0066 D4(c) shape: **generate the map
from source** (the story tree / decision log), never hand-author it again.

## The page's frame (from `roadmap-page.json`)

**Heading:** Not a timeline. A map of what unlocks what.

> Roadmaps with dates on them are mostly fiction — they promise a *when* nobody can honestly know.
> So this one doesn't. It's a **dependency map**: we build a thing, and finishing it unlocks the
> next things. Read it bottom-up; an arrow means "this had to come first."
>
> Some work doesn't wait on code — it waits on the world. Those points are **milestones**, and they
> act as gates. We're not going to build governance for an experiment of one with no users and no
> backing, and we're not going to fake a community vote before there's a community. So that work
> sits behind a gate marked with the condition that has to be true first.

**The page's one promise:** "We only colour a thing 'built' once it actually is."

> Everything below the milestones is real today — you're looking at how storytree already works.
> Everything above them is honest intent, not a wall that's already there. If we ever claim
> something is built that isn't, this is the page to hold us to. The roadmap will move as we learn;
> the one thing it won't do is pretend.

CTAs: "See what's built →" (→ `/how-it-works/`) · "Tell us what's missing" (→ `/contact/`).

## The dependency map (from `roadmap.json`, as of 2026-06-18)

Read bottom-up; "needs" = the `dependsOn` edge ("this had to come first, and it unlocks that").
Milestones are gates: real-world conditions that must be true before the work behind them is worth
building.

**Built (status `done`):**

- **Proof gates** — Nothing ships without proof — a failing test made to pass for the right reason,
  checked by a different agent than the one that wrote it.
- **The living map** — Every project is a tree of stories you can watch grow, instead of a plan
  hidden in someone's head.
- **Many builders, in parallel** — People and AI agents build different parts of the tree at once —
  a control room, with humans steering what's worth building and what ships.

**Milestone gates:**

- **A real circle of members** (needs: the living map, many builders) — condition: *"People beyond
  the founder are actually building here."* We won't pretend at community before there is one.
  Shared decisions only mean something once there are people to share them with.
- **It can sustain itself** (needs: a real circle of members) — condition: *"Real users, and the
  backing to keep going."* Governance is not worth building for an experiment of one with no users
  and no backing. Reach this first; then it earns the right to grow.

**Gated work (honest intent, not built):**

- **Your voice becomes your vote** (needs: a real circle of members) — Today one person decides what
  gets built next. This turns "your voice counts" into a real say — once there are members whose say
  it is.
- **Real governance** (needs: it can sustain itself, your voice becomes your vote) — Who eventually
  holds these rules, and how they change — built for a project that exists at scale, not promised
  into a vacuum.

## Related record

- The signed disposition set + Keystatic retirement: the info-pages-triage sign-off ADR (2026-07-06,
  see `docs/decisions/`).
- The governance/milestone commitments survive publicly in `/constitution/` ("What we commit to",
  "Where we are right now").
- ADR-0066 D4(c) recorded the generate-from-source intent this page never received.
