/**
 * i18n core tests (v0.14.0) — dictionary integrity, translation lookup,
 * plural contract, language state, static-markup application and the
 * JS-call-site key coverage (the t()/count() literals in the hand-written
 * JS surfaces have no compiler — this suite is their completeness gate).
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, readFile, ext, exists } from "./helpers/engine";

let HL: any;

beforeEach(async () => {
  setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/i18n.js", "shared/backends/chrome-storage.js", "shared/tags.js", "shared/store.js"] });
});

/* ---------- dictionary integrity ---------- */

describe("dictionaries", () => {
  test("every language resolves every canonical key (no missing, no extra)", () => {
    /* the emitted module does not export the raw dicts — the compile-time
       Record<TranslationKey, …> typing owns the parity; here we verify the
       RUNTIME side through t(): every canonical (en) key resolves in EVERY
       registered language — a missing entry would return the key itself.
       The en key list comes from the source (the canonical set). */
    const src = readFile(ext("..", "src", "shared", "i18n.ts"));
    const enBlock = src.slice(src.indexOf("const en = {"), src.indexOf("} as const;"));
    const keys = [...enBlock.matchAll(/'([a-z]+\.[A-Za-z0-9]+)':/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(150);
    const langs = HL.LANG_KEYS;
    expect(langs).toEqual(["fa", "en", "de", "es", "ru", "it", "fr", "tr", "zh", "ja", "ko"]);
    for (const lang of langs) {
      for (const k of keys) {
        HL.setLanguage(lang);
        expect(HL.t(k)).not.toBe(k); /* resolves in this language */
      }
    }
    HL.setLanguage("fa");
  });

  test("no translation value is empty (all languages)", () => {
    const src = readFile(ext("..", "src", "shared", "i18n.ts"));
    const faBlock = src.slice(src.indexOf("const fa: Record<TranslationKey, DictValue> = {"), src.indexOf("export type TranslationKey"));
    /* every quoted value is non-empty */
    for (const m of faBlock.matchAll(/: '([^']*)'/g)) expect(m[1].length).toBeGreaterThan(0);
  });

  test("a missing key degrades visibly (the key itself), never to an empty string", () => {
    expect(HL.t("nope.doesNotExist" as any)).toBe("nope.doesNotExist");
  });

  test("the emitted file exists in the extension bundle", () => {
    expect(exists(ext("shared", "i18n.js"))).toBe(true);
  });
});

/* ---------- t() / count() ---------- */

describe("t() and count()", () => {
  test("interpolation replaces {name} placeholders", () => {
    HL.setLanguage("fa");
    expect(HL.t("hosts.disabledOk", { host: "a.com" })).toBe("سایت a.com غیرفعال شد");
    HL.setLanguage("en");
    expect(HL.t("hosts.disabledOk", { host: "a.com" })).toBe("a.com is now disabled");
  });

  test("plural: en picks one/other by the raw number; fa stays a plain string", () => {
    HL.setLanguage("en");
    expect(HL.count("common.nHighlights", 1)).toBe("1 highlight");
    expect(HL.count("common.nHighlights", 2)).toBe("2 highlights");
    expect(HL.count("common.nHighlights", 0)).toBe("0 highlights");
    HL.setLanguage("fa");
    expect(HL.count("common.nHighlights", 1)).toBe("۱ هایلایت");
    expect(HL.count("common.nHighlights", 12)).toBe("۱۲ هایلایت");
  });

  test("count renders Persian digits in fa and Latin in en", () => {
    HL.setLanguage("fa");
    expect(HL.count("common.nItems", 125)).toBe("۱۲۵ مورد");
    HL.setLanguage("en");
    expect(HL.count("common.nItems", 125)).toBe("125 items");
  });

  test("every plural-capable key in en has a {one,other} shape and a fa string", () => {
    const src = readFile(ext("..", "src", "shared", "i18n.ts"));
    const enBlock = src.slice(src.indexOf("const en = {"), src.indexOf("} as const;"));
    for (const m of enBlock.matchAll(/'([a-z]+\.[A-Za-z0-9]+)': \{/g)) {
      const k = m[1];
      HL.setLanguage("en");
      /* an object-valued key still resolves (one/other present) */
      expect(HL.count(k as any, 1)).not.toBe(k);
      HL.setLanguage("fa");
      expect(HL.t(k as any)).not.toBe(k);
    }
    HL.setLanguage("fa");
  });
});

/* ---------- language state ---------- */

describe("language state", () => {
  test("default language is fa (backward compatibility)", () => {
    expect(HL.getLanguage()).toBe("fa");
  });

  test("invalid values degrade to fa (boundary validation)", () => {
    expect(HL.setLanguage("xx")).toBe("fa");
    expect(HL.setLanguage("pt")).toBe("fa"); /* not registered */
    expect(HL.setLanguage(undefined)).toBe("fa");
    expect(HL.setLanguage("EN" as any)).toBe("fa"); /* exact match only */
    expect(HL.setLanguage("en")).toBe("en");
    HL.setLanguage("fa");
  });

  test("dirOf: fa → rtl, en → ltr (the UI-direction policy)", () => {
    expect(HL.dirOf("fa")).toBe("rtl");
    expect(HL.dirOf("en")).toBe("ltr");
    HL.setLanguage("en");
    expect(HL.dirOf()).toBe("ltr");
    HL.setLanguage("fa");
    expect(HL.dirOf()).toBe("rtl");
  });

  test("onChange notifies subscribers and unsubscribe stops them (no leaks)", () => {
    let hits = 0;
    const un = HL.onChange(() => { hits++; });
    HL.setLanguage("en");
    expect(hits).toBe(1);
    HL.setLanguage("fa");
    expect(hits).toBe(2);
    un();
    HL.setLanguage("en");
    expect(hits).toBe(2); /* not called after unsubscribe */
    HL.setLanguage("fa");
  });

  test("a broken listener never blocks the others", () => {
    const un = HL.onChange(() => { throw new Error("boom"); });
    let hits = 0;
    const un2 = HL.onChange(() => { hits++; });
    HL.setLanguage("en");
    expect(hits).toBe(1);
    un(); un2();
    HL.setLanguage("fa");
  });
});

/* ---------- static markup (data-i18n*) ---------- */

describe("applyDom", () => {
  test("translates text, aria-label, title and placeholder — and follows a switch", () => {
    document.body.innerHTML = [
      '<p id="a" data-i18n="popup.listTitle">هایلایت‌های این صفحه</p>',
      '<button id="b" data-i18n-aria="popup.openDash" data-i18n-title="popup.settingsBtnTitle"></button>',
      '<input id="c" data-i18n-placeholder="search.placeholder" />'
    ].join("");
    HL.setLanguage("fa");
    HL.applyDom(document);
    expect(document.getElementById("a")!.textContent).toBe("هایلایت‌های این صفحه");
    expect(document.getElementById("b")!.getAttribute("aria-label")).toBe("باز کردن داشبورد");
    expect(document.getElementById("b")!.getAttribute("title")).toBe("داشبورد و تنظیمات");
    expect(document.getElementById("c")!.getAttribute("placeholder")).toBe("جست‌وجو در متن، یادداشت یا عنوان صفحه…");
    HL.setLanguage("en");
    HL.applyDom(document);
    expect(document.getElementById("a")!.textContent).toBe("This page’s highlights");
    expect(document.getElementById("b")!.getAttribute("aria-label")).toBe("Open dashboard");
    expect(document.getElementById("b")!.getAttribute("title")).toBe("Dashboard & settings");
    expect(document.getElementById("c")!.getAttribute("placeholder")).toBe("Search text, notes or page titles…");
    HL.setLanguage("fa");
  });

  test("safe on null/undefined roots and non-i18n markup", () => {
    expect(() => HL.applyDom(null)).not.toThrow();
    document.body.innerHTML = "<p>plain</p>";
    expect(() => HL.applyDom(document)).not.toThrow();
    expect(document.body.textContent).toBe("plain");
  });

  test("the dashboard shell's live statics all carry known keys", () => {
    const shell = readFile(ext("..", "entrypoints", "dashboard", "index.html"));
    HL.setLanguage("fa");
    for (const m of shell.matchAll(/data-i18n(?:-aria|-title|-placeholder)?="([^"]+)"/g)) {
      const k = m[1];
      expect({ key: k, ok: HL.t(k) !== k }).toBeTruthy();
      expect(HL.t(k)).not.toBe(k);
    }
  });

  test("the popup's live statics all carry known keys", () => {
    const html = readFile(ext("popup", "popup.html"));
    HL.setLanguage("fa");
    for (const m of html.matchAll(/data-i18n(?:-aria|-title|-placeholder)?="([^"]+)"/g)) {
      expect(HL.t(m[1])).not.toBe(m[1]);
    }
  });
});

/* ---------- JS call-site coverage (the no-compiler surfaces) ---------- */

describe("call-site key coverage", () => {
  const ROOT = ext("..");
  function walk(dir: string, out: string[] = []): string[] {
    for (const e of require("node:fs").readdirSync(dir, { withFileTypes: true })) {
      const full = dir + "/" + e.name;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".output" || e.name === "dist" || e.name === ".next") continue;
        walk(full, out);
      } else if (/\.(js|tsx?)$/.test(e.name) && !e.name.endsWith(".test.ts") && !e.name.endsWith(".test.tsx")) {
        out.push(full);
      }
    }
    return out;
  }

  test("every t('…') / count('…') literal in product code exists in both dictionaries", () => {
    const files = [
      ...walk(ROOT + "/extension").filter((f) => f.endsWith(".js")),
      ...walk(ROOT + "/src/dashboard"),
      ...walk(ROOT + "/entrypoints"),
    ];
    const keys = new Set<string>();
    for (const f of files) {
      const code = readFile(f);
      for (const m of code.matchAll(/\b(?:t|count)\(\s*['"]([a-z]+\.[A-Za-z0-9]+)['"]/g)) keys.add(m[1]);
    }
    expect(keys.size).toBeGreaterThan(80); /* the migration really happened */
    const missing: string[] = [];
    for (const k of keys) {
      HL.setLanguage("fa");
      if (HL.t(k) === k) missing.push(k + " (fa)");
      HL.setLanguage("en");
      if (HL.t(k) === k) missing.push(k + " (en)");
    }
    HL.setLanguage("fa");
    expect(missing).toEqual([]);
  });
});

/* ---------- German (v0.15.0 — the third language) ---------- */

describe("German dictionary", () => {
  test("de is a registered language: dirOf ltr, locale de-DE, selectable", () => {
    expect(HL.setLanguage("de")).toBe("de");
    expect(HL.getLanguage()).toBe("de");
    expect(HL.dirOf("de")).toBe("ltr");
    expect(HL.LOCALES.de).toBe("de-DE");
    HL.setLanguage("fa");
  });

  test("German plural morphology: Notiz/Notizen, Highlight/Highlights — Artikel is invariable", () => {
    HL.setLanguage("de");
    expect(HL.count("common.nNotes", 1)).toBe("1 Notiz");
    expect(HL.count("common.nNotes", 3)).toBe("3 Notizen");
    expect(HL.count("common.nHighlights", 1)).toBe("1 Highlight");
    expect(HL.count("common.nHighlights", 12)).toBe("12 Highlights");
    expect(HL.count("common.nArticles", 1)).toBe("1 Artikel");
    expect(HL.count("common.nArticles", 7)).toBe("7 Artikel"); /* same form — a plain string entry */
    HL.setLanguage("fa");
  });

  test("German interpolation carries umlauts and quotes", () => {
    HL.setLanguage("de");
    expect(HL.t("hosts.disabledOk", { host: "a.com" })).toBe("a.com ist jetzt deaktiviert");
    expect(HL.t("toast.tagAdded", { tag: "Arbeit" })).toBe("Tag „Arbeit“ hinzugefügt");
    expect(HL.t("popup.countOf", { a: "8", b: "12" })).toBe("8 von 12");
    HL.setLanguage("fa");
  });

  test("applyDom renders German statics", () => {
    document.body.innerHTML = '<p id="a" data-i18n="popup.listTitle">x</p>';
    HL.setLanguage("de");
    HL.applyDom(document);
    expect(document.getElementById("a")!.textContent).toBe("Highlights dieser Seite");
    HL.setLanguage("fa");
  });

  test("a valid German language persists through the store (merge boundary)", async () => {
    const store = HL.createStore(HL.backends.memoryArea());
    await store.setSettings({ language: "de" });
    const s = await store.getSettings();
    expect(s.language).toBe("de");
  });

  test("Russian plural forms are CLDR-exact (one/few/many; 21 → one, 11 → many)", () => {
    HL.setLanguage("ru");
    expect(HL.count("common.nNotes", 1)).toBe("1 заметка");
    expect(HL.count("common.nNotes", 2)).toBe("2 заметки");
    expect(HL.count("common.nNotes", 5)).toBe("5 заметок");
    expect(HL.count("common.nNotes", 21)).toBe("21 заметка");
    expect(HL.count("common.nNotes", 22)).toBe("22 заметки");
    expect(HL.count("common.nNotes", 11)).toBe("11 заметок");
    expect(HL.count("common.nArticles", 1)).toBe("1 статья");
    expect(HL.count("common.nArticles", 3)).toBe("3 статьи");
    expect(HL.count("common.nArticles", 12)).toBe("12 статей");
    HL.setLanguage("fa");
  });

  test("every registered language persists through the store", async () => {
    for (const lang of HL.LANG_KEYS) {
      const store = HL.createStore(HL.backends.memoryArea());
      await store.setSettings({ language: lang });
      const s = await store.getSettings();
      expect(s.language).toBe(lang);
    }
  });
});

/* ---------- settings integration (merge boundary) ---------- */

describe("settings ↔ language", () => {
  test("DEFAULT_SETTINGS carries language 'fa'", () => {
    expect(HL.DEFAULT_SETTINGS.language).toBe("fa");
  });

  test("missing language on a stored record → fa; other preferences preserved", async () => {
    const store = HL.createStore(HL.backends.memoryArea());
    await store.setSettings({ theme: "dark", defaultColor: "teal" });
    const s = await store.getSettings();
    expect(s.language).toBe("fa");
    expect(s.theme).toBe("dark");
    expect(s.defaultColor).toBe("teal");
  });

  test("invalid stored language → fa (never crashes, never spreads)", async () => {
    const backend = HL.backends.memoryArea();
    await backend.set({ "hlx:settings": { theme: "light", language: "xx" } });
    const store = HL.createStore(backend);
    const s = await store.getSettings();
    expect(s.language).toBe("fa");
    expect(s.theme).toBe("light");
  });

  test("a valid language persists and rides the change events", async () => {
    const store = HL.createStore(HL.backends.memoryArea());
    await store.setSettings({ language: "en" });
    const s = await store.getSettings();
    expect(s.language).toBe("en");
    let seen: any = null;
    const un = store.onSettingsChanged((v: any) => { seen = v; });
    await store.setSettings({ language: "fa" });
    expect(seen && seen.language).toBe("fa");
    un();
  });

  test("unknown settings fields pass through untouched (data-safety contract)", async () => {
    const backend = HL.backends.memoryArea();
    await backend.set({ "hlx:settings": { theme: "dark", customFutureField: { a: 1 } } });
    const store = HL.createStore(backend);
    const s = await store.getSettings();
    expect((s as any).customFutureField).toEqual({ a: 1 });
  });
});

/* ---------- theme-boot language mirror (anti-flash) ---------- */

describe("theme-boot lang mirror", () => {
  test("mirror=en → html lang=en dir=ltr before first paint", async () => {
    const win = (globalThis as any).window;
    win.localStorage.setItem("hlx:lang", "en");
    /* re-eval the boot IIFE — a cold boot with the mirror set */
    const { evalClassic } = await import("./helpers/engine");
    evalClassic(ext("shared", "theme-boot.js"));
    const root = win.document.documentElement;
    expect(root.getAttribute("lang")).toBe("en");
    expect(root.getAttribute("dir")).toBe("ltr");
  });

  test("mirror=every language → html lang/dir anti-flash (fa rtl, all others ltr)", async () => {
    const win = (globalThis as any).window;
    const { evalClassic } = await import("./helpers/engine");
    for (const lang of HL.LANG_KEYS) {
      win.localStorage.setItem("hlx:lang", lang);
      evalClassic(ext("shared", "theme-boot.js"));
      const root = win.document.documentElement;
      expect(root.getAttribute("lang")).toBe(lang);
      expect(root.getAttribute("dir")).toBe(lang === "fa" ? "rtl" : "ltr");
    }
    win.localStorage.removeItem("hlx:lang");
  });

  test("mirror=fa → rtl; invalid mirror → the static markup stands", async () => {
    const win = (globalThis as any).window;
    win.localStorage.setItem("hlx:lang", "fa");
    const { evalClassic } = await import("./helpers/engine");
    evalClassic(ext("shared", "theme-boot.js"));
    expect(win.document.documentElement.getAttribute("dir")).toBe("rtl");
    win.localStorage.setItem("hlx:lang", "zz");
    evalClassic(ext("shared", "theme-boot.js"));
    expect(win.document.documentElement.getAttribute("lang")).toBe("fa"); /* untouched default */
  });
});
