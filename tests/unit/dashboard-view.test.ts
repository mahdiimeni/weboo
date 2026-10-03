/**
 * HL.dashView tests — dashboard view layer (DOM builders)
 * Builders hold no state; all behavior is injected via handlers, and
 * assertions target DOM structure and handler invocations (MVC kept separate).
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, ext, sleep, readFile } from "./helpers/engine";

let HL: any;
let win: any;

beforeEach(async () => {
  win = setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/format.js", "shared/detect-dir.js", "shared/tags.js", "shared/domkit.js", "shared/runtime-bridge.js", "shared/textindex.js", "dashboard/dashboard-data.js", "dashboard/dashboard-view.js"] });
});

const G = () => ({
  key: "https://example.com/p1",
  host: "example.com",
  title: "مقاله تست",
  url: "https://example.com/p1",
  items: [
    { id: "a1", text: "متن اول", note: "", color: "green", createdAt: 100, updatedAt: 200, host: "example.com", url: "https://example.com/p1", start: 5 },
    { id: "a2", text: "متن دوم", note: "یادداشت", color: "pink", createdAt: 150, updatedAt: 250, host: "example.com", url: "https://example.com/p1", start: 9 },
  ],
  notes: 1,
  latest: 250,
  earliest: 100,
});

/* یک گروه با جهت دلخواه — همان شکل خروجی paginate ({ group, remaining })؛
   مشترک بین describeهای بخش‌های جهت (v0.2.0 و v0.5.0) */
const EN = (key: string) => ({
  group: Object.assign(G(), { key, url: key, host: "en.example.com", dir: "ltr", title: "Understanding logical properties" }),
  remaining: 0,
});
const FA = (key: string) => ({
  group: Object.assign(G(), { key, url: key, dir: "rtl" }),
  remaining: 0,
});

describe("buildGroupCard", () => {
  const DATA_URL = "data:image/png;base64,iVBORw0KGgo="; /* valid captured favicon sample */

  test("favicon — با g.favicon (dataURL از hlx:f:<host>): img.fl-img با src کنار حرف (placeholder)", () => {
    const g = Object.assign(G(), { favicon: DATA_URL });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {},
    });
    const fl = card.querySelector(".fl");
    const img = fl.querySelector("img.fl-img");
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe(DATA_URL);
    expect(fl.textContent).toBe("E"); /* first letter still serves as placeholder under the img */
  });

  test("favicon — بدون favicon ذخیره‌شده: فقط حرف اول، بدون img (رکوردهای قدیمی/کپچر ناموفق)", () => {
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {},
    });
    const fl = card.querySelector(".fl");
    expect(fl.querySelector("img")).toBe(null);
    expect(fl.textContent).toBe("E");
  });

  test("group-url: فقط دامنه‌ی اصلی نمایش داده می‌شود؛ لینک کامل در tooltip", () => {
    const g = Object.assign(G(), {
      url: "https://www.example.com/persian/articles/12345?utm_source=x",
      host: "www.example.com",
    });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {},
    });
    const url = card.querySelector(".group-url");
    expect(url.textContent).toBe("example.com"); /* not the full URL */
    expect(url.textContent).not.toContain("/");
    expect(url.title).toBe("https://www.example.com/persian/articles/12345?utm_source=x");
  });

  test("group-url: رکورد قدیمی بدون url → host خام هم پذیرفته می‌شود", () => {
    const g = Object.assign(G(), { url: "", host: "fa.wikipedia.org" });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {},
    });
    const url = card.querySelector(".group-url");
    expect(url.textContent).toBe("fa.wikipedia.org");
  });

  test("ساختار کامل هدر/آیتم‌ها/دکمه‌ها", () => {
    const calls: any[] = [];
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, {
      onOpen: () => calls.push("open"),
      onDeleteGroup: () => calls.push("del"),
      onToggle: () => calls.push("toggle"),
      onView: () => calls.push("view"),
      onCopy: () => calls.push("copy"),
      onDelete: () => calls.push("delItem"),
    });
    const head = card.querySelector(".group-head");
    expect(head.getAttribute("role")).toBe("button");
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(card.querySelectorAll(".item").length).toBe(2);
    /* two header buttons: open + delete group */
    const btns = head.querySelectorAll("button.icon-btn");
    expect(btns.length).toBe(2);
    expect(btns[0].title).toBe("باز کردن این صفحه در تب جدید");
    expect(btns[1].title).toBe("حذف همه‌ی این صفحه");
    /* chips */
    expect(head.querySelector(".chip").textContent).toContain("۲ هایلایت");
    const chips = head.querySelectorAll(".chip");
    expect(chips.length).toBe(2); /* highlights + notes */
    expect(chips[1].textContent).toContain("یادداشت");
  });

  test("کلیک روی دکمه‌ی باز کردن → onOpen بدون toggle", () => {
    const calls: any[] = [];
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, {
      onOpen: (g: any) => calls.push(["open", g.key]),
      onDeleteGroup: () => calls.push(["del"]),
      onToggle: () => calls.push(["toggle"]),
      onView: () => {},
      onCopy: () => {},
      onDelete: () => {},
    });
    const openBtn = card.querySelector(".group-head button.icon-btn");
    openBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["open", "https://example.com/p1"]]);
  });

  test("کلیک روی هدر (خودِ هدر) → toggle + به‌روزرسانی DOM", () => {
    const calls: any[] = [];
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, {
      onOpen: () => {},
      onDeleteGroup: () => {},
      onToggle: (g: any, willCollapse: boolean) => calls.push([willCollapse]),
      onView: () => {},
      onCopy: () => {},
      onDelete: () => {},
    });
    const head = card.querySelector(".group-head");
    head.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([[true]]);
    expect(card.classList.contains("collapsed")).toBe(true);
    expect(card.querySelector(".group-items").hidden).toBe(true);
    expect(head.getAttribute("aria-expanded")).toBe("false");
  });

  test("کیبورد: Enter روی هدر toggle می‌کند؛ روی دکمه نه", () => {
    const calls: any[] = [];
    const handlers = {
      onOpen: () => calls.push(["open"]),
      onDeleteGroup: () => calls.push(["del"]),
      onToggle: (_g: any, w: boolean) => calls.push(["toggle", w]),
      onView: () => {},
      onCopy: () => {},
      onDelete: () => {},
    };
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, handlers);
    const head = card.querySelector(".group-head");
    head.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(calls).toEqual([["toggle", true]]);
    calls.length = 0;
    /* Enter on an inner button must not toggle (a11y guard) */
    const openBtn = card.querySelector(".group-head button.icon-btn");
    openBtn.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(calls).toEqual([]);
  });

  test("remaining → پیام آیتم‌های بیشتر", () => {
    const card = HL.dashView.buildGroupCard(G(), 7, { collapsed: false }, {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {},
      onView: () => {}, onCopy: () => {}, onDelete: () => {},
    });
    const more = card.querySelector(".item-more");
    expect(more.textContent).toContain("۷");
    expect(head_count(card)).toBe("۹ هایلایت"); /* 2 + 7 */
  });

  test("گروه جمع‌شده از ابتدا", () => {
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: true }, {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {},
      onView: () => {}, onCopy: () => {}, onDelete: () => {},
    });
    expect(card.classList.contains("collapsed")).toBe(true);
    expect(card.querySelector(".group-items").hidden).toBe(true);
    expect(card.querySelector(".group-head").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("buildGroupCard — کارت هوشمند جهت (v1.2.6)", () => {
  const H = { onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {}, onCopy: () => {}, onDelete: () => {} };

  test("g.dir=ltr → کارت dir=ltr می‌گیرد (مقاله‌ی غیر RTL)", () => {
    const g = Object.assign(G(), {
      dir: "ltr",
      title: "Understanding CSS logical properties",
      items: [
        { id: "a1", text: "Inline start and end are direction aware.", note: "", color: "green", createdAt: 100, updatedAt: 200, host: "example.com", url: "https://example.com/p1", start: 5 },
      ],
    });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H);
    expect(card.getAttribute("dir")).toBe("ltr");
    expect(card.tagName).toBe("DIV");
  });

  test("g.dir=rtl یا بدون dir → کارت صفت نمی‌گیرد (ارث rtl سند — دقیقاً مثل قبل)", () => {
    const rtlCard = HL.dashView.buildGroupCard(Object.assign(G(), { dir: "rtl" }), 0, { collapsed: false }, H);
    expect(rtlCard.getAttribute("dir")).toBeNull();
    const noDirCard = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, H);
    expect(noDirCard.getAttribute("dir")).toBeNull();
  });

  test("سرتاسر زنجیره: groupRecords → buildGroupCard (یکپارچگی داده↔نما)", () => {
    const groups = HL.dash.groupRecords([
      { id: "e1", host: "developer.mozilla.org", site: "https://developer.mozilla.org", url: "https://developer.mozilla.org/css", urlNorm: "https://developer.mozilla.org/css", title: "CSS logical properties guide", text: "Logical properties flow with the writing mode of the page.", note: "", color: "teal", createdAt: 1, updatedAt: 2, start: 0 },
      { id: "f1", host: "fa.wikipedia.org", site: "https://fa.wikipedia.org", url: "https://fa.wikipedia.org/wiki/x", urlNorm: "https://fa.wikipedia.org/wiki/x", title: "ویکی‌پدیای فارسی", text: "متن فارسی مقاله", note: "", color: "yellow", createdAt: 1, updatedAt: 2, start: 0 },
    ], "newest");
    const en = groups.find((g: any) => g.host === "developer.mozilla.org")!;
    const fa = groups.find((g: any) => g.host === "fa.wikipedia.org")!;
    expect(en.dir).toBe("ltr");
    expect(fa.dir).toBe("rtl");
    expect(HL.dashView.buildGroupCard(en, 0, { collapsed: false }, H).getAttribute("dir")).toBe("ltr");
    expect(HL.dashView.buildGroupCard(fa, 0, { collapsed: false }, H).getAttribute("dir")).toBeNull();
  });
});

