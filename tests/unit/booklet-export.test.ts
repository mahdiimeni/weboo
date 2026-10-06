/**
 * HL.booklet tests — the print booklet builder (v0.6.0)
 * Pure builder: groups → one self-contained HTML document (cover + one
 * section per article + print CSS). Direction contracts, XSS escaping,
 * color/bw palettes, URL safety, reading-order preservation.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;

beforeEach(async () => {
  setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/format.js", "shared/booklet-export.js"] });
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

const doc = (ctx: any) => HL.booklet.buildBookletHtml(ctx);

describe("HL.booklet — قرارداد", () => {
  test("ISP: فقط buildBookletHtml", () => {
    expect(Object.keys(HL.booklet)).toEqual(["buildBookletHtml"]);
  });

  test("سند کامل معتبر: DOCTYPE / html fa rtl / charset / style / پایان html", () => {
    const out = doc({ groups: [group("https://a.example.com/1", [rec("a1")])], exportedAt: T0 });
    expect(out.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(out).toContain('<html lang="fa" dir="rtl">');
    expect(out).toContain('<meta charset="utf-8">');
    expect(out).toContain("<style>");
    expect(out.trimEnd().endsWith("</html>")).toBe(true);
  });

  test("mode پیش‌فرض color؛ فقط 'bw' سیاه‌وسفید می‌کند", () => {
    const g = [group("https://a.example.com/1", [rec("a1")])];
    expect(doc({ groups: g, exportedAt: T0 })).toContain('<body class="mode-color">');
    expect(doc({ groups: g, mode: "bw", exportedAt: T0 })).toContain('<body class="mode-bw">');
    expect(doc({ groups: g, mode: "rainbow", exportedAt: T0 })).toContain('<body class="mode-color">');
  });
});

describe("HL.booklet — قرارداد چاپ (CSS)", () => {
  test("A4، صفحه‌ی جدا برای هر مقاله، بلوک‌های نشکن، رنگ‌های چاپی", () => {
    const out = doc({ groups: [group("https://a.example.com/1", [rec("a1")])], exportedAt: T0 });
    expect(out).toContain("@page { size: A4;");
    expect(out).toContain("break-before: page;");
    expect(out).toContain("break-inside: avoid;");
    expect(out).toContain("-webkit-print-color-adjust: exact;");
    expect(out).toContain("print-color-adjust: exact;");
    expect(out).toContain("orphans: 2; widows: 2;");
  });

  test("هر دو پالت با کلاس بدنه + متغیرهای CSS (OCP)", () => {
    const out = doc({ groups: [], exportedAt: T0 });
    expect(out).toContain("body.mode-color {");
    expect(out).toContain("body.mode-bw {");
    expect(out).toContain("break-after: avoid;"); /* سربرگ مقاله از اولین هایلایت جدا نمی‌شود */
  });

  test("بدون اسکریپت و بدون منبع خارجی — سند همه‌جا یکی چاپ می‌شود", () => {
    const out = doc({ groups: [group("https://a.example.com/1", [rec("a1")])], exportedAt: T0 });
    expect(out).not.toContain("<script");
    expect(out).not.toMatch(/src="http|href="http.*\.css/);
  });
});

