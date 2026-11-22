/**
 * Weboo — localization core (SRP: language state + translation lookup)
 *
 * One shared i18n layer for EVERY surface: React dashboard, popup, content
 * widgets (Shadow DOM), toasts, the service worker's context menu and the
 * generated export documents. Pure, DOM-optional, React-free, platform-free —
 * the same port pattern as the rest of src/shared.
 *
 * Design:
 *  - The ENGLISH dictionary (i18n/en.ts) is the canonical key set
 *    (`TranslationKey`); every other dictionary is typed
 *    `Record<TranslationKey, …>` — a key present in one and missing in
 *    another is a COMPILE error (types-contract test re-pins it at runtime;
 *    a grep test covers the JS-only call sites).
 *  - DICTIONARIES ARE DATA MODULES (audit R1 — payload diet): i18n/en ships
 *    with THIS module everywhere; the other eleven (i18n/<lang>.ts) register
 *    via i18n/all.js on the pages and the SW (their bundles are not injected
 *    into web pages), while the CONTENT bundle fetches them on demand —
 *    setDictionaryLoader (composition root wires it) + ensureLanguage. This
 *    keeps the module DOM-optional, React-free and platform-free (DIP: the
 *    loader is injected, never imported).
 *  - `t(key, params)` interpolates `{name}` placeholders. A plural value is
 *    `{ one, other }` and picks `one` only for n === 1 (English; Persian has
 *    no plural after numerals — its entries stay plain strings).
 *  - A MISSING dictionary degrades exactly like a missing key: to the
 *    canonical (English) dictionary, then to the key itself — never an empty
 *    UI; the completeness tests make the missing-key path unreachable for
 *    registered languages.
 *  - Language state is module-scoped with explicit ownership: composition
 *    roots set it from settings (content.js / popup.js / dashboard data.ts /
 *    the service worker); `onChange` subscriptions keep it from leaking.
 *  - Direction is a UI-language property (dirOf): fa → rtl, en → ltr. It is
 *    INDEPENDENT of content direction (shared/detect-dir.js stays the single
 *    source for article/page content).
 *  - `applyDom` translates static page markup via data-i18n* attributes —
 *    the popup and the dashboard shell keep their byte-stable templates and
 *    stay the markup contract; the attributes are the only addition.
 *
 * Compiled by `bun run build:ext` into extension/shared/i18n.js (+ the
 * i18n/*.js dictionary modules beside it) — never edit the .js. Loaded
 * right after shared/constants.js everywhere (manifest list + every
 * page/entry import); format.js consumes it for language-aware
 * number/date rendering.
 */
/**
 * The language registry data — the ONE source both the `Language` union and
 * the exported LANG_KEYS array derive from (drift tripwire: adding/removing
 * a language here fails tsc on every `Record<Language, …>` registry below —
 * LANGUAGES/LOCALES/DATE_LOCALES — until each carries the key; the type
 * mirror in src/types/settings.ts re-exports this derived union, so it can
 * no longer drift at all).
 */
const LANG_KEYS_DATA = ['fa', 'en', 'de', 'es', 'ru', 'it', 'fr', 'tr', 'zh', 'ja', 'ko', 'ar'];
import { en } from "./i18n/en.js";
/* ------------------------------------------------------------------ */
/* Language registry + state                                           */
/* ------------------------------------------------------------------ */
/**
 * The language registry — order is the selector's display order; `dir` is
 * THE UI-direction policy (a language property, independent of content
 * direction — see shared/detect-dir.js). A new language = one entry in
 * LANG_KEYS_DATA above, one entry here, and its dictionary.
 */
export const LANGUAGES = {
    fa: { label: 'lang.fa', dir: 'rtl' },
    en: { label: 'lang.en', dir: 'ltr' },
    de: { label: 'lang.de', dir: 'ltr' },
    es: { label: 'lang.es', dir: 'ltr' },
    ru: { label: 'lang.ru', dir: 'ltr' },
    it: { label: 'lang.it', dir: 'ltr' },
    fr: { label: 'lang.fr', dir: 'ltr' },
    tr: { label: 'lang.tr', dir: 'ltr' },
    zh: { label: 'lang.zh', dir: 'ltr' },
    ja: { label: 'lang.ja', dir: 'ltr' },
    ko: { label: 'lang.ko', dir: 'ltr' },
    ar: { label: 'lang.ar', dir: 'rtl' }
};
export const LANG_KEYS = [...LANG_KEYS_DATA];
/**
 * The BCP-47 locale each language renders numbers and dates with — the ONE
 * home of that mapping (format.js consumes it; no scattered conditionals).
 */
