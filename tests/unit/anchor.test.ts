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

beforeAll(async () => {
  win = setupDom({ html: HTML });
  HL = await loadEngine({});
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

describe("confidence policy (hardening phase — MIN_CONFIDENCE derived from the scorer's 5/6.5 seam)", () => {
  /* the same duplicate fixture idea as highlighter.test's visibility block:
     two identical copies, one hidden — the twin-retarget contract's territory */
  const DUP_HTML =
    `<div id="hid" style="display:none"><p id="ph">متن آزمایشی تکراری برای تست دیده‌شدن</p></div>` +
    `<div id="vis"><p id="pv">متن آزمایشی تکراری برای تست دیده‌شدن</p></div>`;

  test("strong match: the saved offsets still hold the exact text → offsets wins (score 9 ≥ floor)", () => {
    const ti = HL.text.build(art);
    const start = ti.text.indexOf("پاراگراف دوم");
    const f = HL.anchor.resolve(ti, { text: "پاراگراف دوم", start: start, prefix: "است", suffix: "برای" });
    expect(f).not.toBeNull();
    expect(f.method).toBe("offsets"); /* the saved position verified — strongest signal */
  });

  test("worst visible case: stale offsets far away + zero context → 6.5, still ≥ floor (accepted)", () => {
    const ti = HL.text.build(art);
    const quote = "پاراگراف دوم"; /* unique in the doc, but rec.start points somewhere far */
    const f = HL.anchor.resolve(ti, { text: quote, start: 0 });
    expect(f).not.toBeNull(); /* 8 visible − 1.5 proximity = 6.5 — the seam's floor case */
    expect(f.method).toBe("exact");
  });

  test("ambiguous match: two visible copies, no distinguishing context → deterministic earliest-visible (the twin-invariant evidence floor)", () => {
    win = setupDom({ html: DUP_HTML });
    const ti = HL.text.build(win.document.body);
    const f = HL.anchor.resolve(ti, { text: "متن آزمایشی تکراری" });
    expect(f).not.toBeNull(); /* visibility alone IS evidence — orphaning here would break twin-retarget */
    expect(f.score).toBeGreaterThanOrEqual(5.5);
    expect(f.range.toString()).toBe("متن آزمایشی تکراری");
    /* the fixture's FIRST copy is the hidden div; the VISIBLE one wins the
       score (8 vs 0) — deterministic visibility-first, reproducible */
    const hiddenIdx = ti.text.indexOf("متن آزمایشی تکراری");
    const visibleIdx = ti.text.indexOf("متن آزمایشی تکراری", hiddenIdx + 1);
    expect(f.start).toBe(visibleIdx);
  });

  test("context mismatch: saved prefix no longer matches either copy → still the visible copy (no evidence lost)", () => {
    win = setupDom({ html: DUP_HTML });
    const ti = HL.text.build(win.document.body);
    const f = HL.anchor.resolve(ti, { text: "متن آزمایشی تکراری", prefix: "زمینه‌ای که دیگر وجود ندارد" });
    expect(f).not.toBeNull(); /* prefix miss costs 2, not confidence */
    expect(f.method).toBe("exact"); /* exact hit (score 8) skips the norm scan (maxBestBefore 4) */
  });

  test("candidate below confidence: the ONLY occurrence is hidden → orphan (no DOM wrap the invariant would reject)", () => {
    win = setupDom({ html: `<div style="display:none"><p id="hp">متن پنهان برای آزمون توقوف</p></div>` });
    const ti = HL.text.build(win.document.body);
    const f = HL.anchor.resolve(ti, { text: "متن پنهان برای آزمون توقوف" });
    expect(f).toBeNull(); /* hidden max = 5 < 5.5 — the resolver orphans directly */
  });

  test("candidate below confidence: multiple candidates, ALL hidden → orphan (never best-available)", () => {
    win = setupDom({ html: `<div style="display:none"><p>متن آزمایشی تکراری الف</p><p>متن آزمایشی تکراری ب</p></div>` });
    const ti = HL.text.build(win.document.body);
    const f = HL.anchor.resolve(ti, { text: "متن آزمایشی تکراری" });
    expect(f).toBeNull();
  });

  test("correct orphan behavior end-to-end: changed page without the quote → null (nothing to score)", () => {
    const ti = HL.text.build(art);
    expect(HL.anchor.resolve(ti, { text: "متنی که دیگر وجود ندارد در صفحه" })).toBeNull();
  });
});