describe("buildGroupCard — ردیف برچسب مقاله (v1.2.15)", () => {
  const TAGS = ["پژوهش", "اخبار"];
  const H = (calls: any[]) => ({
    onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {},
    onView: () => {}, onCopy: () => {}, onDelete: () => {},
    onAddTag: (g: any, t: string) => calls.push(["add", g.key, t]),
    onRemoveTag: (g: any, t: string) => calls.push(["remove", g.key, t]),
  });

  test("ردیف .group-tags بین هدر و آیتم‌ها؛ حتی در کارت جمع‌شده دیده می‌شود", () => {
    const g = Object.assign(G(), { tags: TAGS });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: true }, H([]));
    const row = card.querySelector(".group-tags");
    expect(row).not.toBeNull();
    expect(card.children[0].classList.contains("group-head")).toBe(true);
    expect(card.children[1]).toBe(row); /* بین هدر و آیتم‌ها */
    expect(card.children[2].classList.contains("group-items")).toBe(true);
    expect(row.hidden).toBe(false); /* جمع‌شدگی روی ردیف برچسب اثر ندارد */
  });

  test("چیپ‌های .atag با متن XSS-امن + دکمه‌ی حذف هرکدام", () => {
    const calls: any[] = [];
    const g = Object.assign(G(), { tags: ["پژوهش", "<img src=x onerror=alert(1)>"] });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H(calls));
    const chips = card.querySelectorAll(".atag");
    expect(chips.length).toBe(2);
    expect(chips[0].querySelector(".atag-t").textContent).toBe("پژوهش");
    /* متن تگ با textContent رندر می‌شود — HTML زنده نمی‌شود */
    expect(chips[1].querySelector(".atag-t").textContent).toBe("<img src=x onerror=alert(1)>");
    expect(chips[1].querySelector("img")).toBeNull();
    const x = chips[0].querySelector("button.atag-x");
    expect(x.getAttribute("aria-label")).toBe("حذف برچسب پژوهش");
    x.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["remove", "https://example.com/p1", "پژوهش"]]);
  });

  test("دکمه‌ی افزودن → ورودی خطی؛ Enter مقدار را می‌فرستد؛ Esc/blur بی‌اثر لغو می‌کند", () => {
    const calls: any[] = [];
    const g = Object.assign(G(), { tags: [] });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H(calls));
    const row = card.querySelector(".group-tags");
    const add = row.querySelector("button.atag-add");
    expect(add).not.toBeNull();

    add.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    const inp = row.querySelector("input.tag-input");
    expect(inp).not.toBeNull();
    expect(inp.maxLength).toBe(HL.TAG_MAX_LEN);
    expect(row.contains(add)).toBe(false); /* دکمه جایش را به ورودی داده */

    inp.value = "  مطالعه  ";
    inp.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(calls).toEqual([["add", "https://example.com/p1", "مطالعه"]]); /* trim شده، raw value */
    expect(row.querySelector("input.tag-input")).toBeNull(); /* ورودی بسته شد */
    expect(row.contains(row.querySelector("button.atag-add"))).toBe(true); /* دکمه برگشت */

    /* Esc: لغو بدون فراخوانی هندلر */
    row.querySelector("button.atag-add").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    const inp2 = row.querySelector("input.tag-input");
    inp2.value = "لغو‌شده";
    inp2.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(calls.length).toBe(1);
    expect(row.querySelector("input.tag-input")).toBeNull();

    /* blur با متن: فقط می‌بندد؛ commit نمی‌کند (Enter تنها راه فرستادن است) */
    row.querySelector("button.atag-add").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    const inp3 = row.querySelector("input.tag-input");
    inp3.value = "با blur فرستاده نمی‌شود";
    inp3.dispatchEvent(new win.FocusEvent("blur"));
    expect(calls.length).toBe(1);
    expect(row.querySelector("input.tag-input")).toBeNull();

    /* Enter با فقط فاصله → هیچ فراخوانی نمی‌شود */
    row.querySelector("button.atag-add").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    const inp4 = row.querySelector("input.tag-input");
    inp4.value = "   ";
    inp4.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(calls.length).toBe(1);
  });

  test("بدون هندلرهای برچسب → چیپ‌ها فقط-خواندنی؛ ردیف بدون دکمه‌ی افزودن (سازگاری تست‌های قدیمی)", () => {
    const g = Object.assign(G(), { tags: TAGS });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {}, onCopy: () => {}, onDelete: () => {},
    });
    const row = card.querySelector(".group-tags");
    expect(row.querySelectorAll(".atag").length).toBe(2);
    expect(row.querySelector("button.atag-x")).toBeNull();
    expect(row.querySelector("button.atag-add")).toBeNull();
  });

  test("بدون تگ و با هندلر → فقط دکمه‌ی افزودن؛ toggle هدر دست‌نخورده می‌ماند", () => {
    const calls: any[] = [];
    const card = HL.dashView.buildGroupCard(Object.assign(G(), { tags: [] }), 0, { collapsed: false }, H(calls));
    const row = card.querySelector(".group-tags");
    expect(row.querySelectorAll(".atag").length).toBe(0);
    expect(row.querySelector("button.atag-add")).not.toBeNull();
    /* کلیک روی خودِ دکمه‌ی افزودن نباید کارت را toggle کند (بیرون از سطح toggle) */
    row.querySelector("button.atag-add").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(card.classList.contains("collapsed")).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("buildTagChips — چیپ‌های فیلتر برچسب نوار ابزار (v1.2.15)", () => {
  const box = () => {
    const d = HL.dashView.el("div");
    return d;
  };

  test("رندر چیپ + شمارش فارسی + aria-checked؛ کلیک → onToggle و به‌روزرسانی وضعیت", () => {
    const calls: any[] = [];
    const selected = new Set(["اخبار"]);
    const c = box();
    HL.dashView.buildTagChips(c, [
      { tag: "اخبار", count: 3 },
      { tag: "پژوهش", count: 1 },
    ], selected, (tag: string, active: boolean) => calls.push([tag, active]));
    const chips = c.querySelectorAll("button.tchip");
    expect(chips.length).toBe(2);
    expect(chips[0].getAttribute("role")).toBe("checkbox");
    expect(chips[0].getAttribute("aria-checked")).toBe("true");
    expect(chips[0].classList.contains("active")).toBe(true);
    expect(chips[0].textContent).toContain("اخبار");
    expect(chips[0].querySelector(".tchip-n").textContent).toBe("۳");
    expect(chips[1].getAttribute("aria-checked")).toBe("false");

    chips[1].dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["پژوهش", true]]);
    expect(chips[1].classList.contains("active")).toBe(true);
    expect(chips[1].getAttribute("aria-checked")).toBe("true");
    expect(selected.has("پژوهش")).toBe(true); /* انتخاب در همان Set فراخوان‌کننده */

    chips[1].dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["پژوهش", true], ["پژوهش", false]]);
    expect(chips[1].classList.contains("active")).toBe(false);
  });

  test("لیست خالی → کانتینر خالی (بدون خطا)", () => {
    const c = box();
    HL.dashView.buildTagChips(c, [], new Set(), () => {});
    expect(c.querySelectorAll("button.tchip").length).toBe(0);
  });
});

function head_count(card: any) {
  return card.querySelector(".chip").textContent;
}

describe("buildItemCard", () => {
  test("نوار رنگ + یادداشت + متادیتا", () => {
    const handlers = { onView: () => {}, onCopy: () => {}, onDelete: () => {} };
    const item = HL.dashView.buildItemCard({
      id: "a2", text: "متن دوم", note: "یادداشت", color: "pink", createdAt: 150, updatedAt: 250,
    }, handlers);
    expect(item.querySelector(".cbar").style.background).toBe("#e5679b"); /* pink color dot */
    expect(item.querySelector(".note-text").textContent).toBe("یادداشت");
    expect(item.querySelectorAll(".item-actions button").length).toBe(3); /* view + copy + delete */
  });

  test("بدون یادداشت → بدون عنصر note", () => {
    const item = HL.dashView.buildItemCard({
      id: "a1", text: "متن", note: "", color: "green", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".note")).toBeNull();
  });

  test("یادداشت انگلیسی → ردیف .note با dir=ltr؛ متن ارث می‌برد (v1.2.13)", () => {
    const item = HL.dashView.buildItemCard({
      id: "n1", text: "متن", note: "This note is English and must flow LTR", color: "green", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".note").getAttribute("dir")).toBe("ltr"); /* the ROW carries the direction — icon + text flip together */
    expect(item.querySelector(".note-text").getAttribute("dir")).toBe(null); /* the text inherits the row, no attribute of its own */
  });

  test("یادداشت فارسی → ردیف .note با dir=rtl صریح (مستقل از جهت کارت — v1.2.12/v1.2.13)", () => {
    const item = HL.dashView.buildItemCard({
      id: "n2", text: "متن", note: "یادداشت فارسی", color: "green", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".note").getAttribute("dir")).toBe("rtl"); /* explicit — a Persian note inside an LTR card must not inherit it */
    expect(item.querySelector(".note-text").getAttribute("dir")).toBe(null);
  });

  test("یادداشت خنثی (فقط رقم) → ردیف .note بدون dir (پیروی از کارت — v1.2.13)", () => {
    const item = HL.dashView.buildItemCard({
      id: "n3", text: "متن", note: "12345", color: "green", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".note").getAttribute("dir")).toBe(null);
    expect(item.querySelector(".note-text").getAttribute("dir")).toBe(null);
  });

  test("ساختار ردیف یادداشت: آیکن و متن فرزندان مستقیم .note هستند (v1.2.13)", () => {
    const item = HL.dashView.buildItemCard({
      id: "n4", text: "متن", note: "_structure_", color: "green", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    const row = item.querySelector(".note");
    const kids = row.children;
    expect(kids.length).toBe(2);
    expect(kids[0].className).toBe("note-ic"); /* flex first child → at the row's start edge once dir flips it */
    expect(kids[1].className).toBe("note-text");
  });

  test("متن انگلیسی → .item-text با dir=ltr (نقل‌قول انگلیسی در کارت RTL — باگ v1.2.12)", () => {
    const item = HL.dashView.buildItemCard({
      id: "q1", text: "what was that? hah?", note: "", color: "yellow", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".item-text").getAttribute("dir")).toBe("ltr");
  });

  test("متن فارسی → .item-text با dir=rtl صریح (مستقل از جهت کارت — v1.2.12)", () => {
    const item = HL.dashView.buildItemCard({
      id: "q2", text: "متن هایلایت فارسی", note: "", color: "yellow", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".item-text").getAttribute("dir")).toBe("rtl");
  });

  test("متن خنثی (فقط رقم) → .item-text بدون dir (v1.2.12)", () => {
    const item = HL.dashView.buildItemCard({
      id: "q3", text: "12345 67890", note: "", color: "yellow", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".item-text").getAttribute("dir")).toBe(null);
  });

  test("کارت کاربر: نقل‌قول و یادداشت انگلیسی با هم → نقل‌قول dir=ltr و ردیف یادداشت dir=ltr (v1.2.12/v1.2.13)", () => {
    const item = HL.dashView.buildItemCard({
      id: "q4", text: "what was that? hah?", note: "what was that? hah?", color: "yellow", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".item-text").getAttribute("dir")).toBe("ltr");
    expect(item.querySelector(".note").getAttribute("dir")).toBe("ltr");
    expect(item.querySelector(".note-text").getAttribute("dir")).toBe(null); /* inherits the row */
  });

  test("آینه‌ی جهت: نقل‌قول انگلیسی + یادداشت فارسی → نقل‌قول ltr و ردیف یادداشت rtl (v1.2.13)", () => {
    const item = HL.dashView.buildItemCard({
      id: "q5", text: "An English highlight quoted verbatim", note: "یادداشت فارسی روی هایلایت انگلیسی", color: "green", createdAt: 1, updatedAt: 2,
    }, { onView: () => {}, onCopy: () => {}, onDelete: () => {} });
    expect(item.querySelector(".item-text").getAttribute("dir")).toBe("ltr");
    expect(item.querySelector(".note").getAttribute("dir")).toBe("rtl"); /* the row flips RTL inside an LTR card — icon at the row's start (right) */
    expect(item.querySelector(".note-text").getAttribute("dir")).toBe(null);
  });

  test("هندلرها با رکورد درست فراخوانی می‌شوند", () => {
    const calls: any[] = [];
    const rec = { id: "x", text: "متن", note: "", color: "green", createdAt: 1, updatedAt: 2 };
    const item = HL.dashView.buildItemCard(rec, {
      onView: (r: any) => calls.push(["view", r.id]),
      onCopy: (r: any) => calls.push(["copy", r.id]),
      onDelete: (r: any) => calls.push(["delete", r.id]),
    });
    const btns = item.querySelectorAll(".item-actions button");
    btns[0].dispatchEvent(new win.MouseEvent("click", { bubbles: true })); /* view */
    btns[1].dispatchEvent(new win.MouseEvent("click", { bubbles: true })); /* copy */
    expect(calls).toEqual([["view", "x"], ["copy", "x"]]);
    /* delete → armButton: first click arms, second executes */
    btns[2].dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(btns[2].textContent).toContain("مطمئنی؟");
    btns[2].dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["view", "x"], ["copy", "x"], ["delete", "x"]]);
  });
});

