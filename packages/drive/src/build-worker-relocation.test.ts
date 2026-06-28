// The worker-relocation contract suite (capability `worker-relocation`, story desktop-build-mount —
// ADR-0133 d.3). The build worker machinery moved out of apps/studio/server into this package so the
// desktop local backend may legally reuse it (an app may not import another app's server, ADR-0100).
//
// PROOF POSTURE — a relocation is not a free refactor (worker-relocation.md §"Proof posture"). A pure
// cut-and-paste is refactor-parity; the NET-NEW, spine-observable assertion is the PACKAGE-BOUNDARY
// CONTRACT this suite holds: `@storytree/drive/build-worker` did NOT exist at HEAD (importing the trio
// from "./build-worker.js" was module-not-found — the right-kind red), and the relocated module imports
// NOTHING from apps/* (the ADR-0100 wall the relocation exists to satisfy, mirroring the studio's
// modelPathBoundary precedent). The PARITY half — the re-pointed studio importers stay green from the
// new home — is observed by the real arm's suite proofCommand (the studio server suite), not this file.
//
// OFFLINE-TESTABLE BY INJECTION (ADR-0010 §5): a SCRIPTED BuildRunner (coarse lines + a terminal
// envelope, no SDK) and an injected isBuildable, over the REAL relocated BuildRegistry — so the moved
// worker's behaviour is proven WITHOUT a live SDK-billed build. The live driven desktop build is
// chat-drive-bridge's operator-attested leg, not this story's.
//
// Each test is NAMED for its `## Contracts` id (the ADR-0122/0126 coverage convention — one substantive
// test per contract, the name beginning with the contract id) → 4/4 covered.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  BuildRegistry,
  runBuildJob,
  dispatchAcceptedBuild,
  routedBuildRunner,
  type BuildContext,
  type BuildEnvelope,
  type BuildRunner,
} from "./build-worker.js";

/** Drain the event loop until the fire-and-forget worker reaches a terminal state (the studio pattern). */
async function waitTerminal(registry: BuildRegistry, runId: string, tries = 100): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (registry.getRun(runId)?.status !== "building") return;
    await new Promise<void>((r) => setTimeout(r, 5));
  }
  throw new Error(`run ${runId} never reached a terminal state`);
}

// ── wr-subpath-exports-the-worker-trio ───────────────────────────────────────
test("wr-subpath-exports-the-worker-trio: the new @storytree/drive/build-worker subpath resolves and exports the worker machinery, with routedBuildRunner routing by kind unchanged", async () => {
  // The existence proof: the trio + the BuildContext type import-resolve from the new subpath (at HEAD
  // "./build-worker.js" did not exist — the net-new module-not-found red).
  assert.equal(typeof BuildRegistry, "function", "BuildRegistry (the run registry class) is exported");
  assert.equal(typeof runBuildJob, "function", "runBuildJob (the worker) is exported");
  assert.equal(typeof dispatchAcceptedBuild, "function", "dispatchAcceptedBuild (the chat dispatch) is exported");
  assert.equal(typeof routedBuildRunner, "function", "routedBuildRunner (the tier router) is exported");
  // A typed value of BuildContext proves the type is exported + structurally intact (compile-time check
  // realised at runtime by constructing one).
  const ctx: BuildContext = {
    registry: new BuildRegistry(),
    runner: async () => ({ ok: true, body: "" }),
    isBuildable: async () => true,
  };
  assert.equal(typeof ctx.isBuildable, "function", "BuildContext is exported and structurally usable");

  // routedBuildRunner routes by KIND, unchanged by the move: a 'story' classify selects the story
  // branch (story build --real), a 'node' classify the node branch (node build --live).
  const seen: Array<{ unit: string; via: "story" | "node" }> = [];
  const router = routedBuildRunner({
    classify: async (id) => (id === "a-story" ? "story" : "node"),
    storyBuild: async (id) => {
      seen.push({ unit: id, via: "story" });
      return { ok: true, body: "story built" };
    },
    nodeBuild: async (id) => {
      seen.push({ unit: id, via: "node" });
      return { ok: true, body: "node built" };
    },
  });
  await router("a-story", () => {});
  await router("a-node", () => {});
  assert.deepEqual(seen, [
    { unit: "a-story", via: "story" },
    { unit: "a-node", via: "node" },
  ], "routedBuildRunner routes a story id to storyBuild and anything else to nodeBuild — the routing moved intact");
});

// ── wr-relocated-worker-behaves ──────────────────────────────────────────────
test("wr-relocated-worker-behaves: over the REAL relocated BuildRegistry + a scripted runner, dispatchAcceptedBuild validates, mints a run, fires runBuildJob, and the run reaches terminal passed with the scripted progress folded onto its transcript", async () => {
  const registry = new BuildRegistry();
  const runner: BuildRunner = async (unitId, sink): Promise<BuildEnvelope> => {
    assert.equal(unitId, "desktop-build-mount");
    sink("phase: AUTHOR_TEST");
    sink("phase: GATE");
    return { ok: true, body: "verdict: PASS\nsigned by operator" };
  };
  const build: BuildContext = {
    registry,
    runner,
    isBuildable: async (id) => id === "desktop-build-mount",
  };

  const result = await dispatchAcceptedBuild("desktop-build-mount", build);
  assert.equal(result.ok, true, "a buildable accepted id dispatches");
  if (!result.ok) return;
  assert.ok(result.runId, "the dispatch returns a runId to track the build");

  // The fire-and-forget worker runs asynchronously; wait for it to reach a terminal state.
  await waitTerminal(registry, result.runId);

  const run = registry.getRun(result.runId);
  assert.equal(run?.status, "passed", "the scripted runner drives the run to a terminal passed state");
  // The scripted runner's coarse lines + the envelope body lines are folded onto the transcript.
  assert.ok(run?.transcript.includes("phase: AUTHOR_TEST"), "the scripted progress streamed onto the transcript");
  assert.ok(run?.transcript.includes("phase: GATE"), "every scripted line streamed");
  assert.ok(run?.transcript.includes("verdict: PASS"), "runBuildJob folds the envelope body onto the transcript");
  assert.match(run?.envelope ?? "", /verdict: PASS/, "the terminal envelope carries the full body");
  // The single-build guard is released once the run terminates — identical behaviour from the new home.
  assert.equal(registry.hasActiveBuild(), false, "the single-build slot is released on terminalisation");
});

