# Agent ↔ artifact routing review — does the guidance reach the roles that need it?

**Date:** 2026-06-15 · **Mode:** read-only review + one seed routing fix ·
**Scope:** the nine live `agent` artifacts in `apps/studio/data/knowledge.json` and the
`context` / `rules` / `antiPatterns` ref-lists each injects (the ADR-0051 renderer, `packages/cli/src/agents.ts`).

Third companion to the two fork audits the open question
[`oq-prune-reconstructible-guidance`](../../apps/studio/data/knowledge.json) already cites —
[`guidance-violation-audit.md`](guidance-violation-audit.md) and
[`session-friction-audit.md`](session-friction-audit.md). Those two asked *"have we drifted from
our own principles?"* and *"where does a session waste effort?"*. This one asks the routing
question they left open: **three generic-craft artifacts (`deep-modules`,
`recursive-decomposition-patterns`, `exploration-principles`) feed the delegatable specialists but
feed none of the live spine (`session-orchestrator`, `red-builder`, `green-builder`) — is that a
gap, or is it correct?**

---

## The load-bearing finding: the prune question rests on a premise that is now false

Both fork audits, and the OQ they fed, share one premise — stated verbatim in the audit
([`guidance-violation-audit.md:9-13`](guidance-violation-audit.md)) and the OQ's own `context`:

> *the Library holds ~101 guidance artifacts, **none injected into any working session** (no
> SessionStart hook reads them; the live SDK leaf … ships a fixed generic system prompt and has no
> path to pull the Library) … `storytree agents <name>` … is "coming soon".*

That premise was true on 2026-06-14 morning. It is **false now.** On the same day, ADR-0051 /
ADR-0052 / ADR-0053 (since merged) built exactly the read-path the premise said was missing:

- **`storytree agents <name>`** assembles a role's system prompt by *injecting the bodies* its
  `context` / `rules` / `antiPatterns` `asset:` refs point at (`renderAgentPrompt`, `agents.ts`).
- **The live SDK leaf** (`packages/agent/src/sdk-author.ts`) no longer ships a fixed generic
  prompt: its AUTHOR_TEST / IMPLEMENT system prompts ARE the rendered `red-builder` / `green-builder`
  agents (ADR-0051 §4), threaded through `resolveProveSpec` into `ClaudeAgentAuthor.phasePrompts` —
  and a live leaf with **no injected prompt fails closed** (`#resolveBasePrompt`, the anti-blindside
  guarantee). The Library is the leaf's prompt now.
- **CLAUDE.md's operating-discipline region** is generated from `session-orchestrator`'s digest
  (drift-gated by `check:claude`); the six delegatable agents are pushed to `.claude/agents/*.md`
  (drift-gated by `check:agents`).

So the Library is no longer a write-only reference shelf — it is **active guidance an agent reads.**
That dissolves the OQ's central conditional: the three artifacts were prune-eligible *"only if the
corpus stays reference-only,"* and **it did not stay reference-only.** The
**library-binding fork the OQ said was "not yet made" has been made** (the renderer is the C-option
read-path the OQ floated). The prune question therefore changes character — from *"prune because
nothing reads them"* to *"now that each is injected at a specific decision point, does it add
discriminatory power there?"* — and that is the lens this review applies.

---

## The current mapping (inverse: which roles each artifact reaches)

The live spine is `session-orchestrator` (the CLAUDE.md discipline) + `red-builder` / `green-builder`
(the SDK leaf prompts) — the `DEDICATED_SURFACE_AGENTS`. Everything else is a delegatable specialist.

| Artifact | Kind | Reaches (before) | Live spine? |
|---|---|---|---|
| `deep-modules` | principle | story-author, guidance-curator | **no** → **green-builder added** |
| `recursive-decomposition-patterns` | pattern | story-author | no (specialist-correct) |
| `exploration-principles` | principle | friction-analyst, corpus-investigator | no (specialist-correct) |

A note that matters for the two un-added artifacts: **the renderer injects one level deep only**
(`agents.ts:88-101` injects a ref's body but not the ref's *own* refs). `exploration-principles`'s
body names "escalate to recursive decomposition" by name, so the reconnaissance roles that read it
get a *pointer* to `recursive-decomposition-patterns`, not its body — which is the correct
pull-based posture (pointers, not payloads) for a technique they reach for only on oversized context.

---

## Per-artifact disposition

### `deep-modules` → **route to `green-builder`** (fix applied)

Generic Ousterhout module design (interface is a cost; pay it only when the hidden work justifies
it; the deletion test). Reconstructible-from-training in the abstract — but the routing question is
not the glossary question, and the decisive evidence is V1's own hand-routing. The owner gave
`deep-modules` a dedicated `required_reading` slot on **three** V1 agents, each with a sharp,
*non-generic* operational application (`legacy/Agentic/agents/*/inputs.yml`):

- **`build-rust`** (→ `green-builder`): *"applies to crate-level `pub` surfaces … reach for richer
  fixture composition before widening a crate's `pub` surface 'for testability'."*
- **`test-builder`** (→ `red-builder`): *"applies to scaffold authorship … the `prefer-shared-scaffold`
  rule … shared fixture primitives over hand-rolled per-file helpers."*
- **`story-writer`** (→ `story-author`): *"applies to story scoping … the deletion test is the
  tie-breaker when on the fence about splitting vs consolidating."*

