/**
 * Web Highlighter — print booklet builder (v0.6.0)
 *
 * SRP: groups → ONE self-contained HTML document string. Pure, DOM-free,
 * storage-free — takes the already-grouped, already-ordered articles
 * (groupRecords output + the controller's readingOrderItems order and tag
 * enrichment) and renders a designed, print-ready booklet:
 *
 *   - cover page (brand mark, title, stats, date, table of contents)
 *   - one article per printed page (break-before), direction-SMART:
 *     each <section class="article"> carries the SAME direction decision the
 *     dashboard card uses (g.dir — the shared contentDir policy), each quote
 *     and note carries dir="auto" (its own first-strong-letter context, the
 *     v1.2.12/v1.2.13 per-text rule), and the document's Persian chrome
 *     (cover, meta lines, footer) is always hard dir="rtl" (the v0.5.2 rule)
 *   - a highlight block never splits across pages (break-inside: avoid),
 *     its color shown as the quote's start bar + soft tint in color mode
 *   - TWO palettes: mode-color (the extension's 5-color identity) and
 *     mode-bw (grayscale, ink-saving) — one stylesheet, switched by a body
 *     class over CSS custom properties (OCP: a new mode is one class + one
 *     var set, no builder branching beyond the class itself)
 *   - zero scripts, zero external resources → prints identically anywhere,
 *     CSP-safe in every context
 *
 * Delivery (filename/download/print) is HL.export's concern; ordering is the
 * data layer's (dash.readingOrderItems). XSS-safety: EVERY user/web string is
 * escaped (esc) and record URLs become links only for http(s)/file schemes.
 *
 * Dependencies (script order): shared/constants.js, shared/format.js
 */
