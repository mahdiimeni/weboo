/**
 * Content widget theme tests (v1.2.2)
 *
 * Four-layer coverage:
 *   1) HL.ui.setTheme/getTheme (ui/base.js) — boundary validation + marking of
 *      Shadow DOM hosts (at creation and live)
 *   2) orchestrator integration — toolbar/popover/toast follow the theme
 *   3) widget CSS contract — the 4-state :host pattern (popup.css pattern) and
 *      media-dark palette === forced-dark palette (mechanical DRY)
 *   4) light palette contrast contract (element separation floors) + full
 *      immutability of the dark palette — «دارک دست نزن» ("don't touch dark")
 *      turned into a test (v1.2.2)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, readFile, ext } from "./helpers/engine";

let HL: any;
let win: any;

beforeEach(async () => {
  win = setupDom();
  HL = await loadEngine({});
});

/* ---------- 1) HL.ui.setTheme — the widget theme boundary ---------- */

describe("HL.ui.setTheme — اعتبارسنجی و میزبان‌ها", () => {
  test("پیش‌فرض auto: میزبان تازه attribute ندارد (تصمیم با سیستم)", () => {
    expect(HL.ui.getTheme()).toBe("auto");
    const h = HL.uiBase.makeHost();
    expect(h.host.hasAttribute("data-theme")).toBe(false);
  });

  /* ---------- watchdog (v0.6.6): the site wipes hosts → re-attach ---------- */

  test("حذف میزبان از <html> → همان گره دوباره متصل می‌شود (و بار دوم هم)", async () => {
    const h = HL.uiBase.makeHost();
    expect(h.host.isConnected).toBe(true);
    const sr = h.host.shadowRoot;

    win.document.documentElement.removeChild(h.host); /* React hydration recovery wipe */
    expect(h.host.isConnected).toBe(false);
    await new Promise((r) => setTimeout(r, 450)); /* watchdog debounce 300ms */
    expect(h.host.isConnected).toBe(true);

    win.document.documentElement.removeChild(h.host); /* cleaner runs again */
    await new Promise((r) => setTimeout(r, 450));
    expect(h.host.isConnected).toBe(true);
    expect(h.host.shadowRoot).toBe(sr); /* same node — shadow tree + popover state intact */
  });

  test("mutation بی‌ربط → میزبان سالم دست نمی‌خورد (بدون حلقه)", async () => {
    const h = HL.uiBase.makeHost();
    const p = win.document.createElement("p");
    p.textContent = "unrelated";
    win.document.body.appendChild(p);
    await new Promise((r) => setTimeout(r, 450));
    expect(h.host.isConnected).toBe(true);
    expect(win.document.documentElement.contains(h.host)).toBe(true);
  });

  test("کلیدهای معتبر رجیستری اعمال و برگردانده می‌شوند", () => {
    expect(HL.ui.setTheme("light")).toBe("light");
    expect(HL.ui.getTheme()).toBe("light");
    expect(HL.ui.setTheme("dark")).toBe("dark");
    expect(HL.ui.getTheme()).toBe("dark");
    expect(HL.ui.setTheme("auto")).toBe("auto");
    expect(HL.ui.getTheme()).toBe("auto");
  });

  test("مقدار نامعتبر → auto (اعتبارسنجی در مرز — storage خام)", () => {
    expect(HL.ui.setTheme("blue")).toBe("auto");
    expect(HL.ui.setTheme("")).toBe("auto");
    expect(HL.ui.setTheme(null)).toBe("auto");
    expect(HL.ui.setTheme(undefined)).toBe("auto");
    expect(HL.ui.setTheme({} as any)).toBe("auto");
    expect(HL.ui.getTheme()).toBe("auto");
  });

  test("makeHost پس از setTheme، میزبانِ تازه را همان لحظه نشانه‌گذاری می‌کند (OCP)", () => {
    HL.ui.setTheme("dark");
    const h = HL.uiBase.makeHost();
    expect(h.host.getAttribute("data-theme")).toBe("dark");
    HL.ui.setTheme("light");
    const h2 = HL.uiBase.makeHost();
    expect(h2.host.getAttribute("data-theme")).toBe("light");
  });

  test("همگامی زنده: setTheme همه‌ی میزبان‌های موجود را به‌روز می‌کند", () => {
    const a = HL.uiBase.makeHost();
    const b = HL.uiBase.makeHost();
    HL.ui.setTheme("dark");
    expect(a.host.getAttribute("data-theme")).toBe("dark");
    expect(b.host.getAttribute("data-theme")).toBe("dark");
    HL.ui.setTheme("light");
    expect(a.host.getAttribute("data-theme")).toBe("light");
    expect(b.host.getAttribute("data-theme")).toBe("light");
    HL.ui.setTheme("auto");
    expect(a.host.hasAttribute("data-theme")).toBe(false);
    expect(b.host.hasAttribute("data-theme")).toBe(false);
  });

  test("میزبان جدا‌شده از DOM بی‌صدا دفع می‌شود", () => {
    const h = HL.uiBase.makeHost();
    h.host.remove();
    expect(() => HL.ui.setTheme("dark")).not.toThrow();
    expect(HL.ui.setTheme("dark")).toBe("dark");
  });
});

