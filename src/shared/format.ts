/**
 * Web Highlighter — display formats (SRP: data → display-string conversion)
 *
 * Pure, DOM-free functions; consumers: the core popover (ui/popover),
 * the popup, the dashboard (via HL.dash) and tests.
 *
 * Phase 2 migration (TypeScript): this file is compiled by
 * `bun run build:ext` (tsconfig.extension.json) into
 * extension/shared/format.js — the classic script the extension loads.
 * Never edit the .js directly; edit here.
 */
import { COLORS } from "./constants.js";




  /* ---------- Numbers and sizes ---------- */

  function faNum(n?: number | string | null) {
    try { return Number(n || 0).toLocaleString('fa-IR'); }
    catch (e) { return String(n || 0); }
  }

  function fmtBytes(b?: number | string | null) {
    b = Number(b) || 0;
    try {
      if (b < 1024) return b.toLocaleString('fa-IR') + ' بایت';
      if (b < 1048576) return (b / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + ' کیلوبایت';
      return (b / 1048576).toLocaleString('fa-IR', { maximumFractionDigits: 2 }) + ' مگابایت';
    } catch (e) { return String(b); }
  }

  /* ---------- Dates and text ---------- */

  function fmtDateTime(ts: number) {
    try {
      return new Date(ts).toLocaleString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  /** Persian short date (no time) — the export documents' date lines (v0.6.0).
   *  Invalid input → '' (Bun/ICU renders Invalid Dates as "Invalid Date"
   *  instead of throwing — the explicit guard keeps garbage out of exports). */
  function fmtDate(ts: number) {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  /** ISO date (YYYY-MM-DD) — machine-readable export metadata (Markdown frontmatter, v0.6.0).
   *  Same invalid-input contract: '' (never "NaN-NaN-NaN"). */
  function isoDate(ts: number) {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      const p = function (n: number) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    } catch (e) { return ''; }
  }

  /** Single-line whitespace normalization — exported quotes/notes must never
   *  break their own block structure (Markdown blockquote / HTML element).
   *  Same collapse semantics as excerpt(), without the length cut (v0.6.0). */
  function oneLine(s: unknown) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function excerpt(s: unknown, n: number) {
    const str = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  /* ---------- Record display formats (shared by popup and dashboard) ---------- */

  /** Highlight color dot for display (the color registry's dot) */
  function dotColorOf(key: string) {
    const colors = COLORS;
    const c = colors && colors[key];
    return (c && c.dot) || (colors && colors.yellow && colors.yellow.dot) || '#f5b800';
  }

  /** First letter of the host for the marker tile (when there is no favicon) */
  function faviconLetter(host?: string | null) {
    const h = String(host || '').replace(/^www\./, '');
    const ch = (h.charAt(0) || '').toUpperCase();
    return ch || 'و';
  }

  /** URL without scheme for compact display */
  function displayUrl(url?: string | null) {
    let u = String(url || '');
    u = u.replace(/^[a-z]+:\/\//i, '');
    return u || '—';
  }

  /** Main site domain for compact display — just the host, without www/port/path
   *  (input may be a full URL or a raw host; a missing host like file:// → «—») */
  function displayHost(url?: string | null) {
    let s = String(url || '').trim();
    const m = s.match(/^[a-z][a-z0-9+.-]*:\/\//i); /* scheme? */
    let h = (m ? s.slice(m[0].length) : s).split(/[/?#]/)[0];
    if (h.charAt(0) === '[') return h.slice(0, h.indexOf(']') + 1) || '—'; /* IPv6 literal */
    h = h.split(':')[0].replace(/^www\./i, '');
    return h || '—';
  }

  export const format = {
    faNum: faNum,
    fmtBytes: fmtBytes,
    fmtDateTime: fmtDateTime,
    fmtDate: fmtDate,
    isoDate: isoDate,
    excerpt: excerpt,
    oneLine: oneLine,
    dotColorOf: dotColorOf,
    faviconLetter: faviconLetter,
    displayUrl: displayUrl,
    displayHost: displayHost
  };

