/**
 * i18n gap tests (v0.14.1) — the seven user-reported Persian pockets.
 *
 * Each reported XPath node is reproduced exactly and pinned in BOTH
 * languages:
 *   1  dashboard topbar brand <strong>            → app.name
 *   2  drawer restore section <button>            → restore.title
 *   3  drawer restore section <h3>                → restore.title
 *   4  drawer restore section <p>                 → restore.desc
 *   5  popup unsupported card's dashboard button  → popup.openDash
 *   6  popup brand <strong>                       → app.name
 *   7  popup footer's full-dashboard button       → popup.dashboardBtn
 *
 * Root causes covered: two popup labels never carried data-i18n (5, 7 —
 * silent replace misses), the brand marks had no display key (1, 6), and the
 * restore section was the ONE React region without a snapshot subscription,
 * so it kept its first-paint (fa) text forever (2-4 — the live-switch case
 * below is the exact reported bug, driven through the REAL
 * setSettings → storage → onSettingsChanged → applyLanguage chain).
 *
 * Dashboard side: the shared danger-world (chrome mock installed before the
 * real modules evaluate — the import-order trick), so data.ts's store binds
 * ONCE for both suites regardless of file order. Popup side: fully isolated
 * loadEngine worlds (the popup.test.ts pattern).
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { setupDom, loadEngine, makeChromeMock, sleep, ext, readFile } from "./helpers/engine";
/* the shared world FIRST — its module body installs globalThis.chrome before
   the data.ts/PageChrome imports below evaluate (import-order trick) */
import { restoreSeed } from "./helpers/danger-world";
import { startData, setSettings, getData } from "../../src/dashboard/data";
import { RestoreSectionRegion } from "../../src/dashboard/components/PageChrome";
import { applyDom } from "../../extension/shared/i18n.js";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

const tick = () => new Promise((r) => setTimeout(r, 30));

function mount(jsx: any): { host: HTMLElement; root: ReturnType<typeof createRoot> } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(jsx);
  return { host, root };
}

/* ---------- dashboard side (addresses 1-4) ---------- */

describe("i18n gaps — dashboard (restore section + brand, v0.14.1)", () => {
  beforeAll(async () => {
    setupDom();
    restoreSeed(); /* SEED settings carry no language → fa (the default) */
    startData();
    await sleep(80); /* reloadSettings → applyLanguage has settled */
  });

  afterAll(async () => {
    /* leave the shared world as we found it (later files read this storage) */
    restoreSeed();
    await setSettings({ language: "fa" });
  });

  test("addresses 2-4: seeded en renders the restore section in English", async () => {
    await setSettings({ language: "en" });
    await tick();
    expect(getData().lang).toBe("en");
    const { host, root } = mount(createElement(RestoreSectionRegion));
    await tick();
    expect(host.querySelector("h3")?.textContent).toBe("Restore backup");
    expect(host.querySelector("p")?.textContent).toBe("Pick a JSON backup file; you will choose merge or full replace before anything runs.");
    expect(host.querySelector("button#btn-import")?.textContent).toBe("Restore backup");
    root.unmount();
  });

  test("addresses 2-4 live: fa first paint → language switch → the section RE-RENDERS in English (the reported bug)", async () => {
    await setSettings({ language: "fa" });
    await tick();
    const { host, root } = mount(createElement(RestoreSectionRegion));
    await tick();
    expect(host.querySelector("h3")?.textContent).toBe("بازیابی بک‌آپ"); /* first paint, fa */
    /* the real chain: setSettings → chrome.storage → onSettingsChanged →
       applyLanguage → snapshot flip → the subscribed region re-renders */
    await setSettings({ language: "en" });
    await tick();
    expect(host.querySelector("h3")?.textContent).toBe("Restore backup");
    expect(host.querySelector("button#btn-import")?.textContent?.trim()).toBe("Restore backup");
    expect(host.querySelector("p")?.textContent).toBe("Pick a JSON backup file; you will choose merge or full replace before anything runs.");
    root.unmount();
  });

  test("address 1: the topbar brand <strong> translates through applyDom", async () => {
    const shell = readFile(ext("..", "entrypoints", "dashboard", "index.html"));
    const start = shell.indexOf('<header class="topbar">');
    const end = shell.indexOf("</header>") + "</header>".length;
    document.body.innerHTML = shell.slice(start, end);
    const strong = document.querySelector(".brand-txt strong")!;
    await setSettings({ language: "fa" });
    await tick();
    applyDom(document);
    expect(strong.textContent).toBe("وبو");
    await setSettings({ language: "en" });
    await tick();
    applyDom(document);
    expect(strong.textContent).toBe("Weboo");
    document.body.innerHTML = "";
  });
});

/* ---------- popup side (addresses 5-7) ---------- */

/* real popup markup + load order — the popup.test.ts pattern (fresh world per boot) */
const POPUP_HTML = readFile(ext("popup", "popup.html"));
const WRAP_END = POPUP_HTML.indexOf('<script type="module" src="popup.js"></script>');
const WRAP_HTML = POPUP_HTML.slice(POPUP_HTML.indexOf('<div class="wrap">'), WRAP_END).trim();

const POPUP_FILES = [
  "shared/theme-boot.js",
  "shared/constants.js",
  "shared/i18n.js",
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

const BASE_SETTINGS = {
  defaultColor: "teal",
  showToolbar: true,
  showBadge: true,
  disabledHosts: [] as string[],
  theme: "auto",
};

const TAB = { id: 7, url: "https://fa.wikipedia.org/wiki/Persian", title: "مقاله" };

async function bootPopup(seed: Record<string, any>) {
  const win = setupDom({ html: WRAP_HTML });
  const HL = await loadEngine({ chrome: makeChromeMock(seed, [TAB]), files: POPUP_FILES });
  await sleep(150); /* init chain (setTimeout(0) callbacks) */
  return { win, HL };
}

describe("i18n gaps — popup (brand + the two dashboard buttons, v0.14.1)", () => {
  test("addresses 5-7 + title: seeded en renders the buttons and brand in English", async () => {
    const { win } = await bootPopup({ "hlx:settings": { ...BASE_SETTINGS, language: "en" } });
    const $ = (id: string) => win.document.getElementById(id)!;
    expect(win.document.querySelector(".brand-name")?.textContent).toBe("Weboo"); /* address 6 */
    expect($("btn-dash-unsupp").textContent?.trim()).toBe("Open dashboard"); /* address 5 (label is a span next to the icon) */
    expect($("btn-dashboard").textContent?.trim()).toBe("Full dashboard"); /* address 7 */
    expect(win.document.title).toBe("Weboo"); /* the title follows the brand display */
  });

  test("fa control: the same nodes keep their Persian copy (no regression)", async () => {
    const { win } = await bootPopup({ "hlx:settings": { ...BASE_SETTINGS } });
    const $ = (id: string) => win.document.getElementById(id)!;
    expect(win.document.querySelector(".brand-name")?.textContent).toBe("وبو");
    expect($("btn-dash-unsupp").textContent?.trim()).toBe("باز کردن داشبورد");
    expect($("btn-dashboard").textContent?.trim()).toBe("داشبورد کامل");
    expect(win.document.title).toBe("وبو");
  });
});
