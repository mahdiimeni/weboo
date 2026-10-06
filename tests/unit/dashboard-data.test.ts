/**
 * HL.dash tests — dashboard data layer (pure functions)
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine, ext } from "./helpers/engine";

let HL: any;

function rec(id: string, over: any = {}) {
  return {
    id,
    host: "example.com",
    site: "https://example.com",
    url: "https://example.com/p1",
    urlNorm: "https://example.com/p1",
    title: "مقاله اول",
    text: "متن هایلایت " + id,
    note: "",
    color: "yellow",
    createdAt: 100,
    updatedAt: 200,
    start: 5,
    ...over,
  };
}

beforeAll(async () => {
  setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/format.js", "shared/detect-dir.js", "shared/tags.js", "dashboard/dashboard-data.js"] });
  /* dashboard-data depends only on HL.COLORS/HL.tags and HL (no DOM) */
});

describe("فرمت‌ها", () => {
  test("faNum فارسی", () => {
    expect(HL.dash.faNum(0)).toBe("۰");
    expect(HL.dash.faNum(1234)).toContain("٬");
    expect(HL.dash.faNum(null)).toBe("۰");
  });

  test("fmtBytes", () => {
    expect(HL.dash.fmtBytes(500)).toContain("بایت");
    expect(HL.dash.fmtBytes(2048)).toContain("کیلوبایت");
    expect(HL.dash.fmtBytes(5 * 1048576)).toContain("مگابایت");
    expect(HL.dash.fmtBytes(null)).toContain("بایت");
  });

  test("dotColorOf", () => {
    expect(HL.dash.dotColorOf("green")).toBe("#58b85c");
    expect(HL.dash.dotColorOf("unknown")).toBe("#f5b800");
  });

  test("faviconLetter", () => {
    expect(HL.dash.faviconLetter("www.example.com")).toBe("E");
    expect(HL.dash.faviconLetter("")).toBe("و");
  });

  test("displayUrl", () => {
    expect(HL.dash.displayUrl("https://example.com/a?b=1")).toBe("example.com/a?b=1");
    expect(HL.dash.displayUrl("")).toBe("—");
  });

  test("displayHost — delegate هسته در facade داشبورد", () => {
    expect(HL.dash.displayHost("https://example.com/a?b=1")).toBe("example.com");
    expect(HL.dash.displayHost("https://www.example.com/a")).toBe("example.com");
    expect(HL.dash.displayHost("")).toBe("—");
  });
});

describe("sanitizeHost", () => {
  test("دامنه‌های معتبر", () => {
    expect(HL.dash.sanitizeHost("https://Example.com/path?q=1")).toBe("example.com");
    expect(HL.dash.sanitizeHost("  sub.domain.co  ")).toBe("sub.domain.co");
    expect(HL.dash.sanitizeHost("localhost")).toBe("localhost");
    expect(HL.dash.sanitizeHost("192.168.1.10")).toBe("192.168.1.10");
    expect(HL.dash.sanitizeHost("http://example.com:8080/x")).toBe("example.com");
  });

  test("دامنه‌های نامعتبر", () => {
    expect(HL.dash.sanitizeHost("")).toBeNull();
    expect(HL.dash.sanitizeHost("بدون نقطه")).toBeNull();
    expect(HL.dash.sanitizeHost("-bad.com")).toBeNull();
    expect(HL.dash.sanitizeHost(null)).toBeNull();
    /* existing behavior: spaces are removed before validation */
    expect(HL.dash.sanitizeHost("has space.com")).toBe("hasspace.com");
  });
});

describe("applyFilters", () => {
  const list = [
    rec("a", { text: "خواندن عمیق", note: "نکته", color: "green", title: "مقاله الف", host: "a.com", url: "https://a.com/1", urlNorm: "https://a.com/1" }),
    rec("b", { text: "یادداشت برداری", color: "pink", title: "مقاله ب" }),
    rec("c", { text: "خواندن سطحی", color: "green" }),
  ];
  const F = (q = "", colors: string[] = [], notesOnly = false) => ({ q, colors: new Set(colors), notesOnly });

  test("بدون فیلتر همه", () => {
    expect(HL.dash.applyFilters(list, F()).length).toBe(3);
  });

  test("جست‌وجو در متن/یادداشت/عنوان/دامنه/آدرس", () => {
    expect(HL.dash.applyFilters(list, F("خواندن")).length).toBe(2);
    expect(HL.dash.applyFilters(list, F("نکته")).length).toBe(1); /* note */
    expect(HL.dash.applyFilters(list, F("الف")).length).toBe(1); /* title */
    expect(HL.dash.applyFilters(list, F("a.com")).length).toBe(1); /* host */
    expect(HL.dash.applyFilters(list, F("بازدود")).length).toBe(0);
  });

  test("فیلتر رنگ ترکیبی", () => {
    expect(HL.dash.applyFilters(list, F("", ["green"])).length).toBe(2);
    expect(HL.dash.applyFilters(list, F("", ["green", "pink"])).length).toBe(3);
    expect(HL.dash.applyFilters(list, F("", ["teal"])).length).toBe(0);
  });

  test("فقط یادداشت‌دار + ترکیب با جست‌وجو", () => {
    expect(HL.dash.applyFilters(list, F("", [], true)).length).toBe(1);
    expect(HL.dash.applyFilters(list, F("خواندن", ["green"], true)).length).toBe(1);
    expect(HL.dash.applyFilters(list, F("برداری", [], true)).length).toBe(0);
  });
});

describe("applyFilters — بُعد برچسب مقاله (v1.2.15)", () => {
  /* دو مقاله: u1 با برچسب‌های «پژوهش، اخبار» و u2 فقط «آزمایش»؛ u3 بدون برچسب */
  const list = [
    rec("a", { urlNorm: "u1", url: "u1", text: "متن الف", title: "مقاله الف" }),
    rec("b", { urlNorm: "u1", url: "u1", text: "متن الف۲", title: "مقاله الف" }),
    rec("c", { urlNorm: "u2", url: "u2", text: "متن ب", title: "مقاله ب" }),
    rec("d", { urlNorm: "u3", url: "u3", text: "متن ج", title: "مقاله ج" }),
  ];
  const tagMap = { u1: ["پژوهش", "اخبار"], u2: ["آزمایش"] };
  const FT = (tags: string[]) => ({ q: "", colors: new Set(), notesOnly: false, tags: new Set(tags) });

  test("بدون برچسب انتخاب‌شده → همه می‌گذرند (حالت خاموش؛ سازگاری به عقب بدون tagMap)", () => {
    expect(HL.dash.applyFilters(list, FT([]), tagMap).length).toBe(4);
    /* فراخوان قدیمی: فیلتر بدون tags و بدون tagMap — رفتار قبلی دست‌نخورده */
    expect(HL.dash.applyFilters(list, { q: "", colors: new Set(), notesOnly: false }, undefined).length).toBe(4);
  });

  test("یک برچسب → فقط رکوردهای همان مقاله", () => {
    const out = HL.dash.applyFilters(list, FT(["پژوهش"]), tagMap);
    expect(out.length).toBe(2);
    expect(out.every((r: any) => r.urlNorm === "u1")).toBe(true);
  });

  test("اجتماع دو برچسب → هر دو مقاله (معنای رنگ‌چیپ‌ها)", () => {
    const out = HL.dash.applyFilters(list, FT(["پژوهش", "آزمایش"]), tagMap);
    expect(out.length).toBe(3);
    expect(new Set(out.map((r: any) => r.urlNorm))).toEqual(new Set(["u1", "u2"]));
  });

  test("مقاله‌ی بدون برچسب با فیلتر فعال حذف می‌شود؛ برچسب ناموجود → خالی", () => {
    expect(HL.dash.applyFilters(list, FT(["پژوهش"]), tagMap).some((r: any) => r.urlNorm === "u3")).toBe(false);
    expect(HL.dash.applyFilters(list, FT(["غایب"]), tagMap)).toEqual([]);
  });

  test("ترکیب برچسب + رنگ: تقاطع ابعاد مستقل", () => {
    const colored = [
      rec("a", { urlNorm: "u1", url: "u1", color: "green" }),
      rec("b", { urlNorm: "u1", url: "u1", color: "pink" }),
      rec("c", { urlNorm: "u2", url: "u2", color: "green" }),
    ];
    const out = HL.dash.applyFilters(colored, { q: "", colors: new Set(["green"]), notesOnly: false, tags: new Set(["پژوهش"]) }, tagMap);
    expect(out.length).toBe(1);
    expect(out[0].id).toBe("a");
  });
});

