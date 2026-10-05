/**
 * Phase 8 Task 4 — the React era's data + action layer: an external store the
 * region roots read via useSyncExternalStore (React-free module, one instance).
 *
 * Owns the SECOND store instance (same DI-at-composition-root pattern as
 * content.js/popup.js/dashboard.js since 7c-4) and follows chrome.storage:
 *
 *   records / favicons / tags  — storage-backed, refreshed on backend change
 *     events (debounced 400ms like the controller's live sync was) and
 *     immediately after this module's own write actions;
 *   settings                   — storage-backed via onSettingsChanged;
 *   filters / collapsedGroups / reversedGroups / collapsedSections /
 *     visibleLimit             — user-owned SESSION view state (formerly the
 *     controller's module state); immutable updates (fresh Sets) so snapshot
 *     identity drives re-renders.
 *
 * Write semantics mirror the controller's setSetting exactly: OPTIMISTIC
 * local update synchronously (rapid successive actions accumulate — reads
 * from the snapshot are never stale against our own in-flight writes),
 * storage write inside the store's write queue, rollback via re-read on
 * failure. The cross-context guarantee level is unchanged (the same pattern
 * the content page + popup + dashboard already exercise against one
 * chrome.storage).
 *
 * The list pipeline itself stays PURE and in the data layer (dash.*): the
 * React list region computes filtered/groups/sections per render from this
 * snapshot — the same functions the controller's renderList called.
 *
 * Side policies moved here from the controller verbatim:
 *   - boot collapse (v1.2.14): the first pass that has groups seeds
 *     collapsedGroups with dash.initialCollapsed — applied once;
 *   - tag selection pruning (syncTagSelection): a selected tag that no longer
 *     exists anywhere is dropped from filters.tags;
 *   - orphan tag sweep (pruneOrphanTags): article tags whose records are all
 *     gone are removed best-effort — never after a failed records read.
 */
import { backends } from "../../extension/shared/backends/chrome-storage.js";
import { createStore } from "../../extension/shared/store.js";
import { dash } from "../../extension/dashboard/dashboard-data.js";
import { tags as tagRules } from "../../extension/shared/tags.js";
import { util } from "../../extension/shared/utils.js";
import { clipboard } from "../../extension/shared/clipboard.js";
import { GOTO_HASH_PREFIX, TAG_MAX_LEN, TAG_MAX_PER_ARTICLE } from "../../extension/shared/constants.js";
import type { HighlightRecord } from "../types/highlight";
import type { Settings, ThemeKey } from "../types/settings";
import { toast } from "./toast";

const store = createStore(backends.chromeStorage());

export interface Filters {
  q: string;
  colors: Set<string>;
  tags: Set<string>;
  notesOnly: boolean;
  sort: string;
}

export interface DashboardData {
  records: HighlightRecord[];
  settings: Settings;
  /** { urlNorm: [tag, …] } — article tags (v1.2.15) */
  tagMap: Record<string, string[]>;
  /** { host: {icon, capturedAt} } — captured favicons (hlx:f:<host>) */
  favicons: Record<string, { icon: string; capturedAt: number }>;
  filters: Filters;
  /** collapsed urlNorm keys (user-owned after the boot policy) */
  collapsedGroups: Set<string>;
  /** v0.4.0: per-card flipped item order */
  reversedGroups: Set<string>;
  /** v0.5.0: collapsed direction sections ('rtl'|'ltr') */
  collapsedSections: Set<string>;
  /** pagination window (50 → +50 per load-more → Infinity after bulk) */
  visibleLimit: number;
}

let state: DashboardData = {
  records: [],
  settings: {} as Settings,
  tagMap: {},
  favicons: {},
  filters: { q: "", colors: new Set(), tags: new Set(), notesOnly: false, sort: "newest" },
  collapsedGroups: new Set(),
  reversedGroups: new Set(),
  collapsedSections: new Set(),
  visibleLimit: 50,
};
const listeners = new Set<() => void>();
let started = false;
let collapseBootDone = false;
let refreshing = false;

