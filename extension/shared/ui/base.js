/**
 * Weboo — shared UI infrastructure (Shadow DOM host + icons + widget theming/language)
 *
 * SRP: only the "home" of the floating widgets — makeHost and the SVG icons.
 * The actual widgets live in their sibling files:
 *   ui/toast.js → HL.ui.Toast
 *   ui/toolbar.js → HL.ui.FloatingToolbar
 *   ui/popover.js → HL.ui.NotePopover
 *
 * Theme: HL.ui.setTheme marks the extension UI theme (auto|light|dark) as
 * data-theme on all live hosts; makeHost marks each new host too
 * (OCP: future widgets get theming without extra code).
 * Language (v0.14.0): the same pattern — HL.ui.setLang marks the UI language
 * as lang/dir on all live hosts (the shadow trees inherit both), makeHost
 * marks each new host, and applyLangNow is the page-side write helper
 * (document root + the "hlx:lang" mirror — the applyThemeNow twin).
 * DIP: widgets and this file know nothing about storage — the value is
 * injected from the composition root (content script: user settings). Each
 * widget's CSS contract: light palette on :host, dark in
 * media (unless light is forced), forced dark via :host([data-theme="dark"])
 * — the popup.css pattern. Direction is NOT hardcoded anywhere in widget
 * CSS: the host's dir attribute drives it (fa → rtl, en → ltr).
 */
