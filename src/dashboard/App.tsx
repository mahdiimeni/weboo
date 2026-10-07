/**
 * Phase 8 Task 4 — the React region roots.
 *
 * One region per ported dashboard area; each mounts via createRoot into the
 * static shell's host element (createRoot takes over the host's children —
 * the ownership handoff). Data flows from the external store (data.ts)
 * through useSyncExternalStore; the components themselves are pure
 * presentation under src/dashboard/components/.
 *
 * Slices ported: 1 (stats) · 2 (disabled hosts) · 7 (theme/color/switches) ·
 * 6 (empty/load-more) · 4 (toolbar + the whole list region — since slice 4
 * the list pipeline is computed HERE per render from the data snapshot via
 * the pure dash.* functions, exactly as the controller's renderList did; the
 * controller's renderList, handlers and the slice-3/6 bridges are retired).
 *
 * The only controller callback still consumed is the highlight preview
 * (onPreview → previewBridge.open) — the hl-modal is still controller-owned
 * until slice 5; the bridge then dies with it.
 *
 * Task 5 collapses these roots into a single App when the last region lands
 * and the imperative controller retires.
 */
import { useSyncExternalStore } from "react";
import {
  getData,
  subscribeData,
  setDisabledHosts,
  setSettings,
  openArticle,
  viewRecord,
  copyText,
  deleteRecord,
  deleteGroup,
  openPreview,
  closePreview,
  importBackup,
  buildMarkdownExport,
  buildBookletExport,
  clearStagedBackup,
  setBookletOpen,
  setBackupOpen,
  countSelectedBackup,
  exportSelectedBackup,
  toggleCard,
  flipItemOrder,
  toggleSection,
  addTag,
  removeTag,
  setSearch,
  toggleColorFilter,
  setNotesOnly,
  setSort,
  toggleTagFilter,
  bulkApply,
  loadMore,
} from "./data";
import { toast } from "./toast";
import type { ThemeKey } from "../types/settings";
import type { HighlightColor } from "../types/highlight";

import { dash } from "../../extension/dashboard/dashboard-data.js";
import type { Group, GroupCardHandlers } from "./components/GroupCard";
import { StatsStrip } from "./components/StatsStrip";
import { DisabledHosts } from "./components/DisabledHosts";
import { BulkToggle } from "./components/BulkToggle";
import { EmptyState } from "./components/EmptyState";
import { LoadMore } from "./components/LoadMore";
import { ThemeRadios } from "./components/ThemeRadios";
import { ColorDots } from "./components/ColorDots";
import { BehaviorSwitches } from "./components/BehaviorSwitches";
import { ui } from "../../extension/shared/ui/base.js";
import { Toolbar } from "./components/Toolbar";
import { DirSection } from "./components/DirSection";
import { PreviewModal, RestoreModal, BookletModal, BackupModal } from "./components/Modals";
import { TopbarActionsRegion, RestoreSectionRegion, DangerSectionRegion } from "./components/PageChrome";
export { TopbarActionsRegion, RestoreSectionRegion, DangerSectionRegion };

/** Region root 1 — mounted into <section class="stats"> (slice 1). */
export function StatsRegion() {
  const { records } = useSyncExternalStore(subscribeData, getData);
  return <StatsStrip stats={dash.computeStats(records)} />;
}

/** Region root 2 — mounted into the disabled-hosts .set-sec (slice 2). */
export function HostsRegion() {
  const { settings } = useSyncExternalStore(subscribeData, getData);
  const hosts = settings.disabledHosts || [];
  return (
    <DisabledHosts
      hosts={hosts}
      onRemove={(h) => setDisabledHosts(hosts.filter((v) => v !== h))}
      onAdd={(h) => setDisabledHosts([...hosts, h])}
    />
  );
}

/** Region root 3 — mounted into the «ظاهر» .set-sec (slice 7). The theme's
 *  immediate visual effect (HL.applyThemeNow — the classic theme-boot
 *  contract) mirrors the controller's optimistic setSetting: apply now,
 *  re-apply the previous theme when the storage write fails. */
export function ThemeRegion() {
  const { settings } = useSyncExternalStore(subscribeData, getData);
  return (
    <ThemeRadios
      theme={settings.theme}
      onSelect={(k: ThemeKey) => {
        const prev = settings.theme;
        if (k !== prev) ui.applyThemeNow(k);
        setSettings({ theme: k }).catch(() => {
          ui.applyThemeNow(prev);
          toast("ذخیره تنظیمات ناموفق بود", "error");
        });
      }}
    />
  );
}

/** Region root 4 — mounted into the «رنگ پیش‌فرض هایلایت» .set-sec (slice 7). */
export function DotsRegion() {
  const { settings } = useSyncExternalStore(subscribeData, getData);
  return (
    <ColorDots
      defaultColor={settings.defaultColor}
      onSelect={(k: HighlightColor) => setSettings({ defaultColor: k }).catch(() => toast("ذخیره تنظیمات ناموفق بود", "error"))}
    />
  );
}

/** Region root 5 — mounted into the «رفتار» .set-sec (slice 7). */
export function SwitchesRegion() {
  const { settings } = useSyncExternalStore(subscribeData, getData);
  return (
    <BehaviorSwitches
      showToolbar={!!settings.showToolbar}
      showBadge={!!settings.showBadge}
      onToggle={(key, value) => setSettings({ [key]: value }).catch(() => toast("ذخیره تنظیمات ناموفق بود", "error"))}
    />
  );
}

/** The list pipeline — the exact computation the controller's renderList ran,
 *  now per render from the snapshot (all steps are pure dash.* functions).
 *  Boot collapse + tag pruning ride the data layer's refresh (data.ts). */
