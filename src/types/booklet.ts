/**
 * Print booklet contracts (Task 88 — the booklet's selection + typography).
 *
 * The runtime source of truth for font ids is the BOOKLET_FONTS registry in
 * extension/shared/booklet-export.js (hand-written JS, outside the TS
 * compile — the same runtime↔type split as BackupSelection). The union below
 * is its hand mirror, pinned by tests/unit/types-contract.test.ts: adding a
 * font to the registry without extending BookletFontId (or vice versa) goes
 * red there — never silently.
 */

/** The booklet font picker's options — ids of the BOOKLET_FONTS registry. */
export type BookletFontId = "vazir" | "tahoma" | "segoe" | "system";

/**
 * The per-build booklet options the export modal sends at click time:
 *   articles — the selected article keys (dash.articleKey values, exactly
 *              what the picker rows carry). EMPTY/absent = ALL articles (the
 *              default-all rule lives in ONE place: dash.filterGroupsByKeys).
 *   font     — a BookletFontId; absent/unknown → the builder's default stack
 *              (vazir), which renders identically to the pre-Task-88 booklet.
 * Both members are per-print choices (like the format/color radios) —
 * deliberately NOT settings: the booklet document itself is the artifact.
 */
export interface BookletBuildOptions {
  articles?: string[];
  font?: BookletFontId;
}
