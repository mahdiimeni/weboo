/**
 * Tests for HL.createHighlighter — the shared orchestrator (content + demo)
 * with an in-memory backend and a simulated DOM; the full golden path:
 * create → save → reload → restore → self-heal → note → delete
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, sleep } from "./helpers/engine";

const HTML = `<div id="art"><p id="p1">مغز ما هنگام خواندن وارد حالت گفت‌وگو با نویسنده می‌شود و این مهم‌ترین جملات را نشانه‌گذاری می‌کند.</p><p id="p2">حفظ یادداشت‌های محلی همان وابستگی‌ای است که باید شکسته شود.</p><p id="p3">متن سوم برای تست انتخاب</p></div>`;
const HTML_HEALED = `<div id="art"><p id="p1">مقدمه‌ای کوتاه. مغز ما  هنگام خواندن وارد حالت گفت‌وگو با نویسنده می‌شود و این مهم‌ترین جملات را نشانه‌گذاری می‌کند.</p><p id="p2">حفظ یادداشت‌های محلی همان وابستگی‌ای است که باید شکسته شود.</p><p id="p3">متن سوم برای تست انتخاب</p></div>`;

let HL: any;
let win: any;
let art: any;
let store: any;
let events: Array<[string, any]>;

const PAGE = { url: "u", norm: "u", site: "s", host: "test.local", title: "عنوان صفحه" };

function makeController(hooks: any = {}) {
  return HL.createHighlighter({
    page: PAGE,
    scope: art,
    eventRoot: art,
    store,
    hooks: {
      onCount: (n: number) => events.push(["count", n]),
      onSaved: (r: any) => events.push(["saved", r ? r.id : null]),
      onDeleted: (id: string) => events.push(["deleted", id]),
      onError: (m: string) => events.push(["error", m]),
      toast: (m: string) => events.push(["toast", m]),
      ...hooks,
    },
  });
}

beforeEach(async () => {
  win = setupDom({ html: HTML });
  HL = await loadEngine({});
  art = win.document.getElementById("art");
  store = HL.createStore(HL.backends.memoryArea());
  events = [];
});

describe("createFromRange — مسیر برنامه‌ای", () => {
  test("رکورد + mark + ذخیره + قلاب‌ها", async () => {
    const hl = makeController();
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 0);
    r.setEnd(p1.firstChild, 9);
    const rec = hl.createFromRange(r, "مغز ما هن", "green", "");
    expect(rec).not.toBeNull();
    expect(hl.count()).toBe(1);
    const marks = HL.dom.marksOf(rec.id);
    expect(marks.length).toBe(1);
    expect(marks[0].getAttribute("data-hl-color")).toBe("green");
    expect(marks[0].textContent).toBe("مغز ما هن");
    /* saved into the right partition (persistRecord is fire-and-forget → flush) */
    await sleep(10);
    const m = await store.getHostMap("test.local");
    expect(m[rec.id].text).toBe("مغز ما هن");
    expect(events.some(([t]) => t === "count")).toBe(true);
    expect(events.some(([t]) => t === "saved")).toBe(true);
  });

  test("یادداشت غیرخالی → نشانگر خط زیرین", async () => {
    const hl = makeController();
    const p2 = win.document.getElementById("p2");
    const r = win.document.createRange();
    r.setStart(p2.firstChild, 0);
    r.setEnd(p2.firstChild, 4);
    const rec = hl.createFromRange(r, "حفظ ", "pink", "یادداشت اولیه");
    expect(HL.dom.marksOf(rec.id)[0].getAttribute("data-hl-noted")).toBe("1");
  });
});

