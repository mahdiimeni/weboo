/**
 * Phase 8 Task 4 — the React region's composition root.
 *
 * Owns a SECOND store instance (the same DI-at-composition-root pattern as
 * content.js/popup.js/dashboard.js since 7c-4): reads chrome.storage through
 * the same backend, subscribes with onRecordsChanged, and hands computed
 * slices to the ported components. During the transition the imperative
 * controller (dashboard.js) keeps owning the NOT-yet-ported regions with its
 * own instance — the store's read-your-writes + onChanged semantics are
 * already cross-context (content page + dashboard write the same way).
 *
 * Slices ported so far: 1 (StatsStrip). Each later slice moves one region
 * from controller-owned DOM to a component here; Task 5 retires the
 * controller when the last region lands.
 */
import { useEffect, useState } from "react";
import { backends } from "../../extension/shared/backends/chrome-storage.js";
import { createStore } from "../../extension/shared/store.js";
import { dash } from "../../extension/dashboard/dashboard-data.js";
import type { HighlightRecord } from "../types/highlight";
import { StatsStrip, type Stats } from "./components/StatsStrip";

const store = createStore(backends.chromeStorage());

/** The records slice — loads once, then follows store changes (both this
 *  region's future writes and the controller's/cross-context ones). */
function useRecords(): HighlightRecord[] {
  const [records, setRecords] = useState<HighlightRecord[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      store.getAllRecords().then((m) => {
        if (alive) setRecords(Array.from(m.values()));
      }).catch(() => { if (alive) setRecords([]); });
    };
    load();
    const off = store.onRecordsChanged(load);
    return () => { alive = false; off(); };
  }, []);
  return records;
}

export function App() {
  const records = useRecords();
  const stats: Stats = dash.computeStats(records);
  return <StatsStrip stats={stats} />;
}