describe("articleKey — فرمول کلید مقاله (v1.2.15)", () => {
  test("اولویت: urlNorm سپس url سپس id", () => {
    expect(HL.dash.articleKey({ urlNorm: "n", url: "u", id: "i" })).toBe("n");
    expect(HL.dash.articleKey({ urlNorm: "", url: "u", id: "i" })).toBe("u");
    expect(HL.dash.articleKey({ urlNorm: "", url: "", id: "i" })).toBe("i");
  });

  test("همان فرمولی که groupRecords گروه‌بندی می‌کند", () => {
    const r = rec("z", { url: "u-z", urlNorm: "" });
    const groups = HL.dash.groupRecords([r], "newest");
    expect(groups[0].key).toBe(HL.dash.articleKey(r));
  });
});

describe("orphanTagKeys — جاروی برچسب بی‌مقاله (v1.2.15)", () => {
  test("نقشه‌ی خالی/تهی → خالی", () => {
    expect(HL.dash.orphanTagKeys({}, [])).toEqual([]);
    expect(HL.dash.orphanTagKeys(null, null)).toEqual([]);
    expect(HL.dash.orphanTagKeys(undefined, [rec("a")])).toEqual([]);
  });

  test("کلید بدون رکورد زنده → یتیم؛ رکورد با همان کلید → زنده", () => {
    const tagMap = { u1: ["a"], u2: ["b"], u3: ["c"] };
    const records = [
      rec("x", { urlNorm: "u1", url: "u1" }),
      rec("y", { urlNorm: "", url: "u2", id: "y" }), /* کلید از url */
    ];
    expect(HL.dash.orphanTagKeys(tagMap, records)).toEqual(["u3"]);
  });

  test("همه‌ی کلیدها زنده → خالی؛ رکورد تهی → همه یتیم", () => {
    const tagMap = { u1: ["a"] };
    expect(HL.dash.orphanTagKeys(tagMap, [rec("x", { urlNorm: "u1", url: "u1" })])).toEqual([]);
    expect(HL.dash.orphanTagKeys(tagMap, null)).toEqual(["u1"]);
  });
});

describe("groupRecords", () => {
  test("گروه‌بندی بر اساس urlNorm + شمارش یادداشت", () => {
    const groups = HL.dash.groupRecords([
      rec("a", { urlNorm: "u1", url: "u1", note: "n1" }),
      rec("b", { urlNorm: "u1", url: "u1", createdAt: 300, updatedAt: 400 }),
      rec("c", { urlNorm: "u2", url: "u2" }),
    ], "newest");
    expect(groups.length).toBe(2);
    const g1 = groups.find((g: any) => g.key === "u1")!;
    expect(g1.items.length).toBe(2);
    expect(g1.notes).toBe(1);
    expect(g1.latest).toBe(400);
    expect(g1.earliest).toBe(100);
  });

  test("مرتب‌سازی newest: گروه با آخرین فعالیت اول", () => {
    const groups = HL.dash.groupRecords([
      rec("old", { urlNorm: "u1", url: "u1", updatedAt: 100 }),
      rec("new", { urlNorm: "u2", url: "u2", updatedAt: 999 }),
    ], "newest");
    expect(groups[0].key).toBe("u2");
  });

  test("مرتب‌سازی oldest و page", () => {
    const list = [
      rec("x1", { urlNorm: "u1", url: "u1", title: "بتا", createdAt: 900, start: 20 }),
      rec("x2", { urlNorm: "u2", url: "u2", title: "آلفا", createdAt: 100, start: 50 }),
    ];
    const oldest = HL.dash.groupRecords(list, "oldest");
    expect(oldest[0].key).toBe("u2");
    const page = HL.dash.groupRecords(list, "page");
    expect(page[0].title).toBe("آلفا");
    /* in «بر اساس صفحه» (by page) sort, items are ordered by text offset */
    expect(page[0].items[0].start).toBe(50);
  });

  test("رکورد بدون آدرس → گروه با کلید id", () => {
    const groups = HL.dash.groupRecords([rec("z", { url: "", urlNorm: "" })], "newest");
    expect(groups[0].key).toBe("z");
  });
});

describe("initialCollapsed — سیاست جمع‌شدگی هنگام باز شدن داشبورد (v1.2.14)", () => {
  test("قرارداد فاساد: تابعی خالص روی HL.dash", () => {
    expect(typeof HL.dash.initialCollapsed).toBe("function");
  });

  test("چند گروه → فقط تازه‌ترین مقاله (max latest) باز می‌ماند؛ بقیه جمع", () => {
    const groups = HL.dash.groupRecords([
      rec("a1", { urlNorm: "u1", url: "u1", updatedAt: 100 }),
      rec("b1", { urlNorm: "u2", url: "u2", updatedAt: 500 }),
      rec("c1", { urlNorm: "u3", url: "u3", updatedAt: 300 }),
    ], "newest");
    const set = HL.dash.initialCollapsed(groups);
    expect(set instanceof Set).toBe(true);
    expect(set.has("u1")).toBe(true);   /* قدیمی → جمع */
    expect(set.has("u3")).toBe(true);   /* میانی → جمع */
    expect(set.has("u2")).toBe(false);  /* تازه‌ترین (۵۰۰) → باز */
    expect(set.size).toBe(2);
  });

  test("یک گروه → Set خالی (تازه‌ترین همان است؛ باز می‌ماند)", () => {
    const groups = HL.dash.groupRecords([
      rec("a1", { urlNorm: "u1", url: "u1", updatedAt: 100 }),
    ], "newest");
    expect(HL.dash.initialCollapsed(groups).size).toBe(0);
  });

  test("بدون گروه (یا null) → Set خالی", () => {
    expect(HL.dash.initialCollapsed([]).size).toBe(0);
    expect(HL.dash.initialCollapsed(null).size).toBe(0);
    expect(HL.dash.initialCollapsed(undefined).size).toBe(0);
  });

  test("تساوی latest → اولین گروه در ترتیب آرایه باز می‌ماند (قطعی)", () => {
    const groups = [
      { key: "k1", latest: 700 },
      { key: "k2", latest: 700 },
    ];
    const set = HL.dash.initialCollapsed(groups);
    expect(set.has("k1")).toBe(false); /* برنده‌ی قطعی */
    expect(set.has("k2")).toBe(true);
  });

  test("مستقل از ترتیب نمایش: با مرتب‌سازی oldest تازه‌ترین آخر لیست است ولی همان باز می‌ماند", () => {
    const list = [
      rec("mid", { urlNorm: "u1", url: "u1", createdAt: 100, updatedAt: 200 }),
      rec("newest", { urlNorm: "u2", url: "u2", createdAt: 900, updatedAt: 999 }),
      rec("old", { urlNorm: "u3", url: "u3", createdAt: 50, updatedAt: 60 }),
    ];
    const oldest = HL.dash.groupRecords(list, "oldest");
    expect(oldest[oldest.length - 1].key).toBe("u2"); /* تازه‌ترین، آخر لیست */
    const set = HL.dash.initialCollapsed(oldest);
    expect(set.has("u2")).toBe(false); /* با این حال همان باز است — max latest، نه «کارت اول» */
    expect(set.has("u1")).toBe(true);
    expect(set.has("u3")).toBe(true);
  });

  test("خلوص: ورودی را تغییر نمی‌دهد", () => {
    const groups = HL.dash.groupRecords([
      rec("a1", { urlNorm: "u1", url: "u1", updatedAt: 100 }),
      rec("b1", { urlNorm: "u2", url: "u2", updatedAt: 500 }),
    ], "newest");
    const before = JSON.stringify(groups.map((g: any) => [g.key, g.latest, g.items.length]));
    HL.dash.initialCollapsed(groups);
    expect(JSON.stringify(groups.map((g: any) => [g.key, g.latest, g.items.length]))).toBe(before);
  });
});

