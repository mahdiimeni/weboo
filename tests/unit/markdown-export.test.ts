/**
 * HL.markdown tests — the Markdown library document builder (v0.6.0)
 * Pure builder: groups in → string out. Order-agnostic (renders the given
 * order), library-scope (no DOM/storage), Obsidian-first shape.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;

beforeEach(async () => {
  setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/format.js", "shared/markdown-export.js"] });
});

const T0 = Date.UTC(2024, 9, 27, 12); /* 2024-10-27 (calendar-stable) */

function rec(id: string, over: any = {}) {
  return {
    id,
    host: "fa.example.com",
    url: "https://fa.example.com/p1",
    urlNorm: "https://fa.example.com/p1",
    title: "مقاله اول",
    text: "متن هایلایت " + id,
    note: "",
    color: "yellow",
    createdAt: T0,
    updatedAt: T0,
    start: 5,
    ...over,
  };
}

function group(key: string, items: any[], over: any = {}) {
  return {
    key,
    host: "fa.example.com",
    title: "مقاله «" + key + "»",
    url: key,
    items,
    notes: items.filter((r) => r.note).length,
    latest: Math.max(...items.map((r) => r.updatedAt || 0), 0),
    earliest: Math.min(...items.map((r) => r.createdAt || Infinity)),
    dir: "rtl",
    tags: [],
    ...over,
  };
}

describe("HL.markdown — قرارداد", () => {
  test("ISP: فقط buildLibraryMarkdown", () => {
    expect(Object.keys(HL.markdown)).toEqual(["buildLibraryMarkdown"]);
  });

  test("خروجی همیشه با newline تمام می‌شود و رشته است", () => {
    const out = HL.markdown.buildLibraryMarkdown({ groups: [], exportedAt: T0 });
    expect(typeof out).toBe("string");
    expect(out.endsWith("\n")).toBe(true);
  });
});

describe("HL.markdown — ساختار سند", () => {
  test("frontmatter: app/version/exported_at/شمارنده‌ها", () => {
    const gs = [group("https://a.example.com/1", [rec("a1"), rec("a2", { note: "n" })]), group("https://b.example.com/2", [rec("b1")])];
    const out = HL.markdown.buildLibraryMarkdown({ groups: gs, exportedAt: T0 });
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain('app: "وبو"');
    expect(out).toContain('version: "' + HL.VERSION + '"');
    expect(out).toContain('exported_at: "2024-10-27"');
    expect(out).toContain("highlights: 3");
    expect(out).toContain("articles: 2");
    expect(out.indexOf("---\n")).toBe(0); /* opening fence at byte 0 */
    expect(out).toMatch(/\n---\n/); /* closing fence too */
  });

  test("exportedAt=0 → بدون exported_at و بدون تاریخ در خلاصه", () => {
    const gs = [group("https://a.example.com/1", [rec("a1")])];
    const out = HL.markdown.buildLibraryMarkdown({ groups: gs, exportedAt: 0 });
    expect(out).not.toContain("exported_at");
    expect(out).toContain("> خروجی از «وبو» — ۱ هایلایت از ۱ مقاله\n");
  });

  test("عنوان H1 + خط خلاصه با ارقام فارسی", () => {
    const gs = [group("https://a.example.com/1", [rec("a1"), rec("a2"), rec("a3")])];
    const out = HL.markdown.buildLibraryMarkdown({ groups: gs, exportedAt: T0 });
    expect(out).toContain("# کتابچه هایلایت‌های من");
    expect(out).toContain("۳ هایلایت از ۱ مقاله");
  });
});

