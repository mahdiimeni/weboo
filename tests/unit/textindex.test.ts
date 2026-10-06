/**
 * Tests for HL.text — the text anchoring engine
 * includes the v1.0.4 bug regression (element-edge Range boundaries on double-click)
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

/* Single-line HTML: the index engine also counts inter-tag whitespace nodes as document
   text (real engine behavior) — for deterministic offsets we use HTML without inter-tag whitespace */
const HTML = `<article id="art"><p id="p1">متنی که برای تست انکُرینگ نوشته شده است</p><p id="p2">پاراگراف دوم برای پوشش چند chunk جدا</p><div id="mix"><span>بلاک</span> میانی <b>پررنگ</b> و ادامه متن</div><script>var ignored = 1;</script></article>`;

let HL: any;
let win: any;
let art: any;

beforeAll(async () => {
  win = setupDom({ html: HTML });
  HL = await loadEngine({});
  art = win.document.getElementById("art");
});

describe("HL.text.build", () => {
  test("ایندکس روی گره‌های متنیِ مقصد (بدون script)", () => {
    const ti = HL.text.build(art);
    expect(ti.chunks.length).toBe(6); /* p1 + p2 + span + middle text + b + trailing text */
    expect(ti.text).toContain("متنی که برای تست");
    expect(ti.text).toContain("پاراگراف دوم");
    expect(ti.text).not.toContain("ignored");
    expect(ti.text.startsWith("متنی که")).toBe(true);
  });

  test("root تهی → ایندکس خالی بدون خطا", () => {
    const ti = HL.text.build(null);
    expect(ti.length).toBe(0);
    expect(ti.offsetsOfRange({} as any)).toBeNull();
  });
});

describe("offsetOf / offsetsOfRange / locate", () => {
  test("رفت و برگشت آفست", () => {
    const ti = HL.text.build(art);
    const p1 = win.document.getElementById("p1").firstChild;
    const offs = ti.offsetsOfRange({
      startContainer: p1, startOffset: 2, endContainer: p1, endOffset: 6,
    } as any);
    expect(offs).toEqual({ start: 2, end: 6 });
    expect(ti.text.slice(2, 6)).toBe("نی ک"); /* م ت [ن ی ␣ ک] ه … */
    const back = ti.locate(2);
    expect(back.node).toBe(p1);
    expect(back.offset).toBe(2);
  });

  test("گره خارج از ایندکس → -1/null", () => {
    const ti = HL.text.build(art);
    const outside = win.document.createElement("p");
    outside.textContent = "بیرونی";
    win.document.body.appendChild(outside);
    expect(ti.offsetOf(outside.firstChild, 0)).toBe(-1);
    expect(ti.offsetsOfRange({ startContainer: outside.firstChild, startOffset: 0, endContainer: outside.firstChild, endOffset: 2 } as any)).toBeNull();
    outside.remove();
  });
});

describe("normInfo / squash", () => {
  test("فشرده‌سازی فاصله‌ها با نگاشت اندیس", () => {
    const r = HL.text.normInfo("  a   b  c ");
    expect(r.norm).toBe("a b c");
    expect(r.map.length).toBe(r.norm.length);
    expect(r.map[0]).toBe(2); /* first non-whitespace character */
  });

  test("squash — NBSP و تب و خط تازه", () => {
    expect(HL.text.squash("a\u00a0\u200b \t b\n c")).toBe("a b c");
    expect(HL.text.squash(null)).toBe("");
  });
});

describe("normalizeRange — رگرسیون v1.0.4", () => {
  test("مرز پایان عنصری (دابل‌کلیک آخر کلمه + نقطه) به گره متنی تبدیل می‌شود", () => {
    const p1 = win.document.getElementById("p1");
    /* a browser selection reaching the block's end: end on the <p> itself */
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 0);
    r.setEnd(p1, p1.childNodes.length);
    const out = HL.text.normalizeRange(r);
    expect(out.endContainer.nodeType).toBe(3);
    expect(out.endOffset).toBe(p1.firstChild.data.length);
    expect(out.toString()).toBe(p1.textContent);
  });

  test("مرز شروع عنصری (انتخاب از ابتدای بلاک)", () => {
    const p2 = win.document.getElementById("p2");
    const r = win.document.createRange();
    r.setStart(p2, 0);
    r.setEnd(p2.firstChild, 3);
    const out = HL.text.normalizeRange(r);
    expect(out.startContainer.nodeType).toBe(3);
    expect(out.startOffset).toBe(0);
  });

  test("مرز عنصری چند سطحی بالا می‌رود (بدون متن در بلاک)", () => {
    const mix = win.document.getElementById("mix");
    const r = win.document.createRange();
    r.setStart(mix, 1); /* after the span */
    r.setEnd(mix, 2);   /* before the middle text */
    const out = HL.text.normalizeRange(r);
    expect(out.startContainer.nodeType).toBe(3);
    expect(out.endContainer.nodeType).toBe(3);
  });
});


/* HL.text.findRange moved to anchor.test.ts (Phase 3 extraction) — the
   resolution algorithm now lives in HL.anchor, tested there verbatim. */
