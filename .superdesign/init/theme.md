# Weboo — Theme Tokens

## Part 1 — Compact token summary

**Design language**: «Air» — airy light canvas with soft ambient color glows, glass topbar, one big soft radius family, low-ambient shadows. Amber accent on graphite neutrals. Vazirmatn-first local font stack (no webfonts, offline CSP-safe).

### Page palette — light (dashboard.css `:root`; frozen by tests, exact values)
| token | value | role |
|---|---|---|
| `--bg` | `#f3f4f6` | page base (flat value; the light canvas paints `--bg-grad` over it) |
| `--card` | `#fff` | surfaces |
| `--text` | `#1f2937` | body text |
| `--muted` | `#4b5563` | meta text |
| `--line` | `#d1d5db` | hairlines/borders |
| `--accent` | `#d97706` | amber accent (controls, active states) |
| `--accent-h` | `#b45309` | amber text/hover |
| `--accent-soft` | `#fef3c7` | amber soft fill |
| `--accent-line` | `rgba(217,119,6,.45)` | amber outline |
| `--hover` | `#e5e7eb` | hover wash |
| `--toggle` | `#d1d5db` | switch track off-state |
| `--danger` / `-h` / `-bg` / `-line` | `#dc2626` / `#b91c1c` / `#fee2e2` / `#fca5a5` | danger family |
| `--info-h` / `-soft` / `-line` | `#1d4ed8` / `#dbeafe` / `rgba(59,130,246,.45)` | light-blue count capsules |
| `--shadow` | `0 1px 3px rgba(17,24,39,.1)` | flat card shadow |
| `--glass` | `color-mix(in srgb, var(--card) 74%, transparent)` | translucent topbar |
| `--hairline` / `--edge` | `color-mix(... 55% / 62% ...)` | softened borders |

**Light canvas gradient** (`--bg-grad`, light theme only):
```css
radial-gradient(1100px 560px at 88% -10%, rgba(251,191,36,.14), transparent 68%),
radial-gradient(950px 520px at 4% 112%, rgba(147,197,253,.16), transparent 68%),
radial-gradient(720px 420px at 102% 104%, rgba(216,180,254,.10), transparent 72%),
linear-gradient(170deg, #fbfbfd 0%, #f5f4f8 50%, #f1f4f8 100%);
```

### Page palette — dark (`:root[data-theme="dark"]` and system-dark; ⚠️ exact-frozen by tests — «دارک دست نزن»)
| token | value |
|---|---|
| `--bg` | `#111318` |
| `--card` | `#1a1d24` |
| `--text` | `#e5e7eb` |
| `--muted` | `#9ca3af` |
| `--line` | `#2a2f3a` |
| `--accent` / `--accent-h` | `#f59e0b` / `#fbbf24` |
| `--accent-soft` / `--accent-line` | `#2f2510` / `rgba(217,119,6,.3)` |
| `--hover` | `#22262f` |
| `--toggle` | `#4b5563` |
| `--danger` family | `#ef4444` / `#f87171` / `#2b1313` / `#5c1f1f` |
| `--info` family | `#93c5fd` / `#1b2a45` / `rgba(96,165,250,.35)` |
| `--shadow` | `0 1px 2px rgba(0,0,0,.4)` |

### Graphite layer (`extension/globals.css`, loaded FIRST; the page palettes above shadow 4 colliding names)
- Radius: `--radius: 0.875rem`; `--shape-control/field = radius−2px`, `--shape-surface = radius+12px`, `--shape-overlay = radius+4px`
- Depth: cards **flat** (`--depth-control/field/press: 0 0 #0000`), surfaces low-ambient (`--depth-surface: 0 1px 2px oklch(0 0 0/.4%), 0 12px 32px -18px oklch(0 0 0/14%)`), overlays floating (`--depth-overlay: 0 24px 64px -24px oklch(0 0 0/30%)`)
- Motion: `--motion: 200ms`, `--motion-ease: cubic-bezier(.2,0,0,1)`, press = `scale(0.98)`
- Role mapping: `--primary: var(--text)`, `--primary-foreground: var(--bg)`, `--destructive: var(--danger)`, `--brand: oklch(0.8 0.165 65)` (amber)
- Spacing: `--spacing: 0.25rem`; consumed as `--sp-2` (8px), `--sp-3` (12px), `--sp-4` (16px), `--sp-5` (24px)

### Type & controls
- Font stack (every UI language): `"Vazirmatn", "Segoe UI", Tahoma, "Helvetica Neue", system-ui, sans-serif` — **no external font imports** (offline CSP-safe)
- Scale: body 13–13.5px, section titles 13.5–14.5px (weight 700–800), page title 16px/800, stat numbers 27px/800, meta 11–12.5px
- Line-heights: body 1.8, headings ~1.2–1.4, buttons/labels 1.5
- `letter-spacing: 0` everywhere (Persian), no `text-transform: uppercase`
- Control height: exactly **40px** (`.btn`, `.icon-btn`, text inputs); dots 34px; switches 42×24 (knob 18)
- Highlight colors (content marks + dots): yellow `#f5b800`, orange `#f0821c`, green `#58b85c`, teal `#35b3ae`, pink `#e5679b`, purple `#a478e8`

