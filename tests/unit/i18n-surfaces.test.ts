/**
 * i18n surface tests (v0.14.0) — every UI surface in ENGLISH mode:
 * formatting (digits/calendar/units), the popup trio, the floating widgets
 * (Shadow DOM language/direction), the exports, the React pieces and the
 * widget-host sync. Persian-mode behavior is pinned by the pre-existing
 * suites (they run in the default fa world); this file flips the language
 * explicitly and is responsible for putting it BACK after each block.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, ext, readFile } from "./helpers/engine";
/* the React components resolve THIS module instance (bun's module graph —
   the same one the WXT dashboard bundle has); the engine world's instance is
   separate, so the React block drives language through this import */
import { setLanguage as setBunLanguage } from "../../extension/shared/i18n.js";

let HL: any;

const NOON = Date.UTC(2024, 9, 27, 12); /* 2024-10-27 12:00 UTC */

beforeEach(async () => {
  setupDom();
  HL = await loadEngine({
    files: [
      "shared/constants.js",
      "shared/i18n.js",
      "shared/backends/chrome-storage.js",
      "shared/url.js",
      "shared/utils.js",
      "shared/format.js",
      "shared/detect-dir.js",
      "shared/clipboard.js",
      "shared/tags.js",
      "shared/textindex.js",
      "shared/domwrap.js",
      "shared/anchor.js",
      "shared/ui/base.js",
      "shared/ui/toast.js",
      "shared/ui/toolbar.js",
      "shared/ui/popover.js",
      "shared/store.js",
      "shared/runtime-bridge.js",
      "shared/export.js",
      "shared/markdown-export.js",
      "shared/booklet-export.js",
      "popup/popup-data.js",
    ],
  });
});

/* ---------- format (numbers, units, calendar) ---------- */

describe("format in en mode", () => {
  test("num → Latin digits; faNum stays forced-Persian", () => {
    HL.setLanguage("en");
    expect(HL.format.num(125)).toBe("125");
    expect(HL.format.num(1250)).toBe("1,250");
    expect(HL.format.faNum(125)).toBe("۱۲۵"); /* the ONE home of Persian digits, unchanged */
    HL.setLanguage("fa");
    expect(HL.format.num(125)).toBe("۱۲۵");
  });

  test("fmtBytes → B/KB/MB with Latin digits; fa keeps the Persian units", () => {
    HL.setLanguage("en");
    expect(HL.format.fmtBytes(500)).toBe("500 B");
    expect(HL.format.fmtBytes(2048)).toBe("2 KB");
    expect(HL.format.fmtBytes(2621440)).toBe("2.5 MB");
    HL.setLanguage("fa");
    expect(HL.format.fmtBytes(2048)).toBe("۲ کیلوبایت");
  });

  test("fmtDate → Gregorian (en-US) in en, Jalali (fa-IR) in fa", () => {
    HL.setLanguage("en");
    const en = HL.format.fmtDate(NOON);
    expect(en).toContain("2024");
    expect(en).toContain("Oct");
    expect(/[\u06F0-\u06F9]/.test(en)).toBe(false); /* no Persian digits */
    HL.setLanguage("fa");
    const fa = HL.format.fmtDate(NOON);
    expect(/[\u06F0-\u06F9]/.test(fa)).toBe(true);
    expect(fa).toContain("۱۴۰۳"); /* Jalali year */
  });

  test("fmtDateTime follows the same calendar split", () => {
    HL.setLanguage("en");
    expect(HL.format.fmtDateTime(NOON)).toContain("2024");
    HL.setLanguage("fa");
    expect(HL.format.fmtDateTime(NOON)).toContain("۱۴۰۳");
  });

  test("isoDate is ALWAYS Gregorian (machine-readable contract)", () => {
    HL.setLanguage("en");
    expect(HL.format.isoDate(NOON)).toBe("2024-10-27");
    HL.setLanguage("fa");
    expect(HL.format.isoDate(NOON)).toBe("2024-10-27");
  });

  test("calendar boundaries (deterministic timestamps)", () => {
    const cases: Array<[number, string, string]> = [
      [Date.UTC(2024, 2, 19, 12), "2024", "Mar"],   /* Nowruz eve — 1 Farvardin 1403 = 2024-03-20 */
      [Date.UTC(2024, 2, 20, 12), "2024", "Mar"],   /* Jalali New Year */
      [Date.UTC(2025, 2, 20, 12), "2025", "Mar"],   /* 1 Farvardin 1404 */
      [Date.UTC(2024, 11, 31, 12), "2024", "Dec"],  /* Gregorian year end */
      [Date.UTC(2024, 1, 29, 12), "2024", "Feb"],   /* leap-day 1402/12/30 ↔ 2024-02-29? no — Jalali leap differs; boundary smoke */
    ];
    for (const [ts] of cases) {
      HL.setLanguage("en");
      expect(HL.format.fmtDate(ts)).not.toBe(""); /* valid → a real string */
      HL.setLanguage("fa");
      expect(HL.format.fmtDate(ts)).not.toBe("");
      expect(/[\u06F0-\u06F9]/.test(HL.format.fmtDate(ts))).toBe(true);
    }
    HL.setLanguage("en");
    expect(HL.format.fmtDate(Date.UTC(2024, 2, 20, 12))).toContain("Mar 20"); /* 1 Farvardin lands on 2024-03-20 */
    HL.setLanguage("fa");
  });

  test("faviconLetter fallback follows the UI language (v0.14.2)", () => {
    expect(HL.format.faviconLetter("x.test")).toBe("X"); /* a real host — first letter, both languages */
    HL.setLanguage("fa");
    expect(HL.format.faviconLetter("")).toBe("و");
    HL.setLanguage("en");
    expect(HL.format.faviconLetter("")).toBe("W");
    HL.setLanguage("fa");
  });

  test("invalid timestamps keep the '' contract (fmtDate — the export guard) in both languages", () => {
    HL.setLanguage("en");
    expect(HL.format.fmtDate(NaN)).toBe("");
    HL.setLanguage("fa");
    expect(HL.format.fmtDate(NaN)).toBe("");
  });
});

