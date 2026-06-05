// Text-quote anchoring + inline highlighting (W3C Web Annotation model).
//
// A text comment stores the exact `quote` plus a little `prefix`/`suffix`
// context and a `startOffset` hint. We re-find the quote in the rendered DOM
// (scoped to its section) and wrap it in <mark> elements — robust to re-render
// and to edits above it. No external dependency.

import type { Comment, CommentAnchor } from '../types';
import { DEFAULT_HIGHLIGHT } from '../types';

const CONTEXT = 32;

// --- anchor builders ---------------------------------------------------------

export function topicAnchor(): CommentAnchor {
  return {
    kind: 'topic',
    headingSlug: null,
    headingText: null,
    quote: null,
    prefix: null,
    suffix: null,
    startOffset: null,
    color: null,
  };
}

export function sectionAnchor(slug: string, text: string): CommentAnchor {
  return { ...topicAnchor(), kind: 'section', headingSlug: slug, headingText: text };
}

export function textAnchorFrom(draft: TextAnchorDraft, color: string): CommentAnchor {
  return {
    kind: 'text',
    headingSlug: draft.headingSlug,
    headingText: draft.headingText,
    quote: draft.quote,
    prefix: draft.prefix,
    suffix: draft.suffix,
    startOffset: draft.startOffset,
    color,
  };
}

interface Segment {
  node: Text;
  start: number;
  end: number;
}
interface TextMap {
  text: string;
  segments: Segment[];
}

/** Flatten a subtree's text into one string + a node→offset map, in DOM order. */
function buildTextMap(root: HTMLElement): TextMap {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = '';
  const segments: Segment[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const tn = n as Text;
    const len = tn.data.length;
    if (len === 0) continue;
    segments.push({ node: tn, start: text.length, end: text.length + len });
    text += tn.data;
  }
  return { text, segments };
}

function firstTextOffset(map: TextMap, el: Element): number {
  for (const seg of map.segments) {
    if (el.contains(seg.node)) return seg.start;
  }
  return -1;
}

/** Absolute text offset of a DOM (container, offset) selection boundary. */
function absOffset(map: TextMap, container: Node, offset: number): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const seg = map.segments.find((s) => s.node === container);
    return seg ? seg.start + offset : -1;
  }
  const child = container.childNodes[offset];
  if (child) {
    const seg = map.segments.find((s) => s.node === child || child.contains(s.node));
    if (seg) return seg.start;
  }
  const within = map.segments.find((s) => container.contains(s.node));
  return within ? within.start : -1;
}

interface HeadingRef {
  slug: string;
  text: string;
}

function nearestHeading(root: HTMLElement, map: TextMap, abs: number): HeadingRef | null {
  let best: Element | null = null;
  let bestOffset = -1;
  for (const h of root.querySelectorAll('.md-heading')) {
    const o = firstTextOffset(map, h);
    if (o >= 0 && o <= abs && o > bestOffset) {
      bestOffset = o;
      best = h;
    }
  }
  if (!best) return null;
  const text = best.querySelector('.md-heading-text')?.textContent?.trim() ?? best.textContent?.trim() ?? '';
  return { slug: best.id, text };
}

/** The [start, end) text window of a section (heading → next heading). */
function sectionWindow(root: HTMLElement, map: TextMap, headingSlug: string | null): [number, number] {
  if (!headingSlug) return [0, map.text.length];
  const target = root.querySelector(`[id="${headingSlug}"]`);
  if (!target) return [0, map.text.length];
  const start = firstTextOffset(map, target);
  if (start < 0) return [0, map.text.length];
  let end = map.text.length;
  let passed = false;
  for (const h of root.querySelectorAll('.md-heading')) {
    if (h === target) {
      passed = true;
      continue;
    }
    if (passed) {
      const o = firstTextOffset(map, h);
      if (o >= 0) {
        end = o;
        break;
      }
    }
  }
  return [start, end];
}

export interface TextAnchorDraft {
  quote: string;
  prefix: string;
  suffix: string;
  startOffset: number;
  headingSlug: string | null;
  headingText: string | null;
}

/** Compute a durable text-quote anchor from a live selection range. */
export function computeTextAnchor(root: HTMLElement, range: Range): TextAnchorDraft | null {
  const quote = range.toString();
  if (!quote.trim()) return null;
  const map = buildTextMap(root);
  const start = absOffset(map, range.startContainer, range.startOffset);
  const end = absOffset(map, range.endContainer, range.endOffset);
  if (start < 0 || end < 0 || end <= start) return null;
  const heading = nearestHeading(root, map, start);
  return {
    quote: map.text.slice(start, end),
    prefix: map.text.slice(Math.max(0, start - CONTEXT), start),
    suffix: map.text.slice(end, end + CONTEXT),
    startOffset: start,
    headingSlug: heading?.slug ?? null,
    headingText: heading?.text ?? null,
  };
}

