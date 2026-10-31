/**
 * v0.20.0 — the «زبان رابط کاربری» selector as a DROPDOWN (the LanguageRadios
 * replacement; same region contract, same data flow): registry-driven from
 * LANGUAGES in shared/i18n, the optimistic write + rollback rides App's
 * settings action, and applyLanguage (data.ts) remains the ONE write path —
 * texts, direction, dates and the static shell follow without a reload.
 *
 * Markup contract: select#language-select.lang-select inside the shell's
 * inner host (#language-select — the packaging test pins both); the options
 * carry the registry order (fa, en, de, …, ar) with the endonym/exonym name
 * pattern.
 */
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
