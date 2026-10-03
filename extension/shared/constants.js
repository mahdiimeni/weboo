/**
 * Web Highlighter — shared constants and conventions
 * This file must work both as a classic script (in the content script and
 * extension pages) and as a side-effect import in the service worker (module);
 * hence it has no import/export at all and puts everything on globalThis.HL.
 */
(function () {
  'use strict';
  const HL = (globalThis.HL = globalThis.HL || {});

  HL.APP_NAME = 'وب هایلایتر';
  HL.APP_ID = 'web-highlighter';
  HL.VERSION = '0.6.7';
  HL.BACKUP_FORMAT = 1;

  /** Runtime message types */
  HL.MSG = {
    COUNT_REPORT: 'hlx:count-report',     // content → SW: badge update
    GET_COUNT: 'hlx:get-count',           // SW/popup → content: fetch count
    GOTO: 'hlx:goto',                     // popup → content: scroll to highlight
    HIGHLIGHT_SELECTION: 'hlx:highlight-selection' // SW → content: highlight current selection
  };

  /** Hash prefix for jumping straight to a highlight (#hlx-goto-<id>) */
  HL.GOTO_HASH_PREFIX = 'hlx-goto-';

  /** Dashboard settings panel deeplink hash (#hlx-settings — from the popup gear button) */
  HL.SETTINGS_HASH = 'hlx-settings';

  /**
   * Highlight color registry — single source of order/label/color dot.
   * Sync convention: every key here must have a matching background-color
   * rule for data-hl-color="<key>" in content/mark-style.css (and vice versa).
   * The tests/unit/colors.test.ts test verifies this convention on every run
   * so adding a new color stays a one-entry registry change + one CSS rule.
   */
  HL.COLORS = {
    yellow: { label: 'زرد',       dot: '#f5b800' },
    green:  { label: 'سبز',       dot: '#58b85c' },
    teal:   { label: 'فیروزه‌ای', dot: '#35b3ae' },
    pink:   { label: 'صورتی',     dot: '#e5679b' },
    purple: { label: 'بنفش',      dot: '#a478e8' }
  };
  HL.COLOR_KEYS = Object.keys(HL.COLORS);

  /**
   * Extension UI theme registry — single source of order/label (same pattern as HL.COLORS).
   *   auto  → follow the system prefers-color-scheme (default/previous behavior)
   *   light → forced light
   *   dark  → forced dark
   * Applied by: HL.domkit.applyTheme on extension pages (popup/dashboard) and
   * HL.ui.setTheme (ui/base.js) on the Shadow DOM hosts of the content widgets
   * (floating toolbar/note popover/toast) — widgets are keyed via data-theme
   * on their own :host and through the composition root (settings).
   */
  HL.THEMES = {
    auto:  { label: 'هماهنگ با سیستم' },
    light: { label: 'روشن' },
    dark:  { label: 'تاریک' }
  };
  HL.THEME_KEYS = Object.keys(HL.THEMES);

  /**
   * Article-tag limits (v1.2.15) — consumed by shared/tags.js (the tag domain
   * module) and enforced on every write through the storage integrity gate.
   * TAG_MAX_LEN is in UTF-16 code units AFTER whitespace cleanup (Persian
   * ZWNJ counts as a normal character); TAG_MAX_PER_ARTICLE caps one article's
   * tag list (sanitizeTagList slices, the dashboard shows a Persian toast
   * BEFORE the cap is hit so the user gets an explanation instead of a
   * silent drop).
   */
  HL.TAG_MAX_LEN = 30;
  HL.TAG_MAX_PER_ARTICLE = 8;

  /** Default settings */
  HL.DEFAULT_SETTINGS = {
    defaultColor: 'yellow',
    showToolbar: true,
    showBadge: true,
    disabledHosts: [],
    theme: 'auto'
  };
})();

/* identity export (7c-1): the two names content imports; others stay on the HL namespace until their importer arrives */
export const MSG = globalThis.HL.MSG;
export const GOTO_HASH_PREFIX = globalThis.HL.GOTO_HASH_PREFIX;
