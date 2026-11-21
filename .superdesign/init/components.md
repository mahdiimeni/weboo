# Weboo — Shared UI Components (with full source)

Framework: **React 19** (no meta-framework — this is a Chrome MV3 extension built with WXT).
**No Tailwind** — styling is vanilla CSS with a token system (`extension/globals.css` + `extension/dashboard/dashboard.css`).
**RTL-first**: the dashboard shell is `<html lang="fa" dir="rtl">`; all spacing uses CSS logical properties (`padding-inline`, `inset-inline-start`…).
**Persian source copy** — UI strings render through an i18n dictionary (`t(key)`); 12 UI languages, fa/ar are RTL.
Control height is exactly **40px** (`.btn`, `.icon-btn`, text inputs). Spacing rides a 4px grid (`--sp-2/3/4/5`).

There is NO generic `Button.tsx`/`Input.tsx` — primitives are **CSS classes** (`.btn`, `.btn-ghost`, `.btn-primary`, `.btn-danger`, `.icon-btn`, `.switch`, `.radio`) rendered by the React components below. Icons are inline SVG components (lucide-style strokes, `currentColor`).

## ThemeRadios
- Source: `src/dashboard/components/ThemeRadios.tsx`
- Radio-card list for the appearance theme (auto/light/dark). Registry-driven.

```tsx
import type { ThemeKey } from "../../types/settings";
import { THEME_KEYS } from "../../../extension/shared/constants.js";
import { t } from "../../../extension/shared/i18n.js";
import type { TranslationKey } from "../../shared/i18n";

export const THEME_HINTS: Record<string, TranslationKey> = {
  auto: "theme.autoHint",
  light: "theme.lightHint",
  dark: "theme.darkHint",
};

export function ThemeRadios({ theme, onSelect }: { theme: ThemeKey; onSelect: (key: ThemeKey) => void }) {
  const KEYS = THEME_KEYS as ThemeKey[];
  const cur = KEYS.indexOf(theme) !== -1 ? theme : "auto";
  return (
    <>
      {KEYS.map((k) => (
        <label className="radio" key={k}>
          <input
            type="radio"
            name="hlx-theme"
            value={k}
            checked={k === cur}
            onChange={() => { if (k !== cur) onSelect(k); }}
          />
          <span className="radio-txt">
            <strong>{t(("theme." + k) as TranslationKey)}</strong>
            <span className="muted small">{THEME_HINTS[k] ? t(THEME_HINTS[k]) : ""}</span>
          </span>
        </label>
      ))}
    </>
  );
}
```

## ColorDots
- Source: `src/dashboard/components/ColorDots.tsx`
- Default-highlight-color picker: round color dots, active one gets a ring + ✓.

```tsx
import type { HighlightColor } from "../../types/highlight";
import { COLOR_KEYS, COLORS } from "../../../extension/shared/constants.js";
import { t } from "../../../extension/shared/i18n.js";
import type { TranslationKey } from "../../shared/i18n";

export function ColorDots({ defaultColor, onSelect }: { defaultColor: HighlightColor; onSelect: (key: HighlightColor) => void }) {
  const KEYS = COLOR_KEYS as HighlightColor[];
  return (
    <>
      {KEYS.map((k) => {
        const c = COLORS[k];
        const active = k === defaultColor;
        return (
          <button
            type="button"
            className={"cdot" + (active ? " active" : "")}
            key={k}
            data-key={k}
            role="radio"
            title={t("dots.title", { name: t(("color." + k) as TranslationKey) })}
            aria-label={t(("color." + k) as TranslationKey)}
            aria-checked={active ? "true" : undefined}
            onClick={() => { if (!active) onSelect(k); }}
          >
            <span className="dot" style={{ background: c.dot }} />
          </button>
        );
      })}
    </>
  );
}
```

## BehaviorSwitches
- Source: `src/dashboard/components/BehaviorSwitches.tsx`
- Two toggle switches (floating toolbar on selection / badge counter).

