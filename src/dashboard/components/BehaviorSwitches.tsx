/**
 * Phase 8 Task 4 slice 7 — the «رفتار» switches as a React component.
 *
 * Replaces the controller's els.setToolbar/setBadge change listeners. The
 * switch markup contract is byte-equal (label.switch-box > span.switch >
 * input + .track > .knob, then span.switch-lbl); checked state mirrors the
 * settings snapshot (the data layer's optimistic update makes the toggle
 * instant), onToggle reports {key, value}.
 */
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
        <span className="switch-lbl">نمایش نوار ابزار هنگام انتخاب متن</span>
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
        <span className="switch-lbl">نمایش شمارنده روی آیکون</span>
      </label>
    </>
  );
}
