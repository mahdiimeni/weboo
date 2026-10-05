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
      {tags.map((t) => {
        const labelDir = dash.detectTextDir(t);
        return (
          <span className="atag" key={t} dir="rtl" title={t}>
            <span className="atag-t" dir={labelDir || undefined}>{t}</span>
            <button
              type="button"
              className="atag-x"
              title={"حذف برچسب " + t}
              aria-label={"حذف برچسب " + t}
              onClick={() => onRemoveTag(groupKey, t)}
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
          placeholder="نام برچسب…"
          aria-label="نام برچسب جدید"
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
          title="افزودن برچسب به این مقاله"
          aria-label="افزودن برچسب به این مقاله"
          dir="rtl"
          onClick={() => setEditing(true)}
        >
          <IconPlus />
          برچسب
        </button>
      )}
    </div>
  );
}
