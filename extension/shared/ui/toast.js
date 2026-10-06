/**
 * Web Highlighter — Toast (short message at the bottom of the page)
 *
 * SRP: one widget = one file. Theme: palettes as CSS custom properties on
 * :host — the popup.css pattern (light base; system dark in media unless
 * light is forced; forced dark); the value comes from HL.ui.setTheme
 * (ui/base.js).
 * Light palette (v1.2.2): the pill border one step deeper so it clears the
 * lightness-discrimination floor — contrast contract in uitheme.test.ts.
 * Consumers: the content script (lazily — built on first show).
 */
import { ui, uiBase } from "./base.js";


  var LIGHT = [
    '--toast-bg: #ffffff;',
    '--toast-fg: #1f2937;',
    '--toast-bd: rgba(17,24,39,.16);',
    '--toast-shadow: 0 10px 30px rgba(0,0,0,.2);'
  ].join(' ');
  var DARK = [
    '--toast-bg: #111827;',
    '--toast-fg: #f9fafb;',
    '--toast-bd: rgba(255,255,255,.09);',
    '--toast-shadow: 0 10px 30px rgba(0,0,0,.3);'
  ].join(' ');

  var TOAST_CSS = [
    ':host { color-scheme: light; ' + LIGHT + ' }',
    '@media (prefers-color-scheme: dark) {',
    '  :host(:not([data-theme="light"])) { color-scheme: dark; ' + DARK + ' }',
    '}',
    ':host([data-theme="light"]) { color-scheme: light; }',
    ':host([data-theme="dark"]) { color-scheme: dark; ' + DARK + ' }',
    '.hlx-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(8px);',
    '  background: var(--toast-bg); color: var(--toast-fg); border: 1px solid var(--toast-bd);',
    '  padding: 9px 18px; border-radius: 999px; font-size: 13px; font-family: ' + uiBase.FONT + ';',
    '  direction: rtl; box-shadow: var(--toast-shadow); opacity: 0; transition: all .22s ease;',
    '  pointer-events: none; z-index: 2147483647; white-space: nowrap; }',
    '.hlx-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }'
  ].join('\n');

  var Toast = {
    _host: null,
    _el: null,
    _t: null,
    show: function (msg) {
      if (!this._host) {
        var h = uiBase.makeHost();
        this._host = h.host;
        this._root = h.root;
        var st = document.createElement('style');
        st.textContent = TOAST_CSS;
        this._root.appendChild(st);
        var el = document.createElement('div');
        el.className = 'fa hlx-toast';
        this._root.appendChild(el);
        this._el = el;
      }
      var self = this;
      this._el.textContent = String(msg || '');
      this._el.classList.add('show');
      clearTimeout(this._t);
      this._t = setTimeout(function () {
        self._el.classList.remove('show');
      }, 1900);
    }
  };

  ui.Toast = Toast;