function rangeFromOffsets(map: TextMap, start: number, end: number): Range | null {
  const startSeg = map.segments.find((s) => start >= s.start && start < s.end);
  const endSeg = map.segments.find((s) => end > s.start && end <= s.end);
  if (!startSeg || !endSeg) return null;
  const range = document.createRange();
  range.setStart(startSeg.node, start - startSeg.start);
  range.setEnd(endSeg.node, end - endSeg.start);
  return range;
}

/** Best occurrence of the anchor's quote, scored by context + position. */
function findQuoteRange(root: HTMLElement, anchor: CommentAnchor): Range | null {
  const quote = anchor.quote;
  if (!quote) return null;
  const map = buildTextMap(root);
  const hay = map.text;
  const [winStart, winEnd] = sectionWindow(root, map, anchor.headingSlug);

  const candidates: number[] = [];
  for (let i = hay.indexOf(quote, winStart); i >= 0 && i + quote.length <= winEnd; i = hay.indexOf(quote, i + 1)) {
    candidates.push(i);
  }
  if (candidates.length === 0) {
    for (let i = hay.indexOf(quote); i >= 0; i = hay.indexOf(quote, i + 1)) candidates.push(i);
  }
  if (candidates.length === 0) return null;

  let best = candidates[0] as number;
  let bestScore = -Infinity;
  for (const idx of candidates) {
    let score = 0;
    if (anchor.prefix) {
      const pre = hay.slice(Math.max(0, idx - anchor.prefix.length), idx);
      if (pre.endsWith(anchor.prefix)) score += 2;
    }
    if (anchor.suffix) {
      const suf = hay.slice(idx + quote.length, idx + quote.length + anchor.suffix.length);
      if (suf.startsWith(anchor.suffix)) score += 2;
    }
    if (anchor.startOffset != null) score -= Math.abs(idx - anchor.startOffset) / 1000;
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  }
  return rangeFromOffsets(map, best, best + quote.length);
}

function wrapRange(range: Range, make: () => HTMLElement): void {
  const nodes: Text[] = [];
  const ca = range.commonAncestorContainer;
  if (ca.nodeType === Node.TEXT_NODE) {
    nodes.push(ca as Text);
  } else {
    const walker = document.createTreeWalker(ca, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);
  }
  for (const tn of nodes) {
    const startOff = tn === range.startContainer ? range.startOffset : 0;
    const endOff = tn === range.endContainer ? range.endOffset : tn.data.length;
    if (endOff <= startOff) continue;
    const mid = startOff === 0 ? tn : tn.splitText(startOff);
    if (endOff - startOff < mid.data.length) mid.splitText(endOff - startOff);
    const mark = make();
    mid.parentNode?.insertBefore(mark, mid);
    mark.appendChild(mid);
  }
}

/** Remove every highlight mark, restoring the original text nodes. */
export function clearHighlights(root: HTMLElement): void {
  for (const m of root.querySelectorAll('mark.st-hl')) {
    const parent = m.parentNode;
    if (!parent) continue;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
  }
  root.normalize();
}

export interface GutterTick {
  id: string;
  color: string;
  top: number;
  resolved: boolean;
}

/** Re-apply highlights for the given text comments; return gutter tick positions. */
export function applyHighlights(root: HTMLElement, textComments: Comment[]): GutterTick[] {
  clearHighlights(root);
  const ticks: GutterTick[] = [];
  const articleTop = root.getBoundingClientRect().top;
  for (const c of textComments) {
    if (c.anchor.kind !== 'text' || !c.anchor.quote) continue;
    const range = findQuoteRange(root, c.anchor);
    if (!range) continue;
    const color = c.anchor.color ?? DEFAULT_HIGHLIGHT;
    wrapRange(range, () => {
      const m = document.createElement('mark');
      m.className = 'st-hl';
      m.dataset.id = c.id;
      if (c.resolved) m.dataset.resolved = 'true';
      m.style.setProperty('--hl', color);
      return m;
    });
    const first = root.querySelector<HTMLElement>(`mark.st-hl[data-id="${c.id}"]`);
    if (first) {
      ticks.push({ id: c.id, color, resolved: c.resolved, top: first.getBoundingClientRect().top - articleTop });
    }
  }
  return ticks;
}
