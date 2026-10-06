/**
 * Phase 8 Task 4 slice 4 — one highlight as a React component (the view's
 * buildItemCard).
 *
 * Direction contracts preserved exactly:
 *  - the quote (.item-text) carries its own per-text direction
 *    (dash.detectTextDir — BOTH branches explicit; neutral inherits the card);
 *  - the note ROW (.note: icon + text) carries the note's direction on the
 *    ROW (flex order flips with it — v1.2.13);
 *  - the fa-IR date is Persian chrome → its own dir="rtl" island (v0.5.2).
 *
 * Preview affordance (v0.6.1): with onPreview the quote is a button-shaped
 * surface (role=button + tabIndex + Enter/Space — one tab stop per item) and
 * the note an extra mouse surface (not a tab stop). The delete button keeps
 * the two-step arm contract.
 */
import type { HighlightRecord } from "../../types/highlight";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { format } from "../../../extension/shared/format.js";
import { ArmIconButton, IconButton } from "./ArmIconButton";
import { IconQuote } from "./icons";

export interface ItemHandlers {
  onView: (rec: HighlightRecord) => void;
  onCopy: (rec: HighlightRecord) => void;
  onDelete: (rec: HighlightRecord) => void;
  onPreview?: (rec: HighlightRecord) => void;
}

export function ItemCard({ rec, handlers }: { rec: HighlightRecord; handlers: ItemHandlers }) {
  const onPreview = handlers.onPreview || null;
  const textDir = dash.detectTextDir(rec.text);

  function previewKeys(ev: React.KeyboardEvent) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      handlers.onPreview!(rec);
    }
  }

  return (
    <article className="item">
      <span className="cbar" style={{ background: dash.dotColorOf(rec.color) }} aria-hidden="true" />
      <p
        className={"item-text" + (onPreview ? " peek" : "")}
        dir={textDir || undefined}
        role={onPreview ? "button" : undefined}
        tabIndex={onPreview ? 0 : undefined}
        title={onPreview ? "نمایش متن کامل این هایلایت" : undefined}
        onClick={onPreview ? () => onPreview(rec) : undefined}
        onKeyDown={onPreview ? previewKeys : undefined}
      >
        {format.excerpt(rec.text, 200)}
      </p>
      {rec.note ? (
        <div
          className={"note" + (onPreview ? " peek" : "")}
          dir={dash.detectTextDir(rec.note) || undefined}
          title={onPreview ? "نمایش متن و یادداشت کامل این هایلایت" : undefined}
          onClick={onPreview ? () => onPreview(rec) : undefined}
        >
          <span className="note-ic"><IconQuote /></span>
          <span className="note-text">{format.excerpt(rec.note, 300)}</span>
        </div>
      ) : null}
      <div className="item-meta">
        <span className="item-date" dir="rtl">{format.fmtDateTime(rec.updatedAt || rec.createdAt)}</span>
        <div className="item-actions">
          <IconButton icon="view" title="مشاهده در صفحه" onClick={() => handlers.onView(rec)} />
          <IconButton icon="copy" title="کپی متن" onClick={() => handlers.onCopy(rec)} />
          <ArmIconButton icon="trash" title="حذف این هایلایت" className="danger" onConfirm={() => handlers.onDelete(rec)} />
        </div>
      </div>
    </article>
  );
}
