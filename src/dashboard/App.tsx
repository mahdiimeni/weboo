/**
 * Phase 8 Task 4 — the React region roots.
 *
 * One region per ported dashboard area; each mounts via createRoot into the
 * static shell's host element (createRoot takes over the host's children —
 * the ownership handoff). Data flows from the external store (data.ts)
 * through useSyncExternalStore; the components themselves are pure
 * presentation under src/dashboard/components/.
 *
 * Slices ported so far: 1 (stats strip), 2 (disabled-hosts section).
 * Task 5 collapses these roots into a single App when the last region lands
 * and the imperative controller retires.
 */
import { useSyncExternalStore } from "react";
import { getData, subscribeData, setDisabledHosts } from "./data";
import { dash } from "../../extension/dashboard/dashboard-data.js";
import { StatsStrip } from "./components/StatsStrip";
import { DisabledHosts } from "./components/DisabledHosts";

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
