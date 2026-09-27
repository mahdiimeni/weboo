/**
 * Tests for the small core modules — HL.util / HL.url / HL.format / HL.export
 * (after the v1.1.1 split, each concern is tested in its own module)
 */
import { describe, test, expect } from "bun:test";
import { setupDom, loadEngine, sleep, ext } from "./helpers/engine";

describe("HL.url.normalizeUrl", () => {
  test("حذف hash و utm و مرتب‌سازی پارامترها", () => {
    setupDom();
    const HL = loadEngine({});
    const r = HL.url.normalizeUrl("https://Example.com/a/?utm_source=x&b=2&a=1#section");
    expect(r).not.toBeNull();
    expect(r.host).toBe("example.com");
    expect(r.norm).toBe("https://example.com/a?a=1&b=2"); /* trailing slash removed + params sorted */
    expect(r.url).toBe("https://example.com/a?b=2&a=1");
    expect(r.site).toBe("https://example.com");
  });

  test("حذف اسلش انتهایی و پارامترهای ردیابی", () => {
    setupDom();
    const HL = loadEngine({});
    const r = HL.url.normalizeUrl("https://example.com/path/?gclid=abc&ref=xx");
    expect(r.norm).toBe("https://example.com/path");
  });

  test("نرمال‌سازی پورت پیش‌فرض", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.url.normalizeUrl("https://example.com:443/x").norm).toBe("https://example.com/x");
    expect(HL.url.normalizeUrl("http://example.com:80/y").norm).toBe("http://example.com/y");
  });

  test("دامنه کوچک‌شده", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.url.normalizeUrl("HTTPS://Fa.EXAMPLE.IR/Deep/Path").host).toBe("fa.example.ir");
  });

  test("آدرس نامعتبر → null", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.url.normalizeUrl("not a url")).toBeNull();
    expect(HL.url.normalizeUrl(null)).toBeNull();
  });
});

describe("HL.util (پریمیتیوهای هسته)", () => {
  test("newId: پیشوند و یکتایی", () => {
    setupDom();
    const HL = loadEngine({});
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const id = HL.util.newId();
      expect(id.startsWith("hlx_")).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(500);
  });

  test("escapeHtml: کاراکترهای خطرناک escape می‌شوند", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.util.escapeHtml('<a href="x">&\'</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
    expect(HL.util.escapeHtml(null)).toBe("");
    expect(HL.util.escapeHtml(5)).toBe("5");
  });

  test("debounce: فقط آخرین فراخوانی اجرا می‌شود", async () => {
    setupDom();
    const HL = loadEngine({});
    let calls: number[] = [];
    const fn = HL.util.debounce((n: number) => calls.push(n), 30);
    fn(1);
    fn(2);
    fn(3);
    await sleep(60);
    expect(calls).toEqual([3]);
  });

  test("cssEscape: شناسه‌های امن بدون تغییر می‌مانند", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.util.cssEscape("hlx_abc123")).toBe("hlx_abc123");
  });

  test("utils دیگر اعضای جابه‌جاشده را ندارد (قرارداد تفکیک)", () => {
    setupDom();
    const HL = loadEngine({});
    expect(Object.keys(HL.util).sort()).toEqual(["cssEscape", "debounce", "escapeHtml", "newId"]);
  });
});

