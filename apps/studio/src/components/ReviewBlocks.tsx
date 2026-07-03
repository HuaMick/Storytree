/**
 * ReviewBlocks — the Stage-2 mount for the Review-mode surface (ADR-0140 caps 7/8).
 *
 * Renders a topic body PER BLOCK (splitBlocks — the stable content-hash handles
 * comment/suggestion anchors carry) and mounts the two proven components in the
 * document flow:
 *
 *  • <InlineCommentThread> above a block that has ≥1 block-anchored comment, or
 *    that the reviewer explicitly opened via the per-block "Comment" affordance.
 *    (Never one self-polling thread per block — only commented/opened blocks.)
 *  • <SuggestionView> under a block that has an open suggestion targeting it
 *    (proposed-result-by-default is the model; the view owns show-change/decide).
 *
 * One reviewFeed(topicId) poll on the PRESENCE_POLL_MS cadence feeds both; a
 * failed poll keeps the last-known feed (same discipline as the presence layer).
 *
 * Per-block prose is memoized as stable element references so React never
 * reconciles the rendered markdown — which would strip the annotation layer's
 * imperatively-inserted highlight <mark>s (the same trick AssetView used for the
 * whole-body render before this mount).
 */

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { splitBlocks } from '../lib/blocks';
import { PRESENCE_POLL_MS } from '../lib/presence';
import { useAppData } from '../lib/appData';
import { useOperator } from '../lib/operator';
import { Markdown } from './Markdown';
import { ReviewModeContext } from './ReviewToggle';
import { InlineCommentThread } from './InlineCommentThread';
import { SuggestionView, type Suggestion } from './SuggestionView';
import type { ReviewFeedPayload, TopicKind } from '../types';

interface ReviewBlocksProps {
  topicKind: TopicKind;
  topicId: string;
  /** The topic's markdown source — the same text splitBlocks hashed server-side. */
  body: string;
}

export function ReviewBlocks({ topicKind, topicId, body }: ReviewBlocksProps): React.JSX.Element {
  const mode = useContext(ReviewModeContext);
  const { me } = useAppData();
  const [operator] = useOperator();

  // ── The one feed poll (cap 5's payload: comments + suggestions) ─────────────
  const [feed, setFeed] = useState<ReviewFeedPayload | null>(null);
  const loadFeed = useCallback(async (): Promise<void> => {
    try {
      setFeed(await api.reviewFeed(topicId));
    } catch {
      // Advisory: a down/degraded feed keeps the last-known payload — never crash.
    }
  }, [topicId]);

  useEffect(() => {
    void loadFeed();
    const id = window.setInterval(() => void loadFeed(), PRESENCE_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadFeed]);

  // ── Block model + memoized prose ────────────────────────────────────────────
  const blocks = useMemo(() => splitBlocks(body), [body]);
  // Stable element references per block: React bails out of reconciling an
  // identical element, so the highlight marks inside the markdown DOM survive
  // feed-poll re-renders.
  const blockBodies = useMemo(
    () => new Map(blocks.map((b) => [b.id, <Markdown>{b.text}</Markdown>] as const)),
    [blocks],
  );

  // Blocks that carry ≥1 block-anchored comment (the mount signal for a thread).
  const commentedBlocks = useMemo(() => {
    const ids = new Set<string>();
    for (const c of feed?.comments ?? []) {
      if (c.anchor.kind === 'block' && typeof c.anchor.blockId === 'string') {
        ids.add(c.anchor.blockId);
      }
    }
    return ids;
  }, [feed]);

  // Open suggestions grouped by target block, mapped store-field → component-prop
  // (SuggestionRecord {block, proposed, original} → Suggestion {blockId, proposedText, originalText}).
  const suggestionsByBlock = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    for (const s of feed?.suggestions ?? []) {
      if (s.status !== 'open') continue;
      const suggestion: Suggestion = {
        id: s.id,
        blockId: s.block,
        proposedText: s.proposed,
        originalText: s.original,
        status: s.status,
        author: s.author,
      };
      const list = map.get(s.block);
      if (list) list.push(suggestion);
      else map.set(s.block, [suggestion]);
    }
    return map;
  }, [feed]);

  // ── Reviewer-opened threads + the per-block suggest compose ─────────────────
  const [openThreads, setOpenThreads] = useState<ReadonlySet<string>>(() => new Set());
  const [composeFor, setComposeFor] = useState<string | null>(null);
  const [composeText, setComposeText] = useState('');
  const [busy, setBusy] = useState(false);

  function openThread(blockId: string): void {
    setOpenThreads((prev) => new Set(prev).add(blockId));
  }

  function startCompose(blockId: string, sourceText: string): void {
    setComposeFor(blockId);
    setComposeText(sourceText);
  }

  function cancelCompose(): void {
    setComposeFor(null);
    setComposeText('');
  }

  async function submitSuggestion(blockId: string, originalText: string): Promise<void> {
    const proposedText = composeText.trim();
    if (!proposedText || busy) return;
    setBusy(true);
    try {
      await api.createSuggestion({ blockId, proposedText, topicKind, topicId, originalText });
      cancelCompose();
      await loadFeed();
    } catch {
      // Leave the compose open so the reviewer's draft isn't lost on a failed POST.
    } finally {
      setBusy(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={mode === 'review' ? 'review-blocks review-blocks-review' : 'review-blocks'}>
      {blocks.map((block) => {
        const showThread = commentedBlocks.has(block.id) || openThreads.has(block.id);
        const suggestions = suggestionsByBlock.get(block.id) ?? [];
        return (
          <div className="review-block" key={block.id} data-block-id={block.id}>
            {showThread && (
              <InlineCommentThread
                blockHandle={block.id}
                topicKind={topicKind}
                topicId={topicId}
                operator={operator}
                mode={mode}
              />
            )}

            {blockBodies.get(block.id)}

            {suggestions.map((s) => (
              <div className="suggestion-slot" key={s.id}>
                <span className="suggestion-slot-label">suggested edit · {s.author}</span>
                <SuggestionView suggestion={s} me={me} topicKind={topicKind} topicId={topicId} />
              </div>
            ))}

            {mode === 'review' && (
              <div className="review-block-tools">
                {!showThread && (
                  <button
                    type="button"
                    className="review-tool"
                    onClick={() => openThread(block.id)}
                  >
                    Comment
                  </button>
                )}
                <button
                  type="button"
                  className="review-tool"
                  onClick={() => startCompose(block.id, block.text)}
                >
                  Suggest
                </button>
              </div>
            )}

            {mode === 'review' && composeFor === block.id && (
              <div className="suggest-compose">
                <textarea
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  rows={Math.min(12, Math.max(3, block.text.split('\n').length + 1))}
                  aria-label="Suggested replacement text"
                />
                <div className="suggest-compose-actions">
                  <button
                    type="button"
                    className="btn small"
                    disabled={busy || !composeText.trim()}
                    onClick={() => void submitSuggestion(block.id, block.text)}
                  >
                    Suggest
                  </button>
                  <button type="button" className="btn small ghost" onClick={cancelCompose}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
