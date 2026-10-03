/**
 * Web Highlighter — shared highlight orchestrator (content script and programmatic embedders)
 *
 * This module keeps the shared logic in one place (SRP/DRY):
 *   - creating highlights from selected text (toolbar / programmatic)
 *   - restoring highlights with three layers (XPath → exact text → fuzzy) + anchor self-healing
 *   - note popover, color change, delete, copy
 *   - text-selection/click/Escape events
 *
 * DIP: no platform dependency (chrome.*) here; everything is injected via cfg:
 * (module imports: text/dom/util/clipboard/ui/anchor — store is injected (cfg.store) — no HL.store slot anymore)
 * Since v1.2.9 the record set is encapsulated behind count/has/get/each +
 * adoptRecord/forgetRecord/resetRecords (was: the raw recs Map leaked to callers).
 *   cfg.page      { url, norm, site, host, title? }  — page context (title optional)
 *   cfg.scope     root element (document.body or any scoped container)
 *   cfg.eventRoot event root (document or the same scope)
 *   cfg.store     an HL.createStore instance (required — composition root injects)
 *   cfg.hooks     optional hooks:
 *     canShowToolbar() → bool    (content: settings/site disabled; default: always true)
 *     defaultColor()   → key     (content: user setting; default: 'yellow')
 *     toast(msg)                 (show a message; defaults to onError)
 *     onError(msg)               (errors; silent by default)
 *     onCount(n)                 (after any change that moves the count — badge)
 *     onSaved(rec)               (after each successful save — e.g. a UI status update)
 *     onDeleted(id)              (after delete — e.g. purge from the content orphan queue)
 */
/* Phase 7b-2: explicit ES-module dependencies — the two engines this
   orchestrator delegates to (index + resolution), imported by identity so
   there is exactly one textindex/anchor instance per world. */
