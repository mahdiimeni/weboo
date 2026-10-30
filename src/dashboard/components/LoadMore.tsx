/**
 * Phase 8 Task 4 slice 6 — the load-more button as a React component.
 *
 * Replaces the view's renderLoadMore() writes into #load-more. Markup
 * contract byte-equal: button.btn.btn-ghost.load-more#load-more[hidden],
 * single text node «بارگذاری بیشتر (N مورد باقی‌مانده)» with the Persian
 * numeral formatter (dash.num — the language-aware source, v0.14.0).
 * Clicking lifts the
 * controller's visibleLimit by 50 through the bridge's apply().
 */
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { t } from "../../../extension/shared/i18n.js";

export function LoadMore({ shown, overflow, onLoadMore }: { shown: boolean; overflow: number; onLoadMore: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-ghost load-more"
      id="load-more"
      hidden={!shown}
      onClick={onLoadMore}
    >
      {t("list.loadMore", { n: dash.num(overflow) })}
    </button>
  );
}