describe("detectTextDir (v1.2.6)", () => {
  test("متن فارسی/عربی → rtl؛ انگلیسی/لاتین → ltr", () => {
    expect(HL.dash.detectTextDir("دانشنامه‌ی فارسی")).toBe("rtl");
    expect(HL.dash.detectTextDir("السلام علیکم")).toBe("rtl");
    expect(HL.dash.detectTextDir("Understanding logical properties")).toBe("ltr");
    expect(HL.dash.detectTextDir("Éléments de style — naïve café")).toBe("ltr"); /* extended Latin */
    expect(HL.dash.detectTextDir("Привет мир")).toBe("ltr"); /* Cyrillic */
    expect(HL.dash.detectTextDir("שלום עולם")).toBe("rtl"); /* Hebrew */
  });

  test("خنثی: فقط رقم/علائم/خالی → رشته‌ی خالی", () => {
    expect(HL.dash.detectTextDir("")).toBe("");
    expect(HL.dash.detectTextDir("12345 !? - ()")).toBe("");
    expect(HL.dash.detectTextDir(null)).toBe("");
    expect(HL.dash.detectTextDir(undefined)).toBe("");
  });

  test("تساوی حروف جهت‌دار → بدون تصمیم (خنثی)", () => {
    expect(HL.dash.detectTextDir("علی Ali")).toBe(""); /* 3 RTL letters == 3 LTR letters */
  });
});

describe("groupRecords — جهت مقاله (v1.2.6)", () => {
  test("مقاله‌ی انگلیسی → dir=ltr (عنوان و متن موافق)", () => {
    const groups = HL.dash.groupRecords([
      rec("e1", { title: "Understanding CSS logical properties", text: "The direction of a card should follow its content language.", urlNorm: "u-en", url: "u-en" }),
      rec("e2", { title: "Understanding CSS logical properties", text: "Inline start and inline end are writing-mode aware.", urlNorm: "u-en", url: "u-en" }),
    ], "newest");
    expect(groups[0].dir).toBe("ltr");
  });

  test("مقاله‌ی فارسی → dir=rtl", () => {
    const groups = HL.dash.groupRecords([
      rec("f1", { title: "آموزش خواندن عمیق", text: "خواندن عمیق یعنی گفت‌وگو با متن", urlNorm: "u-fa", url: "u-fa" }),
    ], "newest");
    expect(groups[0].dir).toBe("rtl");
  });

  test("تعارض: عنوان فارسی + هایلایت کد انگلیسی → RTL می‌ماند (پیش‌فرض محافظه‌کار)", () => {
    const groups = HL.dash.groupRecords([
      rec("m1", { title: "آموزش کار با React و Vue", text: "useState is a Hook that lets you add state to function components.", urlNorm: "u-mix", url: "u-mix" }),
    ], "newest");
    expect(groups[0].dir).toBe("rtl"); /* RTL title veto */
  });

  test("عنوان دقیقاً خنثی (تساوی) → بدنه تصمیم می‌گیرد (سند رفتار)", () => {
    const groups = HL.dash.groupRecords([
      rec("t1", { title: "آموزش React", text: "All English body with useState hooks and components.", urlNorm: "u-tie", url: "u-tie" }),
    ], "newest");
    expect(groups[0].dir).toBe("ltr"); /* undecided title → body signal */
  });

  test("تعارض برعکس: عنوان انگلیسی + نقل‌قول فارسی → RTL می‌ماند", () => {
    const groups = HL.dash.groupRecords([
      rec("m2", { title: "The Little Prince — English Edition", text: "این متن فقط یک نقل‌قول طولانی فارسی است که در مقاله‌ی انگلیسی آمده.", urlNorm: "u-mix2", url: "u-mix2" }),
    ], "newest");
    expect(groups[0].dir).toBe("rtl");
  });

  test("عنوان خالی + متن انگلیسی → ltr (سیگنال بدنه کافی است)", () => {
    const groups = HL.dash.groupRecords([
      rec("n1", { title: "", text: "All highlights are in English here.", urlNorm: "u-notitle", url: "u-notitle" }),
    ], "newest");
    expect(groups[0].dir).toBe("ltr");
  });

  test("کاملاً خنثی (بدون حروف جهت‌دار) → rtl پیش‌فرض", () => {
    const groups = HL.dash.groupRecords([
      rec("z1", { title: "123", text: "...", urlNorm: "u-neutral", url: "u-neutral" }),
    ], "newest");
    expect(groups[0].dir).toBe("rtl");
  });
});

describe("computeStats", () => {
  test("شمارش کل/یادداشت/صفحه/سایت", () => {
    const s = HL.dash.computeStats([
      rec("a", { urlNorm: "u1", host: "h1", note: "x" }),
      rec("b", { urlNorm: "u1", host: "h1" }),
      rec("c", { urlNorm: "u2", host: "h2", note: "y" }),
    ]);
    expect(s).toEqual({ total: 3, notes: 2, pages: 2, sites: 2 });
    expect(HL.dash.computeStats([])).toEqual({ total: 0, notes: 0, pages: 0, sites: 0 });
  });
});

