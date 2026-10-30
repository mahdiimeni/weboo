/**
 * Phase 8 Task 4 slice 4 — the article tags row (v1.2.15) as a React
 * component (the view's buildTagsRow).
 *
 * Direction contracts preserved exactly (v0.6.2):
 *  - the CHIP is Persian chrome → unconditional dir="rtl" (the X at the
 *    reading-flow END, one pill shape in LTR and RTL cards alike);
 *  - the tag TEXT is user content → its own direction (dash.detectTextDir)
 *    on the .atag-t label — 'ltr'/'rtl' explicit, neutral inherits the chip;
 *  - the add chip «+ برچسب» is chrome → dir="rtl"; the inline input takes
 *    dir="auto" (typing-time first-strong detection).
 *
 * The add chip swaps into an inline input (the per-card idle ⇄ editing micro
 * state machine): Enter commits the trimmed value via onAddTag, Escape/blur
 * cancels. maxLength from the shared TAG_MAX_LEN registry constant.
 */
import { useRef, useState } from "react";
import { dash } from "../../../extension/dashboard/dashboard-data.js";
import { TAG_MAX_LEN } from "../../../extension/shared/constants.js";
import { IconPlus, IconX } from "./icons";
import { t, dirOf } from "../../../extension/shared/i18n.js";

export interface TagHandlers {
  onAddTag: (key: string, rawTag: string) => void;
  onRemoveTag: (key: string, tag: string) => void;
}

export function TagsRow({ groupKey, tags, onAddTag, onRemoveTag }: {
  groupKey: string;
  tags: string[];
  onAddTag: (key: string, rawTag: string) => void;
  onRemoveTag: (key: string, tag: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const v = (inputRef.current?.value || "").trim();
    setEditing(false);
    if (v) onAddTag(groupKey, v);
  }

  return (
    <div className="group-tags">
      {tags.map((tag) => {
        const labelDir = dash.detectTextDir(tag);
        return (
          <span className="atag" key={tag} dir={dirOf()} title={tag}>
            <span className="atag-t" dir={labelDir || undefined}>{tag}</span>
            <button
              type="button"
              className="atag-x"
              title={t("tags.removeTitle", { tag: tag })}
              aria-label={t("tags.removeTitle", { tag: tag })}
              onClick={() => onRemoveTag(groupKey, tag)}
            >
              <IconX />
            </button>
          </span>
        );
      })}
      {editing ? (
        <input
          type="text"
          className="tag-input"
          ref={inputRef}
          maxLength={TAG_MAX_LEN}
          dir="auto"
          placeholder={t("tags.placeholder")}
          aria-label={t("tags.inputAria")}
          autoFocus
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              commit();
            } else if (ev.key === "Escape") {
              ev.preventDefault();
              setEditing(false);
            }
          }}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          className="atag-add"
          title={t("tags.addTitle")}
          aria-label={t("tags.addTitle")}
          dir={dirOf()}
          onClick={() => setEditing(true)}
        >
          <IconPlus />
          {t("tags.add")}
        </button>
      )}
    </div>
  );
}