/* ---------- 2) orchestrator integration ---------- */

describe("ویجت‌های ارکستراتور — همگامی با تم", () => {
  function makeController() {
    return HL.createHighlighter({
      page: { url: "u", norm: "u", site: "s", host: "test.local" },
      scope: win.document.body,
      eventRoot: win.document,
      store: HL.createStore(HL.backends.memoryArea()),
    });
  }

  test("toolbar و popover هم‌زمان با setTheme می‌شوند (بعد از ساخت)", () => {
    const hl = makeController();
    expect(hl.toolbar.host.hasAttribute("data-theme")).toBe(false); /* auto */
    HL.ui.setTheme("dark");
    expect(hl.toolbar.host.getAttribute("data-theme")).toBe("dark");
    expect(hl.popover.host.getAttribute("data-theme")).toBe("dark");
    HL.ui.setTheme("auto");
    expect(hl.toolbar.host.hasAttribute("data-theme")).toBe(false);
    hl.dispose();
  });

  test("تمِ ازپیش‌اعمال‌شده، ویجت‌های بعدی را هم درست می‌سازد (مسیر content.js)", () => {
    HL.ui.setTheme("light");
    const hl = makeController();
    expect(hl.toolbar.host.getAttribute("data-theme")).toBe("light");
    expect(hl.popover.host.getAttribute("data-theme")).toBe("light");
    hl.dispose();
  });

  test("toast با اولین show ساخته و همان لحظه تم می‌گیرد", () => {
    HL.ui.setTheme("light");
    HL.ui.Toast.show("پیام آزمون");
    expect(HL.ui.Toast._host.getAttribute("data-theme")).toBe("light");
    HL.ui.setTheme("dark");
    expect(HL.ui.Toast._host.getAttribute("data-theme")).toBe("dark");
  });
});

/* ---------- 3) widget CSS contract (on the real installed CSS) ---------- */

/** pulls the widget's <style> text out of the real Shadow DOM (not the source text) */
function cssOf(root: any, marker: string): string {
  const styles = root.querySelectorAll("style");
  for (const s of styles) {
    if ((s.textContent || "").includes(marker)) return s.textContent || "";
  }
  return "";
}

const varDecls = (block: string) =>
  block.split(";").map((x) => x.trim()).filter((x) => x.startsWith("--")).sort().join(";");

function widgetCssOf(make: () => { root: any }, marker: string): string {
  return cssOf(make().root, marker);
}

