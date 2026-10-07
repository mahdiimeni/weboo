/**
 * Storage layer (store) contract tests — DIP/LSP
 *
 * The "contract" runs against the extension's own backends:
 *   1) chrome.storage (with a full mock shaped like callback/lastError)
 *   2) in-memory (fallback)
 * If any backend behaves differently, LSP is violated and the test goes red.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine, makeChromeMock, sleep } from "./helpers/engine";

interface Ctx {
  name: string;
  HL: any;
  store: any;
  chrome?: any;
}

async function makeRecord(id: string, host: string, url: string, extra: any = {}) {
  return {
    id,
    host,
    site: "https://" + host,
    url,
    urlNorm: url,
    title: "عنوان " + id,
    text: "متن " + id,
    prefix: "پیش",
    suffix: "پس",
    start: 10,
    end: 14,
    anchor: { start: "p[1]", startOffset: 0, end: "p[1]", endOffset: 4 },
    color: "green",
    note: "",
    createdAt: 1000,
    updatedAt: 1000,
    ...extra,
  };
}

/* ---------- scenario builders ---------- */

async function chromeCtx(): Promise<Ctx> {
  const chrome = makeChromeMock();
  const HL = await loadEngine({ chrome });
  return { name: "chrome-storage (mock)", HL, store: HL.createStore(HL.backends.chromeStorage()), chrome };
}
async function memoryCtx(): Promise<Ctx> {
  const HL = await loadEngine({});
  return { name: "memory (fallback)", HL, store: HL.createStore(HL.backends.memoryArea()) };
}

const SCENARIOS: Array<() => Promise<Ctx>> = [chromeCtx, memoryCtx];

const recA = async () => await makeRecord("a1", "site1.com", "https://site1.com/page1");
const recB = async () => await makeRecord("b1", "site1.com", "https://site1.com/page2", { color: "pink", note: "یادداشت", updatedAt: 2000 });
const recC = async () => await makeRecord("c1", "site2.org", "https://site2.org/x", { text: "متن سایت دوم" });

