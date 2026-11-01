/**
 * Phase 8 Task 4 slice 4 — the per-card order pill (v0.4.0, the view's
 * buildOrderBtn) + the article group card (the view's buildGroupCard).
 *
 * The pill is Persian CHROME → unconditional dir="rtl" (v0.6.2 — the icon
 * and label keep one arrangement in LTR and RTL cards); hidden when the card
 * holds fewer than two highlights.
 *
 * The card preserves the v1.2.6 smart-card contract: the data layer decides
 * the direction (g.dir) — an LTR card takes dir="ltr", RTL cards inherit the
 * document. The header is the toggle surface (role=button + tabIndex +
 * aria-expanded + Enter/Space); clicks on ANY header button never toggle.
 * Count capsules / cut-off notices are Persian chrome (dir="rtl" islands).
 * The favicon keeps domkit.mountFavicon's exact behavior: the letter shows
 * until the captured dataURL img loads (.on + .has-fav); a broken URL
 * removes the img.
 */
import { useState } from "react";
import type { HighlightRecord } from "../../types/highlight";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { format } from "../../../extension/shared/format.js";
import { TagsRow, type TagHandlers } from "./TagsRow";
import { ItemCard, type ItemHandlers } from "./ItemCard";
import { ArmIconButton, IconButton } from "./ArmIconButton";
import { IconChev, IconSort } from "./icons";
import { t, dirOf, count } from "../../../extension/shared/i18n.js";
import type { TranslationKey } from "../../shared/i18n";

const ITEM_ORDER_META: Record<string, { label: TranslationKey; title: TranslationKey }> = {
  newest: { label: "card.order.newest", title: "card.order.newestTitle" },
  oldest: { label: "card.order.oldest", title: "card.order.oldestTitle" },
  page: { label: "card.order.page", title: "card.order.pageTitle" },
  "page-rev": { label: "card.order.pageRev", title: "card.order.pageRevTitle" },
};

/** Shared article-title presentation (v0.6.3) — the ONE fallback chain. */
export function articleTitleOf(src: { title?: string; host?: string; url?: string }): string {
  return (src && (src.title || src.host || src.url)) || t("common.untitled");
}

export interface Group {
  key: string;
  host: string;
  url?: string;
  title?: string;
  dir?: string;
  notes: number;
  items: HighlightRecord[];
  favicon?: string | null;
  tags?: string[];
}

function OrderBtn({ order, onFlip }: { order: string; onFlip: () => void }) {
  const meta = ITEM_ORDER_META[order] || ITEM_ORDER_META.newest;
  const label = t(meta.label);
  return (
    <button
      type="button"
      className="order-btn"
      title={t(meta.title)}
      aria-label={t("card.orderAria", { label: label })}
      dir={dirOf()}
      onClick={(ev) => {
        ev.stopPropagation();
        onFlip();
      }}
    >
      <span className="order-ic" aria-hidden="true"><IconSort /></span>
      {label}
    </button>
  );
}

/** The captured favicon (hlx:f:<host>) with the letter fallback —
    domkit.mountFavicon's behavior, state-driven. */
function FaviconSpot({ host, url }: { host: string; url?: string | null }) {
  const [imgState, setImgState] = useState<"loading" | "on" | "failed">("loading");
  const showImg = url && imgState !== "failed";
  return (
    <span className={"fl" + (imgState === "on" ? " has-fav" : "")} title={host || t("common.localFile")}>
      {dash.faviconLetter(host)}
      {showImg ? (
        <img
          className={"fl-img" + (imgState === "on" ? " on" : "")}
          alt=""
          draggable={false}
          decoding="async"
          src={url}
          onLoad={() => setImgState("on")}
          onError={() => setImgState("failed")}
        />
      ) : null}
    </span>
  );
}

export interface GroupCardHandlers extends TagHandlers, ItemHandlers {
  onOpen: (g: Group) => void;
  onDeleteGroup: (g: Group) => void;
  onToggle: (g: Group, willCollapse: boolean) => void;
  onItemOrder: (g: Group) => void;
  /** v0.5.0 — consumed by DirSection (the section toggle's controller sync) */
  onSectionToggle?: (dir: string, willCollapse: boolean) => void;
}

export function GroupCard({ g, collapsed, order, handlers }: {
  g: Group;
  collapsed: boolean;
  order?: string;
  handlers: GroupCardHandlers;
}) {
  const canFlip = g.items.length > 1;

  function headToggle(ev: React.MouseEvent | React.KeyboardEvent) {
    /* a click on ANY header button (open/delete/order) never toggles */
    const t = ev.target as HTMLElement;
    if (t && t.closest && t.closest("button")) return;
    handlers.onToggle(g, !collapsed);
  }

  function headKeys(ev: React.KeyboardEvent) {
    const t = ev.target as HTMLElement;
    if (t && t.closest && t.closest("button")) return;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      handlers.onToggle(g, !collapsed);
    }
  }

  /* the detected direction is explicit in BOTH branches (v0.14.2) — the old
     "rtl inherits the document" rule breaks in an ltr UI; groupRecords'
     contentDir never returns neutral, so a missing dir (hand-built test
     groups) still inherits */
  return (
    <div className={"group" + (collapsed ? " collapsed" : "")} data-key={g.key} dir={(g.dir as "ltr" | "rtl") || undefined}>
      <div
        className="group-head"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={headToggle}
        onKeyDown={headKeys}
      >
        <FaviconSpot host={g.host} url={g.favicon || undefined} />
        <span className="group-txt">
          <strong className="group-title">{format.excerpt(articleTitleOf(g), 60) || t("common.untitled")}</strong>
          <span className="group-url" title={g.url || g.host || ""}>{dash.displayHost(g.url || g.host)}</span>
        </span>
        <span className="gchips">
          <span className="chip" dir={dirOf()}>{count("common.nHighlights", g.items.length)}</span>
          {g.notes > 0 ? <span className="chip" dir={dirOf()}>{count("common.nNotes", g.notes)}</span> : null}
        </span>
        {canFlip ? <OrderBtn order={order || "newest"} onFlip={() => handlers.onItemOrder(g)} /> : null}
        <span className="chev" aria-hidden="true"><IconChev /></span>
        <IconButton icon="view" title={t("card.viewPageTitle")} onClick={() => handlers.onOpen(g)} />
        <ArmIconButton icon="trash" title={t("card.deleteGroupTitle")} className="danger" onConfirm={() => handlers.onDeleteGroup(g)} />
      </div>

      {/* article tags (v1.2.15) — between header and items, never hidden by
          the collapse state (article-level metadata, scannable at boot) */}
      <TagsRow
        groupKey={g.key}
        tags={g.tags || []}
        onAddTag={handlers.onAddTag}
        onRemoveTag={handlers.onRemoveTag}
      />

      <div className="group-items" hidden={collapsed}>
        {g.items.map((rec) => <ItemCard key={rec.id} rec={rec} handlers={handlers} />)}
      </div>
    </div>
  );
}
