/**
 * Weboo — NotePopover (note popover on each highlight)
 *
 * SRP: one widget = one file. View/edit note, change color (from the
 * HL.COLORS registry — OCP), two-step delete confirmation, copy.
 * Text is rendered only through escapeHtml (XSS-safe against web page content).
 * Visibility invariant: hidden at construction; shown only via present().
 * Dragging: only from the header — installDrag at the bottom of the file;
 * after the first drag the popover is "detached" (userPos) and scroll/resize
 * merely clamp it to the viewport — it never re-anchors to the mark. Each
 * fresh present() re-anchors (the move is ephemeral and never stored in data).
 *
 * Theme: palettes as CSS custom properties on :host — the popup.css pattern
 * (light base; system dark in media unless light is forced; forced dark); the
 * value comes from HL.ui.setTheme (ui/base.js) — this widget knows nothing
 * about storage. The dark palette is defined once in JS and injected into
 * both dark blocks.
 * Light palette (v1.2.2): tonal steps one deeper (gray-200→300, amber-50→100,
 * green-50→100) + four new tokens (--po-dot-bd/--po-ic/--po-muted/--po-g-h-bg)
 * that turned hardcoded CSS values into variables so dark renders exactly as
 * before while light gains contrast — contrast contract in uitheme.test.ts.
 * Smart content direction (v1.2.10): the quote box (.q), the note editor
 * (textarea) and the saved-note display (.note-text) render in the content's
 * own direction — detectDir.detectTextDir (the single source the popup and
 * dashboard already use) decides; LTR content gets dir="ltr", RTL takes no
 * attribute (the window's rtl default — precise scope: the Persian UI chrome
 * never flips). The editor re-decides on every keystroke (oninput delegation)
 * so typing itself follows the typed language, and the view-mode .note-text
 * uses the saved note as its own signal (v1.2.11).
 * Two CSS consequences: the accent bar is border-inline-start (flips with the
 * direction) and the textarea no longer hard-codes direction in CSS — otherwise
 * the dir attribute could never win over it.
 * Note-box actions (v0.5.1): the empty state's «افزودن یادداشت» is now a
 * centered amber pill (the .btn-p primary look with fully-rounded ends —
 * ICON.plus + label), and the noted state's «ویرایش یادداشت» link collapsed
 * into an icon-only button (ICON.pen in the .ib 30×30 geometry) that keeps
 * its accessible name via title/aria-label. The icon's amber flows from two
 * new tokens (--po-note-ic/--po-note-h-bg — the toolbar's --tb-note pair,
 * DIP: theme values come from the token layer, not hardcoded CSS) so dark
 * keeps its proven #fbbf24 instead of the old hardcoded #b45309 (contrast
 * contract in uitheme.test.ts). The pill itself stays hardcoded amber like
 * .btn-p — the theme-invariant primary-button convention (amber on both
 * surfaces, exactly like the «ذخیره یادداشت» button in edit mode).
 */