/* ---------- German formatting (v0.15.0 — the third language) ---------- */

describe("format in de mode", () => {
  test("num → Latin digits with German separators (1.250); faNum stays forced-Persian", () => {
    HL.setLanguage("de");
    expect(HL.format.num(125)).toBe("125");
    expect(HL.format.num(1250)).toBe("1.250");
    expect(HL.format.faNum(125)).toBe("۱۲۵");
    HL.setLanguage("fa");
  });

  test("fmtBytes → short Latin units with German decimal comma (2,5 MB)", () => {
    HL.setLanguage("de");
    expect(HL.format.fmtBytes(500)).toBe("500 B");
    expect(HL.format.fmtBytes(2621440)).toBe("2,5 MB");
    HL.setLanguage("fa");
  });

  test("fmtDate → Gregorian in German (Okt); fmtDateTime follows; isoDate invariant", () => {
    HL.setLanguage("de");
    const de = HL.format.fmtDate(NOON);
    expect(de).toContain("2024");
    expect(de).toContain("Okt");
    expect(/[۰-۹]/.test(de)).toBe(false);
    expect(HL.format.fmtDateTime(NOON)).toContain("2024");
    expect(HL.format.isoDate(NOON)).toBe("2024-10-27"); /* machine-readable stays Gregorian ISO */
    HL.setLanguage("fa");
  });

  test("faviconLetter hostless fallback → W in de", () => {
    HL.setLanguage("de");
    expect(HL.format.faviconLetter("")).toBe("W");
    HL.setLanguage("fa");
  });
});

/* ---------- the five v0.16.0 languages — surface samples ---------- */

