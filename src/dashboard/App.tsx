/**
 * Phase 8 Task 4 — the React region roots.
 *
 * One region per ported dashboard area; each mounts via createRoot into the
 * static shell's host element (createRoot takes over the host's children —
 * the ownership handoff). Data flows from the external store (data.ts)
 * through useSyncExternalStore; the components themselves are pure
 * presentation under src/dashboard/components/.
 *
 * Slices ported so far: 1 (stats strip), 2 (disabled-hosts section),
 * 3 (bulk bar — via the controller's publish/subscribe bulkBridge, which
 * retires when slice 4 moves the list state into data.ts).
 * Task 5 collapses these roots into a single App when the last region lands
 * and the imperative controller retires.
 */
import { useSyncExternalStore } from "react";
import { getData, subscribeData, setDisabledHosts, setSettings } from "./data";
import { toast } from "./toast";
import type { ThemeKey } from "../types/settings";
import type { HighlightColor } from "../types/highlight";
import { bulkBridge, listChromeBridge } from "../../extension/dashboard/dashboard.js";
import { dash } from "../../extension/dashboard/dashboard-data.js";
import { StatsStrip } from "./components/StatsStrip";
import { DisabledHosts } from "./components/DisabledHosts";
import { BulkToggle } from "./components/BulkToggle";
import { EmptyState } from "./components/EmptyState";
import { LoadMore } from "./components/LoadMore";
import { ThemeRadios } from "./components/ThemeRadios";
import { ColorDots } from "./components/ColorDots";
import { BehaviorSwitches } from "./components/BehaviorSwitches";

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
        if (k !== prev) (globalThis as unknown as { HL: { applyThemeNow: (t: string) => void } }).HL.applyThemeNow(k);
        setSettings({ theme: k }).catch(() => {
          (globalThis as unknown as { HL: { applyThemeNow: (t: string) => void } }).HL.applyThemeNow(prev);
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

/** Region root 6 — mounted into .list-bar (slice 3). The bulk decision is
 *  published by the controller's bulkBridge (authoritative list state still
 *  lives there); apply() runs the exact click-handler logic. */
export function BulkRegion() {
  /* bulkBridge lives in the untyped controller module — pin the snapshot shape */
  const action = useSyncExternalStore(bulkBridge.subscribe, bulkBridge.getSnapshot as () => string);
  return <BulkToggle action={action} onApply={() => bulkBridge.apply()} />;
}

interface ListChrome {
  emptyShown: boolean;
  emptyHasRecords: boolean;
  moreShown: boolean;
  moreOverflow: number;
}

/** Region roots 7+8 — mounted into the #empty-host / #load-more-host slots
 *  (slice 6). The controller's renderList publishes the snapshots. */
export function EmptyRegion() {
  const chrome = useSyncExternalStore(listChromeBridge.subscribe, listChromeBridge.getSnapshot as () => ListChrome);
  return <EmptyState shown={chrome.emptyShown} hasRecords={chrome.emptyHasRecords} />;
}

export function MoreRegion() {
  const chrome = useSyncExternalStore(listChromeBridge.subscribe, listChromeBridge.getSnapshot as () => ListChrome);
  return <LoadMore shown={chrome.moreShown} overflow={chrome.moreOverflow} onLoadMore={() => listChromeBridge.applyMore()} />;
}
