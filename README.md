# وب هایلایتر — Web Highlighter

A Persian/RTL web-highlighter MV3 extension: 5 highlight colors, notes,
article tags, JSON backup/restore, booklet export — 100% local storage, no
server, no account.

## Load it (what to open in Chrome)

| path | loadable? | what it is |
|---|---|---|
| `dist/highlighter-extension-v<version>.zip` | ✅ extract, then load the folder | the release artifact |
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
bun run test          # unit suite (557 tests, bun:test + happy-dom)
bun run lint          # eslint
bun run typecheck     # tsc --noEmit
bun run harness       # regenerate the popup E2E harness
```

E2E rigs (real Chrome, need a Chromium path):

```bash
HLX_CHROME=<chromium> bun tests/e2e/real-theme-e2e.mjs    # popup theme cycle
HLX_CHROME=<chromium> bun tests/e2e/next-compat-e2e.mjs   # SPA/remount scenarios
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
