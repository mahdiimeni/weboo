/* 7c-3: single module entry — the page's former <script> tags in exact document
   order (theme-boot stays a classic head script: it must run BEFORE any module —
   anti-flash window, asserted by the page-shape tripwire). */
import { DEFAULT_SETTINGS, GOTO_HASH_PREFIX, MSG, SETTINGS_HASH, THEME_KEYS, VERSION } from "../shared/constants.js";
import { backends } from "../shared/backends/chrome-storage.js";
import { url as urlUtil } from "../shared/url.js"; /* aliased: local vars named `url` (tab/dashboard URLs) shadow the binding */
import "../shared/format.js";
import "../shared/detect-dir.js";
import "../shared/domkit.js";
import { exportTools } from "../shared/export.js";
import "../shared/tags.js";
import { createStore } from "../shared/store.js";
import { runtime } from "../shared/runtime-bridge.js";
import { pop } from "./popup-data.js";
import { popView as view } from "./popup-view.js";

/**
 * Web Highlighter — popup controller (platform-specific page)
 *
 * After the v1.2.9 split (SRP/MVC — the same trio the dashboard uses since v1.1.0):
 *   popup-data.js  → pure policy on HL.pop (supported sites, theme validation,
 *                    summary counts, direction decision, list slicing, toggle math)
 *   popup-view.js  → DOM rendering on HL.popView (sections, page card, list
 *                    items, theme button — owns the icon constants)
 *   popup.js       → this file: orchestration — chrome.tabs wrappers, storage
 *                    reads/writes, event wiring, the init flow
 * Dependencies (script order): shared/theme-boot.js (in <head>: anti-flash +
 * the shared HL.applyThemeNow — its single implementation lives there since
 * v1.2.9; this file no longer carries a private copy), shared/constants.js,
 * shared/backends/chrome-storage.js, shared/url.js, shared/format.js,
 * shared/detect-dir.js (smart page-card direction — v1.2.7; scope narrowed in
 * v1.2.8: the Persian list header is always RTL), shared/domkit.js,
 * shared/export.js, shared/store.js, shared/runtime-bridge.js,
 * popup-data.js, popup-view.js, popup.js — no utils/clipboard: the popup
 * doesn't need them (ISP).
 * All text is rendered via textContent only (XSS-safe against web page content).
 * DIP: storage is reached through the injected backend and runtime through the bridge;
 * chrome.tabs (active tab query / opening tabs) is this page's own concern and stays direct.
 * Page content direction (card + highlight items) is decided by
 * HL.pop.directionOf → HL.detectDir (same policy as the dashboard — one
 * article, one direction) and applied by HL.popView.applyCardDirection.
 */
