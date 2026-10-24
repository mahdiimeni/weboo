/**
 * Test world for the danger-section (delete-all) suite.
 *
 * Installs a chrome mock with a SEEDED library BEFORE the real dashboard
 * modules load, so data.ts's chromeStorage() adapter binds to this mock's
 * storage.local (not the in-memory fallback) — the suite then drives
 * component → data layer → store → chrome adapter end-to-end and asserts
 * on the STORAGE TRUTH (chromeMock.__state.data), which is race-free
 * (the data layer's snapshot refreshes are debounced and droppable).
 *
 * Import this module FIRST — ES imports evaluate in listed order, so the
 * mock exists before PageChrome (→ data.ts) is evaluated.
 */
import { makeChromeMock } from "./engine";

function rec(id: string, host: string) {
  return {
    id, host,
    url: "https://" + host + "/p",
    urlNorm: "https://" + host + "/p",
    text: "متن " + id,
    color: "yellow",
  };
}

/** Two host buckets + one user setting (theme: dark) that must survive
 *  delete-all — the exact pre-delete state the flow tests assume. */
export const SEED: Record<string, any> = {
  "hlx:d:site1.com": { r1: rec("r1", "site1.com") },
  "hlx:d:site2.com": { r2: rec("r2", "site2.com") },
  "hlx:settings": { theme: "dark" },
};

export const chromeMock = makeChromeMock(SEED);
(globalThis as any).chrome = chromeMock;

/** Restores the seed in the mock's live data (direct platform write —
 *  change events are intentionally not fired; tests assert on truth). */
export function restoreSeed(): void {
  const data: Record<string, any> = chromeMock.__state.data;
  Object.keys(data).forEach((k) => { if (k.indexOf("hlx:") === 0) delete data[k]; });
  Object.assign(data, SEED);
}

/** Host-bucket count in the storage truth (the "are highlights gone?" read). */
export function recordHostsInTruth(): string[] {
  return Object.keys(chromeMock.__state.data).filter((k) => k.indexOf("hlx:d:") === 0);
}
