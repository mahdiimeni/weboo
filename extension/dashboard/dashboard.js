/* 7c-3: single module entry — the page's former <script> tags in exact document
   order (theme-boot stays a classic head script: it must run BEFORE any module —
   anti-flash window, asserted by the page-shape tripwire). */
import { APP_ID, DEFAULT_SETTINGS, GOTO_HASH_PREFIX, SETTINGS_HASH, TAG_MAX_LEN, TAG_MAX_PER_ARTICLE, VERSION } from "../shared/constants.js";
import { backends } from "../shared/backends/chrome-storage.js";
import { util } from "../shared/utils.js";
import "../shared/format.js";
import "../shared/detect-dir.js";
import "../shared/domkit.js";
import { exportTools } from "../shared/export.js";
import { markdown } from "../shared/markdown-export.js";
import { booklet } from "../shared/booklet-export.js";
import { clipboard } from "../shared/clipboard.js";
import { tags } from "../shared/tags.js";
import { createStore } from "../shared/store.js";
import { runtime } from "../shared/runtime-bridge.js";
import { dash } from "./dashboard-data.js";
import { dashView as view } from "./dashboard-view.js";

/**
 * Web Highlighter — dashboard controller (options page)
 *
 * After the v1.1.0 split (SRP/MVC) and the v1.2.9 trim:
 *   dashboard-data.js → pure functions (filter/group/stats/paginate)
 *   dashboard-view.js → DOM builders (no state/storage) + empty/load-more render
 *   dashboard.js      → this file: orchestration, event wiring, settings,
 *                       import/export, danger zone, live sync
 * Direction sections (v0.2.0): renderList wraps the (unchanged) pipeline —
 * applyFilters → groupRecords → paginate — with dash.leadDir + dash.
 * splitDirSections and one view.buildDirSection per direction: RTL and LTR
 * articles render in their own sections, and the section holding the most
 * recently highlighted article (the same "newest" the boot-collapse policy
 * expands) renders first. The card sort/collapse/pagination logic is exactly
 * the pre-v0.2.0 one — the split is a presentation-only partition on top.
 * Bulk expand/collapse (v0.3.0): one button (#btn-bulk) flips every article
 * card — and BOTH modes load every unloaded highlight by lifting visibleLimit
 * to Infinity through the UNTOUCHED paginate (remaining/overflow become 0
 * everywhere, load-more hides). The decision is the data layer's (dash.
 * bulkAction — recomputed fresh at click time, never a stale snapshot) and
 * the presentation is React's (slice 3, BulkToggle); this controller
 * only owns the two state containers they read/write: collapsedGroups and
 * the module-level `groups` (the same single groupRecords computation
 * renderList already performed — now also readable by the click handler).
 * Per-card item order (v0.4.0): every article card's order pill flips THAT
 * card's highlight list (newest↔oldest under time sorts, reading↔reversed
 * under page sort). The transform is the data layer's (dash.applyItemReversal
 * — pure, applied BEFORE paginate so straddle slices and remaining counts
 * stay exact), the label decision is the data layer's too (dash.itemOrder —
 * base sort + flip flag → presentation key, injected via ui.cardUi.order),
 * and this controller only owns the flip container: reversedGroups — the
 * same ownership pattern as collapsedGroups (user-owned view state, kept for
 * the tab session, never persisted).
 * Collapsible direction sections (v0.5.0): clicking a section's header
 * («راست‌چین‌ها» / «چپ‌چین‌ها» — the v0.6.3 alignment labels) collapses/expands
 * that section — the view flips the DOM locally and this controller only records
 * the user's choice: collapsedSections, a direction-keyed set with the exact
 * collapsedGroups ownership pattern (user-owned view state, kept for the tab
 * session, never persisted — a re-render reads it back, so the choice
 * survives filters, load-more and live-sync reloads). Orthogonal by design
 * to both card collapse (collapsedGroups) and the bulk button (v0.3.0 acts
 * on CARDS; a collapsed section simply hides everything inside it).
 * Article tags (v1.2.15): tag state (tagMap) + the onAddTag/onRemoveTag
 * handlers live here; the row is built by the view, the rules come from
 * HL.tags (shared/tags.js) and the persistence from the injected store (hlx:tags).
 * Lifecycle: delete-group cleans tags eagerly; item-by-item emptying is
 * swept by the orphan pruning on every successful reload (a FAILED records
 * read never prunes — recordsOk guard).
 * The theme apply-now is the shared single implementation in
 * shared/theme-boot.js (HL.applyThemeNow, v1.2.9) — only called here.
 * Reading exports (v0.6.0): the «کتابچه» modal owns Markdown + print-booklet
 * exports. The composition is: records (the FULL library — the dashboard's
 * `groups` state is filtered, exports are library-scale) → dash.groupRecords
 * ('newest') → per-article dash.readingOrderItems + tag enrichment → the pure
 * builders (HL.markdown / HL.booklet) → the delivery module (HL.export:
 * downloadText for .md/.html, printHtml for the PDF path). This controller
 * only orchestrates: which records, which mode/format (read from the modal's
 * radios at click time — the imp-mode contract), and the toasts.
 * Dependencies (script order): theme-boot (in <head>), constants,
 * backends/chrome-storage, utils, format, domkit, export, markdown-export,
 * booklet-export, clipboard, tags, store, runtime-bridge, dashboard-data,
 * dashboard-view, dashboard.js
 */