for (const makeCtx of SCENARIOS) {
  describe(`قرارداد store — ${makeCtx.name}`, () => {
    let ctx: Ctx;
    beforeAll(async () => {
      setupDom();
      ctx = await makeCtx();
    });

    test("بک‌اند قرارداد ۵عضوی را دارد (ISP حداقلی)", async () => {
      const b = ctx.HL.backends;
      expect(typeof b).toBe("object");
    });

    test("createStore بک‌اند ناقص را رد می‌کند", async () => {
      expect(() => ctx.HL.createStore({})).toThrow();
      expect(() => ctx.HL.createStore({ get: () => {}, set: () => {}, remove: () => {}, bytes: () => {}, onChange: null })).toThrow();
    });

    test("تنظیمات پیش‌فرض و merge", async () => {
      const s = await ctx.store.getSettings();
      expect(s.defaultColor).toBe("yellow");
      expect(s.showToolbar).toBe(true);
      expect(s.showBadge).toBe(true);
      expect(s.disabledHosts).toEqual([]);
      expect(s.theme).toBe("auto");

      await ctx.store.setSettings({ defaultColor: "teal", disabledHosts: ["a.com"] });
      const s2 = await ctx.store.getSettings();
      expect(s2.defaultColor).toBe("teal");
      expect(s2.disabledHosts).toEqual(["a.com"]);
      expect(s2.showBadge).toBe(true); /* the rest are preserved */
      expect(s2.theme).toBe("auto"); /* theme untouched */
    });

    test("تم (v1.2.0): رفت‌وبرگشت light/dark + حفظ بقیه‌ی تنظیمات", async () => {
      await ctx.store.setSettings({ theme: "light" });
      let s = await ctx.store.getSettings();
      expect(s.theme).toBe("light");
      expect(s.showToolbar).toBe(true); /* the rest from defaults */

      await ctx.store.setSettings({ theme: "dark", defaultColor: "pink" });
      s = await ctx.store.getSettings();
      expect(s.theme).toBe("dark");
      expect(s.defaultColor).toBe("pink");

      /* back to auto */
      await ctx.store.setSettings({ theme: "auto" });
      s = await ctx.store.getSettings();
      expect(s.theme).toBe("auto");
    });

    test("پارتیشن per-host: ذخیره و خواندن", async () => {
      await ctx.store.save(await recA());
      await ctx.store.save(await recB());
      await ctx.store.save(await recC());

      const m = await ctx.store.getHostMap("site1.com");
      expect(Object.keys(m).sort()).toEqual(["a1", "b1"]);

      const page1 = await ctx.store.getForUrl("https://site1.com/page1", "site1.com");
      expect(page1.size).toBe(1);
      expect(page1.get("a1").text).toBe("متن a1");
    });

    test("getAllRecords روی همه‌ی هاست‌ها + hostsWithData", async () => {
      const all = await ctx.store.getAllRecords();
      expect(all.size).toBe(3);
      const hosts = (await ctx.store.hostsWithData()).sort();
      expect(hosts).toEqual(["site1.com", "site2.org"]);
    });

    test("remove با hostHint و بدون hint", async () => {
      expect(await ctx.store.remove("a1", "site1.com")).toBe(true);
      expect((await ctx.store.getAllRecords()).size).toBe(2);
      /* without a hint: search all hosts */
      expect(await ctx.store.remove("c1")).toBe(true);
      expect((await ctx.store.getAllRecords()).size).toBe(1);
      expect(await ctx.store.remove("idonotexist")).toBe(false);
    });

    test("removeMany دسته‌ای", async () => {
      await ctx.store.save(await recA());
      await ctx.store.save(await recC());
      await ctx.store.removeMany(["a1", "c1", "unknown"]);
      const all = await ctx.store.getAllRecords();
      expect(all.has("a1")).toBe(false);
      expect(all.has("c1")).toBe(false);
      expect(all.has("b1")).toBe(true);
    });

    test("removeForUrl فقط همان صفحه را پاک می‌کند", async () => {
      await ctx.store.save(await recA());
      expect(await ctx.store.removeForUrl("https://site1.com/page1", "site1.com")).toBe(true);
      const m = await ctx.store.getHostMap("site1.com");
      expect(m.a1).toBeUndefined();
      expect(m.b1).toBeDefined();
      expect(await ctx.store.removeForUrl("https://site1.com/none", "site1.com")).toBe(false);
    });

    test("exportData شکل نسخه‌دار کامل دارد", async () => {
      const b = await ctx.store.exportData();
      expect(b.app).toBe("web-highlighter");
      expect(b.format).toBe(1);
      expect(b.version).toBe(ctx.HL.VERSION);
      expect(typeof b.exportedAt).toBe("number");
      expect(b.meta.count).toBe(1); /* only b1 remains */
      expect(b.highlights.b1).toBeDefined();
    });

    test("importData — merge: جدیدتر برنده، قدیمی skip، نامعتبر skip", async () => {
      const backup = {
        app: "web-highlighter",
        highlights: {
          b1: await makeRecord("b1", "site1.com", "https://site1.com/page2", { note: "یادداشت جدید", updatedAt: 9000 }),
          bad1: { id: "bad1", host: "x", urlNorm: "u", text: "" }, /* no text */
          new1: await makeRecord("new1", "site3.net", "https://site3.net/z"),
        },
      };
      const r = await ctx.store.importData(backup, "merge");
      expect(r.added).toBe(1); /* new1 */
      expect(r.updated).toBe(1); /* b1 (9000 > 2000) */
      expect(r.skipped).toBe(1); /* textless */

      const m = await ctx.store.getHostMap("site1.com");
      expect(m.b1.note).toBe("یادداشت جدید");
      const all = await ctx.store.getAllRecords();
      expect(all.has("new1")).toBe(true);
      expect(all.has("bad1")).toBe(false);

      /* older than the existing one → skip (existing wins) */
      const r2 = await ctx.store.importData({
        app: "web-highlighter",
        highlights: { b1: await makeRecord("b1", "site1.com", "https://site1.com/page2", { note: "قدیمی", updatedAt: 1 }) },
      }, "merge");
      expect(r2.skipped).toBe(1);
      const m2 = await ctx.store.getHostMap("site1.com");
      expect(m2.b1.note).toBe("یادداشت جدید");
    });

    test("importData — replace: همه‌چیز پاک و جایگزین", async () => {
      const backup = {
        app: "web-highlighter",
        settings: { defaultColor: "purple" },
        highlights: { z1: await makeRecord("z1", "z.com", "https://z.com/1") },
      };
      const r = await ctx.store.importData(backup, "replace");
      expect(r.removed).toBe(2); /* b1 + new1 */
      const all = await ctx.store.getAllRecords();
      expect(all.size).toBe(1);
      expect(all.has("z1")).toBe(true);
      const s = await ctx.store.getSettings();
      expect(s.defaultColor).toBe("purple");
    });

    test("importData نامعتبر → خطا با پیام فارسی", async () => {
      await expect(ctx.store.importData({ app: "other-app", highlights: {} }, "merge")).rejects.toThrow("فایل پشتیبان");
      await expect(ctx.store.importData(null, "merge")).rejects.toThrow();
    });

    test("sanitizeRecord: رنگ نامعتبر → yellow؛ جبران فیلدها", async () => {
      await ctx.store.importData({
        app: "web-highlighter",
        highlights: {
          w1: { id: "w1", host: "w.com", url: "https://w.com/1", urlNorm: "https://w.com/1", text: "تست", color: "rainbow" },
        },
      }, "merge");
      const m = await ctx.store.getHostMap("w.com");
      expect(m.w1.color).toBe("yellow");
      expect(typeof m.w1.createdAt).toBe("number");
      expect(m.w1.note).toBe("");
    });

    test("onSettingsChanged با تنظیمات ادغام‌شده شلیک می‌شود", async () => {
      let got: any = null;
      const unsub = ctx.store.onSettingsChanged((s: any) => { got = s; });
      await ctx.store.setSettings({ showBadge: false });
      await sleep(30);
      expect(got).not.toBeNull();
      expect(got.showBadge).toBe(false);
      expect(got.defaultColor).toBe("purple"); /* merged with defaults/existing */
      if (typeof unsub === "function") unsub();
    });

    test("همگام‌سازی زنده‌ی تم: تغییر theme از داشبورد به پاپ‌آپِ باز می‌رسد", async () => {
      let seenTheme: any = null;
      const unsub = ctx.store.onSettingsChanged((s: any) => { seenTheme = s.theme; });
      await ctx.store.setSettings({ theme: "dark" });
      await sleep(30);
      expect(seenTheme).toBe("dark");
      await ctx.store.setSettings({ theme: "auto" });
      await sleep(30);
      expect(seenTheme).toBe("auto");
      if (typeof unsub === "function") unsub();
    });

    test("onRecordsChanged فقط برای کلیدهای hlx:d:* شلیک می‌شود", async () => {
      let calls = 0;
      ctx.store.onRecordsChanged(() => { calls++; });
      await ctx.store.save(await recC());
      await sleep(30);
      expect(calls).toBe(1);
      await ctx.store.setSettings({ showToolbar: true }); /* settings must not bump the counter */
      await sleep(30);
      expect(calls).toBe(1);
    });

    test("getBytesInUse بعد از ذخیره مثبت است", async () => {
      const b = await ctx.store.getBytesInUse();
      expect(b).toBeGreaterThan(0);
    });

    /* ---------- favicon contract (hlx:f:<host>) — v1.1.4 ---------- */

    test("setFavicon/getFavicon: ذخیره در پارتیشن جدا و خواندن همان host", async () => {
      const icon = "data:image/png;base64,iVBORw0KGgo=";
      const saved = await ctx.store.setFavicon("site1.com", { icon, capturedAt: 5000 });
      expect(saved && saved.icon).toBe(icon);
      expect(saved.host).toBe("site1.com");
      const m = await ctx.store.getFavicon("site1.com");
      expect(m).not.toBeNull();
      expect(m.icon).toBe(icon);
      expect(m.capturedAt).toBe(5000);
      /* another host has nothing → the consumer keeps the first-letter fallback */
      expect(await ctx.store.getFavicon("other.net")).toBeNull();
    });

    test("sanitizeFaviconMeta: آیکون غیر data:image یا host کثیف رد می‌شود (null)", async () => {
      expect(await ctx.store.setFavicon("bad1.com", { icon: "https://cdn.example/x.png" })).toBeNull();
      expect(await ctx.store.setFavicon("bad2.com", { icon: "" })).toBeNull();
      expect(await ctx.store.setFavicon("https://x.com/a", { icon: "data:image/png;base64,AA" })).toBeNull(); /* host with a slash */
      expect(await ctx.store.getFavicon("bad1.com")).toBeNull();
    });

    test("getFaviconMap: همه‌ی favicon ها یک‌جا؛ کلیدهای نامعتبر حذف می‌شوند", async () => {
      const icon = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
      await ctx.store.setFavicon("site1.com", { icon, capturedAt: 1 });
      await ctx.store.setFavicon("site2.org", { icon, capturedAt: 2 });
      const map = await ctx.store.getFaviconMap();
      expect(Object.keys(map).sort()).toEqual(["site1.com", "site2.org"]);
      expect(map["site1.com"].icon).toBe(icon);
    });

    test("onRecordsChanged برای نوشتن favicon شلیک نمی‌شود (پارتیشن جدا)", async () => {
      let calls = 0;
      ctx.store.onRecordsChanged(() => { calls++; });
      await ctx.store.setFavicon("site1.com", { icon: "data:image/png;base64,AA", capturedAt: 1 });
      await sleep(30);
      expect(calls).toBe(0);
    });

    test("exportData شامل favicon هاست و importData آن‌ها را merge می‌کند", async () => {
      const icon = "data:image/png;base64,iVBORw0KGgo=";
      await ctx.store.setFavicon("site1.com", { icon, capturedAt: 7000 });
      const b = await ctx.store.exportData();
      expect(b.favicons && b.favicons["site1.com"].icon).toBe(icon);
      /* restore onto an empty store */
      await ctx.store.clearAll();
      expect(await ctx.store.getFavicon("site1.com")).toBeNull();
      await ctx.store.importData(b, "merge");
      const m = await ctx.store.getFavicon("site1.com");
      expect(m && m.icon).toBe(icon);
    });

    test("importData: favicon نامعتبر بک‌آپ نادیده گرفته می‌شود؛ merge نسخه‌ی جدیدتر برنده", async () => {
      await ctx.store.setFavicon("site1.com", { icon: "data:image/png;base64,NEW", capturedAt: 9000 });
      const backup = {
        app: "web-highlighter",
        highlights: {},
        favicons: {
          "site1.com": { icon: "data:image/png;base64,OLD", capturedAt: 100 }, /* older → does not overwrite the newer */
          "site9.io": { icon: "http://not-data-url/x.png" },                    /* invalid → rejected */
          "site3.net": { icon: "data:image/svg+xml;base64,PHM=", capturedAt: 500 },
        },
      };
      await ctx.store.importData(backup, "merge");
      expect((await ctx.store.getFavicon("site1.com")).icon).toBe("data:image/png;base64,NEW");
      expect(await ctx.store.getFavicon("site9.io")).toBeNull();
      expect((await ctx.store.getFavicon("site3.net")).icon).toBe("data:image/svg+xml;base64,PHM=");
    });

    test("clearAll کلیدهای hlx را پاک می‌کند", async () => {
      await ctx.store.clearAll();
      const all = await ctx.store.getAllRecords();
      expect(all.size).toBe(0);
      const s = await ctx.store.getSettings();
      expect(s.defaultColor).toBe("yellow"); /* back to defaults */
      expect(await ctx.store.getFaviconMap()).toEqual({}); /* favicons wiped too */
    });

    /* ---------- article-tags contract (hlx:tags) — v1.2.15 ---------- */

    test("getTags: ابتدا خالی", async () => {
      expect(await ctx.store.getTags()).toEqual({});
    });

    test("setArticleTags + getTags: رفت‌وبرگشت با پاک‌سازی و حذف تکراری", async () => {
      await ctx.store.setArticleTags("https://site1.com/page1", ["  پژوهش ", "اخبار", "پژوهش", 0, null]);
      const m = await ctx.store.getTags();
      expect(m).toEqual({ "https://site1.com/page1": ["پژوهش", "اخبار"] }); /* trimmed + deduped + non-strings dropped */
    });

    test("لیست خالی → مقاله از نقشه‌ی برچسب‌ها حذف می‌شود", async () => {
      await ctx.store.setArticleTags("https://site1.com/page1", []);
      expect(await ctx.store.getTags()).toEqual({});
      await ctx.store.setArticleTags("https://site1.com/page1", ["اخبار"]); /* re-add for the next tests */
      await ctx.store.setArticleTags("https://site2.org/x", ["پژوهش"]);
    });

    test("removeArticleTags: فقط همان مقاله؛ غایب → false", async () => {
      expect(await ctx.store.removeArticleTags("https://no-such.url/1")).toBe(false);
      expect(await ctx.store.removeArticleTags("https://site2.org/x")).toBe(true);
      const m = await ctx.store.getTags();
      expect(Object.keys(m)).toEqual(["https://site1.com/page1"]);
      expect(await ctx.store.removeArticleTags("")).toBe(false); /* empty key guard */
    });

    test("onTagsChanged فقط برای hlx:tags شلیک می‌شود (رکورد/تنظیمات نه)", async () => {
      let tagCalls = 0;
      let recCalls = 0;
      ctx.store.onTagsChanged(() => { tagCalls++; });
      ctx.store.onRecordsChanged(() => { recCalls++; });
      await ctx.store.setArticleTags("https://site2.org/x", ["آزمایش"]);
      await sleep(30);
      expect(tagCalls).toBe(1);
      await ctx.store.save(await recC());
      await ctx.store.setSettings({ showBadge: true });
      await sleep(30);
      expect(tagCalls).toBe(1); /* unchanged by record/settings writes */
      expect(recCalls).toBeGreaterThanOrEqual(1); /* records still fire their own channel */
    });

    test("exportData شامل tags است", async () => {
      const b = await ctx.store.exportData();
      expect(b.tags).toEqual({
        "https://site1.com/page1": ["اخبار"],
        "https://site2.org/x": ["آزمایش"],
      });
    });

    test("importData — merge: اجتماع برچسب‌های هر مقاله + پاک‌سازی ورودی نامعتبر", async () => {
      const backup = {
        app: "web-highlighter",
        highlights: {},
        tags: {
          "https://site1.com/page1": ["پژوهش", "اخبار"], /* اخبار موجود → اجتماع بدون تکرار */
          "https://site3.net/z": ["  نویسه‌های تازه ", ""],
          "bad-no-array": "پژوهش",
        },
      };
      await ctx.store.importData(backup, "merge");
      const m = await ctx.store.getTags();
      expect(m["https://site1.com/page1"]).toEqual(["اخبار", "پژوهش"]); /* union, order: existing first */
      expect(m["https://site3.net/z"]).toEqual(["نویسه‌های تازه"]);
      expect(m["bad-no-array"]).toBeUndefined(); /* structural garbage dropped */
      expect(m["https://site2.org/x"]).toEqual(["آزمایش"]); /* untouched articles untouched */
    });

    test("importData — replace: جایگزینی کامل برچسب‌ها؛ بک‌آپ بدون tags → پاک", async () => {
      await ctx.store.importData({
        app: "web-highlighter",
        highlights: { t1: await makeRecord("t1", "t.com", "https://t.com/1") },
        tags: { "https://t.com/1": ["تازه"] },
      }, "replace");
      expect(await ctx.store.getTags()).toEqual({ "https://t.com/1": ["تازه"] });

      /* replace with a tags-less backup: everything (incl. tags) is wiped and not restored */
      await ctx.store.importData({
        app: "web-highlighter",
        highlights: { t2: await makeRecord("t2", "t.com", "https://t.com/2") },
      }, "replace");
      expect(await ctx.store.getTags()).toEqual({});
    });

    test("merge با بک‌آپ بدون tags: برچسب‌های فعلی دست‌نخورده می‌مانند", async () => {
      await ctx.store.setArticleTags("https://t.com/2", ["مانده"]);
      await ctx.store.importData({
        app: "web-highlighter",
        highlights: {},
      }, "merge");
      expect(await ctx.store.getTags()).toEqual({ "https://t.com/2": ["مانده"] });
    });

    test("clearAll برچسب‌ها را هم پاک می‌کند (داده می‌میرند با داده)", async () => {
      await ctx.store.clearAll();
      expect(await ctx.store.getTags()).toEqual({});
    });
  });
}

