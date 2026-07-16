// Desktop adopt-route MOUNT factory — POST /api/adopt (202 + runId, fire-and-forget), wired over an
// injected {@link AdoptContext} (the relocated worker's shared registry + an adopt runner + isAdoptable
// discovery). It is the unmounted SIBLING of build-route.ts: the desktop already serves POST/GET
// /api/build server-side (createBuildRouteMount), but /api/adopt — the brownfield `mapped → proposed`
// proving entry the studio's AdoptPanel POSTs (api.adopt) — fell through to the local-backend 404
// 'unknown endpoint'. This closes that gap by re-composing the studio's `handleAdopt` contract
// (apps/studio/server/apiRouter.ts) — the exact class of desktop-only gap PR #751 fixed for
// /api/docs/content.
//
// THE BOUNDARY CALL (ADR-0100): imports the worker (runBuildJob + BuildRegistry/BuildRunner types) from
// @storytree/drive/build-worker by PACKAGE name, never from apps/studio/server (a forbidden surface→
// surface coupling). Reproduces the local HTTP helpers rather than importing them from studio — exactly
// as build-route.ts / chat-sse-mount.ts / local-backend.ts do. No `electron`, no `dom` import; headlessly
// provable by node:test over a real node:http server.
//
// SHARES THE BUILD REGISTRY (ADR-0097): the adoption run rides the SAME registry a build uses, so
// progress polls the EXISTING GET /api/build?runId (one registry, one poll path) and the single-in-flight
// guard spans build + adopt (you cannot adopt and build at once). There is deliberately NO GET /api/adopt.
//
// A SAFE write — an adoption INTENT, never a verdict (ADR-0091): the route hands the worker a story id;
// the spine inside runBuildJob observe-and-signs the story's `observe` reliability gates to `adopted`
// verdicts and flips it `mapped → proposed`. This module holds no signing key and no DB connection.

import type { IncomingMessage, ServerResponse } from "node:http";

import { runBuildJob } from "@storytree/drive/build-worker";
import type { BuildRegistry, BuildRunner } from "@storytree/drive/build-worker";

// ---------- HTTP helpers (local copies — not imported from studio) ----------

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// ---------- AdoptContext (local mirror of apiRouter.ts's — do NOT import from studio) ----------

/**
 * The adopt seam injected into the mount — mirrors apps/studio/server's `AdoptContext` without
 * importing it (the ADR-0100 surface boundary).
 */
export interface AdoptContext {
  /** The run registry — SHARED with the build seam so polling rides GET /api/build?runId and the
   *  single-in-flight guard spans build + adopt (you can't adopt and build at once). */
  registry: BuildRegistry;
  /** Drives one adoption (the worker); wired over the real `adoptStory` in electron/backend-entry.ts. */
  runner: BuildRunner;
  /** Whether `storyId` is an adoptable brownfield story (mapped + observe gates), validated against the
   *  SAME discovery `storyGoGreen` uses; a reason on refusal (a typed 409, never a 500). */
  isAdoptable(storyId: string): Promise<{ ok: true } | { ok: false; reason: string }>;
}

// ---------- Factory ----------

/**
 * Create the /api/adopt dispatcher over an injected {@link AdoptContext} (the relocated worker).
 *
 * ROUTE TABLE — claims ONLY /api/adopt; returns `false` for every other path so it chains cleanly beside
 * the build/boot/chat mounts (a fall-through dispatcher, NOT a catch-all):
 * - POST /api/adopt {storyId} → validate `isAdoptable` (400 missing id, 409 not adoptable / reason) →
 *   `createRun` (409 single-run guard) → `void runBuildJob` fire-and-forget → 202 `{ runId }`
 * - any other method on /api/adopt → 405
 *
 * Returns an async handler `(req, res, pathname) => Promise<boolean>` — `true` when it claimed the
 * request, `false` to fall through. Every KNOWN outcome is a typed HTTP answer, never a 500 (the SAME
 * contract apps/studio/server's `handleAdopt` holds — one worker, two surfaces). An adoption INTENT
 * only, never a verdict (ADR-0091). Progress is polled via the EXISTING GET /api/build?runId (the
 * shared registry) — there is deliberately no GET /api/adopt.
 */
export function createAdoptRouteMount(
  adopt: AdoptContext,
): (req: IncomingMessage, res: ServerResponse, pathname: string) => Promise<boolean> {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
  ): Promise<boolean> => {
    // Claim ONLY /api/adopt — fall through for every other route (the chain contract).
    if (pathname !== "/api/adopt") return false;

    const method = req.method ?? "GET";
    try {
      // The only supported verb is POST — a GET/DELETE/etc. is a typed 405 (polling is GET /api/build).
      if (method !== "POST") {
        sendJson(res, 405, { error: `method ${method} not allowed` });
        return true;
      }

      const input = await readJsonBody<Record<string, unknown>>(req);
      const storyId = asString(input["storyId"]).trim();
      if (!storyId) {
        sendJson(res, 400, { error: "storyId is required" });
        return true;
      }
      // Validate against real discovery — a non-brownfield / gateless / typo'd id is a clean 409 with a
      // reason, never a worker that adopts nothing (the handleAdopt 409 contract).
      const adoptable = await adopt.isAdoptable(storyId);
      if (!adoptable.ok) {
        sendJson(res, 409, { error: adoptable.reason });
        return true;
      }
      // Mint a tracked run on the SHARED registry — the single-run guard (spanning build + adopt)
      // surfaces as a 409 (mirrors handleAdopt / handleBuild).
      const created = adopt.registry.createRun(storyId);
      if (!created.ok) {
        sendJson(res, 409, { error: created.reason });
        return true;
      }
      const { runId } = created.run;
      // Fire-and-forget: the adoption runs after the 202; the client polls GET /api/build?runId for
      // progress. runBuildJob never throws (it records a failed terminal state), so the floating promise
      // can't reject.
      void runBuildJob(adopt.registry, runId, storyId, adopt.runner);
      sendJson(res, 202, { runId });
      return true;
    } catch (err) {
      // Backstop for a truly-unexpected fault — never reached by a known outcome (those are typed above).
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      return true;
    }
  };
}
