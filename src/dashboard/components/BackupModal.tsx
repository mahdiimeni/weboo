/**
 * The selective backup modal (بک‌آپ انتخابی) — audit R8 (Modals.tsx split):
 * pure move, body unchanged.
 *
 * Sites / articles / tags as three checkbox lists over the
 * dash.backupSelectionOptions rows. Union semantics (a record matching ANY
 * checked row is exported) is stated in the status line; the live count and
 * the export run through the injected countOf/onExport — the data layer's
 * bindings to the store's ONE matching rule, so the component stays a pure
 * selection surface. Nothing selected (or nothing matching) keeps the
 * download disabled. Same overlay/modal family: Escape + انصراف close;
 * overlay clicks don't.
 */
import { useEffect, useState } from "react";
import type { BackupSelection } from "../../types/storage";
import { format } from "../../../extension/shared/format.js";
import { t, count } from "../../../extension/shared/i18n.js";
import { ModalShell, type ModalRequest, type BackupSelectionOptions } from "./modal-shared";
import { SelSection, SelEmpty, toggleInSet } from "./sel-shared";

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
      <h2 id="backup-title">{t("sel.title")}</h2>
      <p className="muted small">{t("sel.desc")}</p>

      <SelSection title={t("sel.sites")} hint={t("sel.sitesHint")}>
        {o.sites.length ? (
          <div className="sel-list" role="group" aria-label={t("sel.sitesAria")}>
            {o.sites.map((s) => (
              <label className="sel-item" key={s.host}>
                <input
                  type="checkbox"
                  checked={hosts.has(s.host)}
                  onChange={() => setHosts(toggleInSet(hosts, s.host))}
                />
                <span className="sel-label">{s.host}</span>
                <span className="muted small">{count("common.nArticles", s.articles)}</span>
              </label>
            ))}
          </div>
        ) : (
          <SelEmpty text={t("sel.emptySites")} />
        )}
      </SelSection>

      <SelSection title={t("sel.articles")} hint={t("sel.articlesHint")}>
        {o.articles.length ? (
          <div className="sel-list" role="group" aria-label={t("sel.articlesAria")}>
            {o.articles.map((a) => (
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
      </SelSection>

      <SelSection title={t("sel.tags")} hint={t("sel.tagsHint")}>
        {o.tags.length ? (
          <div className="sel-list" role="group" aria-label={t("sel.tagsAria")}>
            {o.tags.map((t) => (
              <label className="sel-item" key={t.tag}>
                <input
                  type="checkbox"
                  checked={tags.has(t.tag)}
                  onChange={() => setTags(toggleInSet(tags, t.tag))}
                />
                <span className="sel-label" dir="auto">{t.tag}</span>
                <span className="muted small">{count("common.nArticles", t.count)}</span>
              </label>
            ))}
          </div>
        ) : (
          <SelEmpty text={t("sel.emptyTags")} />
        )}
      </SelSection>

      <div className="sel-status muted small" id="backup-status" role="status">
        {picked === 0
          ? t("sel.pickOne")
          : matched === 0
            ? t("sel.noMatch")
            : count("sel.status", matched)}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" id="backup-cancel" onClick={onClose}>{t("common.cancel")}</button>
        <button
          type="button"
          className="btn btn-primary"
          id="backup-go"
          disabled={!canGo}
          onClick={() => { if (canGo) void onExport(sel).then(onClose); }}
        >
          {t("sel.download")}
        </button>
      </div>
    </ModalShell>
  );
}
