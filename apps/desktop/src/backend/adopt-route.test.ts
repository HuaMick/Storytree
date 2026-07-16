// Integration test for the desktop adopt-route MOUNT (the unmounted sibling of build-route.ts — the
// desktop-only /api/adopt gap, closed the same way PR #751 closed /api/docs/content).
//
// WHAT IT PINS: createAdoptRouteMount serves POST /api/adopt (validate isAdoptable → mint on the SHARED
// registry → fire-and-forget → 202 {runId}) with typed refusals (400/409/405) and a chain fall-through
// (false for an unrelated path). It is driven over a REAL node:http server against the REAL relocated
// BuildRegistry + runBuildJob (@storytree/drive/build-worker) with a SCRIPTED runner + an injected
// isAdoptable — no SDK, no DB, no Electron (ADR-0010 §5). The adoption run rides the SAME registry a
// build uses, so progress is polled via the EXISTING GET /api/build?runId — the test chains the build
// mount alongside to exercise that real cross-mount poll path (ADR-0097: one registry, one poll path).
//
// THE BOUNDARY (ADR-0100): the mount imports the worker by PACKAGE name (@storytree/drive/build-worker),
// never apps/studio/server. `adr-imports-worker-by-package-not-app` pins this structurally.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BuildRegistry } from "@storytree/drive/build-worker";
import type { BuildRunner } from "@storytree/drive/build-worker";

import { createAdoptRouteMount } from "./adopt-route.js";
import type { AdoptContext } from "./adopt-route.js";
import { createBuildRouteMount } from "./build-route.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** The chain-dispatcher signature createAdoptRouteMount returns. */
type ChainHandler = (req: IncomingMessage, res: ServerResponse, pathname: string) => Promise<boolean>;

/**
 * Spin up a node:http server that chains the given mounts (adopt first, then build so GET /api/build?runId
 * resolves), 404-ing if every mount falls through — mirrors the desktop sidecar's dispatcher chain.
 * Closes before return.
 */
async function withServer(mounts: ChainHandler[], fn: (base: string) => Promise<void>): Promise<void> {
  const server = createServer((req, res) => {
    void (async () => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      for (const mount of mounts) {
        if (await mount(req, res, pathname)) return;
      }
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "not found" }));
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

/** The GET /api/build?runId wire body (the adoption run is polled through it). */
interface BuildStatusBody {
  runId: string;
  unitId: string;
  status: "building" | "passed" | "failed";
  transcript: string[];
  envelope?: string;
  reason?: string;
}

/** A scripted runner: emits `lines` as coarse progress, then resolves with the given envelope. */
function scriptedRunner(
  lines: readonly string[],
  envelope: { ok: boolean; body: string },
): { runner: BuildRunner; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    runner: async (_storyId, sink) => {
      calls += 1;
      for (const line of lines) sink(line);
      return envelope;
    },
  };
}

