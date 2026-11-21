# Weboo — Surfaces (no SPA router)

This is a **Chrome MV3 extension** (WXT + React). There is no URL router; navigation is by extension surface:

| Surface | URL / file | Entry | What renders |
|---|---|---|---|
| **Dashboard (options page)** | `dashboard.html` | `entrypoints/dashboard/index.html` + `entrypoints/dashboard/main.tsx` | Static RTL shell (`<html lang="fa" dir="rtl">`) + React regions: stats strip, filter toolbar, article list (grouped by article, collapsible), settings **drawer** (aside) + 4 modals (restore / booklet / selective backup / highlight preview) |
| **Popup** | `popup/popup.html` | `extension/popup/popup.html` + module scripts | MVC (not React): page card, per-page highlight list, site on/off switch, gear → opens `dashboard.html#hlx-settings` (deep-links the settings drawer open) |
| **Content widgets** | injected into every http(s)/file page | `extension/shared/ui/*` (Shadow DOM hosts) | Floating selection toolbar, note popover, toasts — theme/lang follow the extension settings |

The settings page (the redesign target) is the **dashboard's settings drawer**: opened via the topbar gear button, the popup gear, or the `#hlx-settings` deep-link; it slides in from the start edge over a blurred overlay.

Key source files:
- Shell: `entrypoints/dashboard/index.html`
- React mount: `entrypoints/dashboard/main.tsx` (one `createRoot` per region host)
- Regions/components: `src/dashboard/App.tsx`, `src/dashboard/components/*.tsx`
- Data layer: `src/dashboard/data.ts` (external store, `useSyncExternalStore`)
- Drawer frame: `src/dashboard/chrome.ts`
- Styling: `extension/dashboard/dashboard.css` (page palette + components), `extension/globals.css` (Graphite token layer loaded first)
