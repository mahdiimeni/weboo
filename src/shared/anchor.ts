/**
 * Web Highlighter — anchor resolution (Phase 3 extraction).
 *
 * Single place that answers: "where does this saved highlight live NOW?"
 * Resolution order (v0.6.7 behavior — audited from highlighter.applyRecord +
 * textindex.findRange before the move, preserved field-for-field):
 *
 *   1. structural — XPath serialize/resolve (HL.dom.resolveAnchor); a hit that
 *      lands in a hidden duplicate copy is rejected (isHidden) → fallback.
 *   2. textual    — candidate SOURCES scored by ONE scorer, best wins:
 *      offsets → exact (indexOf, guard 200) → normalized (word-boundary only;
 *      runs only while the best score < 4 — an exact hit with context
 *      confidence makes the norm scan pointless).
 *
 * Scoring (the disambiguation contract for duplicate text — do not
 * "simplify"): bonus + prefix(+2) + suffix(+2) − offset-proximity(≤1.5)
 * + visible-copy(+8: the occurrence the user can SEE beats a hidden one).
 *
 * OCP: strategies are DATA — HL.anchor.resolvers is an ordered list read at
 * call time; a new resolver (fuzzy, sentence-level, …) is appended without
 * touching orchestration (see anchor.test's OCP test).
 *
 * Phase 2/3 pipeline: compiled by `bun run build:ext` into
 * extension/shared/anchor.js — classic script, zero imports (see the
 * invariant note in src/shared/textindex.ts).
 */