export const LOCALES = {
    fa: 'fa-IR',
    en: 'en-US',
    de: 'de-DE',
    es: 'es-ES',
    ru: 'ru-RU',
    it: 'it-IT',
    fr: 'fr-FR',
    tr: 'tr-TR',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    /* 'ar' + -nu-arab — Arabic-Indic numerals (٠١٢٣) for the Arabic UI,
       with the proper Arabic grouping/decimal separators (١٬٢٥٠ / ٢٫٥) */
    ar: 'ar-u-nu-arab'
};
/**
 * The DATE locale per language — the calendar policy lives here as a BCP-47
 * -u-ca- extension, separate from LOCALES (digits/separators are calendar-
 * independent, so number formatting stays on LOCALES):
 *   fa → Persian (Jalali) calendar — now EXPLICIT instead of relying on
 *        ICU's fa-IR default (output-identical, environment-robust),
 *   ar → Islamic (Umm al-Qura) calendar — the Hijri dates, Western digits
 *        preserved by the region-neutral base,
 *   everything else → Gregorian (the plain locale).
 * Consumers: format.js fmtDate/fmtDateTime ONLY.
 */
export const DATE_LOCALES = {
    fa: 'fa-IR-u-ca-persian',
    en: 'en-US',
    de: 'de-DE',
    es: 'es-ES',
    ru: 'ru-RU',
    it: 'it-IT',
    fr: 'fr-FR',
    tr: 'tr-TR',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    ar: 'ar-u-ca-islamic-umalqura-nu-arab'
};
/* Registered dictionaries: en ships with this module (the canonical key set
   + t()'s fallback). Every other language registers at module-eval on the
   pages and the SW (i18n/all.js) or on demand in the content bundle (the
   injected loader → ensureLanguage). A MISSING dictionary degrades exactly
   like a missing key — see the fallback in t()/count(). */
const DICTS = { en: en };
const DEFAULT_LANG = 'en';
/* Module-scoped state with explicit ownership: composition roots set it
   (content.js / popup.js / data.ts / the SW); everything else reads.
   This singleton is the SANCTIONED shared-context dependency (audit R6 —
   the decision record lives in docs/architecture.md). */
let current = DEFAULT_LANG;
const subscribers = new Set();
/** Validates raw storage values — anything unknown degrades to the default
 *  (the same boundary-validation pattern as themes/colors). */
export function validLanguage(v) {
    return (LANG_KEYS.indexOf(v) !== -1) ? v : DEFAULT_LANG;
}
/** The active UI language. */
export function getLanguage() {
    return current;
}
/** The UI direction of a language (default: the active one). */
export function dirOf(lang) {
    return LANGUAGES[lang || current].dir;
}
/**
 * Sets the active language (invalid → default) and notifies subscribers.
 * Returns the applied language. Does NOT touch the DOM — pages that need
 * the document root updated call ui.applyLangNow (ui/base.js, the same
 * split as theme: setTheme vs applyThemeNow).
 */
export function setLanguage(lang) {
    current = validLanguage(lang);
    subscribers.forEach(function (cb) {
        try {
            cb();
        }
        catch (e) { /* a broken listener never blocks the rest */ }
    });
    return current;
}
/** Subscribes to language changes → unsubscribe (the store's onChange pattern). */
export function onChange(cb) {
    subscribers.add(cb);
    return function () { subscribers.delete(cb); };
}
/* ------------------------------------------------------------------ */
/* Dictionary registration + on-demand loading (audit R1 — payload diet) */
/* ------------------------------------------------------------------ */
/**
 * Registers/replaces one language's dictionary. TS callers pass a
 * `Record<TranslationKey, DictValue>` (compile-checked); the SW-delivered
 * runtime path passes the module-shape object the SW itself loaded, after
 * the receiving side checked it is a plain object. Unknown languages and
 * garbage dictionaries are ignored (the boundary-validation pattern) —
 * false means "not registered".
 */
export function registerDictionary(lang, dict) {
    const key = validLanguage(lang);
    if (key !== lang || !dict || typeof dict !== 'object')
        return false;
    DICTS[key] = dict;
    return true;
}
/**
 * The registered dictionary of one language, or null when that language is
 * not registered (the SW's hlx:i18n-dict response builder; parseMessage has
 * already validated the requested lang before this is consulted).
 */
export function getDictionary(lang) {
    const key = validLanguage(lang);
    return DICTS[key] || null;
}
let dictLoader = null;
const inflight = new Map();
export function setDictionaryLoader(loader) {
    dictLoader = loader;
}
/**
 * Resolves once the language's dictionary is available for t()/count():
 * already registered (or no loader wired) → immediate; otherwise calls the
 * injected loader ONCE per language (in-flight memoized) and registers a
 * plain-object result. Failure of any kind (loader rejects, garbage
 * payload) resolves anyway — t() then degrades to the canonical dictionary
 * exactly like a missing key. Never rejects.
 */
