# Weboo — Migration Baseline (Phase 0)

Status: **Phase 0 complete** · Branch: `migration/arch-modernization` · Base: `763ecc9` (main)
Date: 2026-09-28 · Extension version: 0.6.7 · Toolchain: bun 1.4.2, Node v26.7.0, Chrome-for-Testing 145

This document is the measured starting point for the TypeScript / WXT / React / SOLID
modernization. Source code was treated as the source of truth; documentation claims were
verified against it (they held, with the caveats in §4–§5).

---

## 1. Current Architecture (verified)

### 1.1 Shape

```
extension/            product — classic scripts, NO build step, NO TypeScript
  manifest.json       MV3 · single version source · 19 ordered content scripts
  background/         service-worker.js (module type) — 195 ln
  content/            content.js (shell/lifecycle, 326 ln) + favicon.js + mark-style.css
  shared/             engine + services (pure-ish) — backends/, ui/
  popup/              MVC triple: popup-data / popup-view / popup.js (+ css/html)
  dashboard/          MVC triple: dashboard-data / dashboard-view / dashboard.js (+ css/html)
tests/                24 unit files (bun:test + happy-dom) · 5 E2E rigs · fixture next-app (self-contained)
scripts/              build-zip, make-icons (explicit sharp)
docs/                 this file
worklog.md            task journal (64 tasks)
```

7,593 JS LOC (non-harness) across 36 files. Comment ratio ≈ 26%.

### 1.2 Module system = `globalThis.HL` namespace + manifest load order

Every file is an IIFE attaching `HL.<module> = {…}` (38 `globalThis.HL` sites, 31 files).
Dependencies are implicit in the `content_scripts[].js` array order — there are no imports
and therefore no import graph and no circular imports *today*. This is the central object
of the migration (§12 of the prompt): replaced by ES modules once a bundler exists.

### 1.3 Layers (grep-verified, not aspirational)

```
shared/backends/chrome-storage.js   port impl (chrome.storage + memory fallback)
shared/store.js                     domain store — factory HL.createStore(backend), pure of chrome.*
shared/highlighter.js               anchor/highlight engine — cfg-injected store, throws if absent
shared/ui/*                         widgets (shadow DOM, host watchdog)
content/content.js                  composition root of the page: lifecycle, observers, SPA nav
popup / dashboard                   each wires its own HL.store at entry (composition roots)
```

`shared/` contains zero references to page layers. `chrome.storage` appears in exactly
one file (the backend). `chrome.runtime`/`chrome.tabs` confined to service-worker,
popup.js (platform page), chrome-storage, runtime-bridge (the sole shared touchpoint).

### 1.4 Data model (exact record literal, highlighter.js)

```js
{ id, host, site, url, urlNorm, title, text, prefix, suffix,
  start, end, anchor, color, note, createdAt, updatedAt }
```

Storage keys (store.js): `hlx:settings`, `hlx:d:<host>`, `hlx:f:<host>` (favicon meta),
`hlx:tags`. Backup: versioned JSON, `HL.BACKUP_FORMAT = 1`. **No storage schema version
field exists** — only the backup-file format is versioned (risk R6).

Write guarantees: single-threaded write queue (read-modify-write), reads drain the queue
(read-your-writes), raw non-draining variants used in-queue (deadlock-free). Tested.

### 1.5 Anchor engine (current, must be preserved)

- Structural: XPath anchor (`resolveAnchor`) → textual fallback `findRange` (text index):
  saved offsets near historical position → exact quote (prefix/suffix scoring) →
  normalized-text candidates → visibility bonus +8 (v0.6.7 duplicate-copy invariant).
- Apply invariant: a record counts as applied only when ≥1 **visible** mark exists;
  hidden-copy marks are kept, never nested (re-entry guard).
- Self-heal: successful textual resolve updates `anchor/start/end` with debounced save.
- Orphans: bounded retry (12 × 3.5 s) + coalesced MutationObserver reconcile + safety-net
  reconciles at 3 s / 8 s after boot and SPA nav.
- SPA: `watchHref` (interval + popstate/hashchange, deduped), `navSeq` stale-async guard,
  `setPage` re-keying, `reconcileOrphans`.
- UI: host watchdog re-appends detached hosts (React hydration wipes).

### 1.6 Messaging

4 string constants (`HL.MSG`): `hlx:count-report`, `hlx:get-count`, `hlx:goto`,
`hlx:highlight-selection`, routed through `shared/runtime-bridge.js` (guarded
`globalThis.chrome` probe). **Untyped payloads** — boundary validation absent (risk R5).

---

## 2. Build & Test State (baseline run)

