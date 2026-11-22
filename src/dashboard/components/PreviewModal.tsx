/**
 * The highlight preview modal (v0.6.1 — the full-text window) — audit R8
 * (Modals.tsx split): pure move, body unchanged.
 *
 * The FULLY direction-smart window: the frame carries the record text's own
 * direction, the title is the article's own (articleTitleOf, excerpt 60,
 * per-text dir), the quote and note keep per-text directions, the meta line
 * is date-only Persian chrome in an RTL island; NO X button (the owner's
 * call) — overlay click outside the card and Escape close; the card
 * (tabindex="-1") is the programmatic focus anchor.
 */
import { useEffect, useRef } from "react";
import type { HighlightRecord } from "../../types/highlight";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { format } from "../../../extension/shared/format.js";
import { t, dirOf } from "../../../extension/shared/i18n.js";
import { ModalShell } from "./modal-shared";
import { IconQuote } from "./icons";
import { articleTitleOf } from "./GroupCard";

export function PreviewModal({ rec, onClose }: { rec: HighlightRecord | null; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const open = !!rec;

  useEffect(() => {
    if (open) {
      try { cardRef.current?.focus(); } catch (e) { /* noop */ }
    }
  }, [open]);

  const frameDir = open ? dash.detectTextDir(rec.text) : null;
  const full = open ? articleTitleOf(rec) : "";
  const titleDir = open ? dash.detectTextDir(full) : null;

  return (
    <ModalShell
      id="hl-modal"
      labelledBy="hl-title"
      cardClassName="hl-card"
      cardId="hl-card"
      cardTabIndex={-1}
      cardDir={frameDir || undefined}
      cardRef={cardRef}
      open={open}
      onClose={onClose}
      overlayCloses
    >
      <div className="hl-head">
        <h2 id="hl-title" title={full} dir={titleDir || undefined}>
          {format.excerpt(full, 60) || t("common.untitled")}
        </h2>
      </div>
      <div className="hl-body" id="hl-body">
        {open ? (
          <>
            <div className="hl-quote" dir={dash.detectTextDir(rec.text) || undefined}>
              <span className="cbar" style={{ background: dash.dotColorOf(rec.color) }} aria-hidden="true" />
              <p className="hl-quote-t">{rec.text}</p>
            </div>
            {rec.note ? (
              <div className="note" dir={dash.detectTextDir(rec.note) || undefined}>
                <span className="note-ic"><IconQuote /></span>
                <span className="note-text">{rec.note}</span>
              </div>
            ) : null}
            <div className="hl-meta">
              <span className="hl-meta-t" dir={dirOf()}>{format.fmtDateTime(rec.updatedAt || rec.createdAt)}</span>
            </div>
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
