/**
 * Phase 8 Task 4 slice 1 — the dashboard stats strip as a React component.
 *
 * Replaces the static shell's four stat cards + the controller's renderStats()
 * (els.st* textContent writes). The DOM contract is load-bearing and stays
 * byte-equal: .stat-card > (.stat-num#st-total|st-notes|st-pages|st-sites +
 * .stat-lbl) — the packaging tests and the E2E smokes query these.
 *
 * The component is pure presentation: it receives computed stats and formats
 * through the ONE formatter (dash.faNum) the controller also used. The
 * section wrapper itself (aria-label="آمار کلی") stays static shell — React
 * renders INTO it via createRoot and owns only its children.
 */
import { dash } from "../../../extension/dashboard/dashboard-data.js";

export interface Stats {
  total: number;
  notes: number;
  pages: number;
  sites: number;
}

const CARDS: Array<{ id: string; key: keyof Stats; label: string }> = [
  { id: "st-total", key: "total", label: "کل هایلایت‌ها" },
  { id: "st-notes", key: "notes", label: "یادداشت‌ها" },
  { id: "st-pages", key: "pages", label: "صفحات" },
  { id: "st-sites", key: "sites", label: "سایت‌ها" },
];

export function StatsStrip({ stats }: { stats: Stats }) {
  return (
    <>
      {CARDS.map((c) => (
        <div className="stat-card" key={c.id}>
          <span className="stat-num" id={c.id}>
            {dash.faNum(stats[c.key])}
          </span>
          <span className="stat-lbl">{c.label}</span>
        </div>
      ))}
    </>
  );
}
