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
import { ui } from "../../extension/shared/ui/base.js";
import { createStore } from "../../extension/shared/store.js";
import { dash } from "../../extension/dashboard/dashboard-data.js";
import { tags as tagRules } from "../../extension/shared/tags.js";
import { util } from "../../extension/shared/utils.js";
import { clipboard } from "../../extension/shared/clipboard.js";
import { GOTO_HASH_PREFIX, TAG_MAX_LEN, TAG_MAX_PER_ARTICLE } from "../../extension/shared/constants.js";
import { BACKUP_APP_IDS } from "../../extension/shared/constants.js";
import { exportTools } from "../../extension/shared/export.js";
import { markdown } from "../../extension/shared/markdown-export.js";
import { booklet, BOOKLET_FONTS } from "../../extension/shared/booklet-export.js";
import { matchesBackupSelection } from "../../extension/shared/store.js";
import { t, count, applyDom } from "../../extension/shared/i18n.js";
import type { HighlightRecord } from "../types/highlight";
import type { Settings, ThemeKey, Language } from "../types/settings";
import type { BackupSelection } from "../types/storage";
import type { BookletBuildOptions, BookletFontId } from "../types/booklet";
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
  /** the ACTIVE UI language (v0.14.0) — its snapshot identity drives the
      regions' re-render so every t()/dirOf() read is fresh after a switch */
  lang: Language;
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
  /** the highlight preview window's record (v0.6.1) — session state */
  preview: HighlightRecord | null;
  /** the settings drawer + booklet modal open states — session chrome */
  drawerOpen: boolean;
  bookletOpen: boolean;
  /** the selective backup modal's open state — session chrome */
  backupOpen: boolean;
  /** the validated backup awaiting the restore modal's mode choice */
  stagedBackup: Record<string, unknown> | null;
  /** storage size for the topbar badge (bytes; null until first read) */
  bytesInUse: number | null;
}

