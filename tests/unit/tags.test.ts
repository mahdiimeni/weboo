/**
 * HL.tags tests — article-tag domain rules (shared/tags.js, v1.2.15)
 *
 * Pure domain module: sanitize/case-fold/ZWNJ rules, list hygiene, map
 * validation, toggle purity, chip inventory ordering and the union filter
 * semantics. This is the single source consumed by the storage layer and
 * the dashboard — its contract must stay green for both.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;

beforeAll(async () => {
  setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/tags.js"] });
});

describe("ثابت‌های دامنه‌ی برچسب", () => {
  test("TAG_MAX_LEN و TAG_MAX_PER_ARTICLE اعداد مثبت منطقی هستند", () => {
    expect(Number.isInteger(HL.TAG_MAX_LEN)).toBe(true);
    expect(HL.TAG_MAX_LEN).toBeGreaterThanOrEqual(8);
    expect(Number.isInteger(HL.TAG_MAX_PER_ARTICLE)).toBe(true);
    expect(HL.TAG_MAX_PER_ARTICLE).toBeGreaterThanOrEqual(3);
    expect(HL.TAG_MAX_PER_ARTICLE).toBeLessThanOrEqual(20);
  });
});

describe("sanitizeTag", () => {
  test("فاصله‌های اضافی جمع و trim می‌شود", () => {
    expect(HL.tags.sanitizeTag("  پژوهش   علمی  ")).toBe("پژوهش علمی");
    expect(HL.tags.sanitizeTag("\t AI \n")).toBe("AI");
  });

  test("نیم‌فاصله (ZWNJ) حفظ می‌شود — جزءِ واژه است", () => {
    expect(HL.tags.sanitizeTag("برنامه‌نویسی")).toBe("برنامه‌نویسی");
    expect(HL.tags.sanitizeTag("برنامه‌نویسی")).toContain("\u200c");
  });

  test("ورودی‌های نامعتبر → null", () => {
    expect(HL.tags.sanitizeTag("")).toBeNull();
    expect(HL.tags.sanitizeTag("   ")).toBeNull();
    expect(HL.tags.sanitizeTag(null)).toBeNull();
    expect(HL.tags.sanitizeTag(undefined)).toBeNull();
    expect(HL.tags.sanitizeTag(0)).toBeNull();
    expect(HL.tags.sanitizeTag({})).toBeNull();
  });

  test("سقف طول: دقیقاً TAG_MAX_LEN مجاز، یکی بیشتر رد", () => {
    const ok = "a".repeat(HL.TAG_MAX_LEN);
    const bad = "a".repeat(HL.TAG_MAX_LEN + 1);
    expect(HL.tags.sanitizeTag(ok)).toBe(ok);
    expect(HL.tags.sanitizeTag(bad)).toBeNull();
  });

  test("عدد/متن مخلوط فارسی-انگلیسی پذیرفته می‌شود", () => {
    expect(HL.tags.sanitizeTag("Web 3")).toBe("Web 3");
    expect(HL.tags.sanitizeTag("فناوری AI")).toBe("فناوری AI");
  });
});

describe("sanitizeTagList", () => {
  test("ورودی غیرآرایه → آرایه‌ی خالی", () => {
    expect(HL.tags.sanitizeTagList(null)).toEqual([]);
    expect(HL.tags.sanitizeTagList(undefined)).toEqual([]);
    expect(HL.tags.sanitizeTagList("پژوهش")).toEqual([]);
    expect(HL.tags.sanitizeTagList({})).toEqual([]);
  });

  test("اعضای نامعتبر حذف می‌شوند", () => {
    expect(HL.tags.sanitizeTagList(["", "  ", "معتبر", null, "x".repeat(HL.TAG_MAX_LEN + 1)])).toEqual(["معتبر"]);
  });

  test("حذف تکراری بدون حساسیت به بزرگی حروف (اولین املای برنده)", () => {
    expect(HL.tags.sanitizeTagList(["News", "news", "NEWS"])).toEqual(["News"]);
    expect(HL.tags.sanitizeTagList(["اخبار", "اخبار"])).toEqual(["اخبار"]);
  });

  test("سقف تعداد برچسب در هر مقاله رعایت می‌شود", () => {
    const many = Array.from({ length: HL.TAG_MAX_PER_ARTICLE + 5 }, (_, i) => "tag" + i);
    const out = HL.tags.sanitizeTagList(many);
    expect(out.length).toBe(HL.TAG_MAX_PER_ARTICLE);
    expect(out[0]).toBe("tag0");
    expect(out[out.length - 1]).toBe("tag" + (HL.TAG_MAX_PER_ARTICLE - 1));
  });

  test("ترتیب ورود حفظ می‌شود", () => {
    expect(HL.tags.sanitizeTagList(["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });
});

describe("normalizeTagMap", () => {
  test("ورودی‌های ساختاری نامعتبر → {}", () => {
    expect(HL.tags.normalizeTagMap(null)).toEqual({});
    expect(HL.tags.normalizeTagMap(undefined)).toEqual({});
    expect(HL.tags.normalizeTagMap([])).toEqual({});
    expect(HL.tags.normalizeTagMap("x")).toEqual({});
  });

  test("مقدارهای غیرآرایه‌ای و آرایه‌های خالی و کلیدهای خالی حذف می‌شوند", () => {
    const out = HL.tags.normalizeTagMap({
      "https://a.com/1": ["ok"],
      "https://a.com/2": "not-array",
      "https://a.com/3": [],
      "": ["orphan"],
    });
    expect(out).toEqual({ "https://a.com/1": ["ok"] });
  });

  test("مقدارها مثل هر لیست دیگری پاک‌سازی می‌شوند", () => {
    const out = HL.tags.normalizeTagMap({
      "https://a.com/1": ["  پژوهش ", "", "پژوهش", "x".repeat(HL.TAG_MAX_LEN + 1)],
    });
    expect(out).toEqual({ "https://a.com/1": ["پژوهش"] });
  });
});

describe("hasTag / toggleTag", () => {
  test("hasTag — تطبیق بدون حساسیت به بزرگی حروف", () => {
    expect(HL.tags.hasTag(["News", "اخبار"], "news")).toBe(true);
    expect(HL.tags.hasTag(["News"], "NEWS")).toBe(true);
    expect(HL.tags.hasTag(["اخبار"], "آزمایش")).toBe(false);
    expect(HL.tags.hasTag([], "x")).toBe(false);
    expect(HL.tags.hasTag(["x"], null)).toBe(false);
    expect(HL.tags.hasTag(null, "x")).toBe(false);
  });

  test("toggleTag — افزودن خالص (آرایه‌ی جدید)", () => {
    const cur = ["a"];
    const out = HL.tags.toggleTag(cur, "b");
    expect(out).toEqual(["a", "b"]);
    expect(cur).toEqual(["a"]); /* ورودی دست‌نخورده */
  });

  test("toggleTag — حذف خالص با همان املا یا املای دیگر", () => {
    expect(HL.tags.toggleTag(["a", "b"], "a")).toEqual(["b"]);
    expect(HL.tags.toggleTag(["News"], "news")).toEqual([]);
    expect(HL.tags.toggleTag(["اخبار"], "اخبار")).toEqual([]);
  });

  test("toggleTag — ورودی غیرآرایه → رفتار معقول", () => {
    expect(HL.tags.toggleTag(null, "x")).toEqual(["x"]);
    expect(HL.tags.toggleTag(undefined, "x")).toEqual(["x"]);
  });
});

