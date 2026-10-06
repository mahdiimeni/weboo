/**
 * Web Highlighter — anchor resolution (Phase 3 extraction).
 *
 * Single place that answers: "where does this saved highlight live NOW?"
 * Resolution order (v0.6.7 behavior — audited from highlighter.applyRecord +
 * textindex.findRange before the move, preserved field-for-field):
 *
 *   1. structural — XPath serialize/resolve (dom.resolveAnchor); a hit that
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
 * Confidence policy (hardening phase — derived from the scoring, not
 * invented): MIN_CONFIDENCE sits between the scorer's own documented
 * boundaries — hidden candidates max out at 5, visible ones start at 6.5
 * ("worst visible = 8−1.5"). A best below the floor is a HIDDEN (or
 * otherwise unseeable) guess: the resolver orphans it instead of returning
 * a range the applied invariant would reject after wrapping DOM. Everything
 * at or above the floor keeps today's behavior — including re-acquiring a
 * highlight onto a duplicate copy that BECAME visible (the twin-retarget
 * contract: the visibility signal alone is legitimate evidence).
 *
 * NO fuzzy matching, deliberately: every source matches the exact quote
 * (offsets verify the saved position, exact/norm match the full string);
 * fuzzy would raise false-positive risk on adversarial pages and contradict
 * "a false positive is worse than an orphan". Revisit only with a real
 * user-visible failure this design cannot express.
 *
 * OCP: strategies are DATA — HL.anchor.resolvers is an ordered list read at
 * call time; a new resolver (fuzzy, sentence-level, …) is appended without
 * touching orchestration (see anchor.test's OCP test).
 *
 * Phase 2/3 pipeline: compiled by `bun run build:ext` into
 * extension/shared/anchor.js — Phase 7b: converted ES module (tail export,
 * identity-exported HL.anchor; loaders/status per src/shared/textindex.ts).
 */
/* Phase 7b-2: explicit dependency — the norm-scorer above the IIFE comes from
   the text-index module itself (same instance the rest of the page sees). */
import { text } from "./textindex.js";
import { dom } from "./domwrap.js"; /* Phase 7b-3: the DOM engine (resolveAnchor/isHidden) */

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

  /* ---------- text comparison (moved with the scoring that owns it) ---------- */

  function squash(s: unknown): string { return String(s == null ? '' : s).replace(/[\s\u00a0\u200b]+/g, ' ').trim(); }
  function endsWithNorm(a: unknown, b: unknown): boolean { return squash(a).endsWith(squash(b)); }
  function startsWithNorm(a: unknown, b: unknown): boolean { return squash(a).startsWith(squash(b)); }

  /* ---------- ONE scorer for every candidate ---------- */
/* Derived floor: hidden candidates max out at 5 (1+2+2−0), visible start at
   6.5 (8−1.5) — anything below 5.5 cannot be the occurrence the user saw. */
var MIN_CONFIDENCE = 5.5;

  function scoreOf(cand: Candidate, ctx: SourceContext): number {
    var ti = ctx.ti, rec = ctx.rec;
    var sc = cand.bonus || 0;
    if (rec.prefix) sc += endsWithNorm(ti.text.slice(Math.max(0, cand.start - 64), cand.start), rec.prefix) ? 2 : 0;
    if (rec.suffix) sc += startsWithNorm(ti.text.slice(cand.end, cand.end + 64), rec.suffix) ? 2 : 0;
    if (typeof rec.start === 'number') sc -= Math.min(Math.abs(cand.start - rec.start) / 500, 1.5);
    /* +8: the occurrence the user can SEE always beats a hidden duplicate
       (max hidden score = 1+2+2−0 = 5; worst visible = 8−1.5 = 6.5) */
    var here = ti.locate(cand.start);
    if (here && !dom.isHidden(here.node)) sc += 8;
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
      var N = text.normInfo(ti.text);
      var q = text.normInfo(ctx.quote);
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
    var range = dom.resolveAnchor(rec.anchor, rec.text);
    if (range && dom.isHidden(range.commonAncestorContainer)) range = null;
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
    /* confidence policy: below the floor = a hidden/unseeable guess → orphan */
    if (!best || bestScore < MIN_CONFIDENCE) return null;

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

  export const anchor: AnchorApi = {
    resolvers: resolvers,
    resolveStructural: resolveStructural,
    resolve: resolve
  };

