---
status: accepted
decided: 2026-07-09
supersedes_in_part: [119]
load_bearing: true
---
# ADR-0176: The desktop app requires a reachable DB and a git checkout to launch — retire the degraded read shell

## Status

accepted (2026-07-09) — decided/directed by the owner in conversation on 2026-07-09, out of a
root-cause session on the recurring *"UAT tests unavailable: unknown endpoint"* bug in the desktop
app. Design-time alignment IS the ratification (ADR-0110); no second end-of-flow ask. **Supersedes in
part [ADR-0119](0119-thick-local-desktop-backend-a-tsx-sidecar-serving-the-studio.md)** — its
launch-time *degrade-to-a-read-shell* posture is retired for the desktop; 0119's tsx-sidecar
architecture, its boot read route table, and its re-compose-not-import boundary **stand**. The
APPEARANCE of the block / refuse experience remains operator-attested (ADR-0070).

## Context

The recurring desktop bug — *"UAT tests unavailable: unknown endpoint"* — traces to the sidecar
treating a live store as OPTIONAL at launch. `main()` in `apps/desktop/electron/backend-entry.ts`
calls `acquireBackendStore(() => createPool())`; on failure it runs `serveDegraded()` — a read-only
shell that **hand-re-mounts a SUBSET** of the real routes (`me`/`docs`, empty `comments`, and a
*hand-rolled* `/api/attestations` without the verdict overlay) while `chat`/`build`/`spawn` silently
404. That degraded shell is a **second, drifting copy** of the backend — exactly where routes go
missing (commit `f79fdfd` had to separately add `/api/attestations` to it "rather than 404-ing"). The
window opened into this half-wired state, and because the desktop `/api/me` still returns
`member: true` with `storeUnreachable` unset, the **forest RENDERED** with no proof overlays and a bare
"unreachable" strip — an honest-looking app that was not actually wired. This is the ADR-0119-realized
posture (`/api/health` NEVER 503; degrade to a read shell with a Start-DB banner), which extended
ADR-0033's per-read advisory-null contract all the way to pool CREATION.

The git repo was ALSO effectively optional: the code-stamp freshness signal
(`apps/desktop/src/apply/code-stamp.ts` `gitHead` → `git rev-parse HEAD`) returns `null` when there is
no repo, so ADR-0164's *"checkout moved → rebuild & relaunch"* trigger silently never fires and a stale
build runs invisibly. The desktop runs a **dev-mode build from the member's checkout** (ADR-0113 §7),
so a git checkout is a real architectural precondition today, not an optional nicety.

Two facts made "require it" cheap and safe:

- `@storytree/drive`'s **`ensureLiveDb`** (ADR-0060 / ADR-0063) already does exactly the wanted launch
  behavior: probe the live store, **auto-wake** it via the keyless Cloud SQL Admin REST control plane
  (`setActivationPolicy("ALWAYS")` — ADR-0063 / ADR-0021, no gcloud, works on the desktop), and **poll
  until it accepts connections or a bounded 420 s ceiling**, then refuse with a clear reason. Its
  `ensureDbUp` core is pure over injected effects (fake-clock unit-tested).
- The Cloud SQL data socket (port 3307) the probe needs is reachable from a real desktop machine; only
  **REMOTE web/VM sessions** (443-only egress, ADR-0063) can't open it — and those never run the
  desktop Electron sidecar. So a hard DB requirement is naturally **scoped to the real desktop app** and
  cannot brick remote sessions or the DB-free CI.

## Decision

**The desktop app HARD-REQUIRES a reachable DB and a git checkout to launch. There is no degraded read
shell.**

1. **Block-until-ready with a bounded auto-wake, then refuse** (owner UX call, 2026-07-09). At launch
   the sidecar runs a launch-precondition gate:
   - **Git checkout first** — if `git rev-parse HEAD` fails (no repo), refuse immediately with *"run
     storytree from a git checkout"* (waking the DB would be pointless, and re-probing on Retry is the
     only path that helps).
   - **DB reachable, auto-waking** — reuse `ensureLiveDb`: probe → if down, wake via REST → poll until
     it answers or the bounded ceiling (420 s default) elapses. The app **attempts to wake the DB on
     launch** (owner directive); the ceiling is the *"put a timeout / max retries on it"* the owner
     asked for — a cold Cloud SQL start (~5–6 min) fits inside it, and a genuinely unreachable DB
     **refuses rather than hanging forever**.

   The gate returns a typed outcome: `ready` | `refused { unmet: "git-repo" | "db", reason }`.

2. **The full backend is wired ONLY when both preconditions hold — one route table, never a partial
   copy.** `serveDegraded` / `degradedBackend` are **deleted**. On a refusal the sidecar exits with the
   typed reason (surfaced through `describeSidecarExit`); it never serves a subset of routes. This is
   the change that kills the drift class — there is now exactly one fully-wired backend, or none.

