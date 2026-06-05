# studio (foundation)

The web surface for storytree — **this is the foundation only**: a forum-style
interface over the project's record. **No PixiJS, no story-tree yet** (those come
later, per [ADR-0001](../../docs/decisions/0001-foundational-stack.md)).

Think of the whole thing as a **forum**: documents and Library artifacts are
*topics*; comments are *posts*. It does three things:

1. **Read the record** — the ADRs are kept as *history* (the justification
   record) alongside the glossary, open-questions, and adjudication. Rendered
   markdown with stable section anchors and in-corpus cross-links.
2. **Annotate** — select any text to attach a comment to that exact span; it
   highlights inline (like a word processor). Comment on a whole topic, a
   section, or a selection; resolve when addressed. Highlights re-anchor to the
   text, so they survive edits and re-renders.
3. **Library** — modular, injectable **artifacts** (`definition` / `principle` /
   `pattern` / `guardrail` / `techstack` / `template`), plus the **ADRs** folded
   in as read-only, doc-backed `adr` cards — all browsable and searchable in one
   place. The durable guidance is synthesised from the ADRs (each artifact cites
   its source ADR); every glossary term is a `definition` artifact. Authoring
   conforms to per-category **templates**, enforced on save.

## Run it

From the repo root (Node 24, `corepack enable pnpm`):

```bash
pnpm install
pnpm --filter studio dev     # → http://localhost:5173
```

One process. Vite serves the React app *and* a small middleware API
([`server/devApi.ts`](server/devApi.ts)) that reads docs live from `../../docs`
and persists comments + artifacts to `data/*.json`. No separate backend, no
database.

```bash
pnpm --filter studio typecheck    # strict tsc (repo tsconfig.base)
pnpm --filter studio build        # static SPA build (no API — see "Persistence")
node apps/studio/data/seed.assets.mjs --force   # re-seed the Library
```

## Commenting — text-quote anchoring

The headline feature. The hard part of attaching a comment to a span of text is
**anchoring** it durably. We use the W3C Web Annotation **text-quote** model
([`src/lib/annotate.ts`](src/lib/annotate.ts)): a `text` comment stores the exact
`quote` plus ~32 chars of `prefix`/`suffix` context and a `startOffset` hint. To
render, we re-find the quote in the live DOM — scoped to its section heading for
speed and disambiguation — and wrap it in `<mark>` elements. This survives
re-render and edits above it, where character offsets or XPath would break.

The annotation layer ([`src/lib/useAnnotations.tsx`](src/lib/useAnnotations.tsx))
adds: a selection popover (pick a highlight colour → comment), inline highlights,
a margin **gutter** showing comment density, **hover preview cards**, click-a-
highlight-to-focus-its-thread, and resolve-fades-the-highlight. The rendered
markdown is memoized so React never reconciles it away (which would strip the
injected marks); all comment-reactive decoration is applied imperatively.

## Data model

Two JSON stores under [`data/`](data/), both tracked in git so feedback and
guidance are durable and reviewable. Shapes are in [`src/types.ts`](src/types.ts).

### Comment (a forum *post*)

```jsonc
{
  "id": "uuid",
  "topicKind": "doc" | "asset",        // a topic is a document or a Library artifact
  "topicId": "decisions/0002-….md",    // doc relpath, or an artifact id
  "anchor": {
    "kind": "topic" | "section" | "text",
    "headingSlug": "decision" | null,  // section id, or the section a text anchor lives in
    "headingText": "Decision" | null,
    "quote":  "exact selected text" | null,   // text-quote anchor →
    "prefix": "…context before"     | null,
    "suffix": "context after…"      | null,
    "startOffset": 486 | null,              // position hint for disambiguation
    "color": "#f5c542" | null               // highlight colour
  },
  "body": "markdown",
  "author": "operator",                // single local operator (see Design choices)
  "createdAt": "ISO-8601",
  "resolved": false,
  "resolvedAt": "ISO-8601" | null
}
```

The **same** `slugify` produces both a heading's rendered `id` and a section
comment's `headingSlug`, so anchors line up.

### GuidanceAsset — a Library artifact

