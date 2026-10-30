/**
 * Phase 8 Task 4 slice 1 — the dashboard stats strip as a React component.
 *
 * Replaces the static shell's four stat cards + the controller's renderStats()
 * (els.st* textContent writes). The DOM contract is load-bearing and stays
 * byte-equal: .stat-card > (.stat-num#st-total|st-notes|st-pages|st-sites +
 * .stat-lbl) — the packaging tests and the E2E smokes query these.
 *
 * The component is pure presentation: it receives computed stats and formats
 * through the language-aware formatter (dash.num — v0.14.0; faNum stays the
 * forced-Persian home for Persian-chrome islands). The
 * section wrapper itself (aria-label="آمار کلی") stays static shell — React
 * renders INTO it via createRoot and owns only its children.
 */
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { t } from "../../../extension/shared/i18n.js";
import type { TranslationKey } from "../../shared/i18n";

export interface Stats {
  total: number;
  notes: number;
  pages: number;
  sites: number;
}

const CARDS: Array<{ id: string; key: keyof Stats; label: TranslationKey }> = [
  { id: "st-total", key: "total", label: "stats.total" },
  { id: "st-notes", key: "notes", label: "stats.notes" },
  { id: "st-pages", key: "pages", label: "stats.pages" },
  { id: "st-sites", key: "sites", label: "stats.sites" },
];

export function StatsStrip({ stats }: { stats: Stats }) {
  return (
    <>
      {CARDS.map((c) => (
        <div className="stat-card" key={c.id}>
          <span className="stat-num" id={c.id}>
            {dash.num(stats[c.key])}
          </span>
          <span className="stat-lbl">{t(c.label)}</span>
        </div>
      ))}
    </>
  );
}
