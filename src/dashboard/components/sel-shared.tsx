/**
 * The selection-picker family shared pieces (audit R8 — Modals.tsx split:
 * pure moves, no behavior change). Consumed by BookletModal and BackupModal —
 * the shared .sel-list family, its section chrome and the ONE immutable
 * Set-toggle helper behind every picker checkbox.
 */

/** Immutable Set toggle — the ONE state helper behind every picker checkbox
 *  (BackupModal + BookletModal): a fresh Set each click so snapshot identity
 *  drives the re-render. */
export function toggleInSet(cur: Set<string>, v: string): Set<string> {
  const next = new Set(cur);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

export function SelSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="exp-sec">
      <h3>{title}</h3>
      <p className="muted small">{hint}</p>
      {children}
    </section>
  );
}

export function SelEmpty({ text }: { text: string }) {
  return <p className="muted small sel-none">{text}</p>;
}