describe("متن‌های فارسی رابط — dir=rtl مستقل از جهت کارت (v0.5.2)", () => {
  const H = { onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {}, onCopy: () => {}, onDelete: () => {} };

  test("کپسول‌های شمارش: هر chip با dir=rtl صریح — «N هایلایت» و «N یادداشت» در کارت RTL", () => {
    const chips = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, H).querySelectorAll(".gchips .chip");
    expect(chips.length).toBe(2);
    chips.forEach((c: any) => expect(c.getAttribute("dir")).toBe("rtl"));
    expect(chips[0].textContent).toContain("۲ هایلایت"); /* متن دست‌نخورده — فقط جهت صریح شد */
    expect(chips[1].textContent).toContain("یادداشت");
  });

  test("آینه‌ی v1.2.6: داخل کارت LTR هم کپسول‌ها جزیره‌ی RTL می‌مانند (dir=rtl روی هر chip)", () => {
    const g = Object.assign(G(), { dir: "ltr", host: "en.example.com", title: "Understanding logical properties" });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H);
    expect(card.getAttribute("dir")).toBe("ltr"); /* قاب برمی‌گردد، chrome نه — bidi دیگر «۳ هایلایت» را به «هایلایت ۳» نمی‌چپاند */
    const chips = card.querySelectorAll(".gchips .chip");
    expect(chips.length).toBe(2);
    chips.forEach((c: any) => expect(c.getAttribute("dir")).toBe("rtl"));
  });

  test("بدون یادداشت → فقط کپسول هایلایت، با همان dir=rtl", () => {
    const g = Object.assign(G(), { notes: 0, items: [G().items[0]] });
    const chips = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H).querySelectorAll(".gchips .chip");
    expect(chips.length).toBe(1);
    expect(chips[0].getAttribute("dir")).toBe("rtl");
  });

  test("تاریخ آیتم: .item-date با dir=rtl — قالب fa-IR همیشه راست‌به‌چپ می‌ماند", () => {
    const item = HL.dashView.buildItemCard(
      { id: "d1", text: "متن", note: "", color: "green", createdAt: 150, updatedAt: 250 },
      { onView: () => {}, onCopy: () => {}, onDelete: () => {} }
    );
    const date = item.querySelector(".item-date");
    expect(date.getAttribute("dir")).toBe("rtl");
    expect(date.textContent).toBe(HL.format.fmtDateTime(250));
  });

  test("پیام «مورد دیگر»: .item-more با dir=rtl (همان کلاس نقص — اعلان فارسی با رقم و پرانتز)", () => {
    const more = HL.dashView.buildGroupCard(G(), 7, { collapsed: false }, H).querySelector(".item-more");
    expect(more.getAttribute("dir")).toBe("rtl");
    expect(more.textContent).toContain("۷");
  });

  test("دکمه‌ی ترتیب dir=rtl صریح — آیکون+برچسب ترتیب‌دار؛ یک چیدمان در هر جهت کارت (v0.6.2)", () => {
    const rtl = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, H).querySelector(".order-btn");
    const ltr = HL.dashView.buildGroupCard(Object.assign(G(), { dir: "ltr" }), 0, { collapsed: false }, H).querySelector(".order-btn");
    expect(rtl).toBeTruthy();
    expect(rtl.getAttribute("dir")).toBe("rtl"); /* کروم فارسی — قاعده‌ی faEl */
    expect(ltr.getAttribute("dir")).toBe("rtl"); /* داخل کارت LTR: [برچسب آیکون] می‌ماند، دیگر [آیکون برچسب] نمی‌شود (اصلاح v0.6.2) */
  });

  test("قرارداد CSS: متن کارت‌های آمار و ورودی برچسب وسط‌چین (v0.5.2)", () => {
    const css = readFile(ext("dashboard", "dashboard.css"));
    const rule = (sel: string) => {
      const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}"));
      return m ? m[1] : "";
    };
    expect(rule(".stat-card")).toContain("text-align: center"); /* مرکز کارت آمار (اصلاح ۱) */
    expect(rule(".tag-input")).toContain("text-align: center"); /* تایپ وسط‌چین، فارسی یا لاتین (اصلاح ۳) */
  });
});

describe("armButton", () => {
  test("تایید دومرحله‌ای و بازگشت خودکار", async () => {
    let fired = 0;
    const btn = HL.dashView.iconBtn("trash", "حذف");
    HL.dashView.armButton(btn, "مطمئنی؟", () => { fired++; });
    btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(fired).toBe(0);
    expect(btn.classList.contains("armed")).toBe(true);
    expect(btn.textContent).toBe("مطمئنی؟");
    btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(fired).toBe(1);
    expect(btn.textContent).not.toBe("مطمئنی؟");
  });
});

describe("چیپ‌ها و نقطه‌ها", () => {
  test("buildColorChips — ۵ رنگ، toggle فعال/aria", () => {
    const calls: any[] = [];
    const container = win.document.createElement("div");
    const selected = new Set(["green"]);
    HL.dashView.buildColorChips(container, selected, (k: string, active: boolean) => calls.push([k, active]));
    const chips = container.querySelectorAll("button.cchip");
    expect(chips.length).toBe(5);
    expect(chips[1].classList.contains("active")).toBe(true); /* green */
    chips[1].dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["green", false]]);
    expect(chips[1].classList.contains("active")).toBe(false);
    expect(chips[1].getAttribute("aria-checked")).toBe("false");
  });

  test("buildColorDots — رنگ فعال و انتخاب", () => {
    const calls: any[] = [];
    const container = win.document.createElement("div");
    HL.dashView.buildColorDots(container, "teal", (k: string) => calls.push(k));
    const dots = container.querySelectorAll("button.cdot");
    expect(dots.length).toBe(5);
    expect(dots[2].classList.contains("active")).toBe(true); /* teal */
    dots[0].dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual(["yellow"]);
  });

  test("buildThemeRadios — سه گزینه از رجیستری، فعالِ درست، onSelect با change", () => {
    const calls: string[] = [];
    const container = win.document.createElement("div");
    HL.dashView.buildThemeRadios(container, "dark", (k: string) => calls.push(k));
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(3); /* auto → light → dark (registry order) */
    expect(radios[0].value).toBe("auto");
    expect(radios[1].value).toBe("light");
    expect(radios[2].value).toBe("dark");
    expect(radios[2].checked).toBe(true); /* dark active */
    expect(radios[0].checked).toBe(false);
    /* all share one name → native radio group (keyboard/AT) */
    expect(radios[1].getAttribute("name")).toBe(radios[2].getAttribute("name"));
    /* selection via the change event (like a label click — checked set via the property) */
    radios[1].checked = true;
    radios[1].dispatchEvent(new win.Event("change", { bubbles: true }));
    expect(calls).toEqual(["light"]);
  });

  test("buildThemeRadios — current نامعتبر → auto؛ بازسازی، state قبلی را پاک می‌کند", () => {
    const container = win.document.createElement("div");
    HL.dashView.buildThemeRadios(container, "blue", () => {});
    let radios = container.querySelectorAll('input[type="radio"]');
    expect(radios[0].checked).toBe(true); /* auto */
    /* rebuild with a new value — previous radios are removed */
    HL.dashView.buildThemeRadios(container, "light", () => {});
    radios = container.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(3);
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
  });

  test("buildThemeRadios — برچسب و توضیح فارسی هر گزینه (فقط textContent)", () => {
    const container = win.document.createElement("div");
    HL.dashView.buildThemeRadios(container, "auto", () => {});
    const labels = container.querySelectorAll(".radio-txt strong");
    expect(labels[0].textContent).toBe("هماهنگ با سیستم");
    expect(labels[1].textContent).toBe("روشن");
    expect(labels[2].textContent).toBe("تاریک");
    const hints = container.querySelectorAll(".radio-txt .muted");
    expect(hints[0].textContent).toContain("سیستم‌عامل");
    expect(hints[1].textContent).toContain("روشن");
    expect(hints[2].textContent).toContain("تیره");
  });

  test("renderHostChips — خالی و حذف", () => {
    const calls: string[] = [];
    const container = win.document.createElement("div");
    HL.dashView.renderHostChips(container, [], () => {});
    expect(container.querySelector("p").textContent).toContain("غیرفعال نشده");
    HL.dashView.renderHostChips(container, ["a.com", "b.com"], (h: string) => calls.push(h));
    const chips = container.querySelectorAll(".hchip");
    expect(chips.length).toBe(2);
    chips[0].querySelector("button").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual(["a.com"]);
  });
});

