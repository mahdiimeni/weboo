/**
 * Phase 8 Task 4 slice 5 — the three dashboard modals as React components.
 *
 * Markup contracts byte-equal (the shell template's modals + the view's fill
 * builders):
 *  - .modal#...[hidden] > .modal-card[role=dialog][aria-modal][aria-labelledby]
 *  - RestoreModal: h2#modal-title + .modal-summary#modal-summary (the
 *    fillModalSummary rows) + the imp-mode radio list + imp-cancel/imp-go
 *  - BookletModal: h2#booklet-title + summary + the Markdown/booklet sections
 *    with the bk-format/bk-color/bk-font radio groups; the booklet block also
 *    carries the ARTICLE PICKER (Task 88 — the shared .sel-list family over
 *    dash.articleOptions rows; nothing picked = ALL articles, the pure layer's
 *    default-all rule) — radios and selection read at click time (the
 *    imp-mode contract)
 *  - PreviewModal (v0.6.1–v0.6.4): the FULLY direction-smart window — the
 *    frame carries the record text's own direction, the title is the
 *    article's own (articleTitleOf, excerpt 60, per-text dir), the quote and
 *    note keep per-text directions, the meta line is date-only Persian chrome
 *    in an RTL island; NO X button (the owner's call) — overlay click outside
 *    the card and Escape close; the card (tabindex="-1") is the programmatic
 *    focus anchor.
 *  - BackupModal (selective backup): three checkbox sections (sites /
 *    articles / tags) over dash.backupSelectionOptions rows; the live count
 *    and the export itself ride the injected countOf/onExport (the store's
 *    matchesBackupSelection rule) — the component holds SELECTION state only.
 *    Same overlay/modal family: Escape + انصراف close; overlay clicks don't.
 *
 * Overlay-click closing is per-modal, exactly as before: ONLY the preview
 * modal closes on a backdrop click; restore/booklet/backup close via their
 * buttons and Escape. Each open modal installs its own Escape listener (the
 * old single chain's modal branches, moved to the owners).
 */
import { useEffect, useRef, useState } from "react";
import type { HighlightRecord } from "../../types/highlight";
import type { BackupSelection } from "../../types/storage";
import type { BookletBuildOptions, BookletFontId } from "../../types/booklet";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { format } from "../../../extension/shared/format.js";
import { APP_NAME, VERSION } from "../../../extension/shared/constants.js";
import { sanitizeFontFamily } from "../../../extension/shared/booklet-export.js";
import { IconQuote } from "./icons";
import { articleTitleOf } from "./GroupCard";

function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="sum-row">
      <span className="muted">{k}</span>
      <strong>{v}</strong>
    </div>
  );
}

/** Immutable Set toggle — the ONE state helper behind every picker checkbox
 *  (BackupModal + BookletModal): a fresh Set each click so snapshot identity
 *  drives the re-render. */
