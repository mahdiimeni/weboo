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

describe("HL.booklet — فهرست تعاملی (Task 88)", () => {
  const three = () => [
    group("https://a.example.com/1", [rec("a1")]),
    group("https://b.example.com/2", [rec("b1"), rec("b2")]),
    group("https://c.example.com/3", [rec("c1")], { title: "<b>شرور</b>" }),
  ];

  test("هر ورودی فهرست یک لنگر داخلی است: href=«#art-N» ↔ id=«art-N» از ۱", () => {
    const out = doc({ groups: three(), exportedAt: T0 });
    const hrefs = out.match(/class="toc-row" href="#art-(\d+)"/g) || [];
    expect(hrefs.length).toBe(3);
    [1, 2, 3].forEach((n) => {
      expect(out).toContain(`<a class="toc-row" href="#art-${n}">`);
      expect(out).toContain(`<section class="article" id="art-${n}"`);
    });
  });

  test("فهرست قبل از مقاله‌ها می‌آید و هر لنگر قبل از مقصد خودش است", () => {
    const out = doc({ groups: three(), exportedAt: T0 });
    [1, 2, 3].forEach((n) => {
      const link = out.indexOf(`href="#art-${n}"`);
      const target = out.indexOf(`id="art-${n}"`);
      expect(link).toBeGreaterThan(-1);
      expect(target).toBeGreaterThan(link);
    });
    /* و ترتیب مقصدها همان ترتیب آرایه‌ی groups است */
    expect(out.indexOf('id="art-1"')).toBeLessThan(out.indexOf('id="art-2"'));
    expect(out.indexOf('id="art-2"')).toBeLessThan(out.indexOf('id="art-3"'));
  });

  test("لنگرها فقط از عدد ساخته می‌شوند (بدون محتوای کاربر) و عنوان فهرست escape می‌شود", () => {
    const out = doc({ groups: three(), exportedAt: T0 });
    /* هیچ href فهرستی چیزی جز رقم ندارد — عنوان هرگز وارد لنگر نمی‌شود */
    expect(out.match(/href="#art-[^"]*"/g)?.every((h: string) => /^href="#art-\d+"$/.test(h))).toBe(true);
    expect(out).toContain("&lt;b&gt;شرور&lt;/b&gt;"); /* عنوان escape شده در فهرست */
  });

  test("شناسه‌های مقاله یکتا هستند؛ یک مقاله → بدون فهرست (گارد سرِ جایش)", () => {
    const out = doc({ groups: three(), exportedAt: T0 });
    const ids = out.match(/id="art-\d+"/g) || [];
    expect(new Set(ids).size).toBe(3);
    const one = doc({ groups: [group("https://a.example.com/1", [rec("a1")])], exportedAt: T0 });
    /* گارد فقط فهرست را حذف می‌کند — خود شناسه‌ی مقاله بی‌ضرر می‌ماند */
    expect(one).not.toContain('class="toc-row"');
    expect(one).not.toContain('href="#art-');
  });

  test("استایل لنگر: بدون زیرخط/رنگ لینک مرورگر + هاور روی عنوان", () => {
    const out = doc({ groups: three(), exportedAt: T0 });
    expect(out).toContain(".toc-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 0;\n  color: inherit; text-decoration: none; }");
    expect(out).toContain(".toc-row:hover .toc-t { color: var(--accent); }");
  });
});

describe("HL.booklet — جهت‌دهی هوشمند", () => {
  test("dir بخش مقاله از g.dir می‌آید؛ نبودن → rtl محافظه‌کارانه", () => {
    const fa = group("https://a.example.com/1", [rec("a1")]);
    const en = group("https://b.example.com/2", [rec("b1")], { dir: "ltr", title: "English Title" });
    const none = group("https://c.example.com/3", [rec("c1")]);
    delete (none as any).dir;
    const out = doc({ groups: [fa, en, none], exportedAt: T0 });
    expect(out).toContain('<section class="article" id="art-1" dir="rtl"');
    expect(out).toContain('<section class="article" id="art-2" dir="ltr"');
    /* فقط دو dir در مقاله‌ها + dir های ثابت chrome — هیچ مقاله‌ای بدون dir نمی‌ماند */
    expect(out.match(/<section class="article" id="art-\d+" dir="(rtl|ltr)"/g)?.length).toBe(3);
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

describe("HL.booklet — فونت (Task 88)", () => {
  test("بدون ctx.font: بدون کلاس فونت، پشته‌ی پیش‌فرض دقیقاً همان پیش از رجیستری", () => {
    const out = doc({ groups: [], exportedAt: T0 });
    expect(out).toContain('<body class="mode-color">'); /* بدون کلاس font-* */
    expect(out).toContain(
      'body { font-family: var(--bk-font, "Vazirmatn", "Segoe UI", Tahoma, "Helvetica Neue", system-ui, sans-serif);'
    );
  });

  test("هر فونت رجیستری: کلاس بدنه font-<id> + قانون --bk-font خودش؛ پیش‌فرض بدون کلاس", () => {
    const g = [group("https://a.example.com/1", [rec("a1")])];
    Object.keys(HL.BOOKLET_FONTS).forEach((id: string) => {
      const out = doc({ groups: g, font: id, exportedAt: T0 });
      if (id === "vazir") {
        /* پیش‌فرض همان var-fallback است — کلاس فقط تکرار همان مقدار می‌بود */
        expect(out.match(/<body[^>]*>/)?.[0]).toBe('<body class="mode-color">');
      } else {
        expect(out).toContain(`<body class="mode-color font-${id}">`);
        expect(out).toContain(`body.font-${id} { --bk-font: ${HL.BOOKLET_FONTS[id].stack}; }`);
      }
    });
  });

  test("فونت با حالت bw ترکیب می‌شود (دو کلاس مستقل)", () => {
    const out = doc({ groups: [], mode: "bw", font: "tahoma", exportedAt: T0 });
    expect(out).toContain('<body class="mode-bw font-tahoma">');
  });

  test("شناسه‌ی ناشناخته → پیش‌فرض محافظه‌کارانه (بدون کلاس فونت)", () => {
    const out = doc({ groups: [], font: "comic-sans", exportedAt: T0 });
    expect(out).toContain('<body class="mode-color">');
    expect(out).not.toContain("font-comic-sans");
  });

  test("CSS فونت‌ها از رجیستری تولید می‌شود (OCP: ورودی جدید = قانون جدید)", () => {
    const out = doc({ groups: [], exportedAt: T0 });
    Object.keys(HL.BOOKLET_FONTS).forEach((id: string) => {
      expect(out).toContain(`body.font-${id} { --bk-font: `);
    });
    expect(out).toContain("/* FONTS — one class per BOOKLET_FONTS entry");
  });

  test("خلوص با فونت: ورودی و رجیستری هرگز جهش نمی‌کنند", () => {
    const registrySnap = JSON.stringify(HL.BOOKLET_FONTS);
    const g = group("https://a.example.com/1", [rec("a1")]);
    const ctx = { groups: [g], font: "segoe", exportedAt: T0 };
    const snap = JSON.stringify(ctx);
    doc(ctx);
    doc({ ...ctx, font: "system" });
    expect(JSON.stringify(ctx)).toBe(snap);
    expect(JSON.stringify(HL.BOOKLET_FONTS)).toBe(registrySnap);
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