(function () {
  'use strict';

  /* ---------- Composition root ---------- */

  const store = createStore(backends.chromeStorage()); /* DI: local instance — no namespace slot */
  var HL = globalThis.HL;
  /* Module guard — same convention as the rest of the core: HL rides on globalThis
     (in a real page window === globalThis; globalThis also works in unit tests) */
  
    
  /* ---------- DOM references ---------- */

  function $(id) { return document.getElementById(id); }

  const els = {
    ver: $('ver'),
    btnTheme: $('btn-theme'),
    btnSettings: $('btn-settings'),
    secUnsupported: $('sec-unsupported'),
    btnDashUnsupp: $('btn-dash-unsupp'),
    secGeneric: $('sec-generic'),
    gTotal: $('g-total'),
    secPage: $('sec-page'),
    fl: $('fl'),
    pageTitle: $('page-title'),
    pageHost: $('page-host'),
    chipHl: $('chip-hl'),
    chipNote: $('chip-note'),
    secToggle: $('sec-toggle'),
    toggleHost: $('toggle-host'),
    toggle: $('site-toggle'),
    toggleMsg: $('toggle-msg'),
    secList: $('sec-list'),
    listCount: $('list-count'),
    hlList: $('hl-list'),
    secEmpty: $('sec-empty'),
    foot: $('foot'),
    btnDashboard: $('btn-dashboard'),
    btnExport: $('btn-export'),
    toast: $('toast')
  };

  const state = { tab: null, nu: null, settings: null, recs: new Map(), on: true };

  /* ---------- View delegates ---------- */

  function toast(msg, type) { view.toast(els, msg, type); }
  function showApplied() { view.showApplied(els); }
  function setSwitch(on) { state.on = !!on; view.setSwitch(els, state.on); }

  /* ---------- Defensive chrome.* wrappers ---------- */

  function queryTabs(q) {
    return new Promise(function (resolve) {
      try {
        chrome.tabs.query(q, function (t) {
          void chrome.runtime.lastError;
          resolve(t || []);
        });
      } catch (e) { resolve([]); }
    });
  }
  function sendToTab(tabId, msg) {
    return new Promise(function (resolve, reject) {
      try {
        chrome.tabs.sendMessage(tabId, msg, function (resp) {
          const err = (chrome.runtime && chrome.runtime.lastError) || null;
          if (err) reject(new Error(err.message || 'ارسال پیام ناموفق بود'));
          else resolve(resp);
        });
      } catch (e) { reject(e); }
    });
  }
  function createTab(url) {
    return new Promise(function (resolve) {
      try {
        chrome.tabs.create({ url: url }, function (t) {
          void chrome.runtime.lastError;
          resolve(t || null);
        });
      } catch (e) { resolve(null); }
    });
  }
  function openUrl(url) {
    if (!url) return;
    try {
      const w = window.open(url, '_blank');
      if (w) return;
    } catch (e) { /* fallback below */ }
    createTab(url);
  }
  /**
   * Opens the dashboard in a new tab; an optional hash deep-links (e.g. #hlx-settings).
   * Without a hash: previous behavior — just the dashboard page.
   */
  function openDashboard(hash) {
    /* Phase 8: the dashboard is a WXT entrypoint — emitted as dashboard.html
       at the package root (WXT flattens subdir index.html entrypoints). */
    let url = 'dashboard.html';
    try { url = runtime.getURL('dashboard.html'); } catch (e) { /* keep the default value */ }
    createTab(url + (hash || '')).then(function () { window.close(); });
  }

  /* ---------- Theme (auto/light/dark — user's choice) ---------- */

  els.btnTheme.addEventListener('click', async function () {
    var next = THEME_KEYS[(THEME_KEYS.indexOf(pop.validTheme(state.settings)) + 1) % THEME_KEYS.length];
    try {
      state.settings = await store.setSettings({ theme: next });
    } catch (e) {
      toast('ذخیره تنظیمات ناموفق بود', 'error');
      return;
    }
    HL.applyThemeNow(next);
    view.renderThemeBtn(els, pop.validTheme(state.settings));
  });

  /* ---------- Render modes ---------- */

  async function renderGeneric() {
    view.showGeneric(els);
    let n = 0;
    try { n = (await store.getAllRecords()).size; }
    catch (e) { n = 0; }
    view.setGenericTotal(els, n);
  }

  async function renderPage() {
    view.showPage(els);

    const host = state.nu.host || '';
    const hostLabel = host || 'فایل محلی';

    /* Real favicon — dataURL captured from the page itself (hlx:f:<host>);
       without it the first letter stays (fallback) */
    var favIcon = null;
    try { var fm = await store.getFavicon(host); favIcon = (fm && fm.icon) || null; }
    catch (e) { favIcon = null; }
    view.fillPageCard(els, { title: state.tab.title || hostLabel, host: host, favicon: favIcon });

    try { state.settings = await store.getSettings(); }
    catch (e) { state.settings = Object.assign({}, DEFAULT_SETTINGS); }

    const hosts = (state.settings && state.settings.disabledHosts) || [];
    setSwitch(hosts.indexOf(host) === -1);
    els.toggleHost.textContent = hostLabel;

    try { state.recs = await store.getForUrl(state.nu.norm, host); }
    catch (e) { state.recs = new Map(); }
    if (!state.recs) state.recs = new Map();

    view.setChips(els, pop.summarize(state.recs));
    view.applyCardDirection(els, pop.directionOf(state.tab.title || hostLabel, state.recs));

    const items = pop.visibleItems(state.recs, 8);
    view.renderList(els, items, pop.countLabel(items.length, state.recs.size), { onOpen: gotoRec });
  }

  function gotoRec(rec) {
    const hashUrl = String(rec.url || '') + '#' + GOTO_HASH_PREFIX + rec.id;
    const tabId = state.tab ? state.tab.id : null;
    if (tabId == null) { openUrl(hashUrl); window.close(); return; }
    sendToTab(tabId, { type: MSG.GOTO, id: rec.id })
      .then(function () { window.close(); })
      .catch(function () {
        /* page without content script → open the URL with the hash */
        openUrl(hashUrl);
        window.close();
      });
  }

  /* ---------- Site toggle ---------- */

  els.toggle.addEventListener('click', async function () {
    const host = state.nu && state.nu.host;
    if (!host) return;
    const next = !state.on;
    const list = pop.nextDisabledHosts((state.settings && state.settings.disabledHosts) || [], host, next);
    try {
      state.settings = await store.setSettings({ disabledHosts: list });
      setSwitch(next);
      showApplied();
    } catch (e) {
      toast('ذخیره تنظیمات ناموفق بود', 'error');
    }
  });

  /* ---------- Backup export ---------- */

  async function doExport() {
    try {
      const b = await store.exportData();
      exportTools.saveBackup(b);
      toast('فایل بک‌آپ دانلود شد');
    } catch (e) {
      toast('خروجی گرفتن ناموفق بود', 'error');
    }
  }

  /* ---------- Bootstrap ---------- */

  async function init() {
    try { view.setVersion(els, runtime.manifestVersion()); }
    catch (e) { view.setVersion(els, VERSION || ''); }

    /* Theme: applied before any rendering (theme-boot.js's anti-flash has already
       put the forced theme on <html>; here we sync it with the real settings) */
    try { state.settings = await store.getSettings(); }
    catch (e) { state.settings = Object.assign({}, DEFAULT_SETTINGS); }
    HL.applyThemeNow(state.settings.theme);
    view.renderThemeBtn(els, pop.validTheme(state.settings));

    /* Live sync: settings changes (e.g. theme) from another tab's dashboard */
    store.onSettingsChanged(function (s) {
      state.settings = s || Object.assign({}, DEFAULT_SETTINGS);
      HL.applyThemeNow(state.settings.theme);
      view.renderThemeBtn(els, pop.validTheme(state.settings));
      if (state.nu && state.nu.host) {
        var hosts = (state.settings && state.settings.disabledHosts) || [];
        setSwitch(hosts.indexOf(state.nu.host) === -1);
      }
    });

    /* Header gear button: dashboard + opening the settings panel (#hlx-settings contract — consumer: dashboard.js) */
    els.btnSettings.addEventListener('click', function () { openDashboard('#' + SETTINGS_HASH); });
    els.btnDashboard.addEventListener('click', function () { openDashboard(); });
    els.btnDashUnsupp.addEventListener('click', function () { openDashboard(); });
    els.btnExport.addEventListener('click', doExport);

    const tabs = await queryTabs({ active: true, currentWindow: true });
    state.tab = (tabs && tabs[0]) || null;
    const url = state.tab ? state.tab.url : null;

    if (!url) { await renderGeneric(); return; }

    const nu = urlUtil.normalizeUrl(url);
    if (!nu || !pop.isSupportedSite(nu)) { view.showUnsupported(els); return; }

    state.nu = nu;
    await renderPage();
  }

  init();
})();
