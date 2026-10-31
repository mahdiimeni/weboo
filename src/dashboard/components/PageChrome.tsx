/**
 * Phase 8 Task 5 — the last controller pieces as React regions: the topbar
 * action row (booklet / export / settings + the size badge) and the drawer's
 * restore + danger sections. Markup byte-equal to the shell template.
 */
import { useEffect, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import {
  getData,
  subscribeData,
  setBookletOpen,
  setBackupOpen,
  setDrawerOpen,
  exportBackup,
  acceptBackupFile,
  setSettings,
  clearAll,
} from "../data";
import { toast } from "../toast";
import { t } from "../../../extension/shared/i18n.js";
import { IconBooklet, IconExport, IconSettings, IconDanger, IconSelectBackup } from "./pageIcons";

/** Region root — mounted into .topbar-actions (the four buttons + badge). */
export function TopbarActionsRegion() {
  const { bytesInUse } = useSyncExternalStore(subscribeData, getData);
  return (
    <>
      <button type="button" className="btn btn-ghost" id="btn-booklet" onClick={() => setBookletOpen(true)}>
        <IconBooklet />
        {t("tb.booklet")}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        id="btn-backup-select"
        aria-haspopup="dialog"
        title={t("tb.selectiveBackupTitle")}
        onClick={() => setBackupOpen(true)}
      >
        <IconSelectBackup />
        {t("tb.selectiveBackup")}
      </button>
      <button
        type="button"
        className="btn btn-primary btn-icon"
        id="btn-export"
        aria-label={t("tb.backup")}
        title={t("tb.backupTitle")}
        onClick={() => { void exportBackup(); }}
      >
        <IconExport />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        id="btn-settings"
        aria-label={t("dash.settings")}
        title={t("dash.settings")}
        aria-haspopup="dialog"
        aria-controls="drawer"
        onClick={() => setDrawerOpen(true)}
      >
        <IconSettings />
      </button>
      <span className="size-badge" id="size-badge" title={t("tb.sizeBadgeTitle")}>
        {bytesInUse === null ? "—" : dash.fmtBytes(bytesInUse)}
      </span>
    </>
  );
}

/** Region root — mounted into the drawer's .set-sec.restore-sec. */
export function RestoreSectionRegion() {
  const inputRef = useRef<HTMLInputElement>(null);
  /* the region contract (v0.14.1): subscribe to the shared snapshot like every
     sibling region — this section renders t() strings, so without the
     subscription it kept its first-paint (fa) text when the language changed */
  useSyncExternalStore(subscribeData, getData);
  return (
    <section className="set-sec restore-sec">
      <h3>{t("restore.title")}</h3>
      <p className="muted small">{t("restore.desc")}</p>
      <button type="button" className="btn btn-ghost" id="btn-import" onClick={() => {
        if (inputRef.current) {
          inputRef.current.value = "";
          try { inputRef.current.click(); } catch (e) { toast(t("restore.fileFail"), "error"); }
        }
      }}>
        <IconExport />
        {t("restore.title")}
      </button>
      <input
        type="file"
        id="file-input"
        ref={inputRef}
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) acceptBackupFile(f);
        }}
      />
    </section>
  );
}

/** Region root — mounted into the drawer's .set-sec.danger-zone. The exact
 *  three-step confirmation: arm (15s timer) → type the confirm word → confirm.
 *  User settings survive (clearAll wipes every hlx key). */

/** The danger-zone confirm word — ONE rule shared by the enable gate and the
 *  go() guard so the two can never drift. Accepts the Persian word or the
 *  Latin one, trimmed, case-insensitive. */
export function confirmWordOk(value: string | null | undefined): boolean {
  const t = (value || "").trim().toLowerCase();
  return t === "حذف" || t === "delete";
}

export function DangerSectionRegion() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  /* the confirm button's enabled state lives in REACT STATE on purpose:
     React suppresses click events on interactive elements whose PROPS say
     disabled (shouldPreventMouseEvent) — enabling it imperatively through a
     ref left the DOM enabled while every click was still swallowed
     (the v0.8.0 "delete-all does nothing" bug). Props must stay truthful. */
  const [wordOk, setWordOk] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSyncExternalStore(subscribeData, getData);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function reset() {
    setArmed(false);
    setWordOk(false);
    if (timer.current) clearTimeout(timer.current);
    /* the confirm input is uncontrolled — clear it at the DOM */
    if (inputRef.current) inputRef.current.value = "";
  }

  async function go() {
    if (busy) return;
    if (!confirmWordOk(inputRef.current?.value)) return;
    setBusy(true);
    try {
      await clearAll();
      /* User settings must survive (clearAll wipes every hlx key) */
      await setSettings(settings);
      toast(t("danger.done"), "success");
      reset();
    } catch (e) {
      toast(t("common.deleteFail"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="set-sec danger-zone">
      <h3>
        <IconDanger />
        {t("danger.title")}
      </h3>
      <p className="muted small">{t("danger.desc")}</p>
      <div className="danger-flow">
        <button
          type="button"
          className={"btn btn-danger" + (armed ? " armed" : "")}
          id="danger-btn"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              setWordOk(false);
              try { inputRef.current?.focus(); } catch (e) { /* noop */ }
              timer.current = setTimeout(reset, 15000);
              return;
            }
            try { inputRef.current?.focus(); } catch (e) { /* noop */ }
          }}
        >
          {armed ? t("common.confirm") : t("danger.arm")}
        </button>
        <div className="danger-confirm" id="danger-confirm" hidden={!armed}>
          <input
            type="text"
            id="danger-input"
            ref={inputRef}
            placeholder={t("danger.placeholder")}
            aria-label={t("danger.inputAria")}
            onInput={() => {
              setWordOk(confirmWordOk(inputRef.current?.value));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && wordOk && !busy) {
                e.preventDefault();
                void go();
              }
            }}
          />
          <button type="button" className="btn btn-danger" id="danger-go" disabled={!wordOk || busy} onClick={() => { void go(); }}>
            {t("danger.go")}
          </button>
          <button type="button" className="btn btn-ghost" id="danger-cancel" onClick={reset}>{t("common.cancel")}</button>
        </div>
      </div>
    </section>
  );
}