function listModel(s: ReturnType<typeof getData>) {
  const filtered = dash.applyFilters(s.records, s.filters, s.tagMap);
  const groups = dash.applyItemReversal(dash.groupRecords(filtered, s.filters.sort), s.reversedGroups)
    .map((g: Group) => ({
      ...g,
      favicon: (s.favicons[g.host] && s.favicons[g.host].icon) || null,
      tags: s.tagMap[g.key] || [],
    }));
  const page = dash.paginate(groups, s.visibleLimit);
  return { filtered, groups, page, lead: dash.leadDir(groups) };
}

/** Region root 6 — mounted into .toolbar (slice 4). */
export function ToolbarRegion() {
  const { filters, tagMap } = useSyncExternalStore(subscribeData, getData);
  return (
    <Toolbar
      filters={filters}
      tagMap={tagMap}
      onSearch={setSearch}
      onToggleColor={toggleColorFilter}
      onToggleNotes={setNotesOnly}
      onSort={setSort}
      onToggleTag={toggleTagFilter}
    />
  );
}

/** Region root 7 — mounted into .list-bar (slice 3, now state-driven): the
 *  bulk decision is computed fresh from the same state that renders the list
 *  (dash.bulkAction over the FILTERED groups + the user-owned collapse set). */
export function BulkRegion() {
  const s = useSyncExternalStore(subscribeData, getData);
  const { groups } = listModel(s);
  return <BulkToggle action={dash.bulkAction(groups, s.collapsedGroups)} onApply={bulkApply} />;
}

/** Region roots 8+9 — mounted into #empty-host / #load-more-host (slice 6,
 *  now state-driven: computed from the same pipeline the list renders). */
export function EmptyRegion() {
  const s = useSyncExternalStore(subscribeData, getData);
  const { filtered } = listModel(s);
  return <EmptyState shown={filtered.length === 0} hasRecords={s.records.length > 0} />;
}

export function MoreRegion() {
  const s = useSyncExternalStore(subscribeData, getData);
  const { page } = listModel(s);
  return <LoadMore shown={page.overflow > 0} overflow={page.overflow} onLoadMore={loadMore} />;
}

/** Region roots 11-13 — the three modals (slice 5). The preview window is
 *  fully React now (data.ts session state — previewBridge is gone); the
 *  restore/booklet modals open through the controller's one-way modalBridge
 *  (the topbar/drawer trigger buttons and the file-picker flow stay
 *  controller chrome until Task 5). */
export function PreviewModalRegion() {
  const { preview } = useSyncExternalStore(subscribeData, getData);
  return <PreviewModal rec={preview} onClose={closePreview} />;
}

export function RestoreModalRegion() {
  const { stagedBackup } = useSyncExternalStore(subscribeData, getData);
  return (
    <RestoreModal
      req={{ open: !!stagedBackup, payload: stagedBackup ? { kind: "restore", backup: stagedBackup } : null }}
      onClose={clearStagedBackup}
      onImport={async (backup, mode) => { await importBackup(backup, mode); }}
    />
  );
}

export function BookletModalRegion() {
  const { bookletOpen, records } = useSyncExternalStore(subscribeData, getData);
  return (
    <BookletModal
      req={{ open: bookletOpen, payload: { kind: "booklet" } }}
      onClose={() => setBookletOpen(false)}
      stats={dash.computeStats(records)}
      onMarkdown={buildMarkdownExport}
      onBooklet={buildBookletExport}
    />
  );
}

/** Region root — the selective backup modal: picker options come fresh from
 *  the snapshot (dash.backupSelectionOptions), the live count and the export
 *  ride the data layer's bindings to the store's ONE matching rule. */
export function BackupModalRegion() {
  const { backupOpen, records, tagMap } = useSyncExternalStore(subscribeData, getData);
  return (
    <BackupModal
      req={{ open: backupOpen, payload: { kind: "backup" } }}
      onClose={() => setBackupOpen(false)}
      options={dash.backupSelectionOptions(records, tagMap)}
      countOf={countSelectedBackup}
      onExport={exportSelectedBackup}
    />
  );
}

/** Region root 10 — mounted into #groups (slice 4): the direction-separated
 *  article cards. The handlers are the data layer's actions (the controller's
 *  exact logic); onPreview still rides the controller's previewBridge until
 *  slice 5 ports the hl-modal. */
export function ListRegion() {
  const s = useSyncExternalStore(subscribeData, getData);
  const { page, lead } = listModel(s);

  const handlers: GroupCardHandlers = {
    onOpen: openArticle,
    onDeleteGroup: deleteGroup,
    onToggle: (g, willCollapse) => toggleCard(g.key, willCollapse),
    onItemOrder: (g) => flipItemOrder(g.key),
    onSectionToggle: toggleSection,
    onAddTag: addTag,
    onRemoveTag: removeTag,
    onView: viewRecord,
    onCopy: (rec) => copyText(rec.text || ""),
    onDelete: deleteRecord,
    onPreview: openPreview,
  };

  return (
    <>
      {dash.splitDirSections(page.visible, lead).map((sec) => (
        <DirSection
          key={sec.dir}
          section={sec}
          lead={sec.dir === lead}
          collapsed={s.collapsedSections.has(sec.dir)}
          cardState={(g) => ({
            collapsed: s.collapsedGroups.has(g.key),
            order: dash.itemOrder(s.filters.sort, s.reversedGroups.has(g.key)),
          })}
          handlers={handlers}
        />
      ))}
    </>
  );
}
