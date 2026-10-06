/**
 * Settings domain types (modernization Phase 1).
 *
 * Values mirror HL.DEFAULT_SETTINGS / HL.THEMES in
 * extension/shared/constants.js — the runtime remains the source of truth;
 * tests/unit/types-contract.test.ts pins parity (a theme or color added to
 * the registries must be added here too, or typecheck fails).
 */

import type { HighlightColor } from './highlight';

export type ThemeKey = 'auto' | 'light' | 'dark';

export interface Settings {
  defaultColor: HighlightColor;
  showToolbar: boolean;
  showBadge: boolean;
  /** Hosts where the extension is switched off (highlights hidden, data kept). */
  disabledHosts: string[];
  theme: ThemeKey;
}
