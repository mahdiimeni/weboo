/**
 * Web Highlighter — theme boot (anti-flash + apply-now, CSP-safe)
 *
 * MV3 blocks inline scripts on extension pages (script-src 'self');
 * so the anti-flash theme step is an external file loaded in <head>, right
 * after the stylesheet and before the body renders.
 *
 * Contract: "hlx:theme" is the local mirror of hlx:settings.theme — used only
 * for a fast boot before the first paint. The source of truth is
 * chrome.storage; popup.js and dashboard.js re-sync this mirror with the
 * valid value after reading settings (and clear it on auto) via
 * HL.applyThemeNow — the single implementation lives here (v1.2.9; the two
 * pages used to carry byte-identical private copies). Invalid value → ignored.
 *
 * Script order note: this file runs in <head> before the shared core, so it
 * creates the globalThis.HL namespace itself; HL.applyThemeNow only touches
 * HL.domkit at call time (both consumers load domkit before their first call).
 */
(function () {
  'use strict';
  var HL = (globalThis.HL = globalThis.HL || {});

  /* ---------- Anti-flash boot (read side) ---------- */

  try {
    var t = localStorage.getItem('hlx:theme');
    if (t === 'light' || t === 'dark') {
      var root = document.documentElement;
      root.setAttribute('data-theme', t);
      root.style.colorScheme = t;
    }
  } catch (e) { /* localStorage unavailable — auto mode */ }

  /* ---------- Apply-now (write side — shared by popup + dashboard) ---------- */

  /**
   * Applies the theme to this document and syncs the "hlx:theme" mirror.
   * Returns the applied key ('auto' | 'light' | 'dark'), or null when the
   * shared core (HL.domkit) is not loaded yet — a safe no-op.
   */
  HL.applyThemeNow = function (t) {
    if (!HL.domkit || !HL.domkit.applyTheme) return null;
    var applied = HL.domkit.applyTheme(document, t);
    try {
      if (applied === 'auto') localStorage.removeItem('hlx:theme');
      else localStorage.setItem('hlx:theme', applied);
    } catch (e) { /* localStorage unavailable — next boot stays automatic */ }
    return applied;
  };
})();
