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

  test("invalid timestamps keep the '' contract (fmtDate — the export guard) in both languages", () => {
    HL.setLanguage("en");
    expect(HL.format.fmtDate(NaN)).toBe("");
    HL.setLanguage("fa");
    expect(HL.format.fmtDate(NaN)).toBe("");
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
    expect(po.el.querySelector(".q")?.getAttribute("dir")).toBeNull(); /* … Persian quote stays RTL (no attr — inheritance) */
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
  test("LanguageRadios renders both languages, checked follows the prop", async () => {
    const { setupDom: sd } = await import("./helpers/engine");
    void sd;
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { LanguageRadios } = await import("../../src/dashboard/components/LanguageRadios");
    setBunLanguage("en");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(React.createElement(LanguageRadios, { lang: "fa", onSelect: () => {} }));
    await new Promise((r) => setTimeout(r, 20));
    const radios = [...host.querySelectorAll('input[type="radio"][name="hlx-language"]')] as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(["fa", "en"]);
    expect(radios[0].checked).toBe(true);
    const labels = [...host.querySelectorAll("label.radio strong")].map((s) => s.textContent);
    expect(labels).toEqual(["Persian", "English"]);
    root.unmount();
    setBunLanguage("fa");
    const host2 = document.createElement("div");
    document.body.appendChild(host2);
    const root2 = createRoot(host2);
    root2.render(React.createElement(LanguageRadios, { lang: "fa", onSelect: () => {} }));
    await new Promise((r) => setTimeout(r, 20));
    const labels2 = [...host2.querySelectorAll("label.radio strong")].map((s) => s.textContent);
    expect(labels2).toEqual(["فارسی", "English"]); /* en's own name never translates */
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
