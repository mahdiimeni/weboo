/**
 * Web Highlighter — article-tag domain rules (pure: no DOM, no storage)
 *
 * v1.2.15: an article (a dashboard card / a urlNorm) can carry user tags —
 * categorization of the ARTICLE itself, orthogonal to the highlight colors.
 * All tag rules live in this one module (single source) and are consumed by:
 *   - the storage layer (shared/store.js) as the integrity gate for the
 *     persisted `hlx:tags` map (reads and imports are normalized here);
 *   - the dashboard (input validation, filtering, chip inventory).
 * It is loaded everywhere shared/store.js loads — script order: after
 * shared/constants.js, before shared/store.js (see packaging tests).
 *
 * Case policy: comparison/dedup is ASCII-case-insensitive (Persian has no
 * case); the FIRST spelling encountered wins as the display form.
 *
 * Phase 2 migration (TypeScript): compiled by `bun run build:ext` into
 * extension/shared/tags.js — never edit the .js directly.
 */
(function () {
  'use strict';

  interface TagCount { tag: string; count: number }
  interface TagsApi {
    sanitizeTag: (raw: unknown) => string | null;
    sanitizeTagList: (list: unknown) => string[];
    normalizeTagMap: (obj: unknown) => Record<string, string[]>;
    hasTag: (list: unknown, tag: string | null | undefined) => boolean;
    toggleTag: (list: unknown, tag: string) => string[];
    tagCounts: (tagMap: unknown) => TagCount[];
    hasActiveTag: (tags: unknown, active: Set<string> | null | undefined) => boolean;
  }
  interface HlSlice {
    TAG_MAX_LEN: number;
    TAG_MAX_PER_ARTICLE: number;
    tags?: TagsApi;
  }

  const g = globalThis as unknown as { HL?: HlSlice };
  /* constants.js loads first everywhere (packaging-tested) — the empty
     fallback is a formality it always fills */
  const HL = (g.HL = g.HL || ({} as HlSlice)) as HlSlice;

  /** Comparison key (case-insensitive; identity for Persian text) */
  function fold(t: string): string { return String(t).toLowerCase(); }

  /**
   * Clean single tag, or null when unusable. Only strings are accepted —
   * non-string input (numbers, objects, stray values from a crafted backup
   * file) is rejected at the gate instead of being coerced into junk tags.
   * Persian ZWNJ (نیم‌فاصله) is preserved — it is part of words like
   * «برنامه‌نویسی»; only real whitespace collapses (\s does not match U+200C).
   * The length cap (HL.TAG_MAX_LEN) applies AFTER cleanup.
   */
  function sanitizeTag(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    var t = raw.replace(/\s+/g, ' ').trim();
    if (!t) return null;
    if (t.length > HL.TAG_MAX_LEN) return null;
    return t;
  }

  /**
   * Clean list: sanitize each entry, drop unusable ones, dedupe
   * case-insensitively (first spelling wins), cap the count at
   * HL.TAG_MAX_PER_ARTICLE. Non-array input → [].
   */
  function sanitizeTagList(list: unknown): string[] {
    if (!Array.isArray(list)) return [];
    var out: string[] = [];
    var seen: Record<string, boolean> = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var t = sanitizeTag(list[i]);
      if (!t) continue;
      var k = fold(t);
      if (seen[k]) continue;
      seen[k] = true;
      out.push(t);
      if (out.length >= HL.TAG_MAX_PER_ARTICLE) break;
    }
    return out;
  }

  /**
   * Structural validation of the persisted shape { <urlNorm>: [tags] } —
   * the integrity gate for storage reads and backup imports. Non-objects,
   * non-array values, empty arrays and empty keys are dropped; values are
   * sanitized like any other list.
   */
  function normalizeTagMap(obj: unknown): Record<string, string[]> {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    var out: Record<string, string[]> = {};
    Object.keys(obj).forEach(function (k) {
      var key = String(k);
      if (!key) return;
      var clean = sanitizeTagList((obj as Record<string, unknown>)[k]);
      if (clean.length) out[key] = clean;
    });
    return out;
  }

  /** Case-insensitive membership test for one tag in a list. */
  function hasTag(list: unknown, tag: string | null | undefined): boolean {
    if (!tag) return false;
    var k = fold(tag);
    return (Array.isArray(list) ? list : []).some(function (t) {
      return fold(t as string) === k;
    });
  }

  /** Pure add/remove by tag name (case-insensitive); returns a NEW array. */
  function toggleTag(list: unknown, tag: string): string[] {
    var cur = Array.isArray(list) ? (list as string[]) : [];
    if (hasTag(cur, tag)) {
      var k = fold(tag);
      return cur.filter(function (t) { return fold(t) !== k; });
    }
    return cur.concat([tag]);
  }

  /**
   * Filter-chip inventory: [{ tag, count }] across all articles —
   * case-folded merge (first spelling wins as display form), sorted by
   * count desc, ties in Persian locale order. The dashboard toolbar builds
   * its tag filter row from this list.
   */
  function tagCounts(tagMap: unknown): TagCount[] {
    var m = normalizeTagMap(tagMap);
    var tally: Record<string, TagCount> = Object.create(null); /* folded key → { tag, count } */
    Object.keys(m).forEach(function (k) {
      m[k].forEach(function (t) {
        var fk = fold(t);
        tally[fk] = tally[fk] || { tag: t, count: 0 };
        tally[fk].count++;
      });
    });
    return Object.keys(tally).map(function (fk) { return tally[fk]; })
      .sort(function (a, b) {
        return (b.count - a.count) || (a.tag.localeCompare(b.tag, 'fa'));
      });
  }

  /**
   * Union semantics (mirrors the color chips): does this article carry ANY
   * of the active tags? Both sides fold, so a chip's display spelling
   * matches an article's stored spelling regardless of ASCII case.
   */
  function hasActiveTag(tags: unknown, active: Set<string> | null | undefined): boolean {
    if (!active || !active.size) return false;
    var folded: Record<string, boolean> = Object.create(null);
    active.forEach(function (a) { folded[fold(a)] = true; });
    return (Array.isArray(tags) ? tags : []).some(function (t) {
      return !!folded[fold(t as string)];
    });
  }

  HL.tags = {
    sanitizeTag: sanitizeTag,
    sanitizeTagList: sanitizeTagList,
    normalizeTagMap: normalizeTagMap,
    hasTag: hasTag,
    toggleTag: toggleTag,
    tagCounts: tagCounts,
    hasActiveTag: hasActiveTag
  };
})();