describe("paginate (v1.2.9)", () => {
  const grp = (key: string, n: number) => ({
    key,
    host: key + ".com",
    title: "مقاله " + key,
    url: "https://" + key + ".com/1",
    items: Array.from({ length: n }, (_, i) => rec(key + i)),
    notes: 0,
    latest: 0,
    earliest: 0,
  });

  test("همه‌ی گروه‌ها جا می‌شوند → همه کامل، remaining صفر، overflow صفر", () => {
    const groups = [grp("a", 2), grp("b", 3)];
    const p = HL.dash.paginate(groups, 10);
    expect(p.visible.length).toBe(2);
    expect(p.visible[0].group).toBe(groups[0]); /* whole groups: same reference, no copy */
    expect(p.visible[1].group).toBe(groups[1]);
    expect(p.visible.map((v: any) => v.remaining)).toEqual([0, 0]);
    expect(p.shown).toBe(5);
    expect(p.overflow).toBe(0);
  });

  test("برش داخل گروه: کپی کم‌عمق با slice، remaining درست، overflow شامل باقیمانده + گروه‌های بعد", () => {
    const groups = [grp("a", 2), grp("b", 5), grp("c", 4)];
    const p = HL.dash.paginate(groups, 5); /* room 3 left for group b */
    expect(p.visible.length).toBe(2);
    const cut = p.visible[1].group;
    expect(cut).not.toBe(groups[1]); /* shallow copy — not the source object */
    expect(cut.items.length).toBe(3);
    expect(cut.key).toBe("b"); /* key survives the copy (collapsedGroups lookup in the controller) */
    expect(cut.host).toBe("b.com");
    expect(p.visible[1].remaining).toBe(2);
    expect(p.shown).toBe(5);
    expect(p.overflow).toBe(6); /* 2 of b + all 4 of c */
  });

  test("حد صفر → هیچ گروهی نمایش نمی‌یابد، overflow برابر کل", () => {
    const groups = [grp("a", 2), grp("b", 3)];
    const p = HL.dash.paginate(groups, 0);
    expect(p.visible).toEqual([]);
    expect(p.shown).toBe(0);
    expect(p.overflow).toBe(5);
  });

  test("گروه‌های بعد از نقطه‌ی برش کامل رد می‌شوند (همه‌ی آیتم‌هایشان در overflow)", () => {
    const groups = [grp("a", 2), grp("b", 5), grp("c", 3), grp("d", 1)];
    const p = HL.dash.paginate(groups, 5); /* a whole + b cut at 3 → c and d skipped whole */
    expect(p.visible.length).toBe(2);
    expect(p.visible[1].group.items.length).toBe(3);
    expect(p.overflow).toBe(6); /* 2 of b + 3 of c + 1 of d */
  });

  test("شیء گروه اصلی با برش جهش نمی‌یابد", () => {
    const g = grp("a", 5);
    const p = HL.dash.paginate([g], 2);
    expect(p.visible[0].group).not.toBe(g);
    expect(g.items.length).toBe(5); /* source untouched */
    expect(p.visible[0].group.items.length).toBe(2);
    expect(p.overflow).toBe(3);
  });

  test("حد دقیقاً برابر مجموع → همه کامل نمایش می‌یابند، overflow صفر", () => {
    const groups = [grp("a", 2), grp("b", 3)];
    const p = HL.dash.paginate(groups, 5);
    expect(p.visible.length).toBe(2);
    expect(p.visible[1].group).toBe(groups[1]); /* exact fit: no cut, no copy */
    expect(p.shown).toBe(5);
    expect(p.overflow).toBe(0);
  });
});

/* ================= v0.2.0 — Direction-separated article sections ================= */

describe("leadDir — جهت بخش پیشرو (v0.2.0)", () => {
  test("قرارداد فاساد: تابعی خالص روی HL.dash", () => {
    expect(typeof HL.dash.leadDir).toBe("function");
  });

  test("جهت تازه‌ترین مقاله (max latest) برمی‌گردد: RTL→'rtl'، LTR→'ltr'", () => {
    const mk = (faAt: number, enAt: number) => HL.dash.groupRecords([
      rec("fa1", { urlNorm: "u-fa", url: "u-fa", title: "آموزش خواندن عمیق", text: "خواندن عمیق یعنی گفت‌وگو با متن", updatedAt: faAt }),
      rec("en1", { urlNorm: "u-en", url: "u-en", title: "Understanding logical properties", text: "Logical properties flow relative to the writing mode of the document.", updatedAt: enAt }),
    ], "newest");
    expect(HL.dash.leadDir(mk(900, 100))).toBe("rtl"); /* تازه‌ترین فارسی */
    expect(HL.dash.leadDir(mk(100, 900))).toBe("ltr"); /* تازه‌ترین انگلیسی */
  });

  test("بدون گروه (null/undefined/[]) → رشته‌ی خالی", () => {
    expect(HL.dash.leadDir([])).toBe("");
    expect(HL.dash.leadDir(null)).toBe("");
    expect(HL.dash.leadDir(undefined)).toBe("");
  });

  test("یک گروه → جهت خودش", () => {
    const groups = HL.dash.groupRecords([
      rec("e1", { urlNorm: "u-en", url: "u-en", title: "English article", text: "All English body here.", updatedAt: 10 }),
    ], "newest");
    expect(HL.dash.leadDir(groups)).toBe("ltr");
  });

  test("تساوی latest → اولین گروه در ترتیب آرایه (همان قاعده‌ی قطعی initialCollapsed)", () => {
    expect(HL.dash.leadDir([{ key: "k1", latest: 700, dir: "ltr" }, { key: "k2", latest: 700, dir: "rtl" }])).toBe("ltr");
    expect(HL.dash.leadDir([{ key: "k1", latest: 700, dir: "rtl" }, { key: "k2", latest: 700, dir: "ltr" }])).toBe("rtl");
  });

  test("هم‌رأیی با initialCollapsed: جهت همان مقاله‌ای که کارتش هنگام باز شدن داشبورد باز می‌ماند", () => {
    const groups = HL.dash.groupRecords([
      rec("fa1", { urlNorm: "u-fa", url: "u-fa", title: "آموزش خواندن عمیق", text: "خواندن عمیق یعنی گفت‌وگو با متن", updatedAt: 100 }),
      rec("fa2", { urlNorm: "u-fa2", url: "u-fa2", title: "یادداشت‌برداری", text: "یادداشت‌برداری فعال", updatedAt: 300 }),
      rec("en1", { urlNorm: "u-en", url: "u-en", title: "Understanding logical properties", text: "Logical properties flow relative to the writing mode.", updatedAt: 500 }),
    ], "newest");
    const collapsed = HL.dash.initialCollapsed(groups);
    const open = groups.filter((g: any) => !collapsed.has(g.key));
    expect(open.length).toBe(1);
    expect(HL.dash.leadDir(groups)).toBe(open[0].dir); /* یک تعریف «تازه‌ترین» — هر دو سیاست */
  });

  test("مستقل از ترتیب نمایش: با sort=oldest تازه‌ترین آخر لیست است ولی جهت همان است", () => {
    const list = [
      rec("fa1", { urlNorm: "u-fa", url: "u-fa", title: "آموزش خواندن عمیق", text: "خواندن عمیق یعنی گفت‌وگو با متن", createdAt: 100, updatedAt: 200 }),
      rec("en1", { urlNorm: "u-en", url: "u-en", title: "Understanding logical properties", text: "Logical properties flow relative to the writing mode.", createdAt: 900, updatedAt: 999 }),
    ];
    const oldest = HL.dash.groupRecords(list, "oldest");
    expect(oldest[oldest.length - 1].key).toBe("u-en"); /* تازه‌ترین، آخر لیست */
    expect(HL.dash.leadDir(oldest)).toBe("ltr"); /* ولی جهت از max latest می‌آید، نه از اول لیست */
  });

  test("dir غایب/نامعتبر → پیش‌فرض محافظه‌کار rtl (همان سیاست contentDir)", () => {
    expect(HL.dash.leadDir([{ key: "k", latest: 5 }])).toBe("rtl");
    expect(HL.dash.leadDir([{ key: "k", latest: 5, dir: "x" }])).toBe("rtl");
  });

  test("خلوص: ورودی را تغییر نمی‌دهد", () => {
    const groups = [{ key: "k1", latest: 100, dir: "ltr" }];
    const before = JSON.stringify(groups);
    HL.dash.leadDir(groups);
    expect(JSON.stringify(groups)).toBe(before);
  });
});

