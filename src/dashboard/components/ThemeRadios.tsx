/**
 * Phase 8 Task 4 slice 7 — the «ظاهر» theme radios as a React component.
 *
 * Replaces the view's buildThemeRadios() writes into #theme-radios. Registry
 * driven (THEME_KEYS/THEMES from constants.js — a new theme = a registry
 * entry); the hints stay the single source in dashboard-view.js until Task 5
 * Markup contract byte-equal: label.radio > input[type=radio
 * name=hlx-theme] + span.radio-txt > strong + span.muted.small.
 *
 * The visual theme side-effect (HL.applyThemeNow, the classic theme-boot
 * contract) stays with the caller — this component only reports selection.
 */
import type { ThemeKey } from "../../types/settings";
import { THEME_KEYS } from "../../../extension/shared/constants.js";
import { t } from "../../../extension/shared/i18n.js";
import type { TranslationKey } from "../../shared/i18n";
/* Short description of each theme (ex-dashView.THEME_HINTS — the view
   retired with Task 5) as i18n keys (v0.14.0). */
export const THEME_HINTS: Record<string, TranslationKey> = {
  auto: "theme.autoHint",
  light: "theme.lightHint",
  dark: "theme.darkHint",
};

export function ThemeRadios({ theme, onSelect }: { theme: ThemeKey; onSelect: (key: ThemeKey) => void }) {
  /* the registry keys are plain strings at runtime — the ThemeKey union
     is the compile-time view (types-contract pins the parity) */
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
