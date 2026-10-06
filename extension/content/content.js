/**
 * Web Highlighter — content script (platform shell on every page)
 *
 * After the v1.1.0 refactor, shared logic lives in shared/highlighter.js;
 * this file only holds "extension-specific" concerns:
 *  - dependency composition (composition root): chrome backend + store + orchestrator
 *    (only the modules content needs are loaded — ISP)
 *  - site enable/disable state (disabledHosts) and live sync with storage
 *  - applying the extension UI theme (ui.setTheme) to floating widgets — at boot and live
 *  - retrying orphaned highlights on dynamic pages
 *  - client-side (SPA) navigation: re-keying the page context, swapping and
 *    re-applying records when the URL changes without a reload (Next.js,
 *    React Router, …) and re-applying marks a framework re-render removed
 *  - runtime messages (context menu / shortcut / popup) via the runtime bridge
 *  - jumping straight to a highlight via the #hlx-goto-<id> hash
 *  - reporting the count to the service worker for the badge
 */
/* Phase 7b-3: the composition root declares its engine dependencies as real
   ES-module imports (the orchestrator shrinks from HL.* reads). Shared classic
   files (store/backends/url/ui/util/runtime/MSG) stay on the HL namespace
   until the shared-file wave. */
import { dom } from "../shared/domwrap.js";
import { createHighlighter } from "../shared/highlighter.js";
import { favicon } from "./favicon.js";
/* 7c-1: shared-file wave — the orchestrator's HL.* reads became direct imports.
   store is a local instance injected into the highlighter — no namespace slot. */
