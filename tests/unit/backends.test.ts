/**
 * Backend tests — details specific to each port implementation
 * (this suite covers the extension's own backend, chrome-storage)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { setupDom, loadEngine, makeChromeMock, sleep } from "./helpers/engine";

describe("بک‌اند chrome-storage", () => {
  beforeEach(() => { setupDom(); });

  test("با نبود chrome به بک‌اند حافظه‌ای degrade می‌شود (رفتار v1.0.5 حفظ شده)", async () => {
    const HL = loadEngine({ chrome: undefined });
    delete (globalThis as any).chrome;
    const store = HL.createStore(HL.backends.chromeStorage());
    const s = await store.getSettings();
    expect(s.defaultColor).toBe("yellow");
    await store.save({ id: "r", host: "h", url: "u", urlNorm: "u", text: "t", createdAt: 1, updatedAt: 1 });
    expect((await store.getAllRecords()).size).toBe(1);
  });

  test("خطای set (lastError) به reject تبدیل می‌شود", async () => {
    const chrome = makeChromeMock();
    const HL = loadEngine({ chrome });
    const store = HL.createStore(HL.backends.chromeStorage());
    chrome.__state.failNextSet = true;
    await expect(store.setSettings({ defaultColor: "teal" })).rejects.toThrow("mock quota");
  });

  test("خطای get به reject تبدیل می‌شود", async () => {
    const chrome = makeChromeMock();
    const HL = loadEngine({ chrome });
    const store = HL.createStore(HL.backends.chromeStorage());
    chrome.__state.failNextGet = true;
    await expect(store.getSettings()).rejects.toThrow("mock get error");
  });

  test("onChange مستقیم بک‌اند شکل changes استاندارد می‌دهد", async () => {
    const chrome = makeChromeMock();
    const HL = loadEngine({ chrome });
    const backend = HL.backends.chromeStorage();
    let changes: any = null;
    backend.onChange((c: any) => { changes = c; });
    await backend.set({ "hlx:settings": { a: 1 } });
    await sleep(20);
    expect(changes["hlx:settings"].newValue).toEqual({ a: 1 });
  });

  test("unsubscribe واقعاً شنونده را برمی‌دارد", async () => {
    const chrome = makeChromeMock();
    const HL = loadEngine({ chrome });
    const backend = HL.backends.chromeStorage();
    let calls = 0;
    const unsub = backend.onChange(() => { calls++; });
    await backend.set({ k: 1 });
    await sleep(20);
    unsub();
    await backend.set({ k: 2 });
    await sleep(20);
    expect(calls).toBe(1);
  });
});

describe("runtime bridge — پل chrome.runtime", () => {
  test("با chrome کامل کار می‌کند", () => {
    setupDom();
    const chrome = makeChromeMock();
    chrome.runtime.sendMessage = (msg: any, cb: any) => { cb({ ok: true }); };
    chrome.runtime.onMessage = { addListener: (l: any) => { (chrome as any).__msgListener = l; } };
    const HL = loadEngine({ chrome });
    expect(HL.runtime.available).toBe(true);
    expect(HL.runtime.manifestVersion()).toBe(HL.VERSION); /* mock reads from the real manifest (engine.ts) */
    expect(HL.runtime.getURL("dashboard/dashboard.html")).toContain("dashboard");
    let got: any = null;
    HL.runtime.onMessage((msg: any) => { got = msg; });
    (chrome as any).__msgListener({ type: "ping" }, {}, () => {});
    expect(got).toEqual({ type: "ping" });
  });

  test("بدون chrome به‌صورت امن degrade می‌شود", () => {
    setupDom();
    const HL = loadEngine({ chrome: undefined });
    delete (globalThis as any).chrome;
    expect(HL.runtime.available).toBe(false);
    expect(HL.runtime.manifestVersion()).toBe(HL.VERSION);
    expect(HL.runtime.getURL("x/y.html")).toBe("x/y.html");
    expect(HL.runtime.onMessage(() => {})).toBe(false);
    /* send never rejects */
    return HL.runtime.send({ type: "x" }).then((v: any) => expect(v).toBeUndefined());
  });

  test("پل runtime — پس از حذف faviconUrl (v1.1.4): سطح بدون عضو favicon است و بقیه دست‌نخورده", () => {
    setupDom();
    const chrome = makeChromeMock();
    const HL = loadEngine({ chrome });
    /* favicons no longer come through the bridge — dataURL comes from the store (hlx:f:<host>) */
    expect((HL.runtime as any).faviconUrl).toBeUndefined();
    expect(HL.runtime.available).toBe(true);
    expect(HL.runtime.manifestVersion()).toBe(HL.VERSION);
    expect(typeof HL.runtime.send).toBe("function");
  });

  test("send خطای runtime را می‌بلعد (SW خواب)", async () => {
    setupDom();
    const chrome = makeChromeMock();
    chrome.runtime.sendMessage = (_msg: any, cb: any) => { cb(); }; /* no response */
    const HL = loadEngine({ chrome });
    const v = await HL.runtime.send({ type: "x" });
    expect(v).toBeUndefined();
  });
});