describe("HL.booklet — جلد", () => {
  test("عنوان، آمار فارسی، نام برنامه، نسخه و تاریخ", () => {
    const g = group("https://a.example.com/1", [rec("a1"), rec("a2", { note: "n" })]);
    const out = doc({ groups: [g], exportedAt: T0 });
    expect(out).toContain("کتابچه هایلایت‌ها");
    expect(out).toContain("۲ هایلایت · ۱ مقاله · ۱ یادداشت");
    expect(out).toContain("وب هایلایتر");
    expect(out).toContain("نسخه " + HL.VERSION); /* رشته‌ی خام — ارقام فارسی‌سازی NaN نمی‌شود */
    expect(out).toContain('class="cover-date"');
  });

  test("فهرست فقط از ۲ مقاله به بالا (گارد over-application)", () => {
    const one = doc({ groups: [group("https://a.example.com/1", [rec("a1")])], exportedAt: T0 });
    expect(one).not.toContain("فهرست مقالات");
    const two = doc({
      groups: [group("https://a.example.com/1", [rec("a1")]), group("https://b.example.com/2", [rec("b1"), rec("b2")])],
      exportedAt: T0,
    });
    expect(two).toContain("فهرست مقالات");
    expect(two).toContain("toc-row");
    expect(two).toContain("۲ هایلایت"); /* شمارش مقاله‌ی دوم در فهرست */
  });

  test("exportedAt=0 → بدون تاریخ جلد، بدون سند خراب", () => {
    const out = doc({ groups: [group("https://a.example.com/1", [rec("a1")])], exportedAt: 0 });
    expect(out).not.toContain('class="cover-date"');
    expect(out).toContain("</html>");
  });
});

describe("HL.booklet — جهت‌دهی هوشمند", () => {
  test("dir بخش مقاله از g.dir می‌آید؛ نبودن → rtl محافظه‌کارانه", () => {
    const fa = group("https://a.example.com/1", [rec("a1")]);
    const en = group("https://b.example.com/2", [rec("b1")], { dir: "ltr", title: "English Title" });
    const none = group("https://c.example.com/3", [rec("c1")]);
    delete (none as any).dir;
    const out = doc({ groups: [fa, en, none], exportedAt: T0 });
    expect(out).toContain('<section class="article" dir="rtl"');
    expect(out).toContain('<section class="article" dir="ltr"');
    /* فقط دو dir در مقاله‌ها + dir های ثابت chrome — هیچ مقاله‌ای بدون dir نمی‌ماند */
    expect(out.match(/<section class="article" dir="(rtl|ltr)"/g)?.length).toBe(3);
  });

  test("هر نقل‌قول و یادداشت dir=auto خودش را دارد؛ خط متا و chrome همیشه rtl", () => {
    const g = group("https://a.example.com/1", [rec("a1", { note: "نکته", text: "Logical properties flow relative to writing mode" })], { dir: "ltr" });
    const out = doc({ groups: [g], exportedAt: T0 });
    expect(out).toContain('<blockquote class="hl-quote" dir="auto"');
    expect(out).toContain('<div class="hl-note" dir="auto"');
    expect(out).toContain('<p class="hl-meta" dir="rtl">');
    expect(out).toContain('<p class="art-meta" dir="rtl">');
  });
});

describe("HL.booklet — XSS و امنیت URL", () => {
  test("متن/یادداشت/عنوان HTML-escape می‌شوند", () => {
    const g = group("https://a.example.com/1", [
      rec("a1", {
        title: undefined as any,
        text: '<img src=x onerror="alert(1)">',
        note: '"><script>alert(2)</script>',
      }),
    ], { title: "<b>T</b>" });
    const out = doc({ groups: [g], exportedAt: T0 });
    expect(out).not.toContain("<img src=x");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;img src=x");
    expect(out).toContain("&lt;b&gt;T&lt;/b&gt;");
  });

  test("javascript: URL هرگز لینک زنده نمی‌شود؛ https لینک می‌شود", () => {
    const bad = group("javascript:alert(1)", [rec("b1")]);
    const good = group("https://good.example.com/x", [rec("g1")]);
    const out = doc({ groups: [bad, good], exportedAt: T0 });
    expect(out).not.toContain('href="javascript:');
    expect(out).toContain('<a class="art-link" href="https://good.example.com/x"');
  });
});