(function () {
  'use strict';

  /* ---------- Local structural views (script-mode: no imports) ---------- */

  /** Focused view of a highlight record as resolution consumes it (ISP —
   *  the full model lives in src/types/highlight.ts HighlightRecord). */
  interface FindRec { text?: string; prefix?: string; suffix?: string; start?: number; end?: number }
  interface LocatedNode { node: Text; offset: number }
  interface TextIndexView {
    text: string;
    locate(index: number): LocatedNode | null;
  }
  interface Candidate { start: number; end: number; method: 'offsets' | 'exact' | 'norm'; bonus?: number }
  interface SourceContext { ti: TextIndexView; rec: FindRec; quote: string }
  interface ResolverSource {
    name: string;
    /** Perf gate: the source is skipped once the running best score reaches
     *  this value (undefined = always run). The norm scan declares 4. */
    maxBestBefore?: number;
    collect(ctx: SourceContext): Candidate[];
  }
  interface FoundRange {
    range: Range;
    start: number;
    end: number;
    method: 'offsets' | 'exact' | 'norm';
    score: number;
  }
  interface AnchorApi {
    resolvers: ResolverSource[]; /* same array identity resolve() iterates */
    resolveStructural(rec: FindRec & { anchor?: unknown }): Range | null;
    resolve(ti: TextIndexView | null, rec: FindRec): FoundRange | null;
  }
  interface HlSlice {
    dom: {
      resolveAnchor(anchor: unknown, expectText?: unknown): Range | null;
      isHidden(el: Node): boolean;
    };
    text: {
      normInfo(s: string): { norm: string; map: number[] };
      squash(s: unknown): string;
    };
    anchor?: AnchorApi;
  }

  const g = globalThis as unknown as { HL?: HlSlice };
  /* domwrap + textindex load before this file (manifest order, packaging-tested);
     the empty fallback is a formality they fill */
  const HL = (g.HL = g.HL || ({} as HlSlice)) as HlSlice;

  /* ---------- text comparison (moved with the scoring that owns it) ---------- */

  function squash(s: unknown): string { return String(s == null ? '' : s).replace(/[\s\u00a0\u200b]+/g, ' ').trim(); }
  function endsWithNorm(a: unknown, b: unknown): boolean { return squash(a).endsWith(squash(b)); }
  function startsWithNorm(a: unknown, b: unknown): boolean { return squash(a).startsWith(squash(b)); }

  /* ---------- ONE scorer for every candidate ---------- */

  function scoreOf(cand: Candidate, ctx: SourceContext): number {
    var ti = ctx.ti, rec = ctx.rec;
    var sc = cand.bonus || 0;
    if (rec.prefix) sc += endsWithNorm(ti.text.slice(Math.max(0, cand.start - 64), cand.start), rec.prefix) ? 2 : 0;
    if (rec.suffix) sc += startsWithNorm(ti.text.slice(cand.end, cand.end + 64), rec.suffix) ? 2 : 0;
    if (typeof rec.start === 'number') sc -= Math.min(Math.abs(cand.start - rec.start) / 500, 1.5);
    /* +8: the occurrence the user can SEE always beats a hidden duplicate
       (max hidden score = 1+2+2−0 = 5; worst visible = 8−1.5 = 6.5) */
    var here = ti.locate(cand.start);
    if (here && !HL.dom?.isHidden(here.node)) sc += 8;
    return sc;
  }

  /* ---------- Candidate sources (ordered — new strategies append here) ---------- */

  var resolvers: ResolverSource[] = [];

  var offsetsSource: ResolverSource = {
    name: 'offsets',
    collect: function (ctx) {
      var rec = ctx.rec, ti = ctx.ti, quote = ctx.quote;
      if (typeof rec.start !== 'number' || rec.start < 0) return [];
      if (rec.start + quote.length > ti.text.length) return [];
      if (ti.text.substr(rec.start, quote.length) !== quote) return [];
      return [{ start: rec.start, end: rec.start + quote.length, method: 'offsets', bonus: 1 }];
    }
  };

  var exactSource: ResolverSource = {
    name: 'exact',
    collect: function (ctx) {
      var out: Candidate[] = [];
      var idx = ctx.ti.text.indexOf(ctx.quote);
      var guard = 0;
      while (idx !== -1 && guard++ < 200) {
        out.push({ start: idx, end: idx + ctx.quote.length, method: 'exact' });
        idx = ctx.ti.text.indexOf(ctx.quote, idx + 1);
      }
      return out;
    }
  };

  var normSource: ResolverSource = {
    name: 'norm',
    maxBestBefore: 4, /* skip when an exact hit already has context confidence */
    collect: function (ctx) {
      var out: Candidate[] = [];
      var ti = ctx.ti, rec = ctx.rec;
      var N = HL.text.normInfo(ti.text);
      var q = HL.text.normInfo(ctx.quote);
      if (!q.norm) return out;
      var j = N.norm.indexOf(q.norm);
      var g2 = 0;
      while (j !== -1 && g2++ < 200) {
        if (j === 0 || N.norm.charAt(j - 1) === ' ') { /* word boundary — full token match */
          out.push({ start: N.map[j], end: N.map[j + q.norm.length - 1] + 1, method: 'norm' });
        }
        j = N.norm.indexOf(q.norm, j + 1);
      }
      return out;
    }
  };

  /* ---------- The two top-level strategies ---------- */

  /** 1) Structural: XPath round-trip; hidden duplicate copies are rejected. */
  function resolveStructural(rec: FindRec & { anchor?: unknown }): Range | null {
    var range = HL.dom.resolveAnchor(rec.anchor, rec.text);
    if (range && HL.dom.isHidden(range.commonAncestorContainer)) range = null;
    return range;
  }

  /** 2) Textual composite: every source contributes candidates; one scorer
   *  picks the best (strict > — first wins ties, order-stable). */
  function resolve(ti: TextIndexView | null, rec: FindRec): FoundRange | null {
    if (!ti || !ti.text) return null;
    var quote = String(rec && rec.text || '');
    if (!quote.trim()) return null;

    var ctx: SourceContext = { ti: ti, rec: rec, quote: quote };
    var best: Candidate | null = null;
    var bestScore = -Infinity;
    for (var i = 0; i < resolvers.length; i++) {
      var src = resolvers[i];
      if (src.maxBestBefore !== undefined && best && bestScore >= src.maxBestBefore) continue;
      var cands = src.collect(ctx);
      for (var j = 0; j < cands.length; j++) {
        var sc = scoreOf(cands[j], ctx);
        if (sc > bestScore) { bestScore = sc; best = cands[j]; }
      }
    }
    if (!best) return null;

    var a = ti.locate(best.start);
    var b = ti.locate(best.end - 1);
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

  resolvers.push(offsetsSource, exactSource, normSource);

  HL.anchor = {
    resolvers: resolvers,
    resolveStructural: resolveStructural,
    resolve: resolve
  };
})();