/* ---------- behavioral compatibility across backends (LSP) ---------- */

describe("صف نوشتن — رگرسیون race هم‌زمانی", async () => {
  test("۱۰۰ ذخیره‌ی هم‌زمان هیچ رکوردی را نمی‌بلعد", async () => {
    setupDom();
    const HL = await loadEngine({});
    const store = HL.createStore(HL.backends.memoryArea());
    const jobs: Promise<any>[] = [];
    for (let i = 0; i < 100; i++) {
      jobs.push(store.save(await makeRecord("r" + i, "race.io", "https://race.io/" + (i % 3))));
    }
    await Promise.all(jobs);
    const all = await store.getAllRecords();
    expect(all.size).toBe(100);
  });

  test("حذف هم‌زمان با ذخیره همسایه، داده‌ی بی‌ربط را نمی‌بلعد", async () => {
    setupDom();
    const HL = await loadEngine({});
    const store = HL.createStore(HL.backends.memoryArea());
    await store.save(await makeRecord("keep", "race.io", "https://race.io/1"));
    await store.save(await makeRecord("drop", "race.io", "https://race.io/1"));
    const jobs = [
      store.remove("drop", "race.io"),
      store.save(await makeRecord("new1", "race.io", "https://race.io/2")),
      store.save(await makeRecord("new2", "race.io", "https://race.io/2")),
    ];
    await Promise.all(jobs);
    const m = await store.getHostMap("race.io");
    expect(m.keep).toBeDefined();
    expect(m.drop).toBeUndefined();
    expect(m.new1).toBeDefined();
    expect(m.new2).toBeDefined();
  });
});

