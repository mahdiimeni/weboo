/**
 * Web Highlighter — FloatingToolbar (toolbar above the selected text)
 *
 * SRP: one widget = one file. 5 colors + note + copy; the buttons are built
 * from the HL.COLORS registry (OCP: a new color = one registry entry).
 * Visibility invariant: hidden at construction; shown only via present().
 *
 * Theme: palettes as CSS custom properties on :host — the popup.css pattern:
 * light base; system dark in media (unless light is forced); forced dark. The
 * value comes from HL.ui.setTheme (host built in ui/base.js) — this widget
 * knows nothing about storage. The dark palette is defined once in JS and
 * injected into both dark blocks (no manual duplication — contract test in
 * uitheme.test.ts).
 * Light palette (v1.2.2): alphas were deepened so the pill border/separator/
 * color rings and hovers clear the lightness-discrimination floor (on a white
 * background the previous alphas were below the visibility threshold —
 * contrast contract in uitheme.test.ts). Dark palette untouched.
 */
(function () {
  'use strict';
  const HL = (globalThis.HL = globalThis.HL || {});
  var svg = HL.uiBase.svg;
  var ICON = HL.uiBase.ICON;

  var LIGHT = [
    '--tb-bg: rgba(255,255,255,.97);',
    '--tb-fg: #1f2937;',
    '--tb-border: rgba(17,24,39,.18);',
    '--tb-shadow: 0 10px 34px rgba(0,0,0,.16);',
    '--tb-dot-border: rgba(17,24,39,.28);',
    '--tb-dot-border-h: #111827;',
    '--tb-sep: rgba(17,24,39,.25);',
    '--tb-btn-fg: #374151;',
    '--tb-btn-h-bg: rgba(17,24,39,.14);',
    '--tb-btn-h-fg: #111827;',
    '--tb-note: #b45309;',
    '--tb-note-h-bg: rgba(217,119,6,.18);'
  ].join(' ');
  var DARK = [
    '--tb-bg: rgba(17,24,39,.97);',
    '--tb-fg: #f9fafb;',
    '--tb-border: rgba(255,255,255,.09);',
    '--tb-shadow: 0 10px 34px rgba(0,0,0,.38);',
    '--tb-dot-border: rgba(255,255,255,.25);',
    '--tb-dot-border-h: #fff;',
    '--tb-sep: rgba(255,255,255,.16);',
    '--tb-btn-fg: #e5e7eb;',
    '--tb-btn-h-bg: rgba(255,255,255,.12);',
    '--tb-btn-h-fg: #fff;',
    '--tb-note: #fbbf24;',
    '--tb-note-h-bg: rgba(251,191,36,.15);'
  ].join(' ');

  var TOOLBAR_CSS = [
    ':host { color-scheme: light; ' + LIGHT + ' }',
    '@media (prefers-color-scheme: dark) {',
    '  :host(:not([data-theme="light"])) { color-scheme: dark; ' + DARK + ' }',
    '}',
    ':host([data-theme="light"]) { color-scheme: light; }',
    ':host([data-theme="dark"]) { color-scheme: dark; ' + DARK + ' }',
    '.hlx-tb { position: fixed; direction: rtl; display: flex; align-items: center; gap: 2px;',
    '  background: var(--tb-bg); color: var(--tb-fg); border: 1px solid var(--tb-border);',
    '  border-radius: 999px; padding: 6px 8px; box-shadow: var(--tb-shadow);',
    '  font-family: ' + HL.uiBase.FONT + '; pointer-events: auto; animation: hlx-pop .14s ease-out; }',
    '@keyframes hlx-pop { from { opacity: 0; transform: translateY(5px) scale(.95); } to { opacity: 1; } }',
    '.hlx-tb .c { width: 25px; height: 25px; border-radius: 999px; border: 2px solid var(--tb-dot-border);',
    '  transition: transform .12s ease, border-color .12s ease; flex: 0 0 auto; }',
    '.hlx-tb .c:hover { transform: scale(1.2); border-color: var(--tb-dot-border-h); }',
    '.hlx-tb .sep { width: 1px; height: 20px; background: var(--tb-sep); margin: 0 5px; flex: 0 0 auto; }',
    '.hlx-tb .b { width: 30px; height: 30px; border-radius: 9px; color: var(--tb-btn-fg); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }',
    '.hlx-tb .b:hover { background: var(--tb-btn-h-bg); color: var(--tb-btn-h-fg); }',
    '.hlx-tb .b.note { color: var(--tb-note); }',
    '.hlx-tb .b.note:hover { background: var(--tb-note-h-bg); }'
  ].join('\n');

  function FloatingToolbar(opts) {
    var self = this;
    this.onColor = opts.onColor || function () {};
    this.onNote = opts.onNote || function () {};
    this.onCopy = opts.onCopy || function () {};
    this.ctx = null;
    this.visible = false;

    var h = HL.uiBase.makeHost();
    this.host = h.host;
    this.root = h.root;

    var st = document.createElement('style');
    st.textContent = TOOLBAR_CSS;
    this.root.appendChild(st);

    var el = document.createElement('div');
    el.className = 'fa hlx-tb';
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', 'ابزار هایلایت');
    var html = '';
    (HL.COLOR_KEYS || []).forEach(function (k) {
      var c = HL.COLORS[k];
      html += '<button class="c" data-color="' + k + '" title="هایلایت ' + c.label + '" aria-label="هایلایت ' + c.label + '" style="background:' + c.dot + '"></button>';
    });
    html += '<span class="sep"></span>';
    html += '<button class="b note" data-act="note" title="هایلایت + یادداشت" aria-label="هایلایت با یادداشت">' + svg(ICON.pen, 17) + '</button>';
    html += '<button class="b" data-act="copy" title="کپی متن" aria-label="کپی متن انتخاب‌شده">' + svg(ICON.copy, 15) + '</button>';
    el.innerHTML = html;
    this.root.appendChild(el);
    this.el = el;
    el.style.display = 'none'; // invariant: starts hidden — only present() shows it

    // preventDefault on mousedown so the text selection is not lost
    el.addEventListener('mousedown', function (e) { e.preventDefault(); }, true);
    el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.getAttribute('data-color')) self.onColor(btn.getAttribute('data-color'), self.ctx);
      else if (btn.getAttribute('data-act') === 'note') self.onNote(self.ctx);
      else if (btn.getAttribute('data-act') === 'copy') self.onCopy(self.ctx);
    });

    var reposition = function () { if (self.visible) self.position(); };
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition);
  }

  FloatingToolbar.prototype.present = function (ctx) {
    this.ctx = ctx;
    this.visible = true;
    this.el.style.display = 'flex';
    this.position();
  };

  FloatingToolbar.prototype.position = function () {
    if (!this.visible || !this.ctx) return;
    var r = null;
    try { r = this.ctx.range.getBoundingClientRect(); } catch (e) { r = null; }
    if (!r || (r.width === 0 && r.height === 0)) { this.dismiss(); return; }
    var w = this.el.offsetWidth, h = this.el.offsetHeight;
    var top = r.top - h - 10;
    if (top < 8) top = Math.min(r.bottom + 10, window.innerHeight - h - 8);
    var left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    this.el.style.top = top + 'px';
    this.el.style.left = left + 'px';
  };

  FloatingToolbar.prototype.dismiss = function () {
    this.visible = false;
    this.ctx = null;
    this.el.style.display = 'none';
  };

  HL.ui = HL.ui || {};
  HL.ui.FloatingToolbar = FloatingToolbar;
})();
