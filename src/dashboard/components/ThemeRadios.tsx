/**
 * Phase 8 Task 4 slice 7 — the «ظاهر» theme radios as a React component.
 *
 * Replaces the view's buildThemeRadios() writes into #theme-radios. Registry
 * driven (THEME_KEYS/THEMES from constants.js — a new theme = a registry
 * entry); the hints stay the single source in dashboard-view.js until Task 5
 * retires it. Markup contract byte-equal: label.radio > input[type=radio
 * name=hlx-theme] + span.radio-txt > strong + span.muted.small.
 *
 * The visual theme side-effect (HL.applyThemeNow, the classic theme-boot
 * contract) stays with the caller — this component only reports selection.
 */
import type { ThemeKey } from "../../types/settings";
import { THEME_KEYS, THEMES } from "../../../extension/shared/constants.js";
import { dashView } from "../../../extension/dashboard/dashboard-view.js";

export function ThemeRadios({ theme, onSelect }: { theme: ThemeKey; onSelect: (key: ThemeKey) => void }) {
  const cur = (THEME_KEYS as string[]).indexOf(theme) !== -1 ? theme : "auto";
  return (
    <>
      {THEME_KEYS.map((k) => (
        <label className="radio" key={k}>
          <input
            type="radio"
            name="hlx-theme"
            value={k}
            checked={k === cur}
            onChange={() => { if (k !== cur) onSelect(k); }}
          />
          <span className="radio-txt">
            <strong>{THEMES[k].label}</strong>
            <span className="muted small">{dashView.THEME_HINTS[k] || ""}</span>
          </span>
        </label>
      ))}
    </>
  );
}