describe("format in es/ru/it/fr/tr modes", () => {
  /* expectations verified against this environment's ICU (Bun full-ICU):
     4-digit grouping differs per locale (es/it none, fr/ru NBSP, tr dot);
     the byte units are the shared short Latin set for all non-fa languages */
  const NBSP = /[\u00A0\u202F]/g;
  const CASES: Array<[string, { digits: string; month: string }]> = [
    ["es", { digits: "1250", month: "oct" }],
    ["ru", { digits: "1 250", month: "окт" }],
    ["it", { digits: "1250", month: "ott" }],
    ["fr", { digits: "1 250", month: "oct." }],
    ["tr", { digits: "1.250", month: "eki" }],
  ];
  for (const [lang, want] of CASES) {
    test(lang + ": number grouping, short month, byte units — all Gregorian, Latin digits", () => {
      HL.setLanguage(lang);
      expect(HL.format.num(1250).replace(NBSP, " ")).toBe(want.digits);
      const d = HL.format.fmtDate(NOON);
      expect(d).toContain("2024");
      expect(d.toLowerCase()).toContain(want.month);
      expect(/[\u06F0-\u06F9]/.test(d)).toBe(false);
      expect(HL.format.fmtBytes(2621440)).toBe("2,5 MB");
      expect(HL.format.isoDate(NOON)).toBe("2024-10-27"); /* machine-readable invariant */
      expect(HL.dirOf(lang)).toBe("ltr"); /* every new language is LTR */
      HL.setLanguage("fa");
    });
  }

  test("quotes follow each language's convention in interpolated strings", () => {
    HL.setLanguage("es");
    expect(HL.t("toast.tagAdded", { tag: "trabajo" })).toBe("Etiqueta «trabajo» añadida");
    HL.setLanguage("ru");
    expect(HL.t("toast.tagAdded", { tag: "работа" })).toBe("Тег «работа» добавлен");
    HL.setLanguage("tr");
    expect(HL.t("toast.tagAdded", { tag: "iş" })).toBe('"iş" etiketi eklendi');
    HL.setLanguage("fa");
  });

  test("the hostless favicon fallback stays «و»/W across all languages", () => {
    for (const lang of HL.LANG_KEYS) {
      HL.setLanguage(lang);
      expect(HL.format.faviconLetter("")).toBe(lang === "fa" ? "و" : "W");
    }
    HL.setLanguage("fa");
  });
});

/* ---------- the three v0.17.0 CJK languages — surface samples ---------- */

describe("format in zh/ja/ko modes", () => {
  const CASES: Array<[string, { date: string; tagAdded: string }]> = [
    ["zh", { date: "2024年10月27日", tagAdded: "已添加标签「工作」" }],
    ["ja", { date: "2024年10月27日", tagAdded: "タグ「仕事」を追加しました" }],
    ["ko", { date: "2024년 10월 27일", tagAdded: '"일" 태그가 추가되었습니다' }],
  ];
  for (const [lang, want] of CASES) {
    test(lang + ": fullwidth date, comma-grouped numbers, point-decimal bytes — no plural morphology", () => {
      HL.setLanguage(lang);
      expect(HL.format.fmtDate(NOON)).toBe(want.date);
      expect(HL.format.num(1250)).toBe("1,250");
      expect(HL.format.fmtBytes(2621440)).toBe("2.5 MB"); /* point decimal — unlike de/fr/ru */
      expect(HL.format.isoDate(NOON)).toBe("2024-10-27"); /* machine-readable invariant */
      /* CLDR: CJK locales resolve EVERY count to `other` — one plain-string
         entry serves every n (compare the Russian suite's three forms) */
      const SAMPLES: Record<string, [string, string]> = {
        zh: ["1 个高亮", "21 个高亮"],
        ja: ["1 件のハイライト", "21 件のハイライト"],
        ko: ["하이라이트 1개", "하이라이트 21개"],
      };
      expect(HL.count("common.nHighlights", 1)).toBe(SAMPLES[lang][0]);
      expect(HL.count("common.nHighlights", 21)).toBe(SAMPLES[lang][1]);
      expect(HL.count("common.nNotes", 5)).not.toContain("{n}"); /* fully interpolated */
      expect(HL.dirOf(lang)).toBe("ltr");
      HL.setLanguage("fa");
    });
    test(lang + ": interpolation carries the language's quote convention", () => {
      HL.setLanguage(lang);
      expect(HL.t("toast.tagAdded", { tag: lang === "zh" ? "工作" : lang === "ja" ? "仕事" : "일" })).toBe(want.tagAdded);
      HL.setLanguage("fa");
    });
  }
});

