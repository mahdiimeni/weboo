/**
 * Phase 8 Task 4 slice 4 — one direction section (v0.2.0/v0.5.0, the view's
 * buildDirSection).
 *
 * The section container deliberately takes NO dir attribute: the header texts
 * are Persian (document RTL flow) while each card below applies its own
 * direction — the v1.2.6 contract, one level up. Styling hooks: the
 * dir-rtl/dir-ltr classes; the LEADING section (holding the most-recently-
 * highlighted article — the data layer's dash.leadDir decision) carries the
 * «آخرین هایلایت» badge.
 *
 * The header IS the section's toggle (the group-head contract one level up):
 * role=button + tabIndex + aria-expanded; the body goes hidden; the chevron
 * rotates via the .collapsed class.
 */
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { GroupCard, type Group, type GroupCardHandlers } from "./GroupCard";
import { IconArrowLtr, IconArrowRtl, IconChev } from "./icons";

const DIR_SECTION_LABELS: Record<string, string> = {
  rtl: "راست‌چین‌ها",
  ltr: "چپ‌چین‌ها",
};

export interface DirSectionData {
  dir: "rtl" | "ltr";
  entries: Array<{ group: Group; remaining: number }>;
}

export function DirSection({ section, lead, collapsed, cardState, handlers }: {
  section: DirSectionData;
  lead: boolean;
  collapsed: boolean;
  cardState: (g: Group) => { collapsed: boolean; order?: string };
  handlers: GroupCardHandlers;
}) {
  const dir = section.dir === "ltr" ? "ltr" : "rtl";

  function toggle() {
    handlers.onSectionToggle!(dir, !collapsed);
  }

  function headKeys(ev: React.KeyboardEvent) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      toggle();
    }
  }

  return (
    <section
      className={"dir-sec dir-" + dir + (lead ? " lead" : "") + (collapsed ? " collapsed" : "")}
      aria-labelledby={"hlx-dir-" + dir}
    >
      <div
        className="dir-sec-head"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={toggle}
        onKeyDown={headKeys}
      >
        <h2 className="dir-sec-title" id={"hlx-dir-" + dir}>
          <span className="dir-ic" aria-hidden="true">{dir === "ltr" ? <IconArrowLtr /> : <IconArrowRtl />}</span>
          {DIR_SECTION_LABELS[dir]}
        </h2>
        <span className="dir-sec-count">{dash.faNum(section.entries.length) + " مقاله"}</span>
        {lead ? (
          <span
            className="dir-sec-lead"
            title="تازه‌ترین مقاله‌ی هایلایت‌شده در این بخش است؛ برای همین این بخش بالاتر نمایش داده می‌شود"
          >
            آخرین هایلایت اینجاست
          </span>
        ) : null}
        <span className="dir-sec-chev" aria-hidden="true"><IconChev /></span>
      </div>
      <div className="dir-sec-body" hidden={collapsed}>
        {section.entries.map((v) => {
          const st = cardState(v.group);
          return (
            <GroupCard
              key={v.group.key}
              g={v.group}
              remaining={v.remaining}
              collapsed={st.collapsed}
              order={st.order}
              handlers={handlers}
            />
          );
        })}
      </div>
    </section>
  );
}