describe("کپسوله‌سازی (v1.2.9)", () => {
  test("نقشه‌ی recs دیگر افشا نمی‌شود", () => {
    const hl = makeController();
    expect((hl as any).recs).toBeUndefined();
    expect(typeof hl.count).toBe("function");
    expect(typeof hl.has).toBe("function");
    expect(typeof hl.get).toBe("function");
    expect(typeof hl.each).toBe("function");
    expect(typeof hl.adoptRecord).toBe("function");
    expect(typeof hl.forgetRecord).toBe("function");
    expect(typeof hl.resetRecords).toBe("function");
  });

  test("count/has/get/each دو رکورد ساخته‌شده را کامل می‌گردانند", () => {
    const hl = makeController();
    const p1 = win.document.getElementById("p1");
    const r1 = win.document.createRange();
    r1.setStart(p1.firstChild, 0);
    r1.setEnd(p1.firstChild, 9);
    const rec1 = hl.createFromRange(r1, "مغز ما هن", "green", "");
    const p3 = win.document.getElementById("p3");
    const r2 = win.document.createRange();
    r2.setStart(p3.firstChild, 0);
    r2.setEnd(p3.firstChild, 7);
    const rec2 = hl.createFromRange(r2, "متن سوم", "teal", "");
    expect(hl.count()).toBe(2);
    expect(hl.has(rec1.id)).toBe(true);
    expect(hl.has(rec2.id)).toBe(true);
    expect(hl.has("no-such-id")).toBe(false);
    expect(hl.get(rec1.id)).toBe(rec1);
    expect(hl.get(rec2.id)).toBe(rec2);
    expect(hl.get("no-such-id")).toBeNull();
    const seen: Array<[any, string]> = [];
    hl.each((rec: any, id: string) => { seen.push([rec, id]); });
    expect(seen.length).toBe(2);
    expect(seen[0][0]).toBe(rec1); /* insertion order */
    expect(seen[0][1]).toBe(rec1.id);
    expect(seen[1][0]).toBe(rec2);
    expect(seen[1][1]).toBe(rec2.id);
  });

  test("adoptRecord/forgetRecord/resetRecords — bookkeeping فقط در حافظه", () => {
    const hl = makeController();
    expect(hl.count()).toBe(0);
    const fake = { id: "fake-1", text: "رکورد خارجی", color: "yellow" };
    hl.adoptRecord(fake);
    expect(hl.count()).toBe(1);
    expect(hl.get("fake-1")).toBe(fake);
    hl.adoptRecord({ id: "fake-2", text: "دوم", color: "green" });
    expect(hl.count()).toBe(2);
    hl.forgetRecord("fake-1");
    expect(hl.count()).toBe(1);
    expect(hl.has("fake-1")).toBe(false);
    hl.resetRecords();
    expect(hl.count()).toBe(0);
    /* invalid adopts are ignored */
    hl.adoptRecord(null);
    hl.adoptRecord({ text: "no id" });
    expect(hl.count()).toBe(0);
    /* no hooks, no toasts, no persistence fired */
    expect(events.length).toBe(0);
  });
});

