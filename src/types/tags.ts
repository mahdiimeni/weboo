/**
 * Article-tag types (modernization Phase 1).
 *
 * Storage shape (store.js key `hlx:tags`): `{ [urlNorm]: string[] }`.
 * Runtime limits live in HL.TAG_MAX_LEN / HL.TAG_MAX_PER_ARTICLE and are
 * enforced by shared/tags.js — pinned by the parity test, not duplicated here.
 */

/** A single normalized tag value (whitespace-trimmed, capped by the runtime limits). */
export type Tag = string;

/** Article tags keyed by normalized article URL. */
export type ArticleTags = Record<string, Tag[]>;
