# Storage

100% local storage — `chrome.storage.local` through a backend port. No
server, no account, nothing leaves the device.

## Keys

| key | shape | notes |
|---|---|---|
| `hlx:settings` | Settings object | theme, defaultColor, showToolbar, showBadge, disabledHosts |
| `hlx:d:<host>` | `{ <id>: HighlightRecord }` | per-host partitioning for fast same-site reads |
| `hlx:f:<host>` | `{ icon: dataURL, capturedAt }` | favicons captured from the page itself (≤ 200 KB dataURL cap) |
| `hlx:tags` | `{ <urlNorm>: [tag, …] }` | article-scoped tags (v1.2.15) |
| `hlx:schemaVersion` | number | schema metadata (Phase 4/10) — NOT user data |

## The backend port

`src/types/storage.ts` defines the port (`get/set/remove/bytes/onChange`);
`shared/backends/chrome-storage.js` implements it over `chrome.storage.local`
with an in-memory fallback when the API is absent. The store validates the
port at construction (`createStore` throws on a malformed backend) — the
error names the contract. The read-only slice (`createStoreReader`) is the
ISP view the service worker uses.

## Guarantees

- **Write queue** — every read-modify-write runs serialized in the store's
  queue; a save issued at boot cannot interleave with the schema migration.
- **Read-your-writes** — reads drain the queue first; raw non-draining
  variants exist for in-queue use (deadlock-free).
- **Live sync** — `onRecordsChanged` / `onTagsChanged` / `onSettingsChanged`
  wrap `chrome.storage.onChanged` per key family; the dashboard debounces
  refreshes at 400 ms (coalescing bursts like a multi-record import).
- **Records are read defensively** — unknown fields were never written by any
  released version, but the full engine shape is the contract
  (`src/types/highlight.ts`); `types-contract` tests pin runtime ↔ type
  parity.

## Schema versioning (Phase 4/10)

`hlx:schemaVersion` marks the shape a build reads/writes. **Absence = legacy
v0, and the pre-versioning shape IS v1** — versioning landed without
rewriting any data. The rules (enforced by the dedicated `store.test.ts`
describe, which injects v1→N chains):

- forward-only: a stored version ≥ target is never touched (user downgrades
  are honored — no backward migration);
- one memoized gate: the FIRST store operation awaits `migrateSchema` —
  reads and writes alike, nothing overtakes it, and a backend error resets
  the memo (retried on the next operation, never stamped over);
- each step stamps only after its `run()` succeeded, once per step (a crash
  mid-chain resumes there); a gap in the chain stamps NOTHING above it;
- `clearAll` wipes user keys but preserves the stamp (an empty store IS the
  current shape — re-running legacy steps would be pointless).

## Import/export

Backup JSON v1: `{ app: 'web-highlighter', name, format: 1, version,
exportedAt, settings, highlights: { <host>: { <id>: Record } }, favicons,
tags, meta: { count } }`. The page validates the envelope (`app` id, the
highlights object) before staging; `store.importData` sanitizes every record
through the field whitelist, resolves merge duplicates by `updatedAt`
(newer wins), and `replace` mode rewrites wholesale (settings included, by
explicit user choice in the modal). The backup format is versioned
independently (`BACKUP_FORMAT = 1`) and must keep importing across the whole
project.

**Selective backup** (`exportData(selection?)`): the optional
`BackupSelection` (`{ hosts?, articles?, tags? }` — see
`src/types/storage.ts`, mirrored in the store and pinned by the
types-contract tests) filters the highlights by the UNION rule of the pure
`matchesBackupSelection`: a record is included when its host, its article
key (urlNorm) or its article's tags match ANY given list — tags select
articles and fold case exactly like the filter chips. Everything else
FOLLOWS the included records: favicons only for the hosts still represented,
tag entries only for the articles in the file. Settings are device-global
and always exported (a replace-mode restore of a partial file rewrites the
same settings — it can never wipe them to defaults). A partial file marks
itself `meta: { count, partial: true, selection }`; the delivery layer names
it `web-highlighter-backup-partial-*.json` and the restore modal shows a
«بک‌آپ انتخابی» row. An empty/absent selection IS the full backup —
`exportData()` and `exportData({})` produce the exact historical shape. The
dashboard's picker (`dash.backupSelectionOptions`) derives its rows from the
same values the matcher compares, so the live preview count can never
disagree with the exported file.
