// Integration tests for GET /api/presence (devApi.ts handlePresence) over a REAL
// node:http server with a STUB backend — no DB, no Vite (the dbApi.integration.test.ts
// pattern). The contract under test: activeSessions() never throws, so the endpoint
// always answers 200 — `{sessions: null}` IS the down-DB/json-store answer (ADR-0033
// advisory absence), never a 503. The only error path is the 405 method guard.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handlePresence } from './devApi';
import { HttpError } from './httpUtil';
import type { TreeSession } from '../src/types';

const wisp: TreeSession = {
  sessionId: 'naughty-rubin-f91837',
  branch: 'claude/naughty-rubin-f91837',
  workingOn: 'studio presence polling',
  nodes: ['studio'],
  band: 'fresh',
  lastSeenAt: '2026-06-13T10:00:00.000Z',
};

// The stub flips per test — handlePresence only needs activeSessions().
let activeSessionsResult: TreeSession[] | null = null;

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    void handlePresence(req, res, {
      activeSessions: async () => activeSessionsResult,
    }).catch((err: unknown) => {
      // devApi's central HttpError mapping, inlined like dbApi.integration.test.ts.
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

describe('/api/presence', () => {
  it('answers 200 with the active sessions when the store answers', async () => {
    activeSessionsResult = [wisp];
    const res = await fetch(`${base}/api/presence`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [wisp] });
  });

  it('answers 200 {sessions: null} when the store is silent (down DB / json) — never a 503', async () => {
    activeSessionsResult = null;
    const res = await fetch(`${base}/api/presence`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: null });
  });

  it('answers 200 {sessions: []} when the store answers with no one present', async () => {
    activeSessionsResult = [];
    const res = await fetch(`${base}/api/presence`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [] });
  });

  it('refuses non-GET', async () => {
    const res = await fetch(`${base}/api/presence`, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});
