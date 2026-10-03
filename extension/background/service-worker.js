/**
 * Web Highlighter — Service Worker (MV3, module)
 *
 * Responsibilities:
 *  - the "Highlight selection" context-menu item
 *  - the Alt+Shift+H shortcut (commands)
 *  - the counter badge on the icon (per the showBadge setting)
 *
 * Note: shared/*.js are ES modules now (7c-1/7c-2): named imports where the SW
 * consumes a symbol, side-effect imports for constants/tags whose values the
 * composition root and IIFE read via the HL namespace.
 * This SW is the platform layer and chrome.* is "allowed and natural" here (DIP boundary);
 * settings are read from the read-only store slice (createStoreReader — composition root).
 * No heavy state is kept (the SW may sleep between events) —
 * just a light settings cache refreshed by storage events.
 */
import '../shared/constants.js';
import { backends } from '../shared/backends/chrome-storage.js';
import '../shared/tags.js'; /* side-effect: reader/export paths normalize through HL.tags */
import { createStoreReader } from '../shared/store.js';

/* Composition root: the read-only reader (ISP) — the SW never writes;
   utils/format/clipboard/export are not loaded at all for this layer */
globalThis.HL.reader = createStoreReader(backends.chromeStorage());

(function () {
  'use strict';
  const HL = globalThis.HL;
  if (!HL || !HL.MSG || !HL.reader) return;

  const MENU_ID = 'hlx-highlight-selection';
  const BADGE_COLOR = '#b45309';

  /* ---------- Light settings cache ---------- */

  let settingsCache = null;
  let settingsLoading = null;

  function getSettingsCached() {
    if (settingsCache) return Promise.resolve(settingsCache);
    if (settingsLoading) return settingsLoading;
    settingsLoading = HL.reader.getSettings().then(function (s) {
      settingsCache = s;
      settingsLoading = null;
      return s;
    }).catch(function () {
      settingsLoading = null;
      return Object.assign({}, HL.DEFAULT_SETTINGS);
    });
    return settingsLoading;
  }
  function invalidateSettingsCache() { settingsCache = null; }

  /* Cache refresh on storage changes (the SW re-registers on every wake-up) */
  try {
    HL.reader.onSettingsChanged(function () { invalidateSettingsCache(); });
    HL.reader.onRecordsChanged(function () { invalidateSettingsCache(); });
  } catch (e) { /* noop */ }

  /* ---------- Defensive chrome.* wrappers ---------- */

  function settle(promiseLike) {
    /* Silences chrome promises that may reject */
    if (promiseLike && typeof promiseLike.catch === 'function') {
      promiseLike.catch(function () { /* page without content script, or the SW is asleep */ });
    }
  }

  function sendToTab(tabId, msg) {
    return new Promise(function (resolve) {
      let settledFlag = false;
      function done(v) {
        if (settledFlag) return;
        settledFlag = true;
        resolve(v);
      }
      try {
        const p = chrome.tabs.sendMessage(tabId, msg, function (resp) {
          void chrome.runtime.lastError; /* avoid unchecked runtime.lastError */
          done(resp);
        });
        settle(p && p.then ? p.then(done, function () { done(undefined); }) : null);
      } catch (e) {
        done(undefined);
      }
    });
  }

  function setBadge(tabId, text) {
    try {
      if (!chrome.action || !chrome.action.setBadgeText) return;
      const r1 = chrome.action.setBadgeText({ text: text, tabId: tabId });
      settle(r1);
      const r2 = chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId: tabId });
      settle(r2);
    } catch (e) { /* noop */ }
  }

  function updateBadge(tabId, count) {
    getSettingsCached().then(function (s) {
      const show = !!(s && s.showBadge);
      setBadge(tabId, (show && Number(count) > 0) ? String(count) : '');
    }).catch(function () { /* noop */ });
  }

  /* Ask the page's content script for the count; one retry if it wasn't ready yet */
  function requestCount(tabId, isRetry) {
    if (tabId == null) return;
    sendToTab(tabId, { type: HL.MSG.GET_COUNT }).then(function (resp) {
      if (resp && typeof resp.count === 'number') {
        updateBadge(tabId, resp.count);
      } else if (!isRetry) {
        setTimeout(function () { requestCount(tabId, true); }, 1200);
      }
    }).catch(function () { /* page without content script */ });
  }

  /* ---------- Context menu ---------- */

  function ensureContextMenus() {
    try {
      const cb = function () { void chrome.runtime.lastError; /* duplicate id → stay silent */ };
      const p = chrome.contextMenus.create({
        id: MENU_ID,
        title: '✨ هایلایت «%s»',
        contexts: ['selection']
      }, cb);
      settle(p);
    } catch (e) { /* noop */ }
  }

  try {
    chrome.runtime.onInstalled.addListener(function () {
      ensureContextMenus();
    });
  } catch (e) { /* noop */ }

  try {
    chrome.runtime.onStartup.addListener(function () {
      ensureContextMenus();
    });
  } catch (e) { /* noop */ }

  try {
    chrome.contextMenus.onClicked.addListener(function (info, tab) {
      if (!info || info.menuItemId !== MENU_ID) return;
      if (!tab || tab.id == null) return;
      /* the content script only lives in the main frame; the main-frame selection reaches it */
      sendToTab(tab.id, { type: HL.MSG.HIGHLIGHT_SELECTION });
    });
  } catch (e) { /* noop */ }

  /* ---------- Keyboard shortcut (commands) ---------- */

  try {
    chrome.commands.onCommand.addListener(function (command) {
      if (command !== 'highlight-selection') return;
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          void chrome.runtime.lastError;
          const t = tabs && tabs[0];
          if (t && t.id != null) {
            sendToTab(t.id, { type: HL.MSG.HIGHLIGHT_SELECTION });
          }
        });
      } catch (e) { /* noop */ }
    });
  } catch (e) { /* noop */ }

  /* ---------- Runtime messages (COUNT_REPORT from content) ---------- */

  try {
    chrome.runtime.onMessage.addListener(function (msg, sender) {
      try {
        if (!msg || msg.type !== HL.MSG.COUNT_REPORT) return false;
        if (!sender || !sender.tab || sender.tab.id == null) return false;
        updateBadge(sender.tab.id, Number(msg.count) || 0);
      } catch (e) { /* noop */ }
      return false; /* we never respond (the message channel closes) */
    });
  } catch (e) { /* noop */ }

  /* ---------- Tab events ---------- */

  try {
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
      if (changeInfo && changeInfo.status === 'complete') requestCount(tabId, false);
    });
  } catch (e) { /* noop */ }

  try {
    chrome.tabs.onActivated.addListener(function (activeInfo) {
      if (activeInfo && activeInfo.tabId != null) requestCount(activeInfo.tabId, false);
    });
  } catch (e) { /* noop */ }
})();
