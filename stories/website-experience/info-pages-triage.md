---
id: "info-pages-triage"
tier: capability
story: website-experience
title: "The info-page triage — every legacy page folded, discarded, or kept, and the CMS question answered"
outcome: "Every legacy informational page (how-it-works, roadmap, landscape, constitution, contact, get-involved — and the 404) carries an explicit, EXECUTED disposition: folded into Act 2 where natural, discarded, or kept as a plain static page; kept pages are reachable from the calm world with no orphan links anywhere; check:web-grounding stays green over every surviving claim; and the disposition set answers whether Keystatic survives — recorded as its own ADR when decided."
status: proposed
proof_mode: operator-attested
depends_on: [act2-guided-walkthrough, act2-guided-forest]
decisions: [134, 148, 167]
# OPERATOR-ATTESTED, human witness — owner decision 5 (2026-07-02) names the triage itself as
# owner-attested CONTENT work: which page folds, which dies, and which stays is editorial judgement
# about the site's voice, not a machine call. The machine floor it must leave green already exists:
# check:web-grounding (every surviving data-grounds claim resolves to a live ADR) and the site's own
# build (no orphan links/routes). NO `proof:` block — witnessed, not `--real`-built. This is a HALT
# point for the driving session: per-page dispositions are proposed to the owner, never decided
# unilaterally.
---

# The info-page triage — every legacy page folded, discarded, or kept, and the CMS question answered

**Outcome —** Every legacy informational page (`how-it-works`, `roadmap`, `landscape`,
`constitution`, `contact`, `get-involved` — and the `404`) carries an explicit, **EXECUTED**
disposition: **folded into Act 2** where natural, **discarded**, or **kept as a plain static page**;
kept pages are reachable from the calm world with no orphan links anywhere; `check:web-grounding`
stays green over every surviving claim; and the disposition set answers whether **Keystatic
survives** — recorded as its own ADR when decided.

**Depends on —** [`act2-guided-walkthrough`](act2-guided-walkthrough.md) (increment G) — you cannot
fold a page into an Act 2 that is not there; the fold targets (which beat absorbs which page's job)
only become concrete once the beats exist on the site. Also
[`act2-guided-forest`](act2-guided-forest.md) (increment H, ADR-0148) — the roadmap-class fold
targets ("what's coming" behind the pull-back / "what's next") live in H's upstream-forest reveal, so
they are only concrete once the guided forest exists.

> **Proof status (honest) — BUILT + OWNER-ATTESTED, LIVE (2026-07-06); the authored status stays
> `proposed` (healthy is earned via the proof machinery, ADR-0020 — operator-attested caps carry
> their record in prose).** The full proof shape ran in one session (sleepy-curran-655722): the
> owner SIGNED the per-page disposition table at the gate (approved as proposed, plus calls A–C),
> the session EXECUTED it on storytree-web's rail, and the owner WITNESSED the executed result at
> the staged preview and attested — verdict relayed verbatim on web PR #28 (ADR-0044 §4 /
> ADR-0082): "Attest — land it" (HuaMick, 2026-07-06, at `0b42c44`). PR #28 squash-merged → web
> main `be960873`, CD green, LIVE (verified: every kept page 200, both stubs resolve, all three
> `data-experience-*` markers intact). The signed set + the Keystatic retirement are recorded as
> **ADR-0167** (born accepted, ADR-0110); story open call 4 is CLOSED by it.

## Guidance

THE FRAME (owner decision 5). Per page, exactly one of:

- **Fold into Act 2** — the page's job is absorbed by a beat or the CTA state (candidates: the
  how-it-works narrative IS the five beats; the roadmap's "what's coming" may live behind the
  pull-back / CTA). Folding means the page's URL redirects or retires WITH its inbound links
  updated — never a dead route.
- **Discard** — the page's job no longer exists post-experience. Discard is honest deletion (plus
  redirect where external links are known), not an unlinked zombie.
- **Keep as a plain static page** — the page earns its keep as calm reference (candidates:
  constitution, contact, get-involved as the CTA target). Kept pages stay reachable from the calm
  world (a quiet, findable place — footer of the calm land / the CTA cluster; never a demand inside
  the storm), keep their `data-grounds` attributes, and stay inside `check:web-grounding`.

THE CMS CONSEQUENCE (ADR-0134 §5 — decided BY this triage, not before it). If no surviving page
needs CMS editing, Keystatic retires with the discarded pages; if kept pages remain CMS-edited, it
stays for exactly those. Either way the call is recorded as its own ADR when the disposition set is
accepted (`storytree adr new --pg`, born of this owner sign-off) — story open call 4.

THE PROCESS IS THE PROOF SHAPE. The driving session PREPARES the triage (a per-page disposition
table with rationale + the fold-target mapping), the owner ATTESTS it (a HALT point — dispositions
are proposed, never decided unilaterally), then the session EXECUTES it on the web repo's rail and
the owner witnesses the executed result. Machine sub-legs ride existing gates: the site builds
clean (no orphan routes/links) and `check:web-grounding` is green over the survivors — this
capability adds no new gate machinery.

FENCES: do not redesign kept pages here (keep-static means KEEP — restyling is its own later call);
do not move claim-bearing copy out from under its `data-grounds` attribute; do not decide the
Keystatic ADR inside this capability — record it separately once the owner has signed the
dispositions.

