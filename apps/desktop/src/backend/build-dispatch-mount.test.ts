// Integration test for the desktop build-dispatch MOUNT (capability desktop-build-dispatch-mount,
// ADR-0108 Phase 3/4 — the chat-drive-bridge's last mechanical leg).
//
// WHAT IT PINS: the local-backend factory serves a REGISTRY-BACKED /api/build over a re-composed run
// lifecycle — POST dispatches a human-accepted unit id (mints a tracked run, fires the injected runner
// fire-and-forget, returns { runId }) and GET ?runId polls that run's { status, transcript } back — so
// the ChatPanel's accept-to-land click (cap 4) drives a real build from inside the app instead of the
// 404 it hits today. The factory is driven headlessly over a real node:http server with an INJECTED
// build seam (a scripted runner + an injected isBuildable) over the re-composed registry — no live SDK,
// no DB, no Electron (ADR-0010 §5: the runner is the only double; the POST branch, the GET branch, and
// the run-lifecycle fold are all real).
//
// THE BOUNDARY (ADR-0100): the mount re-composes the studio's run lifecycle (BuildRegistry +
// runBuildJob) LOCALLY — apps/desktop/src must NOT import apps/studio/server. The boundary check below
// (and the one in local-backend.test.ts) pins it statically; `dbm-intent-not-verdict` pins the safe-write
// posture structurally (no signer / no verdict writer / no DB connection reachable through the mount).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLocalBackend } from "./local-backend.js";
import type { LocalBackendDeps, LocalBackendBuild } from "./local-backend.js";

// ---------------------------------------------------------------------------
// Test helpers (the desktop convention — self-contained, mirrors local-backend.test.ts)
// ---------------------------------------------------------------------------

/** Minimal stub read backend — satisfies the read seam without touching a DB or disk. */
function stubBackend(): LocalBackendDeps["backend"] {
  return {
    listAssets: async () => [],
    health: async () => ({ db: "n/a" as const }),
    activeSessions: async () => null,
    inFlightBuilds: async () => null,
    latestVerdicts: async () => null,
  };
}

/**
 * Spin up a node:http server wrapping the local-backend handler, run `fn` with the base URL, then
 * CLOSE the server before returning — no OS handle leaks. (Copied, the desktop test convention.)
 */
async function withServer(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

const NO_STORIES_DIR = "/tmp/build-dispatch-mount-test-stories-empty";
const NO_DOCS_DIR = "/tmp/build-dispatch-mount-test-docs-empty";

/** The GET /api/build?runId wire body (mirrors the studio's BuildStatus the client polls). */
interface BuildStatusBody {
  runId: string;
  unitId: string;
  status: "building" | "passed" | "failed";
  transcript: string[];
  envelope?: string;
  reason?: string;
}

/** A scripted build runner: emits `lines` as coarse progress, then resolves with the given envelope. */
function scriptedRunner(
  lines: readonly string[],
  envelope: { ok: boolean; body: string },
): { runner: LocalBackendBuild["runner"]; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    runner: async (_unitId, sink) => {
      calls += 1;
      for (const line of lines) sink(line);
      return envelope;
    },
  };
}

