/**
 * Web Highlighter — dashboard controller (orchestration + platform layer)
 *
 *   dashboard-data.js   → pure functions (filter/group/stats/paginate)
 *   src/dashboard/*     → the React regions (Phase 8): stats, toolbar, list,
 *                         bulk bar, empty/load-more, settings drawer sections
 *   dashboard.js        → this file: platform flows + modal chrome. Since
 *                         Phase 8 slice 4 it owns NO list state and renders
 *                         NO list DOM — the React regions read the external
 *                         store (src/dashboard/data.ts) and the pure dash.*
 *                         pipeline directly. What remains here:
 *   - the size badge (topbar) and the version label;
 *   - the settings drawer frame (open/close/hash deep-link) and its
 *     cross-context live theme re-apply (HL.applyThemeNow contract);
 *   - the three modals' chrome: restore (import), booklet/markdown export,
 *     and the highlight preview (v0.6.1) — opened by the React list through
 *     previewBridge;
 *   - export/restore/danger flows, which read their data FRESH from the
 *     store at click time (no cached snapshot);
 *   - the Escape-key chain and the boot theme application.
 *
 * The view module (dashboard-view.js) survives only for the modal fill
 * builders + the shared toast until Task 5 retires it.
 */
import { APP_ID, DEFAULT_SETTINGS, SETTINGS_HASH, VERSION } from "../shared/constants.js";
import { backends } from "../shared/backends/chrome-storage.js";
import { util } from "../shared/utils.js";
import { exportTools } from "../shared/export.js";
import { markdown } from "../shared/markdown-export.js";
import { booklet } from "../shared/booklet-export.js";
import { createStore } from "../shared/store.js";
import { runtime } from "../shared/runtime-bridge.js";
import { dash } from "./dashboard-data.js";
import { dashView as view } from "./dashboard-view.js";

