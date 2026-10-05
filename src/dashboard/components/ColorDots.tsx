/**
 * Phase 8 Task 4 slice 7 — the default-color dots as a React component.
 *
 * Replaces the view's buildColorDots() writes into #color-dots. Registry
 * driven (COLOR_KEYS/COLORS from constants.js). Markup contract byte-equal:
 * button.cdot[data-key][role=radio] with .active + aria-checked="true" on
 * the selection, title/aria-label «رنگ پیش‌فرض: <label>», span.dot colored
 * from the registry's dot value.
 */
import type { HighlightColor } from "../../types/highlight";
import { COLOR_KEYS, COLORS } from "../../../extension/shared/constants.js";

export function ColorDots({ defaultColor, onSelect }: { defaultColor: HighlightColor; onSelect: (key: HighlightColor) => void }) {
  return (
    <>
      {COLOR_KEYS.map((k) => {
        const c = COLORS[k];
        const active = k === defaultColor;
        return (
          <button
            type="button"
            className={"cdot" + (active ? " active" : "")}
            key={k}
            data-key={k}
            role="radio"
            title={"رنگ پیش‌فرض: " + c.label}
            aria-label={c.label}
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