/** POST /api/build with a unit id. */
async function postBuild(base: string, unitId: string): Promise<Response> {
  return fetch(`${base}/api/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unitId }),
  });
}

/** Poll GET /api/build?runId until the run leaves `building` (or give up) — the desktop settle pattern. */
async function pollUntilTerminal(base: string, runId: string): Promise<BuildStatusBody> {
  for (let i = 0; i < 100; i += 1) {
    const res = await fetch(`${base}/api/build?runId=${encodeURIComponent(runId)}`);
    const body = (await res.json()) as BuildStatusBody;
    if (body.status !== "building") return body;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`run ${runId} did not terminalise`);
}

// ---------------------------------------------------------------------------
// Contract 1 — dbm-post-dispatches-buildable-id
// ---------------------------------------------------------------------------

// A POST with a buildable accepted id validates isBuildable, MINTS a tracked run on the re-composed
// registry, fires the worker fire-and-forget over the injected runner, and returns a { runId } body —
// the dispatch the ChatPanel's Build click drives. The minted runId is a fresh tracked id (NOT the old
// unitId-echo of HEAD), so the client has something real to poll.
test("dbm-post-dispatches-buildable-id: POST /api/build mints a tracked run and returns a { runId }", async () => {
  const { runner, calls } = scriptedRunner(["▸ phase: AUTHOR_TEST", "▸ phase: GREEN"], {
    ok: true,
    body: "verdict: PASS",
  });
  const handler = createLocalBackend({
    storiesDir: NO_STORIES_DIR,
    docsDir: NO_DOCS_DIR,
    backend: stubBackend(),
    store: "json",
    build: { isBuildable: async () => true, runner },
  });

  await withServer(handler, async (base) => {
    const res = await postBuild(base, "chat-build-dispatch");
    assert.ok(res.status >= 200 && res.status < 300, "a buildable id must be a 2xx, not a 404/405");

    const body = (await res.json()) as { runId?: unknown };
    assert.equal(typeof body.runId, "string", "the POST body must carry a string runId");
    assert.ok((body.runId as string).length > 0, "the runId must be a non-empty tracked id");
    assert.notEqual(
      body.runId,
      "chat-build-dispatch",
      "the runId must be a freshly-minted tracked id, NOT the unitId echo (the registry minted a run)",
    );

    // The run is tracked: it must poll back to a terminal state (proves the worker actually fired).
    const terminal = await pollUntilTerminal(base, body.runId as string);
    assert.equal(terminal.status, "passed", "the fired run drains to a terminal state");
    assert.equal(calls(), 1, "the injected runner was invoked exactly once for the dispatch");
  });
});

// ---------------------------------------------------------------------------
// Contract 2 — dbm-get-polls-run-status-transcript
// ---------------------------------------------------------------------------

// After the run drains, GET /api/build?runId returns 200 with { status, transcript } where status is
// terminal `passed` and transcript carries the scripted runner's coarse progress lines — the poll route
// the ChatPanel polls for progress. THIS ROUTE DOES NOT EXIST AT HEAD (POST-only → GET 405): the RED.
test("dbm-get-polls-run-status-transcript: GET /api/build?runId returns the run's { status, transcript }", async () => {
  const { runner } = scriptedRunner(["▸ phase: CONFIRM_RED", "▸ phase: IMPLEMENT", "▸ phase: CONFIRM_GREEN"], {
    ok: true,
    body: "verdict: PASS\nsigned by the spine",
  });
  const handler = createLocalBackend({
    storiesDir: NO_STORIES_DIR,
    docsDir: NO_DOCS_DIR,
    backend: stubBackend(),
    store: "json",
    build: { isBuildable: async () => true, runner },
  });

  await withServer(handler, async (base) => {
    const post = await postBuild(base, "chat-build-dispatch");
    const { runId } = (await post.json()) as { runId: string };

    const terminal = await pollUntilTerminal(base, runId);
    assert.equal(terminal.status, "passed", "GET must reflect the worker's terminal passed status");
    assert.equal(terminal.runId, runId, "GET echoes the polled runId");
    assert.equal(terminal.unitId, "chat-build-dispatch", "GET carries the run's unit id");
    assert.ok(Array.isArray(terminal.transcript), "GET returns a transcript array");
    assert.ok(
      terminal.transcript.some((l) => l.includes("CONFIRM_GREEN")),
      "the transcript carries the scripted runner's coarse progress lines (the streamed-back progress)",
    );
    assert.ok(
      terminal.transcript.some((l) => l.includes("verdict: PASS")),
      "the transcript carries the envelope body the run terminalised with",
    );
  });
});

// ---------------------------------------------------------------------------
// Contract 3 — dbm-refuses-unbuildable-id
// ---------------------------------------------------------------------------

// An un-buildable / unknown id (isBuildable false) → a clean 404, and the injected runner is NEVER
// invoked — no run minted against nothing (mirrors the existing desktop branch / the studio's 404).
test("dbm-refuses-unbuildable-id: an un-buildable id is a typed 404 and the runner is never invoked", async () => {
  const { runner, calls } = scriptedRunner(["should never run"], { ok: true, body: "unreached" });
  const handler = createLocalBackend({
    storiesDir: NO_STORIES_DIR,
    docsDir: NO_DOCS_DIR,
    backend: stubBackend(),
    store: "json",
    build: { isBuildable: async () => false, runner },
  });

  await withServer(handler, async (base) => {
    const res = await postBuild(base, "no-such-unit");
    assert.equal(res.status, 404, "an un-buildable id must be 404, not a crash or a forged run");

    const body = (await res.json()) as { error?: unknown };
    assert.equal(typeof body.error, "string", "the refusal carries a typed error field");
    assert.equal(calls(), 0, "the runner must NOT be invoked for an un-buildable id (no run against nothing)");
  });
});

// ---------------------------------------------------------------------------
// Contract 4 — dbm-single-build-guard
// ---------------------------------------------------------------------------

// A SECOND POST while a run is live → the registry's single-build guard surfaced as a 409, the running
// run untouched; AND a GET for an unknown runId → a typed 404 "build run not found" (never a 500).
test("dbm-single-build-guard: a concurrent POST is a 409 and an unknown runId GET is a 404", async () => {
  // A runner that blocks until released, so the first run stays `building` across the second POST.
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let calls = 0;
  const runner: LocalBackendBuild["runner"] = async (_unitId, sink) => {
    calls += 1;
    sink("▸ build started, awaiting release");
    await gate;
    return { ok: true, body: "verdict: PASS" };
  };
  const handler = createLocalBackend({
    storiesDir: NO_STORIES_DIR,
    docsDir: NO_DOCS_DIR,
    backend: stubBackend(),
    store: "json",
    build: { isBuildable: async () => true, runner },
  });

  await withServer(handler, async (base) => {
    const first = await postBuild(base, "chat-build-dispatch");
    assert.ok(first.status >= 200 && first.status < 300, "the first dispatch is accepted");
    const { runId } = (await first.json()) as { runId: string };

    // The first run is now `building` (createRun set the guard synchronously before the 202).
    const second = await postBuild(base, "accept-to-land-affordance");
    assert.equal(second.status, 409, "a concurrent dispatch must be a 409 single-build refusal");
    const secondBody = (await second.json()) as { error?: unknown };
    assert.equal(typeof secondBody.error, "string", "the 409 carries a typed reason");
    assert.equal(calls, 1, "the second dispatch must NOT have fired a runner — the running run is untouched");

    // GET an unknown runId → typed 404, never a 500.
    const unknown = await fetch(`${base}/api/build?runId=does-not-exist`);
    assert.equal(unknown.status, 404, "an unknown runId GET must be a typed 404, not a 500");
    const unknownBody = (await unknown.json()) as { error?: unknown };
    assert.equal(typeof unknownBody.error, "string", "the GET-404 carries a typed error");

    // The running run is still pollable (untouched) — then release it so the server can close cleanly.
    const stillRunning = await fetch(`${base}/api/build?runId=${encodeURIComponent(runId)}`);
    assert.equal(stillRunning.status, 200, "the running run is still tracked");
    release();
    await pollUntilTerminal(base, runId);
  });
});

// ---------------------------------------------------------------------------
// Contract 5 — dbm-intent-not-verdict
// ---------------------------------------------------------------------------

// A SAFE WRITE (ADR-0091): the mount hands the worker a unit id and reads back coarse progress, nothing
// more. A FAILED scripted runner surfaces a terminal `failed` status with a reason — an honest failed
// build, NEVER a forged pass; and the factory source holds no signing key / verdict writer / DB
// connection reachable through the mount (the spine signs; CI lands).
test("dbm-intent-not-verdict: a failed runner surfaces failed (never a forged pass) and the mount holds no verdict path", async () => {
  const { runner } = scriptedRunner(["▸ phase: IMPLEMENT", "✗ tests still red"], {
    ok: false,
    body: "verdict: NONE\nthe build failed: 1 test red",
  });
  const handler = createLocalBackend({
    storiesDir: NO_STORIES_DIR,
    docsDir: NO_DOCS_DIR,
    backend: stubBackend(),
    store: "json",
    build: { isBuildable: async () => true, runner },
  });

  await withServer(handler, async (base) => {
    const post = await postBuild(base, "chat-build-dispatch");
    const { runId } = (await post.json()) as { runId: string };

    const terminal = await pollUntilTerminal(base, runId);
    assert.equal(terminal.status, "failed", "a non-ok envelope must surface a FAILED run, never a forged pass");
    assert.notEqual(terminal.status, "passed", "an honest failed build is never reported as passed");
    assert.equal(typeof terminal.reason, "string", "a failed run carries an honest reason");
    assert.ok((terminal.reason ?? "").length > 0, "the failure reason is non-empty");
  });

  // Structural (ADR-0091): the build path holds NO signer / NO verdict writer / NO DB connection — the
  // verdict + the auto-merging PR are the WORKER's, off the human's click, never forged through the mount.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, "local-backend.ts"), "utf8");
  const importLines = src
    .split(/\r?\n/)
    .filter((l) => /^\s*import\b/.test(l) || /import\(/.test(l))
    .join("\n");
  assert.ok(!/studio\/server/.test(importLines), "must not import apps/studio/server (the surface boundary, ADR-0100)");
  assert.ok(!/\bfrom\s+["']pg["']/.test(importLines), "the mount opens no direct pg connection");
  assert.ok(!/cloud-sql-connector/.test(importLines), "the mount opens no Cloud SQL connection");
  assert.ok(!/@storytree\/store/.test(importLines), "the mount imports no DB store");
  assert.ok(
    !/signVerdict|signing-key|events\.verdict/i.test(src),
    "the mount holds no signing key and writes no events.verdict — intent in, progress out (ADR-0091)",
  );
});

// ---------------------------------------------------------------------------
// Static boundary check (ADR-0100) — the desktop must not import apps/studio/server.
// Mirrors local-backend.test.ts / chat-sse-mount.test.ts; pins that the re-composed run lifecycle
// stays LOCAL even as the build mount grows.
// ---------------------------------------------------------------------------
test("build-dispatch-mount: local-backend re-composes the run lifecycle locally (no studio-server import)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, "local-backend.ts"), "utf8");
  const importLines = src
    .split(/\r?\n/)
    .filter((l) => /^\s*import\b/.test(l) || /import\(/.test(l))
    .join("\n");
  assert.ok(
    !/apps\/studio\/server|\.\.\/.*studio\/server/.test(importLines),
    "must not import apps/studio/server — re-compose BuildRegistry + runBuildJob locally (ADR-0100)",
  );
  assert.ok(
    !/buildRegistry|buildWorker|chat-build-dispatch/.test(importLines),
    "must not import the studio's build machinery by module path (the re-composed mirror is local)",
  );
});