import { THEME_KEYS } from "../constants.js"; /* the theme allow-list */
import { setLanguage, getLanguage, dirOf, validLanguage } from "../i18n.js";
import { domkit } from "../domkit.js";


  var FONT = "Vazirmatn, 'Segoe UI', Tahoma, sans-serif";

  /* ---------- Content widget theming (aligned with the extension UI theme) ---------- */

  var theme = 'auto'; /* auto | light | dark — always a valid registry key */
  var lang = 'fa';    /* fa | en — always a valid LANGUAGES key (i18n state mirrors it) */
  var hosts = [];     /* live Shadow DOM hosts (for live syncing) */

  function applyThemeAttr(host) {
    if (theme === 'auto') host.removeAttribute('data-theme');
    else host.setAttribute('data-theme', theme);
  }

  function applyLangAttr(host) {
    host.setAttribute('lang', lang);
    host.setAttribute('dir', dirOf(lang));
  }

  /**
   * Applies the extension UI theme to all floating widgets (live syncing).
   * Invalid value → 'auto' (validation at the boundary — storage is raw and
   * can hold anything). auto means no attribute: the widget's CSS decides
   * via the system prefers-color-scheme.
   * Returns: the applied theme key (for tests/mirroring — domkit.applyTheme pattern).
   */
  function setTheme(t) {
    theme = (t && THEME_KEYS && THEME_KEYS.indexOf(t) !== -1) ? t : 'auto';
    for (var i = hosts.length - 1; i >= 0; i--) {
      if (!hosts[i].isConnected) { hosts.splice(i, 1); continue; } /* dead host */
      applyThemeAttr(hosts[i]);
    }
    return theme;
  }

  /**
   * Applies the UI language to all floating widgets (live syncing) AND to
   * the translation state (i18n.setLanguage — one entry point so the global
   * t() state and the host attributes can never drift). Invalid value →
   * 'fa' (validation at the boundary — storage is raw and can hold anything).
   * Returns: the applied language (for tests/mirroring — setTheme pattern).
   */
  function setLang(l) {
    lang = validLanguage(l);
    setLanguage(lang);
    for (var i = hosts.length - 1; i >= 0; i--) {
      if (!hosts[i].isConnected) { hosts.splice(i, 1); continue; } /* dead host */
      applyLangAttr(hosts[i]);
    }
    return lang;
  }

  /**
   * Shadow DOM host: a fixed, zero-sized element with data-hlx-ui
   * (so the index engine and selection guards reject the extension's own UI).
   * The host takes the current theme AND language at creation time so the
   * widget renders correctly from the very start.
   */
  function makeHost() {
    var host = document.createElement('div');
    host.setAttribute('data-hlx-ui', '1');
    var st = host.style;
    st.position = 'fixed';
    st.top = '0';
    st.left = '0';
    st.width = '0';
    st.height = '0';
    st.zIndex = '2147483646';
    st.pointerEvents = 'none';
    document.documentElement.appendChild(host);
    applyThemeAttr(host);
    applyLangAttr(host);
    hosts.push(host);
    startWatchdog();
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = BASE_CSS;
    root.appendChild(style);
    return { host: host, root: root };
  }

  /* ---------- Host watchdog (v0.6.6) ---------- */

  /* Some frameworks hydrate the whole document as their React root (Next.js
     App Router) and, when hydration hits a mismatch (error #418 — e.g. our
     early-applied <mark> vs the server HTML), their recovery pass DELETES
     every non-framework direct child of <html>/<body> — our hosts die once,
     silently, and every widget renders into a detached shadow root (popover
     "click does nothing", toolbar never appears). The host node itself is
     untouched otherwise, so re-attaching the SAME node restores everything
     (shadow tree, popover state, theme attr). One-shot wipes are the normal
     case; a repeating cleaner just gets re-attached each round. */
  var watchdogInstalled = false;
  var watchdogTimer = null;

  function reviveHosts() {
    watchdogTimer = null;
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i].isConnected) continue;
      try { document.documentElement.appendChild(hosts[i]); } catch (e) { /* noop */ }
    }
  }

  function startWatchdog() {
    if (watchdogInstalled || typeof MutationObserver === 'undefined') return;
    watchdogInstalled = true;
    try {
      var mo = new MutationObserver(function () {
        for (var i = 0; i < hosts.length; i++) {
          if (hosts[i].isConnected) continue;
          clearTimeout(watchdogTimer);
          watchdogTimer = setTimeout(reviveHosts, 300); /* coalesce one wipe batch */
          return;
        }
      });
      /* hosts are always direct children of <html> — childList only, no subtree */
      mo.observe(document.documentElement, { childList: true });
    } catch (e) { watchdogInstalled = false; }
  }

  var BASE_CSS = [
    ':host, * { box-sizing: border-box; }',
    'button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; padding: 0; }',
    /* Direction is NOT set here: the host's lang/dir attributes (v0.14.0)
       drive it — fa → rtl, en → ltr — with no duplicated stylesheets. */
    '.fa { font-family: ' + FONT + '; }'
  ].join('\n');

  /* ---------- SVG icons (lucide style) ---------- */
  function svg(path, size) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }
  var ICON = {
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
    grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>'
  };

  /* ---------- Apply-now (write side — shared by popup + dashboard) ----------
     Phase 12: this used to live on the classic theme-boot script (which cannot
     import modules); as a module binding it composes domkit's root
     application, the Shadow-DOM host sync and the "hlx:theme" mirror.
     Returns the applied key ('auto' | 'light' | 'dark'). */
  function applyThemeNow(t) {
    var applied = domkit.applyTheme(document, t);
    try {
      if (applied === 'auto') localStorage.removeItem('hlx:theme');
      else localStorage.setItem('hlx:theme', applied);
    } catch (e) { /* localStorage unavailable — next boot stays automatic */ }
    return setTheme(applied);
  }

  /* ---------- Language apply-now (v0.14.0 — the page-side write twin) ----------
     Extension PAGES only (popup/dashboard): sets the translation state +
     widget hosts (setLang), updates the document root's lang/dir, and
     mirrors the value into "hlx:lang" for the classic anti-flash boot.
     The CONTENT script never calls this — a web page's root lang/dir
     belongs to the page; widgets there get setLang only. */
  function applyLangNow(l) {
    var applied = setLang(l);
    try { localStorage.setItem('hlx:lang', applied); } catch (e) { /* mirror is best-effort */ }
    try {
      var root = document.documentElement;
      if (root && root.setAttribute) {
        root.setAttribute('lang', applied);
        root.setAttribute('dir', dirOf(applied));
      }
    } catch (e) { /* no document — widget hosts are already updated */ }
    return applied;
  }

  /* Aggregation level `ui` — the widget files mount onto it by importing it
     (one object per world via module identity) */
  export const ui = {
    setTheme: setTheme,
    getTheme: function () { return theme; },
    applyThemeNow: applyThemeNow,
    setLang: setLang,
    getLang: function () { return lang; },
    applyLangNow: applyLangNow
  };

  export const uiBase = {
    FONT: FONT,
    BASE_CSS: BASE_CSS,
    makeHost: makeHost,
    svg: svg,
    ICON: ICON
  };


