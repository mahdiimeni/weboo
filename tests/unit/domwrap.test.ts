/**
 * HL.dom tests — wrap/unwrap/anchor/marks
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

const HTML = `
<div id="art">
  <p id="p1">سلام دنیای تست الگوریتم هایلایت</p>
  <p id="p2">پاراگراف دوم با محتوای متفاوت</p>
  <div id="mix"><span id="sp">متن اسپن</span> متن میانی <b id="b">پررنگ</b> و ادامه</div>
</div>`;

let HL: any;
let win: any;

beforeEach(async () => {
  win = setupDom({ html: HTML });
  HL = await loadEngine({});
});

describe("markRange / unwrap", () => {
  test("wrap بخشی از یک گره متنی با splitText", () => {
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 2);
    r.setEnd(p1.firstChild, 8);
    const marks = HL.dom.markRange(r, "id1", "green");
    expect(marks.length).toBe(1);
    expect(marks[0].tagName).toBe("MARK");
    expect(marks[0].className).toBe("hlx-marker");
    expect(marks[0].getAttribute("data-hl-id")).toBe("id1");
    expect(marks[0].getAttribute("data-hl-color")).toBe("green");
    expect(marks[0].textContent).toBe("ام دنی"); /* س ل [ا م ␣ د ن ی] ا — indices 2 to 8 */
    /* the block's full text stays intact */
    expect(p1.textContent).toBe("سلام دنیای تست الگوریتم هایلایت");
  });

  test("wrap روی چند گره متنی → چند mark با یک id", () => {
    const mix = win.document.getElementById("mix");
    const r = win.document.createRange();
    r.setStart(win.document.getElementById("sp").firstChild, 2);
    r.setEnd(win.document.getElementById("b").firstChild, 3);
    const marks = HL.dom.markRange(r, "id2", "teal");
    expect(marks.length).toBeGreaterThanOrEqual(3);
    marks.forEach((m: any) => {
      expect(m.getAttribute("data-hl-id")).toBe("id2");
    });
    expect(mix.textContent).toBe("متن اسپن متن میانی پررنگ و ادامه");
  });

  test("unwrap متن را دقیقاً بازمی‌گرداند", () => {
    const mix = win.document.getElementById("mix");
    const before = mix.textContent;
    const r = win.document.createRange();
    r.setStart(win.document.getElementById("sp").firstChild, 0);
    r.setEnd(win.document.getElementById("b").firstChild, 3);
    HL.dom.markRange(r, "id3", "pink");
    expect(HL.dom.unwrap("id3")).toBeGreaterThanOrEqual(3);
    expect(mix.textContent).toBe(before);
    expect(HL.dom.marksOf("id3").length).toBe(0);
  });

  test("range تهی/تاشده → بدون mark", () => {
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 3);
    r.setEnd(p1.firstChild, 3); /* collapsed */
    expect(HL.dom.markRange(r, "id4", "yellow").length).toBe(0);
    expect(HL.dom.markRange(null, "id5", "yellow").length).toBe(0);
  });
});

describe("marksOf / setColor / setNoted / flash", () => {
  test("یافتن با شناسه‌ی خاص و تغییر رنگ", () => {
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 0);
    r.setEnd(p1.firstChild, 5);
    HL.dom.markRange(r, "weird id &1", "yellow");
    const marks = HL.dom.marksOf("weird id &1");
    expect(marks.length).toBe(1);
    HL.dom.setColor("weird id &1", "purple");
    expect(marks[0].getAttribute("data-hl-color")).toBe("purple");
  });

  test("setNoted خط زیرین را فقط برای یادداشت‌دار روشن می‌کند", () => {
    const p2 = win.document.getElementById("p2");
    const r = win.document.createRange();
    r.setStart(p2.firstChild, 0);
    r.setEnd(p2.firstChild, 4);
    HL.dom.markRange(r, "n1", "green");
    HL.dom.setNoted("n1", true);
    expect(HL.dom.marksOf("n1")[0].getAttribute("data-hl-noted")).toBe("1");
    HL.dom.setNoted("n1", false);
    expect(HL.dom.marksOf("n1")[0].hasAttribute("data-hl-noted")).toBe(false);
  });

  test("flash کلاس انیمیشن می‌گذارد و برمی‌دارد", async () => {
    const p2 = win.document.getElementById("p2");
    const r = win.document.createRange();
    r.setStart(p2.firstChild, 0);
    r.setEnd(p2.firstChild, 4);
    HL.dom.markRange(r, "f1", "teal");
    HL.dom.flash("f1");
    expect(HL.dom.marksOf("f1")[0].classList.contains("hlx-flash")).toBe(true);
    await new Promise((res) => setTimeout(res, 2100));
    expect(HL.dom.marksOf("f1")[0].classList.contains("hlx-flash")).toBe(false);
  });
});

describe("serializeRange / resolveAnchor", () => {
  test("رفت و برگشت XPath روی صفحه‌ی دست‌نخورده", () => {
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 2);
    r.setEnd(p1.firstChild, 7);
    const anchor = HL.dom.serializeRange(r);
    expect(anchor.start).toBe("div[1]/p[1]/text()[1]");
    const back = HL.dom.resolveAnchor(anchor, "ام دن");
    expect(back).not.toBeNull();
    expect(back.toString()).toBe("ام دن");
  });

  test("expectText ناهمخوان (صفحه عوض شده) → null", () => {
    const p1 = win.document.getElementById("p1");
    const r = win.document.createRange();
    r.setStart(p1.firstChild, 2);
    r.setEnd(p1.firstChild, 7);
    const anchor = HL.dom.serializeRange(r);
    expect(HL.dom.resolveAnchor(anchor, "متن کاملاً متفاوت دیگر")).toBeNull();
  });

  test("انکُر ناقص → null", () => {
    expect(HL.dom.resolveAnchor(null, "x")).toBeNull();
    expect(HL.dom.resolveAnchor({ start: "", startOffset: 0, end: "", endOffset: 0 }, "x")).toBeNull();
  });

  test("بعد از wrap، XPath متنِ تازه سازگار می‌ماند (بازگشتی)", () => {
    const p2 = win.document.getElementById("p2");
    const r = win.document.createRange();
    r.setStart(p2.firstChild, 0);
    r.setEnd(p2.firstChild, 8);
    const anchor = HL.dom.serializeRange(r);
    HL.dom.markRange(r, "x1", "green");
    /* after splitText, old offsets may shift; resolveAnchor
       must either resolve exactly or return null (the text path then finishes the job) */
    const back = HL.dom.resolveAnchor(anchor, p2.textContent.slice(0, 8));
    expect(back === null || HL.text.squash(back.toString()).startsWith("پاراگر")).toBe(true);
  });
});

describe("acceptTextNode", () => {
  test("script/style/contenteditable/ui رد می‌شوند", () => {
    const doc = win.document;
    const script = doc.createElement("script");
    script.textContent = "x";
    expect(HL.text.acceptTextNode(script.firstChild)).toBe(2);
    const ce = doc.createElement("div");
    ce.setAttribute("contenteditable", "true");
    ce.textContent = "y";
    expect(HL.text.acceptTextNode(ce.firstChild)).toBe(2);
    const ui = doc.createElement("div");
    ui.setAttribute("data-hlx-ui", "1");
    ui.textContent = "z";
    expect(HL.text.acceptTextNode(ui.firstChild)).toBe(2);
    const ok = doc.createElement("p");
    ok.textContent = "ok";
    expect(HL.text.acceptTextNode(ok.firstChild)).toBe(1);
  });
});