3. **The Electron main process is the launch surface** (Rail 1, ADR-0164). While the sidecar comes up
   it shows a *"starting — connecting to the database"* splash (the block-until-ready surface); on the
   port handshake it loads the studio (fully wired); on a **pre-handshake sidecar exit** it shows a
   clear **refuse screen** naming the unmet precondition with a **Retry** that re-runs the gate. No
   half-wired forest, ever. The splash / refuse window flow is the operator-attested glue (the look),
   like the rest of the sidecar wiring (ADR-0119 §3).

4. **Scope: the DESKTOP launch posture only.** ADR-0033's per-read advisory contract is **unchanged for
   a running app** — a DB that blips MID-SESSION still nulls overlays (the tree under-claims, never a
   throw). What changes is LAUNCH: you cannot START half-wired. Remote web/VM sessions (ADR-0063) and
   the DB-free gate / CI never run this sidecar, so the requirement cannot brick them.

## Consequences

**Good.**
- Kills the drift class: the degraded shell was a second, hand-maintained route table that silently
  lost routes (the "unknown endpoint" bug). Deleting it means there is exactly one fully-wired backend
  or none — the failure mode is impossible by construction.
- ADR-0164's rebuild-on-HEAD-advance signal becomes reliable: a git checkout is guaranteed, so the
  code-stamp always resolves.
- Reuses `ensureLiveDb`'s proven auto-wake + bounded-wait (ADR-0060 / ADR-0063) rather than reinventing
  a retry loop — the launch gate is a thin, headlessly-provable composition (git-gate → `ensureDb`).

**Bad / accepted costs.**
- A cold DB start adds a visible wait (up to the ceiling) before the app is usable — surfaced as a
  splash, bounded, then refuse+retry. Acceptable: the alternative was an app that LOOKED up but wasn't.
- A genuinely-offline member cannot open the desktop app at all (by design — it is a thick client over
  the shared forest, ADR-0113). Offline READ is the CLI's job (in-memory seed), not the desktop app's.
- The splash + refuse+retry window flow is new operator-attested glue (the look), owner-attested per
  ADR-0070.
- A future **packaged** desktop build (past dev-mode-from-checkout, ADR-0113 §7 / ADR-0119) would
  revisit the git-checkout requirement (a precompiled sidecar has no checkout); today's decision is
  scoped to the dev-mode-from-checkout app that ships now.

## References

- [ADR-0119](0119-thick-local-desktop-backend-a-tsx-sidecar-serving-the-studio.md) — the thick-local
  desktop sidecar; **superseded in part**: its launch-time degrade-to-a-read-shell posture is retired
  for the desktop. The tsx-sidecar architecture, the boot read route table, and the
  re-compose-not-import boundary **stand**.
- [ADR-0033](0033-session-presence-notice-board.md) — the per-read advisory-null contract is unchanged
  for a RUNNING app; only launch-time degrade is retired.
- [ADR-0164](0164-the-desktop-app-self-restarts-to-apply-a-merged-fix-the-elec.md) — Rail 1 (the
  Electron main is the supervisor / launch surface) is honored; requiring a git checkout makes Rail 2's
  HEAD-advance trigger reliable.
- [ADR-0060](0060-live-and-real-builds-own-the-database-default-store-pg-auto.md) /
  [ADR-0063](0063-db-control-over-the-cloud-sql-admin-rest-api-retire-the-gclo.md) — `ensureLiveDb`
  (probe → auto-wake → bounded poll) is reused as the DB half of the launch gate; keyless REST works on
  the desktop.
- [ADR-0021](0021-keyless-agent-session-auth-and-db-bootstrap.md) — the auto-wake + probe authenticate
  via ambient ADC; unchanged.
- [ADR-0113](0113-thick-local-desktop-for-the-inner-circle-the-drive-machinery.md) — the desktop runs
  dev-mode from the member's checkout (the git-checkout precondition) and is a thick client over the
  shared forest (why offline launch is out of scope).
- [ADR-0174](0174-interactive-builds-run-in-an-in-app-terminal-not-the-in-app.md) /
  [ADR-0175](0175-repurpose-don-t-delete-the-in-app-orchestrator-chat-infrastr.md) — the concurrent
  desktop pivot (retire the in-app interactive orchestrator for an embedded terminal; repurpose the chat
  infra into a future `app-guide`). ORTHOGONAL: this launch gate protects the **observability sidecar**
  (forest / wisps / verdicts / presence), which both ADRs KEEP — and the embedded terminal runs Claude
  Code against the repo, which needs the git checkout — so "require DB + git at launch" underpins the
  pivoted desktop too.
- [ADR-0110](0110-collapse-the-redundant-end-of-flow-adr-ratification.md) — owner-directed → born
  accepted.
- [ADR-0070](0070-frontend-as-an-inner-loop-role-the-two-stage-proof-for-visua.md) — the block / refuse
  APPEARANCE is operator-attested.
- Code: `apps/desktop/electron/backend-entry.ts` (`main()` gate replacing `serveDegraded`),
  `apps/desktop/src/backend/sidecar-startup.ts` (`degradedBackend` removed),
  `apps/desktop/electron/main.ts` (splash + refuse+retry window flow),
  `packages/drive/src/db-control.ts` (`ensureLiveDb`, reused).
