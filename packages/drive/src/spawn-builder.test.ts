// The builder-leaf spawn dispatch contract (capability builder-spawn-dispatch, ADR-0137 d.1 /
// ADR-0108 d.5 / ADR-0091).
//
// spawn-builder.ts does not exist yet — the RED is a runtime module-not-found on the import below.
// The implementation is injection-pure over an injected BuildContext so the proof runs over
// scripted doubles with zero live builds and zero DB (ADR-0010 §5). Imports only node: builtins +
// relative files: build-worker.ts imports only node:crypto, so the whole tree resolves without
// package deps (the node spec's "NO install" guarantee, the take-claim-at-spawn precedent).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// BuildRegistry is a VALUE import from the existing relocated worker — only node:crypto underneath,
// so it resolves without node_modules. BuildContext / BuildRunner / BuildEnvelope are type-only
// (erased at runtime) and serve only to type the scripted doubles below.
import {
  BuildRegistry,
  type BuildContext,
  type BuildRunner,
  type BuildEnvelope,
} from "./build-worker.js";

// VALUE import from the NOT-YET-EXISTING spawn-builder.ts — module-not-found is the right-kind RED.
import { spawnBuilderDispatch } from "./spawn-builder.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Drain the event loop until the fire-and-forget worker reaches a terminal state. */
async function waitTerminal(registry: BuildRegistry, runId: string, tries = 100): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if (registry.getRun(runId)?.status !== "building") return;
    await new Promise<void>((r) => setTimeout(r, 5));
  }
  throw new Error(`run ${runId} never reached a terminal state`);
}

// ---------------------------------------------------------------------------
// Contract 1 — bsd-dispatches-through-the-existing-routed-worker
// ---------------------------------------------------------------------------
//
// A buildable unit id is validated via the injected isBuildable precheck then handed to the
// injected routed runner/registry UNMODIFIED — no tier re-routing, no flag special-casing, just
// a third caller of the SAME worker the human's accept click uses — returning a typed { runId }
// the chat surface can track.

test("bsd-dispatches-through-the-existing-routed-worker: a buildable unit id is validated via isBuildable then routed to the existing worker unmodified, returning a typed runId", async () => {
  const registry = new BuildRegistry();
  let dispatchedId: string | undefined;
  const runner: BuildRunner = async (unitId, sink): Promise<BuildEnvelope> => {
    dispatchedId = unitId;
    sink("phase: AUTHOR_TEST");
    sink("phase: GATE");
    return { ok: true, body: "verdict: PASS\nsigned by the spine" };
  };
  let isBuildableCalledWith: string | undefined;
  const build: BuildContext = {
    registry,
    runner,
    isBuildable: async (id) => {
      isBuildableCalledWith = id;
      return id === "target-unit";
    },
  };

  const result = await spawnBuilderDispatch("target-unit", build);

  assert.equal(result.ok, true, "a buildable unit id is dispatched successfully");
  if (!result.ok) return;

  // isBuildable was consulted with the SAME unit id before any dispatch
  assert.equal(
    isBuildableCalledWith,
    "target-unit",
    "isBuildable precheck is consulted with the SAME unit id before dispatch",
  );
  // a tracked runId comes back for the chat surface to poll
  assert.ok(result.runId.length > 0, "a non-empty runId is returned so the chat surface can track the build");

  await waitTerminal(registry, result.runId);

  // the routed runner received the SAME id — no re-routing by this dispatch
  assert.equal(
    dispatchedId,
    "target-unit",
    "the routed runner received the SAME unit id (no re-routing or flag special-casing by the dispatch)",
  );
  const run = registry.getRun(result.runId);
  assert.equal(run?.status, "passed", "the existing worker drives the scripted runner to a terminal passed");
  assert.equal(
    registry.hasActiveBuild(),
    false,
    "the single-build guard releases when the run terminalises",
  );
});

// ---------------------------------------------------------------------------
// Contract 2 — bsd-refuses-unbuildable-or-unknown
// ---------------------------------------------------------------------------
//
// An unknown id, a malformed spec, or a unit failing the isBuildable precheck returns a typed
// refusal (the reason named for the conversation); the routed runner is NEVER invoked; nothing
// throws. The orchestrator surfaces the refusal in conversation and re-judges — the honest
// failure is the feature.