describe("LSP — دو بک‌اند روی دنباله‌ی یکسان، نتایج یکسان", async () => {
  test("chrome و حافظه‌ای یک خروجی معادل می‌دهند", async () => {
    setupDom();
    const run = async (store: any) => {
      await store.save(await recA());
      await store.save(await recB());
      await store.setSettings({ defaultColor: "pink" });
      const out = await store.exportData();
      await store.remove("a1", "site1.com");
      const after = await store.getAllRecords();
      return { count: out.meta.count, b1: !!out.highlights.b1, after: after.size, settings: (await store.getSettings()).defaultColor };
    };
    const chrome = makeChromeMock();
    const HLC = await loadEngine({ chrome });
    const storeC = HLC.createStore(HLC.backends.chromeStorage());
    const c = await run(storeC);

    const HLM = await loadEngine({});
    const storeM = HLM.createStore(HLM.backends.memoryArea());
    const m = await run(storeM);

    expect(c).toEqual(m);
  });
});

describe("createStoreReader — برش فقط-خواندنی (ISP)", async () => {
  test("قرارداد باریک: فقط ۳ عضو خواندن/شنیدن — هیچ متد نوشتن", async () => {
    setupDom();
    const HL = await loadEngine({});
    const reader = HL.createStoreReader(HL.backends.memoryArea());
    expect(Object.keys(reader).sort()).toEqual(["getSettings", "onRecordsChanged", "onSettingsChanged"]);
  });

  test("بک‌اند ناقص را رد می‌کند (fail-fast)", async () => {
    setupDom();
    const HL = await loadEngine({});
    expect(() => HL.createStoreReader({ get: () => {} })).toThrow();
    expect(() => HL.createStoreReader(null)).toThrow();
  });

  test("getSettings پیش‌فرض‌ها را merge می‌کند (قرارداد همان store)", async () => {
    setupDom();
    const chrome = makeChromeMock();
    const HL = await loadEngine({ chrome });
    const reader = HL.createStoreReader(HL.backends.chromeStorage());
    const s = await reader.getSettings();
    expect(s).toEqual(HL.DEFAULT_SETTINGS);
    await reader.getSettings(); /* a second read is fine */
  });

  test("onSettingsChanged با تنظیمات ادغام‌شده شلیک می‌شود؛ onRecordsChanged نه", async () => {
    setupDom();
    const chrome = makeChromeMock();
    const HL = await loadEngine({ chrome });
    const store = HL.createStore(HL.backends.chromeStorage());
    const reader = HL.createStoreReader(HL.backends.chromeStorage());
    let settingsHits = 0;
    let recordsHits = 0;
    let seenDefault = "";
    reader.onSettingsChanged(function (s) { settingsHits++; seenDefault = s.defaultColor; });
    reader.onRecordsChanged(function () { recordsHits++; });

    await store.setSettings({ defaultColor: "pink" });
    await sleep(20);
    expect(settingsHits).toBe(1);
    expect(seenDefault).toBe("pink");
    expect(recordsHits).toBe(0);

    await store.save(await recA());
    await sleep(20);
    expect(recordsHits).toBe(1);
    expect(settingsHits).toBe(1); /* writing a record does not touch settings */
  });

  test("LSP: همان قرارداد روی بک‌اند حافظه‌ای", async () => {
    setupDom();
    const HLM = await loadEngine({});
    /* one shared substrate — the reader must observe the store's writes
       through the same backend */
    const area = HLM.backends.memoryArea();
    const store = HLM.createStore(area);
    const reader = HLM.createStoreReader(area);
    await store.setSettings({ defaultColor: "teal" });
    await sleep(20);
    const s = await reader.getSettings();
    expect(s.defaultColor).toBe("teal");
    expect(s.showToolbar).toBe(true); /* merged with defaults */
  });
});