## UAT (operator-attested)

1. **The disposition table exists and is owner-signed.** _(witness: human)_ Every page listed above
   carries exactly one disposition with a one-line rationale; the owner has attested the set (the
   HALT point) before execution.
2. **The dispositions are executed, not declared.** _(witness: human)_ Folded pages' jobs are
   findable in Act 2 and their old URLs resolve sensibly; discarded pages are gone with no dangling
   inbound links; kept pages render as plain static pages reachable from the calm world.
3. **The machine floor stayed green.** _(witness: machine)_ The web repo builds clean and
   `check:web-grounding` passes over every surviving claim — no grounding was silently lost in the
   shuffle.
4. **The CMS question has an answer.** _(witness: human)_ The disposition set states whether any
   surviving page still needs Keystatic; the follow-up ADR recording that call is drafted (accepted
   or proposed per the owner's direction at the HALT).

## As built (web main `be960873`, 2026-07-06, live at https://crisp-globe-bf6v.here.now/)

The signed set (owner, 2026-07-06, approved as proposed): **KEEP static** `/how-it-works/` (+2
decided riders) · `/get-involved/` · `/contact/` · `/constitution/` · `/404`; **DISCARD**
`/roadmap/` → redirect `/get-involved/` and `/landscape/` → redirect `/how-it-works/`. No page
folded INTO Act 2 — the experience already carried the how-it-works narrative; the fold candidates
resolved to keep-static (the deep-dive keeps a live job, ADR-0165 §8) or discard-with-salvage.
Full rationale + the three owner calls: **ADR-0167** (the sign-off record).

- **Discards + redirects:** `web/astro.config.mjs:52-55` (`redirects` — static meta-refresh stubs
  with canonical + noindex; here.now has no server redirects). Deleted: `roadmap.astro`,
  `landscape.astro`, `roadmap.json`, `roadmap-page.json`, `landscape.json`, `RoadmapDag.astro`,
  `Scorecard.astro`, `ConvergenceTimeline.astro`. Substance salvaged FIRST (owner rider at the
  sign-off) → `docs/research/retired-web-roadmap-2026-07.md` +
  `docs/research/retired-web-landscape-2026-07.md`.
- **Nav/Footer pruned:** `web/src/components/Nav.astro:5-9` (How it works · Get involved · Front
  door + "Ask to come in"); `web/src/components/Footer.astro:12-16` (+ Home, Constitution).
- **Rider (a) — the ADR-0165 §8 terms section:** `web/src/pages/how-it-works.astro:131-144`
  (section marked `data-grounds="ADR-0165"` at :137), copy at
  `web/src/data/how-it-works.json:82-96` — the generation–verification loop Karpathy described,
  the verification gap (Sonar Jan-2026, "fully" kept), second brain (Forte's term); §9 honesty
  rules bound the wording (no "Karpathy loop", relocation-not-elimination, no direct pull-quotes).
  Honesty fix riding it: `mapBody1`'s Sonar date corrected "mid-2026" → "January-2026" (the
  verified source: The Register, 2026-01-09).
- **Rider (b) — the jargon scrub (ADR-0157 de-storm scoping):** `web/src/data/mockSystem.json:102`
  ("Recovering dropped connections"), `:103` ("Keeping up under load"), `:153` (rowan "fixing the
  Monday outage" @ `fix/monday-outage`). Cohoot fiction, statuses, DAG shape intact.
- **Owner call A (constitution):** `web/src/content/constitution.md:21` — the roadmap clause
  removed; pure deletion, no new words in the founder's voice (the body's do-not-rewrite rule
  holds).
- **Owner call B (Keystatic RETIRES — ADR-0167 supersedes ADR-0101):** deleted
  `keystatic.config.ts`, `@keystatic/*`/`@astrojs/react`/`@astrojs/node`/`cross-env` deps + the
  editor scripts (`web/package.json`), `scripts/publish-content.mjs`, `.env.example`, `Dockerfile`,
  `web-editor-cloudbuild.yaml`, `.github/workflows/deploy-editor.yml`; `src/data/*.json` STAY
  (pages read them directly — editing is file edits). The live Cloud Run `storytree-web-editor`
  was decommissioned post-merge with explicit owner approval at the same gate (verified deleted;
  `storytree-studio` untouched).
- **Owner call C:** web PRs #8 + #15 closed as superseded with disposition comments (branches kept
  for salvage).
- **Machine floor (UAT 3, witnessed):** astro build green (6 pages + 2 stubs); ZERO orphan hrefs
  to the discarded routes in dist; the three parent gates OK against the executed tree AND against
  the bumped pin (`check:web-grounding` 3 refs / 2 claims incl. the new ADR-0165 section;
  `check:web-engine` 12 files untouched-in-sync; `check:web-experience` markers + WebGL-free
  closure intact); every route HTTP-witnessed at the staged preview and re-verified LIVE
  post-publish.
- **Attestation record (UAT 1 + 2 + 4):** the table signed at the gate; the executed result
  witnessed at the staged preview (`stage-the-attestation-experience`); verdict verbatim on web PR
  #28 — "Attest — land it" (HuaMick, 2026-07-06 @ `0b42c44`); the CMS answer recorded as ADR-0167.
