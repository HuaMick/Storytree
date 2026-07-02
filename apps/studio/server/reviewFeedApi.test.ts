// Handler-level isolated test for the review-feed endpoint (cap review-refresh-feed).
// Exercises handleReviewFeed directly over stub comment + suggestion stores — no DB,
// no node:http server — following the handler-layer test discipline (the
// suggestionDecisionApi.test.ts / handleActivity patterns).
//
// The handler is exercised at the HTTP handler layer; no real connections are opened
// and the test suite exits cleanly (no leaked handles).
//
// Contract ids (each describe/it name leads with its id so the coverage check credits them):
//   rrf-two-source-merge
//   rrf-topic-filter
//   rrf-absent-store-degrades

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleReviewFeed } from './reviewFeedApi.js';
import type { ReviewFeedCommentStore, ReviewFeedSuggestionStore } from './reviewFeedApi.js';

// ---------------------------------------------------------------------------
// Minimal inline shapes (structural typing — no deep pg-* imports).
// The anchor carries `kind: 'block'` (ADR-0140 block-anchor model).
// ---------------------------------------------------------------------------

interface FeedAnchor {
  kind: 'topic' | 'section' | 'block' | 'text';
  blockId?: string;
  headingSlug: string | null;
  headingText: string | null;
  color: string | null;
  quote?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  startOffset?: number | null;
}

interface FeedComment {
  id: string;
  topicKind: 'doc' | 'asset';
  topicId: string;
  anchor: FeedAnchor;
  body: string;
  author: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt: string | null;
}

interface FeedSuggestion {
  id: string;
  topicKind: 'doc' | 'asset';
  topicId: string;
  block: string;
  proposed: string;
  original: string;
  status: 'open' | 'accepted' | 'rejected';
  author: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
}

// ---------------------------------------------------------------------------
// Minimal HTTP mock helpers — no node:http server, no leaked handles.
// ---------------------------------------------------------------------------

function makeGetRequest(): IncomingMessage {
  const r = Readable.from([]);
  return Object.assign(r, { method: 'GET' }) as unknown as IncomingMessage;
}

interface MockResponse {
  res: ServerResponse;
  captured: { status: number; body: string };
}

function makeResponse(): MockResponse {
  const captured = { status: 200, body: '' };
  const res = {
    get statusCode(): number {
      return captured.status;
    },
    set statusCode(v: number) {
      captured.status = v;
    },
    setHeader(_n: string, _v: string): void {},
    end(data: string): void {
      captured.body = data;
    },
    write(_data: unknown): boolean {
      return true;
    },
  } as unknown as ServerResponse;
  return { res, captured };
}