import { ui, uiBase } from "./base.js";
import { detectDir } from "../detect-dir.js";
import { format } from "../format.js";
import { util } from "../utils.js";
import { COLORS, COLOR_KEYS } from "../constants.js"; /* 7c-2 */

  var svg = uiBase.svg;
  var ICON = uiBase.ICON;

  var LIGHT = [
    '--po-bg: #ffffff;',
    '--po-fg: #1f2937;',
    '--po-border: #d1d5db;',
    '--po-grip: #c7cbd4;',
    '--po-grip-h: #6b7280;',
    '--po-act: #111827;',
    '--po-ring: #ffffff;',
    '--po-hov-bg: #e5e7eb;',
    '--po-hov-fg: #111827;',
    '--po-q-bg: #fef3c7;',
    '--po-q-fg: #78350f;',
    '--po-nb-bd: #d1d5db;',
    '--po-nbh-bd: #86efac;',
    '--po-nbh-bg: #dcfce7;',
    '--po-nbh-fg: #14532d;',
    '--po-note-fg: #111827;',
    '--po-ta-bg: #ffffff;',
    '--po-ta-bd: #d1d5db;',
    '--po-ta-fg: #111827;',
    '--po-g-bg: #e5e7eb;',
    '--po-g-fg: #374151;',
    '--po-g-h-bg: #d1d5db;',
    '--po-foot-bd: #e5e7eb;',
    '--po-dot-bd: rgba(17,24,39,.28);',
    '--po-ic: #4b5563;',
    '--po-muted: #4b5563;',
    '--po-note-ic: #b45309;',
    '--po-note-h-bg: rgba(217,119,6,.18);'
  ].join(' ');
  var DARK = [
    '--po-bg: #1f2937;',
    '--po-fg: #f3f4f6;',
    '--po-border: #374151;',
    '--po-grip: #4b5563;',
    '--po-grip-h: #d1d5db;',
    '--po-act: #f9fafb;',
    '--po-ring: #1f2937;',
    '--po-hov-bg: #374151;',
    '--po-hov-fg: #f9fafb;',
    '--po-q-bg: rgba(245,158,11,.12);',
    '--po-q-fg: #fcd34d;',
    '--po-nb-bd: #4b5563;',
    '--po-nbh-bd: #065f46;',
    '--po-nbh-bg: rgba(6,95,70,.25);',
    '--po-nbh-fg: #a7f3d0;',
    '--po-note-fg: #f9fafb;',
    '--po-ta-bg: #111827;',
    '--po-ta-bd: #4b5563;',
    '--po-ta-fg: #f9fafb;',
    '--po-g-bg: #374151;',
    '--po-g-fg: #e5e7eb;',
    '--po-g-h-bg: #e5e7eb;',
    '--po-foot-bd: #374151;',
    '--po-dot-bd: #e5e7eb;',
    '--po-ic: #6b7280;',
    '--po-muted: #9ca3af;',
    '--po-note-ic: #fbbf24;',
    '--po-note-h-bg: rgba(251,191,36,.15);'
  ].join(' ');

  var POPOVER_CSS = [
    ':host { color-scheme: light; ' + LIGHT + ' }',
    '@media (prefers-color-scheme: dark) {',
    '  :host(:not([data-theme="light"])) { color-scheme: dark; ' + DARK + ' }',
    '}',
    ':host([data-theme="light"]) { color-scheme: light; }',
    ':host([data-theme="dark"]) { color-scheme: dark; ' + DARK + ' }',
    '.hlx-po { position: fixed; direction: rtl; width: 328px; max-width: calc(100vw - 20px);',
    '  background: var(--po-bg); color: var(--po-fg); border: 1px solid var(--po-border); border-radius: 14px;',
    '  box-shadow: 0 14px 44px rgba(0,0,0,.2); font-family: ' + uiBase.FONT + '; font-size: 13px;',
    '  pointer-events: auto; animation: hlx-po-pop .16s ease-out; z-index: 2147483647; }',
    '@keyframes hlx-po-pop { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; } }',
    '.hlx-po .head { display: flex; align-items: center; gap: 6px; padding: 10px 12px 6px; cursor: grab; touch-action: none; }',
    '.hlx-po .grip { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; color: var(--po-grip); flex: 0 0 auto; }',
    '.hlx-po .grip:hover { color: var(--po-grip-h); }',
    '.hlx-po.dragging .head { cursor: grabbing; }',
    '.hlx-po.dragging { animation: none; box-shadow: 0 22px 60px rgba(0,0,0,.3); }',
    '.hlx-po.dragging .q, .hlx-po.dragging .note-text { user-select: none; }',
    '.hlx-po .c { width: 21px; height: 21px; border-radius: 999px; border: 2px solid var(--po-dot-bd); flex: 0 0 auto; transition: transform .12s; }',
    '.hlx-po .c:hover { transform: scale(1.15); }',
    '.hlx-po .c.active { border-color: var(--po-act); box-shadow: 0 0 0 2px var(--po-ring), 0 0 0 4px #d97706; }',
    '.hlx-po .grow { flex: 1; }',
    '.hlx-po .x { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--po-ic); }',
    '.hlx-po .x:hover { background: var(--po-hov-bg); color: var(--po-hov-fg); }',
    '.hlx-po .q { margin: 2px 12px 10px; padding: 8px 11px; background: var(--po-q-bg); border-inline-start: 3px solid #f59e0b;',
    '  border-radius: 9px; color: var(--po-q-fg); line-height: 2; font-size: 12.5px; max-height: 92px; overflow: auto;',
    '  white-space: pre-wrap; word-break: break-word; }',
    '.hlx-po .note-box { margin: 0 12px 10px; padding: 10px 12px; border: 1.5px dashed var(--po-nb-bd); border-radius: 11px; color: var(--po-muted); display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }',
    '.hlx-po .note-box.has { border: 1.5px solid var(--po-nbh-bd); background: var(--po-nbh-bg); color: var(--po-nbh-fg); }',
    '.hlx-po .note-text { white-space: pre-wrap; word-break: break-word; line-height: 2; color: var(--po-note-fg); width: 100%; max-height: 180px; overflow: auto; }',
    '.hlx-po .note-text:empty::before { content: "—"; opacity: .4; }',
    /* v0.5.1 — the add-state CTA: a centered pill (the .btn-p primary look,
       radius 999px) carrying the plus glyph + label; align-self centers it in
       the note-box column while the hint text above stays start-aligned. */
    '.hlx-po .add-note { align-self: center; background: #d97706; color: #fff; border-radius: 999px; padding: 7px 18px;',
    '  font-weight: 700; font-size: 12.5px; display: inline-flex; align-items: center; gap: 6px; }',
    '.hlx-po .add-note:hover { background: #b45309; }',
    /* v0.5.1 — the noted-state control: icon-only pen in the .ib geometry; the
       accessible name lives on title/aria-label (the visible text is gone). */
    '.hlx-po .edit-note { width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center;',
    '  justify-content: center; color: var(--po-note-ic); flex: 0 0 auto; }',
    '.hlx-po .edit-note:hover { background: var(--po-note-h-bg); }',
    '.hlx-po textarea { width: 100%; min-height: 86px; resize: vertical; border: 1.5px solid var(--po-ta-bd); border-radius: 10px;',
    '  padding: 8px 11px; font: inherit; line-height: 2; background: var(--po-ta-bg); color: var(--po-ta-fg); }',
    '.hlx-po textarea:focus { outline: none; border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,.18); }',
    '.hlx-po .row { display: flex; gap: 8px; align-items: center; justify-content: flex-end; }',
    '.hlx-po .btn-p { background: #d97706; color: #fff; border-radius: 9px; padding: 7px 16px; font-weight: 700; font-size: 12.5px; }',
    '.hlx-po .btn-p:hover { background: #b45309; }',
    '.hlx-po .btn-g { background: var(--po-g-bg); color: var(--po-g-fg); border-radius: 9px; padding: 7px 16px; font-weight: 600; font-size: 12.5px; }',
    '.hlx-po .btn-g:hover { background: var(--po-g-h-bg); }',
    '.hlx-po .foot { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 10px; border-top: 1px solid var(--po-foot-bd); }',
    '.hlx-po .date { color: var(--po-muted); font-size: 11.5px; }',
    '.hlx-po .act { display: flex; gap: 2px; }',
    '.hlx-po .ib { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--po-ic); }',
    '.hlx-po .ib:hover { background: var(--po-hov-bg); color: var(--po-hov-fg); }',
    '.hlx-po .ib.del:hover { background: #fef2f2; color: #dc2626; }',
    '.hlx-po .ib.del.confirm { background: #dc2626; color: #fff; width: auto; padding: 0 10px; font-weight: 700; font-size: 11.5px; }',
    '.hlx-po .ok { color: #059669; font-size: 12px; font-weight: 700; opacity: 0; transition: opacity .25s; }',
    '.hlx-po .ok.show { opacity: 1; }'
  ].join('\n');

  /* ---------- Content direction (v1.2.10) ----------
     The decision lives in detectDir.detectTextDir — the single source the
     popup and dashboard already consume; this view only applies it (DIP, the
     same split as detect-dir.js documents): LTR content gets dir="ltr", RTL
     takes no attribute at all (the window's rtl default). */

  function ltrDirAttr(text) {
    return detectDir.detectTextDir(text) === 'ltr' ? ' dir="ltr"' : '';
  }

  /** Typing direction — re-decided on every keystroke via the oninput delegation. */
  function syncNoteDir(ta) {
    if (detectDir.detectTextDir(ta.value) === 'ltr') ta.setAttribute('dir', 'ltr');
    else ta.removeAttribute('dir');
  }

  function NotePopover(handlers) {
    var self = this;
    this.h = {
      onColorChange: handlers.onColorChange || function () {},
      onSaveNote: handlers.onSaveNote || function () {},
      onDelete: handlers.onDelete || function () {},
      onCopy: handlers.onCopy || function () {},
      onClose: handlers.onClose || function () {}
    };
    this.data = null;
    this.mode = 'view'; // view | edit
    this.visible = false;
    this.userPos = null; // { left, top } — only after a drag; null means anchored to the mark

    var h = uiBase.makeHost();
    this.host = h.host;
    this.root = h.root;

    var st = document.createElement('style');
    st.textContent = POPOVER_CSS;
    this.root.appendChild(st);

    var el = document.createElement('div');
    el.className = 'fa hlx-po';
    el.setAttribute('role', 'dialog');
    el.setAttribute('dir', 'rtl');
    this.root.appendChild(el);
    this.el = el;
    el.style.display = 'none'; // invariant: starts hidden — only present() shows it

    // Window dragging — delegated on el itself so it survives later re-renders
    installDrag(this, el);

    // Close on outside click
    this._outside = function (e) {
      if (!self.visible) return;
      var path = (e.composedPath && e.composedPath()) || [];
      if (path.indexOf(self.host) === -1) self.dismiss();
    };
    window.addEventListener('mousedown', this._outside, true);

    this._key = function (e) {
      if (e.key === 'Escape' && self.visible) {
        if (self.mode === 'edit') { self.render('view'); } else { self.dismiss(); }
      }
    };
    document.addEventListener('keydown', this._key, true);

    this._reposition = function () { if (self.visible) self.position(); };
    window.addEventListener('scroll', this._reposition, { passive: true, capture: true });
    window.addEventListener('resize', this._reposition);
  }

  /**
   * opts: { id, mark?, rect?, color, note, quote, createdAt, editNow }
   */
  NotePopover.prototype.present = function (opts) {
    this.data = opts;
    this.mode = (opts.editNow || (opts.note && opts.editNow)) ? 'edit' : 'view';
    this.visible = true;
    this.render(this.mode);
    this.position();
    if (this.mode === 'edit') this.focusTextarea();
  };

  NotePopover.prototype.currentId = function () {
    return this.data ? this.data.id : null;
  };

  NotePopover.prototype.updateNote = function (note) {
    if (!this.data) return;
    this.data.note = note;
    if (this.visible && this.mode === 'view') this.render('view');
  };

  NotePopover.prototype.render = function (mode) {
    var self = this;
    this.mode = mode || 'view';
    var d = this.data;
    if (!d) return;
    var esc = util.escapeHtml;
    var html = '';

    // Header: drag grip + colors + close
    html += '<div class="head">';
    html += '<span class="grip" title="جابه‌جایی پنجره؛ بکشید و رها کنید" aria-hidden="true">' + svg(ICON.grip, 14) + '</span>';
    (COLOR_KEYS || []).forEach(function (k) {
      var c = COLORS[k];
      html += '<button class="c' + (k === d.color ? ' active' : '') + '" data-color="' + k + '" title="' + esc(c.label) + '" aria-label="رنگ ' + esc(c.label) + '" style="background:' + c.dot + '"></button>';
    });
    html += '<span class="grow"></span>';
    html += '<button class="x" data-act="close" title="بستن" aria-label="بستن">' + svg(ICON.close, 15) + '</button>';
    html += '</div>';

    // Highlighted text — rendered in its own direction (v1.2.10)
    var quoteShown = format.excerpt(d.quote, 260);
    html += '<div class="q"' + ltrDirAttr(quoteShown) + '>' + esc(quoteShown) + '</div>';

    if (this.mode === 'view') {
      var hasNote = !!(d.note && String(d.note).trim());
      html += '<div class="note-box' + (hasNote ? ' has' : '') + '">';
      if (hasNote) {
        html += '<div class="note-text"' + ltrDirAttr(d.note) + '>' + esc(d.note) + '</div>';
        html += '<button class="edit-note" data-act="edit" title="ویرایش یادداشت" aria-label="ویرایش یادداشت">' + svg(ICON.pen, 15) + '</button>';
      } else {
        html += '<span>برای این هایلایت یادداشتی ثبت نشده است.</span>';
        html += '<button class="add-note" data-act="edit">' + svg(ICON.plus, 13) + ' افزودن یادداشت</button>';
      }
      html += '</div>';
    } else {
      html += '<div style="margin:0 12px 10px">';
      html += '<textarea placeholder="یادداشت شما برای این هایلایت…" data-role="note-input"' + ltrDirAttr(d.note || '') + '>' + esc(d.note || '') + '</textarea>';
      html += '<div class="row" style="margin-top:10px">';
      html += '<span class="ok" data-role="ok">ذخیره شد ✓</span>';
      html += '<button class="btn-g" data-act="cancel">لغو</button>';
      html += '<button class="btn-p" data-act="save">ذخیره یادداشت</button>';
      html += '</div></div>';
    }

    // Footer: date + copy + delete
    html += '<div class="foot">';
    html += '<span class="date">' + esc(format.fmtDateTime(d.createdAt)) + '</span>';
    html += '<span class="act">';
    html += '<button class="ib" data-act="copy" title="کپی متن و یادداشت" aria-label="کپی">' + svg(ICON.copy, 15) + '</button>';
    html += '<button class="ib del" data-act="del" title="حذف هایلایت" aria-label="حذف">' + svg(ICON.trash, 15) + '</button>';
    html += '</span></div>';

    this.el.innerHTML = html;

    // Events (delegation)
    this.el.onclick = function (e) {
      var btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      var color = btn.getAttribute('data-color');
      e.preventDefault();
      e.stopPropagation();

      if (color) {
        self.data.color = color;
        self.h.onColorChange(self.data.id, color);
        var dots = self.el.querySelectorAll('.c');
        for (var i = 0; i < dots.length; i++) dots[i].classList.remove('active');
        btn.classList.add('active');
        return;
      }
      if (act === 'close') { self.dismiss(); }
      else if (act === 'edit') { self.render('edit'); self.focusTextarea(); }
      else if (act === 'save') {
        var ta = self.el.querySelector('[data-role="note-input"]');
        var val = ta ? ta.value : '';
        self.data.note = val;
        self.h.onSaveNote(self.data.id, val);
        self.render('view');
        self.flashOk();
      }
      else if (act === 'cancel') { self.render('view'); }
      else if (act === 'copy') { self.h.onCopy(self.data.id); }
      else if (act === 'del') {
        if (btn.classList.contains('confirm')) {
          self.h.onDelete(self.data.id);
          self.dismiss();
        } else {
          btn.classList.add('confirm');
          btn.textContent = 'حذف؟';
          setTimeout(function () {
            if (btn.isConnected) { btn.classList.remove('confirm'); btn.innerHTML = svg(ICON.trash, 15); }
          }, 2600);
        }
      }
    };

    // Typing direction (v1.2.10): the note editor follows the language being
    // typed — delegated on el itself so it survives every innerHTML rebuild,
    // exactly like the click delegation above.
    this.el.oninput = function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-role') === 'note-input') syncNoteDir(t);
    };
  };

  NotePopover.prototype.flashOk = function () {
    var ok = this.el.querySelector('[data-role="ok"]');
    if (!ok) return;
    ok.classList.add('show');
    setTimeout(function () { ok.classList.remove('show'); }, 1600);
  };

  NotePopover.prototype.focusTextarea = function () {
    var self = this;
    setTimeout(function () {
      var ta = self.el.querySelector('[data-role="note-input"]');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 30);
  };

  NotePopover.prototype.position = function () {
    if (!this.visible || !this.data) return;
    if (this.userPos) {
      // The user has moved the window: never return to the mark; just clamp to the viewport
      if (this.data.mark && !this.data.mark.isConnected) { this.dismiss(); return; }
      var u = clampToViewport(this.userPos.left, this.userPos.top, this.el.offsetWidth, this.el.offsetHeight);
      this.el.style.left = u.left + 'px';
      this.el.style.top = u.top + 'px';
      return;
    }
    var rect = null;
    if (this.data.mark && this.data.mark.isConnected) {
      try { rect = this.data.mark.getBoundingClientRect(); } catch (e) { rect = null; }
    }
    if (!rect && this.data.mark && !this.data.mark.isConnected) { this.dismiss(); return; }
    if (!rect) rect = this.data.rect;
    if (!rect) { this.dismiss(); return; }

    var w = this.el.offsetWidth, h = this.el.offsetHeight;
    var top = rect.bottom + 10;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 10);
    var left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
    this.el.style.top = top + 'px';
    this.el.style.left = left + 'px';
  };

  NotePopover.prototype.dismiss = function () {
    if (!this.visible) return;
    this.visible = false;
    this.data = null;
    this.userPos = null;
    this.el.style.display = 'none';
    this.el.innerHTML = '';
    this.h.onClose();
  };

  // Restore display on the next present
  var origPresent = NotePopover.prototype.present;
  NotePopover.prototype.present = function (opts) {
    this.userPos = null; // each open = a fresh anchor (a move persists only until close)
    this.el.style.display = 'block';
    origPresent.call(this, opts);
  };

  /* ---------- Window dragging — only from the header ----------
     Pointer Events (mouse/touch/pen). The involved state lives only in this
     closure; the self.visible guard in end() guarantees that if the window
     is closed mid-drag, userPos isn't set after dismiss. */
  function clampToViewport(left, top, w, h) {
    var vw = window.innerWidth || 0;
    var vh = window.innerHeight || 0;
    var m = 8;
    var l = Math.min(Math.max(left, m), Math.max(m, vw - w - m));
    var t = Math.min(Math.max(top, m), Math.max(m, vh - h - m));
    return { left: l, top: t };
  }

  function installDrag(self, el) {
    var drag = null; // { sx, sy, baseL, baseT, moved, pid }

    el.addEventListener('pointerdown', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest('.head') || t.closest('button')) return; /* buttons have their own jobs */
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); /* text selection/focus stealing at drag start are neutralized */
      var baseL = parseFloat(el.style.left);
      var baseT = parseFloat(el.style.top);
      if (isNaN(baseL)) baseL = el.offsetLeft || 0;
      if (isNaN(baseT)) baseT = el.offsetTop || 0;
      drag = {
        sx: e.clientX || 0,
        sy: e.clientY || 0,
        baseL: baseL,
        baseT: baseT,
        moved: false,
        pid: e.pointerId
      };
      el.classList.add('dragging');
      try { if (el.setPointerCapture) el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });

    el.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = (e.clientX || 0) - drag.sx;
      var dy = (e.clientY || 0) - drag.sy;
      if (!drag.moved) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return; /* unintended jitter is not a drag */
        drag.moved = true;
      }
      var p = clampToViewport(drag.baseL + dx, drag.baseT + dy, el.offsetWidth, el.offsetHeight);
      el.style.left = p.left + 'px';
      el.style.top = p.top + 'px';
    });

    function end() {
      if (!drag) return;
      el.classList.remove('dragging');
      try { if (el.releasePointerCapture) el.releasePointerCapture(drag.pid); } catch (err) { /* noop */ }
      if (drag.moved && self.visible) {
        self.userPos = { left: parseFloat(el.style.left) || 0, top: parseFloat(el.style.top) || 0 };
      }
      drag = null;
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  ui.NotePopover = NotePopover;

