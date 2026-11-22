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

/** UI language — drives the interface language, direction and the calendar
 *  of the displayed dates (fa/ar → rtl + Jalali/Hijri; the rest → ltr +
 *  Gregorian). DERIVED, not declared: this re-exports the union that
 *  src/shared/i18n.ts derives from its LANG_KEYS_DATA registry tuple, so
 *  the type layer can no longer drift from the runtime registry (the audit's
 *  R2 finding — the old hand-written union had already rotted to 3 of the
 *  12 languages). */
export type { Language } from '../shared/i18n';
import type { Language } from '../shared/i18n';

export interface Settings {
  defaultColor: HighlightColor;
  showToolbar: boolean;
  showBadge: boolean;
  /** Hosts where the extension is switched off (highlights hidden, data kept). */
  disabledHosts: string[];
  theme: ThemeKey;
  /** UI language (v0.14.0). Missing on pre-i18n records → 'fa' (the default
   *  keeps existing users' behavior; mergeSettings sanitizes invalid values). */
  language: Language;
}
