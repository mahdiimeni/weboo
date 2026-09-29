/**
 * Tests for HL.ui.NotePopover — window dragging and the position lifecycle
 * (sister of the wiring tests in highlighter.test.ts — here only the widget itself)
 * + note-box action states (v0.5.1 — the centered «افزودن یادداشت» pill and the
 * icon-only «ویرایش یادداشت» button; contrast/palette contract in uitheme.test.ts)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;
let win: any;

beforeEach(async () => {
  win = setupDom();
  HL = await loadEngine({});
});

function makePopover(events: any = {}) {
  return new HL.ui.NotePopover({
    onColorChange: events.onColorChange || (() => {}),
    onSaveNote: events.onSaveNote || (() => {}),
    onDelete: events.onDelete || (() => {}),
    onCopy: events.onCopy || (() => {}),
    onClose: events.onClose || (() => {}),
  });
}

/* logical rect (happy-dom returns zero rects) — position uses data.rect */
const RECT = { top: 100, left: 100, right: 300, bottom: 124, width: 200, height: 24 };

/** present with overridable fields (v1.2.10 direction tests need custom quote/note) */
function present(po: any, id = "x1", over: Record<string, any> = {}) {
  po.present({
    id,
    rect: { ...RECT },
    color: "yellow",
    note: "",
    quote: "متن هایلایت",
    createdAt: 1700000000000,
    ...over,
  });
}

const head = (po: any) => po.el.querySelector(".head");
const grip = (po: any) => po.el.querySelector(".grip");

/** full drag: down/move/up on the given element */
function dragFrom(el: any, from: { x: number; y: number }, to: { x: number; y: number }) {
  el.dispatchEvent(new win.PointerEvent("pointerdown", { clientX: from.x, clientY: from.y, pointerId: 7, bubbles: true }));
  el.dispatchEvent(new win.PointerEvent("pointermove", { clientX: to.x, clientY: to.y, pointerId: 7, bubbles: true }));
  el.dispatchEvent(new win.PointerEvent("pointerup", { pointerId: 7, bubbles: true }));
}

describe("NotePopover — جهت هوشمند محتوا (v1.2.10)", () => {
  test("نقل‌قول فارسی → .q بدون dir (پیش‌فرض RTL — رگرسیون)", () => {
    const po = makePopover();
    present(po);
    expect(po.el.querySelector(".q").getAttribute("dir")).toBe(null);
  });

  test("نقل‌قول انگلیسی → .q با dir=ltr", () => {
    const po = makePopover();
    present(po, "x2", { quote: "The quick brown fox jumps over the lazy dog" });
    expect(po.el.querySelector(".q").getAttribute("dir")).toBe("ltr");
  });

  test("متن خنثی (فقط رقم) → بدون dir", () => {
    const po = makePopover();
    present(po, "x3", { quote: "12345 67890" });
    expect(po.el.querySelector(".q").getAttribute("dir")).toBe(null);
  });

  test("قاب فارسی هرگز برنمی‌گردد — ریشه dir=rtl می‌ماند", () => {
    const po = makePopover();
    present(po, "x4", { quote: "English LTR quote" });
    expect(po.el.getAttribute("dir")).toBe("rtl"); /* Persian UI chrome never flips */
  });

  test("یادداشت انگلیسی → ویرایشگر با dir=ltr باز می‌شود", () => {
    const po = makePopover();
    present(po, "x5", { note: "An existing English note", editNow: true });
    expect(po.el.querySelector('[data-role="note-input"]').getAttribute("dir")).toBe("ltr");
  });

  test("یادداشت خالی یا فارسی → ویرایشگر بدون dir (تایپ راست‌به‌چپ)", () => {
    const po = makePopover();
    present(po, "x6", { editNow: true });
    expect(po.el.querySelector('[data-role="note-input"]').getAttribute("dir")).toBe(null);
    const po2 = makePopover();
    present(po2, "x7", { note: "یادداشت فارسی", editNow: true });
    expect(po2.el.querySelector('[data-role="note-input"]').getAttribute("dir")).toBe(null);
  });

  test("تایپ زنده: جهت ویرایشگر با هر کلید دوباره تصمیم می‌گیرد", () => {
    const po = makePopover();
    present(po, "x8", { editNow: true });
    const ta = po.el.querySelector('[data-role="note-input"]');
    ta.value = "Hello"; /* first English keystrokes */
    ta.dispatchEvent(new win.Event("input", { bubbles: true }));
    expect(ta.getAttribute("dir")).toBe("ltr");
    ta.value = "سلام دنیا"; /* Persian letters now dominate */
    ta.dispatchEvent(new win.Event("input", { bubbles: true }));
    expect(ta.getAttribute("dir")).toBe(null);
    ta.value = "English again"; /* flips back */
    ta.dispatchEvent(new win.Event("input", { bubbles: true }));
    expect(ta.getAttribute("dir")).toBe("ltr");
    ta.value = ""; /* emptied → RTL default */
    ta.dispatchEvent(new win.Event("input", { bubbles: true }));
    expect(ta.getAttribute("dir")).toBe(null);
  });

  test("ذخیره یادداشت تایپ‌شده → مقدار دقیق به onSaveNote می‌رسد", () => {
    const saved: string[] = [];
    const po = makePopover({ onSaveNote: (_id: any, val: string) => saved.push(val) });
    present(po, "x9", { editNow: true });
    const ta = po.el.querySelector('[data-role="note-input"]');
    ta.value = "Typed English note";
    po.el.querySelector('[data-act="save"]').dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(saved).toEqual(["Typed English note"]);
    expect(po.mode).toBe("view");
  });

  test("سناریوی باگ: ذخیره‌ی یادداشت انگلیسی → نمایش ذخیره‌شده dir=ltr (v1.2.11)", () => {
    const po = makePopover();
    present(po, "x10", { editNow: true });
    const ta = po.el.querySelector('[data-role="note-input"]');
    ta.value = "Saved English note";
    ta.dispatchEvent(new win.Event("input", { bubbles: true }));
    po.el.querySelector('[data-act="save"]').dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    const shown = po.el.querySelector(".note-text");
    expect(shown.textContent).toBe("Saved English note");
    expect(shown.getAttribute("dir")).toBe("ltr");
  });

  test("یادداشت انگلیسی در حالت نمایش (بدون ویرایش) → .note-text با dir=ltr (v1.2.11)", () => {
    const po = makePopover();
    present(po, "x11", { note: "An English note shown in view mode" });
    expect(po.el.querySelector(".note-text").getAttribute("dir")).toBe("ltr");
  });

  test("یادداشت فارسی ذخیره‌شده → .note-text بدون dir (رگرسیون RTL) (v1.2.11)", () => {
    const po = makePopover();
    present(po, "x12", { note: "یادداشت فارسی ذخیره‌شده" });
    expect(po.el.querySelector(".note-text").getAttribute("dir")).toBe(null);
  });

  test("یادداشت خنثی (فقط رقم) → .note-text بدون dir (v1.2.11)", () => {
    const po = makePopover();
    present(po, "x13", { note: "12345" });
    expect(po.el.querySelector(".note-text").getAttribute("dir")).toBe(null);
  });
});

