/* Type surface for the hand-written sibling JS module (extension/shared/domwrap.js).
   tsconfig `moduleResolution: bundler` resolves "./domwrap.js" from anchor.ts to
   this file for typing; the runtime resolver loads the real JS file (same folder
   in the emitted tree). Only the members TypeScript consumers touch are declared —
   widen when more of the namespace moves under tsc. */

export interface DomView {
  /** XPath serialize of a range — the structural anchor string */
  serializeRange(range: Range): string;
  /** resolve an anchor string back to a live range (null when dead).
      params typed `unknown` — records carry loosely-typed anchor/text until the
      shared-file wave tightens HighlightRecord; runtime expects strings */
  resolveAnchor(anchor: unknown, text: unknown): Range | null;
  isHidden(node: Node): boolean;
}

export declare const dom: DomView;