```tsx
import { t } from "../../../extension/shared/i18n.js";

interface Props {
  showToolbar: boolean;
  showBadge: boolean;
  onToggle: (key: "showToolbar" | "showBadge", value: boolean) => void;
}

export function BehaviorSwitches({ showToolbar, showBadge, onToggle }: Props) {
  return (
    <>
      <label className="switch-box">
        <span className="switch">
          <input
            type="checkbox"
            id="set-toolbar"
            checked={showToolbar}
            onChange={(e) => onToggle("showToolbar", e.target.checked)}
          />
          <span className="track"><span className="knob" /></span>
        </span>
        <span className="switch-lbl">{t("behavior.toolbar")}</span>
      </label>
      <label className="switch-box">
        <span className="switch">
          <input
            type="checkbox"
            id="set-badge"
            checked={showBadge}
            onChange={(e) => onToggle("showBadge", e.target.checked)}
          />
          <span className="track"><span className="knob" /></span>
        </span>
        <span className="switch-lbl">{t("behavior.badge")}</span>
      </label>
    </>
  );
}
```

## LanguageSelect
- Source: `src/dashboard/components/LanguageSelect.tsx`
- UI-language dropdown (12 languages; fa/ar RTL).

```tsx
import type { Language } from "../../types/settings";
import { LANGUAGES, LANG_KEYS, t } from "../../../extension/shared/i18n.js";

export function LanguageSelect({ lang, onSelect }: { lang: Language; onSelect: (key: Language) => void }) {
  const cur = LANG_KEYS.indexOf(lang) !== -1 ? lang : "fa";
  return (
    <select
      id="language-select"
      className="lang-select"
      value={cur}
      onChange={(e) => { const k = e.target.value as Language; if (k !== cur) onSelect(k); }}
      aria-label={t("lang.groupAria")}
    >
      {(LANG_KEYS as Language[]).map((k) => (
        <option key={k} value={k}>{t(LANGUAGES[k].label)}</option>
      ))}
    </select>
  );
}
```

## DisabledHosts
- Source: `src/dashboard/components/DisabledHosts.tsx`
- Per-site off-switch: chips with remove buttons + an add-input row.

```tsx
import { useRef } from "react";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { toast } from "../toast";
import { t } from "../../../extension/shared/i18n.js";

const XIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface Props {
  hosts: string[];
  onRemove: (host: string) => Promise<void> | void;
  onAdd: (host: string) => Promise<void>;
}

export function DisabledHosts({ hosts, onRemove, onAdd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function commit() {
    const el = inputRef.current;
    const h = dash.sanitizeHost(el ? el.value : "");
    if (!h) { toast(t("hosts.invalid"), "error"); return; }
    if (hosts.indexOf(h) !== -1) { toast(t("hosts.duplicate"), "info"); return; }
    try {
      await onAdd(h);
      if (el) el.value = "";
      toast(t("hosts.disabledOk", { host: h }), "success");
    } catch (e) {
      toast(t("common.saveFail"), "error");
    }
  }

  async function remove(h: string) {
    try { await onRemove(h); } catch (e) { toast(t("common.saveFail"), "error"); }
  }

  return (
    <>
      <h3>{t("hosts.title")}</h3>
      <p className="muted small">{t("hosts.desc")}</p>
      <div className="host-chips" id="host-chips">
        {hosts.length === 0
          ? <p className="muted small">{t("hosts.empty")}</p>
          : hosts.map((h) => (
            <span className="hchip" key={h}>
              {h}
              <button type="button" className="hchip-x" title={t("hosts.removeTitle", { host: h })} aria-label={t("hosts.removeTitle", { host: h })} onClick={() => { void remove(h); }}>
                <XIcon />
              </button>
            </span>
          ))}
      </div>
      <div className="host-add">
        <input
          type="text"
          id="host-input"
          ref={inputRef}
          placeholder={t("hosts.addPlaceholder")}
          aria-label={t("hosts.inputAria")}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commit(); } }}
        />
        <button type="button" className="btn btn-ghost" id="host-add" onClick={() => { void commit(); }}>{t("common.add")}</button>
      </div>
    </>
  );
}
```

## ArmIconButton / IconButton
- Source: `src/dashboard/components/ArmIconButton.tsx`
- Icon button primitives; the armed variant is a two-step confirm (arm → text → confirm, 3.2s timeout).

