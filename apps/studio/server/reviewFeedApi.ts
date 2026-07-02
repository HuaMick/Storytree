// Review-feed endpoint (cap review-refresh-feed).
//
// GET /api/review/feed?topicId=<id>
// Returns a topic's block-anchored comments AND its suggestions (with statuses) in one
// response, supporting the Review surface's 30 s visibility-gated poll (the
// PRESENCE_POLL_MS cadence in apps/studio/src/lib/presence.ts).
//
// TWO-SOURCE READ: the handler reads both stores in parallel and merges their results
// into a single `{ topicId, comments, suggestions }` payload — ONE poll, ONE DB-connection
// cost envelope (the `usePresence` discipline; the alternative — two separate polls — is
// two reads where one suffices).
//
// ADVISORY DEGRADATION: when either store is absent (the json backend, or a down DB),
// the feed returns an empty array for that source and never throws — matching the
// `activeSessions` / `latestVerdicts` pattern in the studio's other live reads.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from './httpUtil.js';

// ---------------------------------------------------------------------------
// Store seams — injected per-request.
// Structural typing: the production PgCommentStore + PgSuggestionStore and inline stubs
// both satisfy these seams — no deep pg-* imports needed here.
// ---------------------------------------------------------------------------

export interface ReviewFeedCommentStore {
  listComments(filter: { topicId?: string }): Promise<unknown[]>;
}

export interface ReviewFeedSuggestionStore {
  list(filter: { topicId?: string }): Promise<unknown[]>;
}

interface ReviewFeedStores {
  commentStore: ReviewFeedCommentStore | null;
  suggestionStore: ReviewFeedSuggestionStore | null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle GET /api/review/feed?topicId=<id>
 *
 * Returns `{ topicId, comments, suggestions }`.
 * Degrades to empty arrays when a store is absent — never throws.
 */
export async function handleReviewFeed(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  stores: ReviewFeedStores,
): Promise<void> {
  const topicId = url.searchParams.get('topicId') ?? '';
  const filter: { topicId?: string } = topicId ? { topicId } : {};

  const [comments, suggestions] = await Promise.all([
    stores.commentStore != null
      ? stores.commentStore.listComments(filter)
      : Promise.resolve([]),
    stores.suggestionStore != null
      ? stores.suggestionStore.list(filter)
      : Promise.resolve([]),
  ]);

  sendJson(res, 200, { topicId, comments, suggestions });
}