(function () {
  'use strict';

  /* ---------- Composition root ---------- */

  const store = createStore(backends.chromeStorage()); /* DI: local instance — no namespace slot */
  var HL = globalThis.HL;
      
  function $(id) { return document.getElementById(id); }

  /* ---------- State ---------- */

  let records = [];                                     /* Record[] */
  let groups = [];                                       /* grouped articles — renderList's single groupRecords computation, hoisted so the bulk handler reads the same list (v0.3.0) */
  let favicons = {};                                     /* { host: {icon, capturedAt} } */
  let tagMap = {};                                       /* { urlNorm: [tag, …] } — article tags (v1.2.15) */
  let settings = Object.assign({}, DEFAULT_SETTINGS);
  const filters = { q: '', colors: new Set(), tags: new Set(), notesOnly: false, sort: 'newest' };
  const collapsedGroups = new Set();                    /* collapsed urlNorm keys (user-owned after boot) */
  const reversedGroups = new Set();                     /* v0.4.0: per-card flipped item order (user-owned view state, same pattern as collapsedGroups) */
  const collapsedSections = new Set();                  /* v0.5.0: collapsed direction sections ('rtl'|'ltr' — user-owned view state, same pattern as collapsedGroups) */
  let collapseBootDone = false;                          /* v1.2.14: newest-only boot policy applied? */
  let visibleLimit = 50;
  let pendingBackup = null;

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
    q: $('q'),
    colorChips: $('color-chips'),
    tagFilter: $('tag-filter'),
    tagChips: $('tag-chips'),
    fNotes: $('f-notes'),
    fSort: $('f-sort'),
    groups: $('groups'),
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

  function toast(msg, type) { view.toast(els.toasts, msg, type); }

  /* ---------- Load and overall render ---------- */

  async function reload(hard) {
    let recordsOk = true;
    try {
      const m = await store.getAllRecords();
      records = Array.from(m.values());
    } catch (e) {
      records = [];
      recordsOk = false;
      toast('خواندن داده‌ها ناموفق بود', 'error');
    }
    /* Captured favicons (hlx:f:<host>) — without them the first letter stays */
    try { favicons = await store.getFaviconMap() || {}; }
    catch (e) { favicons = {}; }
    /* Article tags (hlx:tags, v1.2.15) — a read failure degrades to “no tags”, never blocks the list */
    try { tagMap = await store.getTags() || {}; }
    catch (e) { tagMap = {}; }
    if (hard) {
      try { settings = await store.getSettings(); }
      catch (e) { settings = Object.assign({}, DEFAULT_SETTINGS); }
      HL.applyThemeNow(settings.theme);
    }
    syncTagSelection();
    renderSize();
    renderList();
    renderTagFilter();
    pruneOrphanTags(recordsOk);
  }

  /* renderStats retired (Phase 8 slice 1): the stats strip is a React region
     now (entrypoints/dashboard/main.tsx → App → StatsStrip) with its own
     store subscription; dash.computeStats + dash.faNum remain the single
     source — the component calls the same functions. */

  function renderSize() {
    store.getBytesInUse().then(function (b) {
      els.sizeBadge.textContent = dash.fmtBytes(b);
    }).catch(function () { els.sizeBadge.textContent = '—'; });
  }

  /* ---------- List render ---------- */

  /* View handlers — the only bridge between presentation and domain */
  const handlers = {
    onOpen: function (g) {
      if (!g.url) { toast('آدرس این صفحه ثبت نشده است', 'error'); return; }
      try { window.open(g.url, '_blank'); }
      catch (e) { toast('بازکردن صفحه ناموفق بود', 'error'); }
    },
    onDeleteGroup: function (g) {
      store.removeForUrl(g.key, g.host).then(function () {
        /* Tags are article-scoped: deleting the article's highlights takes its tags too */
        store.removeArticleTags(g.key).catch(function () { /* best-effort cleanup */ });
        toast('هایلایت‌های این صفحه حذف شد', 'success');
        reload(false);
      }).catch(function () {
        toast('حذف ناموفق بود', 'error');
      });
    },
    onToggle: function (g, willCollapse) {
      if (willCollapse) collapsedGroups.add(g.key);
      else collapsedGroups.delete(g.key);
    },
    onView: function (rec) {
      if (!rec.url) { toast('آدرس این هایلایت ثبت نشده است', 'error'); return; }
      try { window.open(rec.url + '#' + GOTO_HASH_PREFIX + rec.id, '_blank'); }
      catch (e) { toast('بازکردن صفحه ناموفق بود', 'error'); }
    },
    /* ---------- Highlight preview (v0.6.1) — the full-text window ----------
       The view already truncated the card's excerpt; this opens the floating
       window with the WHOLE text + note (the view's pure fillHighlightPreview
       builds the body; closing lives below with the other modal wiring).
       v0.6.3: the head fill (fillHighlightTitle) rides the same open — the
       article's own title replaces the static caption.
       v0.6.4: the frame fill (fillHighlightDir) rides it too — the window
       itself turns to the record's direction; and with the X button gone
       (the owner's call) the CARD is the focus anchor (tabindex="-1"), so
       focus lands inside the dialog the way it landed on the X before. */
    onPreview: function (rec) {
      view.fillHighlightDir(els.hlCard, rec);
      view.fillHighlightTitle(els.hlTitle, rec);
      view.fillHighlightPreview(els.hlBody, rec);
      els.hlModal.hidden = false;
      try { els.hlCard.focus(); } catch (e) { /* noop */ }
    },
    onCopy: function (rec) {
      copyText(rec.text || '');
    },
    onDelete: function (rec) {
      store.remove(rec.id, rec.host).then(function () {
        toast('هایلایت حذف شد', 'success');
        reload(false);
      }).catch(function () {
        toast('حذف ناموفق بود', 'error');
      });
    },
    /* ---------- Per-card item order (v0.4.0) — the flip ---------- */
    onItemOrder: function (g) {
      if (reversedGroups.has(g.key)) reversedGroups.delete(g.key);
      else reversedGroups.add(g.key);
      renderList();
    },
    /* ---------- Section collapse (v0.5.0) — record the user's choice
       (the view already moved the DOM; no re-render, the onToggle mirror) */
    onSectionToggle: function (dir, willCollapse) {
      if (willCollapse) collapsedSections.add(dir);
      else collapsedSections.delete(dir);
    },
    /* ---------- Article tags (v1.2.15) — validation + persistence ---------- */
    onAddTag: function (g, rawTag) {
      var tag = tags.sanitizeTag(rawTag);
      if (!tag) { toast('نام برچسب معتبر نیست (حداکثر ' + dash.faNum(TAG_MAX_LEN) + ' نویسه)', 'error'); return; }
      var cur = tagMap[g.key] || [];
      if (tags.hasTag(cur, tag)) { toast('این برچسب روی این مقاله هست', 'info'); return; }
      if (cur.length >= TAG_MAX_PER_ARTICLE) { toast('حداکثر ' + dash.faNum(TAG_MAX_PER_ARTICLE) + ' برچسب برای هر مقاله', 'error'); return; }
      store.setArticleTags(g.key, cur.concat([tag])).then(function () {
        toast('برچسب «' + tag + '» اضافه شد', 'success');
        reload(false);
      }).catch(function () {
        toast('ذخیره‌ی برچسب ناموفق بود', 'error');
      });
    },
    onRemoveTag: function (g, tag) {
      var next = (tagMap[g.key] || []).filter(function (t) { return t !== tag; });
      store.setArticleTags(g.key, next).then(function () {
        toast('برچسب حذف شد', 'success');
        reload(false);
      }).catch(function () {
        toast('حذف برچسب ناموفق بود', 'error');
      });
    }
  };

  function renderList() {
    const filtered = dash.applyFilters(records, filters, tagMap);
    els.groups.textContent = '';

    if (!filtered.length) {
      groups = [];
      bulkState = ''; /* no cards → no bulk toggle (v0.3.0) */
      publishBulk();
      setListChrome({ emptyShown: true, emptyHasRecords: records.length > 0, moreShown: false, moreOverflow: 0 });
      return;
    }

    groups = dash.applyItemReversal(dash.groupRecords(filtered, filters.sort), reversedGroups);

    /* Per-card item order (v0.4.0): the reversal rides the SAME groups array
       every downstream consumer reads — applied BEFORE paginate so the
       straddle slice + remaining math stays exact for the flipped order too;
       the shallow copies carry key/latest/dir verbatim, so the boot-collapse
       policy, the section lead, the bulk decision and the count chips read
       identical values whether or not a card is flipped. */

    /* Section collapse (v0.5.0): collapsedSections survives every re-render
       (filters, load-more, live sync) because renderList reads it back on
       each pass — the same persistence-without-storage contract every other
       user-owned view state gives. */

    /* Boot collapse state (v1.2.14): on the first render after the tab opens,
       only the newest article's card (max `latest`) starts expanded — the pure
       policy lives in the data layer (dash.initialCollapsed). Applied once:
       afterwards the set is user-owned (toggles persist across re-renders and
       live storage sync exactly as before); a fresh tab starts the cycle anew.
       An empty first render (empty store) leaves the flag unset, so the policy
       applies at the first render that actually has groups. */
    if (!collapseBootDone) {
      dash.initialCollapsed(groups).forEach(function (k) { collapsedGroups.add(k); });
      collapseBootDone = true;
    }

    groups.forEach(function (g) {
      g.favicon = (favicons[g.host] && favicons[g.host].icon) || null;
      g.tags = tagMap[g.key] || []; /* article tags ride the group into the view (v1.2.15) */
    });
    const page = dash.paginate(groups, visibleLimit);

    /* Direction-separated article sections (v0.2.0) — additive presentation
       layer over the untouched pipeline above. The lead direction comes from
       the FILTERED groups (not just the visible page): which section is on top
       is a property of the data (the most recently highlighted article's
       direction), stable across load-more — the same "newest article" the
       boot-collapse policy expanded, one definition (newestGroup scan inside
       the data layer). splitDirSections partitions paginate's visible
       entries verbatim: same cards, same order, same remaining counts — only
       the wrapping changes. Per-card collapse state stays controller-owned
       (collapsedGroups), injected via ui.cardUi; handlers pass through. */
    const lead = dash.leadDir(groups);
    dash.splitDirSections(page.visible, lead).forEach(function (sec) {
      els.groups.appendChild(view.buildDirSection(sec, {
        lead: sec.dir === lead,
        collapsed: collapsedSections.has(sec.dir),
        cardUi: function (g) {
          return {
            collapsed: collapsedGroups.has(g.key),
            order: dash.itemOrder(filters.sort, reversedGroups.has(g.key))
          };
        }
      }, handlers));
    });
    /* The bulk button presents its NEXT action — dash.bulkAction's fresh
       decision over the filtered groups + the user-owned collapse set.
       Phase 8 slice 3: published to the React region instead of written to
       the DOM. renderLoadMore retired (slice 6): the load-more snapshot rides
       the listChromeBridge below. */
    bulkState = dash.bulkAction(groups, collapsedGroups);
    publishBulk();
    setListChrome({ emptyShown: false, emptyHasRecords: false, moreShown: page.overflow > 0, moreOverflow: page.overflow });
  }

  /* ---------- Copy (single implementation in HL.clipboard — dashboard-specific toast) ---------- */

  function copyText(t) {
    if (!t) { toast('چیزی برای کپی نیست', 'info'); return; }
    clipboard.copyText(t).then(function (ok) {
      toast(ok ? 'کپی شد ✓' : 'کپی ناموفق بود', ok ? 'success' : 'error');
    });
  }

  /* ---------- Article tags (v1.2.15) — filter row, selection sync, orphan sweep ---------- */

  /** A selected tag that no longer exists anywhere can't stay active —
      otherwise the list would show a phantom empty state with no visible
      cause. Folded compare (chip display form vs stored form, ASCII case). */
  function syncTagSelection() {
    if (!filters.tags.size) return;
    var known = Object.create(null);
    Object.keys(tagMap).forEach(function (k) {
      (tagMap[k] || []).forEach(function (t) { known[String(t).toLowerCase()] = true; });
    });
    filters.tags.forEach(function (t) {
      if (!known[String(t).toLowerCase()]) filters.tags.delete(t);
    });
  }

  /** The toolbar's tag filter row — rebuilt on every data refresh (tags are
      dynamic, unlike the static color registry). Hidden when no tags exist. */
  function renderTagFilter() {
    var counts = tags.tagCounts(tagMap);
    els.tagFilter.hidden = counts.length === 0;
    view.buildTagChips(els.tagChips, counts, filters.tags, function () {
      visibleLimit = 50;
      renderList();
    });
  }

  /** Tags are article-scoped: when no record survives for an article its tags
      go too (delete-group cleans eagerly; this sweep catches item-by-item
      emptying). Best-effort and fire-and-forget — the next reload is stable. */
  function pruneOrphanTags(recordsOk) {
    if (!recordsOk) return; /* a failed records read must never wipe tags */
    dash.orphanTagKeys(tagMap, records).forEach(function (k) {
      store.removeArticleTags(k).catch(function () { /* best-effort */ });
    });
  }

  /* ---------- Filter toolbar ---------- */

  function bindToolbar() {
    view.buildColorChips(els.colorChips, filters.colors, function () {
      visibleLimit = 50;
      renderList();
    });

    els.q.addEventListener('input', util.debounce(function () {
      filters.q = els.q.value.trim().toLowerCase();
      visibleLimit = 50;
      renderList();
    }, 250));

    els.fNotes.addEventListener('change', function () {
      filters.notesOnly = !!els.fNotes.checked;
      visibleLimit = 50;
      renderList();
    });

    els.fSort.addEventListener('change', function () {
      filters.sort = els.fSort.value || 'newest';
      visibleLimit = 50;
      renderList();
    });

    /* Bulk expand/collapse (v0.3.0): one click flips every article card — and
       in BOTH modes loads every unloaded highlight. The action is recomputed
       fresh from the same pure decision that rendered the label (what the
       button says is exactly what this handler does); expand clears the whole
       collapse set, collapse fills it with every filtered group's key; and
       visibleLimit lifts to Infinity so the untouched paginate returns the
       complete list — remaining=0 everywhere (no "…N مورد دیگر" placeholders)
       and overflow=0 (load-more hides). A later filter change resets the limit
       to 50 exactly as before. */
  }

  /* ---------- Bulk bar bridge (Phase 8 slice 3) ----------
     The button itself is a React region now (main.tsx → BulkRegion →
     BulkToggle); the authoritative list state stays here until slice 4
     moves the list render into React — then this bridge retires into
     data.ts. apply() keeps the click handler's exact logic. */
  const bulkListeners = new Set();
  let bulkState = ''; /* '' = hidden */
  function publishBulk() {
    bulkListeners.forEach(function (l) { l(); });
  }
  HL.bulkBridge = {
    subscribe: function (cb) {
      bulkListeners.add(cb);
      return function () { bulkListeners.delete(cb); };
    },
    getSnapshot: function () { return bulkState; },
    apply: function () {
      const action = dash.bulkAction(groups, collapsedGroups);
      if (action !== 'expand' && action !== 'collapse') return;
      if (action === 'expand') collapsedGroups.clear();
      else groups.forEach(function (g) { collapsedGroups.add(g.key); });
      visibleLimit = Infinity;
      renderList();
    }
  };

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
     card never bubble up as the overlay) and Escape (the chain below). The
     X button is gone — an outside click is enough (the owner's explicit
     request); Escape stays as the keyboard path, and focus lands on the
     card (#hl-card tabindex="-1") so the dialog keeps the keyboard context.
     The body is rebuilt from scratch on every open, so nothing from the
     previous highlight survives (fillHighlightPreview clears) — and the
     frame's dir is re-filled the same way (fillHighlightDir). */
  function closeHlModal() { els.hlModal.hidden = true; }

  els.hlModal.addEventListener('click', function (ev) {
    if (ev.target === els.hlModal) closeHlModal();
  });
  /* ---------- Reading exports: Markdown + print booklet (v0.6.0) ---------- */

  /** The export composition — the FULL library, fresh at click time:
   *  groupRecords('newest') gives the article order (newest first) and each
   *  group's dir (the same contentDir policy the cards render by);
   *  readingOrderItems turns each article's highlights into reading order
   *  (the data layer's presentation-order decision); tags ride the groups
   *  exactly like they ride them into the cards. Pure inputs for pure builders. */
  function exportGroups() {
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

  function openBookletModal() {
    view.fillBookletSummary(els.bookletSummary, dash.computeStats(records));
    els.bookletModal.hidden = false;
    try { els.bkCancel.focus(); } catch (e) { /* noop */ }
  }

  function closeBookletModal() { els.bookletModal.hidden = true; }

  els.btnBooklet.addEventListener('click', openBookletModal);
  els.bkCancel.addEventListener('click', closeBookletModal);

  els.mdGo.addEventListener('click', function () {
    var gs = exportGroups();
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

  els.bkGo.addEventListener('click', function () {
    var gs = exportGroups();
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
      await reload(true);
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
     effect included). reload(hard) still applies the boot theme. */

  /* Add/remove a disabled site — retired (Phase 8 slice 2): the whole flow
     (sanitize → duplicate check → optimistic write → toasts) lives in the
     React region (HostsRegion → DisabledHosts + data.setDisabledHosts). */

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
      await reload(true);
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

    bindToolbar();

    /* #hlx-settings deep-link (popup gear button) — after the DOM is ready */
    checkSettingsHash();

    /* Live sync: data changes in another tab → re-read with a 400ms debounce.
       Article tags (v1.2.15) sync the same way — hlx:tags changes re-read the
       whole view (records+tags) so cards and the filter row stay consistent. */
    store.onRecordsChanged(util.debounce(function () { reload(false); }, 400));
    store.onTagsChanged(util.debounce(function () { reload(false); }, 400));
    store.onSettingsChanged(function (s) {
      /* settings panel re-render retired (Phase 8 slice 7 — React regions
         subscribe via data.ts); the live theme re-apply stays: a theme
         change from another context takes effect here immediately. */
      settings = s || Object.assign({}, DEFAULT_SETTINGS);
      HL.applyThemeNow(settings.theme);
    });

    reload(true);
  }

  init();
})();

/* Phase 8 slice 3: identity tail — the React region imports the bridge */
export const bulkBridge = globalThis.HL.bulkBridge;

/* ---------- Empty + load-more bridge (Phase 8 slice 6) ----------
   Same transitional pattern as bulkBridge: the controller's renderList is
   still the authority over what the list region shows; the React regions
   read the snapshot and call applyMore(). Retires with slice 4. */
const chromeListeners = new Set();
let chromeState = { emptyShown: false, emptyHasRecords: false, moreShown: false, moreOverflow: 0 };
function setListChrome(next) {
  if (chromeState.emptyShown !== next.emptyShown ||
      chromeState.emptyHasRecords !== next.emptyHasRecords ||
      chromeState.moreShown !== next.moreShown ||
      chromeState.moreOverflow !== next.moreOverflow) {
    chromeState = next;
    chromeListeners.forEach(function (l) { l(); });
  }
}
HL.listChromeBridge = {
  subscribe: function (cb) {
    chromeListeners.add(cb);
    return function () { chromeListeners.delete(cb); };
  },
  getSnapshot: function () { return chromeState; },
  applyMore: function () {
    visibleLimit += 50;
    renderList();
  }
};
export const listChromeBridge = globalThis.HL.listChromeBridge;