describe("splitDirSections — افرزش مقاله‌های نمایشی به بخش‌های جهتی (v0.2.0)", () => {
  const E = (key: string, dir: string, remaining = 0) => ({ group: { key, dir }, remaining });

  test("قرارداد فاساد: تابعی خالص روی HL.dash", () => {
    expect(typeof HL.dash.splitDirSections).toBe("function");
  });

  test("ترکیبی + lead=rtl → بخش rtl اول؛ ترتیب ورودی داخل هر بخش عیناً حفظ می‌شود", () => {
    const entries = [E("fa1", "rtl"), E("en1", "ltr"), E("fa2", "rtl"), E("en2", "ltr")];
    const out = HL.dash.splitDirSections(entries, "rtl");
    expect(out.length).toBe(2);
    expect(out[0].dir).toBe("rtl");
    expect(out[0].entries.map((e: any) => e.group.key)).toEqual(["fa1", "fa2"]);
    expect(out[1].dir).toBe("ltr");
    expect(out[1].entries.map((e: any) => e.group.key)).toEqual(["en1", "en2"]);
  });

  test("lead=ltr → بخش ltr اول (همان ورودی، فقط جای بخش‌ها عوض می‌شود)", () => {
    const entries = [E("fa1", "rtl"), E("en1", "ltr"), E("fa2", "rtl")];
    const out = HL.dash.splitDirSections(entries, "ltr");
    expect(out[0].dir).toBe("ltr");
    expect(out[0].entries.map((e: any) => e.group.key)).toEqual(["en1"]);
    expect(out[1].dir).toBe("rtl");
    expect(out[1].entries.map((e: any) => e.group.key)).toEqual(["fa1", "fa2"]);
  });

  test("یک جهت → فقط یک بخش؛ بخش خالی دیگر حذف می‌شود (مستقل از lead)", () => {
    const fa = [E("fa1", "rtl"), E("fa2", "rtl")];
    expect(HL.dash.splitDirSections(fa, "rtl")).toEqual([{ dir: "rtl", entries: fa }]);
    expect(HL.dash.splitDirSections(fa, "ltr")).toEqual([{ dir: "rtl", entries: fa }]); /* بخش ltr خالی → هیچ */
    const en = [E("en1", "ltr")];
    expect(HL.dash.splitDirSections(en, "rtl")).toEqual([{ dir: "ltr", entries: en }]);
  });

  test("ورودی خالی/تهی → آرایه‌ی خالی", () => {
    expect(HL.dash.splitDirSections([], "rtl")).toEqual([]);
    expect(HL.dash.splitDirSections(null, "ltr")).toEqual([]);
    expect(HL.dash.splitDirSections(undefined, "")).toEqual([]);
  });

  test("lead تهی/نامعتبر → پیش‌فرض rtl-first (سازگار با پیش‌فرض محافظه‌کار UI)", () => {
    const entries = [E("en1", "ltr"), E("fa1", "rtl")];
    expect(HL.dash.splitDirSections(entries, "")[0].dir).toBe("rtl");
    expect(HL.dash.splitDirSections(entries, undefined as any)[0].dir).toBe("rtl");
  });

  test("گروه بدون dir → بخش rtl (پیش‌فرض محافظه‌کار)", () => {
    const entries = [{ group: { key: "odd" }, remaining: 0 }, E("en1", "ltr")];
    const out = HL.dash.splitDirSections(entries, "rtl");
    expect(out[0].dir).toBe("rtl");
    expect(out[0].entries.map((e: any) => e.group.key)).toEqual(["odd"]);
  });

  test("ورودی paginate خام: همان مرجع‌های entry — بدون کپی یا بازچینش داده", () => {
    const groups = HL.dash.groupRecords([
      rec("fa1", { urlNorm: "u-fa", url: "u-fa", title: "آموزش خواندن عمیق", text: "خواندن عمیق", updatedAt: 100 }),
      rec("en1", { urlNorm: "u-en", url: "u-en", title: "Understanding logical properties", text: "Logical properties flow", updatedAt: 500 }),
      rec("fa2", { urlNorm: "u-fa2", url: "u-fa2", title: "یادداشت‌برداری", text: "یادداشت فعال", updatedAt: 300 }),
    ], "newest");
    const page = HL.dash.paginate(groups, 50);
    const out = HL.dash.splitDirSections(page.visible, "ltr");
    const all = out.reduce((a: any[], s: any) => a.concat(s.entries), []);
    expect(all.length).toBe(page.visible.length);
    page.visible.forEach((v: any) => expect(all.includes(v)).toBe(true)); /* عیناً همان مرجع‌ها */
  });

  test("remainingِ برش paginate سالم می‌ماند (برای item-more کارت)", () => {
    /* یک گروه ۳ آیتمی + حد ۲ → برش با remaining=۱؛ بقیه‌ی گروه‌ها کامل در overflow */
    const list = [
      rec("fa1", { urlNorm: "u-fa", url: "u-fa", title: "مقاله الف", text: "متن الف", updatedAt: 100 }),
      rec("fa2", { urlNorm: "u-fa", url: "u-fa", title: "مقاله الف", text: "متن الف۲", updatedAt: 150 }),
      rec("fa3", { urlNorm: "u-fa", url: "u-fa", title: "مقاله الف", text: "متن الف۳", updatedAt: 200 }),
      rec("en1", { urlNorm: "u-en", url: "u-en", title: "English article", text: "English text", updatedAt: 500 }),
    ];
    const groups = HL.dash.groupRecords(list, "newest");
    const page = HL.dash.paginate(groups, 3); /* en کامل (۱) + fa برش (۲ از ۳) */
    expect(page.visible[1].remaining).toBe(1);
    const out = HL.dash.splitDirSections(page.visible, "ltr");
    const faSec = out.find((s: any) => s.dir === "rtl")!;
    expect(faSec.entries[0].remaining).toBe(1); /* remaining از paginate دست‌نخورده عبور می‌کند */
  });

  test("خلوص: آرایه‌ی ورودی و گروه‌هایش تغییر نمی‌کنند", () => {
    const entries = [E("fa1", "rtl"), E("en1", "ltr")];
    const before = JSON.stringify(entries);
    HL.dash.splitDirSections(entries, "ltr");
    expect(JSON.stringify(entries)).toBe(before);
  });
});