describe("fillModalSummary", () => {
  test("چهار ردیف خلاصه", () => {
    const container = win.document.createElement("div");
    HL.dashView.fillModalSummary(container, {
      app: "web-highlighter",
      name: "مجموعه من",
      version: "1.1.0",
      exportedAt: 1700000000000,
      meta: { count: 42 },
      highlights: {},
    });
    const rows = container.querySelectorAll(".sum-row");
    expect(rows.length).toBe(4);
    expect(container.textContent).toContain("مجموعه من");
    expect(container.textContent).toContain("۴۲");
    expect(container.textContent).toContain("v1.1.0");
  });
});

describe("toast (view)", () => {
  test("به container اضافه می‌شود با role=status", async () => {
    const container = win.document.createElement("div");
    win.document.body.appendChild(container);
    HL.dashView.toast(container, "پیام تست", "success");
    const t = container.querySelector(".toast");
    expect(t).not.toBeNull();
    expect(t.getAttribute("role")).toBe("status");
    expect(t.textContent).toBe("پیام تست");
    await sleep(20);
    expect(t.classList.contains("show")).toBe(true);
  });
});

describe("renderEmptyState / renderLoadMore (v1.2.9 — moved from the controller)", () => {
  const emptyParts = () => {
    const empty = win.document.createElement("div");
    const emptyTitle = win.document.createElement("h2");
    const emptySub = win.document.createElement("p");
    empty.appendChild(emptyTitle);
    empty.appendChild(emptySub);
    empty.hidden = true; /* observe the flip to visible */
    return { empty, emptyTitle, emptySub };
  };

  test("renderEmptyState — hasRecords=true (مخزن پر، فیلتر همه را حذف کرد): پیام «نتیجه‌ای پیدا نشد.»", () => {
    const { empty, emptyTitle, emptySub } = emptyParts();
    HL.dashView.renderEmptyState(empty, emptyTitle, emptySub, true);
    expect(empty.hidden).toBe(false);
    expect(emptyTitle.textContent).toBe("نتیجه‌ای پیدا نشد.");
    expect(emptySub.textContent).toBe("عبارت جست‌وجو یا فیلترهای رنگ و برچسب را تغییر بده.");
  });

  test("renderEmptyState — hasRecords=false (مخزن خالی): پیام «هنوز هایلایتی ثبت نشده»", () => {
    const { empty, emptyTitle, emptySub } = emptyParts();
    HL.dashView.renderEmptyState(empty, emptyTitle, emptySub, false);
    expect(empty.hidden).toBe(false);
    expect(emptyTitle.textContent).toBe("هنوز هایلایتی ثبت نشده — اولین متن را انتخاب کن!");
    expect(emptySub.textContent).toBe("روی هر صفحه‌ی وب، متن را انتخاب کن و از نوار شناور افزونه استفاده کن.");
  });

  test("renderLoadMore — overflow>0: نمایان با برچسب و شمارش فارسی", () => {
    const loadMore = win.document.createElement("button");
    loadMore.hidden = true;
    HL.dashView.renderLoadMore(loadMore, 12);
    expect(loadMore.hidden).toBe(false);
    expect(loadMore.textContent).toContain("بارگذاری بیشتر");
    expect(loadMore.textContent).toContain("۱۲");
    expect(loadMore.textContent).toBe("بارگذاری بیشتر (۱۲ مورد باقی‌مانده)");
  });

  test("renderLoadMore — overflow=0: مخفی می‌ماند", () => {
    const loadMore = win.document.createElement("button");
    loadMore.hidden = false;
    HL.dashView.renderLoadMore(loadMore, 0);
    expect(loadMore.hidden).toBe(true);
  });
});

/* ================= v0.2.0 — Direction sections ================= */

describe("buildDirSection (v0.2.0)", () => {
  const H = () => ({
    onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {},
    onView: () => {}, onCopy: () => {}, onDelete: () => {},
  });

  test("ساختار RTL: بخش + هدر + h2 با id/aria-labelledby + عنوان + شمار مقاله + کارت‌ها", () => {
    const sec = { dir: "rtl", entries: [FA("u-fa1"), FA("u-fa2")] };
    const node = HL.dashView.buildDirSection(sec, {}, H());
    expect(node.tagName).toBe("SECTION");
    expect(node.classList.contains("dir-sec")).toBe(true);
    expect(node.classList.contains("dir-rtl")).toBe(true);
    expect(node.classList.contains("lead")).toBe(false);
    expect(node.getAttribute("dir")).toBe(null); /* کانتینر بی‌جهت: هدر فارسی، کارت‌ها جهت خودشان (v1.2.6) */
    expect(node.getAttribute("aria-labelledby")).toBe("hlx-dir-rtl");
    const h = node.querySelector("h2.dir-sec-title");
    expect(h.id).toBe("hlx-dir-rtl");
    expect(h.textContent).toContain("راست‌چین‌ها"); /* برچسب v0.6.3 — واژگان چینش */
    expect(node.querySelector(".dir-ic svg polyline").getAttribute("points")).toBe("10 6 4 12 10 18"); /* ← */
    expect(node.querySelector(".dir-sec-count").textContent).toBe("۲ مقاله");
    expect(node.querySelectorAll(".dir-sec-body .group").length).toBe(2);
  });

  test("ساختار LTR: کلاس dir-ltr + عنوان چپ‌به‌راست + آیکون →", () => {
    const node = HL.dashView.buildDirSection({ dir: "ltr", entries: [EN("u-en1")] }, {}, H());
    expect(node.classList.contains("dir-ltr")).toBe(true);
    expect(node.getAttribute("aria-labelledby")).toBe("hlx-dir-ltr");
    expect(node.querySelector("h2.dir-sec-title").textContent).toContain("چپ‌چین‌ها"); /* برچسب v0.6.3 — واژگان چینش */
    expect(node.querySelector(".dir-ic svg polyline").getAttribute("points")).toBe("14 6 20 12 14 18"); /* → */
    expect(node.querySelector(".dir-sec-count").textContent).toBe("۱ مقاله");
  });

  test("dir نامعتبر/غایب → بخش RTL (پیش‌فرض محافظه‌کار، همان قرارداد data layer)", () => {
    const node = HL.dashView.buildDirSection({ dir: "x" as any, entries: [] }, {}, H());
    expect(node.classList.contains("dir-rtl")).toBe(true);
    const node2 = HL.dashView.buildDirSection(undefined as any, {}, H());
    expect(node2.classList.contains("dir-rtl")).toBe(true);
  });

  test("نشان بخش پیشرو فقط با ui.lead — متن + tooltip قاعده‌ی ترتیب", () => {
    const sec = { dir: "ltr", entries: [EN("u-en1")] };
    const lead = HL.dashView.buildDirSection(sec, { lead: true }, H());
    const badge = lead.querySelector(".dir-sec-lead");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe("آخرین هایلایت اینجاست");
    expect(badge.title).toContain("بالاتر نمایش داده می‌شود");
    expect(lead.classList.contains("lead")).toBe(true);
    /* بدون lead → بدون نشان */
    const plain = HL.dashView.buildDirSection(sec, {}, H());
    expect(plain.querySelector(".dir-sec-lead")).toBe(null);
    expect(plain.classList.contains("lead")).toBe(false);
  });

  test("cardUi: وضعیت جمع‌شدگی هر کارت از کنترلر تزریق می‌شود (DIP — collapsedGroups اینجا نیست)", () => {
    const sec = { dir: "rtl", entries: [FA("u-fa1"), FA("u-fa2")] };
    const calls: string[] = [];
    const node = HL.dashView.buildDirSection(sec, {
      cardUi: (g: any) => { calls.push(g.key); return { collapsed: g.key === "u-fa2" }; },
    }, H());
    expect(calls).toEqual(["u-fa1", "u-fa2"]);
    const cards = node.querySelectorAll(".group");
    expect(cards[0].classList.contains("collapsed")).toBe(false);
    expect(cards[1].classList.contains("collapsed")).toBe(true);
    expect(cards[1].querySelector(".group-items").hidden).toBe(true); /* ui واقعاً به buildGroupCard رسیده */
  });

  test("بدون cardUi → کارت‌ها باز رندر می‌شوند (سازگاری زمینه‌های قدیمی)", () => {
    const node = HL.dashView.buildDirSection({ dir: "rtl", entries: [FA("u-fa1"), FA("u-fa2")] }, {}, H());
    node.querySelectorAll(".group").forEach((c: any) => {
      expect(c.classList.contains("collapsed")).toBe(false);
      expect(c.querySelector(".group-items").hidden).toBe(false);
    });
  });

  test("handlers عیناً به کارت‌ها می‌رسند (کلیک onOpen از داخل بخش)", () => {
    const calls: any[] = [];
    const node = HL.dashView.buildDirSection({ dir: "ltr", entries: [EN("u-en1")] }, {}, {
      onOpen: (g: any) => calls.push(g.key),
      onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {}, onCopy: () => {}, onDelete: () => {},
    });
    node.querySelector(".group-head button.icon-btn").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual(["u-en1"]);
  });

  test("remainingِ paginate سالم به کارت می‌رسد (item-more)", () => {
    const node = HL.dashView.buildDirSection({ dir: "rtl", entries: [Object.assign(FA("u-fa1"), { remaining: 7 })] }, {}, H());
    const more = node.querySelector(".item-more");
    expect(more).not.toBeNull();
    expect(more.textContent).toContain("۷");
  });

  test("کارت LTR داخل بخش ltr همچنان dir=ltr دارد (قرارداد smart-card v1.2.6 دست‌نخورده)", () => {
    const node = HL.dashView.buildDirSection({ dir: "ltr", entries: [EN("u-en1")] }, {}, H());
    expect(node.querySelector(".group").getAttribute("dir")).toBe("ltr");
  });

  test("entries خالی → بخش با شمار صفر و بدون کارت (بدون کرش)", () => {
    const node = HL.dashView.buildDirSection({ dir: "rtl", entries: [] }, { lead: true }, H());
    expect(node.querySelector(".dir-sec-count").textContent).toBe("۰ مقاله");
    expect(node.querySelectorAll(".group").length).toBe(0);
    expect(node.querySelector(".dir-sec-lead")).not.toBeNull(); /* نشان مستقل از تعداد است */
  });
});

