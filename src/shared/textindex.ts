/**
 * Web Highlighter — text anchoring engine
 * Turns page text into a character index so we can:
 *   1) compute a Range's offsets (at save time)
 *   2) restore the equivalent Range from the saved text (on page reload)
 * The engine is independent of DOM structure; even if the page is rewritten,
 * as long as the text is still there the highlight comes back.
 *
 * Phase 2 migration (TypeScript): compiled by `bun run build:ext` into
 * extension/shared/textindex.js — never edit the .js directly.
 *
 * NOTE (classic-script invariant): this file must contain NO import/export
 * statements — a single import flips tsc to module output and appends
 * `export {};`, which is a SyntaxError when the manifest injects the file as
 * a classic script. Cross-module types are therefore expressed as local
 * structural views until the bundler lands (Phase 6).
 */
(function () {
  'use strict';

  interface TextChunk { node: Text; start: number }
  interface Located { node: Text; offset: number }
  interface TextOffsets { start: number; end: number }
  interface TextIndex {
    root: Node | null;
    text: string;
    chunks: TextChunk[];
    length: number;
    locate(index: number): Located | null;
    offsetOf(node: Node, offset: number): number;
    offsetsOfRange(range: Range): TextOffsets | null;
  }
  /** Focused view of a highlight record as findRange consumes it (ISP:
   *  the engine reads only these fields; the full model lives in
   *  src/types/highlight.ts HighlightRecord). */
  interface FindRec { text?: string; prefix?: string; suffix?: string; start?: number; end?: number }
  interface FoundRange {
    range: Range;
    start: number;
    end: number;
    method: 'offsets' | 'exact' | 'norm';
    score: number;
  }
  interface HlSlice {
    dom?: { isHidden(el: Node): boolean };
    text?: unknown;
  }

  const g = globalThis as unknown as { HL?: HlSlice };
  const HL = (g.HL = g.HL || {}) as HlSlice;

  /** Tags whose text does not count as "document text" */
  var SKIP_TAGS: Record<string, 1> = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TEXTAREA: 1, TITLE: 1,
    IFRAME: 1, CANVAS: 1, SVG: 1, OBJECT: 1, EMBED: 1, SELECT: 1, OPTION: 1,
    VIDEO: 1, AUDIO: 1
  };

  /**
   * TreeWalker filter for highlightable text nodes.
   * Nodes inside the extension's own UI (data-hlx-ui) and contenteditable areas are rejected.
   * Values: 1=ACCEPT, 2=REJECT (NodeFilter hard-coded numerically for compatibility)
   */
  function acceptTextNode(node: Node): 1 | 2 {
    var p = node.parentElement;
    while (p) {
      if (SKIP_TAGS[p.tagName]) return 2;
      if (p.hasAttribute && p.hasAttribute('data-hlx-ui')) return 2;
      if (p.isContentEditable) return 2;
      p = p.parentElement;
    }
    var data = (node as Text).data;
    if (!data || data.length === 0) return 2;
    return 1;
  }

  /**
   * Builds the document text index: contiguous text + a map of chunks (text node + its start)
   */
  function buildTextIndex(root: Node | null | undefined): TextIndex {
    var chunks: TextChunk[] = [];
    var text = '';
    if (!root) {
      return {
        root: root || null, text: '', chunks: [], length: 0,
        locate: function () { return null; },
        offsetOf: function () { return -1; },
        offsetsOfRange: function () { return null; }
      };
    }

    var walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */, { acceptNode: acceptTextNode });
    var n: Text | null;
    while ((n = walker.nextNode() as Text | null)) {
      chunks.push({ node: n, start: text.length });
      text += n.data;
    }

    function locate(index: number): Located | null {
      if (!chunks.length || index < 0 || index >= text.length) return null;
      var lo = 0, hi = chunks.length - 1;
      while (lo < hi) {
        var mid = (lo + hi + 1) >> 1;
        if (chunks[mid].start <= index) lo = mid; else hi = mid - 1;
      }
      var c = chunks[lo];
      return { node: c.node, offset: index - c.start };
    }

    function offsetOf(node: Node, offset: number): number {
      for (var i = 0; i < chunks.length; i++) {
        if (chunks[i].node === node) return chunks[i].start + offset;
      }
      return -1;
    }

    function offsetsOfRange(range: Range): TextOffsets | null {
      var s = offsetOf(range.startContainer, range.startOffset);
      var e = offsetOf(range.endContainer, range.endOffset);
      if (s < 0 || e < 0 || e < s) return null;
      return { start: s, end: e };
    }

    return {
      root: root, text: text, chunks: chunks, length: text.length,
      locate: locate, offsetOf: offsetOf, offsetsOfRange: offsetsOfRange
    };
  }

  /** Squashes whitespace for comparison tolerant to whitespace changes */
  function squash(s: unknown): string {
    return String(s == null ? '' : s).replace(/[\s\u00a0\u200b]+/g, ' ').trim();
  }

  /**
   * Builds normalized text + a map from each normalized character to its original index
   * (consecutive spaces collapse into one; the text is trimmed at both ends)
   */
  function normInfo(s: string): { norm: string; map: number[] } {
    var norm = '';
    var map: number[] = [];
    var prevWs = true; // leading whitespace is dropped
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      var ws = (code === 32 || code === 9 || code === 10 || code === 13 || code === 12 || code === 160 || code === 8203);
      if (ws) {
        if (!prevWs) { norm += ' '; map.push(i); prevWs = true; }
      } else {
        norm += s.charAt(i);
        map.push(i);
        prevWs = false;
      }
    }
    while (norm.length && norm.charAt(norm.length - 1) === ' ') {
      norm = norm.slice(0, -1);
      map.pop();
    }
    return { norm: norm, map: map };
  }

  function endsWithNorm(a: unknown, b: unknown) { return squash(a).endsWith(squash(b)); }
  function startsWithNorm(a: unknown, b: unknown) { return squash(a).startsWith(squash(b)); }

  /* ---------- Range boundary normalization ---------- */

  /**
   * The first highlightable text node in a node's subtree (or the node itself).
   */
  function firstTextNodeIn(node: Node | null | undefined): Text | null {
    if (!node) return null;
    if (node.nodeType === 3) return acceptTextNode(node) === 1 ? node as Text : null;
    if (node.nodeType !== 1) return null;
    var w = document.createTreeWalker(node, 4 /* SHOW_TEXT */, { acceptNode: acceptTextNode });
    return (w.nextNode() as Text | null) || null;
  }

  /**
   * The last highlightable text node in a node's subtree (or the node itself).
   */
  function lastTextNodeIn(node: Node | null | undefined): Text | null {
    if (!node) return null;
    if (node.nodeType === 3) return acceptTextNode(node) === 1 ? node as Text : null;
    if (node.nodeType !== 1) return null;
    var w = document.createTreeWalker(node, 4 /* SHOW_TEXT */, { acceptNode: acceptTextNode });
    var last: Text | null = null, n: Text | null;
    while ((n = w.nextNode() as Text | null)) last = n;
    return last;
  }

  function childIndexOf(parent: Node, node: Node): number {
    return Array.prototype.indexOf.call(parent.childNodes, node);
  }

  /**
   * Converts a boundary (container, offset) to the equivalent text node.
   * When a selection reaches the start/end of a block (e.g. double-clicking
   * the last word of a paragraph so the trailing period is included), browsers
   * put the boundary on the element itself (e.g. endContainer=<p> with
   * endOffset=child count).
   * This function converts the boundary to the nearest equivalent text node:
   *   - start (backward=false): the first text after the boundary
   *   - end (backward=true): the last text before the boundary
   * Returns: { node, offset } or null.
   */
  function boundaryToText(container: Node | null | undefined, offset: number, backward: boolean): Located | null {
    if (!container) return null;
    if (container.nodeType === 3) return { node: container as Text, offset: offset };
    if (container.nodeType !== 1) return null;

    var children = container.childNodes;
    var i: number;

    if (backward) {
      // the boundary is after children[offset-1] → the last text inside/before it
      for (i = Math.min(offset, children.length) - 1; i >= 0; i--) {
        var t = lastTextNodeIn(children[i]);
        if (t) return { node: t, offset: t.data.length };
      }
      var parent = container.parentNode;
      if (!parent || parent.nodeType !== 1) return null;
      return boundaryToText(parent, childIndexOf(parent, container), true);
    }

    // the boundary is before children[offset] → the first text inside/after it
    for (i = Math.min(offset, children.length); i < children.length; i++) {
      var t2 = firstTextNodeIn(children[i]);
      if (t2) return { node: t2, offset: 0 };
    }
    var parent2 = container.parentNode;
    if (!parent2 || parent2.nodeType !== 1) return null;
    return boundaryToText(parent2, childIndexOf(parent2, container) + 1, false);
  }

  /**
   * Normalizes a Range's boundaries to indexable text nodes (in place).
   * The index engine only knows text nodes; element boundaries must be converted.
   * If the boundaries end up inverted/coincident after normalization, the Range
   * may collapse — the caller handles that case as "not highlightable".
   */
  function normalizeRange(range: Range | null): Range | null {
    if (!range) return range;
    try {
      var s = boundaryToText(range.startContainer, range.startOffset, false);
      if (s) range.setStart(s.node, s.offset);
      var e = boundaryToText(range.endContainer, range.endOffset, true);
      if (e) range.setEnd(e.node, e.offset);
    } catch (e2) { /* noop: invalid Range — the caller handles it */ }
    return range;
  }

  /**
   * Finds the equivalent Range for a highlight record on this index.
   * Strategy: 1) saved offsets 2) exact search 3) normalized search
   * + scoring by prefix/suffix and proximity to the previous offset for disambiguation.
   * Returns: { range, start, end, method, score } or null
   */
  function findRange(ti: TextIndex | null, rec: FindRec | null): FoundRange | null {
    if (!ti || !ti.text) return null;
    const tix = ti; /* const: narrowing survives the consider() closure */
    var quote = String(rec && rec.text || '');
    if (!quote.trim()) return null;

    var best: { start: number; end: number; method: 'offsets' | 'exact' | 'norm' } | null = null;
    var bestScore = -Infinity;

    function consider(start: number, end: number, method: 'offsets' | 'exact' | 'norm', bonus?: number): void {
      var sc = bonus || 0;
      if (rec && rec.prefix) sc += endsWithNorm(tix.text.slice(Math.max(0, start - 64), start), rec.prefix) ? 2 : 0;
      if (rec && rec.suffix) sc += startsWithNorm(tix.text.slice(end, end + 64), rec.suffix) ? 2 : 0;
      if (rec && typeof rec.start === 'number') sc -= Math.min(Math.abs(start - rec.start) / 500, 1.5);
      /* +8: the occurrence the user can SEE always beats a hidden duplicate
         (max hidden score = 1+2+2-0 = 5; worst visible = 8-1.5 = 6.5) */
      var here = tix.locate(start);
      if (here && !HL.dom?.isHidden(here.node)) sc += 8;
      if (sc > bestScore) { bestScore = sc; best = { start: start, end: end, method: method }; }
    }

    // 1) Fast path: the saved offsets are still exact
    if (rec && typeof rec.start === 'number' && rec.start >= 0 && rec.start + quote.length <= tix.text.length && tix.text.substr(rec.start, quote.length) === quote) {
      consider(rec.start, rec.start + quote.length, 'offsets', 1);
    }

    // 2) Exact text search
    var idx = tix.text.indexOf(quote);
    var guard = 0;
    while (idx !== -1 && guard++ < 200) {
      consider(idx, idx + quote.length, 'exact', 0);
      idx = tix.text.indexOf(quote, idx + 1);
    }

    // 3) Normalized search (whitespace changes in the newer page version)
    if (!best || bestScore < 4) {
      var N = normInfo(tix.text);
      var q = normInfo(quote);
      if (q.norm) {
        var nPre = squash(rec && rec.prefix), nSuf = squash(rec && rec.suffix);
        var j = N.norm.indexOf(q.norm);
        var g2 = 0;
        while (j !== -1 && g2++ < 200) {
          if (j === 0 || N.norm.charAt(j - 1) === ' ') { // word boundary — full token match
            var os = N.map[j];
            var oe = N.map[j + q.norm.length - 1] + 1;
            var sc = 0;
            if (nPre) sc += endsWithNorm(tix.text.slice(Math.max(0, os - 64), os), nPre) ? 2 : 0;
            if (nSuf) sc += startsWithNorm(tix.text.slice(oe, oe + 64), nSuf) ? 2 : 0;
            if (rec && typeof rec.start === 'number') sc -= Math.min(Math.abs(os - rec.start) / 500, 1.5);
            var here = tix.locate(os); /* see-what-the-user-sees: visible copy wins (see consider) */
            if (here && !HL.dom?.isHidden(here.node)) sc += 8;
            if (sc > bestScore) { bestScore = sc; best = { start: os, end: oe, method: 'norm' }; }
          }
          j = N.norm.indexOf(q.norm, j + 1);
        }
      }
    }

    if (!best) return null;

    var a = tix.locate(best.start);
    var b = tix.locate(best.end - 1);
    if (!a || !b) return null;
    try {
      var range = document.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset + 1);
      return { range: range, start: best.start, end: best.end, method: best.method, score: bestScore };
    } catch (e) {
      return null;
    }
  }

  HL.text = {
    build: buildTextIndex,
    findRange: findRange,
    normInfo: normInfo,
    squash: squash,
    acceptTextNode: acceptTextNode,
    normalizeRange: normalizeRange,
    boundaryToText: boundaryToText
  };
})();