| Gate | Command | Result |
|---|---|---|
| Unit | `bun run test` | **628 pass / 0 fail / 2423 expects** (24 files, 11.0 s) |
| Lint | `bun run lint` | **exit 0** (config relaxes ~20 rules — see §3) |
| Package | `bun run zip` | **49 entries / 143,770 bytes**, version read from manifest |
| Harness | `bun run harness` | 2 harnesses written (popup + dashboard) |
| Browser E2E | `bun tests/e2e/next-compat-e2e.mjs` | 16/16 (fixture self-contained; last green run: Task 63) |
| Browser E2E | `HLX_CHROME=… bun tests/e2e/real-theme-e2e.mjs` | exit 0 (Task 63) |

Known failures: **none**. Browser E2E requires the local Chrome path + Wayland
(plus Cloudflare heuristics for live sites) — environment-dependent gates, not CI-safe
as-is.

---

## 3. Known Weaknesses (baseline warnings, not failures)

- No product-code typecheck: `tsconfig.json` includes `tests/**` only; `noImplicitAny:false`.
- 293 `any` annotations in unit tests (tests only — product code is plain JS).
- ESLint relaxes `no-unused-vars`, `no-console`, etc. Correctness is carried by tests.
- No CI; no root README/AGENTS; no `docs/` prior to this file.
- Size hotspots: `dashboard-view.js` 1,137 ln · `dashboard.js` 795 ln · `dashboard.css` 1,006 ln.
- `toast` helper duplicated in 4 files.
- `innerHTML` in 25 places — all assignments from constant `ICONS` strings (documented,
  no user-data interpolation found); disappears naturally with the React migration.

---

## 4. Architectural Risk Audit (§4 inventory)

| Pattern | Result | Verdict |
|---|---|---|
| `globalThis.HL` | 38 hits / 31 files | **The** migration target; last to be removed (needs bundler, see R1) |
| `chrome.storage.*` | 1 file (backend) | Already adapterized — model citizen |
| `chrome.runtime` / `chrome.tabs` | 4 / 3 files | Behind runtime-bridge in shared; popup/SW are platform layers |
| `MutationObserver` | 2 files (content, ui/base) | Disciplined: coalesced + debounced, 2 observers total |
| `TreeWalker` / `Range` | domwrap + textindex only | Contained engine primitives |
| `innerHTML`/`outerHTML` | 25 hits / 4 files | Constant icon strings only; no eval-like HTML from data |
| `eval` / `new Function` | 0 | Clean |
| Circular imports | impossible pre-ESM | Replaced by *load-order* coupling (manifest array) — becomes a real risk only at bundling time |
| God objects | HL namespace; dashboard-view | Namespace = target; dashboard-view is view-only (acceptable ceiling) |
| Duplicated logic | `toast` ×4 | Trivial; fold during UI phase |
| UI → chrome direct | popup.js only (allowed platform page) | OK |
| DOM-dependent domain logic | highlighter/textindex (by nature) | Inherent to the domain; keep DOM at engine edge, selectors pure |

---

## 5. Migration Risks

**R1 — MV3 content scripts cannot be ES modules.** Chrome injects `content_scripts[].js`
as classic scripts; `import`/`export` is illegal there. Removing `globalThis.HL` from the
content path therefore *requires a bundler step* (WXT or equivalent). Consequences:
- background SW already runs `"type": "module"` → ESM today; popup/dashboard pages can
  use native `<script type="module">`; **only the content bundle is blocked**.
- Global removal must land with/after the bundler (matches the prompt's ordering:
  WXT Phase 6, “remove legacy globals” last).

**R2 — Test harness reads source files as text.** `loadEngine` loads `extension/**/*.js`
by path and evaluates them in happy-dom; `packaging.test` asserts the manifest/zip
file contract (49 entries). Any file move/rename (TypeScript, `src/` layout) must update
harness + packaging test in the same commit or the suite goes red by design. Keep
`packaging.test.ts` as the path-move tripwire.

**R3 — happy-dom layout seams.** Unit tests stub `Range.getBoundingClientRect`
(helpers/engine.ts:92); zero-rect behavior is asserted in places. Type/refactor passes
must preserve these seams or tests must be consciously migrated with evidence.

**R4 — Behavior lives in 628 tests + 5 E2E rigs, not in docs.** The suite is the
specification. Rule: no test modified to make a refactor pass unless the baseline
documented the behavior change first.

**R5 — Untyped messaging.** 4 message types with string constants, no payload
validation. Low traffic today; typed contract is cheap (Phase 1) and closes a real
boundary hole.

**R6 — No storage schema version.** Records have no schema field; only backup format is
versioned (`BACKUP_FORMAT=1`). Introducing a schema version must default-absent → v1
(existing data) and never rewrite records in place until migrations are tested.