describe("قرارداد CSS تم — الگوی ۴حالته‌ی :host (الگوی popup.css)", () => {
  const cases: Array<[string, () => any, string]> = [
    ["toolbar", () => new HL.ui.FloatingToolbar({}), ".hlx-tb"],
    ["popover", () => new HL.ui.NotePopover({}), ".hlx-po"],
    ["toast", () => { HL.ui.Toast.show("x"); return { root: HL.ui.Toast._root }; }, ".hlx-toast"],
  ];

  for (const [name, make, marker] of cases) {
    test(`${name}: هر چهار حالت (پایه/tیره‌ی سیستم/اجبار روشن/اجبار تیره)`, () => {
      const css = widgetCssOf(make, marker);
      expect(css).not.toBe("");
      expect(css).toContain("@media (prefers-color-scheme: dark)");
      /* the :not guard — forced light must beat system dark */
      expect(css).toContain(':host(:not([data-theme="light"]))');
      expect(css).toContain(':host([data-theme="light"])');
      expect(css).toContain(':host([data-theme="dark"])');
      /* regression: the non-functional form :host[attribute] is a no-op in Chrome and
         drops the whole rule — the functional form :host([attribute]) must always be used. */
      expect(css).not.toContain(":host[");
      expect(css).not.toContain(":host:not(");
    });

    test(`${name}: پالت تیره‌ی media === پالت تیره‌ی اجباری (بدون drift)`, () => {
      const css = widgetCssOf(make, marker);
      const m1 = css.match(/:host\(:not\(\[data-theme="light"\]\)\)\s*\{([^}]*)\}/);
      const m2 = css.match(/:host\(\[data-theme="dark"\]\)\s*\{([^}]*)\}/);
      expect(m1).toBeTruthy();
      expect(m2).toBeTruthy();
      expect(varDecls(m1![1])).toBe(varDecls(m2![1]));
      expect(varDecls(m1![1]).length).toBeGreaterThan(0);
    });
  }

  test("سطح اصلی هر ویجت از متغیر تم می‌خواند (نه رنگ خام)", () => {
    const tb = cssOf(new HL.ui.FloatingToolbar({}).root, ".hlx-tb");
    expect(tb).toContain("background: var(--tb-bg)");
    expect(tb).toContain("color: var(--tb-fg)");
    const po = cssOf(new HL.ui.NotePopover({}).root, ".hlx-po");
    expect(po).toContain("background: var(--po-bg)");
    expect(po).toContain("color: var(--po-fg)");
    HL.ui.Toast.show("x");
    const toast = cssOf(HL.ui.Toast._root, ".hlx-toast");
    expect(toast).toContain("background: var(--toast-bg)");
    expect(toast).toContain("color: var(--toast-fg)");
  });

  test("هر دو پالت روشن و تیره مقدار متفاوت دارند (تم واقعاً تعویض می‌شود)", () => {
    const css = cssOf(new HL.ui.FloatingToolbar({}).root, ".hlx-tb");
    const light = css.match(/:host\s*\{([^}]*)\}/)![1];
    const dark = css.match(/:host\(\[data-theme="dark"\]\)\s*\{([^}]*)\}/)![1];
    expect(varDecls(light)).not.toBe(varDecls(dark));
    expect(light).toContain("#1f2937"); /* light palette text */
    expect(dark).toContain("#f9fafb"); /* dark palette text */
  });
});

/* ---------- 4) light palette contrast + dark immutability (v1.2.2) ----------
   Background: the previous light tonal steps were below the eye's luminance
   separation threshold (Weber ΔL/L — only 4–10% on a white surface, while
   dark runs 60–300%). This section locks two invariants:
     • Light contrast floor: edge/divider/hover/ring above the surface, muted
       text ≥ 6:1 — the v1.2.1 values fail these floors (regression guard).
     • Dark snapshot: the dark tokens across all 5 sources (popup.css,
       dashboard.css, three widgets) must keep exactly these values —
       «دارک دست نزن» ("don't touch dark"). */

type RGB = [number, number, number];

function parseColor(c: string): { rgb: RGB; a: number } {
  const s = c.trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return { rgb: [0, 1, 2].map((i) => parseInt(m![1].slice(i * 2, i * 2 + 2), 16)) as RGB, a: 1 };
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return { rgb: [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as RGB, a: 1 };
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { rgb: [p[0], p[1], p[2]] as RGB, a: p.length > 3 ? p[3] : 1 };
  }
  throw new Error("رنگ ناشناخته: " + c);
}

/** composites fg (with optional alpha) over bg — bg itself is first resolved over white */
function composite(fg: string, bg: string): RGB {
  const f = parseColor(fg);
  const b = parseColor(bg);
  const mix = (x: { rgb: RGB; a: number }, base: RGB): RGB =>
    [0, 1, 2].map((i) => Math.round(x.rgb[i] * x.a + base[i] * (1 - x.a))) as RGB;
  const rgbStr = (r: RGB) => `rgb(${r[0]}, ${r[1]}, ${r[2]})`;
  return mix(f, mix(b, [255, 255, 255]));
}