describe("pipeline بخش‌های جهتی — groupRecords → paginate → leadDir → splitDirSections (v0.2.0)", () => {
  /* ۴ مقاله‌ی مستقل: ۲ فارسی (rtl) + ۲ انگلیسی (ltr) */
  const mixed = (faAt: number, enAt: number) => [
    rec("fa1", { urlNorm: "u-fa", url: "u-fa", title: "آموزش خواندن عمیق", text: "خواندن عمیق یعنی گفت‌وگو با متن", updatedAt: faAt }),
    rec("fa2", { urlNorm: "u-fa2", url: "u-fa2", title: "یادداشت‌برداری فعال", text: "یادداشت‌برداری حافظه را تقویت می‌کند", updatedAt: faAt - 50 }),
    rec("en1", { urlNorm: "u-en", url: "u-en", title: "Understanding logical properties", text: "Logical properties flow relative to the writing mode of the document.", updatedAt: enAt }),
    rec("en2", { urlNorm: "u-en2", url: "u-en2", title: "The dir attribute and bidi text", text: "The dir attribute sets the base direction for bidi text.", updatedAt: enAt - 50 }),
  ];

  function sections(list: any[]) {
    const groups = HL.dash.groupRecords(list, "newest");
    const page = HL.dash.paginate(groups, 50);
    const lead = HL.dash.leadDir(groups);
    return { groups, page, lead, sections: HL.dash.splitDirSections(page.visible, lead) };
  }

  test("هوشمندی: تازه‌ترین مقاله LTR → بخش LTR بالاتر و کارت تازه‌ترین داخل همان بخش", () => {
    const r = sections(mixed(100, 900));
    expect(r.lead).toBe("ltr");
    expect(r.sections.length).toBe(2);
    expect(r.sections[0].dir).toBe("ltr");
    expect(r.sections[0].entries[0].group.key).toBe("u-en"); /* newest first داخل بخش خودش (sort موجود) */
    expect(r.sections[1].dir).toBe("rtl");
    expect(r.sections[1].entries[0].group.key).toBe("u-fa");
  });

  test("هوشمندی (برعکس): تازه‌ترین مقاله RTL → بخش RTL بالاتر", () => {
    const r = sections(mixed(900, 100));
    expect(r.lead).toBe("rtl");
    expect(r.sections[0].dir).toBe("rtl");
    expect(r.sections[0].entries[0].group.key).toBe("u-fa");
    expect(r.sections[1].dir).toBe("ltr");
  });

  test("ترتیب کارت‌ها داخل هر بخش همان توالی آن جهت در sort موجود است (بدون مرتب‌سازی مجدد)", () => {
    /* داده‌ی درهم: ترتیب کلی newest = fa@900, en@850, fa2@100, en2@50 → rtl/ltr درهم، نه بلوکی */
    const list = [
      rec("fa1", { urlNorm: "u-fa", url: "u-fa", title: "آموزش خواندن عمیق", text: "خواندن عمیق یعنی گفت‌وگو با متن", updatedAt: 900 }),
      rec("en1", { urlNorm: "u-en", url: "u-en", title: "Understanding logical properties", text: "Logical properties flow relative to the writing mode.", updatedAt: 850 }),
      rec("fa2", { urlNorm: "u-fa2", url: "u-fa2", title: "یادداشت‌برداری فعال", text: "یادداشت‌برداری حافظه را تقویت می‌کند", updatedAt: 100 }),
      rec("en2", { urlNorm: "u-en2", url: "u-en2", title: "The dir attribute and bidi text", text: "The dir attribute sets the base direction for bidi text.", updatedAt: 50 }),
    ];
    const r = sections(list);
    const globalOrder = r.page.visible.map((v: any) => v.group.key);
    expect(globalOrder).toEqual(["u-fa", "u-en", "u-fa2", "u-en2"]); /* درهم — نه بلوکی */
    expect(r.lead).toBe("rtl");
    /* توالی هر جهت در ترتیب کلی، عیناً همان توالی داخل بخش خودش است */
    const seqOf = (dir: string) => globalOrder.filter(function (k: string) {
      return dir === "rtl" ? k === "u-fa" || k === "u-fa2" : k === "u-en" || k === "u-en2";
    });
    const secOf = (dir: string) => r.sections.find((s: any) => s.dir === dir)!.entries.map((e: any) => e.group.key);
    expect(secOf("rtl")).toEqual(seqOf("rtl")); /* [u-fa, u-fa2] */
    expect(secOf("ltr")).toEqual(seqOf("ltr")); /* [u-en, u-en2] */
  });

  test("تک‌جهته: فقط مقاله‌های فارسی → یک بخش؛ sort و paginate و collapse همه دست‌نخورده", () => {
    const list = [
      rec("fa1", { urlNorm: "u-fa", url: "u-fa", title: "مقاله یک", text: "متن فارسی", updatedAt: 100 }),
      rec("fa2", { urlNorm: "u-fa2", url: "u-fa2", title: "مقاله دو", text: "متن فارسی۲", updatedAt: 500 }),
    ];
    const groups = HL.dash.groupRecords(list, "newest");
    const page = HL.dash.paginate(groups, 50);
    const lead = HL.dash.leadDir(groups);
    const secs = HL.dash.splitDirSections(page.visible, lead);
    expect(lead).toBe("rtl");
    expect(secs).toEqual([{ dir: "rtl", entries: page.visible }]); /* عیناً همان لیست قبلی، در یک بخش */
  });

  test("با sort=page (الفبایی): بخش‌ها جدا می‌مانند ولی ترتیب الفبایی داخل هر بخش حفظ می‌شود", () => {
    const list = mixed(100, 900);
    const groups = HL.dash.groupRecords(list, "page"); /* الفبایی با locale فارسی */
    const page = HL.dash.paginate(groups, 50);
    const lead = HL.dash.leadDir(groups);
    const secs = HL.dash.splitDirSections(page.visible, lead);
    expect(lead).toBe("ltr"); /* تازه‌ترین (en1@850) هنوز LTR است — مستقل از sort */
    expect(secs[0].dir).toBe("ltr");
    /* توالی هر جهت در ترتیب الفبایی کلی، عیناً داخل بخش خودش حفظ می‌شود */
    const globalOrder = page.visible.map((v: any) => v.group.key);
    const seqOf = (dir: string) => globalOrder.filter(function (k: string) {
      return dir === "rtl" ? k === "u-fa" || k === "u-fa2" : k === "u-en" || k === "u-en2";
    });
    const secOf = (dir: string) => secs.find((s: any) => s.dir === dir)!.entries.map((e: any) => e.group.key);
    expect(secOf("rtl")).toEqual(seqOf("rtl"));
    expect(secOf("ltr")).toEqual(seqOf("ltr"));
  });
});

/* ================= v0.3.0 — Bulk expand/collapse ================= */

describe("bulkAction — تصمیم دکمه‌ی باز/بستن گروهی (v0.3.0)", () => {
  const G = (key: string) => ({ key, host: "h", title: "t", url: "u", items: [], notes: 0, latest: 1, earliest: 1, dir: "rtl" });

  test("لیست خالی → '' (دکمه مخفی می‌شود؛ چیزی برای toggle نیست)", () => {
    expect(HL.dash.bulkAction([], new Set())).toBe("");
    expect(HL.dash.bulkAction(null, new Set())).toBe("");
  });

  test("همه‌ی کارت‌ها باز → 'collapse' (قدم مفید بعدی: بستن همه)", () => {
    expect(HL.dash.bulkAction([G("a"), G("b"), G("c")], new Set())).toBe("collapse");
  });

  test("حتی یک کارت بسته → 'expand' (حالت mix)", () => {
    expect(HL.dash.bulkAction([G("a"), G("b"), G("c")], new Set(["b"]))).toBe("expand");
  });

  test("همه‌ی کارت‌ها بسته → 'expand'", () => {
    expect(HL.dash.bulkAction([G("a"), G("b")], new Set(["a", "b"]))).toBe("expand");
  });

  test("تک‌مقاله: باز → 'collapse'؛ بسته → 'expand' (توگل هوشمند تک‌کارتی)", () => {
    expect(HL.dash.bulkAction([G("solo")], new Set())).toBe("collapse");
    expect(HL.dash.bulkAction([G("solo")], new Set(["solo"]))).toBe("expand");
  });

  test("حالت بوت v1.2.14 (فقط تازه‌ترین باز) → 'expand' — همان چیزی که بعد از باز شدن داشبورد می‌بینی", () => {
    const groups = [G("newest"), G("old1"), G("old2")];
    const boot = HL.dash.initialCollapsed(groups); /* {old1, old2} */
    expect(HL.dash.bulkAction(groups, boot)).toBe("expand");
  });

  test("بدون کانتینر (undefined) → همه باز فرض می‌شوند → 'collapse'", () => {
    expect(HL.dash.bulkAction([G("a")], undefined as any)).toBe("collapse");
  });

  test("خالص: نه آرایه‌ی گروه‌ها دست می‌خورد نه کانتینر", () => {
    const groups = [G("a"), G("b")];
    const collapsed = new Set(["a"]);
    HL.dash.bulkAction(groups, collapsed);
    expect(groups.map((g: any) => g.key)).toEqual(["a", "b"]);
    expect([...collapsed]).toEqual(["a"]);
    expect(groups[0].items).toEqual([]); /* بدون تغییر */
  });
});

