/**
 * HL.detectDir tests — content display direction detection (shared core, v1.2.7)
 *
 * Since v1.2.7 the direction policy lives in shared/detect-dir.js so that the
 * dashboard (groupDir) and the popup (current-page card) consume one source —
 * here we test those functions' contract directly (dashboard behavior is
 * guarded via dashboard-data.test.ts and the popup via popup.test.ts).
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;

beforeAll(() => {
  setupDom();
  /* pure module — no dependencies, not even constants */
  HL = loadEngine({ files: ["shared/detect-dir.js"] });
});

describe("detectTextDir", () => {
  test("فارسی/عربی → rtl؛ انگلیسی/لاتین‌گسترده/سیریلیک → ltr؛ عبری → rtl", () => {
    expect(HL.detectDir.detectTextDir("دانشنامه‌ی فارسی")).toBe("rtl");
    expect(HL.detectDir.detectTextDir("السلام علیکم")).toBe("rtl");
    expect(HL.detectDir.detectTextDir("Understanding logical properties")).toBe("ltr");
    expect(HL.detectDir.detectTextDir("Éléments de style — naïve café")).toBe("ltr");
    expect(HL.detectDir.detectTextDir("Привет мир")).toBe("ltr");
    expect(HL.detectDir.detectTextDir("שלום עולם")).toBe("rtl");
  });

  test("خنثی: رقم/علائم/خالی/null/undefined → رشته‌ی خالی", () => {
    expect(HL.detectDir.detectTextDir("")).toBe("");
    expect(HL.detectDir.detectTextDir("12345 !? - ()")).toBe("");
    expect(HL.detectDir.detectTextDir(null)).toBe("");
    expect(HL.detectDir.detectTextDir(undefined)).toBe("");
  });

  test("تساوی حروف جهت‌دار → بدون تصمیم (خنثی)", () => {
    expect(HL.detectDir.detectTextDir("علی Ali")).toBe(""); /* 3 RTL letters == 3 LTR letters */
  });

  test("facade داشبورد همان تابع هسته را نشان می‌دهد (LSP — منبع واحد v1.2.7)", () => {
    /* verified in dashboard-data.test.ts with a full load; here only the core
       itself: two calls with the same input yield the same output */
    expect(HL.detectDir.detectTextDir("RTL vs LTR detection")).toBe("ltr");
    expect(HL.detectDir.detectTextDir("تشخیص جهت")).toBe("rtl");
  });
});

describe("contentDir — سیاست ترکیب عنوان + متن‌ها", () => {
  test("موافقت کامل انگلیسی → ltr", () => {
    expect(HL.detectDir.contentDir("CSS logical properties guide", [
      "Inline start and inline end are direction aware.",
      "The dir attribute sets base direction for bidi text.",
    ])).toBe("ltr");
  });

  test("موافقت کامل فارسی → rtl", () => {
    expect(HL.detectDir.contentDir("آموزش خواندن عمیق", [
      "خواندن عمیق یعنی گفت‌وگو با متن",
    ])).toBe("rtl");
  });

  test("تعارض هر دو سو → rtl محافظه‌کار", () => {
    /* Persian title + English code highlight */
    expect(HL.detectDir.contentDir("آموزش کار با React و Vue", [
      "useState is a Hook that lets you add state to function components.",
    ])).toBe("rtl");
    /* English title + Persian quote */
    expect(HL.detectDir.contentDir("The Little Prince — English Edition", [
      "این متن فقط یک نقل‌قول طولانی فارسی است که در مقاله‌ی انگلیسی آمده.",
    ])).toBe("rtl");
  });

  test("عنوان خنثی (تساوی) → سیگنال بدنه تصمیم می‌گیرد", () => {
    expect(HL.detectDir.contentDir("آموزش React", [
      "All English body with useState hooks and components.",
    ])).toBe("ltr");
  });

  test("بدون هایلایت (صفحه‌ی تازه) → تنها سیگنال عنوان", () => {
    expect(HL.detectDir.contentDir("MDN Web Docs — Using logical properties", [])).toBe("ltr");
    expect(HL.detectDir.contentDir("دانشنامه‌ی فارسی", [])).toBe("rtl");
    expect(HL.detectDir.contentDir("دانشنامه‌ی فارسی")).toBe("rtl"); /* texts is optional */
  });

  test("عنوان خالی + بدنه انگلیسی → ltr؛ کاملاً خنثی → rtl پیش‌فرض", () => {
    expect(HL.detectDir.contentDir("", ["All highlights are in English here."])).toBe("ltr");
    expect(HL.detectDir.contentDir("123", ["...", "456"])).toBe("rtl");
    expect(HL.detectDir.contentDir(null, null)).toBe("rtl");
  });

  test("ورودی‌های غیررشته‌ای (رکورد ناقص) → نادیده گرفته می‌شوند، نه خطا", () => {
    expect(HL.detectDir.contentDir("English title", [null, undefined, 42 as any, "English text"])).toBe("ltr");
  });

  test("سقف متن: فقط ۴۰۰۰ کاراکتر نخستِ بدنه سیگنال می‌دهد (کارایی)", () => {
    /* huge English body — accumulating items stops at the cap */
    const big = "English words keep flowing here ".repeat(500);
    expect(HL.detectDir.contentDir("Some English title", [big])).toBe("ltr");
  });

  test("هم‌ارزی با رفتار dashboard-data (groupRecords.dir) — همان سیاست، همان نتیجه", () => {
    /* mirrors the same dashboard test scenarios (v1.2.6) on the shared core */
    expect(HL.detectDir.contentDir("Understanding CSS logical properties", ["The direction of a card should follow its content language."])).toBe("ltr");
    expect(HL.detectDir.contentDir("آموزش خواندن عمیق", ["خواندن عمیق یعنی گفت‌وگو با متن"])).toBe("rtl");
    expect(HL.detectDir.contentDir("آموزش کار با React و Vue", ["useState is a Hook that lets you add state to function components."])).toBe("rtl");
    expect(HL.detectDir.contentDir("آموزش React", ["All English body with useState hooks and components."])).toBe("ltr");
  });
});
