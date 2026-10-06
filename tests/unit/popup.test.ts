/**
 * Popup tests — smart-direction page card (v1.2.7) + precise scoping (v1.2.8)
 *
 * popup.js is a closed controller; for unit testing we load the real
 * popup.html markup (extracted at runtime — drift-proof against the source)
 * + the full engine + a chrome mock (storage + tabs), and observe the real
 * init → renderPage render behavior from the outside.
 * Since the v1.2.9 MVC split, await boot() evals the trio (popup-data.js →
 * popup-view.js → popup.js) in page order, plus shared/theme-boot.js (the
 * real <head> script that owns the shared HL.applyThemeNow the controller calls).
 * Core contract: direction comes from HL.detectDir.contentDir — LTR only for
 * "the page's own content" (page card + list items); the Persian list-section
 * header (strong + counter) and RTL ones never get dir (inherit the
 * document's rtl).
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, ext, readFile, makeChromeMock, sleep } from "./helpers/engine";

let HL: any;
let win: any;

/* real popup body markup — exactly what the user sees (drift-proof) */
const POPUP_HTML = readFile(ext("popup", "popup.html"));
const WRAP_END = POPUP_HTML.indexOf('<script type="module" src="popup.js"></script>');
if (POPUP_HTML.indexOf('<div class="wrap">') < 0 || WRAP_END < 0) throw new Error("popup.html markup anchors drifted — WRAP_HTML would silently slice wrong");
const WRAP_HTML = POPUP_HTML.slice(POPUP_HTML.indexOf('<div class="wrap">'), WRAP_END).trim();

/* the page's load order: theme-boot (classic head script) then the module
   entry's import graph — popup.js IS the single module entry (7c-3), so the
   MVC trio rides in the same engine world (no evalClassic anymore). */
const POPUP_FILES = [
  "shared/theme-boot.js",
  "shared/constants.js",
  "shared/backends/chrome-storage.js",
  "shared/url.js",
  "shared/format.js",
  "shared/detect-dir.js",
  "shared/domkit.js",
  "shared/export.js",
  "shared/tags.js",
  "shared/store.js",
  "shared/runtime-bridge.js",
  "popup/popup-data.js",
  "popup/popup-view.js",
  "popup/popup.js",
];

const SETTINGS = {
  defaultColor: "teal",
  showToolbar: true,
  showBadge: true,
  disabledHosts: [] as string[],
  theme: "auto",
};

function rec(id: string, host: string, url: string, title: string, text: string, over: any = {}) {
  return {
    id,
    host,
    site: "https://" + host,
    url,
    urlNorm: url,
    title,
    text,
    prefix: "",
    suffix: "",
    start: 0,
    end: 10,
    color: "teal",
    note: "",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...over,
  };
}

/** a fresh "world": real popup DOM + seed + active tab → returns after full render */
async function boot(seed: Record<string, any>, tab: any) {
  win = setupDom({ html: WRAP_HTML });
  HL = await loadEngine({ chrome: makeChromeMock(seed, [tab]), files: POPUP_FILES });
  await sleep(150); /* init has a chain of setTimeout(0) callbacks */
}

const $ = (id: string) => win.document.getElementById(id);

const MDN_URL = "https://developer.mozilla.org/docs/Web/CSS/CSS_logical_properties";
const MDN_TITLE = "Using logical properties and logical values - CSS | MDN";
const MDN_TAB = { id: 8, url: MDN_URL, title: MDN_TITLE };

const FA_URL = "https://fa.wikipedia.org/wiki/Persian";
const FA_TITLE = "دانشنامه‌ی فارسی — ویکی‌پدیا";
const FA_TAB = { id: 7, url: FA_URL, title: FA_TITLE };

