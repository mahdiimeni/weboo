# Weboo — Design System («Air» / Graphite)

## Product context
Weboo (وبو) is a local-first Chrome MV3 extension for highlighting web text (6 colors), attaching notes, and managing everything from a dashboard. 100% local — no server, no account. The audience reads in **Persian**; the UI is **RTL-first** with 12 interface languages (fa/ar RTL; others LTR). The extension deliberately bundles no webfonts (offline, CSP-safe).

- **Key surfaces**: dashboard (`dashboard.html` — stats, filter toolbar, article list, settings drawer, 4 modals), popup, in-page widgets (toolbar/popover/toast in Shadow DOM).
- **JTBD**: keep a personal reading library; the settings drawer configures appearance, language, default color, behavior toggles, per-site off-switch, backup restore, and the danger zone.
- **This target**: the dashboard's **settings drawer** — a 380px start-edge panel over a blurred overlay, opened by the topbar gear.

## Brand & styling

### Color
- **Light**: page `#f3f4f6` under a soft "Air" canvas gradient (amber/sky/lilac radial glows over `#fbfbfd→#f1f4f8`); cards `#fff`; text `#1f2937`; muted `#4b5563`; hairlines `#d1d5db`.
- **Dark**: page `#111318`, cards `#1a1d24`, text `#e5e7eb`, muted `#9ca3af`, lines `#2a2f3a` (exact-frozen values).
- **Accent**: amber — light `#d97706` (text/hover `#b45309`, soft `#fef3c7`), dark `#f59e0b` (text `#fbbf24`, soft `#2f2510`). Accent = small highlights, active states, checked controls; section titles are accent-tinted.
- **Primary action**: `--primary: var(--text)` inverted against `--bg` (near-black on light / near-white on dark) — NOT amber.
- **Danger family**: red set with soft bg + line tokens (light `#dc2626/#fee2e2/#fca5a5`, dark `#ef4444/#2b1313/#5c1f1f`).
- **Info family** (count capsules): light blue (`#1d4ed8` on `#dbeafe`; dark `#93c5fd` on `#1b2a45`).
- **Highlight palette** (the product's colors, also the default-color dots): yellow `#f5b800`, orange `#f0821c`, green `#58b85c`, teal `#35b3ae`, pink `#e5679b`, purple `#a478e8`.

### Typography
- Stack: `"Vazirmatn", "Segoe UI", Tahoma, "Helvetica Neue", system-ui, sans-serif`. No external fonts.
- Scale (≈6 sizes): 27px/800 (stat numbers), 16px/800 (brand), 14–15px/700–800 (titles), 13–13.5px (body/labels), 12–12.5px (meta), 11–11.5px/700 (pills).
- Line-height by role: body 1.8, headings 1.2–1.4, buttons/labels 1.5. `letter-spacing: 0`; never uppercase.

### Shape, depth, spacing, motion
- Radius family from `--radius: 0.875rem`: controls 12px (`--r-ctl`), surfaces 26px (`--r-surface`), overlays 18px (`--r-overlay`), pills 999px.
- Cards are **flat** with a low-ambient surface shadow; only overlays float (`--depth-overlay`). Topbar is glass (`backdrop-filter: blur`, 74% card mix).
- Spacing on a 4px grid: `--sp-2/3/4/5` = 8/12/16/24. Control height exactly **40px**; switches 42×24; color dots 34px.
- Motion: 200ms `cubic-bezier(.2,0,0,1)` on transform/opacity/background; press `scale(0.98)`; drawer slides, modals pop (0.18s scale .96→1).
- Overlays: `rgba(17,24,39,.45)` + `blur(4px)`; modal backdrop `.5` + `blur(6px)`.

### RTL discipline
- `<html lang="fa" dir="rtl">`; logical properties everywhere (`padding-inline`, `inset-inline-start`, `text-align: start`); the drawer opens from the start edge (left in RTL = the content-facing edge is rounded). Hostname/URL text islands are forced `direction: ltr`. Persian digits ۰–۹ in visible numbers; Jalali dates.

## Component inventory (settings drawer)
- `SettingsSection` — accent h3 + optional muted desc + control group; 20px inter-section rhythm
- `RadioRow` — soft radio-card, accent border + soft fill on checked (theme picker: auto/light/dark + hints)
- `LanguageSelect` — 40px dropdown, 12 languages
- `ColorDot` — 34px swatch; active = amber ring + halo + white ✓
- `SwitchRow` — 42×24 pill switch, amber when on
- `HostChip` — amber pill with remove ×; add row = LTR input + ghost button
- `RestoreSection` — full-width ghost button + hidden file input
- `DangerZone` — red-tinted panel; 3-step confirm (arm → type «حذف» → confirm)
- `.btn` family — 40px ghost/primary/danger buttons; `.icon-btn` 40px square

## Motion & interaction patterns
- Drawer slide + overlay fade (200ms); modal pop; press scale on all controls; hover washes (`--hover`); focus-visible 2px accent outlines; two-step arm confirmations for destructive actions; live Persian toasts for feedback.

## Hard constraints (never violate in drafts)
1. Only the tokens above — no new hex/colors/fonts/radii; the dark palette is exact-frozen.
2. RTL-first; logical properties; Persian copy as the source strings (fa shown in drafts).
3. 40px control height, 4px spacing grid, one radius family.
4. Amber = accent; primary action = text-inversion primary; danger = red family.
5. No lorem ipsum — use the real Persian strings from the shell (settings sections: ظاهر، زبان رابط کاربری، رنگ پیش‌فرض هایلایت، رفتار، سایت‌های غیرفعال، بازیابی پشتیبان، منطقه‌ی خطر).