function setState(patch: Partial<DashboardData>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** stable snapshot for useSyncExternalStore — identity changes only on write */
export function getData(): DashboardData {
  return state;
}

export function subscribeData(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function mergeFilters(patch: Partial<Filters>, resetLimit: boolean): void {
  const f = state.filters;
  setState({
    filters: { ...f, ...patch },
    visibleLimit: resetLimit ? 50 : state.visibleLimit,
  });
}

async function reloadSettings(): Promise<void> {
  try {
    setState({ settings: (await store.getSettings()) as Settings });
  } catch (e) { /* keep the previous snapshot */ }
}

/** The full data refresh (the controller's reload(false), moved here):
 *  records + favicons + tags, then the derived policies. */
async function refreshAll(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  let recordsOk = true;
  let records: HighlightRecord[] = [];
  let favicons: DashboardData["favicons"] = {};
  let tagMap: DashboardData["tagMap"] = {};
  try {
    const m = await store.getAllRecords();
    records = Array.from(m.values());
  } catch (e) {
    recordsOk = false;
    toast("خواندن داده‌ها ناموفق بود", "error");
  }
  try { favicons = (await store.getFaviconMap()) || {}; } catch (e) { /* degrade to no favicons */ }
  try { tagMap = (await store.getTags()) || {}; } catch (e) { /* degrade to no tags */ }

  /* syncTagSelection (v1.2.15): a selected tag that no longer exists anywhere
     can't stay active — otherwise the list would show a phantom empty state
     with no visible cause. Folded compare (chip display form vs stored form). */
  let filters = state.filters;
  if (filters.tags.size) {
    const known = Object.create(null);
    Object.keys(tagMap).forEach((k) => {
      (tagMap[k] || []).forEach((t) => { known[String(t).toLowerCase()] = true; });
    });
    let changed = false;
    const next = new Set(filters.tags);
    next.forEach((t) => {
      if (!known[String(t).toLowerCase()]) { next.delete(t); changed = true; }
    });
    if (changed) filters = { ...filters, tags: next };
  }

  setState({ records, favicons, tagMap, filters });

  /* boot collapse policy (v1.2.14): the first pass that has groups seeds the
     collapse set — an empty first render leaves the flag unset (same contract
     as the controller's renderList check). */
  if (!collapseBootDone && recordsOk && records.length) {
    const filtered = dash.applyFilters(records, filters, tagMap);
    if (filtered.length) {
      const groups = dash.groupRecords(filtered, filters.sort);
      const seeded = new Set(state.collapsedGroups);
      dash.initialCollapsed(groups).forEach((k: string) => seeded.add(k));
      collapseBootDone = true;
      setState({ collapsedGroups: seeded });
    }
  }

  /* pruneOrphanTags (v1.2.15): article-scoped tags whose records are all gone
     go too — best-effort, fire-and-forget; never after a failed records read. */
  if (recordsOk) {
    dash.orphanTagKeys(tagMap, records).forEach((k: string) => {
      store.removeArticleTags(k).catch(() => { /* best-effort */ });
    });
  }
  refreshing = false;
}

/** Called once from main.tsx before the regions mount. */
export function startData(): void {
  if (started) return;
  started = true;
  void refreshAll();
  void reloadSettings();
  /* live sync: data changes in another tab → refresh with a 400ms debounce
     (the controller's exact policy). Settings ride their own lighter path. */
  store.onRecordsChanged(util.debounce(() => { void refreshAll(); }, 400));
  store.onTagsChanged(util.debounce(() => { void refreshAll(); }, 400));
  store.onSettingsChanged((s) => { setState({ settings: s as Settings }); });
}

/* ---------- actions (optimistic + rollback, see header) ---------- */

export async function setDisabledHosts(list: string[]): Promise<void> {
  const prev = state.settings;
  setState({ settings: { ...prev, disabledHosts: list } });
  try {
    await store.setSettings({ disabledHosts: list });
  } catch (e) {
    await reloadSettings(); /* rollback to the stored truth */
    throw e;
  }
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const prev = state.settings;
  setState({ settings: { ...prev, ...patch } });
  try {
    await store.setSettings(patch);
  } catch (e) {
    await reloadSettings(); /* rollback to the stored truth */
    throw e;
  }
}

/* ---------- list actions (the controller's handlers, verbatim) ---------- */

export function openArticle(g: { url?: string }): void {
  if (!g.url) { toast("آدرس این صفحه ثبت نشده است", "error"); return; }
  try { window.open(g.url, "_blank"); }
  catch (e) { toast("بازکردن صفحه ناموفق بود", "error"); }
}

export function viewRecord(rec: { url?: string; id: string }): void {
  if (!rec.url) { toast("آدرس این هایلایت ثبت نشده است", "error"); return; }
  try { window.open(rec.url + "#" + GOTO_HASH_PREFIX + rec.id, "_blank"); }
  catch (e) { toast("بازکردن صفحه ناموفق بود", "error"); }
}

export function copyText(t: string): void {
  if (!t) { toast("چیزی برای کپی نیست", "info"); return; }
  clipboard.copyText(t).then((ok: boolean) => {
    toast(ok ? "کپی شد ✓" : "کپی ناموفق بود", ok ? "success" : "error");
  });
}

export function deleteRecord(rec: { id: string; host: string }): void {
  store.remove(rec.id, rec.host).then(() => {
    toast("هایلایت حذف شد", "success");
    void refreshAll();
  }).catch(() => {
    toast("حذف ناموفق بود", "error");
  });
}

export function deleteGroup(g: { key: string; host: string }): void {
  store.removeForUrl(g.key, g.host).then(() => {
    /* Tags are article-scoped: deleting the article's highlights takes its tags too */
    store.removeArticleTags(g.key).catch(() => { /* best-effort cleanup */ });
    toast("هایلایت‌های این صفحه حذف شد", "success");
    void refreshAll();
  }).catch(() => {
    toast("حذف ناموفق بود", "error");
  });
}

/** Card collapse toggle — the view's onToggle mirror: state only. */
export function toggleCard(key: string, willCollapse: boolean): void {
  const next = new Set(state.collapsedGroups);
  if (willCollapse) next.add(key);
  else next.delete(key);
  setState({ collapsedGroups: next });
}

/** v0.4.0: flip one card's highlight order. */
export function flipItemOrder(key: string): void {
  const next = new Set(state.reversedGroups);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  setState({ reversedGroups: next });
}

/** v0.5.0: section collapse — record the user's choice. */
export function toggleSection(dir: string, willCollapse: boolean): void {
  const next = new Set(state.collapsedSections);
  if (willCollapse) next.add(dir);
  else next.delete(dir);
  setState({ collapsedSections: next });
}

export function setSearch(q: string): void {
  mergeFilters({ q: String(q || "").trim().toLowerCase() }, true);
}

export function toggleColorFilter(key: string): void {
  const next = new Set(state.filters.colors);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  mergeFilters({ colors: next }, true);
}

export function setNotesOnly(on: boolean): void {
  mergeFilters({ notesOnly: !!on }, true);
}

export function setSort(sort: string): void {
  mergeFilters({ sort: sort || "newest" }, true);
}

export function toggleTagFilter(tag: string): void {
  const next = new Set(state.filters.tags);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  mergeFilters({ tags: next }, true);
}

/** v0.3.0 bulk expand/collapse — both modes also load every unloaded
 *  highlight by lifting visibleLimit to Infinity through the UNTOUCHED
 *  paginate. The action is recomputed fresh from the current state (what the
 *  button says is exactly what this does). */
export function bulkApply(): void {
  const s = state;
  const filtered = dash.applyFilters(s.records, s.filters, s.tagMap);
  const groups = dash.applyItemReversal(dash.groupRecords(filtered, s.filters.sort), s.reversedGroups);
  const action = dash.bulkAction(groups, s.collapsedGroups);
  if (action !== "expand" && action !== "collapse") return;
  let collapsedGroups: Set<string>;
  if (action === "expand") collapsedGroups = new Set();
  else {
    collapsedGroups = new Set(s.collapsedGroups);
    groups.forEach((g: { key: string }) => collapsedGroups.add(g.key));
  }
  setState({ collapsedGroups, visibleLimit: Infinity });
}

export function loadMore(): void {
  setState({ visibleLimit: state.visibleLimit + 50 });
}

/* ---------- article tags (v1.2.15) — validation + persistence ---------- */

export function addTag(key: string, rawTag: string): void {
  const tag = tagRules.sanitizeTag(rawTag);
  if (!tag) { toast("نام برچسب معتبر نیست (حداکثر " + dash.faNum(TAG_MAX_LEN) + " نویسه)", "error"); return; }
  const cur = state.tagMap[key] || [];
  if (tagRules.hasTag(cur, tag)) { toast("این برچسب روی این مقاله هست", "info"); return; }
  if (cur.length >= TAG_MAX_PER_ARTICLE) { toast("حداکثر " + dash.faNum(TAG_MAX_PER_ARTICLE) + " برچسب برای هر مقاله", "error"); return; }
  store.setArticleTags(key, cur.concat([tag])).then(() => {
    toast("برچسب «" + tag + "» اضافه شد", "success");
    void refreshAll();
  }).catch(() => {
    toast("ذخیره‌ی برچسب ناموفق بود", "error");
  });
}

export function removeTag(key: string, tag: string): void {
  const next = (state.tagMap[key] || []).filter((t) => t !== tag);
  store.setArticleTags(key, next).then(() => {
    toast("برچسب حذف شد", "success");
    void refreshAll();
  }).catch(() => {
    toast("حذف برچسب ناموفق بود", "error");
  });
}

export type { ThemeKey };
