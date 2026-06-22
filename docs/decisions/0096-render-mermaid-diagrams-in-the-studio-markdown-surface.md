---
status: accepted
decided: 2026-06-22
---
# ADR-0096: Render mermaid diagrams in the studio markdown surface

## Status

accepted — owner directed it (2026-06-22): "I want diagrams in the open-questions." This is the
small fast-follow ADR the open-question-clarity research scoped (`docs/research/open-question-clarity-and-first-subagent.md`,
2026-06-08, the "diagram decision" options table): option **A** (ASCII-in-fenced-code) shipped with
the `## Diagram` field; option **B** (mermaid) was held back as "a cleanly-scoped capability worth a
small ADR + its own task." This is that ADR + task.

## Context

Library artifacts — `open-question`s most of all — gained an optional `## Diagram` field, but the
studio's markdown renderer (`apps/studio/src/components/Markdown.tsx`) is **`react-markdown` +
`remark-gfm` only**: it can render a fenced code block, so today a diagram can only be **ASCII art**.
There is no picture rendering. The owner has repeatedly asked for real diagrams, and the structural
open-questions (e.g. `oq-library-doc-shape`'s four-node data-flow cycle) are exactly the case a
drawn diagram beats prose — the research doc's Smell 4.

The forces:

- **ASCII (A)** is zero-risk and already works, but is ugly and carries no semantic structure.
- **Committed images (C)** put diagram content in git, outside the structured corpus the Library is
  trying to keep authoritative — they don't round-trip through the DB and collide with the very
  problem `oq-library-doc-shape` raises. Rejected.
- **Mermaid (B)** — ` ```mermaid ` fenced blocks rendered to SVG — is diffable, structured, lives in
  the corpus body, and is the better end state. Its cost is a new dependency, a renderer change that
  must also reach the editor's live preview, and a small **author-input execution surface** (below).

## Decision

Render ` ```mermaid ` fenced code blocks as inline **SVG diagrams** in the studio markdown surface;
**every other fenced code block renders exactly as before** (a `<pre><code>` listing).

- **One renderer, both surfaces.** The change lives in the single shared `Markdown.tsx`, which the
  artifact **view** (`AssetView`) and the editor **live preview** (`AssetEditor`) already both use —
  so an author sees the diagram render while editing, identical to how it will read.
- **Client-side, pinned.** Use the `mermaid` npm package, **pinned to an exact version**
  (`mermaid@11.15.0`, no caret), rendered fully **client-side** (no server, no network) via a custom
  `pre` component override. The routing decision (is this a mermaid fence?) is a pure function
  (`mermaidSource`) read from the hast node, so it is unit-tested without a browser.
- **Fail soft.** A diagram that fails to parse falls back to showing its source in a code box, so a
  bad diagram never blanks the page or throws.
- **Authoring guidance.** The `open-question` `diagram` field placeholder in `KIND_SPECS`
  (`packages/library/src/knowledge.ts`) now names ` ```mermaid ` as a supported option alongside
  ASCII.

### Security

Mermaid **executes author-supplied diagram source** to produce the SVG — a non-zero surface. Three
mitigations, matching the research doc's option-B note:

1. **Pin the version** (`11.15.0` exact) — no silent transitive upgrade of a code-executing dep.
2. **Render client-side with `securityLevel: 'strict'`** — mermaid's strict mode does not emit raw
   HTML or click/script handlers out of diagram source. The diagram cannot reach the server or the DB.
3. **Trusted authors.** Corpus authors are operators / agents-under-review writing into a
   review-gated Library, not anonymous public input — so the surface is **small but non-zero**, and
   we treat diagram source like any other author input rather than as untrusted remote content.

## Consequences

- **Good.** Structural open-questions can carry a real, diffable, in-corpus diagram; the editor
  preview proves it before save; ASCII diagrams keep working unchanged; the renderer change is one
  file and fully behind a pure, tested routing function.
- **Cost.** A new client dependency (`mermaid`) enlarges the studio bundle; mermaid is lazy-initialised
  once on first use to keep it off the critical path. The dep must be noted wherever the repo-surface
  manifest / allowlist tracks studio deps.
- **Bounded.** Only the `language-mermaid` fence is intercepted; no other markdown behaviour changes,
  so the blast radius is the diagram path alone.
- **Proof.** Routing is proven red-green offline (`Markdown.test.tsx`, `lib/markdown.test.ts`); the
  rendered appearance is operator-attested in the studio (the two-stage frontend proof, ADR-0070).

## References

- `docs/research/open-question-clarity-and-first-subagent.md` — the diagram-decision options table (A/B/C) and the security note this ADR enacts.
- ADR-0070 — visual units prove in two stages (red-green geometry/behaviour + operator-attested appearance).
- `apps/studio/src/components/Markdown.tsx`, `apps/studio/src/lib/markdown.ts` — the renderer + the pure `mermaidSource` routing function.
- `packages/library/src/knowledge.ts` — the `open-question` `diagram` field placeholder.
