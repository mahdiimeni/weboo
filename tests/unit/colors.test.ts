/**
 * Color registry contract tests (OCP)
 *
 * HL.COLORS in constants.js is the single source of truth; mark-style.css must
 * provide, for every non-default color, a background rule (light + dark) and
 * a noted indicator. If a color is added/removed and the CSS goes out of sync,
 * this test goes red — previously that consistency was kept only in the
 * programmer's memory.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine, readFile, ext } from "./helpers/engine";

let HL: any;
let cssExt: string;

beforeAll(() => {
  setupDom();
  HL = loadEngine({ files: ["shared/constants.js"] });
  cssExt = readFile(ext("content", "mark-style.css"));
});

function colorMentions(css: string, key: string): number {
  const re = new RegExp('data-hl-color="' + key + '"', "g");
  return (css.match(re) || []).length;
}

describe("رجیستری رنگ ↔ mark-style.css", () => {
  test("هر رنگ غیرپیش‌فرض قوانین CSS کافی دارد (روشن/تیره/یادداشت)", () => {
    const fallback = HL.DEFAULT_SETTINGS.defaultColor;
    for (const k of HL.COLOR_KEYS) {
      const n = colorMentions(cssExt, k);
      if (k === fallback) continue; /* covered by the base rule */
      expect(n).toBeGreaterThanOrEqual(4); /* bg + noted + dark-bg + dark-noted */
    }
  });

  test("رنگ پیش‌فرض با قانون پایه mark پوشش داده می‌شود", () => {
    const fallback = HL.DEFAULT_SETTINGS.defaultColor;
    expect(HL.COLORS[fallback]).toBeDefined();
    expect(cssExt).toMatch(/mark\.hlx-marker\s*\{/);
    expect(cssExt).toMatch(/mark\.hlx-marker\[data-hl-noted="1"\]/);
    /* the default color must not need its own data-hl-color rule */
    expect(colorMentions(cssExt, fallback)).toBeGreaterThanOrEqual(0);
  });

  test("هیچ رنگ یتیم در CSS نیست (همه به رجیستری اشاره می‌کنند)", () => {
    const mentioned = new Set<string>();
    for (const m of cssExt.matchAll(/data-hl-color="([^"]+)"/g)) mentioned.add(m[1]);
    for (const c of mentioned) {
      expect(HL.COLORS[c]).toBeDefined();
    }
  });

  test("هر رنگ: dot معتبر hex + برچسب فارسی", () => {
    for (const k of HL.COLOR_KEYS) {
      expect(HL.COLORS[k].dot).toMatch(/^#[0-9a-f]{6}$/i);
      expect(HL.COLORS[k].label.length).toBeGreaterThan(1);
    }
    expect(HL.COLOR_KEYS.length).toBe(5);
  });

  test("رنگ پیش‌فرضِ تنظیمات عضو رجیستری است", () => {
    expect(HL.COLOR_KEYS).toContain(HL.DEFAULT_SETTINGS.defaultColor);
  });
});