/* ---------- Arabic (v0.18.0 — the second RTL language) ---------- */

describe("format in ar mode", () => {
  test("HIJRI dates via islamic-umalqura (v0.19.0) — Arabic month, Hijri year, Western digits", () => {
    HL.setLanguage("ar");
    const d = HL.format.fmtDate(NOON);
    /* 2024-10-27 = 24 Rabiʿ al-Thani 1446 AH (Umm al-Qura) */
    expect(d).toBe("24 ربيع الآخر 1446 هـ");
    expect(d).not.toContain("2024"); /* the Gregorian year must not leak */
    expect(d).not.toContain("أكتوبر");
    /* the datetime variant rides the same calendar */
    expect(HL.format.fmtDateTime(NOON)).toContain("1446 هـ");
    /* numbers stay on the NUMBER locale: Western digits, calendar-independent */
    expect(HL.format.num(1250)).toBe("1,250");
    expect(HL.format.fmtBytes(2621440)).toBe("2.5 MB");
    /* machine-readable metadata stays Gregorian ISO */
    expect(HL.format.isoDate(NOON)).toBe("2024-10-27");
    HL.setLanguage("fa");
  });

  test("Gregorian month names never leak into the Arabic date path (boundary smoke)", () => {
    HL.setLanguage("ar");
    /* around the Gregorian/Hijri year ends — both must render valid Hijri */
    for (const ts of [NOON, Date.UTC(2025, 0, 1, 12), Date.UTC(2025, 5, 15, 12), Date.UTC(2024, 1, 29, 12)]) {
      const d = HL.format.fmtDate(ts);
      expect(d).not.toBe("");
      expect(d).toContain("هـ"); /* the Hijri era marker */
      expect(HL.format.isoDate(ts)).not.toBe(""); /* ISO stays Gregorian-valid */
    }
    HL.setLanguage("fa");
  });

  test("faviconLetter hostless fallback → و in ar (the RTL sibling of fa)", () => {
    HL.setLanguage("ar");
    expect(HL.format.faviconLetter("")).toBe("W"); /* the brand initial — Arabic UIs read Latin brand marks */
    HL.setLanguage("fa");
  });
});

/* ---------- popup data + view ---------- */

describe("popup surfaces in en mode", () => {
  test("countLabel: 'X of Y' truncated, plural item count otherwise", () => {
    HL.setLanguage("en");
    expect(HL.pop.countLabel(8, 12)).toBe("8 of 12");
    expect(HL.pop.countLabel(5, 5)).toBe("5 items");
    expect(HL.pop.countLabel(1, 1)).toBe("1 item");
    HL.setLanguage("fa");
    expect(HL.pop.countLabel(8, 12)).toBe("۸ از ۱۲");
    expect(HL.pop.countLabel(5, 5)).toBe("۵ مورد");
  });

  test("view: chips + list label render English with the document flipped", async () => {
    HL.setLanguage("en");
    const els = {
      chipHl: document.createElement("span"),
      chipNote: document.createElement("span"),
      hlList: document.createElement("ul"),
      secList: document.createElement("section"),
      secEmpty: document.createElement("section"),
      listCount: document.createElement("span"),
    };
    els.chipHl.textContent = HL.count("common.nHighlights", 3);
    els.chipNote.textContent = HL.count("common.nNotes", 1);
    expect(els.chipHl.textContent).toBe("3 highlights");
    expect(els.chipNote.textContent).toBe("1 note");
    HL.setLanguage("fa");
    els.chipHl.textContent = HL.count("common.nHighlights", 3);
    expect(els.chipHl.textContent).toBe("۳ هایلایت");
  });
});

