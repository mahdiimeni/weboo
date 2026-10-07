# Architecture (end state — post-migration)

The extension is a TypeScript + WXT + React codebase. There is **no global
registry**: every file is an ES module with real bindings. Branch
`migration/arch-modernization`; the plan of record is
`docs/migration-baseline.md` (phases 0–12, all closed — see `worklog.md`),
followed by an architecture-hardening phase (anchor confidence policy,
runtime message validation, unknown-field preservation, URL scheme gates,
noImplicitAny, tightened lint, CI — worklog Task 86).

## Layout

```
extension/            product source (WXT publicDir — byte-copied into the build)
  manifest.json       MV3 · single version source · canonical content order
  background/         service-worker.js (module): context menu, badge, commands
  content/            content.js (orchestrator), favicon.js, mark-style.css
  shared/             engine + services (ES modules)
  popup/              MVC pages (module entry; see the Phase 9 decision)
  dashboard/          dashboard-data.js (pure pipeline) + dashboard.css (asset)
entrypoints/          WXT owns the manifest keys
  background.ts       side-effect import of the service worker
  content.ts          the 20 content files bundled in canonical order
  dashboard/{index.html, main.tsx}   the React options page (emits dashboard.html)
src/
  shared/*.ts         TS sources that COMPILE INTO extension/shared (build:ext)
  types/              domain models pinned to runtime by types-contract tests
  dashboard/          the React dashboard: data.ts, chrome.ts, App.tsx, components/
tests/                bun:test + happy-dom (unit) · real-Chrome CDP rigs (e2e)
scripts/              build-zip, make-icons, wxt-parity, benchmark
docs/                 this file, benchmarks, migration-baseline
```

## The three layers

1. **Content path** — `entrypoints/content.ts` side-effect-imports the 20
   manifest files in canonical order into ONE bundle (MV3 content scripts are
   always classic, so the bundle is the only way to ship modules). The files
   communicate through ES imports; `scripts/wxt-parity.mjs` fails the build if
   the import order drifts from `extension/manifest.json`.
2. **Pages** — the popup is a module entry (classic `theme-boot` first for the
   anti-flash window, then the entry script). The dashboard is a React app:
   `main.tsx` mounts one createRoot per region host into the static shell;
   `src/dashboard/data.ts` is the single data + action layer (an external
   store read via `useSyncExternalStore`, optimistic writes + rollback); the
   drawer frame chrome is `src/dashboard/chrome.ts`. The theme write side is
   `ui.applyThemeNow` (ui/base.js); the anti-flash READ stays classic in
   `theme-boot.js` (the page's only non-module script, by design).
3. **Service worker** — the platform layer: named imports, a local read-only
   store slice, a `globalThis.__HLX_APP` marker for the E2E rigs to identify
   the target (module bindings are not reachable from outside).

## The engine

`shared/highlighter.js` composes `textindex` (normalized text index),
`domwrap` (DOM primitives), `anchor` (the resolver pipeline), `ui/*` (Shadow
DOM widgets) and an injected store — see `docs/anchor-engine.md`.

## Testing

- `bun run test` — 582 unit tests over bun:test + happy-dom (strict + noImplicitAny across both tsconfigs). The harness
  (`tests/unit/helpers/engine.ts`) evaluates each file as a real ES-module
  graph (vm.SourceTextModule) per test world and HARVESTS the module bindings
  into the `HL` shape the tests read — identity preserved by construction.
- Packaging tripwires (`tests/unit/packaging.test.ts`): every
  manifest-referenced file exists; all 20 content files carry module syntax;
  the emitted tsc output rules; the page anti-flash shape (classic theme-boot
  first + exactly one module entry); **no product file touches
  `globalThis.HL`**.
- Real Chrome (`tests/e2e/`): `real-theme` (the popup theme cycle, hard-gated
  probes), `next-compat` (16 SPA/remount scenarios), and the dashboard smoke
  (real storage injection → React render → modals via the real UI).
- CI (`.github/workflows/ci.yml`): install → typecheck → lint → test →
  build + parity on every push/PR; browser rigs stay local by design.
- `bun run zip` rebuilds `.output/chrome-mv3` through the parity gate and
  packs `dist/`; the release zip is a tracked artifact refreshed on release
  commits only.
