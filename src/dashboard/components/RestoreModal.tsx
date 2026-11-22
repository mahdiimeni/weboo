/**
 * The restore modal (the backup import) — audit R8 (Modals.tsx split): pure
 * move, body unchanged. Markup contract: h2#modal-title + .modal-summary
 * (the fillModalSummary rows) + the imp-mode radio list + imp-cancel/imp-go.
 */
import { useEffect, useState } from "react";
import { format } from "../../../extension/shared/format.js";
import { APP_NAME, VERSION } from "../../../extension/shared/constants.js";
import { t } from "../../../extension/shared/i18n.js";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { ModalShell, SumRow, type ModalRequest } from "./modal-shared";

export function RestoreModal({ req, onClose, onImport }: {
  req: { open: boolean; payload: ModalRequest | null };
  onClose: () => void;
  onImport: (backup: Record<string, unknown>, mode: string) => Promise<void>;
}) {
  const backup = req.payload?.backup;
  const [mode, setMode] = useState("merge");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (req.open) setMode("merge"); }, [req.open]);

  async function go() {
    if (!backup || busy) return;
    setBusy(true);
    try {
      await onImport(backup, mode);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const count = backup ? ((backup.meta as { count?: number })?.count || Object.keys((backup.highlights as object) || {}).length) : 0;
  const b = backup as { name?: string; exportedAt?: number; version?: string } | undefined;
  const partial = !!(backup && (backup.meta as { partial?: boolean } | undefined)?.partial);

  return (
    <ModalShell id="modal" labelledBy="modal-title" open={req.open} onClose={onClose} overlayCloses={false}>
      <h2 id="modal-title">{t("restore.title")}</h2>
      <div className="modal-summary" id="modal-summary">
        <SumRow k={t("modal.name")} v={(b && b.name) || APP_NAME} />
        <SumRow k={t("modal.highlights")} v={dash.num(count)} />
        <SumRow k={t("modal.exportDate")} v={b && b.exportedAt ? format.fmtDateTime(b.exportedAt) : "—"} />
        <SumRow k={t("common.version")} v={"v" + ((b && b.version) || VERSION)} />
        {partial ? <SumRow k={t("modal.type")} v={t("modal.partialValue")} /> : null}
      </div>
      <div className="radio-list">
        <label className="radio">
          <input type="radio" name="imp-mode" value="merge" checked={mode === "merge"} onChange={() => setMode("merge")} />
          <span className="radio-txt">
            <strong>{t("modal.merge")}</strong>
            <span className="muted small">{t("modal.mergeDesc")}</span>
          </span>
        </label>
        <label className="radio radio-danger">
          <input type="radio" name="imp-mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} />
          <span className="radio-txt">
            <strong>{t("modal.replace")}</strong>
            <span className="warn small">{t("modal.replaceDesc")}</span>
          </span>
        </label>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" id="imp-cancel" onClick={onClose}>{t("common.cancel")}</button>
        <button type="button" className="btn btn-primary" id="imp-go" disabled={busy} onClick={() => { void go(); }}>{t("modal.start")}</button>
      </div>
    </ModalShell>
  );
}
