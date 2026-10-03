/* Type view of the hand-written extension/shared/constants.js — the src/ tree has no
   constants.ts (it is not an emitted file), so TS consumers resolve './constants.js'
   to this .d.ts while runtime resolves the sibling JS (same split as domwrap.d.ts).
   Members are loose: the JS namespace is dynamically assembled and genuinely
   untyped — tighten per member when a consumer needs it. */
export const APP_NAME: string;
export const APP_ID: string;
export const BACKUP_FORMAT: number;
export const VERSION: string;
export const GOTO_HASH_PREFIX: string;
export const MSG: Record<string, any>;
export const COLORS: Record<string, any>;
export const COLOR_KEYS: string[];
export const THEME_KEYS: string[];
export const TAG_MAX_LEN: number;
export const TAG_MAX_PER_ARTICLE: number;
export const DEFAULT_SETTINGS: Record<string, unknown>;
