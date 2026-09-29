/**
 * HL.domkit tests — el/txtNode + mountFavicon + applyTheme
 * mountFavicon is pure DOM: the URL comes from outside (HL.runtime.faviconUrl);
 * only mount/fallback behavior is tested here. applyTheme is also pure DOM:
 * it only sets data-theme/color-scheme on <html>; persisting and mirroring
 * localStorage is the caller's concern (popup/dashboard).
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;
let win: any;

beforeEach(async () => {
  win = setupDom();
  HL = await loadEngine({ files: ["shared/constants.js", "shared/format.js", "shared/utils.js", "shared/domkit.js"] });
});

function makeSpot() {
  const spot = HL.domkit.el("span", "fl");
  spot.textContent = "G"; /* first letter — placeholder/fallback */
  win.document.body.appendChild(spot);
  return spot;
}

describe("HL.domkit — قرارداد سطح ماژول", () => {
  test("اعضا: el, txtNode, mountFavicon, applyTheme", () => {
    expect(Object.keys(HL.domkit).sort()).toEqual(["applyTheme", "el", "mountFavicon", "txtNode"]);
  });
});

describe("HL.THEMES — قرارداد رجیستری تم (منبع واحد constants.js)", () => {
  test("کلیدها به‌ترتیب چرخه: auto → light → dark", () => {
    expect(HL.THEME_KEYS).toEqual(["auto", "light", "dark"]);
  });

  test("هر تم: برچسب فارسی معتبر", () => {
    for (const k of HL.THEME_KEYS) {
      expect(HL.THEMES[k].label.length).toBeGreaterThan(1);
    }
  });

  test("تمِ پیش‌فرضِ تنظیمات عضو رجیستری است", () => {
    expect(HL.THEME_KEYS).toContain(HL.DEFAULT_SETTINGS.theme);
    expect(HL.DEFAULT_SETTINGS.theme).toBe("auto");
  });
});

describe("HL.domkit.mountFavicon", () => {
  test("img با کلاس/صفت‌های درست داخل spot نشسته و src ست شده", () => {
    const spot = makeSpot();
    const img = HL.domkit.mountFavicon(spot, "chrome://favicon2/?x=1");
    expect(img).not.toBeNull();
    expect(img.className).toBe("fl-img");
    expect(img.alt).toBe("");
    expect(img.draggable).toBe(false);
    expect(img.getAttribute("src")).toBe("chrome://favicon2/?x=1");
    expect(spot.querySelector("img.fl-img")).toBe(img);
    expect(spot.textContent).toBe("G"); /* letter untouched */
  });

  test("load → کلاس .on روی img و .has-fav روی spot (حرف شفاف می‌شود)", () => {
    const spot = makeSpot();
    const img = HL.domkit.mountFavicon(spot, "chrome://favicon2/?x=1");
    img.dispatchEvent(new win.Event("load"));
    expect(img.classList.contains("on")).toBe(true);
    expect(spot.classList.contains("has-fav")).toBe(true);
    expect(spot.textContent).toBe("G"); /* text is not removed — CSS just makes it transparent */
  });

  test("error → img حذف؛ حرف اول برای همیشه fallback می‌ماند", () => {
    const spot = makeSpot();
    const img = HL.domkit.mountFavicon(spot, "chrome://favicon2/?x=1");
    img.dispatchEvent(new win.Event("error"));
    expect(spot.querySelector("img")).toBe(null);
    expect(spot.classList.contains("has-fav")).toBe(false);
    expect(spot.textContent).toBe("G");
  });

  test("ورودی نامعتبر (spot یا url خالی) → null و بدون side-effect", () => {
    const spot = makeSpot();
    expect(HL.domkit.mountFavicon(null, "u")).toBe(null);
    expect(HL.domkit.mountFavicon(spot, null)).toBe(null);
    expect(HL.domkit.mountFavicon(spot, "")).toBe(null);
    expect(spot.querySelector("img")).toBe(null);
    expect(spot.textContent).toBe("G");
  });
});

describe("HL.domkit.applyTheme", () => {
  const root = () => win.document.documentElement;

  test("light → data-theme=light + color-scheme روشن (کنترل‌های بومی هم‌رنگ)", () => {
    expect(HL.domkit.applyTheme(win.document, "light")).toBe("light");
    expect(root().getAttribute("data-theme")).toBe("light");
    expect(root().style.colorScheme).toBe("light");
  });

  test("dark → data-theme=dark + color-scheme تیره", () => {
    expect(HL.domkit.applyTheme(win.document, "dark")).toBe("dark");
    expect(root().getAttribute("data-theme")).toBe("dark");
    expect(root().style.colorScheme).toBe("dark");
  });

  test("auto → حذف data-theme و color-scheme (CSS با prefers-color-scheme تصمیم می‌گیرد)", () => {
    HL.domkit.applyTheme(win.document, "dark");
    expect(HL.domkit.applyTheme(win.document, "auto")).toBe("auto");
    expect(root().getAttribute("data-theme")).toBe(null);
    expect(root().style.colorScheme).toBe("");
  });

  test("تغییر حالت: dark → light صفت قبلی را جایگزین می‌کند (نه الحاق)", () => {
    HL.domkit.applyTheme(win.document, "dark");
    HL.domkit.applyTheme(win.document, "light");
    expect(root().getAttribute("data-theme")).toBe("light");
    expect(root().style.colorScheme).toBe("light");
  });

  test("مقدار نامعتبر (بک‌آپ قدیمی/دست‌کاری‌شده) → auto — اعتبارسنجی در مرز UI", () => {
    expect(HL.domkit.applyTheme(win.document, "blue")).toBe("auto");
    expect(root().getAttribute("data-theme")).toBe(null);
    expect(HL.domkit.applyTheme(win.document, null)).toBe("auto");
    expect(HL.domkit.applyTheme(win.document, undefined)).toBe("auto");
  });

  test("خروجی: کلید اعمال‌شده (برای آینه‌سازی توسط caller)", () => {
    expect(HL.domkit.applyTheme(win.document, "auto")).toBe("auto");
  });
});
