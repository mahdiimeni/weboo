# وبو — Weboo ✨

[English](README.md) | [فارسی](README.fa.md)

**Weboo** is a friendly highlighter for your browser. Select any text on any
web page, give it one of five cheerful colors, and attach a note if you feel
like it. Everything is saved **on your own device** — no account, no server,
no tracking. Your highlights are yours.

## What can it do?

- 🖍️ **Highlight** any text in 5 colors — articles, docs, wherever you read.
- 📝 **Notes** on any highlight (great for "why did I save this?").
- 🏷️ **Article tags** to keep your reading organized.
- 📚 **A dashboard** that gathers everything: search, filter by color / note / tag, sort.
- 💾 **Backups** — full or selective (just some sites, articles, or tags), restore any time.
- 📤 **Reading exports** — a Markdown library for Obsidian, and a print-ready booklet (Save as PDF).
- 🌓 Light & dark themes, a counter on the toolbar icon, and a "don't run here" list for sites.
- 🈯 Built for Persian/RTL reading — and happy with LTR pages too.

## Is my data private?

Yes — completely. Weboo keeps everything in your browser's local storage, on
your device. There is no server, no account, no analytics; nothing ever
leaves your computer. (Removing the extension removes the data — so remember
your backups!)

## Install (one minute)

1. Grab the release zip: `dist/weboo-v<version>.zip` (the older
   `dist/highlighter-extension-v<version>.zip` files are frozen artifacts
   from before the v0.8.0 rebrand). Every release zip stays in `dist/`
   forever — they are the release history and are never pruned (policy).
2. Unzip it into any folder.
3. Open `chrome://extensions` in Chrome (or any Chromium browser).
4. Turn on **Developer mode** (top corner), click **Load unpacked**, and pick
   the unzipped folder.
5. Done! Select some text and look for the little toolbar. 🎉

> **Good to know:** the `extension/` folder in this repo is the *source code*.
> If you load it directly, Chrome refuses with
> `Could not load options page 'dashboard.html'. Could not load manifest.` —
> that is expected, not a broken build. Developers load the
> `.output/chrome-mv3/` build instead.

## Using it

- **Highlight:** select text → floating toolbar → pick a color. The
  right-click menu and keyboard shortcuts work too.
- **Note:** click a highlighted text → the edit action writes or edits a
  note; the delete action removes the highlight.
- **Everything else:** the toolbar icon shows this page's highlights; the
  gear opens the dashboard — search, filters, tags, backups, exports, settings.
- **Backup:** dashboard → «خروجی پشتیبان» for a full JSON backup; «خروجی
  انتخابی» to pick just some sites / articles / tags. Restoring asks
  merge-or-replace.
- **Booklet:** dashboard → «کتابچه» → choose articles → print or Save as PDF.

## For developers

The codebase is TypeScript + WXT + React, 100% local. Handy commands:

```bash
bun install
bun run build:wxt     # dev build → .output/chrome-mv3 (+ the parity gate)
bun run zip           # full chain: typecheck-emit → WXT build → parity → dist zip
bun run test          # unit suite (bun:test + happy-dom)
bun run lint          # eslint
bun run typecheck     # tsc --noEmit
bun run harness       # regenerate the popup E2E harness
```

Real-Chrome E2E rigs (need a Chromium path):

```bash
HLX_CHROME=<chromium> bun tests/e2e/real-theme-e2e.mjs    # popup theme cycle
HLX_CHROME=<chromium> bun tests/e2e/next-compat-e2e.mjs   # SPA/remount scenarios
HLX_CHROME=<chromium> bun tests/e2e/real-backup-e2e.mjs   # selective backup + dashboard
HLX_CHROME=<chromium> bun tests/e2e/real-booklet-e2e.mjs  # booklet picker/TOC/font
```

Versioning: every change ships with a version bump (fix → PATCH, feature →
MINOR, breaking → MAJOR); the version lives in five synced places — four of
them pinned by the packaging test.

Repo map, if you want to wander: `entrypoints/` (WXT entrypoints),
`extension/` (product source), `src/dashboard/` (the React dashboard),
`tests/` (unit + e2e). The big picture lives in
[docs/architecture.md](docs/architecture.md), with the
[storage layer](docs/storage.md), the
[anchoring engine](docs/anchor-engine.md), and the
[benchmarks](docs/benchmarks.md) beside it.

## License

[MIT](LICENSE) — use it, change it, share it.