async function postAdopt(base: string, storyId: string): Promise<Response> {
  return fetch(`${base}/api/adopt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyId }),
  });
}

/** Poll GET /api/build?runId until the run leaves `building` — the desktop settle pattern. */
async function pollUntilTerminal(base: string, runId: string): Promise<BuildStatusBody> {
  for (let i = 0; i < 100; i += 1) {
    const res = await fetch(`${base}/api/build?runId=${encodeURIComponent(runId)}`);
    const body = (await res.json()) as BuildStatusBody;
    if (body.status !== "building") return body;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`run ${runId} did not terminalise`);
}

/** A build mount over the SAME registry — serves GET /api/build?runId so the adoption run can be polled.
 *  Its own build seam is inert (isBuildable false); it only reads the shared registry here. */
function buildMountOver(registry: BuildRegistry): ChainHandler {
  return createBuildRouteMount({
    registry,
    runner: async () => ({ ok: true, body: "unused" }),
    isBuildable: async () => false,
  });
}

// ---------------------------------------------------------------------------
// Contract 1 — adopt-post-dispatches-adoptable-story
// ---------------------------------------------------------------------------

// An adoptable POST validates isAdoptable, mints a run on the REAL relocated registry, fires runBuildJob
// over the injected runner, returns 202 { runId }; once drained, GET /api/build?runId (the shared poll
// path) reports passed + the scripted progress.
test("adopt-post-dispatches-adoptable-story: an adoptable POST mints + runs, 202 + runId, polled passed via GET /api/build", async () => {
  const registry = new BuildRegistry();
  const { runner, calls } = scriptedRunner(["▸ adopting: observe gates", "▸ mapped → proposed"], {
    ok: true,
    body: "verdict: PASS",
  });
  const adopt: AdoptContext = { registry, runner, isAdoptable: async () => ({ ok: true }) };
  const mounts = [createAdoptRouteMount(adopt), buildMountOver(registry)];

  await withServer(mounts, async (base) => {
    const res = await postAdopt(base, "brownfield-story");
    assert.equal(res.status, 202, "an adoptable story id is accepted with 202");
    const body = (await res.json()) as { runId?: unknown };
    assert.equal(typeof body.runId, "string", "the POST returns a tracked runId");
    assert.ok((body.runId as string).length > 0, "the runId is non-empty");

    const terminal = await pollUntilTerminal(base, body.runId as string);
    assert.equal(terminal.status, "passed", "the fired adoption drains to a terminal passed over the relocated worker");
    assert.equal(terminal.unitId, "brownfield-story", "GET carries the run's story id");
    assert.ok(
      terminal.transcript.some((l) => l.includes("mapped → proposed")),
      "the scripted runner's coarse progress is on the polled transcript",
    );
    assert.match(terminal.envelope ?? "", /verdict: PASS/, "the terminal envelope carries the adoption body");
    assert.equal(calls(), 1, "the injected runner was invoked exactly once");
  });
});

// ---------------------------------------------------------------------------
// Contract 2 — adopt-refuses-unadoptable-story
// ---------------------------------------------------------------------------

// A non-brownfield / already-proven story (isAdoptable {ok:false, reason}) → 409 carrying the reason, and
// runBuildJob is NEVER invoked (no adoption against nothing) — the handleAdopt 409 contract, on the desktop.
test("adopt-refuses-unadoptable-story: an un-adoptable story is a 409 with the reason and the worker is never invoked", async () => {
  const registry = new BuildRegistry();
  const { runner, calls } = scriptedRunner(["should never run"], { ok: true, body: "unreached" });
  const adopt: AdoptContext = {
    registry,
    runner,
    isAdoptable: async () => ({ ok: false, reason: 'story "x" is already proven green — nothing to adopt' }),
  };
  const mounts = [createAdoptRouteMount(adopt), buildMountOver(registry)];

  await withServer(mounts, async (base) => {
    const res = await postAdopt(base, "already-green-story");
    assert.equal(res.status, 409, "an un-adoptable story must be a typed 409, not a crash or a forged run");
    const body = (await res.json()) as { error?: unknown };
    assert.equal(typeof body.error, "string", "the refusal carries the isAdoptable reason");
    assert.match(String(body.error), /already proven green/, "the reason is surfaced verbatim");
    assert.equal(calls(), 0, "the worker must NOT be invoked against an un-adoptable story");
  });
});

// ---------------------------------------------------------------------------
// Contract 3 — adopt-typed-answers-and-fall-through
// ---------------------------------------------------------------------------

// A missing storyId → 400; a concurrent adopt → 409 (single-run guard on the shared registry, running run
// untouched); a wrong method → 405; an unrelated path → the handler returns false (chain fall-through, NOT
// a catch-all) — the full typed-answer + chain contract, mirroring handleAdopt + the mount fall-through.
test("adopt-typed-answers-and-fall-through: missing id → 400, concurrent → 409, wrong method → 405, unrelated → false", async () => {
  const registry = new BuildRegistry();
  // A runner that blocks until released, so the first adoption stays `building` across the second POST.
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const adopt: AdoptContext = {
    registry,
    runner: async (_storyId, sink) => {
      sink("▸ adopting, awaiting release");
      await gate;
      return { ok: true, body: "verdict: PASS" };
    },
    isAdoptable: async () => ({ ok: true }),
  };
  const adoptMount = createAdoptRouteMount(adopt);
  const mounts = [adoptMount, buildMountOver(registry)];

  await withServer(mounts, async (base) => {
    // Missing storyId → 400 (before any run is minted).
    const missing = await fetch(`${base}/api/adopt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(missing.status, 400, "a missing storyId is a typed 400");

    const first = await postAdopt(base, "brownfield-story");
    assert.equal(first.status, 202, "the first dispatch is accepted");
    const { runId } = (await first.json()) as { runId: string };

    // The first run is now `building` (createRun set the guard synchronously before the 202).
    const second = await postAdopt(base, "another-brownfield-story");
    assert.equal(second.status, 409, "a concurrent dispatch is a 409 single-run refusal");
    const stillBuilding = await fetch(`${base}/api/build?runId=${encodeURIComponent(runId)}`);
    assert.equal(stillBuilding.status, 200, "the running run is left untouched by the refused dispatch");

    // A wrong method on the claimed route → 405 (never a 500). GET /api/adopt is not a poll path.
    const get = await fetch(`${base}/api/adopt`, { method: "GET" });
    assert.equal(get.status, 405, "a GET on /api/adopt is a typed 405 (poll via GET /api/build)");

    // Release so the server can close cleanly.
    release();
    await pollUntilTerminal(base, runId);
  });

  // Fall-through: an unrelated path → the handler returns false and writes NOTHING (chain dispatch, not a
  // catch-all). Drive the handler directly with minimal fakes (it returns false before touching req/res).
  let touched = false;
  const fakeRes = {
    statusCode: 0,
    setHeader: () => {
      touched = true;
    },
    end: () => {
      touched = true;
    },
    write: () => {
      touched = true;
    },
  } as unknown as ServerResponse;
  const fakeReq = { method: "GET", url: "/api/health" } as unknown as IncomingMessage;
  const claimed = await adoptMount(fakeReq, fakeRes, "/api/health");
  assert.equal(claimed, false, "an unrelated path falls through (returns false), so the chain continues");
  assert.equal(touched, false, "a fall-through writes nothing to the response (not a catch-all)");
});

