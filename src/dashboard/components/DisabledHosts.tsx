/**
 * Phase 8 Task 4 slice 2 — the «سایت‌های غیرفعال» settings section as a
 * React component.
 *
 * Replaces the controller's renderHostChips call (view builder), addHost()
 * and its two listeners. The DOM contract stays byte-equal: section host
 * (React owns the children) → h3 + p.muted.small + #host-chips (.hchip >
 * text + button.hchip-x, or the empty-state p.muted.small) + .host-add
 * (#host-input + #host-add).
 *
 * The input is deliberately UNCONTROLLED (ref + read at commit) — exactly
 * like the original shell input the controller read at addHost time; nothing
 * re-renders it externally, and keeping it uncontrolled preserves the
 * imperative-typing semantics (and keeps the test harness free of React's
 * synthetic change-extraction quirks under happy-dom).
 *
 * Validation/toast orchestration lives here (it is UI behavior); the
 * host sanitizing stays the ONE source (dash.sanitizeHost); persistence is
 * injected (onAdd/onRemove) — the data layer owns the optimistic write +
 * rollback, this component only reacts with the same toasts the controller
 * raised (invalid / duplicate / success / storage failure).
 */
import { useRef } from "react";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { toast } from "../toast";

const XIcon = () => (
  /* dashView.ICONS.x — width 12, stroke-width 2.4, no linejoin (byte-equal) */
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface Props {
  hosts: string[];
  /** persist the removal — resolves when storage accepted it */
  onRemove: (host: string) => Promise<void> | void;
  /** persist the addition — rejects on storage failure (rollback upstream) */
  onAdd: (host: string) => Promise<void>;
}

export function DisabledHosts({ hosts, onRemove, onAdd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function commit() {
    const el = inputRef.current;
    const h = dash.sanitizeHost(el ? el.value : "");
    if (!h) { toast("دامنه‌ی معتبر وارد کن (مثل example.com)", "error"); return; }
    if (hosts.indexOf(h) !== -1) { toast("این دامنه قبلاً اضافه شده است", "info"); return; }
    try {
      await onAdd(h);
      if (el) el.value = "";
      toast("سایت " + h + " غیرفعال شد", "success");
    } catch (e) {
      toast("ذخیره تنظیمات ناموفق بود", "error");
    }
  }

  async function remove(h: string) {
    try {
      await onRemove(h);
    } catch (e) {
      toast("ذخیره تنظیمات ناموفق بود", "error");
    }
  }

  return (
    <>
      <h3>سایت‌های غیرفعال</h3>
      <p className="muted small">روی این سایت‌ها هایلایت ساخته یا نمایش داده نمی‌شود (داده‌ها حذف نمی‌شوند).</p>
      <div className="host-chips" id="host-chips">
        {hosts.length === 0
          ? <p className="muted small">هنوز سایتی غیرفعال نشده است.</p>
          : hosts.map((h) => (
            <span className="hchip" key={h}>
              {h}
              <button type="button" className="hchip-x" title={"حذف " + h} aria-label={"حذف " + h} onClick={() => { void remove(h); }}>
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
          placeholder="افزودن دامنه (مثل example.com)"
          aria-label="دامنه‌ی جدید"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commit(); } }}
        />
        <button type="button" className="btn btn-ghost" id="host-add" onClick={() => { void commit(); }}>افزودن</button>
      </div>
    </>
  );
}
