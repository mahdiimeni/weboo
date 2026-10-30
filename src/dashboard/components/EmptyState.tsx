/**
 * Phase 8 Task 4 slice 6 — the empty state as a React component.
 *
 * Replaces the view's renderEmptyState() writes into #empty. Markup contract
 * byte-equal: div.empty#empty[hidden] > .empty-ic > svg + p.empty-t#empty-title
 * + p.muted.small#empty-sub. Two copy variants (the controller's hasRecords
 * flag): an empty store invites the first highlight; a filtered-out store
 * points at the filters.
 */
export function EmptyState({ shown, hasRecords }: { shown: boolean; hasRecords: boolean }) {
  return (
    <div className="empty" id="empty" hidden={!shown}>
      <div className="empty-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
        </svg>
      </div>
      <p className="empty-t" id="empty-title">
        {hasRecords ? "نتیجه‌ای پیدا نشد." : "هنوز هایلایتی ثبت نشده. اولین متن را انتخاب کنید!"}
      </p>
      <p className="muted small" id="empty-sub">
        {hasRecords
          ? "عبارت جست‌وجو یا فیلترهای رنگ و برچسب را تغییر بده."
          : "روی هر صفحه‌ی وب، متن را انتخاب کن و از نوار شناور افزونه استفاده کن."}
      </p>
    </div>
  );
}
