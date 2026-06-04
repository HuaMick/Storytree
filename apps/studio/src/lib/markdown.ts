// Markdown helpers shared by the renderer and the comment system.
//
// The SAME `slugify` produces both a rendered heading's `id` and a section
// comment's `headingSlug`, so a comment reliably targets the heading it was
// attached to (the task's "stable section/heading anchors").

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '') // markdown emphasis marks
    .replace(/[^\w\s-]/g, '') // punctuation, smart quotes, parens
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface Heading {
  depth: number;
  text: string;
  slug: string;
}

/** Parse ATX headings (`#`..`####`) from markdown, skipping fenced code blocks. */
export function parseHeadings(markdown: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (m && m[1] && m[2]) {
      out.push({ depth: m[1].length, text: m[2].trim(), slug: slugify(m[2].trim()) });
    }
  }
  return out;
}

function normalizePosix(p: string): string {
  const stack: string[] = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

/**
 * Resolve a markdown link href to a known doc id (so in-corpus cross-links
 * navigate inside the studio), or null if it isn't an in-corpus doc.
 * Tries the link relative to the current doc's dir, then docs-root-relative.
 */
export function resolveDocHref(
  href: string,
  baseDocId: string,
  knownIds: Set<string>,
): string | null {
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith('#') || href.startsWith('mailto:')) {
    return null;
  }
  const h = href.split('#')[0] ?? '';
  if (!h) return null;
  const baseDir = baseDocId.includes('/') ? baseDocId.slice(0, baseDocId.lastIndexOf('/')) : '';
  const candidates = [
    normalizePosix(baseDir ? `${baseDir}/${h}` : h),
    normalizePosix(h.replace(/^docs\//, '')),
    normalizePosix(h),
  ];
  for (const c of candidates) {
    if (knownIds.has(c)) return c;
  }
  return null;
}
