// Shared data shapes for the studio foundation. These are the on-disk contract
// for the dev-server JSON store (apps/studio/data/*.json) and the client.
//
// Forum framing (see apps/studio/README.md): every **topic** is either a
// document (an ADR / glossary / open-question) or a guidance **asset**;
// **comments** are the posts attached to a topic — optionally to a section.

export type TopicKind = 'doc' | 'asset';

/** Where on a topic a comment is attached. */
export interface CommentAnchor {
  /** 'topic' = the whole document/asset; 'section' = a specific heading. */
  kind: 'topic' | 'section';
  /** Stable heading slug (matches the rendered heading's id); null for topic-level. */
  headingSlug: string | null;
  /** Human-readable heading text, for display; null for topic-level. */
  headingText: string | null;
}

/** A post in the forum — feedback attached to a doc or asset. */
export interface Comment {
  id: string;
  topicKind: TopicKind;
  /** Doc relpath under docs/ (e.g. "decisions/0002-...md") or an asset id. */
  topicId: string;
  anchor: CommentAnchor;
  /** Markdown. */
  body: string;
  /** Single local operator identity for now (ADR-0008 / adjudication §C). */
  author: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt: string | null;
}

/** Fields a client supplies when creating a comment; the server stamps the rest. */
export interface NewComment {
  topicKind: TopicKind;
  topicId: string;
  anchor: CommentAnchor;
  body: string;
  author: string;
}

/**
 * The v1 (Agentic) asset taxonomy: a typed, reusable unit of agent guidance.
 * Three core kinds the owner named — principle / definition / guideline — plus
 * the other v1 buckets, cheap to keep. The one-line gloss per category is shown
 * in the UI.
 */
export type AssetCategory =
  | 'principle' // "how to judge"
  | 'definition' // "what something is"
  | 'guideline' // "what to do"
  | 'context' // "what world we operate in"
  | 'governance' // "which surface beats another"
  | 'glossary'; // "canonical term"

/**
 * A modular, injectable unit of guidance — the seed of the injectable guidance
 * library (open-questions §9 / adjudication §J). Named `GuidanceAsset`, NOT bare
 * `asset`: the glossary reserves `asset` for tree/game art, and the owner's docs
 * say the knowledge tier, when it returns, must be named something else.
 */
export interface GuidanceAsset {
  /** kebab-case slug; unique; the v1 `name`. */
  id: string;
  category: AssetCategory;
  title: string;
  /** One line: what it is / when to inject it (the v1 `description`). */
  description: string;
  /** Markdown body — the guidance itself. */
  body: string;
  /** Free-form categorisation. */
  tags: string[];
  /**
   * Topic refs this asset points at: "doc:<relpath>" or "asset:<id>". The seed
   * of v1's reciprocity-checked `current_consumers` references.
   */
  references: string[];
  createdAt: string;
  updatedAt: string;
}

/** Fields a client supplies when creating/replacing an asset. */
export interface AssetInput {
  id: string;
  category: AssetCategory;
  title: string;
  description: string;
  body: string;
  tags: string[];
  references: string[];
}

/** Lightweight listing entry for a document topic. */
export interface DocMeta {
  /** Relpath under docs/, e.g. "decisions/0002-...md". */
  id: string;
  title: string;
  /** "Decisions" for ADRs under decisions/, else "Reference". */
  group: string;
}

export interface DocContent {
  id: string;
  title: string;
  markdown: string;
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  'principle',
  'definition',
  'guideline',
  'context',
  'governance',
  'glossary',
];

/** One-line gloss per category (shown in the library UI). */
export const ASSET_CATEGORY_GLOSS: Record<AssetCategory, string> = {
  principle: 'how to judge',
  definition: 'what something is',
  guideline: 'what to do',
  context: 'what world we operate in',
  governance: 'which surface beats another',
  glossary: 'a canonical term',
};