describe("pipeline گروهی — bulkAction + paginate(Infinity) (v0.3.0)", () => {
  /* همان ترکیبی که کنترلر انجام می‌دهد: تصمیم تازه + بالابردن سقف صفحه‌بندی.
     مکانیزم «بارگذاری همه» از دل paginate دست‌نخورده می‌گذرد: limit=Infinity. */
  const bulk = (n: number) => {
    const list: any[] = [];
    for (let i = 0; i < n; i++) {
      list.push(rec("b" + i, {
        urlNorm: "u-bulk" + (i % 5), url: "u-bulk" + (i % 5),
        title: "مقاله انبوه " + (i % 5), text: "متن " + i, updatedAt: i,
      }));
    }
    return HL.dash.groupRecords(list, "newest");
  };

  test("قرارداد بارگذاری کامل: paginate(groups, Infinity) → همه‌ی گروه‌ها، remaining=0 همه‌جا، overflow=0", () => {
    const groups = bulk(120); /* ۵ مقاله × ۲۴ هایلایت */
    const page = HL.dash.paginate(groups, Infinity);
    expect(page.visible.length).toBe(5); /* هیچ گروهی بیرون نمی‌ماند */
    expect(page.overflow).toBe(0); /* load-more مخفی می‌شود */
    page.visible.forEach((v: any) => expect(v.remaining).toBe(0)); /* هیچ جای‌نگه‌دارِ item-more نیست */
    expect(page.shown).toBe(120);
  });

  test("چرخه‌ی کامل توگل هوشمند: بوت(expand) → بازکردن همه(collapse) → بستن همه(expand) — هر بار همه بارگذاری می‌شود", () => {
    const groups = bulk(70); /* ۵ مقاله × ۱۴ */
    const collapsed = new Set(HL.dash.initialCollapsed(groups));
    /* ۱) بعد از بوت: دکمه «باز کردن همه» — کلیک: clear + Infinity */
    expect(HL.dash.bulkAction(groups, collapsed)).toBe("expand");
    collapsed.clear();
    let page = HL.dash.paginate(groups, Infinity);
    expect(HL.dash.bulkAction(groups, collapsed)).toBe("collapse"); /* برچسب برمی‌گردد */
    expect(page.overflow).toBe(0);
    /* ۲) بعد از بازکردن همه: دکمه «بستن همه» — کلیک: add همه + Infinity */
    groups.forEach((g: any) => collapsed.add(g.key));
    page = HL.dash.paginate(groups, Infinity);
    expect(HL.dash.bulkAction(groups, collapsed)).toBe("expand"); /* برچسب برمی‌گردد */
    expect(page.overflow).toBe(0); /* بستن هم «همه را بارگذاری» می‌کند — خواسته‌ی صریح مالک */
    expect(collapsed.size).toBe(5);
  });

  test("مرتب‌سازی/گروه‌بندی موجود دست‌نخورده: توالی گروه‌های صفحه‌ی عادی، پیشوندِ همان توالی در حالت کامل است", () => {
    const groups = bulk(60); /* ۵ مقاله × ۱۲ */
    const normal = HL.dash.paginate(groups, 25); /* برش واقعی: ۲ گروه کامل + گروه سوم نیمه (remaining>0) */
    const all = HL.dash.paginate(groups, Infinity);
    expect(normal.visible.length).toBe(3); /* ۱۲ + ۱۲ + ۱ → گروه سوم straddle می‌شود */
    expect(normal.visible[2].remaining).toBe(11);
    /* توالی گروه‌ها در حالت کامل همان توالی عادی است — فقط ادامه‌اش اضافه می‌شود */
    expect(all.visible.map((v: any) => v.group.key).slice(0, 3))
      .toEqual(normal.visible.map((v: any) => v.group.key));
    expect(all.visible.length).toBe(5);
    expect(all.visible[2].remaining).toBe(0); /* همان گروه straddle شده، این‌جا کامل است */
  });
});

/* ================= v0.4.0 — Per-card item order ================= */

describe("applyItemReversal — برگرداندن ترتیب هایلایت‌های یک مقاله (v0.4.0)", () => {
  const g = (key: string, ids: string[]) => ({
    key, host: "h", title: "t", url: "u", notes: 0, latest: 9, earliest: 1, dir: "rtl",
    items: ids.map((id) => ({ id })),
  });

  test("بدون کانتینر (undefined) → هیچ برمی‌نگردد؛ همه با همان مرجع رد می‌شوند", () => {
    const groups = [g("a", ["1", "2"]), g("b", ["1", "2", "3"])];
    const out = HL.dash.applyItemReversal(groups, undefined as any);
    expect(out[0]).toBe(groups[0]); /* همان مرجع */
    expect(out[1]).toBe(groups[1]);
  });

  test("کانتینر خالی → همان مرجع‌ها (رفتار پیش از v0.4.0 بایت‌به‌بایت)", () => {
    const groups = [g("a", ["1", "2"])];
    const out = HL.dash.applyItemReversal(groups, new Set());
    expect(out[0]).toBe(groups[0]);
  });

  test("گروه برگردانده‌شده: کپی سطحی با items معکوس؛ بقیه‌ی گروه‌ها با مرجع رد می‌شوند", () => {
    const a = g("a", ["1", "2", "3"]);
    const b = g("b", ["x", "y"]);
    const out = HL.dash.applyItemReversal([a, b], new Set(["a"]));
    expect(out[0]).not.toBe(a); /* کپی، نه خودش */
    expect(out[0].items.map((i: any) => i.id)).toEqual(["3", "2", "1"]);
    expect(out[1]).toBe(b); /* دست‌نخورده */
  });

  test("کپی سطحی همه‌ی سیگنال‌ها را عیناً حمل می‌کند: key/host/title/notes/latest/earliest/dir", () => {
    const a = g("a", ["1", "2"]);
    const out = HL.dash.applyItemReversal([a], new Set(["a"]));
    expect(out[0].key).toBe("a");
    expect(out[0].latest).toBe(9);
    expect(out[0].earliest).toBe(1);
    expect(out[0].dir).toBe("rtl");
    expect(out[0].notes).toBe(0);
  });

  test("خالص: آرایه‌ی items مبدا هرگز دست نمی‌خورد (مرتب‌سازی پایه از خودش می‌ماند)", () => {
    const a = g("a", ["1", "2", "3"]);
    HL.dash.applyItemReversal([a], new Set(["a"]));
    expect(a.items.map((i: any) => i.id)).toEqual(["1", "2", "3"]); /* بدون تغییر */
  });

  test("خالص: نه آرایه‌ی گروه‌ها و نه کانتینر تغییری نمی‌کنند", () => {
    const a = g("a", ["1", "2"]);
    const rev = new Set(["a"]);
    HL.dash.applyItemReversal([a], rev);
    expect([...rev]).toEqual(["a"]);
    expect(a.items.map((i: any) => i.id)).toEqual(["1", "2"]);
  });

  test("آرایه‌ی خالی → خالی", () => {
    expect(HL.dash.applyItemReversal([], new Set())).toEqual([]);
    expect(HL.dash.applyItemReversal(null as any, new Set())).toEqual([]);
  });

  test("تک‌آیتمی هم می‌چرخد (بدون خطا) — نمایش دکمه‌اش کارِ نماست", () => {
    const a = g("solo", ["only"]);
    const out = HL.dash.applyItemReversal([a], new Set(["solo"]));
    expect(out[0].items.map((i: any) => i.id)).toEqual(["only"]);
  });
});

describe("itemOrder — نگاشت sort پایه + پرچم برگشت ← کلید نمایش (v0.4.0)", () => {
  test("پایه newest: بدون برگشت → 'newest'؛ با برگشت → 'oldest'", () => {
    expect(HL.dash.itemOrder("newest", false)).toBe("newest");
    expect(HL.dash.itemOrder("newest", true)).toBe("oldest");
  });

  test("پایه oldest: بدون برگشت → 'oldest'؛ با برگشت → 'newest'", () => {
    expect(HL.dash.itemOrder("oldest", false)).toBe("oldest");
    expect(HL.dash.itemOrder("oldest", true)).toBe("newest");
  });

  test("پایه page: بدون برگشت → 'page'؛ با برگشت → 'page-rev'", () => {
    expect(HL.dash.itemOrder("page", false)).toBe("page");
    expect(HL.dash.itemOrder("page", true)).toBe("page-rev");
  });

  test("مرتب‌سازی ناشناخته → همان شاخه‌ی newest (آینه‌ی شاخه‌ی پیش‌فرض groupRecords — برچسب هرگز با ترتیب واقعی نمی‌سازد)", () => {
    expect(HL.dash.itemOrder(undefined as any, false)).toBe("newest");
    expect(HL.dash.itemOrder("garbage" as any, true)).toBe("oldest");
  });
});

