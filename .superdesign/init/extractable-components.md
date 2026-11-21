# Weboo — Extractable Components

No classic NavBar/Sidebar/Footer layout components exist — the shell is static HTML and the drawer is a fixed overlay. These are the reusable UI patterns worth knowing. (Drafts can reproduce them inline; none carry logos.)

## SettingsSection (`.set-sec`)
- Source: `entrypoints/dashboard/index.html` + CSS in `extension/dashboard/dashboard.css`
- Category: layout
- Description: The drawer's section wrapper — accent-tinted h3 title + optional muted description + one control group; 20px gap rhythm between sections.
- Extractable props: `title` (string), `description` (string, optional)
- Hardcoded: accent h3 color, section gaps, danger variant (`.danger-zone` swaps border/background/title color)

## RadioRow (`.radio`)
- Source: `src/dashboard/components/ThemeRadios.tsx` (consumer) + `.radio` CSS
- Category: basic
- Description: Radio-card row — soft-surface radius, accent border + accent-soft fill when checked, native radio + strong label + muted hint.
- Extractable props: `checked` (boolean), `title` (string), `hint` (string)
- Hardcoded: accent tokens, `--r-surface` radius, padding `--sp-3`

## SwitchRow (`.switch-box` / `.switch`)
- Source: `src/dashboard/components/BehaviorSwitches.tsx` + `.switch` CSS
- Category: basic
- Description: 42×24 pill switch (18px knob slides to the inline-end when on; amber track) with 13px/600 label.
- Extractable props: `checked` (boolean), `label` (string)
- Hardcoded: track/knob geometry, amber checked state

## ColorDot (`.cdot`)
- Source: `src/dashboard/components/ColorDots.tsx` + CSS
- Category: basic
- Description: 34px round swatch button, 20px inner dot, active = amber ring + soft halo + white ✓.
- Extractable props: `color` (hex), `active` (boolean)
- Hardcoded: sizes, ring halo, check glyph

## HostChip (`.hchip`)
- Source: `src/dashboard/components/DisabledHosts.tsx` + CSS
- Category: basic
- Description: Amber pill chip (LTR-forced host text) with a small round remove button; add-row = 40px input + ghost button.
- Extractable props: `host` (string), `onRemove` (event)
- Hardcoded: amber soft/line tokens, pill radius

## SegmentedControl (`.seg`)
- Source: `entrypoints/dashboard/index.html` (`.seg`) + CSS
- Category: basic
- Description: Compact radio segmented control (active segment = accent-soft pill with accent text) — used for sort order.
- Extractable props: `options` (list), `value`
- Hardcoded: 2px gap, pill radius

## TopbarActions
- Source: `src/dashboard/components/PageChrome.tsx` (`TopbarActionsRegion`)
- Category: layout
- Description: Topbar action row — ghost buttons with icon+label (booklet, selective export), primary icon-only export button, ghost icon-only settings button, size badge; all 40px tall.
- Extractable props: none meaningful (page-owned)
- Hardcoded: icons from `pageIcons.tsx`, button classes, size badge

## CountPill (`.chip` / `.dir-sec-count`)
- Source: `extension/dashboard/dashboard.css` (`.chip`) + `DirSection.tsx`
- Category: basic
- Description: Light-blue info capsule for counts (11.5px/700, pill); the muted `.dir-sec-count` is the quiet variant.
- Extractable props: `count` (number)
- Hardcoded: `--info-*` tokens, pill radius
