# AGENTS.md — Weboo (وبو)

Project rules for every agent working in this repository. The full Persian/RTL
rule source is [`docs/agents-md-persian.md`](docs/agents-md-persian.md)
(installed from vibefarsi; the bracketed choices below are already filled for
Weboo). The craft side lives in [`docs/ui-craft-rules.md`](docs/ui-craft-rules.md)
and the skills in `.claude/skills/`.

## Persian / RTL rules for this project

This product is for Persian (Farsi) speakers in Iran. Apply these rules to
every file you touch, without being reminded.

### Language and register
- All user-facing text is Persian: labels, placeholders, errors, empty states,
  toasts, `aria-label`, page titles, metadata. Code identifiers, props, file
  names, commit messages stay English.
- Register: **light conversational («میشه»، «می‌تونید»، «کنید»)** — this is what
  the shipped UI already speaks. Never mix with the formal register in one
  screen. Never «می‌باشد»، «لازم به ذکر است»، «در راستای».
- No English defaults in copy: never «Oops», «Something went wrong»,
  «Submit», «Loading».
- Orthography: ZWNJ (نیم‌فاصله) in compounds (می‌شود، ثبت‌نام، سفارش‌ها),
  Persian ی and ک, «گیومه» for quotes, «،» «؟» punctuation, no em dashes.

### Direction and layout
- `<html lang="fa" dir="rtl">` is set once in each page shell; nothing else
  sets `dir` except LTR islands (file names, URLs, code, the LTR demo cards).
- Logical CSS properties only: `padding-inline`/`margin-inline`,
  `inset-inline-start/end`, `text-align: start`, `border-inline-start`. Never
  physical `padding-left`, `margin-right`, `left:`, `text-align: left`,
  `border-left` on RTL content.
- Do not use `flex-direction: row-reverse` to "fix" RTL order.
- "Next"/"submit" arrows point left; the drawer opens from the start edge.

### Typography
- Font: the **Vazir/Vazirmatn local stack** (already declared in the
  stylesheets and the booklet's font registry). Weboo deliberately bundles no
  webfont and imports none — the extension is offline and CSP-safe; never add
  external font imports.
- `letter-spacing: 0` on Persian; no `text-transform: uppercase`.
- Body line-height 1.8; headings ≥ 1.2; buttons/labels 1.5 (the control
  system: buttons and inputs are exactly 40px tall).

### Numbers, money, dates
- Visible digits are Persian ۰–۹ through **`format.faNum` — the one home**
  (`extension/shared/format.js`); values, URLs, API payloads keep Latin digits.
- Dates are Jalali through `format.fmtDate` (same module); store timestamps
  as UTC epoch numbers.
- There is no money in Weboo — don't invent currency formatting.

### Forms and validation
- Label above the field; placeholder is an example, not a label.
- Errors appear as Persian toasts near the action, specific, never generic.

### Components and colors
- VibeFarsi components are VENDORED at `components/ui/` (button, calendar,
  price — with `lib/utils.ts`/`lib/jalali.ts`; typed by the root tsconfig).
  They are Tailwind-styled upstream: when ADOPTING one into the extension,
  port its classes to Weboo's token system (no Tailwind in this repo) —
  styling comes from **Weboo's own token system**: palette vars live in
  `extension/dashboard/dashboard.css` and `extension/popup/popup.css`
  (`--bg/--card/--text/--muted/--line/--accent/--danger/--info`, **frozen by
  `tests/unit/uitheme.test.ts`** — «دارک دست نزن»: the dark values are exact-
  pinned, the light values have contrast floors). Never add a fresh hex/oklch
  to a component rule.
- Shape/depth/motion/spacing ride the **Graphite token layer in
  `extension/globals.css`** (loaded FIRST in both shells; the page palettes
  deliberately shadow its four colliding names): components read `--r-*`
  (mapped to `--shape-control/surface/overlay`), `--press` (scale 0.98),
  `--depth-*` (cards are flat + inset top highlight; only overlays get depth),
  `--primary/--primary-foreground` (theme-correct via the mapping) and
  `--sp-2/3/4/5` (the 4px grid). Do not hardcode a new radius, duration,
  shadow or off-grid padding; amber (`--accent`) is for small highlights —
  primary actions are `--primary`.
- Control height is 40px (`.btn`, `.icon-btn`, text inputs).

### Before you finish
- Grep the diff for physical properties: `padding-left|margin-right|left:|right:|text-align: left|letter-spacing` on Persian content.
- Check every visible number went through `faNum` and every date through `fmtDate`.
- Read every new string aloud in Persian: would an Iranian product ship it?
- Run the gate: `bun run typecheck && bun run lint && bun run test && bun run build:wxt`.
