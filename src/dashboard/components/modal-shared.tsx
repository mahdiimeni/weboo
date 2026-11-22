/**
 * The modal family's shared infrastructure (audit R8 — Modals.tsx split:
 * pure moves, no behavior change).
 *
 * Markup contract (byte-equal with the shell template's modals):
 *   .modal#...[hidden] > .modal-card[role=dialog][aria-modal][aria-labelledby]
 * Overlay-click closing is per-modal via overlayCloses; every open modal
 * installs its own Escape listener (the old single chain's branches, moved
 * to the owners).
 */
import { useEffect, useRef, useState } from "react";

export interface ModalRequest {
  kind: "restore" | "booklet" | "backup";
  backup?: Record<string, unknown>;
}

/** One-way open-request channel from the controller (modalBridge): a new
 *  request identity opens the modal; closing is local (re-opening the same
 *  kind works because every request is a fresh object). */
export function useModalRequest(kind: ModalRequest["kind"], bridge: {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => ModalRequest | null;
}): [{ open: boolean; payload: ModalRequest | null }, () => void] {
  const req = useSyncExternalStoreSafe(bridge);
  const [state, setState] = useState<{ open: boolean; payload: ModalRequest | null }>({ open: false, payload: null });
  const lastRef = useRef<ModalRequest | null>(null);
  useEffect(() => {
    if (req && req.kind === kind && req !== lastRef.current) {
      lastRef.current = req;
      setState({ open: true, payload: req });
    }
  }, [req, kind]);
  return [state, () => setState((s) => ({ ...s, open: false }))];
}

function useSyncExternalStoreSafe(bridge: {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => ModalRequest | null;
}): ModalRequest | null {
  const [snap, setSnap] = useState<ModalRequest | null>(() => bridge.getSnapshot());
  useEffect(() => {
    setSnap(bridge.getSnapshot());
    return bridge.subscribe(() => setSnap(bridge.getSnapshot()));
  }, [bridge]);
  return snap;
}

export function ModalShell({ id, labelledBy, cardClassName, cardId, cardTabIndex, cardDir, cardRef, open, onClose, overlayCloses, children }: {
  id: string;
  labelledBy: string;
  cardClassName?: string;
  cardId?: string;
  cardTabIndex?: number;
  cardDir?: string | undefined;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  overlayCloses: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className="modal"
      id={id}
      hidden={!open}
      onClick={overlayCloses && open ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div
        className={"modal-card" + (cardClassName ? " " + cardClassName : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        id={cardId}
        tabIndex={cardTabIndex}
        dir={cardDir}
        ref={cardRef}
      >
        {children}
      </div>
    </div>
  );
}

export function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="sum-row">
      <span className="muted">{k}</span>
      <strong>{v}</strong>
    </div>
  );
}

/** The picker's rows — dash.backupSelectionOptions' return shape. */
export interface BackupSelectionOptions {
  sites: Array<{ host: string; articles: number }>;
  articles: Array<{ key: string; host: string; title: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
}
