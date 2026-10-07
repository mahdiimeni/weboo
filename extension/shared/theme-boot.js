/**
 * Weboo — theme boot (anti-flash, CSP-safe)
 *
 * MV3 blocks inline scripts on extension pages (script-src 'self');
 * so the anti-flash theme step is an external file loaded in <head>, right
 * after the stylesheet and before the body renders.
 *
 * Contract: "hlx:theme" is the local mirror of hlx:settings.theme — used only
 * for a fast boot before the first paint. The source of truth is
 * chrome.storage; the pages re-sync this mirror with the valid value after
 * reading settings via ui.applyThemeNow (ui/base.js — the single write-side
 * implementation since Phase 12; theme-boot used to carry it when this file
 * could not import modules).
 *
 * This file must stay a CLASSIC first script (the anti-flash window runs
 * before every deferred module) — it exports nothing and touches no registry.
 */
(function () {
  'use strict';

  try {
    var t = localStorage.getItem('hlx:theme');
    if (t === 'light' || t === 'dark') {
      var root = document.documentElement;
      root.setAttribute('data-theme', t);
      root.style.colorScheme = t;
    }
  } catch (e) { /* localStorage unavailable — auto mode */ }
})();
