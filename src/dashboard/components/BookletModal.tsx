/**
 * The booklet & Markdown export modal (v0.6.0; picker + font — Task 88) —
 * audit R8 (Modals.tsx split): pure move, body unchanged.
 *
 * The booklet window: the Markdown block (unchanged), the booklet's article
 * picker (the shared .sel-list family over the dash.articleOptions rows —
 * nothing picked means ALL articles, the pure layer's default-all rule,
 * surfaced in the status line), and the booklet block's radio groups
 * (format / color / font) read at click time. The component is a pure
 * selection surface: options and the export ride injected props (the same
 * contract as BackupModal); the live highlight count is summed from the rows
 * themselves — they carry the exact comparable values.
 */
import { useEffect, useRef, useState } from "react";
import type { BookletBuildOptions, BookletFontId } from "../../types/booklet";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { format } from "../../../extension/shared/format.js";
import { sanitizeFontFamily } from "../../../extension/shared/booklet-export.js";
import { t, count } from "../../../extension/shared/i18n.js";
import { ModalShell, SumRow, type ModalRequest, type BackupSelectionOptions } from "./modal-shared";
import { SelSection, SelEmpty, toggleInSet } from "./sel-shared";

export function BookletModal({ req, onClose, stats, articleOptions, fontOptions, onMarkdown, onBooklet }: {
  req: { open: boolean; payload: ModalRequest | null };
  onClose: () => void;
  stats: { total: number; notes: number; pages: number; sites: number };
  articleOptions: BackupSelectionOptions["articles"];
  fontOptions: Array<{ id: BookletFontId; label: string }>;
  onMarkdown: () => Promise<void>;
  onBooklet: (format: string, mode: string, options: BookletBuildOptions) => Promise<void>;
}) {
  const [fmt, setFmt] = useState("html");
  const [colorMode, setColorMode] = useState("color");
  const [articles, setArticles] = useState<Set<string>>(new Set());
  const [font, setFont] = useState<BookletFontId>("vazir");
  const [customFont, setCustomFont] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  void setBusy; /* reserved for per-format pending UX; md/bk buttons gate on their own promises */

  useEffect(() => {
    if (req.open) {
      setFmt("html");
      setColorMode("color");
      setArticles(new Set()); /* fresh picker per open — the one-shot pattern */
      setFont("vazir");
      setCustomFont("");
      try { cancelRef.current?.focus(); } catch (e) { /* noop */ }
    }
  }, [req.open]);

  const s = stats || { total: 0, notes: 0, pages: 0, sites: 0 };
  const ao = articleOptions || [];
  const fo = fontOptions || [];
  const pickedCount = articles.size;
  const pickedHighlights = ao.reduce((sum, a) => (articles.has(a.key) ? sum + a.count : sum), 0);

  return (
    <ModalShell id="booklet-modal" labelledBy="booklet-title" open={req.open} onClose={onClose} overlayCloses={false}>
      <h2 id="booklet-title">{t("bk.title")}</h2>
      <div className="modal-summary" id="booklet-summary">
        <SumRow k={t("modal.highlights")} v={dash.num(s.total)} />
        <SumRow k={t("sel.articles")} v={dash.num(s.pages)} />
        <SumRow k={t("stats.notes")} v={dash.num(s.notes)} />
      </div>

      <section className="exp-sec">
        <h3>Markdown</h3>
        <p className="muted small">{t("bk.mdDesc")}</p>
        <button type="button" className="btn btn-primary" id="md-go" disabled={busy} onClick={() => { void onMarkdown().then(onClose); }}>
          {t("bk.mdBtn")}
        </button>
      </section>

      <SelSection title={t("bk.pickerTitle")} hint={t("bk.pickerHint")}>
        {ao.length ? (
          <div className="sel-list" role="group" aria-label={t("bk.pickerAria")}>
            {ao.map((a) => (
              <label className="sel-item" key={a.key}>
                <input
                  type="checkbox"
                  checked={articles.has(a.key)}
                  onChange={() => setArticles(toggleInSet(articles, a.key))}
                />
                <span className="sel-label" dir="auto">{format.excerpt(a.title, 60) || t("common.untitled")}</span>
                <span className="muted small sel-side">{a.host}</span>
                <span className="muted small">{count("common.nHighlights", a.count)}</span>
              </label>
            ))}
          </div>
        ) : (
          <SelEmpty text={t("sel.emptyArticles")} />
        )}
        <div className="sel-status muted small" id="booklet-status" role="status">
          {pickedCount === 0
            ? t("bk.allArticles")
            : t("bk.pickedStatus", { n: dash.num(pickedHighlights), m: dash.num(pickedCount) })}
        </div>
      </SelSection>

      <section className="exp-sec">
        <h3>{t("bk.printTitle")}</h3>
        <p className="muted small">{t("bk.printDesc")}</p>
        <div className="radio-list" role="radiogroup" aria-label={t("bk.formatAria")}>
          <label className="radio">
            <input type="radio" name="bk-format" value="html" checked={fmt === "html"} onChange={() => setFmt("html")} />
            <span className="radio-txt">
              <strong>{t("bk.html")}</strong>
              <span className="muted small">{t("bk.htmlDesc")}</span>
            </span>
          </label>
          <label className="radio">
            <input type="radio" name="bk-format" value="pdf" checked={fmt === "pdf"} onChange={() => setFmt("pdf")} />
            <span className="radio-txt">
              <strong>{t("bk.pdf")}</strong>
              <span className="muted small">{t("bk.pdfDesc")}</span>
            </span>
          </label>
        </div>
        <div className="radio-list" role="radiogroup" aria-label={t("bk.colorAria")}>
          <label className="radio">
            <input type="radio" name="bk-color" value="color" checked={colorMode === "color"} onChange={() => setColorMode("color")} />
            <span className="radio-txt">
              <strong>{t("bk.color")}</strong>
              <span className="muted small">{t("bk.colorDesc")}</span>
            </span>
          </label>
          <label className="radio">
            <input type="radio" name="bk-color" value="bw" checked={colorMode === "bw"} onChange={() => setColorMode("bw")} />
            <span className="radio-txt">
              <strong>{t("bk.bw")}</strong>
              <span className="muted small">{t("bk.bwDesc")}</span>
            </span>
          </label>
        </div>
        <div className="radio-list" role="radiogroup" aria-label={t("bk.fontAria")}>
          {fo.map((f) => (
            <label className="radio" key={f.id}>
              <input type="radio" name="bk-font" value={f.id} checked={font === f.id} onChange={() => setFont(f.id)} />
              <span className="radio-txt">
                <strong>{t("bk.fontDefault", { name: f.label })}</strong>
                <span className="muted small">{t("bk.fontDesc")}</span>
              </span>
            </label>
          ))}
          <label className="radio">
            <input type="radio" name="bk-font" value="custom" checked={font === "custom"} onChange={() => setFont("custom")} />
            <span className="radio-txt">
              <strong>{t("bk.fontCustom")}</strong>
              <span className="muted small">{t("bk.fontCustomDesc")}</span>
              <input
                type="text"
                id="bk-custom-font"
                dir="auto"
                value={customFont}
                disabled={font !== "custom"}
                maxLength={60}
                placeholder={t("bk.fontCustomPlaceholder")}
                onChange={(e) => setCustomFont(e.target.value)}
              />
            </span>
          </label>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          id="bk-go"
          disabled={busy || (font === "custom" && !sanitizeFontFamily(customFont))}
          onClick={() => { void onBooklet(fmt, colorMode, { articles: Array.from(articles), font: font, customFont: font === "custom" ? customFont : undefined }).then(onClose); }}
        >
          {t("bk.build")}
        </button>
      </section>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" id="bk-cancel" ref={cancelRef} onClick={onClose}>{t("common.close")}</button>
      </div>
    </ModalShell>
  );
}
