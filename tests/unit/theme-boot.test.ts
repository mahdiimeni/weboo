/**
 * theme-boot tests — anti-flash read side + shared HL.applyThemeNow (v1.2.9)
 *
 * The file is a <head> classic script: eval'ing it must apply the mirrored
 * theme immediately (anti-flash) and expose the single apply-now
 * implementation used by popup.js and dashboard.js (was duplicated verbatim
 * in both before v1.2.9). domkit is loaded first — the same order the real
 * pages guarantee (theme-boot in <head>, core at the end of <body>).
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, evalClassic, ext } from "./helpers/engine";

let HL: any;
let win: any;

/* the real page order: constants → domkit → theme-await boot (eval = script tag) */
async function bootThemeBoot() {
  win = setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/domkit.js"] });
  evalClassic(ext("shared", "theme-boot.js"));
  return HL;
}

beforeEach(async () => {
  await bootThemeBoot();
});

describe("anti-flash (read side)", () => {
  test("mirror=dark → data-theme روی html قبل از رندر", () => {
    win.localStorage.setItem("hlx:theme", "dark");
    /* re-eval the boot IIFE only — simulates a cold boot with the mirror set
       (a fresh setupDom would wipe localStorage, so the window is kept) */
    evalClassic(ext("shared", "theme-boot.js"));
    expect(win.document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(win.document.documentElement.style.colorScheme).toBe("dark");
  });

  test("mirror نامعتبر → نادیده گرفته می‌شود (auto)", () => {
    win.localStorage.setItem("hlx:theme", "blue");
    evalClassic(ext("shared", "theme-boot.js"));
    expect(win.document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});

describe("HL.applyThemeNow (write side — shared)", () => {
  test("light → اعمال + نوشتن آینه", () => {
    expect(HL.applyThemeNow("light")).toBe("light");
    expect(win.document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(win.localStorage.getItem("hlx:theme")).toBe("light");
  });

  test("auto → اعمال + پاک‌کردن آینه", () => {
    HL.applyThemeNow("dark");
    expect(HL.applyThemeNow("auto")).toBe("auto");
    expect(win.document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(win.localStorage.getItem("hlx:theme")).toBeNull();
  });

  test("مقدار نامعتبر → auto (اعتبارسنجی در مرز UI — الگوی domkit)", () => {
    expect(HL.applyThemeNow("blue")).toBe("auto");
    expect(HL.applyThemeNow(null)).toBe("auto");
  });

  test("بدون HL.domkit (هسته لود نشده) → no-op امن و null", async () => {
    win = setupDom();
    await loadEngine({ files: [] });
    evalClassic(ext("shared", "theme-boot.js"));
    /* the classic script created the namespace itself — read it back from globalThis */
    HL = (globalThis as any).HL;
    expect(HL.applyThemeNow("dark")).toBeNull();
    expect(win.document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