/* ================= v0.5.0 — Collapsible direction sections ================= */

describe("buildDirSection — جمع/باز شدن بخش‌های جهت (v0.5.0)", () => {
  const H2 = (sectionCalls: any[], cardCalls: any[] = []) => ({
    onOpen: () => {}, onDeleteGroup: () => {},
    onToggle: (g: any, willCollapse: boolean) => cardCalls.push([g.key, willCollapse]),
    onSectionToggle: (dir: string, willCollapse: boolean) => sectionCalls.push([dir, willCollapse]),
    onView: () => {}, onCopy: () => {}, onDelete: () => {},
  });

  test("پیش‌فرض: بخش باز — بدون کلاس collapsed، بدنه نمایان، هدر role=button + aria-expanded=true + chevron", () => {
    const node = HL.dashView.buildDirSection({ dir: "rtl", entries: [FA("u-fa1")] }, {}, H2([]));
    expect(node.classList.contains("collapsed")).toBe(false);
    const head = node.querySelector(".dir-sec-head");
    const body = node.querySelector(".dir-sec-body");
    expect(head.getAttribute("role")).toBe("button");
    expect(head.tabIndex).toBe(0);
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(body.hidden).toBe(false);
    expect(body.contains(node.querySelector(".group"))).toBe(true); /* کارت‌ها داخل بدنه */
    const chev = head.querySelector(".dir-sec-chev");
    expect(chev).not.toBeNull();
    expect(chev.getAttribute("aria-hidden")).toBe("true");
    expect(chev.querySelector("svg polyline").getAttribute("points")).toBe("6 9 12 15 18 9"); /* همان گلیف chev کارت */
  });

  test("ui.collapsed=true → کلاس collapsed + بدنه hidden + aria-expanded=false؛ کارت‌ها ساخته می‌شوند ولی پنهان‌اند (سازوکار پنهان‌سازی همان group-items)", () => {
    const node = HL.dashView.buildDirSection(
      { dir: "ltr", entries: [EN("u-en1"), EN("u-en2")] },
      { collapsed: true },
      H2([])
    );
    expect(node.classList.contains("collapsed")).toBe(true);
    const head = node.querySelector(".dir-sec-head");
    const body = node.querySelector(".dir-sec-body");
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(body.hidden).toBe(true);
    expect(body.querySelectorAll(".group").length).toBe(2); /* رندر + پنهان — نه حذف */
  });

  test("کلیک روی هدر → toggle محلی DOM + همگام‌سازی کنترلر با (dir, true)", () => {
    const calls: any[] = [];
    const node = HL.dashView.buildDirSection({ dir: "ltr", entries: [EN("u-en1")] }, {}, H2(calls));
    const head = node.querySelector(".dir-sec-head");
    const body = node.querySelector(".dir-sec-body");
    head.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(node.classList.contains("collapsed")).toBe(true);
    expect(body.hidden).toBe(true);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(calls).toEqual([["ltr", true]]); /* dir درست + willCollapse درست */
  });

  test("کلیک دوباره → بازگشت کامل: کلاس برداشته، بدنه نمایان، (dir, false)", () => {
    const calls: any[] = [];
    const node = HL.dashView.buildDirSection({ dir: "rtl", entries: [FA("u-fa1")] }, {}, H2(calls));
    const head = node.querySelector(".dir-sec-head");
    const body = node.querySelector(".dir-sec-body");
    head.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    head.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(node.classList.contains("collapsed")).toBe(false);
    expect(body.hidden).toBe(false);
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(calls).toEqual([["rtl", true], ["rtl", false]]);
  });

  test("خودِ عنوان h2 (درخواستِ صریح مالک) → رویداد به هدر می‌رسد و بخش toggle می‌شود", () => {
    const calls: any[] = [];
    const node = HL.dashView.buildDirSection({ dir: "rtl", entries: [FA("u-fa1")] }, {}, H2(calls));
    node.querySelector("h2.dir-sec-title").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(node.classList.contains("collapsed")).toBe(true);
    expect(calls).toEqual([["rtl", true]]);
  });

  test("کیبورد: Enter و Space روی هدر toggle می‌کنند (با preventDefault)", () => {
    const calls: any[] = [];
    const node = HL.dashView.buildDirSection({ dir: "rtl", entries: [FA("u-fa1")] }, {}, H2(calls));
    const head = node.querySelector(".dir-sec-head");
    const enterOk = head.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(enterOk).toBe(false); /* پیش‌فرضprevent شد */
    expect(node.classList.contains("collapsed")).toBe(true);
    expect(calls).toEqual([["rtl", true]]);
    const spaceOk = head.dispatchEvent(new win.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    expect(spaceOk).toBe(false);
    expect(node.classList.contains("collapsed")).toBe(false); /* برگشت */
    expect(calls).toEqual([["rtl", true], ["rtl", false]]);
    /* کلیدهای بی‌اثر → هیچ */
    head.dispatchEvent(new win.KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }));
    expect(calls.length).toBe(2);
  });

  test("کلیک روی هدر یک کارتِ داخل بدنه → فقط همان کارت toggle می‌شود، نه کل بخش (مجزایی سطح‌ها)", () => {
    const sectionCalls: any[] = [];
    const cardCalls: any[] = [];
    const node = HL.dashView.buildDirSection(
      { dir: "rtl", entries: [FA("u-fa1")] },
      {},
      H2(sectionCalls, cardCalls)
    );
    node.querySelector(".group-head").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(cardCalls).toEqual([["u-fa1", true]]); /* کارت جمع شد */
    expect(sectionCalls).toEqual([]); /* بخش دست‌نخورده */
    expect(node.classList.contains("collapsed")).toBe(false);
    expect(node.querySelector(".dir-sec-body").hidden).toBe(false);
  });

  test("بدون onSectionToggle → هدر همچنان DOM خودش را toggle می‌کند (همگام‌سازی اختیاری — قرارداد buildOrderBtn)", () => {
    /* زمینه‌ی قدیمی: هندلرهای v0.4.0 بدون onSectionToggle */
    const legacyH = {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {},
      onView: () => {}, onCopy: () => {}, onDelete: () => {},
    };
    const node = HL.dashView.buildDirSection({ dir: "rtl", entries: [FA("u-fa1")] }, {}, legacyH);
    const head = node.querySelector(".dir-sec-head");
    head.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(node.classList.contains("collapsed")).toBe(true);
    expect(node.querySelector(".dir-sec-body").hidden).toBe(true);
    expect(head.getAttribute("aria-expanded")).toBe("false");
  });

  test("جهتِ رویداد مستقل از محتوا: بخش LTR با هندلر RTL-دار هم 'ltr' می‌فرستد", () => {
    const calls: any[] = [];
    const node = HL.dashView.buildDirSection({ dir: "ltr", entries: [EN("u-en1")] }, {}, H2(calls));
    node.querySelector(".dir-sec-head").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["ltr", true]]);
  });

  test("بخش collapsed از ابتدا + کلیک → باز می‌شود (مسیر شروعِ جمع‌شده هم قرارداد کامل دارد)", () => {
    const calls: any[] = [];
    const node = HL.dashView.buildDirSection(
      { dir: "rtl", entries: [FA("u-fa1")] },
      { collapsed: true },
      H2(calls)
    );
    expect(node.classList.contains("collapsed")).toBe(true);
    node.querySelector(".dir-sec-head").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(node.classList.contains("collapsed")).toBe(false);
    expect(node.querySelector(".dir-sec-body").hidden).toBe(false);
    expect(calls).toEqual([["rtl", false]]);
  });
});

/* ================= v0.3.0 — Bulk expand/collapse toggle ================= */