import { text as textIndex } from "./textindex.js"; /* alias: selectionCtx has a local `text` string */
import { anchor } from "./anchor.js";
import { dom } from "./domwrap.js"; /* Phase 7b-3: the DOM engine — 16 HL.dom reads collapse to this binding */
/* 7c-1: shared-file wave — util/clipboard/ui bindings (store via cfg injection) */
import { util } from "./utils.js";
import { clipboard } from "./clipboard.js";
import { ui } from "./ui/base.js";
(function () {
  'use strict';
  var HL = (globalThis.HL = globalThis.HL || {});

  function createHighlighter(cfg) {
    cfg = cfg || {};
    var page = cfg.page || { url: '', norm: '', site: '', host: '' };
    var scope = cfg.scope || document.body;
    var eventRoot = cfg.eventRoot || document;
    var store = cfg.store; /* injected by the composition root — no namespace lookup */
    if (!store) throw new Error('HL.createHighlighter: store تزریق نشده است (cfg.store).');

    var hooks = cfg.hooks || {};
    var onError = hooks.onError || function () { /* silent */ };
    var toast = hooks.toast || onError;

    var state = {
      recs: new Map(),   /* id → record */
      ti: null,          /* text index of the scope (stale after every wrap) */
      saveFailed: false
    };

    /* ---------- Text index ---------- */

    function freshIndex() {
      state.ti = textIndex.build(scope);
      return state.ti;
    }

    function inScope(node) {
      try { return scope.contains(node); } catch (e) { return false; }
    }

    /* Does this record have a non-empty note? (underline marker) */
    function hasNote(rec) {
      return !!(rec && rec.note && String(rec.note).trim());
    }

    function titleOf() {
      if (page.title) return String(page.title).slice(0, 300);
      return ((typeof document !== 'undefined' && document.title) || '').slice(0, 300);
    }

    /* ---------- Anchor self-healing (batched saving of updates) ---------- */

    var healQueue = new Map();
    var flushHeal = util.debounce(function () {
      var arr = Array.from(healQueue.values());
      healQueue.clear();
      if (arr.length) {
        store.saveMany(arr).then(function () {
          if (hooks.onSaved) hooks.onSaved(null);
        }).catch(function () { /* a failed self-heal is fine; retried next time */ });
      }
    }, 900);
    function queueHealSave(rec) {
      healQueue.set(rec.id, rec);
      flushHeal();
    }

    /* ---------- Applying a record to the DOM ---------- */

    /* A record counts as applied only when VISIBLE marks exist: sites
       duplicate content (pre-hydration fallbacks, SEO/mobile copies) and
       hide one copy later — marks in the hidden copy are invisible and
       unclickable. Hidden marks are kept, never unwrapped here (they are
       correct again if the site re-shows that copy). */
    function hasVisibleMarks(id) {
      var ms = dom.marksOf(id).filter(inScope);
      for (var i = 0; i < ms.length; i++) if (!dom.isHidden(ms[i])) return true;
      return false;
    }

    function applyRecord(rec) {
      if (hasVisibleMarks(rec.id)) return true; /* already applied where the user can see it */

      /* Fast path: XPath — but skip it when it lands in a hidden duplicate */
      var range = anchor.resolveStructural(rec);
      var located = null;

      /* Textual path (fallback) — the index must be fresh because the previous wrap split nodes */
      if (!range) {
        if (!state.ti) freshIndex();
        located = anchor.resolve(state.ti, rec);
        range = located && located.range;
      }
      if (!range) return false;
      if (!inScope(range.startContainer) || !inScope(range.endContainer)) return false;

      /* re-entry guard: this occurrence is already wrapped by us (hidden) —
         never nest a second mark inside it */
      var sEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
      if (sEl && sEl.closest && sEl.closest('mark[data-hl-id="' + rec.id + '"]')) return false;

      var marks = dom.markRange(range, rec.id, rec.color);
      if (!marks.length) return false;
      dom.setNoted(rec.id, hasNote(rec)); /* underline = note marker */
      state.ti = null; /* text structure changed; the index must be rebuilt */

      if (located) {
        /* self-heal: store the new anchor and exact offsets */
        rec.anchor = dom.serializeRange(range);
        rec.start = located.start;
        rec.end = located.end;
        queueHealSave(rec);
      }
      for (var i = 0; i < marks.length; i++) if (!dom.isHidden(marks[i])) return true;
      return false; /* wrapped only into a hidden copy — reconcile will retry */
    }

    function applyAll() {
      var arr = Array.from(state.recs.values()).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      freshIndex();
      var ok = 0;
      for (var i = 0; i < arr.length; i++) {
        if (applyRecord(arr[i])) ok++;
      }
      return ok;
    }

    /* Re-apply every record whose marks vanished (SPA route swap, React
       re-render/remount) and refresh the ones that never landed. Pure
       reconciliation — no bookkeeping beyond the DOM: returns the records
       STILL missing (empty array = healthy) so the orchestrator can own
       its orphan queue. */
    function reconcile() {
      var missing = [];
      state.recs.forEach(function (rec) {
        if (!hasVisibleMarks(rec.id)) missing.push(rec); /* no marks, or only hidden ones */
      });
      if (!missing.length) return missing;
      freshIndex();
      for (var i = 0; i < missing.length; i++) {
        if (applyRecord(missing[i])) missing.splice(i--, 1);
      }
      return missing;
    }

    /* Client-side (SPA) navigation: re-key the page context in place —
       cfg.page's object identity is preserved (hl.page === the injected
       object), so every consumer reading page.* sees the new URL. */
    function setPage(next) {
      if (!next) return page;
      page.url = next.url || '';
      page.norm = next.norm || '';
      page.site = next.site || '';
      page.host = next.host || '';
      if ('title' in next) page.title = next.title;
      return page;
    }

    /* ---------- Counting ---------- */

    function onCount() {
      if (hooks.onCount) hooks.onCount(state.recs.size);
    }

    /* ---------- Copy (single implementation in HL.clipboard — the toast is our responsibility here) ---------- */

    function copyText(t) {
      if (!t) return;
      clipboard.copyText(t).then(function (ok) {
        if (ok) toast('کپی شد ✓');
      });
    }

    /* ---------- Persistence with hooks ---------- */

    function persistRecord(rec, opts) {
      opts = opts || {};
      store.save(rec).then(function () {
        if (opts.count) onCount();
        if (hooks.onSaved) hooks.onSaved(rec);
      }).catch(function () {
        if (!state.saveFailed) {
          state.saveFailed = true;
          onError('ذخیره‌سازی با خطا مواجه شد.');
        }
      });
    }

    /* ---------- Leaving selection mode ---------- */

    /* Immediately leave selection mode — right after the highlight action
       (whether it succeeded or not), so the user sees the result instantly
       and doesn't have to click an empty spot. */
    function clearSelection() {
      try {
        var sel = window.getSelection();
        if (sel && sel.rangeCount && !sel.isCollapsed) sel.removeAllRanges();
      } catch (e) { /* noop */ }
    }

    /* ---------- Text-selection context ---------- */

    function selectionCtx() {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      var range = sel.getRangeAt(0);
      if (range.collapsed) return null;
      var text = sel.toString();
      if (!text || !text.trim() || text.length > 30000) return null;

      var sc = range.startContainer, ec = range.endContainer;
      if (!inScope(sc) || !inScope(ec)) return null;

      var inBad = function (n) {
        var el = (n.nodeType === 1) ? n : n.parentElement;
        if (!el || !el.closest) return false;
        return !!(el.closest('[data-hlx-ui]') || el.closest('[contenteditable="true"]'));
      };
      if (inBad(sc) || inBad(ec)) return null;
      /* Normalize element boundaries (double-click on the last word + period → boundary lands on <p>) */
      var clone = range.cloneRange();
      textIndex.normalizeRange(clone);
      return { range: clone, text: text };
    }

    /* ---------- Creating a highlight (user path: toolbar / right-click / shortcut) ---------- */

    function createFromCtx(ctx, color, withNote) {
      if (!ctx || !ctx.range || ctx.range.collapsed) return null;

      var ti = freshIndex();
      var offs = ti.offsetsOfRange(ctx.range);
      if (!offs) { onError('این قسمت از صفحه قابل هایلایت نیست.'); clearSelection(); return null; }

      var id = util.newId();
      var now = Date.now();
      var anchor = dom.serializeRange(ctx.range);
      var marks = dom.markRange(ctx.range, id, color);
      if (!marks.length) { onError('این قسمت از صفحه قابل هایلایت نیست.'); clearSelection(); return null; }
      state.ti = null;

      var rec = {
        id: id,
        host: page.host,
        site: page.site,
        url: page.url,
        urlNorm: page.norm,
        title: titleOf(),
        text: ctx.text,
        prefix: ti.text.slice(Math.max(0, offs.start - 32), offs.start),
        suffix: ti.text.slice(offs.end, offs.end + 32),
        start: offs.start,
        end: offs.end,
        anchor: anchor,
        color: color,
        note: '',
        createdAt: now,
        updatedAt: now
      };

      state.recs.set(id, rec);
      persistRecord(rec, { count: true });

      clearSelection(); /* the new highlight is visible immediately */
      if (withNote) openPopover(id, { editNow: true, mark: marks[0] });
      return rec;
    }

    /* ---------- Creating a highlight (programmatic path: tests/seed) ---------- */

    function createFromRange(range, text, color, note) {
      var ti = freshIndex();
      var offs = ti.offsetsOfRange(range);
      if (!offs) { clearSelection(); return null; }
      var id = util.newId();
      var now = Date.now();
      var rec = {
        id: id,
        host: page.host,
        site: page.site,
        url: page.url,
        urlNorm: page.norm,
        title: titleOf(),
        text: text,
        prefix: ti.text.slice(Math.max(0, offs.start - 32), offs.start),
        suffix: ti.text.slice(offs.end, offs.end + 32),
        start: offs.start,
        end: offs.end,
        anchor: dom.serializeRange(range),
        color: color,
        note: note || '',
        createdAt: now,
        updatedAt: now
      };
      var marks = dom.markRange(range, id, color);
      if (!marks.length) { clearSelection(); return null; }
      if (note && String(note).trim()) dom.setNoted(id, true);
      state.ti = null;
      state.recs.set(id, rec);
      persistRecord(rec, { count: true });
      clearSelection();
      return rec;
    }

    /* ---------- Color / note / delete ---------- */

    function setRecordColor(id, color) {
      var rec = state.recs.get(id);
      if (!rec) return;
      rec.color = color;
      rec.updatedAt = Date.now();
      dom.setColor(id, color);
      persistRecord(rec, {});
    }

    function setRecordNote(id, note) {
      var rec = state.recs.get(id);
      if (!rec) return;
      rec.note = note;
      rec.updatedAt = Date.now();
      dom.setNoted(id, hasNote(rec)); /* add/remove the underline */
      persistRecord(rec, { count: true });
    }

    function removeHighlight(id) {
      var rec = state.recs.get(id);
      dom.unwrap(id);
      state.recs.delete(id);
      if (rec) toast('هایلایت حذف شد.');
      return store.remove(id, page.host).then(function () {
        onCount();
        if (hooks.onDeleted) hooks.onDeleted(id);
        return true;
      }).catch(function () { return false; });
    }

    /* ---------- Toolbar + popover ---------- */

    var popoverOpen = false;
    var popover = new ui.NotePopover({
      onColorChange: function (id, color) { setRecordColor(id, color); },
      onSaveNote: function (id, note) { setRecordNote(id, note); },
      onDelete: function (id) { removeHighlight(id); },
      onCopy: function (id) {
        var rec = state.recs.get(id);
        if (rec) copyText(rec.text + (rec.note ? '\n\n📝 یادداشت: ' + rec.note : ''));
      }
    });
    popover.h.onClose = function () { popoverOpen = false; };

    var toolbar = new ui.FloatingToolbar({
      onColor: function (color, ctx) {
        toolbar.dismiss();
        createFromCtx(ctx, color, false);
      },
      onNote: function (ctx) {
        toolbar.dismiss();
        createFromCtx(ctx, defaultColor(), true);
      },
      onCopy: function (ctx) { copyText(ctx && ctx.text); }
    });

    function defaultColor() {
      return (hooks.defaultColor && hooks.defaultColor()) || 'yellow';
    }

    function openPopover(id, opts) {
      var rec = state.recs.get(id);
      if (!rec) return;
      var marks = dom.marksOf(id).filter(inScope);
      var mark = null;
      for (var i = 0; i < marks.length; i++) { /* anchor to the copy the user sees */
        if (!dom.isHidden(marks[i])) { mark = marks[i]; break; }
      }
      if (!mark) mark = marks[0];
      if (!mark && !(opts && opts.mark)) return;
      toolbar.dismiss();
      popover.present({
        id: id,
        mark: mark || (opts && opts.mark),
        color: rec.color,
        note: rec.note || '',
        quote: rec.text,
        createdAt: rec.createdAt,
        editNow: !!(opts && opts.editNow)
      });
      popoverOpen = true;
    }

    /* ---------- Events (collectable for dispose) ---------- */

    var bound = [];
    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      bound.push([target, type, fn, opts]);
    }

    function maybeShowToolbar() {
      if (hooks.canShowToolbar && !hooks.canShowToolbar()) return;
      if (popoverOpen) return;
      var ctx = selectionCtx();
      if (!ctx) return;
      var r = null;
      try { r = ctx.range.getBoundingClientRect(); } catch (e) { r = null; }
      if (!r || (r.width === 0 && r.height === 0)) return;
      toolbar.present(ctx);
    }

    var onSelEnd = util.debounce(maybeShowToolbar, 180);

    on(eventRoot, 'mouseup', function (e) {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('mark.hlx-marker')) return; /* click on a highlight */
      setTimeout(onSelEnd, 30);
    }, true);

    on(document, 'selectionchange', util.debounce(function () {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        if (!popoverOpen) toolbar.dismiss();
      } else {
        onSelEnd();
      }
    }, 220));

    on(eventRoot, 'click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var mark = t.closest('mark.hlx-marker');
      if (!mark || !inScope(mark)) return;
      var id = mark.getAttribute('data-hl-id');
      if (!id || !state.recs.get(id)) return;
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; /* the user is selecting text */
      e.preventDefault();
      e.stopPropagation();
      openPopover(id);
    }, true);

    on(document, 'keydown', function (e) {
      if (e.key === 'Escape') {
        toolbar.dismiss();
        if (popover.mode === 'edit') popover.render('view'); else popover.dismiss();
      }
    }, true);

    function dispose() {
      for (var i = 0; i < bound.length; i++) {
        try {
          bound[i][0].removeEventListener(bound[i][1], bound[i][2], bound[i][3]);
        } catch (e) { /* noop */ }
      }
      bound = [];
      toolbar.dismiss();
      popover.dismiss();
    }

    /* ---------- Public API ---------- */

    return {
      page: page,
      scope: scope,
      toolbar: toolbar,
      popover: popover,
      freshIndex: freshIndex,
      applyRecord: applyRecord,
      applyAll: applyAll,
      reconcile: reconcile,
      setPage: setPage,
      createFromCtx: createFromCtx,
      createFromRange: createFromRange,
      openPopover: openPopover,
      removeHighlight: removeHighlight,
      setRecordColor: setRecordColor,
      setRecordNote: setRecordNote,
      selectionCtx: selectionCtx,
      clearSelection: clearSelection,
      copyText: copyText,
      isPopoverOpen: function () { return popoverOpen; },
      dispose: dispose,

      /* Read-only record views (v1.2.9 — the recs Map is no longer leaked;
         orchestrators go through this facade) */
      count: function () { return state.recs.size; },           /* () → number */
      has: function (id) { return state.recs.has(id); },        /* (id) → bool */
      get: function (id) { return state.recs.get(id) || null; },/* (id) → record|null */
      each: function (fn) { state.recs.forEach(function (v, k) { fn(v, k); }); }, /* fn(rec, id), insertion order */

      /* External storage-sync mutations — for orchestrators (e.g. the content script)
         reacting to storage changes: pure in-memory bookkeeping. No DOM marks,
         no persistence, no hooks, no toasts (that's removeHighlight's job). */
      adoptRecord: function (rec) { if (rec && rec.id) state.recs.set(rec.id, rec); },
      forgetRecord: function (id) { state.recs.delete(id); },
      resetRecords: function () { state.recs.clear(); }
    };
  }

  HL.createHighlighter = createHighlighter;
})();

/* identity export (content imports this factory) */
export const createHighlighter = globalThis.HL.createHighlighter;