describe("HL.markdown — بخش مقاله", () => {
  test("## عنوان هر مقاله به ترتیب آرایه + جداکننده‌ی امن بین بخش‌ها", () => {
    const g1 = group("https://a.example.com/1", [rec("a1")]);
    const g2 = group("https://b.example.com/2", [rec("b1")]);
    const out = HL.markdown.buildLibraryMarkdown({ groups: [g1, g2], exportedAt: T0 });
    const i1 = out.indexOf("## مقاله «https://a.example.com/1»");
    const i2 = out.indexOf("## مقاله «https://b.example.com/2»");
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    /* هر «---» با خط خالی احاطه شده — هرگز setext-heading یا چسبیدن بلوک‌ها */
    out.split("\n").forEach((line: string, i: number, arr: string[]) => {
      if (line === "---" && i > 6) { /* بعد از frontmatter */
        expect(arr[i - 1]).toBe("");
        expect(arr[i + 1]).toBe("");
      }
    });
  });

  test("لینک منبع فقط برای http(s)/file — javascript: هرگز لینک نمی‌شود", () => {
    const good = group("https://good.example.com/x", [rec("a1")]);
    const bad = group("javascript:alert(1)", [rec("b1")]);
    const out = HL.markdown.buildLibraryMarkdown({ groups: [good, bad], exportedAt: T0 });
    expect(out).toContain("[منبع](https://good.example.com/x)");
    expect(out).not.toContain("(javascript:");
    expect(out).not.toContain("](javascript");
  });

  test("خط شمارنده: یادداشت فقط وقتی هست؛ برچسب‌ها با inline code", () => {
    const g = group("https://a.example.com/1", [rec("a1"), rec("a2", { note: "یادداشت تست" })], { tags: ["دانشنامه", "مطالعه"] });
    const out = HL.markdown.buildLibraryMarkdown({ groups: [g], exportedAt: T0 });
    expect(out).toContain("۲ هایلایت · ۱ یادداشت");
    expect(out).toContain("برچسب‌ها: `دانشنامه` · `مطالعه`");
  });

  test("بدون برچسب → بدون خط برچسب؛ بدون یادداشت → بدون ذکر یادداشت", () => {
    const g = group("https://a.example.com/1", [rec("a1")]);
    const out = HL.markdown.buildLibraryMarkdown({ groups: [g], exportedAt: T0 });
    expect(out).toContain("۱ هایلایت\n");
    expect(out).not.toContain("برچسب‌ها:");
  });
});

describe("HL.markdown — بلوک هایلایت", () => {
  test("نقل‌قول blockquote + یادداشت پررنگ + خط متا («— تاریخ · رنگ»)", () => {
    const g = group("https://a.example.com/1", [rec("a1", { note: "نکته مهم", color: "green" })]);
    const out = HL.markdown.buildLibraryMarkdown({ groups: [g], exportedAt: T0 });
    expect(out).toContain("> متن هایلایت a1");
    expect(out).toContain("**یادداشت:** نکته مهم");
    expect(out).toMatch(/— .+ · سبز/); /* تاریخ فارسی از Intl + برچسب رنگ ثبت‌شده */
  });

  test("رنگ ناشناخته → بدون برچسب رنگ (داده‌ی ساختگی ساخته نمی‌شود)", () => {
    const g = group("https://a.example.com/1", [rec("a1", { color: "chartreuse" })]);
    const out = HL.markdown.buildLibraryMarkdown({ groups: [g], exportedAt: T0 });
    expect(out).toMatch(/— [^\n]+/);
    expect(out).not.toContain("· chartreuse");
  });

  test("ترتیب داده‌شده حفظ می‌شود (builder نسبت به ترتیب agnostic)", () => {
    const items = [rec("x1", { start: 30 }), rec("x2", { start: 10 }), rec("x3", { start: 20 })];
    const g = group("https://a.example.com/1", items);
    const out = HL.markdown.buildLibraryMarkdown({ groups: [g], exportedAt: T0 });
    const i1 = out.indexOf("x1");
    const i2 = out.indexOf("x2");
    const i3 = out.indexOf("x3");
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
  });

  test("یادداشت چندخطی به یک خط جمع می‌شود (ساختار بلوک سالم می‌ماند)", () => {
    const g = group("https://a.example.com/1", [rec("a1", { note: "خط اول\n\nخط دوم\nخط سوم" })]);
    const out = HL.markdown.buildLibraryMarkdown({ groups: [g], exportedAt: T0 });
    expect(out).toContain("**یادداشت:** خط اول خط دوم خط سوم");
  });
});

describe("HL.markdown — حالت‌های مرزی", () => {
  test("کتابخانه‌ی خالی: سند معتبر با پیام", () => {
    const out = HL.markdown.buildLibraryMarkdown({ groups: [], exportedAt: T0 });
    expect(out).toContain("# کتابچه هایلایت‌های من");
    expect(out).toContain("> هنوز هایلایتی ثبت نشده است.");
    expect(out).toContain("highlights: 0");
  });

  test("خلوص: ورودی هرگز جهش نمی‌کند", () => {
    const items = [rec("a1", { note: "n" })];
    const g = group("https://a.example.com/1", items, { tags: ["t1"] });
    const snap = JSON.stringify([g]);
    HL.markdown.buildLibraryMarkdown({ groups: [g], exportedAt: T0 });
    expect(JSON.stringify([g])).toBe(snap);
  });

  test("ctx گمشده → سند خالی معتبر (بدون خطا)", () => {
    const out = HL.markdown.buildLibraryMarkdown(undefined as any);
    expect(out).toContain("articles: 0");
  });
});