describe("renderBulkToggle — دکمه‌ی باز/بستن گروهی (v0.3.0)", () => {
  const mkBtn = () => {
    const b = win.document.createElement("button");
    b.type = "button";
    b.hidden = true;
    return b;
  };
  /* هندسه‌ی آیکن را ساختاری می‌سنجیم (نه رشته‌ی سریالایز‌شده — happy-dom
     تگ‌های self-closing را بسته سریال می‌کند؛ محتوا یکی است) */
  const polysOf = (btn: any) =>
    Array.from(btn.querySelectorAll(".bt-ic polyline")).map((pl: any) => pl.getAttribute("points"));
  const CHEVS_DOWN = ["6 7 12 13 18 7", "6 13 12 19 18 13"];
  const CHEVS_UP = ["6 13 12 7 18 13", "6 19 12 13 18 19"];

  test("action='' → دکمه مخفی می‌ماند (لیست خالی؛ چیزی برای toggle نیست)", () => {
    const btn = mkBtn();
    HL.dashView.renderBulkToggle(btn, "");
    expect(btn.hidden).toBe(true);
  });

  test("action نامعتبر → مخفی (دفاعی)", () => {
    const btn = mkBtn();
    HL.dashView.renderBulkToggle(btn, "nonsense" as any);
    expect(btn.hidden).toBe(true);
  });

  test("'expand' → نمایان با برچسب «باز کردن همه‌ی مقاله‌ها» و آیکن chevsDown و tooltip", () => {
    const btn = mkBtn();
    HL.dashView.renderBulkToggle(btn, "expand");
    expect(btn.hidden).toBe(false);
    expect(btn.querySelector(".bt-lbl").textContent).toBe("باز کردن همه‌ی مقاله‌ها");
    expect(polysOf(btn)).toEqual(CHEVS_DOWN);
    expect(btn.title).toContain("هایلایت‌های بارگذاری‌نشده"); /* tooltip قول بارگذاری کامل را می‌دهد */
    expect(btn.getAttribute("aria-label")).toBe(null); /* برچسب مرئی خودش name است */
  });

  test("'collapse' → برچسب «بستن همه‌ی مقاله‌ها» و آیکن chevsUp (جفتِ قرینه expand)", () => {
    const btn = mkBtn();
    HL.dashView.renderBulkToggle(btn, "collapse");
    expect(btn.hidden).toBe(false);
    expect(btn.querySelector(".bt-lbl").textContent).toBe("بستن همه‌ی مقاله‌ها");
    expect(polysOf(btn)).toEqual(CHEVS_UP);
    expect(btn.title).toContain("کامل نمایش داده می‌شوند"); /* توضیح حالت بسته */
  });

  test("آیکن تزئینی است (aria-hidden) و آیکن‌ها جفت قرینه‌اند (بالا/پایین)", () => {
    const btn = mkBtn();
    HL.dashView.renderBulkToggle(btn, "expand");
    expect(btn.querySelector(".bt-ic").getAttribute("aria-hidden")).toBe("true");
    expect(HL.dashView.ICONS.chevsDown).not.toBe(HL.dashView.ICONS.chevsUp);
    expect(HL.dashView.ICONS.chevsDown).toContain("12 13 18 7"); /* شورون پایین */
    expect(HL.dashView.ICONS.chevsUp).toContain("12 7 18 13"); /* قرینه‌ی عمودی */
  });

  test("بازرندر روی همان دکمه: برچسب/آیکن عوض می‌شود، بدون تکثیر گره (idempotent)", () => {
    const btn = mkBtn();
    HL.dashView.renderBulkToggle(btn, "expand");
    HL.dashView.renderBulkToggle(btn, "collapse");
    expect(btn.querySelectorAll(".bt-ic").length).toBe(1);
    expect(btn.querySelectorAll(".bt-lbl").length).toBe(1);
    expect(btn.querySelector(".bt-lbl").textContent).toBe("بستن همه‌ی مقاله‌ها");
    expect(polysOf(btn)).toEqual(CHEVS_UP);
    /* و بازگشت */
    HL.dashView.renderBulkToggle(btn, "expand");
    expect(btn.querySelector(".bt-lbl").textContent).toBe("باز کردن همه‌ی مقاله‌ها");
    expect(polysOf(btn)).toEqual(CHEVS_DOWN);
    expect(btn.querySelectorAll(".bt-ic").length).toBe(1);
  });

  test("مخفی‌سازی بعد از نمایان شدن: '' روی دکمه‌ی باز → hidden برمی‌گردد (لیست خالی شد)", () => {
    const btn = mkBtn();
    HL.dashView.renderBulkToggle(btn, "expand");
    expect(btn.hidden).toBe(false);
    HL.dashView.renderBulkToggle(btn, "");
    expect(btn.hidden).toBe(true);
  });

  test("روی دکمه‌ی لخت (بدون ساختار داخلی) هم کار می‌کند — سازنده خودش گره‌ها را می‌سازد", () => {
    const btn = win.document.createElement("button"); /* حتی hidden هم ندارد */
    HL.dashView.renderBulkToggle(btn, "expand");
    expect(btn.hidden).toBe(false);
    expect(btn.querySelector(".bt-lbl").textContent).toBe("باز کردن همه‌ی مقاله‌ها");
    expect(btn.querySelector(".bt-ic svg")).not.toBeNull();
    expect(btn.textContent.trim()).toBe("باز کردن همه‌ی مقاله‌ها"); /* متن دکمه فقط برچسب است */
  });
});

/* ================= v0.4.0 — Per-card item order pill ================= */

describe("دکمه‌ی ترتیب کارت — buildOrderBtn از طریق buildGroupCard (v0.4.0)", () => {
  const H = (calls: any[]) => ({
    onOpen: () => {}, onDeleteGroup: () => {}, onToggle: (_g: any, w: boolean) => calls.push(["toggle", w]),
    onItemOrder: (g: any) => calls.push(["order", g.key]),
    onView: () => {}, onCopy: () => {}, onDelete: () => {},
  });

  test("کارت چندهایلایتی: pill با آیکن ترتیب + برچسب «جدیدترین» (پیش‌فرض) + tooltip و aria-label", () => {
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, H([]));
    const ob = card.querySelector(".group-head .order-btn");
    expect(ob).not.toBeNull();
    expect(ob.querySelector(".order-ic svg")).not.toBeNull();
    expect(ob.querySelector(".order-ic").getAttribute("aria-hidden")).toBe("true"); /* آیکن تزئینی */
    expect(ob.textContent).toBe("جدیدترین");
    expect(ob.title).toContain("از جدیدترین به قدیمی‌ترین"); /* tooltip حالت فعلی */
    expect(ob.title).toContain("برای تغییر ترتیب"); /* و قول flip */
    expect(ob.getAttribute("aria-label")).toBe("ترتیب نمایش هایلایت‌های این مقاله: جدیدترین");
    expect(ob.type).toBe("button");
  });

  test("ui.order='oldest' → برچسب «قدیمی‌ترین» (برچسب = ترتیبِ فعلی، نه کنش بعدی)", () => {
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false, order: "oldest" }, H([]));
    const ob = card.querySelector(".group-head .order-btn");
    expect(ob.textContent).toBe("قدیمی‌ترین");
    expect(ob.title).toContain("از قدیمی‌ترین به جدیدترین");
  });

  test("ui.order='page'/'page-rev' → برچسب‌های «صفحه» و «برعکسِ صفحه» (زیر مرتب‌سازی صفحه‌ای)", () => {
    const c1 = HL.dashView.buildGroupCard(G(), 0, { collapsed: false, order: "page" }, H([]));
    expect(c1.querySelector(".order-btn").textContent).toBe("صفحه");
    const c2 = HL.dashView.buildGroupCard(G(), 0, { collapsed: false, order: "page-rev" }, H([]));
    expect(c2.querySelector(".order-btn").textContent).toBe("برعکسِ صفحه");
  });

  test("ui.order نامعتبر → افت به «جدیدترین» (دفاعی؛ برچسب هرگز خالی نمی‌ماند)", () => {
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false, order: "nonsense" as any }, H([]));
    expect(card.querySelector(".order-btn").textContent).toBe("جدیدترین");
  });

  test("کلیک روی pill → فقط onItemOrder(g)؛ collapse هرگز رخ نمی‌دهد (جداسازی کنش‌ها)", () => {
    const calls: any[] = [];
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, H(calls));
    const ob = card.querySelector(".group-head .order-btn");
    ob.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["order", "https://example.com/p1"]]); /* نه toggle، نه چیز دیگر */
    expect(card.classList.contains("collapsed")).toBe(false);
  });

  test("کلیک روی pill داخل کارتِ جمع‌شده → کارت جمع‌شده می‌ماند (flip در حالت بسته هم مجاز)", () => {
    const calls: any[] = [];
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: true, order: "newest" }, H(calls));
    const ob = card.querySelector(".group-head .order-btn");
    ob.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["order", "https://example.com/p1"]]);
    expect(card.classList.contains("collapsed")).toBe(true); /* جمع‌شدگی دست‌نخورده */
  });

  test("کارت تک‌هایلایتی → pill ندارد (چیزی برای چرخاندن نیست)", () => {
    const g = Object.assign(G(), { items: [G().items[0]] });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H([]));
    expect(card.querySelector(".order-btn")).toBeNull();
  });

  test("کارت با remaining>0 (مجموع ≥ ۲) → pill دارد؛ remaining=0 و تک‌آیتمی → ندارد", () => {
    const calls: any[] = [];
    const withMore = HL.dashView.buildGroupCard(G(), 3, { collapsed: false }, H(calls)); /* ۲+۳=۵ */
    expect(withMore.querySelector(".order-btn")).not.toBeNull();
    const g1 = Object.assign(G(), { items: [G().items[0]] });
    const single = HL.dashView.buildGroupCard(g1, 0, { collapsed: false }, H(calls));
    expect(single.querySelector(".order-btn")).toBeNull();
  });

  test("بدون onItemOrder → pill به‌صورت state chip بی‌اثنر رندر می‌شود (تقدمِ نمایش؛ بدون خطا)", () => {
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false, order: "oldest" }, {
      onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {}, onView: () => {},
    });
    const ob = card.querySelector(".group-head .order-btn");
    expect(ob).not.toBeNull();
    expect(ob.textContent).toBe("قدیمی‌ترین");
    /* کلیک هیچ کنشی trigger نمی‌کند و خطا هم نمی‌دهد */
    ob.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(card.classList.contains("collapsed")).toBe(false);
  });

  test("جانمایی: pill بین چیپ‌های شمارش و شورون، قبل از دکمه‌های open/delete", () => {
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, H([]));
    const head = card.querySelector(".group-head");
    const classes = Array.from(head.children).map((c: any) => c.className.split(" ")[0]);
    expect(classes).toEqual(["fl", "group-txt", "gchips", "order-btn", "chev", "icon-btn", "icon-btn"]);
  });

  test("قراردادهای موجود دست‌نخورده: دکمه‌های icon-btn هنوز ۲ تا هستند و چیپ‌ها ۲ تا", () => {
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, H([]));
    const head = card.querySelector(".group-head");
    expect(head.querySelectorAll("button.icon-btn").length).toBe(2);
    expect(head.querySelectorAll(".chip").length).toBe(2);
  });

  test("Enter روی pill (کیبورد) toggle نمی‌کند — گاردِ button در keydown هدر", () => {
    const calls: any[] = [];
    const card = HL.dashView.buildGroupCard(G(), 0, { collapsed: false }, H(calls));
    const ob = card.querySelector(".group-head .order-btn");
    ob.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(calls).toEqual([]); /* نه toggle (و نه order — کنشِ کلیکِ خودِ دکمه است) */
    expect(card.classList.contains("collapsed")).toBe(false);
  });
});

describe("fillBookletSummary — خلاصه‌ی مودال خروجی‌ها (v0.6.0)", () => {
  test("سه ردیف sum-row با برچسب‌های فارسی و ارقام فارسی", () => {
    const box = document.createElement("div");
    HL.dashView.fillBookletSummary(box, { total: 7, notes: 3, pages: 4, sites: 2 });
    const rows = box.querySelectorAll(".sum-row");
    expect(rows.length).toBe(3);
    const txt = (i: number) => rows[i].textContent || "";
    expect(txt(0)).toContain("هایلایت‌ها");
    expect(txt(0)).toContain("۷");
    expect(txt(1)).toContain("مقاله‌ها");
    expect(txt(1)).toContain("۴");
    expect(txt(2)).toContain("یادداشت‌ها");
    expect(txt(2)).toContain("۳");
  });

  test("stats نبود → صفرها (هرگز NaN یا خالی)", () => {
    const box = document.createElement("div");
    box.innerHTML = "<div class='sum-row'>stale</div>"; /* باید پاک شود */
    HL.dashView.fillBookletSummary(box, null as any);
    const rows = box.querySelectorAll(".sum-row");
    expect(rows.length).toBe(3);
    Array.from(rows).forEach((r) => expect(r.textContent).toContain("۰"));
  });

  test("فقط textContent — محتوای کاربر هرگز HTML نمی‌شود (XSS قرارداد view)", () => {
    const box = document.createElement("div");
    HL.dashView.fillBookletSummary(box, { total: 1, notes: 0, pages: 1, sites: 1 });
    expect(box.querySelector("script")).toBeNull();
    expect(box.innerHTML).not.toContain("<script");
  });
});