In v2 it reaches `story-author` (matches V1) and `guidance-curator` (correct — its
`two-consumer-extraction` rule explicitly says *"tie-break consolidation questions with
`deep-modules`' deletion test"*), but reaches **neither leaf builder**. The `build-rust` application
— *don't widen a unit's public surface "for testability"* — is an **implementation-time** decision
the v2 `green-builder` still faces: it holds `Write`/`Edit`, makes one isolated test pass, and is
tempted to expose internals to do it. `green-builder`'s current inputs cover *do the minimum*
(`slow-growth-minimum-to-green`), *don't break baseline*, *fix the root cause* — but **not** the
interface-cost lens. The V1 evidence that agents did *not* apply this unprompted (the rule exists
because `build-rust` kept widening `pub` for testability) is what tips it from "reconstructible
noise" to "earns its injection." It **composes with** `slow-growth-minimum-to-green` (both resist
speculative structure) rather than duplicating it.

**`red-builder` deliberately NOT added.** V1's `test-builder` application (`prefer-shared-scaffold`)
is already covered by `red-builder`'s `test-creation-principles` +
`test-fixtures-mirror-production-failure-modes`; adding `deep-modules` there would restate, not
sharpen (`signal-and-noise`). Adding it to one leaf and not the other is the calibration the task
asked for — not wiring everything everywhere.

**Prune verdict: KEEP.** It is also the `glossaryTerm` anchor ADR-0002's work-hierarchy model rests
on — structural-integrity override (ADR-0024 §6) keeps it regardless of reconstructibility.

### `recursive-decomposition-patterns` → **specialist-only (no change)**

A specific named technique from *Recursive Language Models* (context-as-queryable-environment,
filter-over-chunk, search/execution firewall, bounded-depth recursion) for when a context genuinely
exceeds the model window. It reaches `story-author`, whose decomposition work is its natural home,
and the reconnaissance roles reach it by pointer through `exploration-principles`. It does **not**
belong on the live spine: `session-orchestrator` pulls context just-in-time (it has
`pull-based-context-architecture`) and delegates oversized exploration to `corpus-investigator`; the
leaf builders work inside one already-scoped unit and never face an oversized corpus. **Prune
verdict: KEEP** — the reference-only condition that made it prune-eligible has dissolved (it is now
actionable where it is injected); it is the most reconstructible of the three in its *gist*, so it
is the first candidate to re-test if a future friction pass shows its injected body changes no
behaviour.

### `exploration-principles` → **specialist-only (no change)**

Read-only reconnaissance discipline (discover patterns over enumerate, context-minimal, parallel and
independent, never mutate). Correctly routed to the two read-only roles that fan out over the corpus
and event store — `corpus-investigator` and `friction-analyst` — and correctly absent from the live
spine: the leaf builders do not explore broadly, and `session-orchestrator`'s lighter orientation is
already governed by `pull-based-context-architecture` while it *delegates* deep exploration to
`corpus-investigator`. Adding it to the orchestrator would restate `pull-based-context`'s posture.
**Prune verdict: KEEP** (now actionable at its injection points). Its storytree-specific edge — the
parallel-independent, scope-owned framing — is what survives the blind-reconstruction test; the
generic "be read-only and minimal" half does not.

---

## What was NOT changed, and why (calibration)

- **`session-orchestrator`** — left alone. It orients lightly and *delegates* exploration and
  decomposition to the specialists that already hold those artifacts; its existing
  `pull-based-context-architecture` covers its own orientation. Adding any of the three would
  restate, not sharpen — and it is the highest-blast-radius surface (the CLAUDE.md region).
- **`red-builder`** — left alone (covered, above).
- The other six agents' mappings read as correct on this pass; no further re-routing.

---

## Recommendation to `oq-prune-reconstructible-guidance` (owner-held)

1. **The premise is stale — correct it.** The corpus is active guidance (the ADR-0051/0052/0053
   renderer), not a reference-only shelf. The binding fork the OQ tracks has resolved.
2. **Do not prune the three on the reference-only ground** — that condition no longer holds. All
   three are KEEP under the re-aimed lens (discriminatory power at a live injection point), and
   `deep-modules` is additionally a structural glossary anchor.
3. **The re-aimed question, if the owner wants to keep the OQ open:** of the two not rerouted here
   (`exploration-principles`, `recursive-decomposition-patterns`), does the *injected body* change a
   reconnaissance/decomposition session's behaviour, or would the model do the same thing unprompted?
   That is a friction-measurement question (does the read move the needle?), not a blind-reconstruction
   one — the natural job for `friction-analyst` once a few real runs of those roles exist.

Resolving the OQ (prune / keep / reframe) stays owner-held under ADR-0037 OQ hygiene; this review is
its input, not its verdict.

---

### Method note

Read-only review of the nine `agent` artifacts, the renderer (`agents.ts`), the live leaf wiring
(`sdk-author.ts`), ADR-0024/0029/0051/0052/0053/0055, and the V1 roster's `inputs.yml`
`required_reading` (read-only submodule `legacy/Agentic`, NOT authoritative — used for routing
*ideas*, not lifted). One seed edit applied: `deep-modules` added to `green-builder`'s `context`
(and the mirrored `references`); CLAUDE.md and `.claude/agents` are unaffected (`green-builder` is a
dedicated-surface agent). The live agent tier was reconciled with `storytree library sync-agents --pg`.
