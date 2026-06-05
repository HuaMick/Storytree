import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useAppData } from './appData';
import {
  applyHighlights,
  clearHighlights,
  computeTextAnchor,
  textAnchorFrom,
  topicAnchor,
  type GutterTick,
  type TextAnchorDraft,
} from './annotate';
import {
  DEFAULT_HIGHLIGHT,
  HIGHLIGHT_COLORS,
  type Comment,
  type CommentAnchor,
} from '../types';

interface Popover {
  left: number;
  top: number;
  draft: TextAnchorDraft;
}
interface Hover {
  left: number;
  top: number;
  comment: Comment;
}

export interface Annotations {
  target: CommentAnchor;
  setTarget: (anchor: CommentAnchor) => void;
  focusId: string | null;
  overlays: ReactNode;
  jumpToAnchor: (comment: Comment) => void;
  articleHandlers: {
    onMouseUp: () => void;
    onMouseOver: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onClick: (e: React.MouseEvent) => void;
  };
}

/**
 * Text-selection commenting for one topic. Attach `articleHandlers` to the
 * element holding the rendered markdown (which must be `position: relative`),
 * render `overlays` inside it, and wire `target`/`focusId`/`jumpToAnchor` to the
 * comment panel. `contentKey` should change whenever the rendered body changes,
 * so highlights re-apply.
 */
export function useAnnotations(
  topicId: string,
  rootRef: RefObject<HTMLElement | null>,
  contentKey: string,
): Annotations {
  const { comments } = useAppData();
  const [target, setTarget] = useState<CommentAnchor>(topicAnchor());
  const [ticks, setTicks] = useState<GutterTick[]>([]);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_HIGHLIGHT);
  const [hover, setHover] = useState<Hover | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [resizeTick, setResizeTick] = useState(0);

  const topicComments = useMemo(
    () => comments.filter((c) => c.topicId === topicId),
    [comments, topicId],
  );
  const textComments = useMemo(
    () => topicComments.filter((c) => c.anchor.kind === 'text'),
    [topicComments],
  );

  // Re-apply ALL comment-reactive DOM decoration (highlights, gutter, section
  // badges) here. The markdown subtree is memoized by the caller, so React never
  // reconciles it — these imperative mutations survive re-renders.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setTicks(applyHighlights(root, topicComments));
    updateHeadingBadges(root, topicComments);
    return () => {
      clearHighlights(root);
    };
  }, [rootRef, topicComments, resizeTick, contentKey]);

  useEffect(() => {
    const onResize = (): void => setResizeTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent): void => {
      if (!(e.target as Element).closest('.sel-popover')) setPopover(null);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPopover(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popover]);

  const onMouseUp = useCallback((): void => {
    const root = rootRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    const draft = computeTextAnchor(root, range);
    if (!draft) return;
    const rect = range.getBoundingClientRect();
    setPopover({ left: rect.left + rect.width / 2, top: rect.top, draft });
  }, [rootRef]);

  const onMouseOver = useCallback(
    (e: React.MouseEvent): void => {
      const mark = (e.target as Element).closest?.('mark.st-hl') as HTMLElement | null;
      if (!mark) {
        setHover(null);
        return;
      }
      const c = textComments.find((x) => x.id === mark.dataset.id);
      if (!c) {
        setHover(null);
        return;
      }
      const rect = mark.getBoundingClientRect();
      setHover({ left: rect.left, top: rect.top, comment: c });
    },
    [textComments],
  );

  const onMouseLeave = useCallback((): void => setHover(null), []);

  const jumpById = useCallback(
    (id: string): void => {
      const mark = rootRef.current?.querySelector<HTMLElement>(`mark.st-hl[data-id="${id}"]`);
      if (!mark) return;
      mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
      mark.classList.add('flash');
      window.setTimeout(() => mark.classList.remove('flash'), 1000);
    },
    [rootRef],
  );

  const onClick = useCallback((e: React.MouseEvent): void => {
    const mark = (e.target as Element).closest?.('mark.st-hl') as HTMLElement | null;
    if (mark?.dataset.id) setFocusId(mark.dataset.id);
  }, []);

  const commit = useCallback((): void => {
    if (!popover) return;
    setTarget(textAnchorFrom(popover.draft, color));
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [popover, color]);

  const jumpToAnchor = useCallback((c: Comment): void => jumpById(c.id), [jumpById]);

  const overlays = (
    <>
      {ticks.length > 0 && (
        <div className="gutter" aria-hidden="true">
          {ticks.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.resolved ? 'gutter-tick resolved' : 'gutter-tick'}
              style={{ top: t.top, background: t.color }}
              onClick={() => {
                setFocusId(t.id);
                jumpById(t.id);
              }}
              title="Jump to comment"
            />
          ))}
        </div>
      )}
      {popover && (
        <div
          className="sel-popover"
          style={{ left: popover.left, top: popover.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="sel-colors">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={c.value === color ? 'sel-color active' : 'sel-color'}
                style={{ background: c.value }}
                onClick={() => setColor(c.value)}
                title={c.label}
                aria-label={`Highlight ${c.label}`}
              />
            ))}
          </div>
          <button type="button" className="sel-comment-btn" onClick={commit}>
            💬 Comment
          </button>
        </div>
      )}
      {hover && (
        <div className="hovercard" style={{ left: hover.left, top: hover.top }}>
          <div className="hovercard-meta">
            <span className="dot" style={{ background: hover.comment.anchor.color ?? DEFAULT_HIGHLIGHT }} />
            <strong>{hover.comment.author}</strong>
            {hover.comment.resolved && <span className="pill resolved-pill">resolved</span>}
          </div>
          <div className="hovercard-body">{snippet(hover.comment.body)}</div>
        </div>
      )}
    </>
  );

  return {
    target,
    setTarget,
    focusId,
    overlays,
    jumpToAnchor,
    articleHandlers: { onMouseUp, onMouseOver, onMouseLeave, onClick },
  };
}

function snippet(body: string): string {
  const plain = body.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 140 ? plain.slice(0, 137) + '…' : plain;
}

/** Set the live unresolved-comment count on each section's 💬 button. */
function updateHeadingBadges(root: HTMLElement, topicComments: Comment[]): void {
  const counts = new Map<string, number>();
  for (const c of topicComments) {
    if (!c.resolved && c.anchor.kind === 'section' && c.anchor.headingSlug) {
      counts.set(c.anchor.headingSlug, (counts.get(c.anchor.headingSlug) ?? 0) + 1);
    }
  }
  for (const btn of root.querySelectorAll<HTMLElement>('.md-comment-btn[data-slug]')) {
    const n = counts.get(btn.dataset.slug ?? '') ?? 0;
    btn.textContent = n > 0 ? `💬 ${n}` : '💬';
    btn.classList.toggle('has-comments', n > 0);
  }
}
