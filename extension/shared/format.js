/**
 * Weboo — display formats (SRP: data → display-string conversion)
 *
 * Pure, DOM-free functions; consumers: the core popover (ui/popover),
 * the popup, the dashboard (via HL.dash) and tests.
 *
 * Language-awareness (v0.14.0): user-visible rendering follows the ACTIVE
 * UI language (shared/i18n.js): fa → Persian digits + Jalali calendar +
 * Persian units; en → Latin digits + Gregorian calendar + Latin units.
 * Internal values stay language-independent (timestamps are UTC epochs,
 * isoDate stays Gregorian for machine-readable metadata). faNum remains the
 * ONE home of forced Persian digits (Persian-chrome islands and legacy
 * consumers); `num` is the language-aware generalization.
 *
 * Phase 2 migration (TypeScript): this file is compiled by
 * `bun run build:ext` (tsconfig.extension.json) into
 * extension/shared/format.js — the classic script the extension loads.
 * Never edit the .js directly; edit here.
 */
import { COLORS } from "./constants.js";
import { getLanguage } from "./i18n.js";
/* ---------- Numbers and sizes ---------- */
/** Forced Persian digits — the ONE home of Persian digit rendering. */
function faNum(n) {
    try {
        return Number(n || 0).toLocaleString('fa-IR');
    }
    catch (e) {
        return String(n || 0);
    }
}
/** Language-aware digits: Persian in fa, Latin in en (decimal «٫» vs «.»). */
function num(n) {
    if (getLanguage() === 'en') {
        try {
            return Number(n || 0).toLocaleString('en-US');
        }
        catch (e) {
            return String(n || 0);
        }
    }
    return faNum(n);
}
function fmtBytes(b) {
    b = Number(b) || 0;
    var en = getLanguage() === 'en';
    try {
        if (b < 1024)
            return b.toLocaleString(en ? 'en-US' : 'fa-IR') + (en ? ' B' : ' بایت');
        if (b < 1048576)
            return (b / 1024).toLocaleString(en ? 'en-US' : 'fa-IR', { maximumFractionDigits: 1 }) + (en ? ' KB' : ' کیلوبایت');
        return (b / 1048576).toLocaleString(en ? 'en-US' : 'fa-IR', { maximumFractionDigits: 2 }) + (en ? ' MB' : ' مگابایت');
    }
    catch (e) {
        return String(b);
    }
}
/* ---------- Dates and text ---------- */
function fmtDateTime(ts) {
    try {
        const en = getLanguage() === 'en';
        return new Date(ts).toLocaleString(en ? 'en-US' : 'fa-IR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    catch (e) {
        return '';
    }
}
/** Short date (no time) — the export documents' date lines (v0.6.0).
 *  fa → Jalali calendar (fa-IR), en → Gregorian (en-US). The calendar is a
 *  PRESENTATION choice: stored timestamps and isoDate stay Gregorian.
 *  Invalid input → '' (Bun/ICU renders Invalid Dates as "Invalid Date"
 *  instead of throwing — the explicit guard keeps garbage out of exports). */
function fmtDate(ts) {
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime()))
            return '';
        return d.toLocaleDateString(getLanguage() === 'en' ? 'en-US' : 'fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    catch (e) {
        return '';
    }
}
/** ISO date (YYYY-MM-DD) — machine-readable export metadata (Markdown frontmatter, v0.6.0).
 *  Same invalid-input contract: '' (never "NaN-NaN-NaN"). */
function isoDate(ts) {
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime()))
            return '';
        const p = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    catch (e) {
        return '';
    }
}
/** Single-line whitespace normalization — exported quotes/notes must never
 *  break their own block structure (Markdown blockquote / HTML element).
 *  Same collapse semantics as excerpt(), without the length cut (v0.6.0). */
function oneLine(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}
function excerpt(s, n) {
    const str = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return str.length > n ? str.slice(0, n) + '…' : str;
}
/* ---------- Record display formats (shared by popup and dashboard) ---------- */
/** Highlight color dot for display (the color registry's dot) */
function dotColorOf(key) {
    const colors = COLORS;
    const c = colors && colors[key];
    return (c && c.dot) || (colors && colors.yellow && colors.yellow.dot) || '#f5b800';
}
/** First letter of the host for the marker tile (when there is no favicon) */
function faviconLetter(host) {
    const h = String(host || '').replace(/^www\./, '');
    const ch = (h.charAt(0) || '').toUpperCase();
    return ch || 'و';
}
/** URL without scheme for compact display */
function displayUrl(url) {
    let u = String(url || '');
    u = u.replace(/^[a-z]+:\/\//i, '');
    return u || '—';
}
/** Main site domain for compact display — just the host, without www/port/path
 *  (input may be a full URL or a raw host; a missing host like file:// → «—») */
function displayHost(url) {
    let s = String(url || '').trim();
    const m = s.match(/^[a-z][a-z0-9+.-]*:\/\//i); /* scheme? */
    let h = (m ? s.slice(m[0].length) : s).split(/[/?#]/)[0];
    if (h.charAt(0) === '[')
        return h.slice(0, h.indexOf(']') + 1) || '—'; /* IPv6 literal */
    h = h.split(':')[0].replace(/^www\./i, '');
    return h || '—';
}
export const format = {
    faNum: faNum,
    num: num,
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