function toggleInSet(cur: Set<string>, v: string): Set<string> {
  const next = new Set(cur);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

interface ModalRequest {
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

function ModalShell({ id, labelledBy, cardClassName, cardId, cardTabIndex, cardDir, cardRef, open, onClose, overlayCloses, children }: {
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

/* ---------- Restore modal (the backup import) ---------- */

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
      <h2 id="modal-title">بازیابی بک‌آپ</h2>
      <div className="modal-summary" id="modal-summary">
        <SumRow k="نام مجموعه" v={(b && b.name) || APP_NAME} />
        <SumRow k="تعداد هایلایت‌ها" v={dash.faNum(count)} />
        <SumRow k="تاریخ خروجی" v={b && b.exportedAt ? format.fmtDateTime(b.exportedAt) : "—"} />
        <SumRow k="نسخه" v={"v" + ((b && b.version) || VERSION)} />
        {partial ? <SumRow k="نوع" v="بک‌آپ انتخابی (بخشی از کتابخانه)" /> : null}
      </div>
      <div className="radio-list">
        <label className="radio">
          <input type="radio" name="imp-mode" value="merge" checked={mode === "merge"} onChange={() => setMode("merge")} />
          <span className="radio-txt">
            <strong>ادغام (merge)</strong>
            <span className="muted small">رکوردهای جدیدتر برنده می‌شوند؛ داده‌های فعلی حفظ می‌شوند.</span>
          </span>
        </label>
        <label className="radio radio-danger">
          <input type="radio" name="imp-mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} />
          <span className="radio-txt">
            <strong>جایگزینی کامل (replace)</strong>
            <span className="warn small">همه‌ی داده‌های فعلی حذف می‌شوند!</span>
          </span>
        </label>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" id="imp-cancel" onClick={onClose}>انصراف</button>
        <button type="button" className="btn btn-primary" id="imp-go" disabled={busy} onClick={() => { void go(); }}>شروع بازیابی</button>
      </div>
    </ModalShell>
  );
}

/* ---------- Booklet & Markdown export modal (v0.6.0; picker + font — Task 88) ---------- */

/**
 * The booklet window: the Markdown block (unchanged), the booklet's article
 * picker (the shared .sel-list family over the dash.articleOptions rows —
 * nothing picked means ALL articles, the pure layer's default-all rule,
 * surfaced in the status line), and the booklet block's radio groups
 * (format / color / font) read at click time. The component is a pure
 * selection surface: options and the export ride injected props (the same
 * contract as BackupModal); the live highlight count is summed from the rows
 * themselves — they carry the exact comparable values.
 */
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
      <h2 id="booklet-title">کتابچه و Markdown</h2>
      <div className="modal-summary" id="booklet-summary">
        <SumRow k="هایلایت‌ها" v={dash.faNum(s.total)} />
        <SumRow k="مقاله‌ها" v={dash.faNum(s.pages)} />
        <SumRow k="یادداشت‌ها" v={dash.faNum(s.notes)} />
      </div>

      <section className="exp-sec">
        <h3>Markdown</h3>
        <p className="muted small">برای Obsidian و هر ویرایشگر Markdown — کل کتابخانه در یک فایل، هر مقاله یک بخش.</p>
        <button type="button" className="btn btn-primary" id="md-go" disabled={busy} onClick={() => { void onMarkdown().then(onClose); }}>
          دریافت فایل Markdown
        </button>
      </section>

      <SelSection title="مقاله‌های کتابچه" hint="بدون انتخاب، همه‌ی مقاله‌ها در کتابچه می‌آیند؛ با انتخاب، فقط همین‌ها.">
        {ao.length ? (
          <div className="sel-list" role="group" aria-label="انتخاب مقاله‌های کتابچه">
            {ao.map((a) => (
              <label className="sel-item" key={a.key}>
                <input
                  type="checkbox"
                  checked={articles.has(a.key)}
                  onChange={() => setArticles(toggleInSet(articles, a.key))}
                />
                <span className="sel-label" dir="auto">{format.excerpt(a.title, 60) || "بدون عنوان"}</span>
                <span className="muted small sel-side">{a.host}</span>
                <span className="muted small">{dash.faNum(a.count)} هایلایت</span>
              </label>
            ))}
          </div>
        ) : (
          <SelEmpty text="مقاله‌ای ثبت نشده است" />
        )}
        <div className="sel-status muted small" id="booklet-status" role="status">
          {pickedCount === 0
            ? "همه‌ی مقاله‌ها در کتابچه خواهند بود."
            : <><strong>{dash.faNum(pickedHighlights)}</strong> هایلایت از <strong>{dash.faNum(pickedCount)}</strong> مقاله در کتابچه خواهد بود.</>}
        </div>
      </SelSection>

      <section className="exp-sec">
        <h3>کتابچه چاپی</h3>
        <p className="muted small">طراحی‌شده برای چاپ A4 — جلد، فهرست و هر مقاله در صفحه‌ای جدا.</p>
        <div className="radio-list" role="radiogroup" aria-label="قالب کتابچه">
          <label className="radio">
            <input type="radio" name="bk-format" value="html" checked={fmt === "html"} onChange={() => setFmt("html")} />
            <span className="radio-txt">
              <strong>فایل HTML</strong>
              <span className="muted small">یک فایل آماده‌ی چاپ — در مرورگر باز کن و Ctrl+P بزن.</span>
            </span>
          </label>
          <label className="radio">
            <input type="radio" name="bk-format" value="pdf" checked={fmt === "pdf"} onChange={() => setFmt("pdf")} />
            <span className="radio-txt">
              <strong>PDF</strong>
              <span className="muted small">پنجره‌ی چاپ مرورگر باز می‌شود — «Save as PDF» را انتخاب کن.</span>
            </span>
          </label>
        </div>
        <div className="radio-list" role="radiogroup" aria-label="حالت رنگ کتابچه">
          <label className="radio">
            <input type="radio" name="bk-color" value="color" checked={colorMode === "color"} onChange={() => setColorMode("color")} />
            <span className="radio-txt">
              <strong>رنگی</strong>
              <span className="muted small">با رنگ اصلی هایلایت‌ها</span>
            </span>
          </label>
          <label className="radio">
            <input type="radio" name="bk-color" value="bw" checked={colorMode === "bw"} onChange={() => setColorMode("bw")} />
            <span className="radio-txt">
              <strong>سیاه‌وسفید</strong>
              <span className="muted small">جوهر کمتر — مناسب چاپگر معمولی</span>
            </span>
          </label>
        </div>
        <div className="radio-list" role="radiogroup" aria-label="فونت کتابچه">
          {fo.map((f) => (
            <label className="radio" key={f.id}>
              <input type="radio" name="bk-font" value={f.id} checked={font === f.id} onChange={() => setFont(f.id)} />
              <span className="radio-txt">
                <strong>{f.label} — پیش‌فرض</strong>
                <span className="muted small">اگر روی سیستم نصب نباشد، مرورگر فونت مشابهی نشان می‌دهد</span>
              </span>
            </label>
          ))}
          <label className="radio">
            <input type="radio" name="bk-font" value="custom" checked={font === "custom"} onChange={() => setFont("custom")} />
            <span className="radio-txt">
              <strong>فونت دلخواه</strong>
              <span className="muted small">هر فونتی که روی دستگاه شما نصب است — نامش را دقیق بنویسید</span>
              <input
                type="text"
                id="bk-custom-font"
                dir="auto"
                value={customFont}
                disabled={font !== "custom"}
                maxLength={60}
                placeholder="مثلاً: B Nazanin"
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
          ساخت کتابچه
        </button>
      </section>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" id="bk-cancel" ref={cancelRef} onClick={onClose}>بستن</button>
      </div>
    </ModalShell>
  );
}

