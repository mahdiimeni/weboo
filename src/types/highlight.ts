/**
 * Domain models — highlighting (modernization Phase 1).
 *
 * The JavaScript engine (extension/shared/highlighter.js) remains the runtime
 * source of truth until its own TS migration; this file types what the source
 * ACTUALLY writes/accepts (verified against highlighter.js's record literal and
 * store.test.ts's minimal literal). tests/unit/types-contract.test.ts pins
 * runtime ↔ type parity so the two cannot drift silently.
 *
 * Compatibility rule (migration §6): storage must keep reading both the
 * full engine-written shape and the minimal persisted core.
 */

/** Must stay in key-sync with HL.COLOR_KEYS (guarded by tests/unit/colors.test.ts + the parity test). */
export type HighlightColor = 'yellow' | 'orange' | 'green' | 'teal' | 'pink' | 'purple';

/**
 * XPath structural anchor as produced by HL.dom.serializeRange:
 * two XPath expressions + offsets inside their resolved nodes.
 * `null` on the record = structural anchor failed → textual re-resolve path.
 */
export interface HighlightAnchor {
  start: string;
  startOffset: number;
  end: string;
  endOffset: number;
}

/**
 * A highlight record.
 *
 * Required fields = the persisted core that store.save() accepts today
 * (see store.test.ts). Everything else is written by the current engine
 * (highlighter.js createFromRange) but may be absent on records written by
 * older versions — read them defensively (the engine already does).
 */
export interface HighlightRecord {
  /* persisted core (required) */
  id: string;
  host: string;
  url: string;
  urlNorm: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  /* engine-written, read-defensively */
  site?: string;
  title?: string;
  /** context before the quote at creation (32 chars) — match scoring */
  prefix?: string;
  /** context after the quote at creation (32 chars) — match scoring */
  suffix?: string;
  /** normalized-text offsets at creation (text-index coordinates) */
  start?: number;
  end?: number;
  anchor?: HighlightAnchor | null;
  color?: HighlightColor;
  /** user note; empty string = none. Presence of a note underlines the mark. */
  note?: string;
}
