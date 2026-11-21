# Weboo — Page Dependency Trees

The "pages" are the extension's surfaces. The redesign target (settings drawer) is inside the dashboard surface.

## Dashboard (options page) — contains the settings drawer
Entry: `entrypoints/dashboard/index.html` (static shell) → `entrypoints/dashboard/main.tsx` (React mounts)
Dependencies:
- `src/dashboard/App.tsx` — all region components
  - `src/dashboard/components/StatsStrip.tsx`
  - `src/dashboard/components/DisabledHosts.tsx`
    - `src/dashboard/toast.ts`
  - `src/dashboard/components/BulkToggle.tsx`
  - `src/dashboard/components/ThemeRadios.tsx`
  - `src/dashboard/components/LanguageSelect.tsx`
  - `src/dashboard/components/ColorDots.tsx`
  - `src/dashboard/components/BehaviorSwitches.tsx`
  - `src/dashboard/components/Toolbar.tsx` (filter toolbar: search, color chips, notes-only switch, sort segmented control, tag chips)
  - `src/dashboard/components/DirSection.tsx` (RTL/LTR sections)
    - `src/dashboard/components/GroupCard.tsx` (article card: favicon, title, URL, chips, tags, items)
      - `src/dashboard/components/ItemCard.tsx` (one highlight row: color bar, quote, note, actions)
        - `src/dashboard/components/ArmIconButton.tsx` (two-step confirm icon button)
      - `src/dashboard/components/TagsRow.tsx`
  - `src/dashboard/components/EmptyState.tsx`
  - `src/dashboard/components/Modals.tsx` (Preview / Restore / Booklet / Backup modals over a shared shell)
  - `src/dashboard/components/PageChrome.tsx` (TopbarActionsRegion + RestoreSectionRegion + DangerSectionRegion)
    - `src/dashboard/components/pageIcons.tsx`
  - `src/dashboard/components/icons.tsx`
- `src/dashboard/data.ts` — external store (snapshot + actions; owns the store instance)
- `src/dashboard/chrome.ts` — drawer frame (open/close/Escape/deep-link)
- `src/dashboard/toast.ts`
- `extension/dashboard/dashboard-data.js` — PURE pipeline (filters, grouping, order, selection rules) consumed by components
- `extension/globals.css` — Graphite token layer (loaded first)
- `extension/dashboard/dashboard.css` — page palette + all component styles (1144 lines)
- `extension/shared/i18n.js` (compiled from `src/shared/i18n.ts`) — all UI strings via `t()`

### Settings-drawer sub-tree (the redesign target)
Rendered hosts inside `entrypoints/dashboard/index.html` `aside#drawer`:
- `#theme-radios` ← `ThemeRadios` (radio-card list: auto/light/dark with hints)
- `#language-select` ← `LanguageSelect` (dropdown, 12 languages)
- `#color-dots` ← `ColorDots` (6 color dots)
- `#behavior-host` ← `BehaviorSwitches` (2 switches)
- `.set-sec` (static) ← `DisabledHosts` (chips + add row)
- `#restore-sec-host` ← `RestoreSectionRegion` (in `PageChrome.tsx`)
- `#danger-sec-host` ← `DangerSectionRegion` (in `PageChrome.tsx`)
Frame: `src/dashboard/chrome.ts` + drawer/overlay CSS in `extension/dashboard/dashboard.css` (~770–920).

## Popup
Entry: `extension/popup/popup.html` → `extension/popup/popup.js` (module MVC)
Dependencies:
- `extension/popup/popup-data.js` (pure policy) · `popup-view.js` (DOM rendering) · `popup.css` · `popup.html`
- shared: `format.js`, `detect-dir.js`, `ui/base.js`, `export.js`, `store.js`, `runtime-bridge.js`, `i18n.js`

## Content widgets
Entry (in-page): `extension/content/content.js` → `createHighlighter` (`extension/shared/highlighter.js`)
Dependencies:
- `extension/shared/ui/toolbar.js`, `ui/popover.js`, `ui/toast.js` (Shadow DOM widgets), `ui/base.js` (theme/lang)
- `extension/shared/{textindex,anchor,domwrap,domkit}.js` — anchor engine
- `extension/content/mark-style.css` — highlight mark styles (6 colors, dark-page variants)
