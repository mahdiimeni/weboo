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
 *  of the displayed dates (fa → rtl + Jalali; en/de → ltr + Gregorian, with
 *  de rendering German number/date formats). Mirrors LANG_KEYS in
 *  shared/i18n (src/shared/i18n.ts — the runtime registry). */
export type Language = 'fa' | 'en' | 'de';

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