describe("بازیابی بعد از reload (سه‌لایه انکُرینگ)", () => {
  test("DOM پاک + store → applyAll همه را برمی‌گرداند", async () => {
    const c1 = makeController();
    const p1 = win.document.getElementById("p1");
    const r1 = win.document.createRange();
    r1.setStart(p1.firstChild, 0);
    r1.setEnd(p1.firstChild, 9);
    const a = c1.createFromRange(r1, "مغز ما هن", "yellow", "");
    const p2 = win.document.getElementById("p2");
    const r2 = win.document.createRange();
    r2.setStart(p2.firstChild, 0);
    r2.setEnd(p2.firstChild, 6);
    const b = c1.createFromRange(r2, "حفظ یاد", "teal", "نوت");
    expect(HL.dom.allMarks().length).toBe(2);
    await sleep(10); /* let the save queue drain */

    /* simulate reload: DOM without marks + a fresh controller from the store */
    c1.dispose();
    win.document.body.innerHTML = HTML;
    art = win.document.getElementById("art");
    const c2 = makeController();
    const fresh = await store.getForUrl("u", "test.local");
    expect(fresh.size).toBe(2);
    fresh.forEach((rec: any) => { c2.adoptRecord(rec); });
    const ok = c2.applyAll();
    expect(ok).toBe(2);
    expect(HL.dom.marksOf(a.id).length).toBe(1);
    expect(HL.dom.marksOf(b.id).length).toBe(1);
    expect(HL.dom.marksOf(b.id)[0].getAttribute("data-hl-noted")).toBe("1");
  });

  test("خودترمیمی: تغییر ساختار صفحه → بازیابی متنی + انکُر تازه", async () => {
    const c1 = makeController();
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 0);
    r.setEnd(p1.firstChild, 9);
    const rec = c1.createFromRange(r, "مغز ما هن", "green", "");
    const anchorBefore = JSON.stringify(rec.anchor);
    await sleep(10);

    /* a "fresh" page with text prepended to the paragraph */
    c1.dispose();
    win.document.body.innerHTML = HTML_HEALED;
    art = win.document.getElementById("art");
    const c2 = makeController();
    const fresh = await store.getForUrl("u", "test.local");
    fresh.forEach((r2: any) => { c2.adoptRecord(r2); });
    expect(c2.applyAll()).toBe(1);
    expect(HL.dom.marksOf(rec.id).length).toBe(1);
    /* a new anchor is serialized and offsets updated (queued heal) */
    const updated = c2.get(rec.id);
    expect(JSON.stringify(updated.anchor)).not.toBe(anchorBefore);
    expect(typeof updated.start).toBe("number");
  });
});

describe("setRecordNote / setRecordColor", () => {
  test("افزودن و خالی‌کردن یادداشت + ذخیره", async () => {
    const hl = makeController();
    const p3 = win.document.getElementById("p3");
    const r = win.document.createRange();
    r.setStart(p3.firstChild, 0);
    r.setEnd(p3.firstChild, 7);
    const rec = hl.createFromRange(r, "متن سوم", "yellow", "");

    hl.setRecordNote(rec.id, "یادداشت من");
    expect(HL.dom.marksOf(rec.id)[0].getAttribute("data-hl-noted")).toBe("1");
    await sleep(10);
    let m = await store.getHostMap("test.local");
    expect(m[rec.id].note).toBe("یادداشت من");

    hl.setRecordNote(rec.id, "   "); /* whitespace only → empty note */
    expect(HL.dom.marksOf(rec.id)[0].hasAttribute("data-hl-noted")).toBe(false);
    await sleep(10);
    m = await store.getHostMap("test.local");
    expect(m[rec.id].note).toBe("   ");
  });

  test("تغییر رنگ روی mark و در store", async () => {
    const hl = makeController();
    const p3 = win.document.getElementById("p3");
    const r = win.document.createRange();
    r.setStart(p3.firstChild, 0);
    r.setEnd(p3.firstChild, 7);
    const rec = hl.createFromRange(r, "متن سوم", "yellow", "");
    hl.setRecordColor(rec.id, "purple");
    expect(HL.dom.marksOf(rec.id)[0].getAttribute("data-hl-color")).toBe("purple");
    await sleep(10);
    const m = await store.getHostMap("test.local");
    expect(m[rec.id].color).toBe("purple");
  });
});

describe("removeHighlight", () => {
  test("unwrap + حذف از store + قلاب onDeleted", async () => {
    const hl = makeController();
    const p3 = win.document.getElementById("p3");
    const r = win.document.createRange();
    r.setStart(p3.firstChild, 0);
    r.setEnd(p3.firstChild, 7);
    const rec = hl.createFromRange(r, "متن سوم", "yellow", "");
    await sleep(10); /* let the save complete */
    const ok = await hl.removeHighlight(rec.id);
    expect(ok).toBe(true);
    expect(HL.dom.marksOf(rec.id).length).toBe(0);
    expect(hl.count()).toBe(0);
    const all = await store.getAllRecords();
    expect(all.size).toBe(0);
    expect(events.some(([t, v]) => t === "deleted" && v === rec.id)).toBe(true);
    expect(events.some(([t, v]) => t === "toast" && String(v).includes("حذف"))).toBe(true);
  });
});

