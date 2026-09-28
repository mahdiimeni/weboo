/**
 * Tests for HL.anchor — anchor resolution strategies (Phase 3 extraction)
 *
 * The textual suite is a VERBATIM port of textindex.test's findRange block
 * (the algorithm moved, the spec did not); plus structural coverage and the
 * OCP acceptance test (append a resolver without touching orchestration).
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

/* Same fixture as textindex.test (no inter-tag whitespace → deterministic offsets) */
const HTML = `<article id="art"><p id="p1">متنی که برای تست انکُرینگ نوشته شده است</p><p id="p2">پاراگراف دوم برای پوشش چند chunk جدا</p><div id="mix"><span>بلاک</span> میانی <b>پررنگ</b> و ادامه متن</div><script>var ignored = 1;</script></article>`;

let HL: any;
let win: any;
let art: any;

beforeAll(() => {
  win = setupDom({ html: HTML });
  HL = loadEngine({});
  art = win.document.getElementById("art");
});

describe("HL.anchor.resolve — textual strategies", () => {
  test("مسیر دقیق (exact) با متن یکتا", () => {
    const ti = HL.text.build(art);
    const f = HL.anchor.resolve(ti, { text: "پاراگراف دوم" });
    expect(f).not.toBeNull();
    expect(f.method).toBe("exact"); /* no stored offset → exact search */
    expect(f.range.toString()).toBe("پاراگراف دوم");
  });

  test("prefix/suffix رفع ابهام تکرار می‌کند", () => {
    const ti = HL.text.build(art);
    const quote = "متن"; /* repeated in «متن …» and «… ادامه متن» */
    const f = HL.anchor.resolve(ti, {
      text: quote,
      prefix: "ادامه",   /* must pick «و ادامه متن» */
    });
    expect(f).not.toBeNull();
    expect(f.range.toString()).toBe("متن");
    const idx = ti.text.indexOf("ادامه متن");
    expect(f.start).toBeGreaterThanOrEqual(idx);
  });

  test("مسیر نرمال‌شده وقتی whitespace صفحه عوض شده", () => {
    /* a "fresh" page with different whitespace (inter-tag space needed for the word boundary) */
    win.document.body.innerHTML = `<article id="art"><p id="p1">متنی که برای تست انکُرینگ نوشته شده است</p> <p id="p2">پاراگراف  دوم\tبرای  پوشش چند  chunk جدا</p><div id="mix"><span>بلاک</span> میانی <b>پررنگ</b> و ادامه متن</div><script>var ignored = 1;</script></article>`;
    const art2 = win.document.getElementById("art");
    const ti = HL.text.build(art2);
    const f = HL.anchor.resolve(ti, { text: "پاراگراف دوم برای پوشش چند chunk جدا" });
    expect(f).not.toBeNull();
    expect(HL.text.squash(f.range.toString())).toBe(HL.text.squash("پاراگراف دوم برای پوشش چند chunk جدا"));
    win.document.body.innerHTML = HTML; /* restore */
    art = win.document.getElementById("art");
  });

  test("نبود متن → null؛ نقل‌قول خالی → null", () => {
    const ti = HL.text.build(art);
    expect(HL.anchor.resolve(ti, { text: "این متن در صفحه نیست" })).toBeNull();
    expect(HL.anchor.resolve(ti, { text: "   " })).toBeNull();
    expect(HL.anchor.resolve(null, { text: "x" })).toBeNull();
  });

  test("آفست ذخیره‌شده کهنه — بازیابی با جست‌وجو", () => {
    const ti = HL.text.build(art);
    const f = HL.anchor.resolve(ti, { text: "پررنگ", start: 0 });
    expect(f).not.toBeNull();
    expect(f.range.toString()).toBe("پررنگ");
  });
});

describe("HL.anchor.resolveStructural — strategy 1 (XPath)", () => {
  test("serialize → structural round-trip", () => {
    const p = win.document.getElementById("p1");
    const tn = p.firstChild;
    const r = win.document.createRange();
    r.setStart(tn, 0);
    r.setEnd(tn, 8);
    const want = r.toString();
    const anchor = HL.dom.serializeRange(r);
    const range = HL.anchor.resolveStructural({ anchor, text: want });
    expect(range).not.toBeNull();
    expect(range.toString()).toBe(want);
  });

  test("landing in a hidden duplicate → null (textual fallback takes over)", () => {
    const p = win.document.getElementById("p1");
    const tn = p.firstChild;
    const r = win.document.createRange();
    r.setStart(tn, 0);
    r.setEnd(tn, 8);
    const anchor = HL.dom.serializeRange(r);
    const want = r.toString();
    p.style.display = "none";
    expect(HL.anchor.resolveStructural({ anchor, text: want })).toBeNull();
    p.style.display = "";
    expect(HL.anchor.resolveStructural({ anchor, text: want })).not.toBeNull(); /* restored */
  });
});

describe("OCP — resolvers are data", () => {
  test("appending a resolver is consulted without touching orchestration", () => {
    const ti = HL.text.build(art);
    const quote = "این متن در صفحه نیست"; /* no built-in source can resolve this */
    expect(HL.anchor.resolve(ti, { text: quote })).toBeNull(); /* baseline */

    const fake = {
      name: "fake",
      collect: () => [{ start: 0, end: 4, method: "exact", bonus: 9999 }],
    };
    HL.anchor.resolvers.push(fake);
    try {
      const f = HL.anchor.resolve(ti, { text: quote });
      expect(f).not.toBeNull(); /* the composite read the extended list */
      expect(f.score).toBeGreaterThan(9000);
      expect(f.range.toString()).toBe(ti.text.slice(0, 4));
    } finally {
      HL.anchor.resolvers.pop(); /* restore default three */
    }
    expect(HL.anchor.resolve(ti, { text: quote })).toBeNull(); /* and back */
  });
});
