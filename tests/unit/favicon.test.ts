/**
 * Tests for content/favicon.js — the site favicon capture module
 * (pickIconHref: pure icon selection; captureSiteFavicon: injected-store flow)
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupDom, loadEngine, evalClassic, ext } from "./helpers/engine";

let HL: any;
let win: any;
let fetchCalls: number;
let origFetch: any;

beforeEach(async () => {
  win = setupDom({ html: "" });
  /* favicon.js is an ES module since 7b-3 — load it through the engine (export-only world => sync strip path), not evalClassic */
  HL = await loadEngine({ files: ["shared/constants.js"], extraFiles: [ext("content", "favicon.js")] });
  fetchCalls = 0;
  origFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = () => { fetchCalls++; throw new Error("fetch must not run in unit tests"); };
});

afterEach(() => {
  (globalThis as any).fetch = origFetch;
});

const LOC = { href: "https://example.test/docs/page.html" };

describe("pickIconHref — انتخاب بهترین آیکون از linkهای صفحه", () => {
  test("بزرگ‌ترین مساحت sizes برنده می‌شود", () => {
    win.document.body.innerHTML =
      '<link rel="icon" href="/small.png" sizes="16x16">' +
      '<link rel="icon" href="/big.png" sizes="48x48">';
    expect(HL.favicon.pickIconHref(win.document, LOC.href)).toBe("https://example.test/big.png");
  });

  test("sizes=any یا آیکون svg مساحت 1024 می‌گیرند", () => {
    win.document.body.innerHTML =
      '<link rel="icon" href="/p.png" sizes="16x16">' +
      '<link rel="icon" href="/any.ico" sizes="any">' +
      '<link rel="icon" href="/s.svg" type="image/svg+xml">';
    expect(HL.favicon.pickIconHref(win.document, LOC.href)).toBe("https://example.test/any.ico");
    win.document.body.innerHTML =
      '<link rel="icon" href="/p.png" sizes="16x16">' +
      '<link rel="icon" href="/s.svg" type="image/svg+xml">';
    expect(HL.favicon.pickIconHref(win.document, LOC.href)).toBe("https://example.test/s.svg");
  });

  test("بدون link → /favicon.ico ریشه‌ای به‌صورت مطلق", () => {
    win.document.body.innerHTML = "<p>صفحه‌ای بدون آیکون</p>";
    expect(HL.favicon.pickIconHref(win.document, LOC.href)).toBe("https://example.test/favicon.ico");
  });

  test("href نسبی نسبت به base حل می‌شود", () => {
    win.document.body.innerHTML = '<link rel="icon" href="assets/icon.png" sizes="32x32">';
    expect(HL.favicon.pickIconHref(win.document, LOC.href)).toBe("https://example.test/docs/assets/icon.png");
  });

  test("پروتکل غیر http(s) → null", () => {
    win.document.body.innerHTML =
      '<link rel="icon" href="javascript:alert(1)" sizes="32x32">' +
      '<link rel="icon" href="data:image/png;base64,xx" sizes="32x32">';
    expect(HL.favicon.pickIconHref(win.document, LOC.href)).toBeNull();
  });

  test("base نامعتبر → null", () => {
    win.document.body.innerHTML = '<link rel="icon" href="/i.png" sizes="32x32">';
    expect(HL.favicon.pickIconHref(win.document, "not-a-valid-base")).toBeNull();
    expect(HL.favicon.pickIconHref(win.document, "")).toBeNull();
  });
});

describe("captureSiteFavicon — میان‌برها و خرابی‌های بلعیده‌شده", () => {
  const capturedStore = {
    getFavicon: async () => ({ icon: "data:image/png;base64,x", capturedAt: 1 }),
    setFavicon: async () => {},
  };
  const emptyStore = {
    getFavicon: async () => null,
    setFavicon: async () => {},
  };

  test("قبلاً ذخیره شده → true بدون هیچ fetch", async () => {
    win.document.body.innerHTML = '<link rel="icon" href="/i.png" sizes="32x32">';
    const ok = await HL.favicon.captureSiteFavicon(capturedStore, "example.test", win.document, LOC);
    expect(ok).toBe(true);
    expect(fetchCalls).toBe(0);
  });

  test("بدون host یا بدون store → false", async () => {
    win.document.body.innerHTML = '<link rel="icon" href="/i.png" sizes="32x32">';
    expect(await HL.favicon.captureSiteFavicon(capturedStore, "", win.document, LOC)).toBe(false);
    expect(await HL.favicon.captureSiteFavicon(null, "example.test", win.document, LOC)).toBe(false);
    expect(fetchCalls).toBe(0);
  });

  test("آیکونی پیدا نمی‌شود → false بدون fetch", async () => {
    win.document.body.innerHTML = "<p>بدون آیکون</p>";
    expect(await HL.favicon.captureSiteFavicon(emptyStore, "example.test", win.document, { href: "" })).toBe(false);
    expect(fetchCalls).toBe(0);
  });

  test("خرابی fetch → false (هرگز reject نمی‌شود)", async () => {
    win.document.body.innerHTML = '<link rel="icon" href="/i.png" sizes="32x32">';
    expect(await HL.favicon.captureSiteFavicon(emptyStore, "example.test", win.document, LOC)).toBe(false);
    expect(fetchCalls).toBe(1); /* attempted once, then swallowed */
  });

  test("MAX_BYTES همان سقف 96KB نسخه‌ی قبلی است", () => {
    expect(HL.favicon.MAX_BYTES).toBe(96 * 1024);
  });
});
