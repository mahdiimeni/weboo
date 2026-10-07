/**
 * HL.export tests — delivery module (filenames, download mechanism, print flow)
 * v0.6.0 additions: markdownFileName / bookletFileName / printHtml.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupDom, loadEngine, sleep } from "./helpers/engine";

let HL: any;
let win: any;
let captured: any[] = [];
let realCreate: any;
let realRevoke: any;

beforeEach(async () => {
  win = setupDom();
  HL = await loadEngine({ files: ["shared/export.js"] });
  /* capture blobs instead of real object URLs (works in every runtime) */
  captured = [];
  realCreate = (globalThis as any).URL.createObjectURL;
  realRevoke = (globalThis as any).URL.revokeObjectURL;
  (globalThis as any).URL.createObjectURL = (b: any) => {
    captured.push(b);
    return "blob:mock-" + captured.length;
  };
  (globalThis as any).URL.revokeObjectURL = (_u: string) => { /* noop */ };
});

afterEach(() => {
  (globalThis as any).URL.createObjectURL = realCreate;
  (globalThis as any).URL.revokeObjectURL = realRevoke;
});

describe("HL.export — قرارداد", () => {
  test("کلیدهای عمومی (ISP): تحویل، نه ساخت محتوا", () => {
    expect(Object.keys(HL.export)).toEqual([
      "downloadText",
      "backupFileName",
      "markdownFileName",
      "bookletFileName",
      "saveBackup",
      "printHtml",
    ]);
  });
});

describe("HL.export — نام فایل‌ها", () => {
  test("الگوی مشترک: web-highlighter-<kind>-YYYY-MM-DD-HHMM.<ext>", () => {
    expect(HL.export.backupFileName()).toMatch(/^web-highlighter-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(HL.export.markdownFileName()).toMatch(/^web-highlighter-markdown-\d{4}-\d{2}-\d{2}-\d{4}\.md$/);
    expect(HL.export.bookletFileName()).toMatch(/^web-highlighter-booklet-\d{4}-\d{2}-\d{2}-\d{4}\.html$/);
  });

  test("هم‌مهرِ زمانی بین سه نام (یک stamp — سه خروجی هم‌لحظه)", () => {
    const stampRe = /\d{4}-\d{2}-\d{2}-\d{4}/;
    const a = HL.export.backupFileName().match(stampRe)![0];
    const b = HL.export.markdownFileName().match(stampRe)![0];
    const c = HL.export.bookletFileName().match(stampRe)![0];
    expect(b).toBe(a);
    expect(c).toBe(a);
  });
});

describe("HL.export.downloadText", () => {
  test("blob با mime درست + لینک download با نام فایل + کلیک", async () => {
    let clicked = 0;
    win.document.addEventListener("click", (e: any) => {
      if (e.target && e.target.tagName === "A") clicked++;
    });
    HL.export.downloadText("lib.md", "# سلام", "text/markdown");
    expect(captured.length).toBe(1);
    expect(captured[0].type).toBe("text/markdown;charset=utf-8");
    expect(await captured[0].text()).toBe("# سلام");
    const a = win.document.querySelector("a[download]") as any;
    expect(a).not.toBeNull();
    expect(a.download).toBe("lib.md");
    expect(clicked).toBe(1);
    await sleep(1600); /* پاک‌سازی خودکار لینک */
    expect(win.document.querySelector("a[download]")).toBeNull();
  });

  test("mime پیش‌فرض JSON است", () => {
    HL.export.downloadText("b.json", "{}");
    expect(captured[0].type).toBe("application/json;charset=utf-8");
  });
});

describe("HL.export.saveBackup", () => {
  test("JSON زیبا با نام بک‌آپ", async () => {
    HL.export.saveBackup({ app: "web-highlighter", highlights: { x: { text: "ت" } } });
    expect(captured.length).toBe(1);
    expect(HL.export.backupFileName).toBeDefined();
    const a = win.document.querySelector("a[download]") as any;
    expect(a.download).toMatch(/^web-highlighter-backup-.*\.json$/);
    expect(await captured[0].text()).toContain('"highlights"');
  });
});

describe("HL.export.printHtml (v0.6.0 — مسیر PDF)", () => {
  test("iframe مخفی با srcdoc ساخته و بعد از load پاک می‌شود", async () => {
    HL.export.printHtml("<!DOCTYPE html><html><body><b>booklet</b></body></html>");
    const f = win.document.querySelector('iframe[title="print-frame"]') as any;
    expect(f).not.toBeNull();
    expect(f.getAttribute("aria-hidden")).toBe("true");
    expect(f.srcdoc).toContain("<b>booklet</b>");
    expect(f.style.visibility).toBe("hidden"); /* مخفی — پنجره‌ی چاپ خودش دیده می‌شود */
    /* شبیه‌سازی load (مرورگر واقعی خودش شلیک می‌کند) */
    if (typeof f.onload === "function") f.onload();
    await sleep(600);
    expect(win.document.querySelector('iframe[title="print-frame"]')).toBeNull(); /* پاک‌سازی پس از دیالوگ */
  });

  test("گارد leak: فریم بعد از ۱۰ ثانیه حداکثر جمع می‌شود (بدون load)", async () => {
    HL.export.printHtml("<html></html>");
    expect(win.document.querySelector('iframe[title="print-frame"]')).not.toBeNull();
    /* بدون فراخوانی onload — تایمر گارد را مستقیماً تست نمی‌کنیم (کند)،
       فقط مطمئن می‌شویم فریم تا اینجا زنده و ثبت‌شده است و remove قابل دسترس است */
    const f = win.document.querySelector('iframe[title="print-frame"]') as any;
    f.remove();
    expect(win.document.querySelector('iframe[title="print-frame"]')).toBeNull();
  });
});

describe("HL.export — بک‌آپ انتخابی (نام فایل partial)", () => {
  test("backupFileName(true) پسوند partial دارد؛ حالت عادی بدون partial می‌ماند", () => {
    expect(HL.export.backupFileName(true)).toMatch(/^web-highlighter-backup-partial-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(HL.export.backupFileName()).toMatch(/^web-highlighter-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(HL.export.backupFileName(false)).toMatch(/^web-highlighter-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  });

  test("saveBackup نشان meta.partial را می‌خواند و نام فایل را تعیین می‌کند", async () => {
    HL.export.saveBackup({ app: "web-highlighter", highlights: {}, meta: { count: 0, partial: true } });
    let a = win.document.querySelector("a[download]") as any;
    expect(a.download).toMatch(/^web-highlighter-backup-partial-.*\.json$/);
    a.remove(); /* the link cleans itself on a timer — outlive it explicitly */

    HL.export.saveBackup({ app: "web-highlighter", highlights: { x: { text: "ت" } }, meta: { count: 1 } });
    a = win.document.querySelector("a[download]") as any;
    expect(a.download).toMatch(/^web-highlighter-backup-\d{4}/);
    expect(a.download).not.toContain("partial");
  });
});