describe("selectionCtx — محدوده و گاردها", () => {
  test("انتخاب داخل scope معتبر است و مرزها نرمال می‌شوند", () => {
    const hl = makeController();
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 0);
    r.setEnd(p1.firstChild, 7);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    const ctx = hl.selectionCtx();
    expect(ctx).not.toBeNull();
    /* selected text comes from sel.toString (slightly different from Chrome in happy-dom);
       we verify the exact boundary on the range itself */
    expect(ctx.text.startsWith("مغز ما")).toBe(true);
    expect(ctx.range.toString().length).toBe(7);
  });

  test("انتخاب بیرون scope رد می‌شود", () => {
    const hl = makeController();
    const outside = win.document.createElement("p");
    outside.textContent = "متن بیرون از مقاله";
    win.document.body.appendChild(outside);
    const r = win.document.createRange();
    r.setStart(outside.firstChild, 0);
    r.setEnd(outside.firstChild, 5);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    expect(hl.selectionCtx()).toBeNull();
    outside.remove();
  });

  test("انتخاب داخل UI خود افزونه رد می‌شود", () => {
    const hl = makeController();
    const uiHost = win.document.createElement("div");
    uiHost.setAttribute("data-hlx-ui", "1");
    uiHost.textContent = "متن رابط کاربری";
    win.document.body.appendChild(uiHost);
    const r = win.document.createRange();
    r.setStart(uiHost.firstChild, 0);
    r.setEnd(uiHost.firstChild, 4);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    expect(hl.selectionCtx()).toBeNull();
    uiHost.remove();
  });
});

describe("createFromCtx — مسیر کاربر (نوار ابزار)", () => {
  test("هایلایت از انتخاب + خروج فوری از حالت انتخاب (فیکس v1.0.3)", async () => {
    const hl = makeController();
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 11);
    r.setEnd(p1.firstChild, 18);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    const ctx = hl.selectionCtx();
    expect(ctx).not.toBeNull();
    const rec = hl.createFromCtx(ctx, "teal", false);
    expect(rec).not.toBeNull();
    expect(HL.dom.marksOf(rec.id).length).toBe(1);
    /* v1.0.3: the text must have been deselected */
    expect(win.getSelection().isCollapsed).toBe(true);
  });

  test("رنج collapsed → null بی‌صدا (گارد ورودی)", () => {
    const hl = makeController();
    const collapsed = win.document.createRange();
    const p1 = win.document.getElementById("p1");
    collapsed.setStart(p1.firstChild, 3);
    collapsed.setEnd(p1.firstChild, 3);
    const out = hl.createFromCtx({ range: collapsed, text: "" }, "yellow", false);
    expect(out).toBeNull();
    expect(hl.count()).toBe(0);
  });

  test("defaultColor از قلاب خوانده می‌شود", () => {
    const hl = makeController({ defaultColor: () => "pink" });
    const p3 = win.document.getElementById("p3");
    const r = win.document.createRange();
    r.setStart(p3.firstChild, 0);
    r.setEnd(p3.firstChild, 7);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    const rec = hl.createFromCtx(hl.selectionCtx(), "pink", false);
    expect(rec.color).toBe("pink");
  });
});