function lumOf(rgb: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
const lum = (c: string) => lumOf(parseColor(c).rgb);
const onLum = (fg: string, bg: string) => lumOf(composite(fg, bg));
const wcagRatio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** CSS block → token→value map (--* declarations only) — comments stripped */
function varMap(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of block.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
    const m = part.match(/^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const widgetLight = (css: string) => varMap(css.match(/:host\s*\{([^}]*)\}/)![1]);
const widgetDark = (css: string) => varMap(css.match(/:host\(\[data-theme="dark"\]\)\s*\{([^}]*)\}/)![1]);

function pageVars(rel: string[], which: "light" | "media-dark" | "forced-dark"): Record<string, string> {
  const css = readFile(ext(...rel));
  const re =
    which === "light" ? /^:root\s*\{([^}]*)\}/m
    : which === "media-dark" ? /:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/
    : /:root\[data-theme="dark"\]\s*\{([^}]*)\}/;
  const m = css.match(re);
  if (!m) throw new Error("بلوک پیدا نشد: " + rel.join("/") + " " + which);
  return varMap(m[1]);
}

describe("قرارداد کنتراست پالت روشن — کف‌های تفکیک عناصر (v1.2.2)", () => {
  /* floors chosen per the adjacency separation threshold (~10%) and WCAG AA
     text; the previous (v1.2.1) values all fail — reverting to them turns the test red. */

  for (const page of [["popup", "popup.css"] as const, ["dashboard", "dashboard.css"] as const]) {
    test(`${page[0]}: سطح/لبه/هاور/چیپ/متن خاموش از کف عبور می‌کنند`, () => {
      const v = pageVars([...page], "light");
      const card = lum(v["--card"]!);
      expect(card - lum(v["--bg"]!)).toBeGreaterThanOrEqual(0.05);            /* card vs canvas */
      expect(card - lum(v["--line"]!)).toBeGreaterThanOrEqual(0.25);          /* edges/dividers */
      expect(card - lum(v["--hover"]!)).toBeGreaterThanOrEqual(0.15);         /* hover */
      expect(card - lum(v["--accent-soft"]!)).toBeGreaterThanOrEqual(0.05);   /* chip/fl */
      expect(wcagRatio(lum(v["--muted"]!), card)).toBeGreaterThanOrEqual(6);  /* text/icons */
    });
  }

  test("dashboard: جعبه‌های سبز/قرمز به‌عنوان عنصر متمایز دیده می‌شوند", () => {
    const v = pageVars(["dashboard", "dashboard.css"], "light");
    const card = lum(v["--card"]!);
    expect(card - lum(v["--ok-bg"]!)).toBeGreaterThanOrEqual(0.05);
    expect(card - lum(v["--danger-bg"]!)).toBeGreaterThanOrEqual(0.05);
  });

  /* v0.6.3 — the count capsules went LIGHT BLUE (the owner's request): the
     blue trio gets the same floors the amber chip family always had, so the
     capsules stay a distinguishable element with readable text. */
  test("dashboard: کپسول‌های شمارند آبی روشن (v0.6.3) — سطح از کف، متن AA", () => {
    const v = pageVars(["dashboard", "dashboard.css"], "light");
    const card = lum(v["--card"]!);
    expect(card - lum(v["--info-soft"]!)).toBeGreaterThanOrEqual(0.05);              /* chip bg vs card */
    expect(wcagRatio(lum(v["--info-h"]!), lum(v["--info-soft"]!))).toBeGreaterThanOrEqual(4.5); /* chip text on its bg */
  });

  test("toolbar: لبه/جداکننده/رینگ/هاور روشن از کف عبور می‌کنند", () => {
    const v = widgetLight(widgetCssOf(() => new HL.ui.FloatingToolbar({}), ".hlx-tb"));
    const s = onLum(v["--tb-bg"]!, "#ffffff"); /* pill surface (bg on a white page) */
    expect(s - onLum(v["--tb-border"]!, v["--tb-bg"]!)).toBeGreaterThanOrEqual(0.25);
    expect(s - onLum(v["--tb-sep"]!, v["--tb-bg"]!)).toBeGreaterThanOrEqual(0.3);
    expect(s - onLum(v["--tb-dot-border"]!, v["--tb-bg"]!)).toBeGreaterThanOrEqual(0.35);
    expect(s - onLum(v["--tb-btn-h-bg"]!, v["--tb-bg"]!)).toBeGreaterThanOrEqual(0.18);
  });

  test("popover: لبه/هاور/رینگ/آیکون/متن خاموش از کف عبور می‌کنند", () => {
    const v = widgetLight(widgetCssOf(() => new HL.ui.NotePopover({}), ".hlx-po"));
    const s = onLum(v["--po-bg"]!, "#ffffff");
    expect(s - onLum(v["--po-border"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.25);
    expect(s - onLum(v["--po-hov-bg"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.15);
    expect(s - onLum(v["--po-g-bg"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.12);
    expect(s - onLum(v["--po-g-h-bg"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.25);
    expect(s - onLum(v["--po-foot-bd"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.15);
    expect(s - onLum(v["--po-dot-bd"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.35);
    expect(s - onLum(v["--po-q-bg"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.05);
    expect(s - onLum(v["--po-nbh-bg"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.05);
    expect(wcagRatio(lum(v["--po-ic"]!), s)).toBeGreaterThanOrEqual(6);
    expect(wcagRatio(lum(v["--po-muted"]!), s)).toBeGreaterThanOrEqual(6);
    /* v0.5.1 — the icon-only «ویرایش یادداشت» pen: its amber is a token now, so
       it carries the same floors as the other icon/text colors (the old hardcoded
       #b45309 scored 5.0 — the floor keeps any future tweak honest). */
    expect(wcagRatio(lum(v["--po-note-ic"]!), s)).toBeGreaterThanOrEqual(4.5);
    expect(s - onLum(v["--po-note-h-bg"]!, v["--po-bg"]!)).toBeGreaterThanOrEqual(0.15); /* هاور دیده شود */
  });

  test("toast: لبه‌ی قرص روشن از کف عبور می‌کند", () => {
    const v = widgetLight(widgetCssOf(() => { HL.ui.Toast.show("x"); return { root: HL.ui.Toast._root }; }, ".hlx-toast"));
    const s = onLum(v["--toast-bg"]!, "#ffffff");
    expect(s - onLum(v["--toast-bd"]!, v["--toast-bg"]!)).toBeGreaterThanOrEqual(0.2);
  });
});

describe("قرارداد تغییرناپذیری پالت دارک — «دارک دست نزن» (v1.2.2)", () => {
  /* snapshot of the dark tokens — any change to dark turns this test red. */

  const PAGE_DARK: Record<string, string> = {
    "--bg": "#111318", "--card": "#1a1d24", "--text": "#e5e7eb", "--muted": "#9ca3af",
    "--line": "#2a2f3a", "--accent": "#f59e0b", "--accent-h": "#fbbf24", "--accent-soft": "#2f2510",
    "--accent-line": "rgba(217, 119, 6, .3)", "--hover": "#22262f", "--toggle": "#4b5563",
    "--ok-text": "#34d399", "--shadow": "0 1px 2px rgba(0, 0, 0, .4)",
  };
  const DASH_DARK_EXTRA: Record<string, string> = {
    "--ok-bg": "#0c2317", "--ok-line": "#1e4630", "--danger": "#ef4444", "--danger-h": "#f87171",
    "--danger-bg": "#2b1313", "--danger-line": "#5c1f1f",
    "--ok-text": "#6ee7a0", /* dashboard uses a lighter green text (overrides the popup's #34d399) */
    /* v0.6.3 — light-blue count capsules: the blue trio the .chip consumes */
    "--info-h": "#93c5fd", "--info-soft": "#1b2a45", "--info-line": "rgba(96, 165, 250, .35)",
  };

  test("popup.css: هر دو بلوک دارک == اسنپ‌شات (و با هم همگام)", () => {
    expect(pageVars(["popup", "popup.css"], "media-dark")).toEqual(PAGE_DARK);
    expect(pageVars(["popup", "popup.css"], "forced-dark")).toEqual(PAGE_DARK);
  });

  test("dashboard.css: هر دو بلوک دارک == اسنپ‌شات (و با هم همگام)", () => {
    const expectDash = { ...PAGE_DARK, ...DASH_DARK_EXTRA };
    expect(pageVars(["dashboard", "dashboard.css"], "media-dark")).toEqual(expectDash);
    expect(pageVars(["dashboard", "dashboard.css"], "forced-dark")).toEqual(expectDash);
  });

  test("toolbar: پالت DARK == اسنپ‌شات", () => {
    const v = widgetDark(widgetCssOf(() => new HL.ui.FloatingToolbar({}), ".hlx-tb"));
    expect(v).toEqual({
      "--tb-bg": "rgba(17,24,39,.97)", "--tb-fg": "#f9fafb", "--tb-border": "rgba(255,255,255,.09)",
      "--tb-shadow": "0 10px 34px rgba(0,0,0,.38)", "--tb-dot-border": "rgba(255,255,255,.25)",
      "--tb-dot-border-h": "#fff", "--tb-sep": "rgba(255,255,255,.16)", "--tb-btn-fg": "#e5e7eb",
      "--tb-btn-h-bg": "rgba(255,255,255,.12)", "--tb-btn-h-fg": "#fff", "--tb-note": "#fbbf24",
      "--tb-note-h-bg": "rgba(251,191,36,.15)",
    });
  });

  test("popover: پالت DARK == اسنپ‌شات", () => {
    const v = widgetDark(widgetCssOf(() => new HL.ui.NotePopover({}), ".hlx-po"));
    expect(v).toEqual({
      "--po-bg": "#1f2937", "--po-fg": "#f3f4f6", "--po-border": "#374151", "--po-grip": "#4b5563",
      "--po-grip-h": "#d1d5db", "--po-act": "#f9fafb", "--po-ring": "#1f2937", "--po-hov-bg": "#374151",
      "--po-hov-fg": "#f9fafb", "--po-q-bg": "rgba(245,158,11,.12)", "--po-q-fg": "#fcd34d",
      "--po-nb-bd": "#4b5563", "--po-nbh-bd": "#065f46", "--po-nbh-bg": "rgba(6,95,70,.25)",
      "--po-nbh-fg": "#a7f3d0", "--po-note-fg": "#f9fafb", "--po-ta-bg": "#111827", "--po-ta-bd": "#4b5563",
      "--po-ta-fg": "#f9fafb", "--po-g-bg": "#374151", "--po-g-fg": "#e5e7eb", "--po-g-h-bg": "#e5e7eb",
      "--po-foot-bd": "#374151", "--po-dot-bd": "#e5e7eb", "--po-ic": "#6b7280", "--po-muted": "#9ca3af",
      /* v0.5.1 — the icon-only edit-note pen: the toolbar's proven dark note pair */
      "--po-note-ic": "#fbbf24", "--po-note-h-bg": "rgba(251,191,36,.15)",
    });
  });

  test("toast: پالت DARK == اسنپ‌شات", () => {
    const v = widgetDark(widgetCssOf(() => { HL.ui.Toast.show("x"); return { root: HL.ui.Toast._root }; }, ".hlx-toast"));
    expect(v).toEqual({
      "--toast-bg": "#111827", "--toast-fg": "#f9fafb", "--toast-bd": "rgba(255,255,255,.09)",
      "--toast-shadow": "0 10px 30px rgba(0,0,0,.3)",
    });
  });
});

describe("قرارداد هاور آیتم داشبورد — فقط پس‌زمینه، بدون استروک (v1.2.5)", () => {
  /* User request: the thin amber stroke around each article's highlights on
     hover was removed; the existing background change is enough. This contract
     flags any reintroduced stroke (inner box-shadow, outline or border) red
     immediately. */

  const hoverRule = () => {
    const css = readFile(ext("dashboard", "dashboard.css"));
    const m = css.match(/\.item:hover\s*\{([^}]*)\}/);
    if (!m) throw new Error("بلوک .item:hover پیدا نشد");
    return m[1].replace(/\/\*[\s\S]*?\*\//g, "");
  };

  test("هاور همان تغییر پس‌زمینه‌ی موجود را دارد", () => {
    expect(hoverRule()).toMatch(/background\s*:\s*var\(--hover\)/);
  });

  test("هاور استروک ندارد (box-shadow/outline/border)", () => {
    expect(hoverRule()).not.toMatch(/box-shadow|outline|border(?!-radius)/);
  });
});

describe("قرارداد کپسول آبی و ردیف اکشن سرصفحه — v0.6.3", () => {
  /* Two owner requests as CSS contracts: the article cards' count capsules
     (.chip) went LIGHT BLUE via the --info-* tokens (never raw hexes, never
     the amber accent), and the topbar action row shares ONE explicit height
     (text button, icon-only buttons, size badge — one aligned family). */

  const dashCss = () => readFile(ext("dashboard", "dashboard.css"));

  test("کپسول .chip به توکن‌های آبی وصل است — نه hex خام، نه آمبر", () => {
    const m = dashCss().match(/\.chip\s*\{([^}]*)\}/);
    if (!m) throw new Error("بلوک .chip پیدا نشد");
    const body = m[1].replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).toMatch(/color\s*:\s*var\(--info-h\)/);
    expect(body).toMatch(/background\s*:\s*var\(--info-soft\)/);
    expect(body).toMatch(/border\s*:\s*1px solid var\(--info-line\)/);
    expect(body).not.toMatch(/--accent|#[0-9a-fA-F]{3,8}/); /* فقط توکن */
  });

  test("ردیف اکشن: یک ارتفاع واحد + دکمه‌ی آیکونی مربع", () => {
    const css = dashCss();
    expect(css).toMatch(/\.topbar-actions \.btn,\s*\.topbar-actions \.size-badge \{ height: 40px; \}/);
    expect(css).toMatch(/\.btn-icon \{ width: 40px; padding-inline: 0; \}/);
    expect(css).toMatch(/\.size-badge \{\s*display: inline-flex; align-items: center;/); /* ارتفاع ثابت فقط با flex معنا دارد */
  });
});

describe("قرارداد پنجره‌ی شناور کاملاً هوشمند — v0.6.4", () => {
  /* The owner's three asks as testable contracts: (1) FULLY direction-smart
     window — the title is NOT pinned to the RTL edge anymore (text-align: start
     resolves against the title's own dir) and the meta row follows the frame's
     flow; (2) the X button is GONE from the modal skeleton — the card itself
     (tabindex="-1") is the focus anchor, with the overlay click + Escape as the
     close paths; (3) the title font is a notch smaller than the generic modal
     caption (17 → 15) while the ellipsis backstop stays. */

  const dashCss = () => readFile(ext("dashboard", "dashboard.css"));
  /* Phase 8: the page skeleton is the WXT entrypoint template now
     (subdir index.html — WXT's convention; emits dashboard.html at root) */
  const dashHtml = () => readFile(ext("..", "entrypoints", "dashboard", "index.html"));

  test("عنوان پنجره: ۱۵px (کوچک‌تر) + بی text-align قفل‌شده — چینش از dir خودِ متن", () => {
    const m = dashCss().match(/\.hl-head h2\s*\{([^}]*)\}/);
    if (!m) throw new Error("بلوک .hl-head h2 پیدا نشد");
    const body = m[1].replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).toMatch(/font-size:\s*15px/); /* v0.6.4 — a notch smaller */
    expect(body).not.toMatch(/text-align/); /* هیچ لبه‌ی قفل‌شده‌ای نیست — startِ خودِ dir */
    expect(body).toMatch(/text-overflow:\s*ellipsis/); /* پشتیبان بریده‌ماندن می‌ماند */
    expect(body).toMatch(/white-space:\s*nowrap/);
  });

  test("لنگر فوکوس: .hl-card:focus بدون رینگ — ظاهر شدن مودال خودش بازخورد فوکوس است", () => {
    expect(dashCss()).toMatch(/\.hl-card:focus\s*\{\s*outline: none;\s*\}/);
  });

  /* اسکلت پنجره‌ی شناور (slice 5): the markup moved into the PreviewModal
     component — its skeleton contract is pinned by the component tests
     (dashboard-components.test.tsx). The CSS contracts above stay. */

});