import { MSG, GOTO_HASH_PREFIX } from "../shared/constants.js";
import { backends } from "../shared/backends/chrome-storage.js";
import { url } from "../shared/url.js";
import { util } from "../shared/utils.js";
import { createStore } from "../shared/store.js";
import { runtime } from "../shared/runtime-bridge.js";
import { ui } from "../shared/ui/base.js";
(function () {
  'use strict';
  if (window.__hlxContentInit) return;
  window.__hlxContentInit = true;

  var page = url.normalizeUrl(location.href);
  if (!page) return; /* URL can't be normalized (e.g. about:blank) */

  /* ---------- Composition root ---------- */

  const store = createStore(backends.chromeStorage()); /* DI: local instance — no namespace slot */

  var state = {
    settings: null,
    disabled: false,
    started: false,
    faviconDone: false,  /* this page no longer attempts favicon capture */
    orphaned: new Set(),  /* highlights not yet found */
    retryTimer: null,
    retries: 0,
    safetyTimer1: null,   /* post-boot/post-nav visibility re-checks */
    safetyTimer2: null
  };
  var navSeq = 0; /* SPA navigation token — async loaders abort when it moves */

  var hl = createHighlighter({
    page: page,
    scope: document.body,
    eventRoot: document,
    store, /* DI */
    hooks: {
      canShowToolbar: function () {
        return !state.disabled && !!(state.settings && state.settings.showToolbar);
      },
      defaultColor: function () {
        return (state.settings && state.settings.defaultColor) || 'yellow';
      },
      toast: function (m) { ui.Toast.show(m); },
      onError: function (m) { ui.Toast.show(m); },
      onCount: function (n) { reportCount(n); },
      onDeleted: function (id) { state.orphaned.delete(id); },
      /* the site's real favicon — only alongside saving a highlight (no request
         goes out beyond the page's normal behavior; the result stays 100% on-device) */
      onSaved: function () { captureSiteFavicon(); }
    }
  });

  /* ---------- Site's real favicon (one-time capture on first save) ---------- */

  /* Module: content/favicon.js — pick/fetch/validate/store.
     This side keeps only the page policy: disabled page, one attempt per load,
     http(s) pages only. */
  function captureSiteFavicon() {
    if (state.disabled || state.faviconDone || !page.host) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') { state.faviconDone = true; return; }
    favicon.captureSiteFavicon(store, page.host, document, location)
      .then(function () { state.faviconDone = true; }); /* failures too — this page load won't retry */
  }

  /* ---------- Counting and reporting to the SW ---------- */

  function reportCount(n) {
    try {
      var p = runtime.send({ type: MSG.COUNT_REPORT, count: (n == null ? hl.count() : n) });
      if (p && p.catch) p.catch(function () { /* SW is asleep */ });
    } catch (e) { /* noop */ }
  }

  /* ---------- Orphan retry (dynamic pages) ---------- */

  function scheduleOrphanRetry() {
    clearTimeout(state.retryTimer);
    if (!state.orphaned.size || state.disabled) return;
    if (state.retries >= 12) return;
    state.retryTimer = setTimeout(retryOrphans, state.retries === 0 ? 1200 : 3500);
  }

  function retryOrphans() {
    if (state.disabled || !state.orphaned.size) return;
    state.retries++;
    state.orphaned = new Set(hl.reconcile());
    if (state.orphaned.size) scheduleOrphanRetry();
    else state.retries = 0;
  }

  function applyAllRecords() {
    hl.freshIndex();
    state.orphaned.clear();
    hl.each(function (rec) {
      if (!hl.applyRecord(rec)) state.orphaned.add(rec);
    });
    scheduleOrphanRetry();
  }

  /* Load the records of the CURRENT page key and apply them (boot + SPA nav). */
  async function loadPageRecords(seq) {
    var fresh = await store.getForUrl(page.norm, page.host);
    if (seq !== navSeq) return; /* a newer navigation won the race */
    fresh.forEach(function (rec) { hl.adoptRecord(rec); });
    applyAllRecords();
    /* Safety net: frameworks hide/show duplicated content with class flips
       (attribute mutations the observer does not watch) right after
       hydration — re-check visibility once the page has settled. */
    clearTimeout(state.safetyTimer1);
    clearTimeout(state.safetyTimer2);
    state.safetyTimer1 = setTimeout(reconcileOrphans, 3000);
    state.safetyTimer2 = setTimeout(reconcileOrphans, 8000);
  }

  /* ---------- Client-side (SPA) navigation ---------- */

  async function onHrefChange() {
    if (!state.started) return;
    var next = url.normalizeUrl(location.href);
    if (!next) return;
    if (next.norm === page.norm && next.host === page.host) return; /* hash-only change — hashchange handles the jump */
    var seq = ++navSeq;
    var hostChanged = next.host !== page.host;

    hl.setPage(next); /* page object identity preserved — every page.* reader sees the new URL */
    hl.toolbar.dismiss();
    hl.popover.dismiss();
    hl.each(function (rec) { dom.unwrap(rec.id); }); /* the old page's marks go with its DOM */
    hl.resetRecords();
    state.orphaned = new Set();
    state.retries = 0;
    clearTimeout(state.retryTimer);
    if (hostChanged) state.faviconDone = false; /* one favicon attempt per host again */

    state.disabled = !!((state.settings.disabledHosts || []).indexOf(page.host) !== -1);
    if (state.disabled) { reportCount(); return; }
    await loadPageRecords(seq);
    if (seq !== navSeq) return;
    reportCount();
    checkHash();
  }

  /* ---------- Jump to highlight via hash ---------- */

  function gotoHighlight(id, cleanHash) {
    var attempt = 0;
    var tryScroll = function () {
      var marks = dom.marksOf(id);
      var m = null;
      for (var i = 0; i < marks.length; i++) { /* jump to the copy the user sees */
        if (!dom.isHidden(marks[i])) { m = marks[i]; break; }
      }
      if (!m) m = marks[0];
      if (m) {
        try { m.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* noop */ }
        dom.flash(id);
        if (hl.has(id)) setTimeout(function () { hl.openPopover(id); }, 700);
        if (cleanHash) {
          try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* noop */ }
        }
      } else if (attempt++ < 20) {
        setTimeout(tryScroll, 500);
      }
    };
    tryScroll();
  }

  function checkHash() {
    var h = location.hash || '';
    var prefix = '#' + GOTO_HASH_PREFIX;
    if (h.indexOf(prefix) === 0) {
      var id = h.slice(prefix.length);
      if (id) gotoHighlight(id, true);
    }
  }
  window.addEventListener('hashchange', checkHash);

  /* ---------- Runtime messages (via the bridge) ---------- */

  runtime.onMessage(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return false;
    if (msg.type === MSG.HIGHLIGHT_SELECTION) {
      var ctx = state.disabled ? null : hl.selectionCtx();
      if (ctx) hl.createFromCtx(ctx, (state.settings && state.settings.defaultColor) || 'yellow', false);
      sendResponse({ ok: !!ctx });
    } else if (msg.type === MSG.GET_COUNT) {
      sendResponse({ count: hl.count() });
    } else if (msg.type === MSG.GOTO) {
      if (msg.id) gotoHighlight(msg.id, false);
      sendResponse({ ok: true });
    }
    return false;
  });

  /* ---------- Live sync with storage ---------- */

  store.onSettingsChanged(function (s) {
    ui.setTheme(s && s.theme); /* floating widgets get the same extension UI theme */
    var wasDisabled = state.disabled;
    state.settings = s;
    var nowDisabled = !!((s.disabledHosts || []).indexOf(page.host) !== -1);
    if (nowDisabled && !wasDisabled) {
      /* Disabling: hide the highlights from view (data is not deleted) */
      state.disabled = true;
      hl.toolbar.dismiss();
      hl.popover.dismiss();
      hl.each(function (rec) { dom.unwrap(rec.id); });
      state.orphaned.clear();
      reportCount();
    } else if (!nowDisabled && wasDisabled) {
      state.disabled = false;
      applyAllRecords();
      reportCount();
    }
  });

  store.onRecordsChanged(function () { syncFromStorage(); });

  var syncing = false;
  async function syncFromStorage() {
    if (!state.started || state.disabled || syncing) return;
    syncing = true;
    try {
      var seq = navSeq;
      var fresh = await store.getForUrl(page.norm, page.host);
      if (seq !== navSeq) return; /* SPA navigation happened mid-read — that data belongs to the old key */
      /* Removed ones (e.g. from the dashboard) */
      hl.each(function (rec, id) {
        if (!fresh.has(id)) {
          dom.unwrap(id);
          hl.forgetRecord(id);
          state.orphaned.delete(id);
        }
      });
      /* Added/updated ones */
      var arr = Array.from(fresh.values()).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      for (var i = 0; i < arr.length; i++) {
        var rec = arr[i];
        var old = hl.get(rec.id);
        if (!old) {
          hl.adoptRecord(rec);
          if (!hl.applyRecord(rec)) state.orphaned.add(rec);
        } else {
          hl.adoptRecord(rec);
          if (old.color !== rec.color) dom.setColor(rec.id, rec.color);
          var hadNote = !!(old.note && String(old.note).trim());
          var hasNoteNow = !!(rec.note && String(rec.note).trim());
          if (hadNote !== hasNoteNow) dom.setNoted(rec.id, hasNoteNow); /* e.g. a backup import from another tab */
          if ((old.note || '') !== (rec.note || '') && hl.isPopoverOpen() && hl.popover.currentId() === rec.id) {
            hl.popover.updateNote(rec.note);
          }
        }
      }
      reportCount();
    } finally {
      syncing = false;
    }
  }

  /* ---------- MutationObserver for dynamic pages ---------- */

  /* Debounced DOM reconcile: re-apply marks a framework re-render removed
     (React swaps subtrees without any navigation) and refresh the orphan
     queue from what is actually still missing. */
  function reconcileOrphans() {
    if (state.disabled || !state.started) return;
    state.orphaned = new Set(hl.reconcile());
    if (state.orphaned.size) {
      state.retries = Math.min(state.retries, 5); /* a few more retries on every DOM change */
      scheduleOrphanRetry();
    } else {
      clearTimeout(state.retryTimer);
      state.retries = 0;
    }
  }

  function observeDom() {
    if (typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(util.debounce(reconcileOrphans, 800));
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* noop */ }
  }

  /* ---------- Boot ---------- */

  async function boot() {
    if (!document.body) {
      setTimeout(boot, 300);
      return;
    }
    state.settings = await store.getSettings();
    var here = url.normalizeUrl(location.href);
    if (here && (here.norm !== page.norm || here.host !== page.host)) hl.setPage(here); /* navigated while settings loaded */
    state.disabled = !!((state.settings.disabledHosts || []).indexOf(page.host) !== -1);
    ui.setTheme(state.settings.theme); /* widgets render with the right theme from the very start */
    state.started = true;
    url.watchHref(window, function () { onHrefChange(); }, 300); /* SPA route changes from here on */

    if (!state.disabled) {
      await loadPageRecords(navSeq);
      observeDom();
      checkHash();
    }
    reportCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