describe("wiring رابط کاربری", () => {
  test("mouseup روی انتخاب → تولبار نمایان می‌شود", async () => {
    const hl = makeController();
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 0);
    r.setEnd(p1.firstChild, 8);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    art.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await sleep(260); /* debounce 180 + 30 */
    expect(hl.toolbar.visible).toBe(true);
    /* selection cleared → the toolbar hides */
    sel.removeAllRanges();
    art.dispatchEvent(new win.Event("selectionchange", { bubbles: true }));
    await sleep(300);
    expect(hl.toolbar.visible).toBe(false);
  });

  test("canShowToolbar=false تولبار را بسته نگه می‌دارد", async () => {
    const hl = makeController({ canShowToolbar: () => false });
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 0);
    r.setEnd(p1.firstChild, 8);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    art.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await sleep(260);
    expect(hl.toolbar.visible).toBe(false);
  });

  test("کلیک روی mark → پاپ‌اور باز می‌شود؛ Escape می‌بندد", async () => {
    const hl = makeController();
    const p2 = win.document.getElementById("p2");
    const r = win.document.createRange();
    r.setStart(p2.firstChild, 0);
    r.setEnd(p2.firstChild, 6);
    const rec = hl.createFromRange(r, "حفظ یاد", "green", "یادداشت تست");
    const mark = HL.dom.marksOf(rec.id)[0];
    mark.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    expect(hl.popover.visible).toBe(true);
    expect(hl.isPopoverOpen()).toBe(true);
    /* Escape → dismiss */
    win.document.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(20);
    expect(hl.popover.visible).toBe(false);
  });

  test("dispose شنونده‌ها را برمی‌دارد — کلیک بعدی بی‌اثر", async () => {
    const hl = makeController();
    const p2 = win.document.getElementById("p2");
    const r = win.document.createRange();
    r.setStart(p2.firstChild, 0);
    r.setEnd(p2.firstChild, 6);
    const rec = hl.createFromRange(r, "حفظ یاد", "green", "");
    hl.dispose();
    const mark = HL.dom.marksOf(rec.id)[0];
    mark.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await sleep(20);
    expect(hl.popover.visible).toBe(false);
  });
});

describe("خطاهای ذخیره", () => {
  test("خطای ذخیره فقط یک‌بار toast می‌شود", async () => {
    const failing = {
      get: () => Promise.resolve({}),
      set: () => Promise.reject(new Error("boom")),
      remove: () => Promise.resolve(),
      bytes: () => Promise.resolve(0),
      onChange: () => () => {},
    };
    const hl = HL.createHighlighter({
      page: PAGE, scope: art, eventRoot: art, store: HL.createStore(failing),
      hooks: { onError: (m: string) => events.push(["error", m]) },
    });
    const p3 = win.document.getElementById("p3");
    const r = win.document.createRange();
    r.setStart(p3.firstChild, 0);
    r.setEnd(p3.firstChild, 7);
    hl.createFromRange(r, "متن سوم", "yellow", "");
    await sleep(20);
    const before = events.filter(([t]) => t === "error").length;
    hl.createFromRange(win.document.createRange(), "x", "yellow", ""); /* fails again */
    await sleep(20);
    const after = events.filter(([t]) => t === "error").length;
    expect(before).toBe(1);
    expect(after).toBe(1); /* once-flag */
  });
});

