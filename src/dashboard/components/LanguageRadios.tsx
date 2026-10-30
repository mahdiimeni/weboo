/**
 * v0.14.0 — the «زبان رابط کاربری» language radios as a React component
 * (the ThemeRadios pattern, registry-driven from LANGUAGES in shared/i18n).
 *
 * Markup contract (mirrors the theme radios — the packaging test pins the
 * section shell): label.radio > input[type=radio name=hlx-language] +
 * span.radio-txt > strong + span.muted.small.
 *
 * The visual side-effect (document lang/dir, widget hosts, the "hlx:lang"
 * mirror, static shell texts) stays with the caller — data.ts's
 * applyLanguage is the ONE write path; this component only reports selection
 * (the optimistic setSettings + rollback rides App's settings action).
 */
import type { Language } from "../../types/settings";
import { LANGUAGES, t } from "../../../extension/shared/i18n.js";

export function LanguageRadios({ lang, onSelect }: { lang: Language; onSelect: (key: Language) => void }) {
  const KEYS = Object.keys(LANGUAGES) as Language[];
  const cur = KEYS.indexOf(lang) !== -1 ? lang : "fa";
  return (
    <>
      {KEYS.map((k) => (
        <label className="radio" key={k}>
          <input
            type="radio"
            name="hlx-language"
            value={k}
            checked={k === cur}
            onChange={() => { if (k !== cur) onSelect(k); }}
          />
          <span className="radio-txt">
            <strong>{t(LANGUAGES[k].label)}</strong>
          </span>
        </label>
      ))}
    </>
  );
}