describe("پاپ‌آپ — کارت صفحه‌ی هوشمند جهت (v1.2.7 + دامنه‌ی دقیق v1.2.8)", () => {
  test("صفحه‌ی انگلیسی + هایلایت‌های انگلیسی → کارت صفحه و آیتم‌های لیست dir=ltr", async () => {
    await boot({
      "hlx:settings": SETTINGS,
      "hlx:d:developer.mozilla.org": {
        m1: rec("m1", "developer.mozilla.org", MDN_URL, MDN_TITLE, "Logical properties, like inline-start and block-end, flow relative to the writing mode."),
        m2: rec("m2", "developer.mozilla.org", MDN_URL, MDN_TITLE, "The dir attribute on an element sets its base direction for bidi text."),
      },
    }, MDN_TAB);

    const secPage = $("sec-page");
    expect(secPage.getAttribute("dir")).toBe("ltr");
    /* real card content */
    expect($("page-title").textContent).toBe(MDN_TITLE); /* under 60 chars → full */
    expect($("page-host").textContent).toBe("developer.mozilla.org");
    expect($("chip-hl").textContent).toContain("هایلایت");
    /* list rendered with English text */
    expect($("hl-list").children.length).toBe(2);
    expect($("hl-list").querySelector(".hl-text").textContent).toContain("Logical properties");
  });

  test("دامنه‌ی دقیق (v1.2.8): هدرِ فارسیِ سکشن لیست در حالت LTR هم RTL می‌ماند — فقط آیتم‌های هایلایت LTR می‌شوند", async () => {
    await boot({
      "hlx:settings": SETTINGS,
      "hlx:d:developer.mozilla.org": {
        m1: rec("m1", "developer.mozilla.org", MDN_URL, MDN_TITLE, "Logical properties, like inline-start and block-end, flow relative to the writing mode."),
        m2: rec("m2", "developer.mozilla.org", MDN_URL, MDN_TITLE, "The dir attribute on an element sets its base direction for bidi text."),
      },
    }, MDN_TAB);

    /* the list section never gets dir — the header (strong «هایلایت‌های این صفحه» + counter)
       inherits the document's rtl and its layout stays RTL as always */
    expect($("sec-list").getAttribute("dir")).toBeNull();
    const headStrong = win.document.querySelector(".list-head > strong");
    expect(headStrong).not.toBeNull();
    expect(headStrong.getAttribute("dir")).toBeNull();
    expect($("list-count").getAttribute("dir")).toBeNull();
    expect(headStrong.textContent).toContain("هایلایت‌های این صفحه");
    /* and only the highlight items (the page's own content) become LTR */
    expect($("hl-list").getAttribute("dir")).toBe("ltr");
    expect($("hl-list").children.length).toBe(2);
  });

  test("صفحه‌ی فارسی → هیچ صفتی نمی‌گیرد (ارث rtl سند — دقیقاً مثل قبل)", async () => {
    await boot({
      "hlx:settings": SETTINGS,
      "hlx:d:fa.wikipedia.org": {
        w1: rec("w1", "fa.wikipedia.org", FA_URL, FA_TITLE, "مغز ما هنگام خواندن وارد گفت‌وگو با نویسنده می‌شود"),
      },
    }, FA_TAB);

    expect($("sec-page").getAttribute("dir")).toBeNull();
    expect($("sec-list").getAttribute("dir")).toBeNull();
    expect($("hl-list").getAttribute("dir")).toBeNull();
    expect($("page-title").textContent).toBe(FA_TITLE);
    expect($("hl-list").children.length).toBe(1);
  });

  test("صفحه‌ی انگلیسی بدون هایلایت (تازه) → تنها سیگنال عنوان → dir=ltr + حالت خالی", async () => {
    await boot({ "hlx:settings": SETTINGS }, MDN_TAB);

    expect($("sec-page").getAttribute("dir")).toBe("ltr");
    expect($("hl-list").getAttribute("dir")).toBe("ltr"); /* item scope — harmless even in the empty state */
    expect($("sec-empty").hidden).toBe(false); /* list hidden, empty state visible */
    expect($("sec-list").hidden).toBe(true);
    expect($("hl-list").children.length).toBe(0);
  });

  test("تعارض: عنوان فارسی + هایلایت کد انگلیسی → RTL می‌ماند (سیاست محافظه‌کار مشترک)", async () => {
    await boot({
      "hlx:settings": SETTINGS,
      "hlx:d:fa.wikipedia.org": {
        c1: rec("c1", "fa.wikipedia.org", FA_URL, FA_TITLE, "useState is a Hook that lets you add state to function components."),
      },
    }, FA_TAB);

    expect($("sec-page").getAttribute("dir")).toBeNull();
    expect($("sec-list").getAttribute("dir")).toBeNull();
    expect($("hl-list").getAttribute("dir")).toBeNull();
  });

  test("سکشن‌های UI فارسی دست‌نخورده می‌مانند (سوئیچ سایت هرگز dir نمی‌گیرد)", async () => {
    await boot({ "hlx:settings": SETTINGS }, MDN_TAB);
    expect($("sec-toggle").getAttribute("dir")).toBeNull();
    expect($("sec-generic").getAttribute("dir")).toBeNull();
    expect($("sec-empty").getAttribute("dir")).toBeNull();
  });

  test("نسخه از منبع واحد (manifest) — لیبل v واقعی", async () => {
    await boot({ "hlx:settings": SETTINGS }, MDN_TAB);
    const manifest = JSON.parse(readFile(ext("manifest.json")));
    expect($("ver").textContent).toBe("v" + manifest.version);
  });

  test("یکپارچگی با داشبورد: همان مقاله در سیاست مشترک هم ltr است (یک مقاله، یک جهت)", async () => {
    await boot({
      "hlx:settings": SETTINGS,
      "hlx:d:developer.mozilla.org": {
        m1: rec("m1", "developer.mozilla.org", MDN_URL, MDN_TITLE, "Logical properties, like inline-start and block-end, flow relative to the writing mode."),
      },
    }, MDN_TAB);

    /* the popup does not load HL.dash (ISP) — equivalence via the shared policy:
       the same inputs as the dashboard (groupRecords → groupDir → contentDir) */
    const dir = HL.detectDir.contentDir(MDN_TITLE, [
      "Logical properties, like inline-start and block-end, flow relative to the writing mode.",
    ]);
    expect(dir).toBe("ltr");
    /* and the popup applied the same decision to the card */
    expect($("sec-page").getAttribute("dir")).toBe("ltr");
  });
});
