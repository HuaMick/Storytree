// render-claim-as-wisp — pure claimsToActivity fold (B1 + B2).
// Proof command: node --import tsx --test apps/studio/server/inFlightActivity.test.ts
//
// Why a standalone module (mirrors inFlightBuilds.ts pattern): the live SQL that
// reads events.node_claim needs a DB (activityApi integration test + operator-attested
// deep-link), but the stale-drop filter and the ADR-0138 §5 honesty-wall discriminator
// are pure data math — red-green here without a DB.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claimsToActivity } from './inFlightActivity.js';

// Mirrors CLAIM_STALE_RECLAIM_MS from @storytree/notice-board (2 hours).
// A claim whose heartbeatAt is past this threshold is stale: the holder crashed/was
// killed and never ran release(), so the wisp self-heals rather than orbiting forever.
const CLAIM_STALE_RECLAIM_MS = 2 * 60 * 60 * 1_000; // 2 h

const NOW = new Date('2026-06-30T12:00:00.000Z');
// 1 minute ago — well within the 2-hour reclaim window (live)
const freshHb = new Date(NOW.getTime() - 60_000).toISOString();
// Just past the threshold — the claim should be dropped
const staleHb = new Date(NOW.getTime() - CLAIM_STALE_RECLAIM_MS - 1).toISOString();

describe('claimsToActivity — the claim row fold', () => {
  it('B1: maps a fresh claim row to a kind:"claim" ClaimActivity with correct fields', () => {
    const out = claimsToActivity(
      [
        {
          unit_id: 'render-claim-as-wisp',
          session_id: 'sess-1',
          branch: 'claude/real/render-claim',
          intent: 'real',
          claimed_at: freshHb,
          heartbeat_at: freshHb,
        },
      ],
      NOW,
    );
    assert.deepEqual(out, [
      {
        unitId: 'render-claim-as-wisp',
        kind: 'claim',
        sessionId: 'sess-1',
        branch: 'claude/real/render-claim',
        intent: 'real',
        at: freshHb,
      },
    ]);
  });

  it('B1: drops a claim whose heartbeatAt is past the stale-reclaim window', () => {
    const out = claimsToActivity(
      [
        {
          unit_id: 'dead-unit',
          session_id: 'sess-dead',
          branch: 'b',
          intent: '',
          claimed_at: staleHb,
          heartbeat_at: staleHb,
        },
      ],
      NOW,
    );
    assert.deepEqual(out, []);
  });

  it('B1: mixed batch — only the fresh claim survives the stale-drop', () => {
    const out = claimsToActivity(
      [
        {
          unit_id: 'alive',
          session_id: 's1',
          branch: 'b',
          intent: '',
          claimed_at: freshHb,
          heartbeat_at: freshHb,
        },
        {
          unit_id: 'dead',
          session_id: 's2',
          branch: 'b',
          intent: '',
          claimed_at: staleHb,
          heartbeat_at: staleHb,
        },
      ],
      NOW,
    );
    assert.deepEqual(
      out.map((a) => a.unitId),
      ['alive'],
    );
  });

  it('B2 honesty wall: kind is "claim", never "green" or "bloom" (ADR-0138 §5)', () => {
    // A claim-activity must carry a discriminator that keeps it visually distinct from
    // the proven-green bloom (ADR-0045). The fold enforces this in data, before any pixel.
    const out = claimsToActivity(
      [
        {
          unit_id: 'story-x',
          session_id: 'sess-3',
          branch: 'main',
          intent: 'orchestrate',
          claimed_at: freshHb,
          heartbeat_at: freshHb,
        },
      ],
      NOW,
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0]?.kind, 'claim');
    // Explicit wall — these are the discriminators a renderer would use for the
    // proven-green bloom; a claim must never carry them.
    assert.notStrictEqual(out[0]?.kind, 'green');
    assert.notStrictEqual(out[0]?.kind, 'bloom');
  });

  it('B1: normalises a Date claimed_at to an ISO string', () => {
    const out = claimsToActivity(
      [
        {
          unit_id: 'date-normalise',
          session_id: 's',
          branch: 'b',
          intent: '',
          claimed_at: new Date(freshHb),
          heartbeat_at: freshHb,
        },
      ],
      NOW,
    );
    assert.strictEqual(out[0]?.at, freshHb);
  });
});
