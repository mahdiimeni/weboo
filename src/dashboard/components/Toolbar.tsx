/**
 * Phase 8 Task 4 slice 4 — the filter toolbar as a React component: search
 * box, color chips, notes-only switch, sort select, and the article-tag
 * filter row (v1.2.15). Byte-equal shell contract (ids q / color-chips /
 * f-notes / f-sort / tag-filter / tag-chips).
 *
 * The search input is UNCONTROLLED (the controller read els.q.value on a
 * 250ms debounce — same idiom, same timing). The chips/select/switch are
 * state-driven from the filters snapshot (the data layer's immutable updates
 * make the selection instant).
 */
import { useRef } from "react";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { COLOR_KEYS, COLORS } from "../../../extension/shared/constants.js";
import { tags as tagRules } from "../../../extension/shared/tags.js";
import type { Filters } from "../data";
import { IconSearch } from "./icons";

export function SearchBox({ onSearch }: { onSearch: (q: string) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div className="search-box">
      <IconSearch />
      <input
        type="search"
        id="q"
        placeholder="جست‌وجو در متن، یادداشت یا عنوان صفحه…"
        aria-label="جست‌وجو"
        onInput={(ev) => {
          const v = (ev.target as HTMLInputElement).value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onSearch(v), 250);
        }}
      />
    </div>
  );
}

export function ColorChips({ colors, onToggle }: { colors: Filters["colors"]; onToggle: (key: string) => void }) {
  return (
    <div className="color-chips" id="color-chips" role="group" aria-label="فیلتر رنگ">
      {COLOR_KEYS.map((k) => {
        const c = COLORS[k];
        const active = colors.has(k);
        return (
          <button
            type="button"
            className={"cchip" + (active ? " active" : "")}
            key={k}
            data-key={k}
            role="checkbox"
            aria-checked={active}
            onClick={() => onToggle(k)}
          >
            <span className="dot" style={{ background: c.dot }} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function NotesOnlySwitch({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <label className="switch-box">
      <span className="switch">
        <input type="checkbox" id="f-notes" checked={on} onChange={(e) => onToggle(e.target.checked)} />
        <span className="track"><span className="knob" /></span>
      </span>
      <span className="switch-lbl">فقط یادداشت‌دار</span>
    </label>
  );
}

export function SortSelect({ sort, onChange }: { sort: string; onChange: (s: string) => void }) {
  return (
    <label className="sort-box">
      <span className="muted small">مرتب‌سازی:</span>
      <select id="f-sort" value={sort} onChange={(e) => onChange(e.target.value)}>
        <option value="newest">جدیدترین</option>
        <option value="oldest">قدیمی‌ترین</option>
        <option value="page">بر اساس صفحه</option>
      </select>
    </label>
  );
}

export function TagChips({ tagMap, selected, onToggle }: {
  tagMap: Record<string, string[]>;
  selected: Filters["tags"];
  onToggle: (tag: string) => void;
}) {
  const counts = tagRules.tagCounts(tagMap);
  return (
    <div className="tag-filter" id="tag-filter" hidden={counts.length === 0}>
      <span className="muted small tag-filter-lbl">برچسب مقالات:</span>
      <div className="tag-chips" id="tag-chips" role="group" aria-label="فیلتر برچسب مقالات">
        {counts.map((t: { tag: string; count: number }) => {
          const active = selected.has(t.tag);
          return (
            <button
              type="button"
              className={"tchip" + (active ? " active" : "")}
              key={t.tag}
              data-tag={t.tag}
              role="checkbox"
              aria-checked={active}
              onClick={() => onToggle(t.tag)}
            >
              {t.tag}
              <span className="tchip-n">{dash.faNum(t.count)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The whole toolbar section (mounted into .toolbar — React owns its children). */
export function Toolbar({ filters, tagMap, onSearch, onToggleColor, onToggleNotes, onSort, onToggleTag }: {
  filters: Filters;
  tagMap: Record<string, string[]>;
  onSearch: (q: string) => void;
  onToggleColor: (key: string) => void;
  onToggleNotes: (v: boolean) => void;
  onSort: (s: string) => void;
  onToggleTag: (tag: string) => void;
}) {
  return (
    <>
      <SearchBox onSearch={onSearch} />
      <div className="filter-row">
        <ColorChips colors={filters.colors} onToggle={onToggleColor} />
        <NotesOnlySwitch on={filters.notesOnly} onToggle={onToggleNotes} />
        <SortSelect sort={filters.sort} onChange={onSort} />
      </div>
      <TagChips tagMap={tagMap} selected={filters.tags} onToggle={onToggleTag} />
    </>
  );
}
