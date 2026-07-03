---
status: accepted
decided: 2026-07-03
amends: [140]
---
# ADR-0146: Review-mode compose is inline click-to-edit suggesting, not affordance pills

## Status

accepted (2026-07-03) — decided/directed by the owner in conversation on 2026-07-03. Design-time
alignment IS the ratification (ADR-0110); no second end-of-flow ask. Amends ADR-0140 (fixes the
compose interaction it left open).

## Context

ADR-0140 decided **what** the Library Review mode is — a View↔Review toggle, inline block-anchored
comments, and suggestions rendered as the proposed result (no strikethrough) with the original behind
a "show change" toggle. It deliberately left **how a member composes a suggested edit** open. The
first build (caps 6–8, all signed-green on their underlying data/behaviour) resolved that gap with an
**affordance-pill** model: in Review mode each block grew hover-revealed "Comment" / "Suggest"
buttons, and "Suggest" opened a separate monospace `<textarea>` compose box beneath the block.

The owner reviewed it live (2026-07-03) and rejected the interaction: *"still doesn't feel like google
docs, a lot of the buttons don't seem to work, it's also overly complicated and slow. i like how the
boxes appear inline, but google docs would feel better if you can just edit it all like a word
processor."* Three concrete faults sat under that: (1) the per-block tools were `opacity:0` until you
hovered the exact block, so they read as broken/absent; (2) the compose box was a monospace form — a
"blocky form" feel, the opposite of prose; (3) actions only reconciled on the 30 s feed poll, so every
Post/Accept/Reject felt dead then popped in later ("slow"). The pill model also stacked interaction
layers (hover pill → separate compose → separate card) — "overly complicated." The one thing the owner
liked was the suggestion **boxes appearing inline** in the document flow.

The forces: the word-processor feel the owner wants (edit the prose directly) versus build tractability
(true whole-document `contenteditable` with a live markdown↔HTML round-trip and cursor/selection
management is the "why Google Docs is hard" problem); and keeping the three already-proven components
(the toggle, the inline comment thread, the suggestion view + its real accept-apply splice) — their
signed verdicts are about data/behaviour and still stand; only the **compose interaction** in the mount
is at issue.

## Decision

Review-mode compose is **inline click-to-edit suggesting**, not affordance pills. Concretely (owner
directed both forks in-session):

1. **Click-to-edit any block, in place.** In Review mode a block's prose is directly editable: clicking
   it swaps the rendered prose for a seamless inline editor styled to match the document typography —
   the document font, size, line-height and colour, no monospace, no bordered box, only a quiet focus
   affordance. It must feel like the caret just landed in the paragraph. There is **no** toolbar and
   **no** "Suggest" button. (The tractable substrate is an auto-growing prose-styled `<textarea>` per
   block, not whole-document `contenteditable` — it delivers the click-and-type feel a block at a time
   without the full-document editing engine. The block granularity is the existing block model, the
   `splitBlocks` content-hash handles from ADR-0140.)
2. **Edit becomes a suggestion on commit.** On blur / Cmd·Ctrl+Enter, if the block text changed, the
   edit is POSTed as a suggestion (`proposed` = the edit, `original` = the block's prior source, the
   drift witness); an unchanged block creates nothing. The new suggestion then renders **inline** as the
   proposed result — the inline box the owner liked — via the existing suggestion view.
3. **Everyone suggests (v1).** In Review mode **all** edits — including an admin's — become suggestions;
   there is no direct-inline-write path and no role branch in the editor. An admin still has the
   existing whole-document asset editor for direct writes, and still sees Accept/Reject on a suggestion
   (role-gated, unchanged). This is the simplest mapping of "suggesting mode" and honours the owner's
   "overly complicated" complaint; a Docs-style "admins edit directly, members suggest" split was
   considered and deferred as unnecessary complexity for v1.
4. **No hover-hidden controls; responsive feedback.** Nothing that acts is `opacity:0`-until-hover (the
   add-comment affordance is quiet but always visible). The Review surface polls its feed on a snappy,
   visibility-gated cadence so an Accept/Reject/Post reconciles in a few seconds, not on the 30 s
   presence cadence.

This supersedes the pill/compose-box interaction of the first caps-6–8 build. It does **not** disturb
those caps' signed verdicts: the toggle, the inline comment thread, the suggestion view (proposed-result
render + show-change + role-gated accept/reject + the accept-apply splice), and the block model / feed
seams are all reused unchanged — the change lives in the mount (`ReviewBlocks`).

## Consequences

- The compose interaction is a single gesture (click the prose, type, click away) instead of three
  stacked affordances — less to learn, less to render, and it reads as a word processor.
- The suggestion view's **own** internal compose input is no longer the compose path; in the mount it is
  rendered in a view posture so only its proposed-result render + accept/reject show. The component keeps
  that capability (its contract test still holds); the mount simply doesn't route compose through it.
- `contenteditable` at whole-document scope is explicitly **not** adopted — the per-block prose-styled
  editor is the deliberately bounded substrate. If a future need demands cross-block editing (merging
  paragraphs, multi-block selection), that is a fresh decision, not assumed here.
- The block-anchored, click-to-edit model makes the old text-selection annotation machinery
  (`annotate.ts` / `useAnnotations.tsx`) even more clearly dead; its removal remains the
  `remove-text-selection-anchoring` capability's clean swap (ADR-0140), now with more reason to land.
- The appearance is still owner-attested (ADR-0070); this ADR records the interaction decision, not a
  visual sign-off.

## References

- Amends ADR-0140 (Library Review mode — the model this fixes the compose gap in).
- ADR-0110 (design-time alignment is ratification — why this is born accepted).
- ADR-0070 (two-stage frontend proof — the look stays owner-attested).
- Story `library-review` — caps `collapsed-suggestion-view` (the suggestion view reused), the mount
  `ReviewBlocks` (`apps/studio/src/components/ReviewBlocks.tsx`, where the interaction lives), and
  `remove-text-selection-anchoring` (the clean swap this reinforces).
