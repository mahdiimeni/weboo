/**
 * Storage port contracts (modernization Phase 1).
 *
 * Extracted verbatim from the two contract sites in the source of truth:
 *  - the 5-member port doc in extension/shared/backends/chrome-storage.js
 *  - createStore()'s runtime validation in extension/shared/store.js
 *    (rejects any backend missing get/set/remove/bytes/onChange)
 *
 * Implementations: HL.backends.chromeStorage() (falls back to memory when
 * chrome.storage is absent) and HL.backends.memoryArea() (in-memory port,
 * test utility + graceful degradation). store.test.ts already runs the same
 * contract suite against both — the LSP guarantee of this interface.
 */

/** chrome.storage-style change event: one entry per changed key. */
export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export type StorageChanges = Record<string, StorageChange>;

/**
 * The storage backend port (minimal ISP — exactly the 5 members the domain
 * layer uses; deliberately no more, so `createStore` validation stays exact).
 */
export interface StorageBackend {
  /** `key = null` → every item; otherwise the value object for one key (may be `{}`). */
  get(key: string | null): Promise<Record<string, unknown>>;
  /** Batch write of `{ key: value }`. */
  set(items: Record<string, unknown>): Promise<void>;
  /** Remove an array of keys. */
  remove(keys: string[]): Promise<void>;
  /** Bytes in use (0 when the platform cannot report). */
  bytes(): Promise<number>;
  /** Subscribe to changes; returns an unsubscribe function. */
  onChange(cb: (changes: StorageChanges) => void): () => void;
}