```jsonc
{
  "id": "deep-modules",                // kebab-case slug, unique (the v1 `name`)
  "category": "principle",             // definition | principle | pattern |
                                       //   guardrail | techstack | template
  "title": "Deep modules",
  "description": "one line — what it is / when to inject it",
  "body": "markdown",
  "references": ["doc:decisions/0002-….md", "asset:proof-mode"],  // → clickable in-app links
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

The **6 artifact categories** cover the durable outputs the ADRs produce:
`definition` (what something is), `principle` (how to judge), `pattern` (a
reusable approach), a **`guardrail`** (a *deterministically-enforced* boundary —
it must name what enforces it), `techstack` (what we build on), and a
**`template`** (the shape an artifact conforms to). A small fixed ontology, not
the unbounded tags we removed.

**Templates are enforced.** Each artifact category ships a seeded
`template-<category>` scaffold. The editor offers a "Start from the <category>
template" button when authoring a new artifact, and **blocks save** when a
required section is missing. The load-bearing rule: a **`guardrail`** must include
an **"Enforced by"** section naming its deterministic enforcement (a gate / schema
/ DB constraint / code path) — else it is a `pattern`, not a guardrail. The
required-section map lives in [`src/lib/templates.ts`](src/lib/templates.ts).

**ADRs fold into the Library.** The ADRs also surface in the Library as a
read-only, doc-backed **`adr`** category. They stay canonical markdown under
`docs/decisions/` (they are *not* imported into `assets.json`) and open in the
same `DocView` — rendered markdown with comments + annotation. The glossary /
open-questions / adjudication / v1 registers stay in the sidebar's **Reference**
section, not the Library.

The Library ships seeded ([`data/seed.assets.mjs`](data/seed.assets.mjs)) with
**86 artifacts**: curated guidance synthesised from the ADRs (each `references`
its source ADR), one `template` per artifact category, a few v1 imports, and one
`definition` per glossary term (auto-extracted, citing the glossary and any ADRs
it mentions) — alongside the 9 ADRs surfaced read-only as `adr` cards.

### API (dev only)

| Method | Path | |
|---|---|---|
| GET | `/api/docs` | list doc topics (`{id,title,group,excerpt}`) |
| GET | `/api/docs/content?id=` | one doc's markdown (path-traversal-guarded) |
| GET/POST/PATCH/DELETE | `/api/comments` | comment CRUD (`?id=`, `?topicId=`) |
| GET/POST/PATCH/DELETE | `/api/assets` | artifact CRUD (`?id=`) |

## Design choices (for owner review)

- **ADRs are history, not editable artifacts.** The ADRs are *not* imported into
  `assets.json`; they stay canonical markdown under `docs/decisions/`. They now
  surface **in the Library** as read-only, doc-backed `adr` cards (opening in
  `DocView`), so the live artifacts and the justification record browse together
  while the ADRs stay doc-backed and uneditable. Durable guidance is still
  **synthesised out of** the ADRs into principles/patterns/guardrails, each citing
  its source ADR via `references`. (Synthesis is currently a curated seed — extend
  freely.)
- **Glossary → definitions.** Every `**term** — …` in `docs/glossary.md` becomes a
  `definition` artifact at seed time. `glossary.md` stays as the cited source.
- **Text-quote anchoring** (W3C Web Annotation) for the highlight layer — see
  "Commenting" above. No anchoring/markdown-highlight dependency; hand-rolled.
- **`GuidanceAsset`, not bare `asset`.** The glossary reserves **`asset`** for
  tree/game art (open-questions §9 / adjudication §J say the knowledge tier must
  be renamed when it returns). The type is `GuidanceAsset`; the UI says
  "artifact". This re-opens §9's parked tier as a concrete model worth a look
  before it hardens into `packages/core`.
- **No tags.** Dropped as noise; category + full-text search cover browsing.
- **Persistence = Vite dev-middleware + JSON files in the repo.** No DB, no
  separate server (ADR-0001: lean). Runs only under `vite` (dev) — the
  foundation's whole scope. A production `vite build` is a static SPA with no
  `/api`; durable persistence wired to the orchestrator is later work.
  `data/comments.json` is tracked and starts empty `[]`.
- **Single local operator identity** (ADR-0008 / adjudication §C); no auth.

## Out of scope (deliberately)

PixiJS isometric story-tree · real-time / multi-user · orchestrator / agent
integration · auth · production persistence. This is the static-content forum
foundation only.

## Structure

```
apps/studio
├── vite.config.ts          # wires React + the data-api plugin
├── server/devApi.ts        # the "backend": docs + comments + artifacts over Vite
├── data/                   # JSON stores (tracked) + the Library seed script
└── src
    ├── App.tsx             # shell: loads docs/artifacts/comments, routes
    ├── api.ts · types.ts   # typed client · shared on-disk shapes
    ├── lib/
    │   ├── annotate.ts        # text-quote anchoring + highlight DOM surgery
    │   ├── useAnnotations.tsx # selection popover · highlights · gutter · hovercards
    │   ├── route.ts · markdown.ts · templates.ts · appData.ts · operator.ts · format.ts
    └── components/         # Sidebar · Markdown · DocView · CommentPanel
        ·                   # Library · AssetView · AssetEditor · Home
```
