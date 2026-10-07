/**
 * Weboo — content display-direction detection (SRP: the direction decision, separate from applying it)
 *
 * Two pure, DOM-free functions:
 *  - detectTextDir(s): dominant direction of a string ('ltr' | 'rtl' | '' neutral)
 *  - contentDir(title, texts): the "title + texts" combination policy for an article/page —
 *    LTR only when both signals agree and neither disagrees; conflict or neutral → RTL
 *    (the Persian UI's conservative default).
 *
 * Consumers: dashboard (dashboard-data.js → groupDir, since v1.2.6) and popup
 * (current-page card + highlight list, v1.2.7) — a single source so an
 * article's direction stays identical across all views; "applying" the
 * direction (the dir attribute) is the view layer's job (DIP).
 *
 * Phase 2 migration (TypeScript): compiled by `bun run build:ext` into
 * extension/shared/detect-dir.js — never edit the .js directly.
 */
/* ---------- Text language direction ---------- */
/**
 * "Strongly directional" letters — digits/punctuation/spaces (neutral) don't count.
 * RTL: Arabic/Persian + Hebrew letters; LTR: Latin + Greek + Cyrillic.
 */
var RTL_LETTER_RE = /[\u0590-\u05FF\u0620-\u064F\u066E-\u06D3\u0750-\u077F\u08A0-\u08FF]/g;
var LTR_LETTER_RE = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/g;
function countMatches(s, re) {
    var m = String(s || '').match(re);
    return m ? m.length : 0;
}
/**
 * Dominant direction of a string: 'ltr' | 'rtl' | '' (neutral: no directional letter, or a tie).
 * Pure function — the single source of direction for tests and grouping.
 */
function detectTextDir(s) {
    var str = String(s || '');
    var rtl = countMatches(str, RTL_LETTER_RE);
    var ltr = countMatches(str, LTR_LETTER_RE);
    if (!rtl && !ltr)
        return '';
    if (ltr > rtl)
        return 'ltr';
    if (rtl > ltr)
        return 'rtl';
    return ''; /* tie → no decision */
}
/* ---------- Direction policy for an article/page ---------- */
/* Text cap for performance: 4000 characters from the start of the items is enough. */
var TEXT_CAP = 4000;
/**
 * Combines the two signals — the title (article/page identity) and the highlight texts (actual content).
 * LTR only when both agree and neither disagrees; conflict (a Persian page with
 * English code highlights, or vice versa) → default RTL. texts is optional:
 * a fresh page with no highlights → the title signal alone decides.
 */
function contentDir(title, texts) {
    var titleDir = detectTextDir(title || '');
    var body = '';
    var list = texts || [];
    for (var i = 0; i < list.length && body.length < TEXT_CAP; i++) {
        body += ' ' + (list[i] || '');
    }
    var bodyDir = detectTextDir(body.slice(0, TEXT_CAP));
    if ((titleDir === 'ltr' && bodyDir !== 'rtl') || (bodyDir === 'ltr' && titleDir !== 'rtl'))
        return 'ltr';
    return 'rtl';
}
export const detectDir = {
    detectTextDir: detectTextDir,
    contentDir: contentDir
};
