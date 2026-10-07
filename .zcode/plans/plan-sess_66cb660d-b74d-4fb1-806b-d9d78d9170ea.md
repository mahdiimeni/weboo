# Booklet v2 — سه قابلییت جدید (Task 88)

All three features land inside the existing architecture: **pure builders/pipelines stay pure**, the controller orchestrates, React components stay presentation-only. No new modal, no new entrypoint, no storage change — so `packaging.test.ts` needs no changes.

## Design decisions (defaults I chose — flag anything you want changed)

1. **Article selection is article-level** (like the booklet's own structure and the BackupModal picker). Nothing selected = all articles (today's behavior, preserved).
2. **TOC links are article-level**: each index row jumps to that article's page (`#art-N`), which is where its highlights live. Chrome's "Save as PDF" preserves internal anchor links, and the HTML file works in any browser.
3. **Font choice is a per-print choice in the modal** (like format/color radios today) — not a persisted setting, so no `Settings`/storage migration. Four system-stack options via a **font registry** in the builder (no webfonts are bundled — that preserves the booklet's "zero external resources" print invariant): وزیرمتن (default = today's exact stack) · تاهوما · Segoe UI · فونت سیستم. Adding a font later = one registry entry (OCP).
4. Selection + font apply to the booklet outputs (HTML/PDF) only; the Markdown button is untouched.

## Layer-by-layer changes

### 1. Pure builder — `extension/shared/booklet-export.js`
- **Clickable TOC**: `articleSection` gains an index → `<section class="article" id="art-N" …>` (1-based, agreeing with the existing CSS counter); TOC rows become `<a class="toc-row" href="#art-N">` wrapping the same spans; add `color: inherit; text-decoration: none` + a hover accent on `.toc-t`. The "TOC only from 2 articles" guard stays. Both sides derive from the same `groups` array so numbering can never disagree.
- **Font registry**: `BOOKLET_FONTS = { vazir, tahoma, segoe, system }` (id → `{ label, stack }`), exported as its own named export (the `booklet` facade stays ISP-pure: only `buildBookletHtml` — an existing test pins that). Body rule becomes `font-family: var(--bk-font, <default stack>)`; each registry entry generates one `body.font-<id> { --bk-font: … }` rule; a known `ctx.font` adds the `font-<id>` body class. No `ctx.font`/unknown id → no class → byte-identical rendering to today.
- Update the module header docstring.

### 2. Pure pipeline — `extension/dashboard/dashboard-data.js`
- Extract **`articleOptions(records)`** → `[{ key, host, title, count }]` (title-ordered 'page' groups — the stable picker order). `backupSelectionOptions` is refactored to delegate its articles derivation to it — one derivation, two consumers (DRY), with existing tests pinning its output unchanged.
- New **`filterGroupsByKeys(groups, keys)`**: order-preserving filter; **empty keys → identity** (the "nothing selected = all" rule lives in ONE place, documented).

### 3. Types — `src/types/booklet.ts` (new, typecheck-only)
`BookletFontId` (union of the 4 registry ids) + `BookletBuildOptions { articles?: string[]; font?: string }`. Parity with the runtime registry pinned by one test in `types-contract.test.ts` (the repo's established type↔runtime pattern).

### 4. Controller — `src/dashboard/data.ts`
`buildBookletExport(format, mode, options?: BookletBuildOptions)`: reads the full library fresh at click time (unchanged), then `dash.filterGroupsByKeys(gs, options.articles)`. Guards: empty library → existing toast; non-empty selection yielding nothing → new toast «مقاله‌ای برای کتابچه انتخاب نشده است». `font` passes through to the builder. Plus a tiny `bookletFontOptions()` helper for the UI.

### 5. UI — `Modals.tsx` + `App.tsx`
`BookletModal` (in place, reusing the Task-87 `SelSection`/`SelEmpty` helpers and `.sel-list`/`.sel-item`/`.sel-status` CSS — no new CSS):
- New «انتخاب مقاله‌ها» section inside the booklet block: checkbox rows (excerpt title `dir="auto"`, host, «N هایلایت»), status line — nothing picked: «همه‌ی مقاله‌ها در کتابچه خواهند بود.»; picked: live highlight count (summed from the rows — the exact snapshot rule, same principle as BackupModal).
- New «فونت» radio group (`name="bk-font"`), default وزیرمتن, honest hint that missing system fonts fall back.
- Selection/font state reset per open (one-shot picker pattern); `onBooklet(fmt, mode, { articles, font })`.
- `App.tsx` `BookletModalRegion` feeds `dash.articleOptions(records)` and the font options.

## Tests (the verification core)

- **`booklet-export.test.ts`** (~12 new): id/href pairing per article, 1-based agreement, anchor count == groups, guard unchanged; fonts — default output has no font class + carries the default stack in the var fallback, each registry id → `font-<id>` class + its `--bk-font` rule, unknown id → default, purity with `font` set, XSS invariance.
- **`dashboard-data.test.ts`** (~6): `articleOptions` shape/parity with `backupSelectionOptions().articles`; `filterGroupsByKeys` — identity on empty, order preservation, unknown keys ignored, purity.
- **`dashboard-components.test.tsx`** (~5): picker renders from options; default status text; selecting articles + font → `onBooklet` receives exactly `{ articles, font }`; reset on reopen; markdown button unaffected.
- **`types-contract.test.ts`** (1): `BookletFontId` ⇔ `Object.keys(HL.BOOKLET_FONTS)`.
- **New E2E rig `tests/e2e/real-booklet-e2e.mjs`** (modeled on `real-backup-e2e.mjs`): real headless Chrome + built extension, sentinel-identified SW, seeded storage (3 articles), drive the real modal — DOM probes for picker/status/font radios, then two real downloaded HTML files (full default export → parse TOC anchors/ids + default font; selected-articles + تاهوما export → parse only the selected article + font class), zero-exception + no-global probes, report JSON + exit codes.

## Execution order & gates

1. Types + parity test → 2. builder + tests → 3. pipeline + tests → 4. controller → 5. UI → 6. component tests → 7. gates: `bun run test` (expect ~640/0, +~24 new), `lint`, `typecheck`, `build:wxt` + parity → 8. run the E2E rig with `HLX_CHROME` → 9. `bun run zip` parity → 10. worklog Task 88 entry (repo's exact format) + `docs/architecture.md` modal note.

Commits, matching the Task-87 pattern: `feat(booklet): article selection, clickable TOC, print font choice — Task 88` then `docs: booklet Task 88 close-out — worklog + architecture`. Any failure found at any gate gets fixed and the full gate suite re-run before delivery.