(function () {
  'use strict';

  /* ---------- Composition root ---------- */

  const store = createStore(backends.chromeStorage()); /* DI: local instance — no namespace slot */
  var HL = globalThis.HL;

  function $(id) { return document.getElementById(id); }

  const els = {
    ver: $('ver'),
    sizeBadge: $('size-badge'),
    btnExport: $('btn-export'),
    btnImport: $('btn-import'),
    btnBooklet: $('btn-booklet'),
    bookletModal: $('booklet-modal'),
    bookletSummary: $('booklet-summary'),
    mdGo: $('md-go'),
    bkGo: $('bk-go'),
    bkCancel: $('bk-cancel'),
    btnSettings: $('btn-settings'),
    overlay: $('overlay'),
    drawer: $('drawer'),
    drawerClose: $('drawer-close'),
    dangerBtn: $('danger-btn'),
    dangerConfirm: $('danger-confirm'),
    dangerInput: $('danger-input'),
    dangerGo: $('danger-go'),
    dangerCancel: $('danger-cancel'),
    modal: $('modal'),
    modalSummary: $('modal-summary'),
    impCancel: $('imp-cancel'),
    impGo: $('imp-go'),
    hlModal: $('hl-modal'),
    hlCard: $('hl-card'),
    hlTitle: $('hl-title'),
    hlBody: $('hl-body'),
    toasts: $('toasts'),
    fileInput: $('file-input')
  };

  let settings = Object.assign({}, DEFAULT_SETTINGS);
  let pendingBackup = null;

  function toast(msg, type) { view.toast(els.toasts, msg, type); }

  function renderSize() {
    store.getBytesInUse().then(function (b) {
      els.sizeBadge.textContent = dash.fmtBytes(b);
    }).catch(function () { els.sizeBadge.textContent = '—'; });
  }

  /* ---------- Export / restore ---------- */

  els.btnExport.addEventListener('click', async function () {
    try {
      const b = await store.exportData();
      const n = (b.meta && b.meta.count) || 0;
      exportTools.saveBackup(b);
      toast('فایل بک‌آپ با ' + dash.faNum(n) + ' هایلایت دانلود شد', 'success');
    } catch (e) {
      toast('خروجی گرفتن ناموفق بود', 'error');
    }
  });

  els.btnImport.addEventListener('click', function () {
    els.fileInput.value = '';
    try { els.fileInput.click(); } catch (e) { toast('بازکردن فایل ناموفق بود', 'error'); }
  });

  els.fileInput.addEventListener('change', function () {
    const f = els.fileInput.files && els.fileInput.files[0];
    els.fileInput.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = function () { toast('خواندن فایل ناموفق بود', 'error'); };
    reader.onload = function () {
      let data = null;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { data = null; }
      if (!data || data.app !== APP_ID || !data.highlights || typeof data.highlights !== 'object') {
        toast('فایل معتبر نیست', 'error');
        return;
      }
      pendingBackup = data;
      view.fillModalSummary(els.modalSummary, data);
      openModal();
    };
    try { reader.readAsText(f, 'utf-8'); }
    catch (e) { toast('خواندن فایل ناموفق بود', 'error'); }
  });

  function openModal() { els.modal.hidden = false; }
  function closeModal() {
    els.modal.hidden = true;
    pendingBackup = null;
  }

  els.impCancel.addEventListener('click', closeModal);

  /* ---------- Highlight preview modal wiring (v0.6.1) ----------
     v0.6.4 — two ways out, the owner's contract: a click on the backdrop
     OUTSIDE the card (ev.target === the overlay itself — clicks inside the
     card never bubble up as the overlay) and Escape (the chain below).
     Phase 8 slice 4: the React list opens this window through previewBridge
     (the modal chrome stays here until slice 5 ports it). The body is
     rebuilt from scratch on every open, so nothing from the previous
     highlight survives (fillHighlightPreview clears) — and the frame's dir
     is re-filled the same way (fillHighlightDir). */
  function openPreview(rec) {
    view.fillHighlightDir(els.hlCard, rec);
    view.fillHighlightTitle(els.hlTitle, rec);
    view.fillHighlightPreview(els.hlBody, rec);
    els.hlModal.hidden = false;
    try { els.hlCard.focus(); } catch (e) { /* noop */ }
  }
  function closeHlModal() { els.hlModal.hidden = true; }

  els.hlModal.addEventListener('click', function (ev) {
    if (ev.target === els.hlModal) closeHlModal();
  });

  /* ---------- Reading exports: Markdown + print booklet (v0.6.0) ---------- */

  /** The export composition — the FULL library, fresh at click time:
   *  groupRecords('newest') gives the article order (newest first) and each
   *  group's dir (the same contentDir policy the cards render by);
   *  readingOrderItems turns each article's highlights into reading order;
   *  tags ride the groups exactly like they ride them into the cards.
   *  Phase 8 slice 4: reads the store directly (the controller no longer
   *  holds a records/tagMap snapshot). Pure inputs for pure builders. */
  async function exportGroups() {
    const m = await store.getAllRecords();
    const records = Array.from(m.values());
    const tagMap = (await store.getTags()) || {};
    var gs = dash.groupRecords(records, 'newest');
    gs.forEach(function (g) {
      g.items = dash.readingOrderItems(g);
      g.tags = tagMap[g.key] || [];
    });
    return gs;
  }

  /** The checked value of a named radio group — the imp-mode contract */
  function radioValue(name) {
    var checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : '';
  }

  async function openBookletModal() {
    const m = await store.getAllRecords();
    view.fillBookletSummary(els.bookletSummary, dash.computeStats(Array.from(m.values())));
    els.bookletModal.hidden = false;
    try { els.bkCancel.focus(); } catch (e) { /* noop */ }
  }

  function closeBookletModal() { els.bookletModal.hidden = true; }

  els.btnBooklet.addEventListener('click', function () { void openBookletModal(); });
  els.bkCancel.addEventListener('click', closeBookletModal);

  els.mdGo.addEventListener('click', async function () {
    var gs = await exportGroups();
    if (!gs.length) { toast('هایلایتی برای خروجی وجود ندارد', 'error'); return; }
    var total = 0;
    gs.forEach(function (g) { total += g.items.length; });
    try {
      exportTools.downloadText(
        exportTools.markdownFileName(),
        markdown.buildLibraryMarkdown({ groups: gs, exportedAt: Date.now() }),
        'text/markdown'
      );
      toast('فایل Markdown با ' + dash.faNum(total) + ' هایلایت دانلود شد', 'success');
    } catch (e) {
      toast('خروجی Markdown ناموفق بود', 'error');
    }
  });

  els.bkGo.addEventListener('click', async function () {
    var gs = await exportGroups();
    if (!gs.length) { toast('هایلایتی برای خروجی وجود ندارد', 'error'); return; }
    var format = radioValue('bk-format') || 'html';
    var mode = radioValue('bk-color') || 'color';
    var total = 0;
    gs.forEach(function (g) { total += g.items.length; });
    try {
      var html = booklet.buildBookletHtml({ groups: gs, mode: mode, exportedAt: Date.now() });
      if (format === 'pdf') {
        exportTools.printHtml(html);
        toast('پنجره‌ی چاپ باز شد — برای PDF گزینه‌ی «Save as PDF» را انتخاب کن', 'info');
      } else {
        exportTools.downloadText(exportTools.bookletFileName(), html, 'text/html');
        toast('کتابچه HTML با ' + dash.faNum(total) + ' هایلایت دانلود شد', 'success');
      }
    } catch (e) {
      toast('ساخت کتابچه ناموفق بود', 'error');
    }
  });

  els.impGo.addEventListener('click', async function () {
    if (!pendingBackup) return;
    const checked = document.querySelector('input[name="imp-mode"]:checked');
    const mode = checked ? checked.value : 'merge';
    els.impGo.disabled = true;
    try {
      const r = await store.importData(pendingBackup, mode);
      toast(dash.faNum(r.added) + ' مورد اضافه، ' + dash.faNum(r.updated) + ' به‌روزرسانی، ' + dash.faNum(r.skipped) + ' رد شد', 'success');
      closeModal();
      /* the import may rewrite settings (merge keeps, replace overwrites) —
         re-read + re-apply the theme; the list refresh rides the storage
         change events (data.ts's debounced live sync) */
      try {
        settings = await store.getSettings();
        HL.applyThemeNow(settings.theme);
      } catch (e2) { /* theme re-apply is best-effort */ }
    } catch (e) {
      toast('بازیابی ناموفق بود' + (e && e.message ? ': ' + e.message : ''), 'error');
    } finally {
      els.impGo.disabled = false;
    }
  });

  /* ---------- Settings panel (drawer) ---------- */

  function openDrawer() {
    els.drawer.classList.add('open');
    els.overlay.classList.add('show');
    els.drawer.setAttribute('aria-hidden', 'false');
    try { els.drawerClose.focus(); } catch (e) { /* noop */ }
  }
  function closeDrawer() {
    els.drawer.classList.remove('open');
    els.overlay.classList.remove('show');
    els.drawer.setAttribute('aria-hidden', 'true');
    resetDanger();
  }

  els.btnSettings.addEventListener('click', openDrawer);
  els.drawerClose.addEventListener('click', closeDrawer);
  els.overlay.addEventListener('click', closeDrawer);

  /**
   * Settings panel deep-link (#hlx-settings from the popup's gear button) —
   * same pattern as checkHash in content.js (SETTINGS_HASH contract).
   * The hash is cleared after use so a later reload doesn't reopen the drawer.
   */
  function checkSettingsHash() {
    if ((location.hash || '') !== '#' + SETTINGS_HASH) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* noop */ }
    openDrawer();
  }
  window.addEventListener('hashchange', checkSettingsHash);

  /* renderSettingsPanel + setSetting retired (Phase 8 slices 2 + 7): the
     whole settings drawer is React regions now (HostsRegion, ThemeRegion,
     DotsRegion, SwitchesRegion) reading/writing data.ts, which mirrors the
     same optimistic-write + rollback semantics (theme's immediate visual
     effect included). */

  /* ---------- Danger zone (three-step confirmation) ---------- */

  const DANGER_ORIG = els.dangerBtn.textContent;
  let dangerArmed = false;
  let dangerTimer = null;

  function resetDanger() {
    dangerArmed = false;
    clearTimeout(dangerTimer);
    els.dangerBtn.classList.remove('armed');
    els.dangerBtn.textContent = DANGER_ORIG;
    els.dangerBtn.disabled = false;
    els.dangerConfirm.hidden = true;
    els.dangerInput.value = '';
    els.dangerGo.disabled = true;
  }

  els.dangerBtn.addEventListener('click', function () {
    if (!dangerArmed) {
      dangerArmed = true;
      els.dangerBtn.textContent = 'مطمئنی؟';
      els.dangerBtn.classList.add('armed');
      els.dangerConfirm.hidden = false;
      try { els.dangerInput.focus(); } catch (e) { /* noop */ }
      dangerTimer = setTimeout(resetDanger, 15000);
      return;
    }
    /* Next step: the text input (if clicked again, emphasize the input) */
    try { els.dangerInput.focus(); } catch (e) { /* noop */ }
  });

  els.dangerInput.addEventListener('input', function () {
    els.dangerGo.disabled = els.dangerInput.value.trim() !== 'حذف';
  });

  els.dangerInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !els.dangerGo.disabled) {
      e.preventDefault();
      els.dangerGo.click();
    }
  });

  els.dangerGo.addEventListener('click', async function () {
    if (els.dangerInput.value.trim() !== 'حذف') return;
    els.dangerGo.disabled = true;
    try {
      await store.clearAll();
      /* User settings must survive (clearAll wipes every hlx key) */
      await store.setSettings(settings);
      toast('همه‌ی هایلایت‌ها و یادداشت‌ها حذف شد', 'success');
      resetDanger();
    } catch (e) {
      toast('حذف ناموفق بود', 'error');
      els.dangerGo.disabled = false;
    }
  });

  els.dangerCancel.addEventListener('click', resetDanger);

  /* ---------- Escape key ---------- */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!els.hlModal.hidden) { closeHlModal(); return; }
    if (!els.modal.hidden) { closeModal(); return; }
    if (!els.bookletModal.hidden) { closeBookletModal(); return; }
    if (els.drawer.classList.contains('open')) { closeDrawer(); return; }
    if (dangerArmed) resetDanger();
  });

  /* ---------- Bootstrap ---------- */

  function init() {
    try { els.ver.textContent = 'v' + runtime.manifestVersion(); }
    catch (e) { els.ver.textContent = 'v' + (VERSION || ''); }

    /* #hlx-settings deep-link (popup gear button) — after the DOM is ready */
    checkSettingsHash();

    /* boot theme — the controller's remaining settings duty (the React
       regions own every settings WRITE; this is the read that paints first) */
    store.getSettings().then(function (s) {
      settings = s || Object.assign({}, DEFAULT_SETTINGS);
      HL.applyThemeNow(settings.theme);
    }).catch(function () { HL.applyThemeNow('auto'); });

    store.onSettingsChanged(function (s) {
      /* the settings panel re-render is React's now (slices 2+7); the live
         theme re-apply stays: a theme change from another context takes
         effect here immediately */
      settings = s || Object.assign({}, DEFAULT_SETTINGS);
      HL.applyThemeNow(settings.theme);
    });

    /* the size badge rides data changes (the React regions own the list) */
    renderSize();
    store.onRecordsChanged(util.debounce(function () { renderSize(); }, 400));

    /* data.ts (started from main.tsx) owns records/tags/settings loading and
       the live sync — the React regions re-render from its snapshots */
  }

  HL.previewBridge = { open: openPreview };

  init();
})();

/* Phase 8 slice 4: identity tail — the React list opens the preview modal
   (controller chrome) through this bridge until slice 5 ports it. */
export const previewBridge = globalThis.HL.previewBridge;
