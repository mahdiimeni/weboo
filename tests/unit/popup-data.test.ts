/**
 * popup-data tests — pure policy of the popup data layer (HL.pop, v1.2.9)
 *
 * popup-data.js is DOM-free and storage-free policy (the SRP/MVC split the
 * dashboard already has): supported sites, theme validation, page summary
 * counts, the shared smart-direction decision, list slicing/labels and the
 * disabledHosts math. Loaded with exactly its real script-order dependencies:
 * constants + format + detect-dir — nothing else.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, evalClassic, ext } from "./helpers/engine";

let HL: any;

beforeEach(() => {
  setupDom();
  HL = loadEngine({ files: ["shared/constants.js", "shared/format.js", "shared/detect-dir.js"] });
  evalClassic(ext("popup", "popup-data.js"));
});

describe("پاپ‌آپ — لایه‌ی داده (HL.pop)", () => {
  describe("isSupportedSite", () => {
    test("https و http و file پشتیبانی می‌شوند", () => {
      expect(HL.pop.isSupportedSite({ site: "https://example.com/a" })).toBe(true);
      expect(HL.pop.isSupportedSite({ site: "http://example.com/a" })).toBe(true);
      expect(HL.pop.isSupportedSite({ site: "file:///C:/docs/page.html" })).toBe(true);
    });

    test("chrome:// و about:blank پشتیبانی نمی‌شوند", () => {
      expect(HL.pop.isSupportedSite({ site: "chrome://extensions" })).toBe(false);
      expect(HL.pop.isSupportedSite({ site: "about:blank" })).toBe(false);
    });
  });

  describe("validTheme", () => {
    test("کلید معتبر بی‌تغییر می‌ماند", () => {
      expect(HL.pop.validTheme({ theme: "dark" })).toBe("dark");
      expect(HL.pop.validTheme({ theme: "light" })).toBe("light");
      expect(HL.pop.validTheme({ theme: "auto" })).toBe("auto");
    });

    test("کلید نامعتبر → auto (اعتبارسنجی در مرز UI)", () => {
      expect(HL.pop.validTheme({ theme: "blue" })).toBe("auto");
    });

    test("تنظیمات غایب یا بدون theme → auto", () => {
      expect(HL.pop.validTheme(null)).toBe("auto");
      expect(HL.pop.validTheme({})).toBe("auto");
    });
  });

  describe("summarize", () => {
    test("کل و شمار یادداشت‌ها (۳ رکورد، ۱ یادداشت)", () => {
      const m = new Map<string, any>([
        ["a", { text: "one", note: "" }],
        ["b", { text: "two", note: "با یادداشت" }],
        ["c", { text: "three" }],
      ]);
      const s = HL.pop.summarize(m);
      expect(s.total).toBe(3);
      expect(s.notes).toBe(1);
    });

    test("نقشه‌ی خالی → صفر و صفر", () => {
      const s = HL.pop.summarize(new Map());
      expect(s.total).toBe(0);
      expect(s.notes).toBe(0);
    });
  });

  describe("directionOf", () => {
    test("عنوان انگلیسی + متن‌های انگلیسی → ltr", () => {
      const m = new Map<string, any>([
        ["m1", { text: "Logical properties, like inline-start and block-end, flow relative to the writing mode." }],
        ["m2", { text: "The dir attribute sets the base direction for bidi text." }],
      ]);
      expect(HL.pop.directionOf("Using logical properties and logical values - CSS | MDN", m)).toBe("ltr");
    });

    test("عنوان فارسی + متن‌های فارسی → rtl", () => {
      const m = new Map<string, any>([
        ["w1", { text: "مغز ما هنگام خواندن وارد گفت‌وگو با نویسنده می‌شود" }],
      ]);
      expect(HL.pop.directionOf("دانشنامه‌ی فارسی — ویکی‌پدیا", m)).toBe("rtl");
    });

    test("تعارض: عنوان فارسی + هایلایت کد انگلیسی → rtl (سیاست محافظه‌کار مشترک)", () => {
      const m = new Map<string, any>([
        ["c1", { text: "useState is a Hook that lets you add state to function components." }],
      ]);
      expect(HL.pop.directionOf("دانشنامه‌ی فارسی — ویکی‌پدیا", m)).toBe("rtl");
    });

    test("صفحه‌ی تازه بدون هایلایت → تنها سیگنال عنوان تصمیم می‌گیرد", () => {
      expect(HL.pop.directionOf("English title only", new Map())).toBe("ltr");
      expect(HL.pop.directionOf("عنوان فارسی", new Map())).toBe("rtl");
    });
  });

  describe("visibleItems", () => {
    test("جدیدترین اول — updatedAt و در نبودش createdAt", () => {
      const m = new Map<string, any>([
        ["a", { id: "a", createdAt: 100 }],
        ["b", { id: "b", createdAt: 500 }], /* no updatedAt → createdAt decides */
        ["c", { id: "c", createdAt: 50, updatedAt: 900 }],
      ]);
      expect(HL.pop.visibleItems(m, 8).map((r: any) => r.id)).toEqual(["c", "b", "a"]);
    });

    test("بیشتر از سقف بریده می‌شود (سرِ لیست = جدیدترین)", () => {
      const entries: [string, any][] = [];
      for (let i = 0; i < 10; i++) entries.push([String(i), { id: String(i), createdAt: i }]);
      const items = HL.pop.visibleItems(new Map(entries), 8);
      expect(items.length).toBe(8);
      expect(items[0].id).toBe("9");
      expect(items[7].id).toBe("2");
    });
  });

  describe("countLabel", () => {
    test("بریده‌شده → «X از Y»", () => {
      const l = HL.pop.countLabel(2, 5);
      expect(l).toContain("از");
      expect(l).toBe("۲ از ۵");
    });

    test("کامل → «N مورد»", () => {
      expect(HL.pop.countLabel(5, 5)).toBe("۵ مورد");
      expect(HL.pop.countLabel(0, 0)).toBe("۰ مورد");
    });
  });

  describe("nextDisabledHosts", () => {
    test("فعال‌کردن → میزبان از فهرست حذف می‌شود", () => {
      expect(HL.pop.nextDisabledHosts(["a.com", "b.com"], "a.com", true)).toEqual(["b.com"]);
    });

    test("غیرفعال‌کردن → میزبان به فهرست اضافه می‌شود", () => {
      expect(HL.pop.nextDisabledHosts(["a.com"], "b.com", false)).toEqual(["a.com", "b.com"]);
    });

    test("غیرفعال‌سازی دوباره → بدون تکرار", () => {
      expect(HL.pop.nextDisabledHosts(["a.com"], "a.com", false)).toEqual(["a.com"]);
    });

    test("فعال‌کردن وقتی در فهرست نیست → همان فهرست (بدون تغییر)", () => {
      expect(HL.pop.nextDisabledHosts(["b.com"], "a.com", true)).toEqual(["b.com"]);
    });

    test("آرایه‌ی ورودی هرگز تغییر نمی‌کند (تابع خالص)", () => {
      const input = ["a.com"];
      HL.pop.nextDisabledHosts(input, "b.com", false);
      expect(input).toEqual(["a.com"]);
    });
  });
});