describe("tagCounts", () => {
  test("شمارش بین مقالات + مرتب‌سازی نزولی بر حسب تعداد", () => {
    const map = {
      u1: ["اخبار", "پژوهش"],
      u2: ["اخبار"],
      u3: ["اخبار", "آزمایش"],
    };
    const out = HL.tags.tagCounts(map);
    expect(out.length).toBe(3);
    expect(out[0]).toEqual({ tag: "اخبار", count: 3 });
    /* دو تای باقی‌مانده: آزمایش و پژوهش هرکدام ۱ — ترتیب fa localeCompare */
    expect(out[1].count).toBe(1);
    expect(out[2].count).toBe(1);
    expect([out[1].tag, out[2].tag]).toEqual(["آزمایش", "پژوهش"]);
  });

  test("ادغام املاهای مختلف با حروف کوچک/بزرگ (اولین املای برنده)", () => {
    const out = HL.tags.tagCounts({ u1: ["News"], u2: ["news"] });
    expect(out).toEqual([{ tag: "News", count: 2 }]);
  });

  test("نقشه‌ی خالی/نامعتبر → لیست خالی", () => {
    expect(HL.tags.tagCounts({})).toEqual([]);
    expect(HL.tags.tagCounts(null)).toEqual([]);
    expect(HL.tags.tagCounts({ u1: [] })).toEqual([]);
  });
});

describe("hasActiveTag — معنای اجتماع (union)", () => {
  const S = (arr: string[]) => new Set(arr);

  test("بدون انتخاب فعالی → false (فیلتر خاموش)", () => {
    expect(HL.tags.hasActiveTag(["اخبار"], S([]))).toBe(false);
    expect(HL.tags.hasActiveTag(["اخبار"], null)).toBe(false);
  });

  test("یکی از برچسب‌های فعال روی مقاله باشد → true", () => {
    expect(HL.tags.hasActiveTag(["اخبار", "پژوهش"], S(["پژوهش"]))).toBe(true);
    expect(HL.tags.hasActiveTag(["اخبار"], S(["پژوهش", "اخبار"]))).toBe(true);
  });

  test("هیچ‌کدام نباشد → false (مقاله‌ی بدون برچسب یا برچسب دیگر)", () => {
    expect(HL.tags.hasActiveTag(["آزمایش"], S(["پژوهش"]))).toBe(false);
    expect(HL.tags.hasActiveTag([], S(["پژوهش"]))).toBe(false);
    expect(HL.tags.hasActiveTag(null, S(["پژوهش"]))).toBe(false);
  });

  test("تطبیق املای chip در برابر املای ذخیره‌شده (حروف کوچک/بزرگ)", () => {
    expect(HL.tags.hasActiveTag(["news"], S(["News"]))).toBe(true);
    expect(HL.tags.hasActiveTag(["News"], S(["news"]))).toBe(true);
  });
});
