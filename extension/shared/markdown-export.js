/**
 * Weboo — Markdown document builder (v0.6.0)
 *
 * SRP: groups → ONE Markdown string. Pure, DOM-free, storage-free — takes the
 * already-grouped, already-ordered articles (groupRecords output with the
 * controller's readingOrderItems order and tag enrichment) and renders the
 * export document. Where the data comes from and how the file is delivered
 * (filename/download) are other modules' concerns (the injected store / HL.export);
 * the ordering decision is the data layer's (dash.readingOrderItems) — this
 * builder is order-agnostic and renders the items array exactly as given.
 *
 * Obsidian-first shape (the feature's primary consumer), valid everywhere:
 *   - YAML frontmatter (app/version/date/counts) → Obsidian properties panel
 *   - `##` per article, blockquote per highlight (the classic highlight idiom),
 *     bold-labeled note line, em-dash meta line (Persian date + color)
 *   - every quote/note is oneLine-collapsed (format.oneLine) so USER text
 *     can never break the document's own block structure
 *   - Persian chrome strings (summary, counts, dates) use Persian digits
 *     (format.faNum) and stay single-line — each block is directionally
 *     homogeneous, which is the best bidi contract plain Markdown offers
 *
 * Dependencies (script order): shared/constants.js, shared/format.js
 */
import { APP_NAME, VERSION, COLORS } from "./constants.js";
import { format } from "./format.js"; /* 7c-3 */
  var fmt = format;

  /* ---------- Local pure helpers ---------- */

  /** Counts an article's noted highlights (mirrors groupRecords' g.notes —
      recomputed here so hand-built groups in specs stay honest). */
  function notesOf(g) {
    return (g.items || []).filter(function (r) { return r.note; }).length;
  }

  /** Persian color label of a record ('' for unknown keys — no invented data) */
  function colorLabel(r) {
    var c = COLORS[r && r.color];
    return c ? c.label : '';
  }

  /** «۳ هایلایت · ۱ یادداشت» — the per-article counts segment (notes omitted
      when zero — an article without notes doesn't mention them). */
  function countsLine(g) {
    var parts = [fmt.faNum((g.items || []).length) + ' هایلایت'];
    var n = notesOf(g);
    if (n) parts.push(fmt.faNum(n) + ' یادداشت');
    return parts.join(' · ');
  }

  /** The article's heading text — title, falling back to the host (the same
      identity fallback the dashboard card gives) and finally the key. */
  function titleOf(g) {
    return fmt.oneLine(g.title || g.host || g.key || 'بدون عنوان') || 'بدون عنوان';
  }

  /** `[منبع](url)` — only for http(s)/file URLs (a `javascript:`-style record
      URL must never become a live link in the exported document). */
  function sourceLink(g) {
    var u = String(g.url || '');
    if (!/^(https?|file):/i.test(u)) return '';
    return '[منبع](' + u + ')';
  }

  /** `برچسب‌ها: \`a\` · \`b\`` — inline-code tags (visible everywhere, no
      side effects); '' when the article carries no tags. */
  function tagsLine(g) {
    var tags = (g.tags || []).filter(function (t) { return fmt.oneLine(t); });
    if (!tags.length) return '';
    return 'برچسب‌ها: ' + tags.map(function (t) { return '`' + fmt.oneLine(t) + '`'; }).join(' · ');
  }

  /** The meta line under a highlight — «date · color» (color label dropped for
      unknown keys; the line itself dropped only when the date failed too). */
  function metaLine(r) {
    var segs = [];
    var d = fmt.fmtDate(r.createdAt || r.updatedAt);
    if (d) segs.push(d);
    var c = colorLabel(r);
    if (c) segs.push(c);
    return segs.length ? '— ' + segs.join(' · ') : '';
  }

  /** One highlight → its markdown blocks (quote / note / meta), '---'-safe:
      every line is blank-line separated so user text can never glue blocks. */
  function highlightBlocks(r) {
    var out = [];
    var quote = fmt.oneLine(r.text);
    if (quote) out.push('> ' + quote);
    var note = fmt.oneLine(r.note);
    if (note) out.push('**یادداشت:** ' + note);
    var meta = metaLine(r);
    if (meta) out.push(meta);
    return out;
  }

  /** One article → its markdown section (heading, source/counts/tags lines,
      the highlights in the given order, no trailing separator). */
  function articleSection(g) {
    var lines = ['## ' + titleOf(g)];
    var head = [sourceLink(g), countsLine(g)].filter(Boolean).join(' · ');
    if (head) lines.push(head);
    var tags = tagsLine(g);
    if (tags) lines.push(tags);
    (g.items || []).forEach(function (r) {
      highlightBlocks(r).forEach(function (b) {
        lines.push('');
        lines.push(b);
      });
    });
    return lines.join('\n');
  }

  /* ---------- Document ---------- */

  /**
   * Builds the whole Markdown library document.
   * ctx: { groups: Group[], exportedAt: number }
   * Group = groupRecords output ({ key, host, title, url, items, dir, … }),
   * optionally carrying `tags` ([string]) — exactly what the controller passes.
   * The articles render in the GIVEN array order (the controller's newest-first
   * library order); each article's items render in the given order (reading
   * order — dash.readingOrderItems applied by the caller).
   * Pure: never mutates the input, never touches Date inside (exportedAt is
   * injected — deterministic and testable).
   */
  function buildLibraryMarkdown(ctx) {
    var groups = (ctx && ctx.groups) || [];
    var exportedAt = (ctx && ctx.exportedAt) || 0;

    var total = 0;
    groups.forEach(function (g) { total += (g.items || []).length; });

    var out = [];
    out.push('---');
    out.push('app: "' + APP_NAME + '"');
    out.push('version: "' + VERSION + '"');
    if (exportedAt) out.push('exported_at: "' + fmt.isoDate(exportedAt) + '"');
    out.push('highlights: ' + total);
    out.push('articles: ' + groups.length);
    out.push('---');
    out.push('');
    out.push('# کتابچه هایلایت‌های من');
    out.push('');
    var summary = 'خروجی از «' + APP_NAME + '» — ' + fmt.faNum(total) + ' هایلایت از ' +
      fmt.faNum(groups.length) + ' مقاله';
    if (exportedAt) summary += ' · ' + fmt.fmtDate(exportedAt);
    out.push('> ' + summary);

    if (!groups.length) {
      out.push('');
      out.push('> هنوز هایلایتی ثبت نشده است.');
      return out.join('\n') + '\n';
    }

    groups.forEach(function (g) {
      out.push('');
      out.push('---');
      out.push('');
      out.push(articleSection(g));
    });
    return out.join('\n') + '\n';
  }

  export const markdown = {
    buildLibraryMarkdown: buildLibraryMarkdown
  };

