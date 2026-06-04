# studio (foundation)

The web surface for storytree — **this is the foundation only**: a forum-style
interface over the project's decision corpus. **No PixiJS, no story-tree yet**
(those come later, per [ADR-0001](../../docs/decisions/0001-foundational-stack.md)).

Think of the whole thing as a **forum**: documents and guidance assets are
*topics*; comments are *posts*. It does three things:

1. **Browse + read** every ADR (`docs/decisions/*.md`), the glossary,
   open-questions, adjudication, and the v1 registers — rendered markdown with
   stable section anchors and in-corpus cross-links.
2. **Inline comments & feedback** — attach a comment to a whole document or a
   specific section heading, see it inline, and resolve it. Persisted in the repo.
3. **Guidance library** — modular, injectable units of agent guidance
   (`principle` / `definition` / `guideline` / …), authored, tagged, browsed, and
   cross-referenced to the corpus. The seed of an injectable guidance library.

## Run it

From the repo root (Node 24, `corepack enable pnpm`):

```bash
pnpm install
pnpm --filter studio dev     # → http://localhost:5173
```

That's the whole thing — **one process**. Vite serves the React app *and* a small
middleware API ([`server/devApi.ts`](server/devApi.ts)) that reads the docs live
from `../../docs` and persists comments + assets to `data/*.json`. No separate
backend, no database.

```bash
pnpm --filter studio typecheck   # strict tsc (repo tsconfig.base)
pnpm --filter studio build       # static SPA build (no API — see "Persistence")
node apps/studio/data/seed.assets.mjs --force   # re-seed the guidance library
```

## Data model

Two JSON stores under [`data/`](data/), both tracked in git so feedback and
guidance are durable and reviewable. The on-disk shapes are defined in
[`src/types.ts`](src/types.ts).

### Comment (a forum *post*)

```jsonc
{
  "id": "uuid",
  "topicKind": "doc" | "asset",         // a topic is a document or a guidance asset
  "topicId": "decisions/0002-….md",     // doc relpath, or an asset id
  "anchor": {
    "kind": "topic" | "section",        // whole topic, or one heading
    "headingSlug": "decision" | null,   // matches the rendered heading's id
    "headingText": "Decision" | null
  },
  "body": "markdown",
  "author": "operator",                 // single local operator (see Design choices)
  "createdAt": "ISO-8601",
  "resolved": false,
  "resolvedAt": "ISO-8601" | null
}
```

The **same** `slugify` produces both a heading's rendered `id` and a section
comment's `headingSlug`, so a comment reliably re-targets its section.

### GuidanceAsset (a modular guidance unit)

```jsonc
{
  "id": "deep-modules",                 // kebab-case slug, unique (the v1 `name`)
  "category": "principle",              // principle | definition | guideline |
                                        //   context | governance | glossary
  "title": "Deep modules",
  "description": "one line — what it is / when to inject it",
  "body": "markdown",
  "tags": ["design", "boundaries"],
  "references": ["doc:glossary.md", "asset:proof-mode"],  // → clickable in-app links
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

This is grounded in the v1 (Agentic) `assets/` corpus: a typed unit with a
`name`, a `description`, a body, and `current_consumers` references. The library
ships seeded with five real assets (two condensed from v1, three storytree-native)
so it isn't an empty shell — see [`data/seed.assets.mjs`](data/seed.assets.mjs).

### API (dev only)

| Method | Path | |
|---|---|---|
| GET | `/api/docs` | list doc topics (`{id,title,group}`) |
| GET | `/api/docs/content?id=` | one doc's markdown (path-traversal-guarded) |
| GET/POST/PATCH/DELETE | `/api/comments` | comment CRUD (`?id=`, `?topicId=`) |
| GET/POST/PATCH/DELETE | `/api/assets` | asset CRUD (`?id=`) |

## Design choices (for owner review)

These are the lean, reversible calls I made. Flag any you'd revisit.

- **`GuidanceAsset`, not bare `asset`.** The glossary reserves **`asset`** for
  tree/game art, and `open-questions.md` §9 / `adjudication.md` §J say the
  cross-cutting-knowledge tier, when it returns, must be named something *other*
  than `asset`. So the type is `GuidanceAsset` and the UI says "guidance asset".
  This deliberately re-opens §9's parked tier as a concrete (if minimal) model —
  worth a glance to confirm the shape before it hardens into `packages/core`.
- **Persistence = Vite dev-middleware + JSON files in the repo.** No DB, no
  separate server (ADR-0001: lean, "no heavy backend"). It runs only under
  `vite` (dev) — which is the foundation's whole scope. A production `vite build`
  is a static SPA with no `/api`; wiring durable persistence to the orchestrator
  is later work. `data/comments.json` is tracked and starts empty `[]`; comments
  land as working-tree changes you can commit or `.gitignore` as you prefer.
- **Docs render live from `../../docs`.** The studio shows the *actual* canonical
  files — edit a doc, reload, see it. No copy/duplication.
- **Single local operator identity.** Per ADR-0008 / `adjudication.md` §C: a
  display name in `localStorage`, stamped on comments. No auth. Revisit when
  multi-operator.
- **`references` are a one-directional seed of v1's reciprocity links.** An asset
  points at `doc:`/`asset:` topics (rendered as in-app links). The reverse
  ("which topics consume this asset") and v1's reciprocity *check* are not built.
- **Categories mirror v1's `assets/` buckets.** The three the brief named
  (principle/definition/guideline) plus context/governance/glossary, each with
  its v1 one-line gloss shown in the UI ("how to judge" / "what it is" / …).
- **No router / markdown-anchor dependencies.** A ~40-line hash router and a
  local `slugify` instead of `react-router` / `rehype-slug` — keeps the dep set
  to React + Vite + `react-markdown` + `remark-gfm` (the "minimal bloat" ask).

## Out of scope (deliberately)

PixiJS isometric story-tree · real-time / multi-user · orchestrator / agent
integration · auth · production persistence. This is the static-content forum
foundation only.

## Structure

```
apps/studio
├── index.html
├── vite.config.ts          # wires React + the data-api plugin
├── server/devApi.ts        # the "backend": docs + comments + assets over Vite
├── data/                   # JSON stores (tracked): comments.json, assets.json, seed script
└── src
    ├── App.tsx             # shell: loads docs/assets/comments, provides context, routes
    ├── api.ts · types.ts   # typed client · shared on-disk shapes
    ├── lib/                # hash router · markdown/slug · app-data context · operator · format
    └── components/         # Sidebar · Markdown · DocView · CommentPanel · GuidanceLibrary · AssetView · AssetEditor · Home
```