describe("NotePopover — جابجایی (drag)", () => {
  test("لنگر اولیه: موقعیت از rect محاسبه می‌شود؛ userPos خاموش است", () => {
    const po = makePopover();
    present(po);
    expect(po.visible).toBe(true);
    expect(po.el.style.top).toBe("134px"); /* rect.bottom + 10 */
    expect(po.el.style.left).toBe("200px"); /* rect.left + width/2 − w/2 */
    expect(po.userPos).toBe(null);
  });

  test("درگ واقعی از دستگیره → جابجایی دقیقاً به اندازه‌ی دلتا + userPos", () => {
    const po = makePopover();
    present(po);
    dragFrom(grip(po), { x: 200, y: 140 }, { x: 260, y: 180 }); /* dx=60, dy=40 */
    expect(po.el.style.left).toBe("260px");
    expect(po.el.style.top).toBe("174px");
    expect(po.userPos).toEqual({ left: 260, top: 174 });
    expect(po.el.classList.contains("dragging")).toBe(false); /* after release */
  });

  test("کلاس dragging فقط حین درگ برقرار است", () => {
    const po = makePopover();
    present(po);
    const g = grip(po);
    g.dispatchEvent(new win.PointerEvent("pointerdown", { clientX: 200, clientY: 140, pointerId: 7, bubbles: true }));
    expect(po.el.classList.contains("dragging")).toBe(true);
    g.dispatchEvent(new win.PointerEvent("pointermove", { clientX: 240, clientY: 160, pointerId: 7, bubbles: true }));
    expect(po.el.classList.contains("dragging")).toBe(true);
    g.dispatchEvent(new win.PointerEvent("pointerup", { pointerId: 7, bubbles: true }));
    expect(po.el.classList.contains("dragging")).toBe(false);
  });

  test("گارد: pointerdown روی دکمه‌ها درگ را شروع نمی‌کند", () => {
    const po = makePopover();
    present(po);
    const closeBtn = po.el.querySelector('[data-act="close"]');
    dragFrom(closeBtn, { x: 200, y: 140 }, { x: 320, y: 220 });
    expect(po.el.style.left).toBe("200px"); /* did not move */
    expect(po.userPos).toBe(null);
    expect(po.visible).toBe(true); /* buttons work via click only, not pointerdown */
  });

  test("مهار در viewport: درگ دور از کران‌ها به حاشیه‌ی ۸pxی می‌رسد", () => {
    const po = makePopover();
    present(po);
    dragFrom(grip(po), { x: 200, y: 140 }, { x: 2200, y: 2100 });
    expect(po.el.style.left).toBe("1016px"); /* vw(1024) − w(0) − 8 */
    expect(po.el.style.top).toBe("760px"); /* vh(768) − h(0) − 8 */
  });

  test("بعد از درگ، scroll/resize دیگر به mark برنمی‌گردد (فقط مهار)", () => {
    const po = makePopover();
    present(po);
    dragFrom(grip(po), { x: 200, y: 140 }, { x: 260, y: 180 });
    win.dispatchEvent(new win.Event("scroll"));
    expect(po.el.style.left).toBe("260px"); /* not 200px */
    win.dispatchEvent(new win.Event("resize"));
    expect(po.el.style.left).toBe("260px");
    expect(po.el.style.top).toBe("174px");
  });

  test("render(mode) جای جابجاشده را حفظ می‌کند و delegation زنده می‌ماند", () => {
    const po = makePopover();
    present(po);
    dragFrom(grip(po), { x: 200, y: 140 }, { x: 260, y: 180 });
    po.render("edit"); /* innerHTML rebuilt — fresh header */
    expect(po.el.style.left).toBe("260px");
    expect(po.el.style.top).toBe("174px");
    dragFrom(grip(po), { x: 260, y: 180 }, { x: 280, y: 190 }); /* drag again after render */
    expect(po.el.style.left).toBe("280px");
    expect(po.userPos).toEqual({ left: 280, top: 184 });
  });

  test("dismiss → ریست کامل؛ present بعدی دوباره لنگر می‌اندازد", () => {
    const po = makePopover();
    present(po);
    dragFrom(grip(po), { x: 200, y: 140 }, { x: 260, y: 180 });
    po.dismiss();
    expect(po.userPos).toBe(null);
    present(po);
    expect(po.el.style.left).toBe("200px");
    expect(po.el.style.top).toBe("134px");
  });

  test("present مجدد بدون بستن هم = لنگر تازه (جابجایی ephemeral)", () => {
    const po = makePopover();
    present(po);
    dragFrom(grip(po), { x: 200, y: 140 }, { x: 260, y: 180 });
    present(po); /* reopened on the same record */
    expect(po.el.style.left).toBe("200px");
    expect(po.userPos).toBe(null);
  });

  test("لرزش زیر آستانه‌ی ۳px درگ حساب نمی‌شود", () => {
    const po = makePopover();
    present(po);
    dragFrom(grip(po), { x: 200, y: 140 }, { x: 202, y: 141 }); /* dx=2, dy=1 */
    expect(po.userPos).toBe(null);
    win.dispatchEvent(new win.Event("scroll"));
    expect(po.el.style.left).toBe("200px"); /* still anchored */
  });

  test("گارد dismiss وسط درگ: userPos بعد از بسته‌شدن ست نمی‌شود", () => {
    const po = makePopover();
    present(po);
    const g = grip(po);
    g.dispatchEvent(new win.PointerEvent("pointerdown", { clientX: 200, clientY: 140, pointerId: 7, bubbles: true }));
    g.dispatchEvent(new win.PointerEvent("pointermove", { clientX: 260, clientY: 180, pointerId: 7, bubbles: true }));
    po.dismiss(); /* dismissed mid-drag */
    g.dispatchEvent(new win.PointerEvent("pointerup", { pointerId: 7, bubbles: true }));
    expect(po.userPos).toBe(null);
  });
});

