/**
 * Phase 8 Task 4 slice 3 — the bulk expand/collapse bar as a React component.
 *
 * Replaces the view's renderBulkToggle() writes into the static #btn-bulk.
 * The button presents its NEXT action (dash.bulkAction's fresh decision,
 * published by the controller through the bulkBridge — see dashboard.js);
 * clicking it applies exactly that action. The markup contract stays
 * byte-equal: button#btn-bulk.btn.btn-ghost.bulk-toggle (hidden when there
 * is no action) > .bt-ic[aria-hidden] (chevrons) + .bt-lbl (label).
 *
 * The meta lives with the component (the view retired with Task 5).
 */
/* Persian presentation of the two bulk modes (ex-dashView.BULK_ACTION_META —
   the view retired with Task 5; the component owns its labels now). */
export const BULK_ACTION_META: Record<string, { icon: string; label: string; title: string }> = {
  expand: {
    icon: "chevsDown",
    label: "باز کردن همه‌ی مقاله‌ها",
    title: "همه‌ی کارت مقاله‌ها باز می‌شوند و همه‌ی هایلایت‌های بارگذاری‌نشده هم بارگذاری می‌شوند",
  },
  collapse: {
    icon: "chevsUp",
    label: "بستن همه‌ی مقاله‌ها",
    title: "همه‌ی کارت مقاله‌ها بسته می‌شوند و همه‌ی هایلایت‌های بارگذاری‌نشده هم بارگذاری می‌شوند؛ با باز کردن هر مقاله، هایلایت‌هایش کامل نمایش داده می‌شوند",
  },
};

const CHEVS = {
  expand: (
    /* dashView.ICONS.chevsDown — byte-equal geometry */
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 7 12 13 18 7" />
      <polyline points="6 13 12 19 18 13" />
    </svg>
  ),
  collapse: (
    /* dashView.ICONS.chevsUp */
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 13 12 7 18 13" />
      <polyline points="6 19 12 13 18 19" />
    </svg>
  ),
};

export function BulkToggle({ action, onApply }: { action: string; onApply: () => void }) {
  const meta = action ? BULK_ACTION_META[action] : null;
  return (
    <button
      type="button"
      id="btn-bulk"
      className="btn btn-ghost bulk-toggle"
      hidden={!meta}
      title={meta ? meta.title : undefined}
      onClick={onApply}
    >
      {meta ? (
        <>
          <span className="bt-ic" aria-hidden="true">{CHEVS[action as keyof typeof CHEVS]}</span>
          <span className="bt-lbl">{meta.label}</span>
        </>
      ) : null}
    </button>
  );
}