test("bsd-refuses-unbuildable-or-unknown: an un-buildable or unknown id is a typed refusal — the runner is never invoked and nothing throws", async () => {
  let invoked = 0;
  const makeContext = (buildable: boolean): BuildContext => ({
    registry: new BuildRegistry(),
    runner: async () => {
      invoked += 1;
      return { ok: true, body: "unreached" };
    },
    isBuildable: async () => buildable,
  });

  // un-buildable id → typed refusal, worker never invoked
  const refused = await spawnBuilderDispatch("no-such-unit", makeContext(false));
  assert.equal(refused.ok, false, "an un-buildable id returns ok:false (typed refusal, not a throw)");
  if (!refused.ok) {
    assert.ok(refused.reason.length > 0, "the typed refusal carries a non-empty reason for the conversation");
  }
  assert.equal(invoked, 0, "the runner is NEVER invoked for an un-buildable id — no dispatch against nothing");

  // a second un-buildable id — still no dispatch, still typed
  const refused2 = await spawnBuilderDispatch("malformed-spec", makeContext(false));
  assert.equal(refused2.ok, false, "a second un-buildable id is also refused typed");
  assert.equal(invoked, 0, "the runner remains un-invoked after two refusals");
});

// ---------------------------------------------------------------------------
// Contract 3 — bsd-progress-is-text-never-a-verdict
// ---------------------------------------------------------------------------
//
// The worker's coarse progress lines fold back as ordered TEXT for the chat surface; the
// dispatch's result carries NO verdict/signing/proof-status shape (the spine inside the worker
// signs out-of-band, ADR-0091 — there is structurally nothing for the chat to hand in or relay
// as a verdict). The module source must not import or export verdict/signing/landing symbols.

test("bsd-progress-is-text-never-a-verdict: coarse progress folds back as ordered text on the transcript, and the dispatch result and module surface carry no verdict/signing/landing shape (ADR-0091)", async () => {
  const registry = new BuildRegistry();
  const runner: BuildRunner = async (_unitId, sink): Promise<BuildEnvelope> => {
    sink("▸ phase: AUTHOR_TEST");
    sink("▸ phase: IMPLEMENT");
    sink("▸ phase: GATE");
    return { ok: true, body: "build complete" };
  };
  const build: BuildContext = { registry, runner, isBuildable: async () => true };

  const result = await spawnBuilderDispatch("text-unit", build);
  assert.equal(result.ok, true, "a buildable id dispatches successfully");
  if (!result.ok) return;

  await waitTerminal(registry, result.runId);
  const run = registry.getRun(result.runId);
  const transcript = run?.transcript ?? [];

  // coarse progress folds back as ordered text (oldest-first, as the worker streams them)
  assert.ok(
    transcript.some((l) => l.includes("AUTHOR_TEST")),
    "the AUTHOR_TEST progress line folds onto the transcript as text for the chat surface",
  );
  assert.ok(
    transcript.some((l) => l.includes("GATE")),
    "the GATE progress line folds onto the transcript as text for the chat surface",
  );
  const authorIdx = transcript.findIndex((l) => l.includes("AUTHOR_TEST"));
  const gateIdx = transcript.findIndex((l) => l.includes("GATE"));
  assert.ok(
    authorIdx >= 0 && gateIdx >= 0 && authorIdx < gateIdx,
    "progress lines appear in order — oldest-first, as the worker streams them",
  );

  // the dispatch result carries no verdict/signing/landing field — intent only (ADR-0091)
  assert.ok(
    !Object.prototype.hasOwnProperty.call(result, "verdict"),
    "the dispatch result has no verdict field (the spine inside the worker signs out-of-band, ADR-0091)",
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(result, "signed"),
    "the dispatch result has no signed field (ADR-0091)",
  );

  // structural: the module's exported API carries no verdict/signing/landing symbol
  // (read after the module-not-found RED is resolved by the implementation)
  const src = readFileSync(fileURLToPath(new URL("./spawn-builder.ts", import.meta.url)), "utf8");
  const noComments = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const exportLines = noComments.split(/\r?\n/).filter((l) => /\bexport\b/.test(l)).join("\n");
  assert.ok(
    !/\bverdict\b|\bsigning\b|\bsigner\b|\bopenPr\b|\blandPr\b|\bmergeCommit\b/i.test(exportLines),
    "spawn-builder.ts exports no verdict/signing/landing shape — intent in, { runId } out (ADR-0091)",
  );
});