// ── wr-imports-nothing-from-apps ─────────────────────────────────────────────
test("wr-imports-nothing-from-apps: the relocated build-worker.ts imports nothing from apps/* (the ADR-0100 wall) — only node: builtins, the build entries injected", async () => {
  // Structural source read (the modelPathBoundary precedent): the module's IMPORT surface is its
  // collaborator set. Read the import lines ONLY — the prose comments legitimately mention
  // apps/studio/server (where the worker moved FROM), so a whole-file grep would false-positive.
  const source = await readFile(new URL("./build-worker.ts", import.meta.url), "utf8");
  const importLines = source.split("\n").filter((l) => /^\s*import\b/.test(l));

  // The relocation's reason-to-exist: no import resolves into a surface package (apps/*), so the desktop
  // can reuse this WITHOUT importing apps/studio/server. FALSE before the move (the machinery was IN
  // apps/studio/server), TRUE after.
  const fromApps = importLines.filter((l) => /\bapps\//.test(l));
  assert.deepEqual(fromApps, [], `build-worker.ts must import nothing from apps/* (ADR-0100); found: ${fromApps.join(" | ")}`);

  // It pulls in no agent/drive/store graph either — the build entries it drives are INJECTED
  // (RoutedBuildDeps / BuildContext), so the only static imports are node: builtins. This is what keeps
  // the relocated worker dependency-light and surface-free.
  const nonBuiltin = importLines.filter((l) => !/from\s+["']node:/.test(l));
  assert.deepEqual(nonBuiltin, [], `the relocated worker imports only node: builtins (its deps are injected); found: ${nonBuiltin.join(" | ")}`);
  // And it holds no signing/verdict/DB collaborator — a SAFE build INTENT, not a forge path (ADR-0091).
  const importSurface = importLines.join("\n");
  assert.doesNotMatch(importSurface, /signer|signVerdict|verdict|events|\bpg\b|Pool|\/store\b/i, "the worker imports no signer/verdict/DB path");
});

// ── wr-typed-refusal-moved-intact ────────────────────────────────────────────
test("wr-typed-refusal-moved-intact: an un-buildable id is a typed refusal (the worker never invoked), a second concurrent dispatch is the single-build refusal, and the dispatch hands back intent never a verdict (ADR-0091)", async () => {
  // (a) Un-buildable id → typed { ok: false, reason: "not buildable" }; the worker is NEVER invoked.
  {
    const registry = new BuildRegistry();
    let workerInvoked = false;
    const build: BuildContext = {
      registry,
      runner: async () => {
        workerInvoked = true;
        return { ok: true, body: "should not reach here" };
      },
      isBuildable: async () => false,
    };
    const result = await dispatchAcceptedBuild("no-such-unit", build);
    assert.equal(result.ok, false, "an un-buildable id is refused");
    if (result.ok) return;
    assert.equal(result.reason, "not buildable", "the typed refusal mirrors handleBuild's isBuildable guard");
    assert.equal(workerInvoked, false, "no run is minted + the worker is never invoked against an un-buildable id");
    assert.equal(registry.hasActiveBuild(), false, "no phantom active build lingers");
  }

  // (b) A second dispatch while a run is live → the single-build guard surfaced as a typed refusal.
  {
    const registry = new BuildRegistry();
    const occupied = registry.createRun("occupied-unit"); // occupy the single slot directly
    assert.equal(occupied.ok, true);
    const build: BuildContext = {
      registry,
      runner: async () => ({ ok: true, body: "should not reach here" }),
      isBuildable: async () => true,
    };
    const result = await dispatchAcceptedBuild("desktop-build-mount", build);
    assert.equal(result.ok, false, "a concurrent dispatch is refused");
    if (result.ok) return;
    assert.equal(result.reason, "a build is already running", "the registry single-build guard surfaces verbatim");
    if (occupied.ok) {
      assert.equal(registry.getRun(occupied.run.runId)?.status, "building", "the running run is left untouched");
      registry.terminalisePassed(occupied.run.runId, "cleanup"); // release the occupied slot
    }
  }

  // (c) INTENT, NEVER A VERDICT (ADR-0091): the result is a run handle, never a verdict-in.
  {
    const registry = new BuildRegistry();
    const build: BuildContext = {
      registry,
      runner: async () => ({ ok: true, body: "verdict: PASS" }),
      isBuildable: async () => true,
    };
    const result = await dispatchAcceptedBuild("desktop-build-mount", build);
    assert.equal(result.ok, true);
    assert.equal(Object.prototype.hasOwnProperty.call(result, "verdict"), false, "the dispatch returns intent (a runId), never a verdict");
    if (result.ok) await waitTerminal(registry, result.runId);
  }
});