// ---------------------------------------------------------------------------
// Contract 4 — adr-imports-worker-by-package-not-app
// ---------------------------------------------------------------------------

// The ADR-0100 wall: adopt-route.ts imports the worker from @storytree/drive/build-worker (package name)
// and NOTHING from apps/studio/server; and the route is an adoption INTENT only — no signing key, no
// events.verdict writer, no DB connection reachable through it (ADR-0091).
test("adr-imports-worker-by-package-not-app: imports the worker by package name, nothing from apps/studio/server, no verdict path", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, "adopt-route.ts"), "utf8");
  const importLines = src
    .split(/\r?\n/)
    .filter((l) => /^\s*import\b/.test(l) || /\bfrom\s+["']/.test(l) || /import\(/.test(l))
    .join("\n");

  assert.match(
    importLines,
    /@storytree\/drive\/build-worker/,
    "the route imports the relocated worker by package name (the legal post-relocation path)",
  );
  assert.ok(
    !/studio\/server/.test(importLines),
    "must not import apps/studio/server (the surface boundary, ADR-0100)",
  );
  assert.ok(!/\bfrom\s+["']pg["']/.test(importLines), "the route opens no direct pg connection");
  assert.ok(
    !/cloud-sql-connector|@storytree\/store|@storytree\/library\/store/.test(importLines),
    "no DB store path",
  );
  assert.ok(
    !/signVerdict|signing-key|events\.verdict/i.test(src),
    "the route holds no signing key and writes no events.verdict — an adoption INTENT only (ADR-0091)",
  );
});