/* ================= v0.6.2 — جهت دو سطحی: چیپ کروم RTL + متن تگ محتوا ================= */

describe("برچسب‌های هوشمند — چیپ همیشه RTL، متن تگ جهت خودش (v0.6.2)", () => {
  const H = (calls: any[]) => ({
    onOpen: () => {}, onDeleteGroup: () => {}, onToggle: () => {},
    onView: () => {}, onCopy: () => {}, onDelete: () => {},
    onAddTag: (g: any, t: string) => calls.push(["add", g.key, t]),
    onRemoveTag: (g: any, t: string) => calls.push(["remove", g.key, t]),
  });

  test("چیپ همیشه dir=rtl (کروم فارسی) — تگ فارسی و انگلیسی، در کارت RTL و LTR: X همیشه در انتهای خواندن (چپ)", () => {
    const calls: any[] = [];
    const rtlCard = HL.dashView.buildGroupCard(Object.assign(G(), { dir: "rtl", tags: ["پژوهش", "frontend"] }), 0, { collapsed: false }, H(calls));
    const ltrCard = HL.dashView.buildGroupCard(Object.assign(G(), { dir: "ltr", title: "LTR article", tags: ["پژوهش", "frontend"] }), 0, { collapsed: false }, H(calls));
    /* یک شکل همه‌جا: [× متن] — X در انتهای جریان خواندن RTL (چپ)؛ تگ انگلیسی دیگر X را در راست (ابتدای خواندن) نمی‌گذارد — همان به‌هم‌ریختگی گزارش‌شده */
    rtlCard.querySelectorAll(".atag").forEach((c: Element) => expect(c.getAttribute("dir")).toBe("rtl"));
    ltrCard.querySelectorAll(".atag").forEach((c: Element) => expect(c.getAttribute("dir")).toBe("rtl"));
  });

  test("جهت متن تگ روی .atag-t — فارسی rtl / انگلیسی ltr، در هر دو جهت کارت (ناوردایی v1.2.12 در سطح برچسب)", () => {
    const calls: any[] = [];
    const rtlCard = HL.dashView.buildGroupCard(Object.assign(G(), { dir: "rtl", tags: ["پژوهش", "frontend"] }), 0, { collapsed: false }, H(calls));
    const ltrCard = HL.dashView.buildGroupCard(Object.assign(G(), { dir: "ltr", title: "LTR article", tags: ["پژوهش", "frontend"] }), 0, { collapsed: false }, H(calls));
    const dirs = (card: Element) => Array.from(card.querySelectorAll(".atag-t")).map((l: Element) => l.getAttribute("dir"));
    expect(dirs(rtlCard)).toEqual(["rtl", "ltr"]); /* همان متن، همان جهت — همه‌جا */
    expect(dirs(ltrCard)).toEqual(["rtl", "ltr"]);
  });

  test("تگ خنثی (فقط رقم) → برچسب بدون dir — از rtl چیپ ارث می‌برد (قرارداد نقل‌قول/یادداشت در سطح برچسب)", () => {
    const calls: any[] = [];
    const g = Object.assign(G(), { tags: ["2024"] });
    const chip = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H(calls)).querySelector(".atag");
    expect(chip.getAttribute("dir")).toBe("rtl"); /* چیپ همچنان کروم RTL */
    expect(chip.querySelector(".atag-t").getAttribute("dir")).toBe(null); /* ارث از چیپ */
  });

  test("تگ لاتین چندواژه‌ای → برچسب dir=ltr — ترتیب واژه‌ها و علامت پایانی داخل چیپ RTL حفظ می‌شود", () => {
    const calls: any[] = [];
    const g = Object.assign(G(), { dir: "ltr", tags: ["web design notes!"] });
    const chip = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H(calls)).querySelector(".atag");
    expect(chip.getAttribute("dir")).toBe("rtl"); /* قاب کروم ثابت */
    expect(chip.querySelector(".atag-t").getAttribute("dir")).toBe("ltr"); /* محتوا در جهت خودش */
  });

  test("دکمه‌ی افزودن «+ برچسب» → همیشه dir=rtl — کروم فارسی، در هر دو جهت کارت (قاعده‌ی faEl v0.5.2)", () => {
    const calls: any[] = [];
    const rtl = HL.dashView.buildGroupCard(Object.assign(G(), { dir: "rtl", tags: [] }), 0, { collapsed: false }, H(calls)).querySelector("button.atag-add");
    const ltr = HL.dashView.buildGroupCard(Object.assign(G(), { dir: "ltr", tags: [] }), 0, { collapsed: false }, H(calls)).querySelector("button.atag-add");
    expect(rtl.getAttribute("dir")).toBe("rtl");
    expect(ltr.getAttribute("dir")).toBe("rtl"); /* چیدمان + و «برچسب» در LTR همان RTL است — دیگر به‌هم‌ریخته نمی‌شود */
  });

  test("ورودی خطی برچسب → dir=auto (تشخیص اولین نویسه‌ی قوی هنگام تایپ)", () => {
    const calls: any[] = [];
    const card = HL.dashView.buildGroupCard(Object.assign(G(), { tags: [] }), 0, { collapsed: false }, H(calls));
    card.querySelector("button.atag-add").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    const inp = card.querySelector("input.tag-input");
    expect(inp.getAttribute("dir")).toBe("auto");
  });

  test("بازگشت: دکمه‌ی حذف و افزودن همچنان کار می‌کنند (ساختار چیپ دست‌نخورده)", () => {
    const calls: any[] = [];
    const g = Object.assign(G(), { dir: "ltr", tags: ["پژوهش"] });
    const card = HL.dashView.buildGroupCard(g, 0, { collapsed: false }, H(calls));
    card.querySelector(".atag button.atag-x").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["remove", "https://example.com/p1", "پژوهش"]]);
    expect(card.querySelector("button.atag-add").getAttribute("dir")).toBe("rtl");
  });
});

/* ================= v0.6.1 — پنجره‌ی شناور متن کامل ================= */

/* ================= v0.6.3 — سرِ پنجره = عنوان خودِ مقاله ================= */

