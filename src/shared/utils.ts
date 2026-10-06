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



  function newId(): string {
    return 'hlx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function debounce<F extends (...args: never[]) => void>(fn: F, ms: number): (...args: Parameters<F>) => void {
    let t: ReturnType<typeof setTimeout> | null = null;
    return function (this: void, ...args: Parameters<F>) {
      clearTimeout(t ?? undefined);
      t = setTimeout(function () { fn(...args); }, ms);
    };
  }

  function escapeHtml(s: unknown): string {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c];
    });
  }

  function cssEscape(s: unknown): string {
    try {
      return (globalThis.CSS && globalThis.CSS.escape) ? globalThis.CSS.escape(String(s)) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    } catch (e) {
      return String(s);
    }
  }

  export const util = {
    newId: newId,
    debounce: debounce,
    escapeHtml: escapeHtml,
    cssEscape: cssEscape
  };

