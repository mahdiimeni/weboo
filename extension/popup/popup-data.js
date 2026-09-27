/**
 * Web Highlighter — popup data layer (pure functions, no DOM, no storage)
 *
 * SRP/MVC (the same trio the dashboard uses since v1.1.0): the popup's policy —
 * supported-site check, theme validation, page summary counts, the smart
 * direction decision, list slicing/labels and the disabledHosts math — lives
 * here as pure functions (HL.pop), testable without a browser; the controller
 * (popup.js) orchestrates chrome/storage and the view (popup-view.js) renders.
 * Display formats come from HL.format and the direction policy from
 * HL.detectDir (v1.2.7 single source — one article, one direction; scope
 * narrowed in v1.2.8: the Persian list header is always RTL).
 * Dependencies (script order): shared/constants.js, shared/format.js,
 * shared/detect-dir.js, popup-data.js.
 */
(function () {
  'use strict';
  var HL = (globalThis.HL = globalThis.HL || {});
  /* Module guard — same convention as the popup controller: HL rides on
     globalThis (in a real page window === globalThis; globalThis also works
     in unit tests) */
  if (!HL.format || !HL.detectDir) return;

  var fmt = HL.format;

  /* ---------- Supported sites ---------- */

  /** (nu) → bool — http/https/file sites only (everything else → the unsupported card) */
  function isSupportedSite(nu) {
    const site = String(nu.site || '');
    return site.indexOf('http') === 0 || site.indexOf('file') === 0;
  }

  /* ---------- Theme ---------- */

  /** (settings|null) → valid theme key ('auto' fallback — storage is raw and can hold anything) */
  function validTheme(settings) {
    var t = settings && settings.theme;
    return (HL.THEME_KEYS && HL.THEME_KEYS.indexOf(t) !== -1) ? t : 'auto';
  }

  /* ---------- Page summary ---------- */

  /** (recsMap) → { total, notes } — counts of the current page's records */
  function summarize(recs) {
    var map = recs || new Map();
    let notes = 0;
    map.forEach(function (r) { if (r && r.note) notes++; });
    return { total: map.size, notes: notes };
  }

  /* ---------- Smart direction (v1.2.7/v1.2.8) ---------- */

  /**
   * (title, recsMap) → 'ltr' | 'rtl' — HL.detectDir.contentDir fed with the
   * page's own signals: the tab's live title (or host label — the caller
   * decides) + the highlight texts. The single smart-direction source shared
   * with the dashboard; the view only applies the result (DIP).
   */
  function directionOf(title, recs) {
    const dirTexts = [];
    (recs || new Map()).forEach(function (r) { if (r && r.text) dirTexts.push(r.text); });
    return HL.detectDir.contentDir(title || '', dirTexts);
  }

  /* ---------- List ---------- */

  /** (recsMap, cap) → rec[] — newest-first (updatedAt||createdAt desc), capped */
  function visibleItems(recs, cap) {
    return Array.from((recs || new Map()).values())
      .sort(function (a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); })
      .slice(0, cap);
  }

  /** (shown, total) → 'X از Y' when truncated, else 'N مورد' (Persian digits) */
  function countLabel(shown, total) {
    return shown < total
      ? fmt.faNum(shown) + ' از ' + fmt.faNum(total)
      : fmt.faNum(total) + ' مورد';
  }

  /* ---------- Site toggle ---------- */

  /**
   * (list, host, enabled) → new array — the next disabledHosts list for the
   * site toggle. Pure: the input array is never mutated and the caller
   * persists the result (enabled → remove the host; disabled → append).
   */
  function nextDisabledHosts(list, host, enabled) {
    const out = (list || []).slice();
    const idx = out.indexOf(host);
    if (enabled) { if (idx !== -1) out.splice(idx, 1); }
    else { if (idx === -1) out.push(host); }
    return out;
  }

  HL.pop = {
    isSupportedSite: isSupportedSite,
    validTheme: validTheme,
    summarize: summarize,
    directionOf: directionOf,
    visibleItems: visibleItems,
    countLabel: countLabel,
    nextDisabledHosts: nextDisabledHosts
  };
})();
