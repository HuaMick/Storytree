// The builder-leaf spawn dispatch (capability builder-spawn-dispatch, ADR-0137 d.1 /
// ADR-0108 d.5 / ADR-0091).
//
// A THIRD CALLER OF ONE WORKER (ADR-0090 / desktop-build-mount precedent): the
// agent/orchestrator spawn side routes through the EXISTING routed build worker,
// exactly as the studio /api/build handler and the desktop accept click do.  No
// tier re-routing, no flag special-casing — a third caller of the same
// BuildContext → runBuildJob machinery.
//
// SAFE WRITE — INTENT, NEVER A VERDICT (ADR-0091): this module holds no signing
// key, parses no verdict, and exposes no verdict-shaped type.  The spine inside
// the worker observes RED→GREEN and signs; CI re-proves before trunk (ADR-0022).

import {
  type BuildContext,
  type DispatchResult,
  dispatchAcceptedBuild,
} from "./build-worker.js";

/**
 * Dispatch a unit id to the existing build worker from the agent/orchestrator
 * spawn side — the third caller of the SAME worker the human's accept click uses
 * (ADR-0090 / ADR-0133 d.3 / ADR-0137 d.1).
 *
 * - Validates `unitId` via `build.isBuildable` (typed refusal if not buildable;
 *   the orchestrator surfaces the refusal in conversation — the honest failure is
 *   the feature, ADR-0091).
 * - Mints a run via `build.registry.createRun` (typed refusal on the
 *   single-build-at-a-time guard).
 * - Fires `runBuildJob` fire-and-forget; coarse progress streams into the registry
 *   run's transcript for the chat surface.
 * - Returns `{ ok: true, runId }` so the chat surface can track the build.
 *
 * Never throws on a known outcome (refuse garbage fail-closed, ADR-0091).
 */
export async function spawnBuilderDispatch(
  unitId: string,
  build: BuildContext,
): Promise<DispatchResult> {
  return dispatchAcceptedBuild(unitId, build);
}