/* ---------- Selective backup modal (بک‌آپ انتخابی) ---------- */

/** The picker's rows — dash.backupSelectionOptions' return shape. */
export interface BackupSelectionOptions {
  sites: Array<{ host: string; articles: number }>;
  articles: Array<{ key: string; host: string; title: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
}

function SelSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="exp-sec">
      <h3>{title}</h3>
      <p className="muted small">{hint}</p>
      {children}
    </section>
  );
}

function SelEmpty({ text }: { text: string }) {
  return <p className="muted small sel-none">{text}</p>;
}

/**
 * The selective backup window: sites / articles / tags as three checkbox
 * lists over the dash.backupSelectionOptions rows. Union semantics (a record
 * matching ANY checked row is exported) is stated in the status line; the
 * live count and the export run through the injected countOf/onExport — the
 * data layer's bindings to the store's ONE matching rule, so the component
 * stays a pure selection surface. Nothing selected (or nothing matching)
 * keeps the download disabled.
 */
export function BackupModal({ req, onClose, options, countOf, onExport }: {
  req: { open: boolean; payload: ModalRequest | null };
  onClose: () => void;
  options: BackupSelectionOptions;
  countOf: (sel: BackupSelection) => number;
  onExport: (sel: BackupSelection) => Promise<void>;
}) {
  const [hosts, setHosts] = useState<Set<string>>(new Set());
  const [articles, setArticles] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Set<string>>(new Set());

  /* fresh selection per open — the modal is a one-shot picker */
  useEffect(() => {
    if (req.open) { setHosts(new Set()); setArticles(new Set()); setTags(new Set()); }
  }, [req.open]);

  const sel: BackupSelection = { hosts: Array.from(hosts), articles: Array.from(articles), tags: Array.from(tags) };
  const picked = hosts.size + articles.size + tags.size;
  const matched = picked ? countOf(sel) : 0;
  const canGo = picked > 0 && matched > 0;
  const o = options || { sites: [], articles: [], tags: [] };

  return (
    <ModalShell id="backup-modal" labelledBy="backup-title" open={req.open} onClose={onClose} overlayCloses={false}>
      <h2 id="backup-title">بک‌آپ انتخابی</h2>
      <p className="muted small">بخشی از کتابخانه را خروجی بگیر — هر سایت، مقاله یا برچسبی که انتخاب کنی، هایلایت‌هایش داخل فایل می‌آیند.</p>

      <SelSection title="سایت‌ها" hint="تمام هایلایت‌های این سایت‌ها">
        {o.sites.length ? (
          <div className="sel-list" role="group" aria-label="انتخاب سایت‌ها">
            {o.sites.map((s) => (
              <label className="sel-item" key={s.host}>
                <input
                  type="checkbox"
                  checked={hosts.has(s.host)}
                  onChange={() => setHosts(toggleInSet(hosts, s.host))}
                />
                <span className="sel-label">{s.host}</span>
                <span className="muted small">{dash.faNum(s.articles)} مقاله</span>
              </label>
            ))}
          </div>
        ) : (
          <SelEmpty text="سایتی ثبت نشده است" />
        )}
      </SelSection>

      <SelSection title="مقاله‌ها" hint="هایلایت‌های همین مقاله‌ها">
        {o.articles.length ? (
          <div className="sel-list" role="group" aria-label="انتخاب مقاله‌ها">
            {o.articles.map((a) => (
              <label className="sel-item" key={a.key}>
                <input
                  type="checkbox"
                  checked={articles.has(a.key)}
                  onChange={() => setArticles(toggleInSet(articles, a.key))}
                />
                <span className="sel-label" dir="auto">{format.excerpt(a.title, 60) || "بدون عنوان"}</span>
                <span className="muted small sel-side">{a.host}</span>
                <span className="muted small">{dash.faNum(a.count)} هایلایت</span>
              </label>
            ))}
          </div>
        ) : (
          <SelEmpty text="مقاله‌ای ثبت نشده است" />
        )}
      </SelSection>

      <SelSection title="برچسب‌ها" hint="تمام هایلایت‌های مقاله‌های دارای این برچسب">
        {o.tags.length ? (
          <div className="sel-list" role="group" aria-label="انتخاب برچسب‌ها">
            {o.tags.map((t) => (
              <label className="sel-item" key={t.tag}>
                <input
                  type="checkbox"
                  checked={tags.has(t.tag)}
                  onChange={() => setTags(toggleInSet(tags, t.tag))}
                />
                <span className="sel-label" dir="auto">{t.tag}</span>
                <span className="muted small">{dash.faNum(t.count)} مقاله</span>
              </label>
            ))}
          </div>
        ) : (
          <SelEmpty text="برچسبی ثبت نشده است" />
        )}
      </SelSection>

      <div className="sel-status muted small" id="backup-status" role="status">
        {picked === 0
          ? "حداقل یک مورد را انتخاب کنید."
          : matched === 0
            ? "هیچ هایلایتی با این انتخاب مطابقت ندارد."
            : <><strong>{dash.faNum(matched)}</strong> هایلایت در فایل خواهد بود.</>}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" id="backup-cancel" onClick={onClose}>انصراف</button>
        <button
          type="button"
          className="btn btn-primary"
          id="backup-go"
          disabled={!canGo}
          onClick={() => { if (canGo) void onExport(sel).then(onClose); }}
        >
          دریافت فایل بک‌آپ
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Highlight preview modal (v0.6.1 — the full-text window) ---------- */

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
          {format.excerpt(full, 60) || "بدون عنوان"}
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
              <span className="hl-meta-t" dir="rtl">{format.fmtDateTime(rec.updatedAt || rec.createdAt)}</span>
            </div>
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