describe("HL.booklet — پالت رنگی", () => {
  test("حالت رنگی: bar و tint از رجیستری روی هر نقل‌قول", () => {
    const g = group("https://a.example.com/1", [rec("a1", { color: "green" })]);
    const out = doc({ groups: [g], mode: "color", exportedAt: T0 });
    expect(out).toContain("--bar:#58b85c");
    expect(out).toContain("rgba(88,184,92,0.1)"); /* hexToRgba(#58b85c, .1) */
  });

  test("حالت سیاه‌وسفید: هیچ استایل inline رنگی تزریق نمی‌شود", () => {
    const g = group("https://a.example.com/1", [rec("a1", { color: "green" }), rec("a2", { color: "purple" })]);
    const out = doc({ groups: [g], mode: "bw", exportedAt: T0 });
    expect(out).not.toContain("--bar:");
    expect(out).not.toContain("--hl-bg:");
    expect(out).toContain('class="hl-quote" dir="auto">'); /* بدون style */
  });

  test("متا در حالت رنگی «تاریخ · رنگ»، در سیاه‌وسفید فقط تاریخ", () => {
    const g = group("https://a.example.com/1", [rec("a1", { color: "yellow" })]);
    const color = doc({ groups: [g], mode: "color", exportedAt: T0 });
    const bw = doc({ groups: [g], mode: "bw", exportedAt: T0 });
    expect(color).toMatch(/<p class="hl-meta" dir="rtl">.+ · زرد<\/p>/);
    expect(bw).toMatch(/<p class="hl-meta" dir="rtl">[^<]+<\/p>/);
    expect(bw).not.toContain(" · زرد");
  });
});

describe("HL.booklet — محتوا و ترتیب", () => {
  test("برچسب‌ها به‌صورت chip؛ حداکثر ۸ برچسب", () => {
    const tags = ["یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
    const g = group("https://a.example.com/1", [rec("a1")], { tags });
    const out = doc({ groups: [g], exportedAt: T0 });
    expect((out.match(/<span class="tag">/g) || []).length).toBe(8);
    expect(out).not.toContain(">نه<");
  });

  test("ترتیب items داده‌شده عیناً حفظ می‌شود", () => {
    const items = [rec("x1", { start: 30 }), rec("x2", { start: 10 }), rec("x3", { start: 20 })];
    const g = group("https://a.example.com/1", items);
    const out = doc({ groups: [g], exportedAt: T0 });
    const i1 = out.indexOf("x1");
    const i2 = out.indexOf("x2");
    const i3 = out.indexOf("x3");
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
  });

  test("رکورد بدون متن و بدون یادداشت → هیچ بلوک .hl", () => {
    const g = group("https://a.example.com/1", [rec("empty", { text: "", note: "" })]);
    const out = doc({ groups: [g], exportedAt: T0 });
    expect(out).not.toContain('class="hl"');
  });

  test("یادداشت چندخطی جمع می‌شود به یک خط", () => {
    const g = group("https://a.example.com/1", [rec("a1", { note: "خط اول\nخط دوم" })]);
    const out = doc({ groups: [g], exportedAt: T0 });
    expect(out).toContain("خط اول خط دوم");
  });
});

describe("HL.booklet — حالت‌های مرزی", () => {
  test("کتابخانه‌ی خالی: سند معتبر + پیام", () => {
    const out = doc({ groups: [], exportedAt: T0 });
    expect(out).toContain("کتابچه هایلایت‌ها");
    expect(out).toContain("هنوز هایلایتی ثبت نشده است.");
    expect(out).toContain("</html>");
  });

  test("خلوص: ورودی هرگز جهش نمی‌کند", () => {
    const items = [rec("a1", { note: "n" })];
    const g = group("https://a.example.com/1", items, { tags: ["t1"] });
    const snap = JSON.stringify([g]);
    doc({ groups: [g], mode: "bw", exportedAt: T0 });
    doc({ groups: [g], mode: "color", exportedAt: T0 });
    expect(JSON.stringify([g])).toBe(snap);
  });

  test("ctx گمشده → سند خالی معتبر (بدون خطا)", () => {
    const out = doc(undefined as any);
    expect(out).toContain('<body class="mode-color">');
    expect(out).toContain("</html>");
  });
});
