/**
 * Web Highlighter — shared UI infrastructure (Shadow DOM host + icons + widget theming)
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
 * DIP: widgets and this file know nothing about storage — the value is
 * injected from the composition root (content script: user settings). Each
 * widget's CSS contract: light palette on :host, dark in
 * media (unless light is forced), forced dark via :host([data-theme="dark"])
 * — the popup.css pattern.
 */
(function () {
  'use strict';
  const HL = (globalThis.HL = globalThis.HL || {});

  var FONT = "Vazirmatn, 'Segoe UI', Tahoma, sans-serif";

  /* ---------- Content widget theming (aligned with the extension UI theme) ---------- */

  var theme = 'auto'; /* auto | light | dark — always a valid registry key */
  var hosts = [];     /* live Shadow DOM hosts (for live syncing) */

  function applyThemeAttr(host) {
    if (theme === 'auto') host.removeAttribute('data-theme');
    else host.setAttribute('data-theme', theme);
  }

  /**
   * Applies the extension UI theme to all floating widgets (live syncing).
   * Invalid value → 'auto' (validation at the boundary — storage is raw and
   * can hold anything). auto means no attribute: the widget's CSS decides
   * via the system prefers-color-scheme.
   * Returns: the applied theme key (for tests/mirroring — domkit.applyTheme pattern).
   */
  function setTheme(t) {
    theme = (t && HL.THEME_KEYS && HL.THEME_KEYS.indexOf(t) !== -1) ? t : 'auto';
    for (var i = hosts.length - 1; i >= 0; i--) {
      if (!hosts[i].isConnected) { hosts.splice(i, 1); continue; } /* dead host */
      applyThemeAttr(hosts[i]);
    }
    return theme;
  }

  /**
   * Shadow DOM host: a fixed, zero-sized element with data-hlx-ui
   * (so the index engine and selection guards reject the extension's own UI).
   * The host takes the current theme at creation time so the widget renders
   * correctly from the very start.
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
    hosts.push(host);
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = BASE_CSS;
    root.appendChild(style);
    return { host: host, root: root };
  }

  var BASE_CSS = [
    ':host, * { box-sizing: border-box; }',
    'button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; padding: 0; }',
    '.fa { direction: rtl; font-family: ' + FONT + '; }'
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

  /* Aggregation level HL.ui — widgets mount onto it from their own files */
  HL.ui = HL.ui || {};
  HL.ui.setTheme = setTheme;
  HL.ui.getTheme = function () { return theme; };

  HL.uiBase = {
    FONT: FONT,
    BASE_CSS: BASE_CSS,
    makeHost: makeHost,
    svg: svg,
    ICON: ICON
  };
})();
