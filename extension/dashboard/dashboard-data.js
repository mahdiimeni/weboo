/**
 * Web Highlighter — dashboard data layer (pure functions, no DOM, no storage)
 *
 * SRP: filtering/grouping/stats/domain validation are split out here so they
 * are testable without a browser and the controller stays "orchestration" only.
 * Display formats come from the shared core (HL.format) and are exposed through
 * this facade — the popup consumes the same HL.format (no parallel local copies).
 * Color registry: shared/constants.js.
 * Article tags (v1.2.15): tag domain rules live in shared/tags.js (HL.tags —
 * single source with the storage layer); this layer adds the dashboard's pure
 * integrations: the tag filter dimension of applyFilters, the article-key
 * formula (articleKey) and orphan detection (orphanTagKeys).
 * Direction-separated article sections (v0.2.0): leadDir + splitDirSections —
 * the pure "which direction's section renders first" policy (the direction of
 * the most-recently-highlighted article) and the order-preserving partition
 * of the visible page entries into per-direction sections.
 * Bulk expand/collapse (v0.3.0): bulkAction — the pure "which way the list-
 * level button flips" decision (expand while any card is collapsed, collapse
 * once they are all open). The "load every unloaded highlight" part of the
 * feature needs no data-layer code: the controller passes Infinity through
 * the UNTOUCHED paginate and every remaining/overflow becomes 0.
 * Selective backup: backupSelectionOptions — the pure picker inventory
 * (sites / articles / tags with counts) the export modal renders; the
 * MATCHING rule itself lives in the store (matchesBackupSelection) — this
 * layer only derives rows that carry the exact comparable values.
 * Booklet selection (Task 88): articleOptions — the ONE derivation of the
 * picker rows both selection modals render (backup + booklet; DRY, the same
 * one-definition discipline as byPage/readingOrderItems) — and
 * filterGroupsByKeys, the booklet's pure "which articles the print carries"
 * rule (empty selection = ALL articles, one home).
 * Per-card item order (v0.4.0): applyItemReversal + itemOrder — the pure
 * transform that reverses ONE article's highlight list (a shallow copy, the
 * base sort's own arrays are never touched) and the pure base+flag →
 * presentation-key mapping the card's order button labels itself with.
 * Dependencies (script order): shared/constants.js, shared/format.js,
 * shared/detect-dir.js (direction policy since v1.2.7 — single source for dashboard + popup),
 * shared/tags.js (tag domain since v1.2.15)
 *
 * Boot collapse policy (v1.2.14): initialCollapsed — on a fresh dashboard tab
 * only the most-recently-highlighted article's card starts expanded.
 */