import { APP_NAME, VERSION, COLORS } from "./constants.js";
import { format } from "./format.js"; /* 7c-3 */
(function () {
  'use strict';
  var HL = (globalThis.HL = globalThis.HL || {});
  var fmt = format;

  /* ---------- Local pure helpers ---------- */

  /** HTML-escape — every user/web string passes through here (textContent's
      string-building equivalent: the dashboard's XSS contract, kept). */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** #rrggbb → rgba(r,g,b,a) — the quote tint under the color bar (color mode).
      '' for malformed hex (the quote then keeps its default background). */
  function hexToRgba(hex, a) {
    var h = String(hex || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return '';
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function notesOf(g) {
    return (g.items || []).filter(function (r) { return r.note; }).length;
  }

  function titleOf(g) {
    return fmt.oneLine(g.title || g.host || g.key || 'بدون عنوان') || 'بدون عنوان';
  }

  function colorLabel(r) {
    var c = COLORS[r && r.color];
    return c ? c.label : '';
  }

  /** The article's display host — format.displayHost over url, host as fallback */
  function hostOf(g) {
    var h = fmt.displayHost(g.url || g.host || '');
    return h === '—' ? '' : h;
  }

  /** http(s)/file URLs only — anything else (javascript:, data:, …) renders
      as inert text: an exported document must never grow a live odd-scheme link. */
  function safeUrl(g) {
    var u = String(g.url || '');
    return /^(https?|file):/i.test(u) ? u : '';
  }

  /** «۳ هایلایت · ۱ یادداشت» — the counts segment (notes omitted at zero) */
  function countsSeg(g) {
    var parts = [fmt.faNum((g.items || []).length) + ' هایلایت'];
    var n = notesOf(g);
    if (n) parts.push(fmt.faNum(n) + ' یادداشت');
    return parts.join(' · ');
  }

  /* ---------- Inline style / attrs per element ---------- */

  /** Per-highlight inline palette — color mode paints the bar + tint from the
      color registry; bw mode injects NOTHING (CSS defaults carry the design). */
  function quoteStyle(r, mode) {
    if (mode !== 'color') return '';
    var dot = fmt.dotColorOf(r && r.color);
    var bg = hexToRgba(dot, 0.1);
    return ' style="--bar:' + dot + (bg ? ';--hl-bg:' + bg : '') + '"';
  }

  /** The meta line — «date · color» in color mode, just the date in bw
      (the palette isn't visible there — showing a color name would be noise). */
  function metaText(r, mode) {
    var segs = [];
    var d = fmt.fmtDate(r.createdAt || r.updatedAt);
    if (d) segs.push(d);
    if (mode === 'color') {
      var c = colorLabel(r);
      if (c) segs.push(c);
    }
    return segs.join(' · ');
  }

  /* ---------- The stylesheet (one document, both modes) ---------- */

  var CSS = [
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    'html { -webkit-text-size-adjust: 100%; }',
    'body { font-family: "Vazirmatn", "Segoe UI", Tahoma, "Helvetica Neue", system-ui, sans-serif;',
    '  line-height: 1.95; color: var(--ink); background: var(--scr-bg); }',
    '/* MODES — one class + one var set each (OCP) */',
    'body.mode-color { --ink: #2a2313; --muted: #83775a; --accent: #9a6d00; --paper: #fffdf6;',
    '  --paper2: #f7f1e0; --line: #e6dcbf; --scr-bg: #efe9db; }',
    'body.mode-bw { --ink: #1b1b1b; --muted: #5c5c5c; --accent: #1b1b1b; --paper: #ffffff;',
    '  --paper2: #f4f4f4; --line: #cfcfcf; --scr-bg: #e9e9e9; }',
    '',
    '/* ---- Screen: a centered "paper" sheet; print: the page IS the paper ---- */',
    '.sheet { max-width: 186mm; margin: 28px auto; background: var(--paper);',
    '  padding: 16mm 15mm; border-radius: 6px; box-shadow: 0 24px 70px rgba(56, 42, 0, .16); }',
    '',
    '/* ---- Cover ---- */',
    '.cover { min-height: 240mm; display: flex; flex-direction: column; }',
    '.cover-brand { display: flex; align-items: center; gap: 10px; }',
    '.mark { display: inline-block; width: 46px; height: 10px; border-radius: 99px; }',
    'body.mode-color .mark { background: linear-gradient(90deg,',
    '  #f5b800 0 20%, #58b85c 20% 40%, #35b3ae 40% 60%, #e5679b 60% 80%, #a478e8 80% 100%); }',
    'body.mode-bw .mark { background: #444; }',
    '.cover-brand-txt { font-size: 13px; font-weight: 700; color: var(--muted); letter-spacing: .2px; }',
    '.cover-main { margin: auto 0; text-align: center; }',
    '.cover-title { font-size: 34px; font-weight: 800; line-height: 1.55; }',
    '.cover-sub { margin-top: 10px; font-size: 15px; color: var(--muted); }',
    '.cover-stats { margin-top: 26px; font-size: 15px; font-weight: 700; }',
    '.cover-date { margin-top: 8px; font-size: 13px; color: var(--muted); }',
    '.cover-toc { margin-top: auto; }',
    '.toc-title { font-size: 15px; font-weight: 800; margin-bottom: 8px; }',
    '.toc-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; }',
    '.toc-n { min-width: 1.7em; font-size: 12px; color: var(--muted); }',
    '.toc-t { font-weight: 600; font-size: 13.5px; }',
    '.toc-fill { flex: 1; border-bottom: 1px dotted var(--muted); opacity: .55; }',
    '.toc-count { font-size: 12px; color: var(--muted); white-space: nowrap; }',
    '.cover-foot { margin-top: 18px; text-align: center; font-size: 11px; color: var(--muted); }',
    '',
    '/* ---- Article ---- */',
    '.article { counter-increment: article; }',
    '.art-head { border-bottom: 2.5px solid var(--accent); padding-bottom: 10px; margin-bottom: 16px; }',
    '.art-title { font-size: 21px; font-weight: 800; line-height: 1.65; }',
    '.art-title::before { content: counter(article) ". "; color: var(--muted); font-size: .78em; font-weight: 700; }',
    '.art-meta { margin-top: 5px; font-size: 12px; color: var(--muted); }',
    '.art-link { color: var(--muted); text-decoration: none; border-bottom: 1px dotted var(--muted); }',
    '.art-sep { opacity: .6; }',
    '.tag { display: inline-block; border: 1px solid var(--line); border-radius: 999px;',
    '  padding: 0 10px; margin: 0 2px; font-size: 11px; color: var(--muted); background: var(--paper2); }',
    '',
    '/* ---- Highlight blocks ---- */',
    '.hl { margin: 0 0 15px; }',
    '.hl-quote { padding: 10px 15px; font-size: 14.5px; line-height: 2.05;',
    '  border-inline-start: 4px solid var(--bar, #9a9a9a); background: var(--hl-bg, transparent);',
    '  border-start-start-radius: 8px; border-end-start-radius: 8px; }',
    '.hl-note { margin-top: 7px; padding: 8px 13px; font-size: 13px; line-height: 1.95;',
    '  border: 1px dashed var(--line); border-inline-start: 3px solid var(--accent);',
    '  background: var(--paper2); border-start-start-radius: 6px; border-end-start-radius: 6px; }',
    'body.mode-color .hl-note { border-style: solid; }',
    '.hl-note-lbl { font-weight: 800; }',
    '.hl-meta { margin-top: 5px; font-size: 11px; color: var(--muted); }',
    '',
    '/* ---- Document footer ---- */',
    '.foot { margin-top: 13mm; padding-top: 6px; border-top: 1px solid var(--line);',
    '  text-align: center; font-size: 10.5px; color: var(--muted); }',
    '.doc-empty { margin-top: 24mm; text-align: center; color: var(--muted); font-size: 15px; }',
    '',
    '/* ---- Print: A4, one article per page, blocks never split ---- */',
    '@media print {',
    '  @page { size: A4; margin: 15mm 14mm; }',
    '  body { background: #fff; }',
    '  .sheet { max-width: none; margin: 0; padding: 0; border-radius: 0; box-shadow: none; }',
    '  .cover { min-height: 250mm; }',
    '  .article { break-before: page; }',
    '  .hl, .art-head { break-inside: avoid; }',
    '  .art-head { break-after: avoid; }',
    '  p, blockquote { orphans: 2; widows: 2; }',
    '  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    '}',
    '',
    '/* ---- Small screens: the sheet becomes the page ---- */',
    '@media (max-width: 640px) {',
    '  .sheet { margin: 0; border-radius: 0; padding: 20px 16px; box-shadow: none; }',
    '  .cover { min-height: auto; }',
    '  .cover-main { margin: 40px 0; }',
    '}'
  ].join('\n');

  /* ---------- Section builders (all strings, all escaped) ---------- */

  function coverSection(stats, exportedAt, toc) {
    var segs = [fmt.faNum(stats.total) + ' هایلایت · ' + fmt.faNum(stats.articles) + ' مقاله'];
    if (stats.notes) segs.push(fmt.faNum(stats.notes) + ' یادداشت');
    var lines = [];
    lines.push('<section class="cover" dir="rtl" aria-label="جلد کتابچه">');
    lines.push('  <div class="cover-brand"><span class="mark" aria-hidden="true"></span><span class="cover-brand-txt">' + esc(APP_NAME) + '</span></div>');
    lines.push('  <div class="cover-main">');
    lines.push('    <h1 class="cover-title">کتابچه هایلایت‌ها</h1>');
    lines.push('    <p class="cover-sub">مجموعه‌ی کامل هایلایت‌ها و یادداشت‌ها</p>');
    lines.push('    <p class="cover-stats">' + esc(segs.join(' · ')) + '</p>');
    if (exportedAt) lines.push('    <p class="cover-date">' + esc(fmt.fmtDate(exportedAt)) + '</p>');
    lines.push('  </div>');
    if (toc) {
      lines.push('  <div class="cover-toc">');
      lines.push('    <h2 class="toc-title">فهرست مقالات</h2>');
      toc.forEach(function (row) {
        lines.push('    <div class="toc-row"><span class="toc-n">' + esc(row.n) + '</span><span class="toc-t">' + esc(row.title) + '</span><span class="toc-fill"></span><span class="toc-count">' + esc(row.count) + '</span></div>');
      });
      lines.push('  </div>');
    }
    lines.push('  <p class="cover-foot">ساخته‌شده با «' + esc(APP_NAME) + '» · نسخه ' + esc(VERSION) + '</p>');
    lines.push('</section>');
    return lines.join('\n');
  }

  function articleSection(g, mode) {
    var t = titleOf(g);
    var dir = g.dir === 'ltr' ? 'ltr' : 'rtl';
    var host = hostOf(g);
    var url = safeUrl(g);
    var tags = (g.tags || []).filter(function (x) { return fmt.oneLine(x); }).slice(0, 8);

    var lines = [];
    lines.push('<section class="article" dir="' + dir + '" aria-label="' + esc(t) + '">');
    lines.push('  <header class="art-head">');
    lines.push('    <h2 class="art-title">' + esc(t) + '</h2>');
    lines.push('    <p class="art-meta" dir="rtl">');
    if (url) lines.push('      <a class="art-link" href="' + esc(url) + '"><span dir="ltr">' + esc(host || url) + '</span></a>');
    else if (host) lines.push('      <span dir="ltr">' + esc(host) + '</span>');
    if (host || url) lines.push('      <span class="art-sep" aria-hidden="true"> · </span>');
    lines.push('      ' + esc(countsSeg(g)));
    if (tags.length) {
      lines.push('      <span class="art-sep" aria-hidden="true"> · </span>');
      lines.push('      <span class="art-tags">' + tags.map(function (x) {
        return '<span class="tag">' + esc(fmt.oneLine(x)) + '</span>';
      }).join(' ') + '</span>');
    }
    lines.push('    </p>');
    lines.push('  </header>');

    (g.items || []).forEach(function (r) {
      var quote = fmt.oneLine(r.text);
      var note = fmt.oneLine(r.note);
      var meta = metaText(r, mode);
      if (!quote && !note) return; /* a record with neither renders nothing */
      lines.push('  <div class="hl">');
      if (quote) lines.push('    <blockquote class="hl-quote" dir="auto"' + quoteStyle(r, mode) + '>' + esc(quote) + '</blockquote>');
      if (note) lines.push('    <div class="hl-note" dir="auto"><strong class="hl-note-lbl">یادداشت:</strong> ' + esc(note) + '</div>');
      if (meta) lines.push('    <p class="hl-meta" dir="rtl">' + esc(meta) + '</p>');
      lines.push('  </div>');
    });
    lines.push('</section>');
    return lines.join('\n');
  }

  /* ---------- Document ---------- */

  /**
   * Builds the whole booklet HTML document.
   * ctx: { groups: Group[], mode: 'color'|'bw', exportedAt: number }
   * Group = groupRecords output ({ key, host, title, url, items, dir, … }),
   * optionally carrying `tags` ([string]). mode defaults to 'color'.
   * Articles render in the GIVEN array order (the library's newest-first),
   * each article's items in the GIVEN order (reading order — the caller's
   * dash.readingOrderItems). The TOC is included from 2 articles up (a
   * single-article booklet doesn't need a directory — over-application guard,
   * the same rule the card's order pill follows).
   * Pure: never mutates the input, never reads the clock (exportedAt injected).
   */
  function buildBookletHtml(ctx) {
    var groups = (ctx && ctx.groups) || [];
    var mode = (ctx && ctx.mode) === 'bw' ? 'bw' : 'color';
    var exportedAt = (ctx && ctx.exportedAt) || 0;

    var stats = { total: 0, articles: groups.length, notes: 0 };
    groups.forEach(function (g) {
      stats.total += (g.items || []).length;
      stats.notes += notesOf(g);
    });

    var toc = null;
    if (groups.length > 1) {
      toc = groups.map(function (g, i) {
        return { n: fmt.faNum(i + 1) + '.', title: titleOf(g), count: fmt.faNum((g.items || []).length) + ' هایلایت' };
      });
    }

    var body = [];
    body.push(coverSection(stats, exportedAt, toc));
    if (!groups.length) {
      body.push('<p class="doc-empty" dir="rtl">هنوز هایلایتی ثبت نشده است.</p>');
    } else {
      groups.forEach(function (g) { body.push(articleSection(g, mode)); });
    }
    body.push('<footer class="foot" dir="rtl">ساخته‌شده با «' + esc(APP_NAME) + '» — همه‌ی داده‌ها فقط روی دستگاه شما ذخیره می‌شوند.</footer>');

    return [
      '<!DOCTYPE html>',
      '<html lang="fa" dir="rtl">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="color-scheme" content="light">', /* the booklet is a paper document — always light, print-first */
      '<title>کتابچه هایلایت‌ها — ' + esc(APP_NAME) + '</title>',
      '<style>',
      CSS,
      '</style>',
      '</head>',
      '<body class="mode-' + mode + '">',
      '<div class="sheet">',
      body.join('\n'),
      '</div>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  HL.booklet = {
    buildBookletHtml: buildBookletHtml
  };
})();

/* identity export (7c-3) */
export const booklet = globalThis.HL.booklet;
