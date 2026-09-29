/**
 * HL.clipboard tests — single copy implementation (async API + legacy fallback)
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupDom, loadEngine } from "./helpers/engine";

let HL: any;
let win: any;
let realNavigator: any;

beforeEach(async () => {
  win = setupDom();
  HL = await loadEngine({});
  realNavigator = (globalThis as any).navigator;
});

afterEach(() => {
  (globalThis as any).navigator = realNavigator;
  /* remove the mocked execCommand */
  delete (win.document as any).execCommand;
});

/** Installs a mocked navigator on globalThis */
function setClipboardNavigator(clipboard: any) {
  (globalThis as any).navigator = { clipboard };
}

describe("HL.clipboard.copyText", () => {
  test("قرارداد: فقط copyText را ارائه می‌دهد (ISP)", () => {
    expect(Object.keys(HL.clipboard)).toEqual(["copyText"]);
  });

  test("مسیر async موفق → true", async () => {
    const wrote: string[] = [];
    setClipboardNavigator({ writeText: (t: string) => (wrote.push(t), Promise.resolve()) });
    await expect(HL.clipboard.copyText("سلام")).resolves.toBe(true);
    expect(wrote).toEqual(["سلام"]);
  });

  test("مسیر async شکست → legacy (execCommand) → true", async () => {
    setClipboardNavigator({ writeText: () => Promise.reject(new Error("denied")) });
    win.document.execCommand = () => true;
    await expect(HL.clipboard.copyText("متن")).resolves.toBe(true);
    /* the temporary textarea must be removed after copying */
    expect(win.document.querySelectorAll("textarea").length).toBe(0);
  });

  test("هر دو مسیر شکست → false", async () => {
    setClipboardNavigator({ writeText: () => Promise.reject(new Error("denied")) });
    win.document.execCommand = () => false;
    await expect(HL.clipboard.copyText("متن")).resolves.toBe(false);
  });

  test("نبود navigator.clipboard → مستقیم legacy", async () => {
    setClipboardNavigator(undefined);
    let called = false;
    win.document.execCommand = () => { called = true; return true; };
    await expect(HL.clipboard.copyText("متن")).resolves.toBe(true);
    expect(called).toBe(true);
  });

  test("متن خالی → false بدون فراخوانی API", async () => {
    let called = false;
    setClipboardNavigator({ writeText: () => { called = true; return Promise.resolve(); } });
    await expect(HL.clipboard.copyText("")).resolves.toBe(false);
    await expect(HL.clipboard.copyText(null as any)).resolves.toBe(false);
    expect(called).toBe(false);
  });
});
