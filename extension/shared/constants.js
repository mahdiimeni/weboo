/**
 * Web Highlighter — shared constants and conventions
 * Every consumer (content bundle, pages, service worker, TS sources) imports
 * these bindings as an ES module.
 */

  export const APP_NAME = 'وب هایلایتر';
  export const APP_ID = 'web-highlighter';
  export const VERSION = '0.6.7';
  export const BACKUP_FORMAT = 1;

  /** Runtime message types */
  export const MSG = {
    COUNT_REPORT: 'hlx:count-report',     // content → SW: badge update
    GET_COUNT: 'hlx:get-count',           // SW/popup → content: fetch count
    GOTO: 'hlx:goto',                     // popup → content: scroll to highlight
    HIGHLIGHT_SELECTION: 'hlx:highlight-selection' // SW → content: highlight current selection
  };

  /** Hash prefix for jumping straight to a highlight (#hlx-goto-<id>) */
  export const GOTO_HASH_PREFIX = 'hlx-goto-';

  /** Dashboard settings panel deeplink hash (#hlx-settings — from the popup gear button) */
  export const SETTINGS_HASH = 'hlx-settings';

  /**
   * Highlight color registry — single source of order/label/color dot.
   * Sync convention: every key here must have a matching background-color
   * rule for data-hl-color="<key>" in content/mark-style.css (and vice versa).
   * The tests/unit/colors.test.ts test verifies this convention on every run
   * so adding a new color stays a one-entry registry change + one CSS rule.
   */
  export const COLORS = {
    yellow: { label: 'زرد',       dot: '#f5b800' },
    green:  { label: 'سبز',       dot: '#58b85c' },
    teal:   { label: 'فیروزه‌ای', dot: '#35b3ae' },
    pink:   { label: 'صورتی',     dot: '#e5679b' },
    purple: { label: 'بنفش',      dot: '#a478e8' }
  };
  export const COLOR_KEYS = Object.keys(COLORS);

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
  export const THEMES = {
    auto:  { label: 'هماهنگ با سیستم' },
    light: { label: 'روشن' },
    dark:  { label: 'تاریک' }
  };
  export const THEME_KEYS = Object.keys(THEMES);

  /**
   * Article-tag limits (v1.2.15) — consumed by shared/tags.js (the tag domain
   * module) and enforced on every write through the storage integrity gate.
   * TAG_MAX_LEN is in UTF-16 code units AFTER whitespace cleanup (Persian
   * ZWNJ counts as a normal character); TAG_MAX_PER_ARTICLE caps one article's
   * tag list (sanitizeTagList slices, the dashboard shows a Persian toast
   * BEFORE the cap is hit so the user gets an explanation instead of a
   * silent drop).
   */
  export const TAG_MAX_LEN = 30;
  export const TAG_MAX_PER_ARTICLE = 8;

  /** Default settings */
  export const DEFAULT_SETTINGS = {
    defaultColor: 'yellow',
    showToolbar: true,
    showBadge: true,
    disabledHosts: [],
    theme: 'auto'
  };