let state: DashboardData = {
  records: [],
  settings: {} as Settings,
  lang: "fa",
  tagMap: {},
  favicons: {},
  filters: { q: "", colors: new Set(), tags: new Set(), notesOnly: false, sort: "newest" },
  collapsedGroups: new Set(),
  reversedGroups: new Set(),
  collapsedSections: new Set(),
  preview: null,
  drawerOpen: false,
  bookletOpen: false,
  backupOpen: false,
  stagedBackup: null,
  bytesInUse: null,
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

function mergeFilters(patch: Partial<Filters>): void {
  const f = state.filters;
  setState({ filters: { ...f, ...patch } });
}

/** Theme application goes through the ui module (domkit root application +
 *  Shadow-DOM host sync + the "hlx:theme" mirror — the write side that used
 *  to live on the classic theme-boot script). */
function applyThemeNow(theme: string | undefined): void {
  try { ui.applyThemeNow(theme || "auto"); } catch (e) { /* best-effort */ }
}

/**
 * Language application (v0.14.0) — the page's ONE language write path:
 * ui.applyLangNow sets the translation state + widget hosts + the document
 * root's lang/dir + the "hlx:lang" mirror; then the static shell's
 * data-i18n* markup and <title> follow, and the snapshot's lang identity
 * flips so every subscribed region re-renders with the fresh dictionary.
 * ORDER matters: the global dictionary must move BEFORE applyDom/render.
 */
function applyLanguage(lang: string | undefined): void {
  try { ui.applyLangNow(lang || "fa"); } catch (e) { /* best-effort */ }
  try { applyDom(document); } catch (e) { /* static shell is best-effort */ }
  try { document.title = t("dash.title"); } catch (e) { /* noop */ }
  setState({ lang: ui.getLang() as Language });
}

async function reloadSettings(): Promise<void> {
  try {
    const s = (await store.getSettings()) as Settings;
    setState({ settings: s });
    applyThemeNow(s.theme);
    applyLanguage(s.language);
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
    toast(t("toast.readFail"), "error");
  }
  try { favicons = ((await store.getFaviconMap()) || {}) as DashboardData["favicons"]; } catch (e) { /* degrade to no favicons */ }
  try { tagMap = (await store.getTags()) || {}; } catch (e) { /* degrade to no tags */ }
  let bytesInUse = state.bytesInUse;
  try { bytesInUse = await store.getBytesInUse(); } catch (e) { /* keep the previous badge */ }

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

  setState({ records, favicons, tagMap, filters, bytesInUse });

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
  store.onSettingsChanged((s: Record<string, unknown>) => {
    /* mergeSettings guarantees the full shape (DEFAULT_SETTINGS merged in) —
       the double hop is the contract boundary, not a silent cast */
    const settings = s as unknown as Settings;
    setState({ settings: settings });
    /* the controller's live re-apply contract: a theme change from another
       context (or the replace-mode import) takes effect here immediately */
    applyThemeNow(settings.theme);
    /* v0.14.0 — the language rides the same channel: switching it in one
       tab updates this dashboard (texts, direction, dates) without a reload */
    if (settings.language !== ui.getLang()) applyLanguage(settings.language);
  });
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
  const url = util.safeOpenUrl(g.url);
  if (!url) { toast(t("toast.openPageNoUrl"), "error"); return; }
  try { window.open(url, "_blank"); }
  catch (e) { toast(t("toast.openPageFail"), "error"); }
}

export function viewRecord(rec: { url?: string; id: string }): void {
  const url = util.safeOpenUrl(rec.url);
  if (!url) { toast(t("toast.openHlNoUrl"), "error"); return; }
  try { window.open(url + "#" + GOTO_HASH_PREFIX + rec.id, "_blank"); }
  catch (e) { toast(t("toast.openPageFail"), "error"); }
}

export function copyText(text: string): void {
  if (!text) { toast(t("toast.nothingToCopy"), "info"); return; }
  clipboard.copyText(text).then((ok: boolean) => {
    toast(ok ? t("common.copyOk") : t("common.copyFail"), ok ? "success" : "error");
  });
}

export function deleteRecord(rec: { id: string; host: string }): void {
  store.remove(rec.id, rec.host).then(() => {
    toast(t("toast.deleted"), "success");
    void refreshAll();
  }).catch(() => {
    toast(t("common.deleteFail"), "error");
  });
}

export function deleteGroup(g: { key: string; host: string }): void {
  store.removeForUrl(g.key, g.host).then(() => {
    /* Tags are article-scoped: deleting the article's highlights takes its tags too */
    store.removeArticleTags(g.key).catch(() => { /* best-effort cleanup */ });
    toast(t("toast.groupDeleted"), "success");
    void refreshAll();
  }).catch(() => {
    toast(t("common.deleteFail"), "error");
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
  mergeFilters({ q: String(q || "").trim().toLowerCase() });
}

export function toggleColorFilter(key: string): void {
  const next = new Set(state.filters.colors);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  mergeFilters({ colors: next });
}

export function setNotesOnly(on: boolean): void {
  mergeFilters({ notesOnly: !!on });
}

export function setSort(sort: string): void {
  mergeFilters({ sort: sort || "newest" });
}

export function toggleTagFilter(tag: string): void {
  const next = new Set(state.filters.tags);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  mergeFilters({ tags: next });
}

/** v0.3.0 bulk expand/collapse — the action is recomputed fresh from the
 *  current state (what the button says is exactly what this does). */
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
  setState({ collapsedGroups });
}

/* ---------- preview window (v0.6.1) ---------- */

export function openPreview(rec: HighlightRecord): void {
  setState({ preview: rec });
}

export function closePreview(): void {
  setState({ preview: null });
}

/* ---------- page chrome states (drawer, booklet modal) ---------- */

export function setDrawerOpen(open: boolean): void {
  setState({ drawerOpen: open });
}

export function setBookletOpen(open: boolean): void {
  setState({ bookletOpen: open });
}

/* ---------- topbar export + the restore file flow ---------- */

export async function exportBackup(): Promise<void> {
  try {
    const b = await store.exportData();
    const n = (b.meta && b.meta.count) || 0;
    exportTools.saveBackup(b);
    toast(count("toast.backupOk", n), "success");
  } catch (e) {
    toast(t("toast.exportFail"), "error");
  }
}

/* ---------- selective backup (بک‌آپ انتخابی) ---------- */

export function setBackupOpen(open: boolean): void {
  setState({ backupOpen: open });
}

/** Live preview count for the modal — the SAME rule the store's export
 *  applies (matchesBackupSelection), run over the current snapshot, so the
 *  number the user sees is exactly what the file will contain. */
export function countSelectedBackup(selection: BackupSelection): number {
  return state.records.filter((r) => matchesBackupSelection(r, selection, state.tagMap)).length;
}

export async function exportSelectedBackup(selection: BackupSelection): Promise<void> {
  try {
    const b = await store.exportData(selection);
    const n = (b.meta && b.meta.count) || 0;
    exportTools.saveBackup(b);
    toast(count("toast.partialBackupOk", n), "success");
  } catch (e) {
    toast(t("toast.exportFail"), "error");
  }
}

/** The restore flow's file stage: read + parse + validate, then stage for
 *  the modal (the old fileInput change handler, verbatim toasts). */
export function acceptBackupFile(file: File): void {
  const reader = new FileReader();
  reader.onerror = () => { toast(t("toast.fileReadFail"), "error"); };
  reader.onload = () => {
    let data: Record<string, unknown> | null = null;
    try { data = JSON.parse(String(reader.result)); } catch (e) { data = null; }
    if (!data || typeof data.app !== "string" || !BACKUP_APP_IDS.includes(data.app) || !data.highlights || typeof data.highlights !== "object") {
      toast(t("toast.invalidBackup"), "error");
      return;
    }
    setState({ stagedBackup: data });
  };
  try { reader.readAsText(file, "utf-8"); }
  catch (e) { toast(t("toast.fileReadFail"), "error"); }
}

export function clearStagedBackup(): void {
  setState({ stagedBackup: null });
}

export async function clearAll(): Promise<void> {
  await store.clearAll();
}

/* ---------- backup import (the restore modal's action) ---------- */

export async function importBackup(backup: Record<string, unknown>, mode: string): Promise<void> {
  try {
    const r = await store.importData(backup, mode);
    toast(t("toast.importDone", { a: dash.num(r.added), u: dash.num(r.updated), s: dash.num(r.skipped) }), "success");
    void refreshAll();
  } catch (e) {
    /* the old imp-go contract: the modal stays open, the failure is toasted */
    toast(t("toast.restoreFail") + (e && (e as Error).message ? ": " + (e as Error).message : ""), "error");
    throw e;
  }
}

/* ---------- reading exports (v0.6.0) — fresh at click time ---------- */

async function exportGroups() {
  const m = await store.getAllRecords();
  const records = Array.from(m.values());
  const tagMap: Record<string, string[]> = (await store.getTags()) || {};
  const gs = dash.groupRecords(records, "newest");
  gs.forEach((g: { key: string; items: never; tags?: string[] }) => {
    (g as unknown as { items: unknown[] }).items = dash.readingOrderItems(g);
    g.tags = tagMap[String(g.key)] || []; // tagMap: Record<string, string[]> — String() satisfies the index
  });
  return gs;
}

export async function buildMarkdownExport(): Promise<void> {
  const gs = await exportGroups();
  if (!gs.length) { toast(t("toast.nothingToExport"), "error"); return; }
  let total = 0;
  gs.forEach((g: { items: unknown[] }) => { total += g.items.length; });
  try {
    exportTools.downloadText(
      exportTools.markdownFileName(),
      markdown.buildLibraryMarkdown({ groups: gs, exportedAt: Date.now() }),
      "text/markdown"
    );
    toast(count("toast.mdOk", total), "success");
  } catch (e) {
    toast(t("toast.mdFail"), "error");
  }
}

export async function buildBookletExport(format: string, mode: string, options?: BookletBuildOptions): Promise<void> {
  const all = await exportGroups();
  if (!all.length) { toast(t("toast.nothingToExport"), "error"); return; }
  /* the selection rule's ONE home is the pure layer (empty selection = all) —
     the modal's default state and this filter can never disagree */
  const gs = dash.filterGroupsByKeys(all, (options && options.articles) || []);
  if (!gs.length) { toast(t("toast.noArticlesForBooklet"), "error"); return; }
  let total = 0;
  gs.forEach((g: { items: unknown[] }) => { total += g.items.length; });
  try {
    const html = booklet.buildBookletHtml({ groups: gs, mode: mode, exportedAt: Date.now(), font: options && options.font, customFont: options && options.customFont });
    if (format === "pdf") {
      exportTools.printHtml(html);
      toast(t("toast.printOpened"), "info");
    } else {
      exportTools.downloadText(exportTools.bookletFileName(), html, "text/html");
      toast(count("toast.bookletOk", total), "success");
    }
  } catch (e) {
    toast(t("toast.bookletFail"), "error");
  }
}

/** The booklet font picker's options — straight from the builder's registry
 *  (one source; parity with the BookletFontId union is pinned by
 *  types-contract). Static data, so the modal stays a pure selection surface. */
export function bookletFontOptions(): Array<{ id: BookletFontId; label: string }> {
  const reg = BOOKLET_FONTS as Record<string, { label: string; stack: string }>;
  return Object.keys(reg).map((id) => ({ id: id as BookletFontId, label: reg[id].label }));
}

/* ---------- article tags (v1.2.15) — validation + persistence ---------- */

export function addTag(key: string, rawTag: string): void {
  const tag = tagRules.sanitizeTag(rawTag);
  if (!tag) { toast(t("toast.tagInvalid", { n: dash.num(TAG_MAX_LEN) }), "error"); return; }
  const cur = state.tagMap[key] || [];
  if (tagRules.hasTag(cur, tag)) { toast(t("toast.tagExists"), "info"); return; }
  if (cur.length >= TAG_MAX_PER_ARTICLE) { toast(t("toast.tagCap", { n: dash.num(TAG_MAX_PER_ARTICLE) }), "error"); return; }
  store.setArticleTags(key, cur.concat([tag])).then(() => {
    toast(t("toast.tagAdded", { tag: tag }), "success");
    void refreshAll();
  }).catch(() => {
    toast(t("toast.tagSaveFail"), "error");
  });
}

export function removeTag(key: string, tag: string): void {
  const next = (state.tagMap[key] || []).filter((x) => x !== tag);
  store.setArticleTags(key, next).then(() => {
    toast(t("toast.tagRemoved"), "success");
    void refreshAll();
  }).catch(() => {
    toast(t("toast.tagRemoveFail"), "error");
  });
}

export type { ThemeKey };