export function ensureLanguage(lang) {
    const target = validLanguage(lang);
    const loader = dictLoader;
    if (DICTS[target] || !loader)
        return Promise.resolve(target);
    let p = inflight.get(target);
    if (!p) {
        p = Promise.resolve()
            .then(function () { return loader(target); })
            .then(function (dict) { if (dict && typeof dict === 'object')
            registerDictionary(target, dict); })
            .catch(function () { })
            .then(function () { inflight.delete(target); });
        inflight.set(target, p);
    }
    return p.then(function () { return target; });
}
/* ------------------------------------------------------------------ */
/* Translation lookup                                                  */
/* ------------------------------------------------------------------ */
const INTERP_RE = /\{(\w+)\}/g;
/* CLDR plural form selection — cached rules per language (the same LOCALES
   that format the digits; one home). 'zero'/'two' never occur for our eight
   locales and fall through to `other` at the lookup. */
const pluralRulesCache = {};
function pluralForm(lang, n) {
    try {
        if (typeof Intl !== 'undefined' && Intl.PluralRules) {
            if (!pluralRulesCache[lang])
                pluralRulesCache[lang] = new Intl.PluralRules(LOCALES[lang]);
            const f = pluralRulesCache[lang].select(n);
            if (f === 'zero' || f === 'one' || f === 'two' || f === 'few' || f === 'many')
                return f;
        }
    }
    catch (e) { /* no ICU — the one/other fallback below */ }
    return n === 1 ? 'one' : 'other';
}
/**
 * Translates a key in the active language with `{name}` interpolation.
 * Fallback order: active dictionary → the other dictionary → the key itself
 * (visible, never empty — and unreachable for typed TS call sites).
 * A plural value (`{one, other}`) picks `one` only for n === 1 (English;
 * Persian numerals never pluralize — its plural-capable keys stay strings).
 */
export function t(key, params) {
    const dict = DICTS[current];
    const own = dict ? dict[key] : undefined; /* unregistered language → the canonical dictionary */
    const raw = own !== undefined ? own : DICTS.en[key]; /* fallback: the canonical dictionary, then the key itself */
    let s;
    if (raw && typeof raw === 'object') {
        const n = Number(params && params.n);
        s = (n === 1 && raw.one) ? raw.one : raw.other;
    }
    else {
        s = String(raw === undefined ? key : raw);
    }
    if (!params)
        return s;
    return s.replace(INTERP_RE, function (m, name) {
        return params[name] !== undefined ? String(params[name]) : m;
    });
}
/**
 * A formatted count fragment — the plural contract keyed on the NUMBER
 * (one/other) with the DIGITS rendered per the active language (fa →
 * Persian, en → Latin; the same rendering format.num applies — kept local
 * because format.js consumes i18n, not the reverse).
 */
export function count(key, n) {
    const num = Number(n) || 0;
    const dict = DICTS[current];
    const own = dict ? dict[key] : undefined; /* unregistered language → the canonical dictionary */
    const raw = own !== undefined ? own : DICTS.en[key];
    let s;
    if (raw && typeof raw === 'object') {
        s = raw[pluralForm(current, num)] || raw.other;
    }
    else {
        s = String(raw === undefined ? key : raw);
    }
    let formatted;
    try {
        formatted = num.toLocaleString(LOCALES[current]);
    }
    catch (e) {
        formatted = String(num);
    }
    return s.replace(INTERP_RE, function (m, name) {
        return name === 'n' ? formatted : m;
    });
}
/* ------------------------------------------------------------------ */
/* Static-markup translation (data-i18n* attributes)                   */
/* ------------------------------------------------------------------ */
/**
 * Applies translations to static markup: every element carrying
 *   data-i18n           → textContent
 *   data-i18n-aria      → aria-label
 *   data-i18n-title     → title
 *   data-i18n-placeholder → placeholder
 * gets the corresponding key's translation. Idempotent — pages call it at
 * boot and on every language change. The templates keep their byte-stable
 * Persian markup (the packaging contract); the attributes are additive.
 */
export function applyDom(root) {
    if (!root || !root.querySelectorAll)
        return;
    const walk = (sel, fn) => {
        const list = root.querySelectorAll('[' + sel + ']');
        for (let i = 0; i < list.length; i++) {
            const el = list[i];
            const key = el.getAttribute(sel);
            const v = t(key);
            if (v)
                fn(el, v);
        }
    };
    walk('data-i18n', (el, v) => { el.textContent = v; });
    walk('data-i18n-aria', (el, v) => { el.setAttribute('aria-label', v); });
    walk('data-i18n-title', (el, v) => { el.setAttribute('title', v); });
    walk('data-i18n-placeholder', (el, v) => { el.setAttribute('placeholder', v); });
}
export const i18n = {
    LANGUAGES: LANGUAGES,
    LANG_KEYS: LANG_KEYS,
    validLanguage: validLanguage,
    getLanguage: getLanguage,
    setLanguage: setLanguage,
    dirOf: dirOf,
    onChange: onChange,
    registerDictionary: registerDictionary,
    getDictionary: getDictionary,
    setDictionaryLoader: setDictionaryLoader,
    ensureLanguage: ensureLanguage,
    t: t,
    count: count,
    applyDom: applyDom
};
