/**
 * Phase 8 Task 4 — the React era's data layer: an external store the region
 * roots read via useSyncExternalStore (React-free module, one instance).
 *
 * Owns the SECOND store instance (same DI-at-composition-root pattern as
 * content.js/popup.js/dashboard.js since 7c-4) and follows chrome.storage:
 * records/settings refresh on backend change events — including the
 * controller's own writes to its remaining regions, so both owners stay
 * converged without shared mutable state.
 *
 * Write semantics mirror the controller's setSetting exactly: OPTIMISTIC
 * local update synchronously (rapid successive actions accumulate — reads
 * from the snapshot are never stale against our own in-flight writes),
 * storage write inside the store's write queue, rollback via re-read on
 * failure. The cross-context guarantee level is unchanged (the same pattern
 * the content page + popup + dashboard already exercise against one
 * chrome.storage).
 */
import { backends } from "../../extension/shared/backends/chrome-storage.js";
import { createStore } from "../../extension/shared/store.js";
import type { HighlightRecord } from "../types/highlight";
import type { Settings } from "../types/settings";

const store = createStore(backends.chromeStorage());

export interface DashboardData {
  records: HighlightRecord[];
  settings: Settings;
}

let state: DashboardData = { records: [], settings: {} as Settings };
const listeners = new Set<() => void>();
let started = false;

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

async function reloadRecords(): Promise<void> {
  try {
    const m = await store.getAllRecords();
    setState({ records: Array.from(m.values()) });
  } catch (e) {
    setState({ records: [] });
  }
}

async function reloadSettings(): Promise<void> {
  try {
    setState({ settings: (await store.getSettings()) as Settings });
  } catch (e) { /* keep the previous snapshot */ }
}

/** Called once from main.tsx before the regions mount. */
export function startData(): void {
  if (started) return;
  started = true;
  void reloadRecords();
  void reloadSettings();
  store.onRecordsChanged(() => { void reloadRecords(); });
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