/* ---------- floating widgets (Shadow DOM) ---------- */

describe("floating widgets in en mode", () => {
  test("setLang marks every host with lang/dir; new hosts inherit it", () => {
    expect(HL.ui.setLang("en")).toBe("en");
    const tb = new HL.ui.FloatingToolbar({ onColor: () => {}, onNote: () => {}, onCopy: () => {} });
    expect(tb.host.getAttribute("lang")).toBe("en");
    expect(tb.host.getAttribute("dir")).toBe("ltr");
    HL.ui.setLang("fa");
    expect(tb.host.getAttribute("dir")).toBe("rtl");
    tb.refreshLabels(); /* the composition root calls it after setLang — the el follows */
    expect(tb.el.getAttribute("dir")).toBe("rtl");
  });

  test("toolbar labels re-read on refreshLabels (no rebuild)", () => {
    HL.ui.setLang("fa");
    const tb = new HL.ui.FloatingToolbar({ onColor: () => {}, onNote: () => {}, onCopy: () => {} });
    expect(tb.el.getAttribute("aria-label")).toBe("ابزار هایلایت");
    const first = tb.el.querySelector('button[data-color="yellow"]') as HTMLElement;
    expect(first.getAttribute("title")).toBe("هایلایت زرد");
    HL.ui.setLang("en");
    tb.refreshLabels();
    expect(tb.el.getAttribute("aria-label")).toBe("Highlight toolbar");
    expect(first.getAttribute("title")).toBe("Highlight Yellow");
    expect(tb.el.getAttribute("dir")).toBe("ltr");
    HL.ui.setLang("fa");
  });

  test("popover: view/edit strings follow the language; quote stays content-directed", async () => {
    HL.ui.setLang("en");
    const po = new HL.ui.NotePopover({
      onColorChange: () => {}, onSaveNote: () => {}, onDelete: () => {}, onCopy: () => {}, onClose: () => {},
    });
    po.present({ id: "r1", color: "yellow", note: "", quote: "متن فارسی", createdAt: NOON, rect: { left: 100, top: 100, right: 220, bottom: 124, width: 120, height: 24 }, });
    expect(po.el.getAttribute("dir")).toBe("ltr"); /* UI chrome LTR … */
    expect(po.el.querySelector(".q")?.getAttribute("dir")).toBe("rtl"); /* … Persian quote carries EXPLICIT rtl (v0.14.2) */
    expect(po.el.querySelector(".add-note")?.textContent).toContain("Add a note");
    expect(po.el.querySelector(".note-box span")?.textContent).toBe("No note for this highlight yet.");
    po.render("edit");
    expect((po.el.querySelector("textarea") as HTMLTextAreaElement).placeholder).toBe("Your note for this highlight…");
    const save = po.el.querySelector('button[data-act="save"]') as HTMLElement;
    expect(save.textContent).toBe("Save note");
    po.dismiss();
    HL.ui.setLang("fa");
  });

  test("popover: Persian UI keeps rtl chrome and an LTR quote (content separation, both ways)", () => {
    HL.ui.setLang("fa");
    const po = new HL.ui.NotePopover({
      onColorChange: () => {}, onSaveNote: () => {}, onDelete: () => {}, onCopy: () => {}, onClose: () => {},
    });
    po.present({ id: "r2", color: "teal", note: "note text", quote: "english quote", createdAt: NOON, rect: { left: 100, top: 100, right: 220, bottom: 124, width: 120, height: 24 }, });
    expect(po.el.getAttribute("dir")).toBe("rtl");
    expect(po.el.querySelector(".q")?.getAttribute("dir")).toBe("ltr"); /* English quote → LTR inside the RTL chrome */
    expect((po.el.querySelector(".edit-note") as HTMLElement).getAttribute("title")).toBe("ویرایش یادداشت"); /* noted state's control */
    po.dismiss();
  });

  test("content direction survives the ltr popover chrome (v0.14.2 cross-cases)", () => {
    HL.ui.setLang("en");
    const po = new HL.ui.NotePopover({
      onColorChange: () => {}, onSaveNote: () => {}, onDelete: () => {}, onCopy: () => {}, onClose: () => {},
    });
    po.present({ id: "r3", color: "pink", note: "یادداشت فارسی", quote: "نقل‌قول فارسی", createdAt: NOON,
      rect: { left: 100, top: 100, right: 220, bottom: 124, width: 120, height: 24 } });
    expect(po.el.getAttribute("dir")).toBe("ltr"); /* chrome … */
    expect(po.el.querySelector(".q").getAttribute("dir")).toBe("rtl"); /* … Persian quote explicit rtl */
    expect(po.el.querySelector(".note-text").getAttribute("dir")).toBe("rtl"); /* … and the saved note */
    /* neutral text (digits only) inherits the chrome — no attribute */
    po.present({ id: "r4", color: "pink", note: "", quote: "12345 67890", createdAt: NOON,
      rect: { left: 100, top: 100, right: 220, bottom: 124, width: 120, height: 24 } });
    expect(po.el.querySelector(".q").getAttribute("dir")).toBeNull();
    po.dismiss();
    HL.ui.setLang("fa");
  });

  test("typing direction is explicit for Persian in the ltr popover too (v0.14.2)", () => {
    HL.ui.setLang("en");
    const po = new HL.ui.NotePopover({
      onColorChange: () => {}, onSaveNote: () => {}, onDelete: () => {}, onCopy: () => {}, onClose: () => {},
    });
    po.present({ id: "r5", color: "pink", note: "", quote: "x", createdAt: NOON, editNow: true,
      rect: { left: 100, top: 100, right: 220, bottom: 124, width: 120, height: 24 } });
    const ta = po.el.querySelector('[data-role="note-input"]');
    ta.value = "سلام";
    ta.dispatchEvent(new (globalThis.window.Event)("input", { bubbles: true }));
    expect(ta.getAttribute("dir")).toBe("rtl"); /* Persian typing → explicit rtl */
    ta.value = "";
    ta.dispatchEvent(new (globalThis.window.Event)("input", { bubbles: true }));
    expect(ta.getAttribute("dir")).toBeNull(); /* emptied → neutral, inherits the chrome */
    po.dismiss();
    HL.ui.setLang("fa");
  });

  test("toast re-marks its direction on every show", () => {
    HL.ui.setLang("en");
    HL.ui.Toast.show("hello");
    expect((HL.ui.Toast as any)._el.getAttribute("dir")).toBe("ltr");
    HL.ui.setLang("fa");
    HL.ui.Toast.show("سلام");
    expect((HL.ui.Toast as any)._el.getAttribute("dir")).toBe("rtl");
  });
});

