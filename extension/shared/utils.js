/**
 * Web Highlighter — general utilities core (SRP: shared stateless primitives)
 *
 * After the v1.1.1 split, only "low-level helpers shared by all modules"
 * remain here; specialized concerns moved to their own modules:
 *   - URL normalization    → shared/url.js     (HL.url)
 *   - display formats      → shared/format.js  (HL.format)
 *   - clipboard copy       → shared/clipboard.js (HL.clipboard)
 *   - file/backup export   → shared/export.js  (HL.export)
 *   - DOM helpers          → shared/domkit.js  (HL.domkit)
 *
 * Phase 2 migration (TypeScript): compiled by `bun run build:ext` into
 * extension/shared/utils.js — never edit the .js directly.
 */
function newId() {
    return 'hlx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}
function debounce(fn, ms) {
    let t = null;
    return function (...args) {
        clearTimeout(t ?? undefined);
        t = setTimeout(function () { fn(...args); }, ms);
    };
}
function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function cssEscape(s) {
    try {
        return (globalThis.CSS && globalThis.CSS.escape) ? globalThis.CSS.escape(String(s)) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }
    catch (e) {
        return String(s);
    }
}
export const util = {
    newId: newId,
    debounce: debounce,
    escapeHtml: escapeHtml,
    cssEscape: cssEscape
};
