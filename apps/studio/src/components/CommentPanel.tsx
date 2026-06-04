import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAppData } from '../lib/appData';
import { relativeTime } from '../lib/format';
import type { Heading } from '../lib/markdown';
import type { Comment, CommentAnchor, TopicKind } from '../types';
import { Markdown } from './Markdown';

interface CommentPanelProps {
  topicKind: TopicKind;
  topicId: string;
  /** Headings of the topic body, for the section-target selector. */
  headings: Heading[];
  operator: string;
  target: CommentAnchor;
  setTarget: (anchor: CommentAnchor) => void;
}

const TOPIC_ANCHOR: CommentAnchor = { kind: 'topic', headingSlug: null, headingText: null };

export function CommentPanel({
  topicKind,
  topicId,
  headings,
  operator,
  target,
  setTarget,
}: CommentPanelProps): React.JSX.Element {
  const { comments, refreshComments } = useAppData();
  const [body, setBody] = useState('');
  const [hideResolved, setHideResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const topicComments = useMemo(
    () =>
      comments
        .filter((c) => c.topicId === topicId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments, topicId],
  );
  const openTotal = topicComments.filter((c) => !c.resolved).length;
  const visible = hideResolved ? topicComments.filter((c) => !c.resolved) : topicComments;
  const wholeLabel = topicKind === 'doc' ? 'Whole document' : 'Whole asset';

  useEffect(() => {
    if (target.kind === 'section') textareaRef.current?.focus();
  }, [target]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    try {
      await api.createComment({ topicKind, topicId, anchor: target, body: text, author: operator });
      setBody('');
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

  function onSelectTarget(value: string): void {
    if (!value) return setTarget(TOPIC_ANCHOR);
    const h = headings.find((x) => x.slug === value);
    setTarget(h ? { kind: 'section', headingSlug: h.slug, headingText: h.text } : TOPIC_ANCHOR);
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

      <form className="composer" onSubmit={submit}>
        <select
          className="target-select"
          value={target.kind === 'section' ? (target.headingSlug ?? '') : ''}
          onChange={(e) => onSelectTarget(e.target.value)}
        >
          <option value="">{wholeLabel}</option>
          {headings.map((h) => (
            <option key={h.slug} value={h.slug}>
              {' '.repeat((h.depth - 1) * 2)}§ {h.text}
            </option>
          ))}
        </select>
        <textarea
          ref={textareaRef}
          className="composer-body"
          placeholder={
            target.kind === 'section'
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

      <ul className="comment-list">
        {visible.length === 0 && <li className="muted small pad-sm">No comments yet.</li>}
        {visible.map((c) => (
          <li key={c.id} className={c.resolved ? 'comment resolved' : 'comment'}>
            <div className="comment-meta">
              <span className="comment-author">{c.author}</span>
              <span className="muted small">{relativeTime(c.createdAt)}</span>
              {c.resolved && <span className="pill resolved-pill">resolved</span>}
            </div>
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