describe("pipeline ترتیب کارت — groupRecords → applyItemReversal → paginate (v0.4.0)", () => {
  /* همان ترکیبی که کنترلر انجام می‌دهد: برشِ سقف ۵۰ آیتمی روی گروه‌های
     برگردانده‌شده — قرارداد «سرِ برش = سرِ لیست برگردانده‌شده». */
  const flip = (n: number) => {
    const list: any[] = [];
    for (let i = 0; i < n; i++) {
      list.push(rec("f" + i, {
        urlNorm: "u-flip" + (i % 5), url: "u-flip" + (i % 5),
        title: "مقاله چرخشی " + (i % 5), text: "متن " + i, updatedAt: i, createdAt: i,
      }));
    }
    return HL.dash.groupRecords(list, "newest");
  };

  test("straddle با برگشت: برش visible سرِ لیست معکوس است و remaining دقیق می‌ماند", () => {
    const groups = flip(120); /* ۵ مقاله × ۲۴ هایلایت؛ پایه newest: f119…f96 */
    const firstKey = groups[0].key;
    const baseIds = groups[0].items.map((i: any) => i.id);
    const out = HL.dash.applyItemReversal(groups, new Set([firstKey]));
    const page = HL.dash.paginate(out, 30); /* گروه اول کامل + گروه دوم نیمه */
    const v0 = page.visible[0];
    expect(v0.group.key).toBe(firstKey);
    expect(v0.group.items.length).toBe(24); /* کامل */
    /* گروه دوم straddle: ۶ آیتم + remaining=۱۸ */
    expect(page.visible[1].group.items.length).toBe(6);
    expect(page.visible[1].remaining).toBe(18);
    /* ترتیبِ داخل گروه برگردانده‌شده دقیقاً معکوس ترتیب پایه است */
    expect(out[0].items.map((i: any) => i.id)).toEqual(baseIds.slice().reverse());
  });

  test("بارگذاری همه (Infinity) با برگشت: همه‌ی گروه‌ها، remaining=0، سرنوشتِ ترتیب حفظ می‌شود", () => {
    const groups = flip(60); /* ۵ مقاله × ۱۲ */
    const firstKey = groups[0].key;
    const baseIds = groups[0].items.map((i: any) => i.id);
    const out = HL.dash.applyItemReversal(groups, new Set([firstKey]));
    const page = HL.dash.paginate(out, Infinity);
    expect(page.visible.length).toBe(5);
    expect(page.overflow).toBe(0);
    page.visible.forEach((v: any) => expect(v.remaining).toBe(0));
    expect(page.visible[0].group.items.map((i: any) => i.id)).toEqual(baseIds.slice().reverse());
    /* بقیه‌ی گروه‌ها ترتیب پایه را دارند */
    expect(page.visible[1].group.items.map((i: any) => i.id))
      .toEqual(groups[1].items.map((i: any) => i.id));
  });

  test("چرخه‌ی کامل کاربر: برگرداندن ← برگرداندن مجدد = بازگشت به ترتیب پایه (گروه مبدا هرگز تخریب نمی‌شود)", () => {
    const groups = flip(15); /* ۵ مقاله × ۳ */
    const key = groups[2].key;
    const baseIds = groups[2].items.map((i: any) => i.id);
    const rev = new Set([key]);
    const once = HL.dash.applyItemReversal(groups, rev);
    expect(once[2].items.map((i: any) => i.id)).toEqual(baseIds.slice().reverse());
    rev.delete(key); /* کلیک دوم: کنترلر پرچم را برمی‌دارد */
    const twice = HL.dash.applyItemReversal(groups, rev);
    expect(twice[2].items.map((i: any) => i.id)).toEqual(baseIds); /* دقیقاً ترتیب اول */
  });

  test("سیاست‌های دیگر روی گروه‌های برگردانده‌شده همان جواب را می‌دهند: initialCollapsed/leadDir/bulkAction", () => {
    const groups = flip(20); /* ۵ مقاله × ۴ */
    const before = {
      collapsed: HL.dash.initialCollapsed(groups),
      lead: HL.dash.leadDir(groups),
      bulk: HL.dash.bulkAction(groups, new Set()),
    };
    const out = HL.dash.applyItemReversal(groups, new Set(groups.map((g: any) => g.key)));
    /* همه‌ی گروه‌ها کپی سطحی شده‌اند — سیاست‌ها فقط key/latest/dir می‌خوانند */
    expect(HL.dash.initialCollapsed(out)).toEqual(before.collapsed);
    expect(HL.dash.leadDir(out)).toBe(before.lead);
    expect(HL.dash.bulkAction(out, new Set())).toBe(before.bulk);
  });
});

describe("readingOrderItems — ترتیب ارائه‌ی اسناد خروجی (v0.6.0)", () => {
  const mk = (id: string, start: number, createdAt = 100) => rec(id, { start, createdAt });

  test("مرتب‌سازی بر اساس start (آفست صفحه) با tiebreak createdAt", () => {
    const g = { key: "k", items: [mk("c", 30, 50), mk("a", 10, 90), mk("b", 10, 20), mk("z", 5, 1)] };
    expect(HL.dash.readingOrderItems(g).map((r: any) => r.id)).toEqual(["z", "b", "a", "c"]);
  });

  test("غیرجهشی: آرایه‌ی items گروه اصلی همان ترتیب قبلی می‌ماند", () => {
    const items = [mk("c", 30), mk("a", 10)];
    const g = { key: "k", items };
    HL.dash.readingOrderItems(g);
    expect(g.items.map((r: any) => r.id)).toEqual(["c", "a"]);
  });

  test("خروجی کپی است — دست‌کاری‌اش گروه را آلوده نمی‌کند", () => {
    const g = { key: "k", items: [mk("a", 1), mk("b", 2)] };
    const out = HL.dash.readingOrderItems(g);
    out.reverse();
    expect(g.items.map((r: any) => r.id)).toEqual(["a", "b"]);
  });

  test("هم‌ارز COMPARATOR مشترک با sort='page' (DRY: یک تعریف، دو مصرف‌کننده)", () => {
    const items = [mk("c", 30, 5), mk("a", 10, 9), mk("b", 20, 1), mk("t", 10, 3)];
    const viaGroup = HL.dash.groupRecords(items.map((r) => ({ ...r })), "page")[0].items.map((r: any) => r.id);
    const viaReading = HL.dash.readingOrderItems({ key: "k", items: items.map((r) => ({ ...r })) }).map((r: any) => r.id);
    expect(viaReading).toEqual(viaGroup);
  });

  test("حالت‌های مرزی: بدون گروه/بدون items → آرایه‌ی خالی", () => {
    expect(HL.dash.readingOrderItems(null)).toEqual([]);
    expect(HL.dash.readingOrderItems({})).toEqual([]);
    expect(HL.dash.readingOrderItems({ items: [] })).toEqual([]);
  });

  test("ترتیب ورودی مهم نیست — خروجی همیشه reading order است (OCP روی هر sort پایه)", () => {
    const newest = HL.dash.groupRecords([mk("a", 10, 1), mk("b", 20, 2), mk("c", 30, 3)], "newest")[0];
    expect(HL.dash.readingOrderItems(newest).map((r: any) => r.id)).toEqual(["a", "b", "c"]);
  });
});
