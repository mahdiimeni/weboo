# Anchor Engine

How a highlight survives page reloads, SPA navigations and re-renders. The
engine lives in `extension/shared/` — `highlighter.js` (orchestrator),
`textindex` (normalized text index), `domwrap` (DOM primitives),
`anchor` (the resolver pipeline). The invariant that governs everything:

> A highlight restores correctly or becomes an explicit orphan — it never
> silently attaches elsewhere.

## Creation

`highlighter.createFromRange(range, text, color, note)` wraps the range in a
`mark` element and persists a record:

```
{ id, host, site, url, urlNorm, title, text, prefix, suffix,
  start, end, anchor, color, note, createdAt, updatedAt }
```

- `anchor` — the structural anchor: two XPath expressions (from the root to
  the boundary text nodes) + offsets inside them (serialized by
  `domwrap.serializeRange`). `null` when the structure could not be captured
  → the textual path carries the record alone.
- `prefix`/`suffix` — ~32 chars of context captured at creation (match
  scoring).
- `start`/`end` — offsets in the normalized text index at creation.

## Restore (the boot path)

`applyAll()` applies every record for the page, oldest first:

1. **Structural** — `anchor.resolveStructural(rec)` evaluates the stored
   XPaths and re-creates the Range directly. The common case: records created
   by the same engine version restore exactly.
2. **Textual** (`findRange`) — when the structure fails (layout changed,
   dynamic DOM), the resolver pipeline runs three strategies in order, first
   match wins:
   - `offsets` — the saved text-index offsets, if the normalized text is
     unchanged nearby;
   - `exact` — the exact quote with prefix/suffix scoring across candidate
     positions;
   - `norm` — candidates on the normalized text (whitespace/zero-width
     squashed), scored with a **visibility bonus (+8)**: among duplicate
     copies of the same text, the one actually on screen wins (the v0.6.7
     duplicate-copy invariant).
3. **Applied invariant** — a record counts as applied only when ≥ 1 VISIBLE
   mark exists. Hidden copies are kept, never nested (re-entry guard).
4. **Self-heal** — a successful textual resolve rewrites `anchor`/`start`/
   `end` on the record (debounced save): the next boot is structural again.
5. **Orphans** — records that resolve nowhere are retried on a bounded
   schedule (12 × 3.5s) plus coalesced MutationObserver reconciles and
   safety-net reconciles at 3s/8s after boot. They are visible as failures,
   never as misplaced marks.

## SPA / dynamic pages

- `watchHref` polls `location.href` on a light interval + `popstate`/
  `hashchange` (deduped); a navigation re-keys the page (`setPage`), re-runs
  the restore, and stale async work is dropped via `navSeq`.
- `reconcile()` re-applies every record whose marks vanished (React
  remounts, hydration wipes) — the remount scenarios in `next-compat` pin it.
- The UI widgets mount into Shadow-DOM hosts that a watchdog re-appends if a
  framework detaches them.

## Performance

`docs/benchmarks.md` measured create/restore across doc sizes × highlight
densities before and after the migration: no regression; per-item restore
cost is flat up to ~100 highlights at fixed doc size. The known O(doc ×
marks) shape of the index rebuild is the first candidate if it ever matters
in practice.
