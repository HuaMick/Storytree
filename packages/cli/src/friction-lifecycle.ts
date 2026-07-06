// The friction lifecycle projection (ADR-0168 D2) — ONE definition shared by the two consumers that
// must agree: the capture CLI's `friction list` worklist view (`friction.ts`) and the drain-ceiling
// gate's pure core (`friction-drain.ts`). If these derived it separately they could drift, and the
// gate would count a backlog the worklist doesn't show. PURE by construction (no `node:` import) so
// the gate core stays DB-free and unit-testable — `friction.ts` carries `node:fs`, so the shared
// helper lives HERE, not there.

/**
 * A friction item's DERIVED lifecycle (ADR-0168 D2 — a projection of `route`, never stored): **open**
 * (no route) → **routed** (route set to a real destination) → **archived** (`route: nothing`, a
 * tombstone). Only OPEN items are un-adjudicated backlog.
 */
export type FrictionLifecycle = "open" | "routed" | "archived";

/**
 * Project a friction item's lifecycle from its `route`. No/empty route → open; `nothing` → archived
 * (the archive-with-reason tombstone); anything else (a `FrictionRoute` enum value) → routed. The
 * empty/null cases are defensive — a real friction doc's `route` is `undefined` or a valid enum.
 */
export function lifecycleOf(route: string | undefined | null): FrictionLifecycle {
  if (route === undefined || route === null || route === "") return "open";
  if (route === "nothing") return "archived";
  return "routed";
}