describe("fillHighlightTitle — عنوان مقاله در سرِ پنجره‌ی شناور (v0.6.3)", () => {
  test("عنوان رکورد — همان زنجیره‌ی سرصفحه‌ی کارت: title → host → url", () => {
    const h1 = document.createElement("h2");
    HL.dashView.fillHighlightTitle(h1, { title: "Using logical properties", host: "developer.mozilla.org", url: "https://developer.mozilla.org/docs/Web/CSS" });
    expect(h1.textContent).toBe("Using logical properties");
    expect(h1.title).toBe("Using logical properties"); /* tooltip = همان متن کامل */

    const h2 = document.createElement("h2");
    HL.dashView.fillHighlightTitle(h2, { host: "fa.wikipedia.org", url: "https://fa.wikipedia.org/wiki/X" });
    expect(h2.textContent).toBe("fa.wikipedia.org"); /* عنوان خالی → دامنه */

    const h3 = document.createElement("h2");
    HL.dashView.fillHighlightTitle(h3, { url: "https://example.com/a" });
    expect(h3.textContent).toBe("https://example.com/a"); /* دامنه هم نبود → url */
  });

  test("همه خالی → «بدون عنوان» — همان placeholder سرصفحه‌ی کارت (یک سیاست، دو سطح)", () => {
    const h = document.createElement("h2");
    HL.dashView.fillHighlightTitle(h, {});
    expect(h.textContent).toBe("بدون عنوان");
    expect(h.title).toBe("بدون عنوان");
  });

  test("عنوان بلند → excerpt ۶۰ نویسه با «…» (همان حد کارت)؛ tooltip کامل می‌ماند", () => {
    const long = "A very long article title about logical properties and writing modes ".repeat(3).trim();
    const h = document.createElement("h2");
    HL.dashView.fillHighlightTitle(h, { title: long });
    expect(h.textContent.length).toBe(61); /* ۶۰ نویسه + «…» */
    expect(h.textContent.endsWith("…")) .toBe(true);
    expect(h.title).toBe(long); /* tooltip بریده نمی‌شود (قرارداد .group-url) */
  });

  test("جهت عنوان: فارسی rtl / انگلیسی ltr / خنثی بدون attr — و ریست idempotent", () => {
    const h = document.createElement("h2");
    HL.dashView.fillHighlightTitle(h, { title: "Understanding logical properties" });
    expect(h.getAttribute("dir")).toBe("ltr");
    HL.dashView.fillHighlightTitle(h, { title: "دانشنامه‌ی فارسی" });
    expect(h.getAttribute("dir")).toBe("rtl"); /* ltr قبلی جایگزین شد */
    HL.dashView.fillHighlightTitle(h, { title: "12345" });
    expect(h.getAttribute("dir")).toBe(null); /* خنثی → بدون attr، ارث بری سند */
  });

  test("XSS: عنوان فقط textContent — HTML زنده نمی‌شود", () => {
    const h = document.createElement("h2");
    HL.dashView.fillHighlightTitle(h, { title: "<img src=x onerror=alert(1)>" });
    expect(h.querySelector("img")).toBeNull();
    expect(h.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});

/* ================= v0.6.4 — پنجره‌ی شناور کاملاً هوشمند جهت ================= */

describe("fillHighlightDir — جهت قاب پنجره‌ی شناور (v0.6.4)", () => {
  /* The frame joins the direction granularities: the window itself turns to
     the record's text — LTR window for an English highlight, RTL for Persian,
     neutral inherits the doc's rtl. Same decision source as every content
     surface (detectTextDir) — no new policy. */
  test("متن انگلیسی → پنجره LTR؛ متن فارسی → پنجره RTL — همان منبع تصمیم همه‌ی سطوح", () => {
    const ltr = document.createElement("div");
    HL.dashView.fillHighlightDir(ltr, { text: "An English highlight quoted verbatim" });
    expect(ltr.getAttribute("dir")).toBe("ltr");

    const rtl = document.createElement("div");
    HL.dashView.fillHighlightDir(rtl, { text: "متن فارسی هایلایت شده" });
    expect(rtl.getAttribute("dir")).toBe("rtl");
  });

  test("خنثی (بدون حرف جهت‌دار) → بدون attr — ارث‌بری rtl سند، پیش‌فرض محافظه‌کار", () => {
    const card = document.createElement("div");
    HL.dashView.fillHighlightDir(card, { text: "12345 67890" });
    expect(card.getAttribute("dir")).toBe(null);
  });

  test("idempotent با ریست صریح: بازکردن رکورد بعدی جهت قبلی را می‌پاکد", () => {
    const card = document.createElement("div");
    HL.dashView.fillHighlightDir(card, { text: "An English highlight" });
    expect(card.getAttribute("dir")).toBe("ltr");
    HL.dashView.fillHighlightDir(card, { text: "متن فارسی" });
    expect(card.getAttribute("dir")).toBe("rtl"); /* ltr قبلی جایگزین شد */
    HL.dashView.fillHighlightDir(card, { text: "12345" });
    expect(card.getAttribute("dir")).toBe(null); /* خنثی → attr برداشته شد */
  });

  test("رکورد ناموجود/بی‌متن → خنثی (بدون کرش، بدون attr) — LSP زمینه‌های قدیمی", () => {
    const card = document.createElement("div");
    HL.dashView.fillHighlightDir(card, {});
    expect(card.getAttribute("dir")).toBe(null);
    HL.dashView.fillHighlightDir(card, null as any);
    expect(card.getAttribute("dir")).toBe(null);
  });
});

describe("fillHighlightPreview — بدنه‌ی پنجره‌ی متن کامل (v0.6.1)", () => {
  test("متن کامل بدون excerpt — حتی وقتی کارت قطع می‌کرد؛ ساختار quote+bar", () => {
    const long = "این متن خیلی طولانی است و ".repeat(30).trim() + " — پایان.";
    const box = document.createElement("div");
    HL.dashView.fillHighlightPreview(box, { text: long, note: "", color: "teal", createdAt: 1700000000000, updatedAt: 1700000000000 });
    const q = box.querySelector(".hl-quote");
    expect(q).not.toBeNull();
    expect(q!.querySelector(".hl-quote-t")!.textContent).toBe(long); /* واژه‌به‌واژه، بدون «…» */
    expect((q!.querySelector(".cbar") as HTMLElement).style.background).toBe("#35b3ae"); /* نوار رنگ همان dot رنگ */
  });

  test("یادداشت کامل وقتی هست؛ بدون یادداشت → بدون عنصر .note", () => {
    const withNote = document.createElement("div");
    HL.dashView.fillHighlightPreview(withNote, { text: "متن", note: "یادداشت کامل", color: "green", createdAt: 1, updatedAt: 2 });
    expect(withNote.querySelector(".note .note-text")!.textContent).toBe("یادداشت کامل");
    expect(withNote.querySelector(".note .note-ic")).not.toBeNull(); /* همان ردیف آیکون‌دار کارت */

    const noNote = document.createElement("div");
    HL.dashView.fillHighlightPreview(noNote, { text: "متن", note: "", color: "green", createdAt: 1, updatedAt: 2 });
    expect(noNote.querySelector(".note")).toBeNull();
  });

  test("جهت‌ها همان قرارداد کارت: نقل‌قول فارسی rtl / انگلیسی ltr؛ ردیف یادداشت از خودش", () => {
    const fa = document.createElement("div");
    HL.dashView.fillHighlightPreview(fa, { text: "متن فارسی", note: "یادداشت فارسی", color: "yellow", createdAt: 1, updatedAt: 2 });
    expect(fa.querySelector(".hl-quote")!.getAttribute("dir")).toBe("rtl");
    expect(fa.querySelector(".note")!.getAttribute("dir")).toBe("rtl");

    const mirror = document.createElement("div"); /* آینه: انگلیسی + یادداشت فارسی */
    HL.dashView.fillHighlightPreview(mirror, { text: "An English highlight quoted verbatim", note: "یادداشت فارسی روی هایلایت انگلیسی", color: "green", createdAt: 1, updatedAt: 2 });
    expect(mirror.querySelector(".hl-quote")!.getAttribute("dir")).toBe("ltr");
    expect(mirror.querySelector(".note")!.getAttribute("dir")).toBe("rtl");

    const neutral = document.createElement("div");
    HL.dashView.fillHighlightPreview(neutral, { text: "12345", note: "", color: "yellow", createdAt: 1, updatedAt: 2 });
    expect(neutral.querySelector(".hl-quote")!.getAttribute("dir")).toBe(null);
  });

  test("خط متا (v0.6.4): ردیف بی‌dir + جزیره‌ی inline RTL (.hl-meta-t) — چینش از قاب، ترتیب از زبان", () => {
    const box = document.createElement("div");
    HL.dashView.fillHighlightPreview(box, { text: "An English highlight", note: "", color: "pink", createdAt: 1700000000000, updatedAt: 1700000000000 });
    const meta = box.querySelector(".hl-meta")!;
    expect(meta.getAttribute("dir")).toBe(null); /* ردیف جریان قاب است — نه جزیره‌ی dir دار */
    const island = meta.querySelector(".hl-meta-t")!;
    expect(island).not.toBeNull();
    expect(island.getAttribute("dir")).toBe("rtl"); /* تاریخ fa-IR در جزیره‌ی inline RTL خودش — همان idiom تاریخ آیتم کارت */
    expect(meta.textContent).not.toContain("صورتی"); /* نام رنگ دیگر نیست — در هر رجیستری */
    (Object.keys(HL.COLORS) || []).forEach(function (k: string) {
      expect(meta.textContent).not.toContain(HL.COLORS[k].label); /* هیچ نام رنگی */
    });
    expect(meta.textContent).toMatch(/[۰-۹]/); /* تاریخ fa-IR حاضر است */
    expect(meta.textContent).not.toContain("NaN"); /* قرارداد تاریخ نامعتبر */
    expect(meta.textContent).not.toContain("·"); /* جداکننده‌ی قدیمی هم رفت */
  });

  test("XSS: متن و یادداشت فقط textContent — HTML زنده نمی‌شود", () => {
    const box = document.createElement("div");
    HL.dashView.fillHighlightPreview(box, { text: "<img src=x onerror=alert(1)>", note: "<script>alert(2)</script>", color: "yellow", createdAt: 1, updatedAt: 2 });
    expect(box.querySelector("img")).toBeNull();
    expect(box.querySelector("script")).toBeNull();
    expect(box.querySelector(".hl-quote-t")!.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(box.querySelector(".note-text")!.textContent).toBe("<script>alert(2)</script>");
  });

  test("خالص و idempotent: پرکردن دوباره محتوای قبلی را کامل می‌پاکد", () => {
    const box = document.createElement("div");
    HL.dashView.fillHighlightPreview(box, { text: "اول", note: "یادداشت اول", color: "yellow", createdAt: 1, updatedAt: 2 });
    HL.dashView.fillHighlightPreview(box, { text: "دوم", note: "", color: "green", createdAt: 3, updatedAt: 4 });
    expect(box.querySelectorAll(".hl-quote").length).toBe(1);
    expect(box.querySelector(".hl-quote-t")!.textContent).toBe("دوم");
    expect(box.querySelector(".note")).toBeNull(); /* یادداشت رکورد اول نمانده */
    expect(box.textContent).not.toContain("اول");
  });
});

describe("buildItemCard — سطح کلیک پیش‌نمایش (v0.6.1)", () => {
  test("با onPreview: نقل‌قول role=button + tabIndex + Enter/Space؛ کلیک → onPreview(rec)", () => {
    const calls: any[] = [];
    const rec = { id: "p1", text: "متن هایلایت", note: "", color: "green", createdAt: 1, updatedAt: 2 };
    const item = HL.dashView.buildItemCard(rec, {
      onView: () => {}, onCopy: () => {}, onDelete: () => {},
      onPreview: (r: any) => calls.push(["preview", r.id]),
    });
    const q = item.querySelector(".item-text");
    expect(q.getAttribute("role")).toBe("button");
    expect(q.tabIndex).toBe(0);
    expect(q.classList.contains("peek")).toBe(true);
    q.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    q.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    q.dispatchEvent(new win.KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(calls).toEqual([["preview", "p1"], ["preview", "p1"], ["preview", "p1"]]);
  });

  test("ردیف یادداشت هم سطح کلیک است (ماوس) — همان مودال، بدون توقف تب اضافه", () => {
    const calls: any[] = [];
    const rec = { id: "p2", text: "متن", note: "یادداشت", color: "green", createdAt: 1, updatedAt: 2 };
    const item = HL.dashView.buildItemCard(rec, {
      onView: () => {}, onCopy: () => {}, onDelete: () => {},
      onPreview: (r: any) => calls.push(["preview", r.id]),
    });
    const note = item.querySelector(".note");
    expect(note.classList.contains("peek")).toBe(true);
    expect(note.getAttribute("role")).toBe(null); /* مسیر کیبورد از نقل‌قول است */
    note.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["preview", "p2"]]);
  });

  test("بدون onPreview (زمینه‌های قدیمی): هیچ role/tabIndex/peek — متن ساده می‌ماند (LSP)", () => {
    const item = HL.dashView.buildItemCard({ id: "p3", text: "متن", note: "یادداشت", color: "green", createdAt: 1, updatedAt: 2 }, {
      onView: () => {}, onCopy: () => {}, onDelete: () => {},
    });
    const q = item.querySelector(".item-text");
    expect(q.getAttribute("role")).toBe(null);
    expect(q.getAttribute("tabindex")).toBe(null);
    expect(q.classList.contains("peek")).toBe(false);
    expect(item.querySelector(".note").classList.contains("peek")).toBe(false);
    q.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); /* هیچ اتفاقی نمی‌افتد */
  });

  test("کلیک پیش‌نمایش دکمه‌های کنش را نمی‌شکند — view/copy همچنان مستقل", () => {
    const calls: any[] = [];
    const rec = { id: "p4", text: "متن", note: "", color: "green", createdAt: 1, updatedAt: 2 };
    const item = HL.dashView.buildItemCard(rec, {
      onView: (r: any) => calls.push(["view", r.id]),
      onCopy: (r: any) => calls.push(["copy", r.id]),
      onDelete: () => {},
      onPreview: (r: any) => calls.push(["preview", r.id]),
    });
    const btns = item.querySelectorAll(".item-actions button");
    btns[0].dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    btns[1].dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([["view", "p4"], ["copy", "p4"]]); /* preview در میان نبود */
  });
});