function parseBody(captured: { body: string }): Record<string, unknown> {
  return JSON.parse(captured.body) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Stub store factories (scripted lists; satisfy the seams via structural typing).
// ---------------------------------------------------------------------------

function makeCommentStore(comments: FeedComment[]): ReviewFeedCommentStore {
  return {
    async listComments(filter: { topicId?: string }) {
      if (filter.topicId !== undefined) {
        return comments.filter((c) => c.topicId === filter.topicId) as never;
      }
      return comments as never;
    },
  } as unknown as ReviewFeedCommentStore;
}

function makeSuggestionStore(suggestions: FeedSuggestion[]): ReviewFeedSuggestionStore {
  return {
    async list(filter: { topicId?: string }) {
      if (filter.topicId !== undefined) {
        return suggestions.filter((s) => s.topicId === filter.topicId) as never;
      }
      return suggestions as never;
    },
  } as unknown as ReviewFeedSuggestionStore;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TOPIC_ID = 'slow-growth-principle';
const OTHER_TOPIC_ID = 'fast-growth-principle';

function makeComment(overrides: Partial<FeedComment> = {}): FeedComment {
  return {
    id: 'c-001',
    topicKind: 'asset',
    topicId: TOPIC_ID,
    anchor: {
      kind: 'block',
      blockId: 'b-why',
      headingSlug: null,
      headingText: null,
      color: null,
    },
    body: 'This block needs clarification.',
    author: 'member@example.com',
    createdAt: '2026-07-03T00:00:00.000Z',
    resolved: false,
    resolvedAt: null,
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<FeedSuggestion> = {}): FeedSuggestion {
  return {
    id: 's-001',
    topicKind: 'asset',
    topicId: TOPIC_ID,
    block: 'b-why',
    proposed: 'Proposed replacement text for the block.',
    original: 'Original block text.',
    status: 'open',
    author: 'member@example.com',
    createdAt: '2026-07-03T01:00:00.000Z',
    decidedBy: null,
    decidedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe('handleReviewFeed — review-feed endpoint (cap review-refresh-feed)', () => {
  it(
    'rrf-two-source-merge: GET for a populated topic → 200 with BOTH block-anchored comments ' +
      'and suggestions (with statuses) in one response',
    async () => {
      const comment = makeComment();
      const openSuggestion = makeSuggestion({ status: 'open' });
      const rejectedSuggestion = makeSuggestion({
        id: 's-002',
        status: 'rejected',
        decidedBy: 'admin@example.com',
        decidedAt: '2026-07-03T02:00:00.000Z',
      });

      const url = new URL(`http://localhost/api/review/feed?topicId=${TOPIC_ID}`);
      const req = makeGetRequest();
      const mock = makeResponse();

      await handleReviewFeed(req, mock.res, url, {
        commentStore: makeCommentStore([comment]),
        suggestionStore: makeSuggestionStore([openSuggestion, rejectedSuggestion]),
      });

      expect(mock.captured.status).toBe(200);
      const body = parseBody(mock.captured);

      // Topic id echoed in the response
      expect(body.topicId).toBe(TOPIC_ID);

      // Comments present with their block-anchored content
      expect(Array.isArray(body.comments)).toBe(true);
      const comments = body.comments as FeedComment[];
      expect(comments.length).toBe(1);
      expect(comments[0]?.id).toBe(comment.id);
      expect(comments[0]?.anchor).toMatchObject({ kind: 'block', blockId: 'b-why' });
      expect(comments[0]?.body).toBe(comment.body);
      expect(comments[0]?.resolved).toBe(false);

      // Suggestions present WITH their statuses (the WITH-STATUS assertion — not just ids)
      expect(Array.isArray(body.suggestions)).toBe(true);
      const suggestions = body.suggestions as FeedSuggestion[];
      expect(suggestions.length).toBe(2);
      const open = suggestions.find((s) => s.id === 's-001');
      const rejected = suggestions.find((s) => s.id === 's-002');
      expect(open?.status).toBe('open');
      expect(rejected?.status).toBe('rejected');
      expect(rejected?.decidedBy).toBe('admin@example.com');
      // block field is present on every suggestion
      expect(open?.block).toBe('b-why');
    },
  );

  it(
    'rrf-topic-filter: stores contain items for multiple topics → ' +
      'only the requested topic\'s items are returned',
    async () => {
      const targetComment = makeComment({ id: 'c-target', topicId: TOPIC_ID });
      const otherComment = makeComment({ id: 'c-other', topicId: OTHER_TOPIC_ID });
      const targetSuggestion = makeSuggestion({ id: 's-target', topicId: TOPIC_ID });
      const otherSuggestion = makeSuggestion({ id: 's-other', topicId: OTHER_TOPIC_ID });

      const url = new URL(`http://localhost/api/review/feed?topicId=${TOPIC_ID}`);
      const req = makeGetRequest();
      const mock = makeResponse();

      await handleReviewFeed(req, mock.res, url, {
        commentStore: makeCommentStore([targetComment, otherComment]),
        suggestionStore: makeSuggestionStore([targetSuggestion, otherSuggestion]),
      });

      expect(mock.captured.status).toBe(200);
      const body = parseBody(mock.captured);
      const comments = body.comments as FeedComment[];
      const suggestions = body.suggestions as FeedSuggestion[];

      // CRITICAL: only the requested topic's items must appear — cross-topic leakage is a bug
      expect(comments.length).toBe(1);
      expect(comments[0]?.id).toBe('c-target');
      expect(comments.some((c) => c.id === 'c-other')).toBe(false);

      expect(suggestions.length).toBe(1);
      expect(suggestions[0]?.id).toBe('s-target');
      expect(suggestions.some((s) => s.id === 's-other')).toBe(false);

      // The returned topicId matches the requested one
      expect(body.topicId).toBe(TOPIC_ID);
    },
  );

  it(
    'rrf-absent-store-degrades: null comment store or suggestion store → 200 empty feed, never a throw ' +
      '(the advisory-absence contract honouring the activeSessions / latestVerdicts discipline)',
    async () => {
      const url = new URL(`http://localhost/api/review/feed?topicId=${TOPIC_ID}`);

      // Case A: both stores absent (the json backend / down-DB posture)
      {
        const req = makeGetRequest();
        const mock = makeResponse();
        await expect(
          handleReviewFeed(req, mock.res, url, {
            commentStore: null,
            suggestionStore: null,
          }),
        ).resolves.toBeUndefined();
        expect(mock.captured.status).toBe(200);
        const body = parseBody(mock.captured);
        expect(body.topicId).toBe(TOPIC_ID);
        // CRITICAL: empty arrays, not an error, not a throw
        expect(body.comments).toEqual([]);
        expect(body.suggestions).toEqual([]);
      }

      // Case B: comment store absent, suggestion store has data → suggestions flow, comments empty
      {
        const req = makeGetRequest();
        const mock = makeResponse();
        await handleReviewFeed(req, mock.res, url, {
          commentStore: null,
          suggestionStore: makeSuggestionStore([makeSuggestion()]),
        });
        expect(mock.captured.status).toBe(200);
        const body = parseBody(mock.captured);
        expect(body.comments).toEqual([]);
        expect((body.suggestions as unknown[]).length).toBe(1);
      }

      // Case C: suggestion store absent, comment store has data → comments flow, suggestions empty
      {
        const req = makeGetRequest();
        const mock = makeResponse();
        await handleReviewFeed(req, mock.res, url, {
          commentStore: makeCommentStore([makeComment()]),
          suggestionStore: null,
        });
        expect(mock.captured.status).toBe(200);
        const body = parseBody(mock.captured);
        expect((body.comments as unknown[]).length).toBe(1);
        expect(body.suggestions).toEqual([]);
      }
    },
  );
});