describe("NotePopover — کنش‌های جعبه‌ی یادداشت (v0.5.1)", () => {
  /* The two view-mode states of .note-box:
     • بدون یادداشت → قرص وسط‌چین «افزودن یادداشت» (آیکون + + برچسب)
     • با یادداشت   → دکمه‌ی فقط-آیکونی قلم (نام دسترسی از title/aria-label) */

  const cssOf = (po: any) => {
    for (const s of po.root.querySelectorAll("style")) {
      if ((s.textContent || "").includes(".hlx-po")) return s.textContent || "";
    }
    return "";
  };
  const rule = (css: string, sel: string) => {
    const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}"));
    return m ? m[1] : null;
  };

  test("حالت افزودن: قرص «افزودن یادداشت» با آیکون + داخل جعبه — بدون دکمه‌ی ویرایش", () => {
    const po = makePopover();
    present(po); /* note: "" */
    const pill = po.el.querySelector(".note-box .add-note");
    expect(pill).toBeTruthy();
    expect(pill.tagName).toBe("BUTTON");
    expect(pill.getAttribute("data-act")).toBe("edit");
    expect(pill.textContent.trim()).toBe("افزودن یادداشت");
    const icon = pill.querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon.getAttribute("aria-hidden")).toBe("true"); /* نام دسترسی از متن قرص */
    expect(icon.getAttribute("width")).toBe("13");
    expect(icon.innerHTML).toContain("M5 12h14"); /* گلیف + (ICON.plus) */
    expect(po.el.querySelector(".note-box .edit-note")).toBe(null); /* فقط یک کنش در این حالت */
    expect(po.el.querySelector(".note-box").classList.contains("has")).toBe(false);
    expect(po.el.querySelector(".note-box > span").textContent).toContain("ثبت نشده است"); /* متن راهنما می‌ماند */
  });

  test("حالت ویرایش: دکمه‌ی فقط-آیکونی قلم با نام دسترسی — بدون متن و بدون قرص", () => {
    const po = makePopover();
    present(po, "n1", { note: "یادداشت موجود" });
    const btn = po.el.querySelector(".note-box .edit-note");
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("data-act")).toBe("edit");
    expect(btn.getAttribute("title")).toBe("ویرایش یادداشت"); /* نام جای متن حذف‌شده */
    expect(btn.getAttribute("aria-label")).toBe("ویرایش یادداشت");
    expect(btn.textContent.trim()).toBe(""); /* فقط نماد — بدون هیچ متنی */
    const icon = btn.querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon.getAttribute("width")).toBe("15"); /* هندسه‌ی .ib مثل کنش‌های پابرگ */
    expect(icon.innerHTML).toContain("M16.5 3.5"); /* گلیف قلم (ICON.pen) */
    expect(po.el.querySelector(".note-box .add-note")).toBe(null); /* قرص فقط برای حالت خالی */
    expect(po.el.querySelector(".note-box").classList.contains("has")).toBe(true);
    expect(po.el.querySelector(".note-text").textContent).toBe("یادداشت موجود"); /* متن یادداشت دست‌نخورده */
  });

  test("کلیک قرص → حالت ویرایش خالی باز می‌شود", () => {
    const po = makePopover();
    present(po);
    po.el.querySelector(".add-note").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(po.mode).toBe("edit");
    const ta = po.el.querySelector('[data-role="note-input"]');
    expect(ta).toBeTruthy();
    expect(ta.value).toBe("");
  });

  test("کلیک آیکون قلم → ویرایشگر با متن یادداشت موجود", () => {
    const po = makePopover();
    present(po, "n2", { note: "متن قبلی" });
    po.el.querySelector(".edit-note").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(po.mode).toBe("edit");
    expect(po.el.querySelector('[data-role="note-input"]').value).toBe("متن قبلی");
  });

  test("چرخه‌ی کامل: قرص → تایپ → ذخیره → حالت نمایش با دکمه‌ی آیکونی", () => {
    const saved: Array<[string, string]> = [];
    const po = makePopover({ onSaveNote: (id: string, val: string) => saved.push([id, val]) });
    present(po, "n3");
    po.el.querySelector(".add-note").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    const ta = po.el.querySelector('[data-role="note-input"]');
    ta.value = "یادداشت تازه";
    po.el.querySelector('[data-act="save"]').dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(saved).toEqual([["n3", "یادداشت تازه"]]);
    expect(po.mode).toBe("view");
    expect(po.el.querySelector(".note-text").textContent).toBe("یادداشت تازه");
    expect(po.el.querySelector(".note-box .add-note")).toBe(null); /* دیگر حالت خالی نیست */
    expect(po.el.querySelector(".note-box .edit-note")).toBeTruthy(); /* کنش ویرایش آیکونی */
  });

  test("قرارداد CSS: قرص وسط‌چین کهنه‌رنگ + دکمه‌ی آیکونی توکنی (خانواده‌ی .btn-p/.ib)", () => {
    const po = makePopover();
    present(po);
    const css = cssOf(po);
    const pill = rule(css, ".hlx-po .add-note")!;
    expect(pill).toContain("align-self: center"); /* وسط مستطیل یادداشت */
    expect(pill).toContain("border-radius: 999px"); /* شکل قرص */
    expect(pill).toContain("background: #d97706"); /* کهربای .btn-p */
    expect(pill).toContain("color: #fff");
    expect(rule(css, ".hlx-po .add-note:hover")!).toContain("background: #b45309");
    const icon = rule(css, ".hlx-po .edit-note")!;
    expect(icon).toContain("width: 30px"); /* هندسه‌ی .ib */
    expect(icon).toContain("height: 30px");
    expect(icon).toContain("color: var(--po-note-ic)"); /* کهربا از لایه‌ی توکن — نه رنگ خام */
    expect(rule(css, ".hlx-po .edit-note:hover")!).toContain("background: var(--po-note-h-bg)");
  });
});