```tsx
import { useEffect, useRef, useState } from "react";
import { IconCopy, IconTrash, IconView, IconX } from "./icons";
import { t } from "../../../extension/shared/i18n.js";

const GLYPHS = { view: IconView, copy: IconCopy, trash: IconTrash, x: IconX } as const;
export type ArmIcon = keyof typeof GLYPHS;

export function IconButton({ icon, title, className, onClick }: {
  icon: ArmIcon; title: string; className?: string; onClick: () => void;
}) {
  const Glyph = GLYPHS[icon];
  return (
    <button type="button" className={"icon-btn" + (className ? " " + className : "")}
      title={title} aria-label={title} onClick={onClick}>
      <Glyph />
    </button>
  );
}

export function ArmIconButton({ icon, title, className, confirmText = t("common.confirm"), onConfirm }: {
  icon: ArmIcon; title: string; className?: string; confirmText?: string; onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function click(ev: React.MouseEvent) {
    ev.stopPropagation();
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3200);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    onConfirm();
  }
  const Glyph = GLYPHS[icon];
  return (
    <button type="button"
      className={"icon-btn" + (className ? " " + className : "") + (armed ? " armed" : "")}
      title={title} aria-label={title} aria-pressed={armed ? "true" : undefined} onClick={click}>
      {armed ? confirmText : <Glyph />}
    </button>
  );
}
```

## DirSection (list page — for context)
- Source: `src/dashboard/components/DirSection.tsx`
- Collapsible RTL/LTR article-group sections with count pills and a «آخرین هایلایت» lead badge; header IS the toggle. (Full source in `layouts.md` sibling files; the visual pattern matters more than logic.)

## CSS primitives (the "component library" — `extension/dashboard/dashboard.css`)
These are the classes every section uses ( excerpts with exact values):

```css
.btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 40px; padding: 0 var(--sp-4);
  border: 1px solid transparent; border-radius: var(--r-ctl);
  font: inherit; font-size: 13.5px; font-weight: 700; line-height: 1.5;
  cursor: pointer;
  transition: background var(--motion), color var(--motion), border-color var(--motion);
}
.btn-primary { background: var(--primary); color: var(--primary-foreground); }
.btn-ghost { background: var(--card); color: var(--text); border-color: var(--line); }
.btn-ghost:hover { background: var(--hover); }
.btn-danger { background: var(--danger); color: #fff; }
.btn:active, .icon-btn:active, .cdot:active, .hchip-x:active { transform: var(--press); }
.btn.armed { background: var(--danger-bg) !important; color: var(--danger-h) !important; border-color: var(--danger-line) !important; }
.icon-btn { width: 40px; height: 40px; display: inline-grid; place-items: center; border: 1px solid transparent; border-radius: var(--r-ctl); background: transparent; color: var(--muted); cursor: pointer; }
.icon-btn:hover { background: var(--hover); color: var(--text); }

.radio { display: flex; align-items: flex-start; gap: 10px; border: 1px solid var(--line); border-radius: var(--r-surface); padding: var(--sp-3); cursor: pointer; transition: border-color var(--motion), background var(--motion); }
.radio:hover { border-color: var(--accent); }
.radio:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
.radio input { margin-top: 5px; accent-color: var(--accent); flex: none; }

.switch-box { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; }
.switch { position: relative; display: inline-block; flex: none; }
.switch input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.switch .track { display: block; width: 42px; height: 24px; border-radius: 999px; background: var(--toggle); transition: background var(--motion); }
.switch .knob { position: absolute; top: 3px; inset-inline-start: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--card); box-shadow: var(--shadow); transition: inset-inline-start var(--motion) var(--motion-ease); }
.switch input:checked ~ .track { background: var(--accent); }
.switch input:checked ~ .track .knob { inset-inline-start: calc(100% - 21px); }

.set-sec { display: flex; flex-direction: column; gap: 10px; }
.set-sec h3 { margin: 0; font-size: 13.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: var(--accent-h); }

.cdot { width: 34px; height: 34px; border-radius: 50%; border: 2px solid transparent; background: transparent; display: grid; place-items: center; cursor: pointer; flex: none; position: relative; }
.cdot .dot { width: 20px; height: 20px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .14); }
.cdot.active { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.cdot.active::after { content: '✓'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -52%); color: #fff; font-size: 13px; font-weight: 800; text-shadow: 0 0 4px rgba(0, 0, 0, .55); }

.hchip { display: inline-flex; align-items: center; gap: 6px; background: var(--accent-soft); color: var(--accent-h); border: 1px solid var(--accent-line); border-radius: 999px; padding: 3px 6px 3px 10px; font-size: 12.5px; font-weight: 700; direction: ltr; }

.chip { font-size: 11.5px; font-weight: 700; color: var(--info-h); background: var(--info-soft); border: 1px solid var(--info-line); padding: 2px 10px; border-radius: 999px; }
```

## pageIcons (topbar/drawer icons)
- Source: `src/dashboard/components/pageIcons.tsx` — small inline-SVG React components (booklet, export, settings, danger) with `currentColor` strokes. Icons reproduce 1:1 from this file.
