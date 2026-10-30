/**
 * Phase 8 Task 4 slice 4 — the two-step confirm icon button (the view's
 * armButton contract as a component).
 *
 * First click arms: .armed class + aria-pressed + the confirm text replaces
 * the icon; 3.2s (or a second click) resets. The second click runs the action.
 * stopPropagation always — armed buttons live inside click-surfaces (the
 * group header) that must not react.
 */
import { useEffect, useRef, useState } from "react";
import { IconCopy, IconTrash, IconView, IconX } from "./icons";

const GLYPHS = {
  view: IconView,
  copy: IconCopy,
  trash: IconTrash,
  x: IconX,
} as const;

export type ArmIcon = keyof typeof GLYPHS;

/** The plain icon button (iconBtn) — single click, no confirm. */
export function IconButton({
  icon,
  title,
  className,
  onClick,
}: {
  icon: ArmIcon;
  title: string;
  className?: string;
  onClick: () => void;
}) {
  const Glyph = GLYPHS[icon];
  return (
    <button
      type="button"
      className={"icon-btn" + (className ? " " + className : "")}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      <Glyph />
    </button>
  );
}

export function ArmIconButton({
  icon,
  title,
  className,
  confirmText = "مطمئنید؟",
  onConfirm,
}: {
  icon: ArmIcon;
  title: string;
  className?: string;
  confirmText?: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function click(ev: React.MouseEvent) {
    ev.stopPropagation();
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3200);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    onConfirm();
  }

  const Glyph = GLYPHS[icon];
  return (
    <button
      type="button"
      className={"icon-btn" + (className ? " " + className : "") + (armed ? " armed" : "")}
      title={title}
      aria-label={title}
      aria-pressed={armed ? "true" : undefined}
      onClick={click}
    >
      {armed ? confirmText : <Glyph />}
    </button>
  );
}