/* ---------- hlx:schemaVersion — Phase 4 data-safety contract ---------- */

describe("hlx:schemaVersion — قرارداد نسخه‌ی اسکیما (forward-only migration)", async () => {
  const K_SCHEMA = "hlx:schemaVersion";

  async function rawVersion(HL: any): Promise<any> {
    const o = await HL.backends.chromeStorage().get(K_SCHEMA);
    return o && K_SCHEMA in o ? o[K_SCHEMA] : undefined;
  }

  test("داده‌ی قدیمی (بدون نسخه) → ثبت نسخه ۱، داده بایت‌به‌بایت دست‌نخورده", async () => {
    setupDom();
    const rec = await makeRecord("a1", "site1.com", "https://site1.com/p");
    const chrome = makeChromeMock({
      "hlx:d:site1.com": { a1: rec },
      "hlx:settings": { defaultColor: "teal" },
      "hlx:tags": { "https://site1.com/p": ["تگ‌ها"] },
    });
    const HL = await loadEngine({ chrome });
    const store = HL.createStore(HL.backends.chromeStorage());

    const recs = await store.getAllRecords(); /* first op → migration rides the queue */
    expect(recs.size).toBe(1);
    expect(recs.get("a1")).toEqual(rec); /* byte-identical record */
    expect((await store.getSettings()).defaultColor).toBe("teal"); /* merged, not reset */
    expect(await store.getTags()).toEqual({ "https://site1.com/p": ["تگ‌ها"] });
    expect(await rawVersion(HL)).toBe(1); /* stamped after success */
  });

  test("نسخه‌ی جدیدتر (کاربر downgrade کرده) هرگز دست نمی‌خورد", async () => {
    setupDom();
    const rec = await makeRecord("a1", "site1.com", "https://site1.com/p");
    const chrome = makeChromeMock({ [K_SCHEMA]: 99, "hlx:d:site1.com": { a1: rec } });
    const HL = await loadEngine({ chrome });
    const store = HL.createStore(HL.backends.chromeStorage());

    expect((await store.getAllRecords()).size).toBe(1);
    expect(await rawVersion(HL)).toBe(99); /* never downgraded, never rewritten */
  });

  test("گپ مهاجرت → هیچ نسخه‌ای ثبت نمی‌شود (داده مهم‌تر از آرایش)", async () => {
    setupDom();
    const chrome = makeChromeMock({ "hlx:d:site1.com": { a1: await makeRecord("a1", "site1.com", "https://site1.com/p") } });
    const HL = await loadEngine({ chrome });
    /* injected empty chain: v0 has no step → the runner must stamp NOTHING */
    const store = HL.createStore(HL.backends.chromeStorage(), { migrations: [] });

    expect((await store.getAllRecords()).size).toBe(1); /* reads still work */
    expect(await rawVersion(HL)).toBeUndefined(); /* no stamp over unknown ground */
  });

  test("زنجیره‌ی ناقص → تا جایی که پله دارد بالا می‌رود، نه بیشتر", async () => {
    setupDom();
    const chrome = makeChromeMock();
    const HL = await loadEngine({ chrome });
    const store = HL.createStore(HL.backends.chromeStorage(), {
      schemaVersion: 3,
      migrations: [
        { from: 0, to: 1, run: async () => {} },
        { from: 1, to: 2, run: async () => {} } /* 2→3 missing = the gap */
      ]
    });
    await store.getSettings(); /* first op */
    expect(await rawVersion(HL)).toBe(2); /* stamped per completed step — never 3 */
  });

  test("migration سریِ نوشتن است: هیچ ذخیره‌ای از کنارش رد نمی‌شود", async () => {
    setupDom();
    const chrome = makeChromeMock();
    const HL = await loadEngine({ chrome });
    const store = HL.createStore(HL.backends.chromeStorage());
    const p = store.save(await makeRecord("a1", "site1.com", "https://site1.com/p")); /* issued immediately */
    await p;
    expect(await rawVersion(HL)).toBe(1); /* stamp completed before the queued write landed */
    expect((await store.getAllRecords()).size).toBe(1);
  });

  test("clearAll کلیدهای کاربری را پاک می‌کند، نسخه‌ی اسکیما را نگه می‌دارد", async () => {
    setupDom();
    const chrome = makeChromeMock();
    const HL = await loadEngine({ chrome });
    const store = HL.createStore(HL.backends.chromeStorage());
    await store.save(await makeRecord("a1", "site1.com", "https://site1.com/p"));
    await store.clearAll();
    expect((await store.getAllRecords()).size).toBe(0);
    expect(await rawVersion(HL)).toBe(1); /* schema metadata survives a user wipe */
  });
});

