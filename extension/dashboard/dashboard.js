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
 *   - the modal OPEN REQUESTS: the restore flow (drawer button + file
 *     picker + validation) and the booklet trigger open their React modals
 *     through modalBridge (slice 5 — the modals themselves, their radio
 *     groups and their export/import actions are React/data.ts now);
 *   - export/restore/danger flows, which read their data FRESH from the
 *     store at click time (no cached snapshot);
 *   - the Escape-key chain and the boot theme application.
 *
 * The view module (dashboard-view.js) survives only for the shared toast
 * until Task 5 retires it.
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
    btnSettings: $('btn-settings'),
    overlay: $('overlay'),
    drawer: $('drawer'),
    drawerClose: $('drawer-close'),
    dangerBtn: $('danger-btn'),
    dangerConfirm: $('danger-confirm'),
    dangerInput: $('danger-input'),
    dangerGo: $('danger-go'),
    dangerCancel: $('danger-cancel'),
    toasts: $('toasts'),
    fileInput: $('file-input')
  };

  let settings = Object.assign({}, DEFAULT_SETTINGS);

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
      modalBridge.openRestore(data);
    };
    try { reader.readAsText(f, 'utf-8'); }
    catch (e) { toast('خواندن فایل ناموفق بود', 'error'); }
  });

  /* ---------- Modal open requests (Phase 8 slice 5) ----------
     The three modals are React regions now (main.tsx → PreviewModalRegion /
     RestoreModalRegion / BookletModalRegion). The restore modal's DATA flow
     stays here — the drawer's restore button + the file-picker + validation
     are drawer chrome — and the booklet trigger is the topbar button; both
     open their modal through this one-way request channel. The preview
     window needs no bridge at all (the React list opens it through
     data.ts's preview state). The exports' composition + the import write
     live in data.ts; the modals call them directly. */
  const modalListeners = new Set();
  let modalRequest = null;
  function requestModal(r) {
    modalRequest = r;
    modalListeners.forEach(function (l) { l(); });
  }
  HL.modalBridge = {
    subscribe: function (cb) {
      modalListeners.add(cb);
      return function () { modalListeners.delete(cb); };
    },
    getSnapshot: function () { return modalRequest; },
    openRestore: function (backup) { requestModal({ kind: 'restore', backup: backup }); },
    openBooklet: function () { requestModal({ kind: 'booklet' }); }
  };

  els.btnBooklet.addEventListener('click', function () { HL.modalBridge.openBooklet(); });

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
    /* the modals handle their own Escape (slice 5) — this chain is the
       drawer chrome's */
    if (e.key !== 'Escape') return;
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

  init();
})();

/* Phase 8 slice 5: identity tail — the React modals subscribe to the
   controller's open requests (restore/booklet; the preview needs no
   bridge — it is data.ts state). */
export const modalBridge = globalThis.HL.modalBridge;
