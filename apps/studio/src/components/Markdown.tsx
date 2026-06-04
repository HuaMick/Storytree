import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppData } from '../lib/appData';
import { docHref } from '../lib/route';
import { resolveDocHref, slugify } from '../lib/markdown';

export interface CommentTarget {
  slug: string;
  text: string;
}

interface MarkdownProps {
  children: string;
  /** Current doc id, so relative in-corpus links resolve. */
  baseDocId?: string;
  /** When set, headings render a "comment on section" affordance. */
  onCommentHeading?: (target: CommentTarget) => void;
  /** slug -> unresolved comment count, for per-heading badges. */
  commentCounts?: Record<string, number>;
}

function nodeToText(node: ReactNode): string {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (isValidElement(node)) {
    return nodeToText((node.props as { children?: ReactNode }).children);
  }
  return '';
}

export function Markdown({
  children,
  baseDocId = '',
  onCommentHeading,
  commentCounts,
}: MarkdownProps): React.JSX.Element {
  const { docIds } = useAppData();

  function heading(level: 1 | 2 | 3 | 4) {
    return function Heading({ children: kids }: { children?: ReactNode }): React.JSX.Element {
      const text = nodeToText(kids);
      const slug = slugify(text);
      const count = commentCounts?.[slug] ?? 0;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      return (
        <Tag id={slug} className="md-heading">
          <a className="md-anchor" href={`#${slug}`} aria-hidden="true" tabIndex={-1}>
            #
          </a>
          <span className="md-heading-text">{kids}</span>
          {onCommentHeading && (
            <button
              type="button"
              className={count > 0 ? 'md-comment-btn has-comments' : 'md-comment-btn'}
              onClick={() => onCommentHeading({ slug, text })}
              title={count > 0 ? `${count} comment(s) — add another` : 'Comment on this section'}
            >
              💬{count > 0 ? ` ${count}` : ''}
            </button>
          )}
        </Tag>
      );
    };
  }

  const components: Components = {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    a({ href, children: kids }) {
      if (!href) return <a>{kids}</a>;
      const target = resolveDocHref(href, baseDocId, docIds);
      if (target) return <a href={docHref(target)}>{kids}</a>;
      if (/^[a-z]+:\/\//i.test(href)) {
        return (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {kids}
          </a>
        );
      }
      return <a href={href}>{kids}</a>;
    },
  };

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
