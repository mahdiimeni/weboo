/**
 * Dictionary registration + on-demand loading (audit R1 — payload diet).
 *
 * The i18n split: i18n.js ships only the canonical (en) dictionary; the
 * other eleven languages are DATA modules registered via registerDictionary
 * — statically through i18n/all.js on the pages and the SW, on demand in
 * the content bundle through the injected loader (ensureLanguage). These
 * tests pin the runtime contract of that seam on fresh en-only worlds
 * (loadEngine { dicts: "none" } — no other test loads dictionaries this way).
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;

beforeEach(async () => {
  setupDom();
  /* the lazy-path world: i18n logic + en only — exactly the content bundle's shape */
  HL = await loadEngine({ files: ["shared/constants.js", "shared/i18n.js"], dicts: "none" });
  HL.setLanguage("fa"); /* the default Persian UI — nothing Persian registered yet */
});

describe("registerDictionary / getDictionary", () => {
  test("en resolves immediately; unregistered fa degrades to the canonical dictionary", () => {
    expect(HL.t("app.name")).toBe("Weboo"); /* en fallback — never an empty UI */
    expect(HL.getDictionary("fa")).toBeNull();
    expect(HL.getDictionary("en")).not.toBeNull();
  });

  test("registering fa makes t() Persian", () => {
    const dict = { "app.name": "وبو", "common.cancel": "انصراف" };
    expect(HL.registerDictionary("fa", dict)).toBe(true);
    expect(HL.getDictionary("fa")).toBe(dict);
    expect(HL.t("app.name")).toBe("وبو");
    /* a key the partial dict lacks still resolves — the en fallback stands */
    expect(HL.t("common.close")).toBe("Close");
  });

  test("unknown languages and garbage dictionaries are ignored (false, no registration)", () => {
    expect(HL.registerDictionary("zz", { "app.name": "x" })).toBe(false);
    expect(HL.registerDictionary("fa", null)).toBe(false);
    expect(HL.registerDictionary("fa", "not-an-object")).toBe(false);
    expect(HL.getDictionary("fa")).toBeNull();
    /* getDictionary folds garbage through validLanguage → 'en' (registered) —
       harmless: parseMessage guarantees only real LANG_KEYS reach the SW path */
    expect(HL.getDictionary("zz")).toBe(HL.getDictionary("en"));
  });
});

describe("ensureLanguage (the injected loader)", () => {
  test("no loader wired → resolves immediately, en fallback stands", async () => {
    await expect(HL.ensureLanguage("de")).resolves.toBe("de");
    expect(HL.getDictionary("de")).toBeNull();
    expect(HL.t("common.cancel")).toBe("Cancel");
  });

  test("with a loader: fetches once, registers, t() speaks the language", async () => {
    let calls = 0;
    HL.setDictionaryLoader(function (lang: string) {
      calls++;
      return lang === "de"
        ? { "app.name": "Weboo", "common.cancel": "Abbrechen" }
        : null;
    });
    await expect(HL.ensureLanguage("de")).resolves.toBe("de");
    await expect(HL.ensureLanguage("de")).resolves.toBe("de"); /* second call — served from the registry */
    expect(calls).toBe(1); /* in-flight/registered memoization */
    expect(HL.getDictionary("de")).not.toBeNull();
    HL.setLanguage("de"); /* t() speaks the ACTIVE language — the fetch made it available */
    expect(HL.t("common.cancel")).toBe("Abbrechen");
    HL.setLanguage("fa");
  });

  test("en never hits the loader (it ships with the logic module)", async () => {
    let calls = 0;
    HL.setDictionaryLoader(function () { calls++; return null; });
    await expect(HL.ensureLanguage("en")).resolves.toBe("en");
    expect(calls).toBe(0);
    expect(HL.getDictionary("en")).not.toBeNull();
  });

  test("loader failure/garbage → resolves anyway, en fallback stands (never rejects)", async () => {
    HL.setDictionaryLoader(function () { throw new Error("sw asleep"); });
    await expect(HL.ensureLanguage("fr")).resolves.toBe("fr");
    expect(HL.getDictionary("fr")).toBeNull();
    expect(HL.t("common.cancel")).toBe("Cancel");
    /* a junk payload (not an object) is ignored the same way */
    HL.setDictionaryLoader(function () { return 42; });
    await expect(HL.ensureLanguage("it")).resolves.toBe("it");
    expect(HL.getDictionary("it")).toBeNull();
  });

  test("a concurrent ensure of the same language shares one in-flight fetch", async () => {
    let calls = 0;
    HL.setDictionaryLoader(function () {
      calls++;
      return new Promise(function (resolve) { setTimeout(function () { resolve({ "app.name": "وبو" }); }, 5); });
    });
    const [a, b] = await Promise.all([HL.ensureLanguage("fa"), HL.ensureLanguage("fa")]);
    expect(a).toBe("fa");
    expect(b).toBe("fa");
    expect(calls).toBe(1);
    expect(HL.t("app.name")).toBe("وبو");
  });
});