### Constraints that MUST hold in any redesign
- RTL-first (`dir="rtl"`), logical CSS properties only, no `flex-direction: row-reverse` hacks
- Persian digits ۰–۹ for user-visible numbers (fa UI), Jalali dates
- Dark palette values are EXACT-frozen by tests; light palette has contrast floors
- No new hex inside component rules — tokens only; amber `--accent` is the accent, `--primary` (text-color inversion) for primary actions

## Part 2 — Raw source dumps

### `extension/globals.css` (full, 87 lines)
```css
/* Weboo — globals.css — the VibeFarsi "Graphite" design-system tokens plus the Weboo mapping layer.
   LOAD ORDER CONTRACT: linked BEFORE dashboard.css / popup.css. Four graphite names collide with
   Weboo's contract-frozen palette vars (--card, --muted, --line, --accent): the page stylesheets
   load later and win those names by cascade. Components read the graphite ROLE tokens (--primary,
   --primary-foreground, --shape-*, --depth-*, --brand, --destructive…) resolved theme-correctly. */
:root {
  color-scheme: dark;
  --background: oklch(0.115 0.002 285);
  --foreground: oklch(0.975 0 0);
  --card: oklch(0.14 0.002 285);
  --card-foreground: oklch(0.975 0 0);
  --popover: oklch(0.16 0.002 285);
  --popover-foreground: oklch(0.975 0 0);
  --primary: oklch(0.975 0 0);
  --primary-foreground: oklch(0.13 0 0);
  --secondary: oklch(0.2 0.002 285);
  --secondary-foreground: oklch(0.975 0 0);
  --muted: oklch(0.175 0.002 285);
  --muted-foreground: oklch(0.63 0.004 285);
  --accent: oklch(0.2 0.002 285);
  --accent-foreground: oklch(0.975 0 0);
  --destructive: oklch(0.65 0.2 25);
  --success: oklch(0.75 0.16 160);
  --warning: oklch(0.82 0.16 80);
  --border: oklch(1 0 0 / 8%);
  --input: oklch(1 0 0 / 11%);
  --ring: oklch(0.7 0 0);
  --brand: oklch(0.8 0.165 65);
  --brand-foreground: oklch(0.22 0.06 60);
  --radius: 0.875rem;
  --type-display-weight: 700;
  --shape-control: calc(var(--radius) - 2px);
  --shape-field: calc(var(--radius) - 2px);
  --shape-surface: calc(var(--radius) + 12px);
  --shape-overlay: calc(var(--radius) + 4px);
  --line: 1px;
  --line-field: 1px;
  --line-style: solid;
  --field: color-mix(in oklch, var(--background) 60%, transparent);
  --depth-control: 0 0 #0000;
  --depth-press: 0 0 #0000;
  --depth-field: 0 0 #0000;
  --depth-surface: 0 1px 2px oklch(0 0 0 / 4%), 0 12px 32px -18px oklch(0 0 0 / 14%);
  --depth-overlay: 0 24px 64px -24px oklch(0 0 0 / 30%);
  --surface-filter: none;
  --press: scale(0.98);
  --motion: 200ms;
  --motion-ease: cubic-bezier(0.2, 0, 0, 1);
  --backdrop: none;
  --spacing: 0.25rem;
}
/* ---------- Weboo mapping ---------- */
:root {
  --primary: var(--text);
  --primary-foreground: var(--bg);
  --destructive: var(--danger);
  --r-ctl: var(--shape-control);
  --r-surface: var(--shape-surface);
  --r-overlay: var(--shape-overlay);
  --sp-2: calc(var(--spacing) * 2);
  --sp-3: calc(var(--spacing) * 3);
  --sp-4: calc(var(--spacing) * 4);
  --sp-5: calc(var(--spacing) * 5);
}
```
*(The file continues with the shared font-family stack and body resets — see the repo file for those few lines.)*

### `extension/dashboard/dashboard.css` — palette + radii + font (lines 1–110)
See Part 1 tables above; the raw `:root` light palette, the `@media (prefers-color-scheme: dark)` block and the `:root[data-theme="dark"]` block are byte-identical to the values tabulated in Part 1 (the repo file `extension/dashboard/dashboard.css` lines 1–110 is the source of truth).

### Radius/motion tokens actually used by components
```css
--r-ctl: calc(var(--radius) - 2px);        /* 12px — buttons, inputs, small controls */
--r-surface: calc(var(--radius) + 12px);   /* 26px — cards, radio rows, drawer, sections */
--r-overlay: calc(var(--radius) + 4px);    /* 18px — modals */
--motion: 200ms; --motion-ease: cubic-bezier(0.2, 0, 0, 1); --press: scale(0.98);
```
