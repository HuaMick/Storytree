// Integration tests for GET /api/claims (devApi.ts handleClaims) over a REAL node:http server
// with a STUB backend — no DB, no Vite (the presenceApi.integration.test.ts pattern). The contract
// under test: sessionClaims() never throws, so the endpoint always answers 200 — `{sessions: null}`
// IS the down-DB/json-store answer (ADR-0200 D7 advisory absence), never a 503. The claim rows the
// stub returns are folded through the REAL `groupClaimsBySession` (packages/notice-board), so this
// also proves the wiring lands the pure fold's actual output on the wire, not a hand-shaped stand-in.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handleClaims } from './devApi';
import { HttpError } from './httpUtil';
import { groupClaimsBySession, type ClaimDocT } from '@storytree/notice-board';

// Fixtures are stamped RELATIVE to the real clock, never absolute ISO literals: handleClaims folds
// with `new Date()` at request time (not injectable), and groupClaimsBySession DROPS a claim whose
// heartbeat is past the 2 h stale-reclaim window — an absolute heartbeat is a time bomb that starts
// failing the moment the wall clock outruns it (this file's original fixtures did exactly that).
const now = new Date();
const ago = (ms: number): string => new Date(now.getTime() - ms).toISOString();

const workClaim: ClaimDocT = {
  unitId: 'story-a',
  sessionId: 'sess-old',
  branch: 'claude/sess-old',
  intent: 'real',
  grade: 'work',
  claimedAt: ago(2 * 60 * 60 * 1_000),
  heartbeatAt: ago(60_000),
};

const exploringClaim: ClaimDocT = {
  unitId: 'story-b',
  sessionId: 'sess-new',
  branch: 'claude/sess-new',
  intent: 'scoping the map',
  grade: 'exploring',
  claimedAt: ago(30 * 60 * 1_000),
  heartbeatAt: ago(2 * 60_000),
};

// The stub flips per test — handleClaims only needs sessionClaims().
let sessionClaimsResult: ClaimDocT[] | null = null;

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    void handleClaims(req, res, {
      sessionClaims: async () => sessionClaimsResult,
    }).catch((err: unknown) => {
      // devApi's central HttpError mapping, inlined like presenceApi.integration.test.ts.
      const status = err instanceof HttpError ? err.status : 500;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

describe('/api/claims', () => {
  it('answers 200 with the claims grouped by session when the store answers', async () => {
    sessionClaimsResult = [workClaim, exploringClaim];
    const res = await fetch(`${base}/api/claims`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    // The endpoint's own fold must land the SAME shape the pure groupClaimsBySession produces —
    // proves the wiring, not a re-test of the fold's own (already-covered) grouping logic. `now`
    // only affects `ageMs`, which the endpoint stamps at request time (not injectable), so compare
    // everything except ageMs.
    const expected = groupClaimsBySession([workClaim, exploringClaim], now);
    const stripAge = (payload: unknown): unknown =>
      JSON.parse(
        JSON.stringify(payload),
        (key, value) => (key === 'ageMs' ? 0 : value),
      );
    expect(stripAge(body)).toEqual(stripAge({ sessions: expected }));
    const sessions = (body as { sessions: { sessionId: string }[] }).sessions;
    expect(sessions.map((s) => s.sessionId)).toEqual(['sess-old', 'sess-new']);
  });

  it('answers 200 {sessions: null} when the store is silent (down DB / json) — never a 503', async () => {
    sessionClaimsResult = null;
    const res = await fetch(`${base}/api/claims`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: null });
  });

  it('answers 200 {sessions: []} when the store answers with no live claims', async () => {
    sessionClaimsResult = [];
    const res = await fetch(`${base}/api/claims`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [] });
  });

  it('refuses non-GET', async () => {
    const res = await fetch(`${base}/api/claims`, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});