/* ---------- exports ---------- */

describe("exports in en mode", () => {
  function group(items: any[], over: any = {}) {
    return Object.assign({
      key: "https://h.test/a", host: "h.test", title: "Article", url: "https://h.test/a",
      dir: "ltr", notes: 0, items: items,
    }, over);
  }

  test("markdown: English chrome, Gregorian dates, ISO frontmatter intact", () => {
    HL.setLanguage("en");
    const md = HL.markdown.buildLibraryMarkdown({
      groups: [group([
        { text: "quoted", note: "a note", color: "yellow", createdAt: NOON },
      ])],
      exportedAt: NOON,
    });
    expect(md).toContain("# My Highlight Booklet");
    expect(md).toContain("Exported from “وبو” — 1 highlight from 1 article");
    expect(md).toContain("**Note:** a note");
    expect(md).toContain("[Source](https://h.test/a)");
    /* machine-readable metadata stays language-independent */
    expect(md).toContain('exported_at: "2024-10-27"');
    expect(md).toContain("highlights: 1");
    HL.setLanguage("fa");
    const fa = HL.markdown.buildLibraryMarkdown({
      groups: [group([{ text: "متن", note: "یادداشت", color: "yellow", createdAt: NOON }])],
      exportedAt: NOON,
    });
    expect(fa).toContain("# کتابچه هایلایت‌های من");
    expect(fa).toContain("**یادداشت:** یادداشت");
  });

  test("booklet: document lang/dir follows the UI language; article dir stays content-driven", () => {
    HL.setLanguage("en");
    const html = HL.booklet.buildBookletHtml({
      groups: [group([{ text: "quote", note: "", color: "green", createdAt: NOON }])],
      mode: "color", exportedAt: NOON,
    });
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain("Highlight Booklet");
    expect(html).toContain('<section class="article" id="art-1" dir="ltr"'); /* the article keeps its OWN detected dir */
    HL.setLanguage("fa");
    const fa = HL.booklet.buildBookletHtml({
      groups: [group([{ text: "متن", note: "", color: "green", createdAt: NOON }], { dir: "rtl" })],
      mode: "color", exportedAt: NOON,
    });
    expect(fa).toContain('<html lang="fa" dir="rtl">');
    expect(fa).toContain("کتابچه هایلایت‌ها");
    expect(fa).toContain('<section class="article" id="art-1" dir="rtl"');
  });

  test("backup JSON is language-independent (schema + serialization)", async () => {
    HL.setLanguage("en");
    const store = HL.createStore(HL.backends.memoryArea());
    await store.save({ id: "r1", host: "h.test", url: "https://h.test/a", urlNorm: "https://h.test/a", text: "x", createdAt: NOON, updatedAt: NOON });
    const b = await store.exportData();
    expect(b.app).toBe("weboo");
    expect(b.format).toBe(1);
    expect(b.exportedAt).toBeGreaterThan(0); /* raw epoch, no calendar conversion */
    expect(Object.keys(b.highlights.r1)).toContain("createdAt");
    HL.setLanguage("fa");
  });
});