import { format } from "../shared/format.js";
import { detectDir } from "../shared/detect-dir.js";
import { tags } from "../shared/tags.js"; /* 7c-3 */
  var fmt = format;

  /* ---------- Domain validation for «سایت‌های غیرفعال» (disabled sites) ---------- */

  /** Clean host output, or null */
  function sanitizeHost(raw) {
    var h = String(raw || '').trim().toLowerCase();
    if (!h) return null;
    h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');           /* strip scheme */
    h = h.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
    h = h.replace(/\s+/g, '');
    if (!h) return null;
    if (h === 'localhost') return 'localhost';
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h;          /* IP */
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h)) return h;
    return null;
  }

  /* ---------- Article identity (the group key formula — single home) ---------- */

  /** The key an article (dashboard card) is grouped/stored under. Used by
      groupRecords, the tag filter dimension and orphan detection — one
      formula, one definition (v1.2.15). */
  function articleKey(r) {
    return r.urlNorm || r.url || r.id;
  }

  /* ---------- Article language direction detection (smart card — v1.2.6) ---------- */

  /* The detection core (detectTextDir) and the signal-combination policy (contentDir)
     have lived in shared/detect-dir.js since v1.2.7 so the popup consumes the same
     single source (an article's direction stays identical across all views);
     here groupDir only feeds the group's highlight texts into that policy, and the
     dash.detectTextDir is the single decision source for current consumers
     (LSP — same contract, same behavior). */
  function groupDir(g) {
    var items = g.items || [];
    var texts = [];
    for (var i = 0; i < items.length; i++) texts.push(items[i].text || '');
    return detectDir.contentDir(g.title || '', texts);
  }

  /* ---------- Filter ---------- */

  /**
   * filters: { q: lowercased string, colors: Set<string>, notesOnly: bool,
   *            tags: Set<string> }   ← v1.2.15: active tag filters
   * tagMap (optional, v1.2.15): { urlNorm: [tags] } — the persisted article
   * tags. With tags selected, a record passes only when its ARTICLE carries
   * any of them (union semantics, mirroring the color chips: colors select
   * highlights, tags select articles). Callers without a tagMap (older tests
   * and contexts) keep the exact previous behavior.
   */
  function applyFilters(list, filters, tagMap) {
    var q = filters.q;
    var colors = filters.colors;
    var activeTags = filters.tags;
    var tmap = tagMap || {};
    var tagFilterOn = !!(activeTags && activeTags.size);
    return list.filter(function (r) {
      if (filters.notesOnly && !r.note) return false;
      if (colors.size && !colors.has(r.color)) return false;
      if (tagFilterOn && !tags.hasActiveTag(tmap[articleKey(r)], activeTags)) return false;
      if (q) {
        var hay = ((r.text || '') + '\n' + (r.note || '') + '\n' + (r.title || '') +
          '\n' + (r.host || '') + '\n' + (r.url || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* ---------- Grouping ---------- */

  /** Reading-order comparator (offset in the page, createdAt as the tiebreak) —
      ONE definition (DRY): groupRecords' 'page' sort and the export documents'
      presentation order (readingOrderItems, v0.6.0) share it. */
  function byPage(a, b) {
    return ((a.start || 0) - (b.start || 0)) || ((a.createdAt || 0) - (b.createdAt || 0));
  }

  function groupRecords(list, sort) {
    var map = new Map();
    list.forEach(function (r) {
      var key = articleKey(r);
      if (!map.has(key)) {
        map.set(key, {
          key: key,
          host: r.host || '',
          title: r.title || '',
          url: r.url || '',
          items: [],
          notes: 0,
          latest: 0,
          earliest: Infinity
        });
      }
      var g = map.get(key);
      g.items.push(r);
      if (r.note) g.notes++;
      g.latest = Math.max(g.latest, r.updatedAt || r.createdAt || 0);
      g.earliest = Math.min(g.earliest, r.createdAt || r.updatedAt || Infinity);
      if (!g.title && r.title) g.title = r.title;
      if (!g.url && r.url) g.url = r.url;
      if (!g.host && r.host) g.host = r.host;
    });
    var groups = Array.from(map.values());
    groups.forEach(function (g) {
      g.dir = groupDir(g); /* display direction of this article's card (v1.2.6) */
      if (sort === 'oldest') {
        g.items.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      } else if (sort === 'page') {
        g.items.sort(byPage);
      } else {
        g.items.sort(function (a, b) {
          return ((b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        });
      }
    });
    if (sort === 'oldest') {
      groups.sort(function (a, b) { return a.earliest - b.earliest; });
    } else if (sort === 'page') {
      groups.sort(function (a, b) {
        return (a.title || a.host).localeCompare(b.title || b.host, 'fa') || a.key.localeCompare(b.key);
      });
    } else {
      groups.sort(function (a, b) { return b.latest - a.latest; });
    }
    return groups;
  }

  /**
   * The most-recently-highlighted article (max `latest`) across the groups,
   * or null when there are none. Strict `>` while scanning → a `latest` tie
   * resolves deterministically to the FIRST group in array order — which
   * under the default 'newest' sort is also the first card shown.
   *
   * ONE definition of "the newest article" (DRY), shared by every policy that
   * needs it: the v1.2.14 boot-collapse policy (initialCollapsed) and the
   * v0.2.0 section-ordering policy (leadDir) — the expanded card and the
   * leading section can never disagree on which article is newest.
   * Pure: never mutates the input.
   */
  function newestGroup(groups) {
    var newest = null;
    (groups || []).forEach(function (g) {
      if (newest === null || (g.latest || 0) > (newest.latest || 0)) newest = g;
    });
    return newest;
  }

  /**
   * Initial collapse state (v1.2.14) — pure boot policy.
   *
   * When the dashboard opens in a new tab, only the card of the article that
   * was most recently highlighted (max `latest` across the groups) starts
   * expanded; every other card starts collapsed. Returns a Set of the group
   * keys that should start collapsed — the same container the controller's
   * `collapsedGroups` uses, so the wiring stays a plain add-all.
   *
   * Edge behavior: no groups (or a single one) → empty Set (the newest is
   * that one, it stays open). A `latest` tie resolves deterministically to
   * the first group in array order (newestGroup's strict-> scan) — which under
   * the default 'newest' sort is also the first card shown. The newest is
   * an intrinsic property (max latest), NOT the first card in the list: with
   * the 'oldest'/'page' sorts the open card may sit anywhere in the list.
   * Pure: never mutates the input groups.
   */
  function initialCollapsed(groups) {
    var list = groups || [];
    var newest = newestGroup(list);
    var set = new Set();
    list.forEach(function (g) {
      if (newest !== null && g.key !== newest.key) set.add(g.key);
    });
    return set;
  }

  /* ---------- Direction-separated article sections (v0.2.0) ---------- */

  /**
   * The direction whose article section renders FIRST: the direction of the
   * article that was most recently highlighted (newestGroup's max `latest` —
   * the exact same "newest article" the boot-collapse policy expands, so the
   * leading section always contains the card that starts open). '' when
   * there are no groups. A missing/ambiguous dir degrades to 'rtl' — the
   * same conservative default the title+texts policy (contentDir) applies.
   * Pure: never mutates the input.
   */
  function leadDir(groups) {
    var g = newestGroup(groups);
    return g ? (g.dir === 'ltr' ? 'ltr' : 'rtl') : '';
  }

  /**
   * Partitions the visible page entries into per-direction sections.
   *
   * entries: dash.paginate's `visible` array ([{ group, remaining }]) — passed
   * through verbatim (same object references, `remaining` intact); the card
   * order inside each section is exactly the incoming order — the sort
   * algorithm is NOT re-run or re-derived here (presentation-only partition
   * over the already-sorted, already-paginated list).
   * lead: dash.leadDir's result ('rtl' | 'ltr' | ''); '' degrades to the
   * RTL-first default (a defensive fallback — with no groups there are no
   * entries to split anyway).
   * Returns [{ dir: 'rtl'|'ltr', entries: [...] }]: the lead direction's
   * section first, the other second; EMPTY sections are dropped (a store with
   * articles of one direction only renders a single section — the exact
   * pre-v0.2.0 list for that direction). Pure: never mutates the input.
   */
  function splitDirSections(entries, lead) {
    var buckets = { rtl: [], ltr: [] };
    (entries || []).forEach(function (v) {
      var d = (v.group && v.group.dir) === 'ltr' ? 'ltr' : 'rtl';
      buckets[d].push(v);
    });
    var order = lead === 'ltr' ? ['ltr', 'rtl'] : ['rtl', 'ltr'];
    var sections = [];
    order.forEach(function (d) {
      if (buckets[d].length) sections.push({ dir: d, entries: buckets[d] });
    });
    return sections;
  }

  /* ---------- Bulk expand/collapse (v0.3.0) ---------- */

  /**
   * The next action of the list-level bulk button — pure decision.
   *
   * groups: ALL currently-filtered groups (the same array the controller
   * feeds paginate/leadDir — the button acts on every article card, and a
   * click loads the whole list anyway, so the decision reads the full list,
   * not just the visible page). collapsed: the controller's collapsedGroups
   * container (any Set-like with has()).
   * Returns 'expand' when at least one group is collapsed (the helpful next
   * step is opening everything), 'collapse' when every card is already open,
   * and '' when there are no groups at all (the button hides — nothing to
   * toggle). This is the classic smart toggle: after boot (newest-only
   * expansion) it reads "expand", after expand-all it flips to "collapse",
   * after collapse-all back to "expand" — mirroring what a click will do,
   * never a stale snapshot (the controller recomputes at click time).
   * A missing container degrades to "everything is open" → 'collapse'.
   * Pure: never mutates the input groups or the container.
   */
  function bulkAction(groups, collapsed) {
    var list = groups || [];
    if (!list.length) return '';
    for (var i = 0; i < list.length; i++) {
      if (collapsed && collapsed.has(list[i].key)) return 'expand';
    }
    return 'collapse';
  }

  /* ---------- Per-card item order (v0.4.0) ---------- */

  /**
   * Reverses the highlight list of exactly the articles the user flipped.
   *
   * groups: dash.groupRecords output — the base sort's decision (newest/oldest/
   * page) is already baked into each g.items array; this transform only turns
   * chosen cards around, so it composes with EVERY base sort (OCP) and never
   * re-derives or duplicates the sort itself (DRY: one sort, one home).
   * reversed: the controller's flippedKeys container (any Set-like with has())
   * — the same ownership pattern as collapsedGroups.
   * A flipped group is returned as a SHALLOW COPY with items reversed
   * (Object.assign copy — the same pattern paginate uses for a straddled
   * group): key/host/title/notes/latest/earliest/dir all ride along, so every
   * other policy over groups (initialCollapsed, leadDir, bulkAction, the count
   * chip) reads identical values. Non-flipped groups pass through BY REFERENCE.
   * A missing container degrades to "nothing is flipped" (identity). Applied
   * BEFORE paginate, the straddle slice + remaining math stays exact for the
   * reversed order too. Pure: never mutates the input groups or the container.
   */
  function applyItemReversal(groups, reversed) {
    return (groups || []).map(function (g) {
      if (!reversed || !reversed.has(g.key)) return g;
      return Object.assign({}, g, { items: g.items.slice().reverse() });
    });
  }

  /**
   * The user-facing order of one article's highlight list — pure mapping.
   *
   * sort: the active base sort ('newest' | 'oldest' | 'page' — the toolbar's
   * #f-sort, the exact same value groupRecords consumed); reversed: whether
   * THIS card was flipped (applyItemReversal's container holds its key).
   * Returns the presentation key the card's order button labels itself with:
   * 'newest' (newest first), 'oldest' (oldest first), 'page' (reading order),
   * 'page-rev' (reversed reading order). An unknown sort degrades to the
   * newest/oldest pair — mirroring groupRecords' own unknown-sort branch, so
   * the label can never disagree with the actual order. The data layer
   * returns the DECISION; the Persian labels live in the view (LSP).
   */
  function itemOrder(sort, reversed) {
    if (sort === 'oldest') return reversed ? 'newest' : 'oldest';
    if (sort === 'page') return reversed ? 'page-rev' : 'page';
    return reversed ? 'oldest' : 'newest';
  }

  /* ---------- Export presentation order (v0.6.0) ---------- */

  /** One article's highlights in reading order — the order BOTH export documents
   *  (Markdown + print booklet) present an article's content in: the highlights
   *  read back as they appeared in the page, reconstructing the source flow.
   *  A non-mutating sort (slice) of the group's items — the group itself is never
   *  touched, so it composes with every base sort the groups arrived under (OCP).
   *  The callers are the controller's export composition (dashboard.js) and the
   *  unit specs; the document builders themselves stay order-agnostic (they
   *  render whatever items array they are given — SRP: builders present, this
   *  layer decides order). */
  function readingOrderItems(g) {
    return ((g && g.items) || []).slice().sort(byPage);
  }

  /* ---------- Orphan tag detection (v1.2.15) ---------- */

  /**
   * Pure sweep: urlNorm keys present in the tag map but not represented by
   * any record (the article's last highlight was deleted item-by-item, or a
   * backup import removed it). Tags are article-scoped — they live and die
   * with the article — so the controller removes exactly these keys.
   * Guard discipline is the caller's: a FAILED records read must never prune
   * (recordsOk flag in the controller).
   */
  function orphanTagKeys(tagMap, records) {
    var keys = Object.keys(tagMap || {});
    if (!keys.length) return [];
    var alive = new Set();
    (records || []).forEach(function (r) { alive.add(articleKey(r)); });
    return keys.filter(function (k) { return !alive.has(k); });
  }

  /* ---------- Stats ---------- */

  function computeStats(records) {
    var notes = 0;
    var pages = new Set();
    var sites = new Set();
    (records || []).forEach(function (r) {
      if (r.note) notes++;
      if (r.urlNorm) pages.add(r.urlNorm);
      if (r.host) sites.add(r.host);
    });
    return { total: (records || []).length, notes: notes, pages: pages.size, sites: sites.size };
  }

  /* ---------- Picker rows + booklet selection (Task 88) ---------- */

  /**
   * The picker rows over ALREADY-GROUPED articles (groupRecords output):
   * { key, host, title, count } — key IS the articleKey formula, count = the
   * article's highlights. The rows carry exactly the comparable values, so
   * whatever a modal previews from them is exactly what a selection produces.
   * Pure: never mutates the input.
   */
  function articleOptionsOf(groups) {
    return (groups || []).map(function (g) {
      return { key: g.key, host: g.host || '', title: g.title || '', count: g.items.length };
    });
  }

  /**
   * One row per article for the selection modals — 'page' sort = title
   * order, a stable list for a picker. ONE derivation, two consumers (DRY):
   * backupSelectionOptions (بک‌آپ انتخابی) and the booklet modal's article
   * picker render the same rows. Pure: never mutates its inputs.
   */
  function articleOptions(records) {
    return articleOptionsOf(groupRecords(records || [], 'page'));
  }

  /**
   * The booklet's article-selection rule — pure, order-preserving filter of
   * export groups by the picker's article keys.
   * EMPTY/absent keys → the groups UNCHANGED: "nothing selected = all
   * articles" is the default-all semantic and lives HERE, in one place, so
   * the modal's default state and the produced document can never disagree.
   * Unknown keys (an article deleted after the picker opened) match nothing
   * and drop out — a fully-stale selection yields [] and the controller
   * guards it. Pure: never mutates the input.
   */
  function filterGroupsByKeys(groups, keys) {
    var list = groups || [];
    if (!keys || !keys.length) return list;
    var has = new Set(keys);
    return list.filter(function (g) { return has.has(g.key); });
  }

  /* ---------- Selective backup — the picker's options ---------- */

  /**
   * The selectable inventory of the «بک‌آپ انتخابی» modal, computed fresh
   * from the snapshot: { sites, articles, tags }.
   *   sites    — [{ host, articles }] one row per site, count = its articles;
   *              busiest site first, ties in Persian locale order.
   *   articles — the shared picker rows (articleOptionsOf over the same
   *              'page' groups — the ONE derivation the booklet picker
   *              renders too).
   *   tags     — reuse of the filter-chip inventory (tagCounts): count =
   *              number of ARTICLES carrying the tag, count desc.
   * The rows carry exactly the values the store's matchesBackupSelection
   * compares (host / articleKey / tag name) — the preview count and the
   * exported file can never disagree. Pure: never mutates its inputs.
   */
  function backupSelectionOptions(records, tagMap) {
    var groups = groupRecords(records || [], 'page');
    var sites = [];
    var tally = Object.create(null);
    groups.forEach(function (g) {
      var h = g.host || '';
      if (!h) return; /* a hostless record matches no selectable site anyway */
      if (!tally[h]) { tally[h] = { host: h, articles: 0 }; sites.push(tally[h]); }
      tally[h].articles++;
    });
    sites.sort(function (a, b) { return (b.articles - a.articles) || a.host.localeCompare(b.host, 'fa'); });
    return { sites: sites, articles: articleOptionsOf(groups), tags: tags.tagCounts(tagMap) };
  }

  /* ---------- Pagination (v1.2.9 — extracted from the controller's renderList) ---------- */

  /**
   * Pure pagination over grouped records: which groups/items are visible
   * under `limit` total items, plus the overflow count for the load-more label.
   * A group that straddles the limit is shallow-copied with its items sliced;
   * `remaining` carries how many of that group fell off. Groups after the
   * cut-off point are skipped whole.
   * Returns { visible: [{ group, remaining }], shown, overflow }.
   */
  function paginate(groups, limit) {
    var total = 0;
    groups.forEach(function (g) { total += g.items.length; });
    var visible = [];
    var shown = 0;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (shown >= limit) break;
      var room = limit - shown;
      if (g.items.length > room) {
        visible.push({ group: Object.assign({}, g, { items: g.items.slice(0, room) }), remaining: g.items.length - room });
        shown += room;
        break;
      }
      visible.push({ group: g, remaining: 0 });
      shown += g.items.length;
    }
    return { visible: visible, shown: shown, overflow: total - shown };
  }

  /* Shared display formats from the core (HL.format) — just delegated
     exported directly. */
  export const dash = {
    faNum: fmt.faNum,
    fmtBytes: fmt.fmtBytes,
    dotColorOf: fmt.dotColorOf,
    faviconLetter: fmt.faviconLetter,
    displayUrl: fmt.displayUrl,
    displayHost: fmt.displayHost,
    sanitizeHost: sanitizeHost,
    articleKey: articleKey,
    detectTextDir: detectDir.detectTextDir, /* delegate to the shared core (v1.2.7) */
    applyFilters: applyFilters,
    groupRecords: groupRecords,
    initialCollapsed: initialCollapsed,
    leadDir: leadDir,
    splitDirSections: splitDirSections,
    bulkAction: bulkAction,
    applyItemReversal: applyItemReversal,
    itemOrder: itemOrder,
    readingOrderItems: readingOrderItems,
    orphanTagKeys: orphanTagKeys,
    computeStats: computeStats,
    backupSelectionOptions: backupSelectionOptions,
    articleOptions: articleOptions,
    filterGroupsByKeys: filterGroupsByKeys,
    paginate: paginate
  };


