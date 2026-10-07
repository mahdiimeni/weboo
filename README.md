# وبو — Weboo

A Persian/RTL web-highlighting MV3 extension: 5 highlight colors, notes,
article tags, JSON backup/restore (full or selective — by sites, articles
and tags), booklet export (selectable articles, clickable index, print font
choice) — 100% local storage, no server, no account.

## Load it (what to open in Chrome)

| path | loadable? | what it is |
|---|---|---|
| `dist/weboo-v<version>.zip` | ✅ extract, then load the folder | the release artifact |
| `dist/highlighter-extension-v<version>.zip` | ✅ extract, then load the folder | frozen artifacts from before the v0.8.0 «وبو» rebrand (old naming) |
| `.output/chrome-mv3/` | ✅ load unpacked | the WXT build (dev) |
| `extension/` | ❌ **source tree — not loadable** | product SOURCE: the content files are ES modules (MV3 content scripts are always classic) and `dashboard.html` is GENERATED from `entrypoints/dashboard/` at build time |

Chrome's error when loading `extension/` is
`Could not load options page 'dashboard.html'. Could not load manifest.` —
that is the expected rejection, not a broken build.

## Build & develop

```bash
bun install

bun run build:wxt     # WXT build → .output/chrome-mv3 (+ the parity gate)
bun run zip           # full chain: typecheck-emit → WXT build → parity → dist zip
bun run test          # unit suite (641 tests, bun:test + happy-dom)
bun run lint          # eslint
bun run typecheck     # tsc --noEmit
bun run harness       # regenerate the popup E2E harness
```

**Versioning (semver, user policy):** every change ships with a version bump —
bug fix → PATCH (0.7.**x**), new feature → MINOR (0.**x**.0), huge/breaking
update → MAJOR. The version lives in FOUR synced places the packaging test
pins: `extension/manifest.json` (single source), `extension/shared/constants.js`
(`VERSION`), and the static `v…` fallback labels in `extension/popup/popup.html`
+ `entrypoints/dashboard/index.html`. The bump lands in the task's close-out
commit and the dist zip is rebuilt.

E2E rigs (real Chrome, need a Chromium path):

```bash
HLX_CHROME=<chromium> bun tests/e2e/real-theme-e2e.mjs    # popup theme cycle
HLX_CHROME=<chromium> bun tests/e2e/next-compat-e2e.mjs   # SPA/remount scenarios
HLX_CHROME=<chromium> bun tests/e2e/real-backup-e2e.mjs   # selective backup + dashboard
HLX_CHROME=<chromium> bun tests/e2e/real-booklet-e2e.mjs  # booklet picker/TOC/font
```

## Architecture

- `entrypoints/` — WXT entrypoints (background, content bundle, the React
  dashboard). WXT owns the manifest keys they generate.
- `extension/` — product source (content scripts, shared modules, popup pages,
  the pure dashboard pipeline). Compiled TS lands here (`src/shared/*.ts` →
  `extension/shared/*.js` via `bun run build:ext`).
- `src/dashboard/` — the React options page: data layer (`data.ts`), drawer
  chrome (`chrome.ts`), region roots (`App.tsx`), components.
- `docs/` — architecture, anchor engine, storage, benchmarks, and the
  migration baseline (`migration-baseline.md`) with the full phase journal in
  `worklog.md`.

See `docs/architecture.md` for the whole picture.
