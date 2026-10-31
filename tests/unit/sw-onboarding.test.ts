/**
 * Service-worker onboarding tests (v0.20.0) — the install/update
 * first-run: onInstalled('install'|'update') opens dashboard.html with
 * the settings deep-link (#hlx-settings — the exact behavior of the
 * popup's gear button), once per event, and never on chrome_update or
 * plain start-ups.
 *
 * The real SW module loads against the chrome mock (every chrome.* call
 * in the SW is defensively wrapped, so the mock only needs the pieces
 * under test: runtime.onInstalled capture + tabs.create capture).
 */
import { describe, test, expect } from "bun:test";
import { setupDom, loadEngine, makeChromeMock, sleep, ext } from "./helpers/engine";

let created: Array<{ url: string }> = [];
let installedListeners: Array<(d: any) => void> = [];

function makeWorld(seed: Record<string, any> = {}) {
  created = [];
  installedListeners = [];
  const chrome: any = makeChromeMock(seed);
  chrome.runtime.onInstalled = {
    addListener: (fn: (d: any) => void) => { installedListeners.push(fn); },
  };
  chrome.tabs.create = (opts: any, cb: any) => {
    created.push({ url: opts.url });
    setTimeout(() => cb && cb({ id: 77 }), 0);
    return undefined;
  };
  return chrome;
}

async function bootSW() {
  setupDom();
  const chrome = makeWorld();
  /* the mock rides the OPTIONS — loadEngine clears globalThis.chrome first */
  const HL = await loadEngine({
    chrome,
    extraFiles: [ext("background", "service-worker.js")],
    files: ["shared/constants.js", "shared/i18n.js", "shared/backends/chrome-storage.js", "shared/tags.js", "shared/store.js", "shared/message-guard.js"],
  });
  await sleep(30);
  return HL;
}

describe("SW first-run onboarding (v0.20.0)", () => {
  test("onInstalled('install') → dashboard.html#hlx-settings opens once", async () => {
    await bootSW();
    expect(installedListeners.length).toBeGreaterThan(0);
    for (const fn of installedListeners) fn({ reason: "install" });
    await sleep(20);
    expect(created.length).toBe(1);
    expect(created[0].url).toContain("dashboard.html");
    expect(created[0].url).toContain("#hlx-settings");
  });

  test("onInstalled('update') → the same onboarding (exactly once per event)", async () => {
    await bootSW();
    for (const fn of installedListeners) fn({ reason: "update" });
    await sleep(20);
    expect(created.length).toBe(1);
    expect(created[0].url).toContain("#hlx-settings");
  });

  test("onInstalled('chrome_update') → menus only, NO dashboard", async () => {
    await bootSW();
    for (const fn of installedListeners) fn({ reason: "chrome_update" });
    await sleep(20);
    expect(created.length).toBe(0);
  });

  test("no onInstalled event (plain SW wake-up) → nothing opens", async () => {
    await bootSW();
    await sleep(20);
    expect(created.length).toBe(0);
  });
});