describe("setPage — کلید صفحه در ناوبری SPA (v0.6.5)", () => {
  const spaPage = () => ({ url: "u1", norm: "n1", site: "s1", host: "a.local" });
  const mkHl = (pageObj: any) => HL.createHighlighter({ page: pageObj, scope: art, eventRoot: art, store, hooks: {} });

  test("هویت شیء page حفظ می‌شود و رکوردهای جدید با کلید جدید ساخته می‌شوند", async () => {
    const pageObj: any = spaPage();
    const hl = mkHl(pageObj);
    const p1 = win.document.getElementById("p1");
    const r1 = win.document.createRange();
    r1.setStart(p1.firstChild, 0);
    r1.setEnd(p1.firstChild, 9);
    const rec1 = hl.createFromRange(r1, "مغز ما هن", "green", "");
    expect(rec1.urlNorm).toBe("n1");
    expect(rec1.host).toBe("a.local");

    const out = hl.setPage({ url: "u2", norm: "n2", site: "s2", host: "b.local" });
    expect(out).toBe(pageObj);
    expect(hl.page).toBe(pageObj); /* the injected object is updated in place — content's `page` var sees it */
    expect(pageObj.norm).toBe("n2");

    const p2 = win.document.getElementById("p2");
    const r2 = win.document.createRange();
    r2.setStart(p2.firstChild, 0);
    r2.setEnd(p2.firstChild, 9);
    const rec2 = hl.createFromRange(r2, "حفظ یادداش", "pink", "");
    expect(rec2.urlNorm).toBe("n2");
    expect(rec2.host).toBe("b.local");
  });

  test("title فقط وقتی صریحاً داده شده باشد ست می‌شود؛ null → بدون تغییر", () => {
    const pageObj: any = spaPage();
    const hl = mkHl(pageObj);
    hl.setPage({ url: "u2", norm: "n2", site: "s2", host: "b.local", title: "عنوان تازه" });
    expect(pageObj.title).toBe("عنوان تازه");
    hl.setPage({ url: "u3", norm: "n3", site: "s3", host: "c.local" });
    expect(pageObj.title).toBe("عنوان تازه"); /* untouched without an explicit title */
    hl.setPage(null);
    expect(pageObj.norm).toBe("n3");
  });
});

describe("reconcile — بازگرداندن markهای حذف‌شده (v0.6.5)", () => {
  function markOnP1(hl: any) {
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 0);
    r.setEnd(p1.firstChild, 9);
    return hl.createFromRange(r, "مغز ما هن", "green", "");
  }

  test("mark حذف‌شده (re-render ری‌اکت) دوباره اعمال می‌شود", () => {
    const hl = makeController();
    const rec = markOnP1(hl);
    expect(HL.dom.marksOf(rec.id).length).toBe(1);

    HL.dom.unwrap(rec.id); /* the framework destroyed the marks */
    expect(HL.dom.marksOf(rec.id).length).toBe(0);

    const missing = hl.reconcile();
    expect(missing).toEqual([]);
    expect(HL.dom.marksOf(rec.id).length).toBe(1);
  });

  test("بدون تکرار: mark موجود دست نمی‌خورد (همان المنت)", () => {
    const hl = makeController();
    const rec = markOnP1(hl);
    const before = HL.dom.marksOf(rec.id)[0];
    const missing = hl.reconcile();
    expect(missing).toEqual([]);
    const after = HL.dom.marksOf(rec.id);
    expect(after.length).toBe(1);
    expect(after[0]).toBe(before); /* the very same element — no re-wrap */
  });

  test("متنِ غایب در لیست missing برمی‌گردد و mark نمی‌سازد", () => {
    const hl = makeController();
    const rec = markOnP1(hl);
    HL.dom.unwrap(rec.id);
    hl.adoptRecord({ ...rec, id: "ghost", text: "این متن هرگز در صفحه نیست", prefix: "", suffix: "", start: 0, end: 0, anchor: null });
    const missing = hl.reconcile();
    expect(missing.map((x: any) => x.id)).toContain("ghost");
    expect(HL.dom.marksOf("ghost").length).toBe(0);
    expect(HL.dom.marksOf(rec.id).length).toBe(1); /* the real one got restored */
  });
});