**R7 — E2E environment dependence.** Chrome binary path, Wayland, live-site Cloudflare
rhythms. Treat browser E2E as local gates; a future CI needs deterministic subset.

**R8 — Ship-vs-source drift.** `dist/*.zip` is a tracked artifact rebuilt by `bun run
zip`; rebuilds churn bytes (timestamps). Commit zip only on release commits.

**R9 — Persian/RTL behavior.** Direction logic (`detect-dir`, `faEl`, `format`) is
user-visible; typed migrations must not “normalize” strings or lose `dir` attributes.

---

## 6. Compatibility Constraints (invariants for every phase)

1. Storage keys `hlx:settings|d:|f:|tags` — unchanged without a tested migration.
2. Record shape (§1.4) — readable forever; unknown fields preserved, never discarded.
3. Backup JSON v1 — import must keep working across the whole migration.
4. Manifest contract: permissions (storage, unlimitedStorage, contextMenus, activeTab),
   matches, command `Alt+Shift+H`, `minimum_chrome_version: 102`, icons, options page.
5. Version single source: `extension/manifest.json`.
6. User-visible behavior: highlight/restore/orphan semantics, popup, dashboard,
   import/export, tags, settings, SPA handling — byte-level UI redesign out of scope.
7. Storage write guarantees (queue / read-your-writes) survive any refactor.
8. Highlight invariant: restore correctly or become an explicit orphan — never silently
   attach elsewhere (existing visibility + scoring rules are part of this).

---

## 7. Toolchain Decision Required Before Phase 2 (low-risk JS → TS)

Product code is classic script today; TypeScript needs an emit path. Options:

- **A (recommended): incremental `tsc` emit.** Add `tsconfig.extension.json`
  (`allowJs`, `outDir` into a staged tree or adjacent `build/`), keep classic scripts
  until WXT lands. Smallest change; introduces a real build step early — update the
  dev loop (`build` → `zip`) and keep `extension/` as the packaged source of truth.
- **B: pull WXT forward** (Phase 6 → Phase 2). Faster to ESM everywhere, but violates
  the prompt's “stabilize core first” ordering and lands the largest environment change
  before types/contracts exist.

Decision: **A**, revisited at Phase 6. Phase 1 (types + contracts) is type-only and
toolchain-neutral (`.ts` type files + `tsc --noEmit` gate) — safe under either option.

---

## 8. Phase Plan Mapped to This Repo

| Phase | Scope here | Exit criterion |
|---|---|---|
| 0 | This document + branch + audit | all baseline gates green (DONE) |
| 1 | `src/types/` domain models; StorageBackend/AnchorResolver/Messenger interfaces; typed `HL.MSG` contracts; typecheck script | `tsc --noEmit` green; zero behavior change |
| 2 | Low-risk pure modules → TS (format, utils, tags, detect-dir, url, textindex) | per-file commits; 628 still green |
| 3 | Anchor engine extraction into resolvers (XPath/offset/exact/norm/…) behind `AnchorResolver` + composite | duplicate-text/orphan E2E still green |
| 4 | Content shell as composition root; engine behind interfaces | content.js shrinks to wiring |
| 5 | Service-worker cleanup + typed messaging runtime | message contract tests |
| 6 | WXT migration (build, manifest gen, content bundle) | zip parity; manifest diff reviewed |
| 7 | Dashboard selectors extracted (dashboard-data already ~pure — formalize) | dashboard-data tests unchanged |
| 8 | Dashboard React (view layer only; `dashboard-view.js` replaced, data layer reused) | visual + behavior E2E |
| 9 | Popup React only where valuable (popup is small — may be a no-op decision, documented) | popup tests green |
| 10 | Storage schema version + migration pipeline + import hardening | migration tests v1→N |
| 11 | Benchmarks (docs: small/medium/large doc × 0/10/100/500 highlights) | measured before/after |
| 12 | Remove `globalThis.HL`, legacy globals, docs (architecture/anchor/storage) | §48 checklist green |

Suggested first commits (§45): `baseline: document current architecture` (this file) →
`types: add domain models` → `storage: introduce contracts + contract-test harness`.

---

## 9. Baseline Invariant Checklist (§50, pre-migration)

- [x] Highlight invariant: enforced by orphan/visibility tests + live-site E2E
- [x] Data invariant: 628 tests read/write real record shapes
- [x] Storage invariant: write-queue + read-your-writes covered in store.test.ts
- [x] UI invariant: popup/dashboard/harness suites green
- [x] Messaging invariant: count/goto/selection flows covered by SW + content tests
- [x] Performance invariant: observers coalesced (audit §4); no benchmark numbers yet (Phase 11 establishes them)
