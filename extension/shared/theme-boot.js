/**
 * Weboo — theme + language boot (anti-flash, CSP-safe)
 *
 * MV3 blocks inline scripts on extension pages (script-src 'self');
 * so the anti-flash steps are an external file loaded in <head>, right
 * after the stylesheet and before the body renders.
 *
 * Contracts: "hlx:theme" is the local mirror of hlx:settings.theme and
 * "hlx:lang" (v0.14.0) the local mirror of hlx:settings.language — both used
 * only for a fast boot before the first paint. The source of truth is
 * chrome.storage; the pages re-sync the mirrors with the valid values after
 * reading settings via ui.applyThemeNow / ui.applyLangNow (ui/base.js — the
 * single write-side implementations since Phase 12 / v0.14.0).
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

  try {
    /* the mirror accepts every registered language (the classic script
       cannot import i18n.js — this list is its one hand-mirror; the unit
       suite walks it against LANG_KEYS via the mirror tests) */
    var LANGS = ['fa', 'en', 'de', 'es', 'ru', 'it', 'fr', 'tr'];
    var l = localStorage.getItem('hlx:lang');
    if (LANGS.indexOf(l) !== -1) {
      var r = document.documentElement;
      r.setAttribute('lang', l);
      r.setAttribute('dir', l === 'fa' ? 'rtl' : 'ltr');
    }
  } catch (e) { /* localStorage unavailable — the static fa/rtl markup stands */ }
})();