describe("HL.format (فرمت‌های نمایشی)", () => {
  test("excerpt: فاصله‌ها فشرده و بلند کوتاه می‌شود", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.format.excerpt("  salam   \n\t daneh  ", 50)).toBe("salam daneh");
    const out = HL.format.excerpt("abcdefghij", 5);
    expect(out).toBe("abcde…");
    expect(HL.format.excerpt("abc", 5)).toBe("abc");
    expect(HL.format.excerpt(null, 5)).toBe("");
  });

  test("fmtDateTime: رشته‌ی غیرخالی برای تاریخ معتبر؛ نامعتبر بدون throw", () => {
    setupDom();
    const HL = loadEngine({});
    const d = HL.format.fmtDateTime(Date.UTC(2024, 0, 15, 10, 30));
    expect(typeof d).toBe("string");
    expect(d.length).toBeGreaterThan(0);
    expect(() => HL.format.fmtDateTime(NaN)).not.toThrow();
  });

  test("faNum: ارقام فارسی", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.format.faNum(1234)).toBe("۱٬۲۳۴");
    expect(HL.format.faNum(0)).toBe("۰");
  });

  test("fmtBytes: بایت/کیلوبایت با ارقام فارسی", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.format.fmtBytes(500)).toContain("بایت");
    expect(HL.format.fmtBytes(2048)).toContain("کیلوبایت");
    expect(HL.format.fmtBytes(3 * 1048576)).toContain("مگابایت");
  });

  test("dotColorOf: رنگ معتبر؛ نامعتبر → زرد پیش‌فرض", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.format.dotColorOf("teal")).toBe(HL.COLORS.teal.dot);
    expect(HL.format.dotColorOf("nope")).toBe(HL.COLORS.yellow.dot);
  });

  test("faviconLetter: حرف اول هاست بدون www", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.format.faviconLetter("www.wikipedia.org")).toBe("W");
    expect(HL.format.faviconLetter("")).toBe("و");
  });

  test("displayUrl: حذف scheme؛ خالی → خط تیره", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.format.displayUrl("https://example.com/a")).toBe("example.com/a");
    expect(HL.format.displayUrl("")).toBe("—");
  });

  test("displayHost: فقط دامنه‌ی اصلی (بدون www/پورت/مسیر/کوئری)", () => {
    setupDom();
    const HL = loadEngine({});
    expect(HL.format.displayHost("https://example.com/some/long/article?utm=x#top")).toBe("example.com");
    expect(HL.format.displayHost("https://www.bbc.com/persian/articles/123")).toBe("bbc.com");
    expect(HL.format.displayHost("http://localhost:3000/docs/page")).toBe("localhost");
    expect(HL.format.displayHost("www.wikipedia.org/wiki/x")).toBe("wikipedia.org");
    expect(HL.format.displayHost("fa.wikipedia.org")).toBe("fa.wikipedia.org");
    expect(HL.format.displayHost("https://sub.domain.example.co.uk/a")).toBe("sub.domain.example.co.uk");
    expect(HL.format.displayHost("https://[::1]:8080/x")).toBe("[::1]"); /* IPv6 literal */
    expect(HL.format.displayHost("file:///home/user/page.html")).toBe("—"); /* no host */
    expect(HL.format.displayHost("")).toBe("—");
  });
});

describe("HL.export (خروجی فایل)", () => {
  const loadExport = () => loadEngine({ extraFiles: [ext("shared", "export.js")] });

  test("backupFileName: الگوی نام فایل بک‌آپ", () => {
    setupDom();
    const HL = loadExport();
    expect(HL.export.backupFileName()).toMatch(/^web-highlighter-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  });

  test("saveBackup: JSON زیبا با نام بک‌آپ دانلود می‌شود", () => {
    setupDom();
    const g: any = globalThis;
    const clicked: any[] = [];
    /* createObjectURL/link clicks are recorded — content is verified via the name and the calls.
       ⚠️ revokeObjectURL deliberately stays a noop: downloadText's 1500ms cleanup timer
       still fires after the test ends, and with the method removed it would throw an
       unhandled error between other tests (flaky). A harmless noop is the safest cleanup. */
    const origCreate = g.URL.createObjectURL;
    g.URL.createObjectURL = () => "blob:mock";
    g.URL.revokeObjectURL = () => {};
    g.document.addEventListener("click", function (ev: any) {
      if (ev.target && ev.target.tagName === "A") clicked.push(ev.target.getAttribute("download"));
    }, true);
    const HL = loadExport();
    HL.export.saveBackup({ app: "web-highlighter", meta: { count: 2 } });
    expect(clicked.length).toBe(1);
    expect(String(clicked[0])).toMatch(/^web-highlighter-backup-/);
    expect(clicked[0]).toMatch(/\.json$/);
    /* createObjectURL is restored to its previous state; revokeObjectURL stays a noop (see above) */
    if (origCreate) g.URL.createObjectURL = origCreate;
    else delete g.URL.createObjectURL;
  });
});
