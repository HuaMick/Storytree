import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAppData } from '../lib/appData';
import { relativeTime } from '../lib/format';
import { sectionAnchor, topicAnchor } from '../lib/annotate';
import type { Heading } from '../lib/markdown';
import { DEFAULT_HIGHLIGHT, type Comment, type CommentAnchor, type TopicKind } from '../types';
import { Markdown } from './Markdown';

interface CommentPanelProps {
  topicKind: TopicKind;
  topicId: string;
  headings: Heading[];
  operator: string;
  target: CommentAnchor;
  setTarget: (anchor: CommentAnchor) => void;
  /** Comment to scroll-to / flash (set when its highlight or gutter tick is clicked). */
  focusId?: string | null;
  /** Jump the document to a text comment's highlight. */
  onJump?: (comment: Comment) => void;
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

export function CommentPanel({
  topicKind,
  topicId,
  headings,
  operator,
  target,
  setTarget,
  focusId,
  onJump,
}: CommentPanelProps): React.JSX.Element {
  const { comments, refreshComments } = useAppData();
  const [body, setBody] = useState('');
  const [hideResolved, setHideResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const topicComments = useMemo(
    () =>
      comments
        .filter((c) => c.topicId === topicId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments, topicId],
  );
  const openTotal = topicComments.filter((c) => !c.resolved).length;
  const visible = hideResolved ? topicComments.filter((c) => !c.resolved) : topicComments;
  const wholeLabel = topicKind === 'doc' ? 'Whole document' : 'Whole artifact';

  useEffect(() => {
    if (target.kind !== 'topic') textareaRef.current?.focus();
  }, [target]);

  useEffect(() => {
    if (!focusId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-comment-id="${focusId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setFlashId(focusId);
    const t = window.setTimeout(() => setFlashId(null), 1200);
    return () => window.clearTimeout(t);
  }, [focusId]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    try {
      await api.createComment({ topicKind, topicId, anchor: target, body: text, author: operator });
      setBody('');
      if (target.kind === 'text') setTarget(topicAnchor());
      await refreshComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleResolved(c: Comment): Promise<void> {
    await api.updateComment(c.id, { resolved: !c.resolved });
    await refreshComments();
  }

  async function remove(c: Comment): Promise<void> {
    if (!window.confirm('Delete this comment?')) return;
    await api.deleteComment(c.id);
    await refreshComments();
  }

  return (
    <aside className="comments">
      <div className="comments-head">
        <h3>
          Comments {openTotal > 0 && <span className="badge">{openTotal}</span>}
        </h3>
        {topicComments.some((c) => c.resolved) && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={hideResolved}
              onChange={(e) => setHideResolved(e.target.checked)}
            />
            hide resolved
          </label>
        )}
      </div>

      <p className="muted small composer-hint">
        Select text in the {topicKind === 'doc' ? 'document' : 'artifact'} to highlight + comment, or
        post against a section / the whole {topicKind === 'doc' ? 'document' : 'artifact'} below.
      </p>

      <form className="composer" onSubmit={submit}>
        {target.kind === 'text' ? (
          <div className="text-target">
            <span className="dot" style={{ background: target.color ?? DEFAULT_HIGHLIGHT }} />
            <span className="text-target-quote">“{truncate(target.quote ?? '', 60)}”</span>
            <button
              type="button"
              className="text-target-clear"
              onClick={() => setTarget(topicAnchor())}
              title="Clear selection"
            >
              ×
            </button>
          </div>
        ) : (
          <select
            className="target-select"
            value={target.kind === 'section' ? (target.headingSlug ?? '') : ''}
            onChange={(e) => {
              const h = headings.find((x) => x.slug === e.target.value);
              setTarget(h ? sectionAnchor(h.slug, h.text) : topicAnchor());
            }}
          >
            <option value="">{wholeLabel}</option>
            {headings.map((h) => (
              <option key={h.slug} value={h.slug}>
                {' '.repeat((h.depth - 1) * 2)}§ {h.text}
              </option>
            ))}
          </select>
        )}
        <textarea
          ref={textareaRef}
          className="composer-body"
          placeholder={
            target.kind === 'text'
              ? 'Comment on the selected text (markdown supported)'
              : target.kind === 'section'
                ? `Comment on “${target.headingText}” (markdown supported)`
                : 'Add a comment (markdown supported)'
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
        />
        <div className="composer-foot">
          <span className="muted small">
            as <strong>{operator}</strong>
          </span>
          <button type="submit" className="btn primary" disabled={busy || !body.trim()}>
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <p className="error-text small">{error}</p>}
      </form>

      <ul className="comment-list" ref={listRef}>
        {visible.length === 0 && <li className="muted small pad-sm">No comments yet.</li>}
        {visible.map((c) => (
          <li
            key={c.id}
            data-comment-id={c.id}
            className={`comment${c.resolved ? ' resolved' : ''}${flashId === c.id ? ' flash' : ''}`}
          >
            <div className="comment-meta">
              <span className="comment-author">{c.author}</span>
              <span className="muted small">{relativeTime(c.createdAt)}</span>
              {c.resolved && <span className="pill resolved-pill">resolved</span>}
            </div>
            {c.anchor.kind === 'text' && c.anchor.quote && (
              <button type="button" className="quote-tag" onClick={() => onJump?.(c)} title="Jump to highlight">
                <span className="dot" style={{ background: c.anchor.color ?? DEFAULT_HIGHLIGHT }} />
                re: “{truncate(c.anchor.quote, 48)}”
              </button>
            )}
            {c.anchor.kind === 'section' && c.anchor.headingSlug && (
              <a className="section-tag" href={`#${c.anchor.headingSlug}`}>
                § {c.anchor.headingText}
              </a>
            )}
            <div className="comment-body">
              <Markdown>{c.body}</Markdown>
            </div>
            <div className="comment-actions">
              <button type="button" className="btn ghost small" onClick={() => void toggleResolved(c)}>
                {c.resolved ? 'Reopen' : 'Resolve'}
              </button>
              <button type="button" className="btn ghost small danger" onClick={() => void remove(c)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
