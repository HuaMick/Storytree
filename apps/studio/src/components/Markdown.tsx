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
  /** When set, headings render a "comment on section" affordance (data-slug). */
  onCommentHeading?: (target: CommentTarget) => void;
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

/**
 * Renders markdown. Headings get stable slug ids (matching comment anchors) and
 * an optional "comment on section" button tagged with `data-slug` — the live
 * comment count on that button is set imperatively by the annotation layer, so
 * this subtree can be memoized and never reconciled (which would strip
 * highlight marks).
 */
export function Markdown({ children, baseDocId = '', onCommentHeading }: MarkdownProps): React.JSX.Element {
  const { docIds } = useAppData();

  function heading(level: 1 | 2 | 3 | 4) {
    return function Heading({ children: kids }: { children?: ReactNode }): React.JSX.Element {
      const text = nodeToText(kids);
      const slug = slugify(text);
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
              className="md-comment-btn"
              data-slug={slug}
              onClick={() => onCommentHeading({ slug, text })}
              title="Comment on this section"
            >
              💬
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