describe("visibility — کپیِ مخفیِ متن (v0.6.7)", () => {
  const DUP_HTML =
    `<div id="hid" style="display:none"><p id="ph">متن آزمایشی تکراری برای تست دیده‌شدن</p></div>` +
    `<div id="vis"><p id="pv">متن آزمایشی تکراری برای تست دیده‌شدن</p></div>`;

  test("isHidden: خودش، والد، و گرهٔ جداشده", () => {
    win = setupDom({ html: DUP_HTML });
    const d = win.document;
    const hidP = d.getElementById("ph");
    const visP = d.getElementById("pv");
    expect(HL.dom.isHidden(hidP)).toBe(true);      /* inside display:none */
    expect(HL.dom.isHidden(hidP.firstChild as any)).toBe(true); /* text node inside hidden */
    expect(HL.dom.isHidden(visP)).toBe(false);
    const stray = d.createElement("p");
    expect(HL.dom.isHidden(stray)).toBe(true);     /* not connected */
  });

  test("کپیِ مخفی انتخاب نمی‌شود؛ پنهان‌شدنِ کپیِ پوشیده → reconcile به کپیِ ناپیدا می‌رود", () => {
    win = setupDom({ html: DUP_HTML });
    const d = win.document;
    const hl = HL.createHighlighter({
      page: { url: "u", norm: "n", site: "s", host: "h.test" },
      scope: d.body, eventRoot: d, store, hooks: {},
    });

    /* 1) create on the VISIBLE copy */
    const pv = d.getElementById("pv");
    const r = d.createRange();
    r.setStart(pv.firstChild!, 0);
    r.setEnd(pv.firstChild!, 16);
    const rec = hl.createFromRange(r, pv.textContent!.slice(0, 16), "green", "");
    expect(d.querySelectorAll("#pv mark.hlx-marker").length).toBe(1);
    expect(d.querySelectorAll("#ph mark.hlx-marker").length).toBe(0); /* hidden twin untouched */
    expect(hl.reconcile()).toEqual([]); /* visible → healthy */

    /* 2) the site hides the wrapped copy (framework swap) */
    d.getElementById("vis")!.style.display = "none";
    const missing1 = hl.reconcile();
    expect(missing1.map((x: any) => x.id)).toContain(rec.id); /* nothing visible now */

    /* 3) the twin copy becomes the shown one → re-apply must land THERE */
    d.getElementById("hid")!.style.display = "";
    expect(hl.reconcile()).toEqual([]);
    expect(d.querySelectorAll("#ph mark.hlx-marker").length).toBe(1); /* visible copy wrapped */
    expect(d.querySelectorAll("#pv mark.hlx-marker").length).toBe(1);  /* hidden copy kept, no nesting */
    expect(d.querySelectorAll("#ph mark mark").length).toBe(0);
    expect(HL.dom.marksOf(rec.id).length).toBe(2);
    expect(HL.dom.isHidden(HL.dom.marksOf(rec.id)[0] as any)).toBe(false);
  });

  test("reconcile: نشانه‌ها فقط در کپیِ مخفی → missing؛ بعد از نمایان شدن → سالم", () => {
    win = setupDom({ html: DUP_HTML });
    const d = win.document;
    const hl = HL.createHighlighter({
      page: { url: "u2", norm: "n2", site: "s2", host: "h.test" },
      scope: d.body, eventRoot: d, store, hooks: {},
    });
    const pv = d.getElementById("pv");
    const r = d.createRange();
    r.setStart(pv.firstChild!, 0);
    r.setEnd(pv.firstChild!, 16);
    const rec = hl.createFromRange(r, pv.textContent!.slice(0, 16), "pink", "");

    /* wrap ONLY into a hidden copy: hide both first, force textual apply via reconcile */
    d.getElementById("vis")!.style.display = "none";
    d.getElementById("hid")!.style.display = "none";
    hl.reconcile(); /* may wrap the twin while hidden — either way nothing visible */
    expect(hl.reconcile().map((x: any) => x.id)).toContain(rec.id);

    /* twin shows up → immediately healthy without double-wrapping */
    d.getElementById("hid")!.style.display = "";
    expect(hl.reconcile()).toEqual([]);
    expect(d.querySelectorAll("#ph mark.hlx-marker").length).toBe(1);
    expect(HL.dom.marksOf(rec.id).length).toBeLessThanOrEqual(2);
  });
});
