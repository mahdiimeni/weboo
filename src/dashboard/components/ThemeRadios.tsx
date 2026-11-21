/**
 * Phase 8 Task 4 slice 7 — the «ظاهر» theme picker as a React component.
 *
 * Replaces the view's buildThemeRadios() writes into #theme-radios. Registry
 * driven (THEME_KEYS/THEMES from constants.js — a new theme = a registry
 * entry); the hints stay the single source in dashboard-view.js until Task 5.
 *
 * v0.23.0 «grouped & quieter»: the vertical .radio list became a ONE-ROW
 * family of preview mini-cards — label.tcard > hidden radio input + the
 * mini canvas (.tcard-prev, per-theme variant) + the label. The radio
 * contract survives (input[name=hlx-theme][value], checked mirrors the
 * setting, onChange reports); each card's hint rides the title attribute.
 *
 * The visual theme side-effect (ui.applyThemeNow, the classic theme-boot
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
    <div className="theme-cards">
      {KEYS.map((k) => (
        <label
          className={"tcard" + (k === cur ? " active" : "")}
          key={k}
          title={THEME_HINTS[k] ? t(THEME_HINTS[k]) : ""}
        >
          <input
            type="radio"
            name="hlx-theme"
            value={k}
            checked={k === cur}
            onChange={() => { if (k !== cur) onSelect(k); }}
          />
          <span className={"tcard-prev tcard-prev-" + k} aria-hidden="true">
            <span className="tp-bar" />
            <span className="tp-line" />
            <span className="tp-dot" />
          </span>
          <span className="tcard-txt">
            <strong>{t(("theme." + k) as TranslationKey)}</strong>
          </span>
        </label>
      ))}
    </div>
  );
}