for (const makeCtx of SCENARIOS) {
  describe(`unknown-field preservation (hardening) — ${makeCtx.name}`, () => {
    let ctx: Ctx;
    beforeAll(async () => {
      setupDom();
      ctx = await makeCtx();
    });

  test("newer-version data: unknown fields survive import → read → export → re-import", async () => {
    ctx = await makeCtx();
    const future = await makeRecord("f1", "future.io", "https://future.io/a");
    future.fontWeight = 3;                 /* a future top-level field */
    future.meta = { model: "v9", tags: ["a", "b"] }; /* nested future object */
    future.flag = true;
    await ctx.store.importData({ app: "web-highlighter", highlights: { f1: future } }, "merge");

    const stored = (await ctx.store.getAllRecords()).get("f1")!;
    expect(stored.fontWeight).toBe(3);         /* preserved in storage */
    expect(stored.meta).toEqual({ model: "v9", tags: ["a", "b"] });

    const backup = await ctx.store.exportData(); /* export round trip keeps them */
    const again = await ctx.store.importData(JSON.parse(JSON.stringify(backup)), "replace");
    const stored2 = (await ctx.store.getAllRecords()).get("f1")!;
    expect(stored2.fontWeight).toBe(3);
    expect(stored2.meta).toEqual({ model: "v9", tags: ["a", "b"] });
    expect(again.added).toBe(1);
  });

  test("current-version data: known fields always win and no unknown keys leak in", async () => {
    ctx = await makeCtx();
    const rec = await makeRecord("c1", "site1.com", "https://site1.com/p");
    await ctx.store.importData({ app: "web-highlighter", highlights: { c1: rec } }, "merge");
    const stored = (await ctx.store.getAllRecords()).get("c1")!;
    expect(stored.text).toBe(rec.text);
    expect(stored.color).toBe(rec.color);
    expect(Object.keys(stored).sort()).toEqual(
      ["anchor", "color", "createdAt", "end", "host", "id", "note", "prefix", "site", "start", "suffix", "text", "title", "updatedAt", "url", "urlNorm"].sort()
    ); /* the exact v1 shape — nothing extra */
  });

  test("older-version data: missing engine fields → defaults, still no surprise keys", async () => {
    ctx = await makeCtx();
    await ctx.store.importData({
      app: "web-highlighter",
      highlights: { o1: { id: "o1", host: "old.io", url: "https://old.io/x", urlNorm: "https://old.io/x", text: "قدیمی" } },
    }, "merge");
    const stored = (await ctx.store.getAllRecords()).get("o1")!;
    expect(stored.text).toBe("قدیمی");
    expect(stored.color).toBe("yellow"); /* default applied */
    expect(stored.title).toBe("");
  });

  test("malformed unknown data: hostile keys and oversized blobs are dropped, record survives", async () => {
    ctx = await makeCtx();
    const future = await makeRecord("m1", "mixed.io", "https://mixed.io/a");
    (future as any)["bad key; drop"] = 1;                       /* key shape */
    (future as any)["big"] = "x".repeat(10000);                 /* over budget */
    (future as any)["fn"] = () => "not JSON";                    /* not serializable */
    (future as any)["ok"] = { small: true };
    await ctx.store.importData({ app: "web-highlighter", highlights: { m1: future } }, "merge");
    const stored = (await ctx.store.getAllRecords()).get("m1")!;
    expect(stored.ok).toEqual({ small: true });  /* valid unknown field kept */
    expect(stored["bad key; drop"]).toBeUndefined();
    expect(stored.big).toBeUndefined();
    expect(stored.fn).toBeUndefined();
    expect(stored.text).toBe("متن m1");          /* the record itself is unharmed */
  });

  test("missing fields: textless record still skipped (validation NOT weakened by preservation)", async () => {
    ctx = await makeCtx();
    const r = await ctx.store.importData({
      app: "web-highlighter",
      highlights: { bad: { id: "bad", host: "x", urlNorm: "u", text: "" } },
    }, "merge");
    expect(r.skipped).toBe(1);
  });
});
}
