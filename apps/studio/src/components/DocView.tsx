import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAppData } from '../lib/appData';
import { useOperator } from '../lib/operator';
import { parseHeadings } from '../lib/markdown';
import type { Comment, CommentAnchor, DocContent } from '../types';
import { Markdown, type CommentTarget } from './Markdown';
import { CommentPanel } from './CommentPanel';

const TOPIC_ANCHOR: CommentAnchor = { kind: 'topic', headingSlug: null, headingText: null };

function sectionCounts(comments: Comment[], topicId: string): Record<string, number> {
  const rec: Record<string, number> = {};
  for (const c of comments) {
    if (c.topicId === topicId && !c.resolved && c.anchor.kind === 'section' && c.anchor.headingSlug) {
      rec[c.anchor.headingSlug] = (rec[c.anchor.headingSlug] ?? 0) + 1;
    }
  }
  return rec;
}

export function DocView({ id }: { id: string }): React.JSX.Element {
  const { comments, docTitles } = useAppData();
  const [operator] = useOperator();
  const [content, setContent] = useState<DocContent | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [target, setTarget] = useState<CommentAnchor>(TOPIC_ANCHOR);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setContent(null);
    setTarget(TOPIC_ANCHOR);
    void (async () => {
      try {
        const c = await api.docContent(id);
        if (!active) return;
        setContent(c);
        setStatus('ready');
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const headings = useMemo(() => (content ? parseHeadings(content.markdown) : []), [content]);
  const counts = useMemo(() => sectionCounts(comments, id), [comments, id]);

  function commentOnHeading(t: CommentTarget): void {
    setTarget({ kind: 'section', headingSlug: t.slug, headingText: t.text });
  }

  if (status === 'loading') return <p className="muted pad">Loading {docTitles.get(id) ?? id}…</p>;
  if (status === 'error' || !content) {
    return (
      <div className="pad error-box">
        <h2>Couldn’t load this document</h2>
        <p className="muted">{error}</p>
      </div>
    );
  }

  return (
    <div className="doc-layout">
      <article className="doc">
        <div className="doc-crumb muted small">docs / {id}</div>
        <Markdown baseDocId={id} onCommentHeading={commentOnHeading} commentCounts={counts}>
          {content.markdown}
        </Markdown>
      </article>
      <CommentPanel
        topicKind="doc"
        topicId={id}
        headings={headings}
        operator={operator}
        target={target}
        setTarget={setTarget}
      />
    </div>
  );
}
