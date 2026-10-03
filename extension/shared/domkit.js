/**
 * Web Highlighter — minimal DOM helpers (SRP: createElement sweeteners)
 *
 * Consumers: dashboard-view and the popup — replacing their two duplicated
 * local versions. Deliberately kept small and stable; any more complex
 * builder belongs to the consumer's own view layer.
 */
import { THEME_KEYS } from "./constants.js"; /* 7c-3 */
(function () {
  'use strict';
  const HL = (globalThis.HL = globalThis.HL || {});

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function txtNode(s) { return document.createTextNode(String(s == null ? '' : s)); }

  /**
   * Applies the theme to an extension page's document (popup/dashboard).
   * - 'auto': remove data-theme → CSS decides via the system prefers-color-scheme.
   * - 'light'/'dark': data-theme + inline color-scheme (native scrollbars and
   *   controls pick up the palette too).
   * Unknown value → 'auto': validation happens at the UI boundary (storage is
   * raw and can hold anything — including an old/tampered backup).
   * Pure DOM; localStorage mirroring and persistence are the caller's concern.
   * Returns: the applied theme key (for mirroring/tests).
   */
  function applyTheme(doc, theme) {
    var t = 'auto';
    if (theme && THEME_KEYS && THEME_KEYS.indexOf(theme) !== -1) t = theme;
    var root = doc && doc.documentElement;
    if (!root || !root.setAttribute) return 'auto';
    if (t === 'auto') {
      root.removeAttribute('data-theme');
      if (root.style) root.style.removeProperty('color-scheme');
    } else {
      root.setAttribute('data-theme', t);
      if (root.style) root.style.colorScheme = t;
    }
    return t;
  }

  /**
   * Mounts a favicon onto the ".fl" spot (the first-letter tile):
   * - img.fl-img sits on the tile; the first letter stays as the placeholder.
   * - load → .on class on the img (fade-in) + .has-fav on the tile (letter becomes transparent).
   * - error → the img is removed; the first letter remains the permanent fallback.
   * The spot's letter/content is never touched; the URL (a dataURL captured
   * from the page itself) comes from the consumer — this function is pure DOM
   * and unaware of storage.
   * src is set after installing the listeners so instantly-cached events are
   * caught too. CSS (.fl-img/.has-fav) lives in dashboard.css/popup.css.
   */
  function mountFavicon(spot, url) {
    if (!spot || !url || !spot.appendChild) return null;
    var img = el('img', 'fl-img');
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.addEventListener('load', function () {
      img.classList.add('on');
      spot.classList.add('has-fav');
    });
    img.addEventListener('error', function () {
      img.remove();
    });
    spot.appendChild(img);
    img.src = url;
    return img;
  }

  HL.domkit = { el: el, txtNode: txtNode, mountFavicon: mountFavicon, applyTheme: applyTheme };
})();

/* identity export (7c-3) */
export const domkit = globalThis.HL.domkit;