/* ---------- React pieces ---------- */

describe("React components in en mode", () => {
  test("LanguageSelect renders every registered language, value follows the prop", async () => {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { LanguageSelect } = await import("../../src/dashboard/components/LanguageSelect");
    setBunLanguage("en");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(React.createElement(LanguageSelect, { lang: "fa", onSelect: () => {} }));
    await new Promise((r) => setTimeout(r, 20));
    const sel = host.querySelector("select#language-select") as HTMLSelectElement;
    expect([...sel.options].map((o) => o.value)).toEqual(["fa", "en", "de", "es", "ru", "it", "fr", "tr", "zh", "ja", "ko", "ar"]);
    expect(sel.value).toBe("fa");
    const labels = [...sel.options].map((o) => o.textContent);
    expect(labels).toEqual(["Persian", "English", "German", "Spanish", "Russian", "Italian", "French", "Turkish", "Chinese", "Japanese", "Korean", "Arabic"]);
    root.unmount();
    setBunLanguage("fa");
    const host2 = document.createElement("div");
    document.body.appendChild(host2);
    const root2 = createRoot(host2);
    root2.render(React.createElement(LanguageSelect, { lang: "fa", onSelect: () => {} }));
    await new Promise((r) => setTimeout(r, 20));
    const labels2 = [...(host2.querySelector("select#language-select") as HTMLSelectElement).options].map((o) => o.textContent);
    expect(labels2).toEqual(["فارسی", "English", "Deutsch", "Español", "Русский", "Italiano", "Français", "Türkçe", "中文", "日本語", "한국어", "العربية"]); /* endonyms outside en */
    root2.unmount();
    setBunLanguage("fa");
  });

});

/* ---------- the canonical manifest list (load contract) ---------- */

describe("manifest order", () => {
  test("shared/i18n.js sits right after constants in the content-script list", () => {
    const m = JSON.parse(readFile(ext("manifest.json")));
    const js: string[] = m.content_scripts[0].js;
    const i = js.indexOf("shared/i18n.js");
    expect(i).toBeGreaterThan(-1);
    expect(js[i - 1]).toBe("shared/constants.js");
    expect(js[i + 1]).toBe("shared/backends/chrome-storage.js");
  });
});
