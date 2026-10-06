/**
 * Packaging integrity tests (mechanical DRY)
 *
 * Everything the shipped package references must exist, load in the right
 * order, and carry the same version. The version stays identical across all
 * extension spots (manifest / shared constants / popup.html / dashboard.html).
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine, readFile, ext, exists } from "./helpers/engine";

function walkJs(dir: string): string[] {
  const out: string[] = [];
  for (const e of require("node:fs").readdirSync(dir, { withFileTypes: true })) {
    const full = dir + "/" + e.name;
    if (e.isDirectory()) out.push(...walkJs(full));
    else if (e.name.endsWith(".js")) out.push(full);
  }
  return out;
}

let HL: any;

beforeAll(async () => {
  setupDom();
  HL = await loadEngine({ files: ["shared/constants.js"] });
});

describe("یکپارچگی بسته (packaging)", () => {
  test("هر فایل ارجاع‌شده در manifest.json وجود دارد", () => {
    const manifest = JSON.parse(readFile(ext("manifest.json")));
    const files: string[] = [
      ...(manifest.content_scripts?.[0]?.js || []),
      manifest.background?.service_worker,
      manifest.action?.default_popup,
    ];
    for (const f of files) {
      expect(exists(ext(f))).toBe(true);
    }
    /* Phase 8 switchover: the options page is a WXT entrypoint
       (entrypoints/dashboard/index.html) — GENERATED into .output at build
       time, no longer byte-copied from extension/. WXT flattens subdir
       index.html entrypoints to the package root, so the manifest pointer
       is dashboard.html. Its existence + anti-flash shape in the OUTPUT are
       owned by scripts/wxt-parity.mjs (§3b) and the page-shape test below. */
    expect(manifest.options_ui?.page).toBe("dashboard.html");
    for (const icon of Object.values<any>(manifest.icons || {})) {
      expect(exists(ext(icon))).toBe(true);
    }
    /* content scripts load in the right order: constants → backends → … → content */
    const js: string[] = manifest.content_scripts[0].js;
    expect(js[0]).toBe("shared/constants.js");
    expect(js.indexOf("shared/backends/chrome-storage.js")).toBeLessThan(js.indexOf("shared/store.js"));
    expect(js.indexOf("shared/format.js")).toBeLessThan(js.indexOf("shared/ui/base.js"));
    expect(js.indexOf("shared/clipboard.js")).toBeLessThan(js.indexOf("shared/highlighter.js"));
    expect(js.indexOf("shared/url.js")).toBeLessThan(js.indexOf("content/content.js"));
    expect(js.indexOf("shared/store.js")).toBeLessThan(js.indexOf("shared/highlighter.js"));
    expect(js.indexOf("shared/highlighter.js")).toBeLessThan(js.indexOf("content/content.js"));
  expect(js.indexOf("shared/anchor.js")).toBeLessThan(js.indexOf("shared/highlighter.js")); /* Phase 3: resolver before its only consumer */
    /* smart direction (v1.2.10): the direction decision loads before the popover view */
    expect(js.indexOf("shared/detect-dir.js")).toBeLessThan(js.indexOf("shared/ui/popover.js"));
    /* article tags (v1.2.15): the tag domain loads before the store (integrity gate) */
    expect(js.indexOf("shared/tags.js")).toBeLessThan(js.indexOf("shared/store.js"));
  });

  test("هر اسکریپت ارجاع‌شده در popup.html وجود دارد", () => {
    /* 7c-3: the page carries theme-boot (classic) + ONE module entry — the
       load-order contract now lives in the entry's import list, which this
       test parses. Order pairs below mirror the pre-7c-3 document order. */
    const html = readFile(ext("popup", "popup.html"));
    const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    expect(srcs).toEqual(["../shared/theme-boot.js", "popup.js"]);
    for (const s of srcs) expect(exists(ext(s.startsWith("../") ? s.slice(3) : "popup/" + s))).toBe(true);
    const names = [...readFile(ext("popup", "popup.js")).matchAll(/^import\s+(?:[^"']*?from\s+)?["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const sp of names) expect(exists(ext("popup", sp))).toBe(true);
    /* order: constants → backends; tags → store; MVC data → view (entry is last by definition) */
    expect(names.indexOf("../shared/constants.js")).toBeLessThan(names.indexOf("../shared/backends/chrome-storage.js"));
    expect(names.indexOf("../shared/tags.js")).toBeLessThan(names.indexOf("../shared/store.js"));
    expect(names.indexOf("./popup-data.js")).toBeLessThan(names.indexOf("./popup-view.js"));
    expect(names.indexOf("../shared/store.js")).toBeLessThan(names.indexOf("./popup-data.js"));
    /* ISP: the popup does not load utils/clipboard (not needed) */
    expect(names.some((n) => n.includes("utils.js") || n.includes("clipboard.js"))).toBe(false);
  });

  test("هر اسکریپت ارجاع‌شده در dashboard.html وجود دارد", () => {
    /* Phase 8 Task 5: the controller is retired — the page's module graph is
       the React entry's (ESM imports carry no load-order contract anymore;
       every dep is statically reachable). The template carries theme-boot
       (classic, anti-flash) + the one module entry; the entry bridges to the
       React regions + data layer directly. */
    const html = readFile(ext("..", "entrypoints", "dashboard", "index.html"));
    const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    expect(srcs).toEqual(["/shared/theme-boot.js", "./main.tsx"]);
    expect(exists(ext("shared", "theme-boot.js"))).toBe(true);
    const entry = readFile(ext("..", "entrypoints", "dashboard", "main.tsx"));
    expect(entry).toContain('from "../../src/dashboard/App"');
    expect(entry).toContain('from "../../src/dashboard/data"');
    expect(entry).toContain('from "../../src/dashboard/chrome"');
    /* the retired controller leaves no dangling references */
    expect(exists(ext("dashboard", "dashboard.js"))).toBe(false);
    expect(exists(ext("dashboard", "dashboard-view.js"))).toBe(false);
    expect(entry).not.toContain("dashboard.js");
  });
});

describe("emit کلاسیک (TypeScript → اسکریپت قابل تزریق)", () => {
  test("خروجی tsc هرگز import/export ندارد", () => {
    /* tsconfig.extension.json emits these from src/shared/*.ts. A single
       `import`/`export` in a TS source flips tsc to module output and appends
       `export {};` — a SyntaxError when a CLASSIC loader injects the file
       (popup/dashboard <script> tags, any not-yet-migrated list). This is
       the tripwire for that whole class of bug.
       Phase 7b: textindex/anchor are converted ES modules — allowed to be
       modules ONLY because every classic loader of them is gone (WXT bundle
       + engine strip-path; manifest list = order data). The allowlist is
       explicit: a conversion outside it fails here until its classic loaders
       are removed first. */
    const emitted = ["format", "detect-dir", "url", "utils", "tags", "textindex", "anchor", "store"];
    for (const name of emitted) {
      /* source of truth lives in src/shared (ext() is extension/-rooted — ".." climbs out) */
      expect(exists(ext("..", "src", "shared", name + ".ts"))).toBe(true);
      /* 7c-2: every emitted file is an ES module — its only loaders are the WXT
         content bundle, the pages (type=module tags) and the engine vm graph. */
      expect(/^\s*(import|export)\s/m.test(readFile(ext("shared", name + ".js")))).toBe(true);
    }
  });
});

describe("کل مسیر محتوا ماژولی است (7c-2)", () => {
  test("هر ۲۰ فایل manifest content_scripts سینتکس ماژول دارد", () => {
    /* Final-form two-way tripwire: since 7c-2 every content-side file carries
       import/export. One direction: no file may lose its module syntax (the
       WXT bundle would silently drop declared edges and identity exports rot).
       The opposite direction lives in the bundle test above: the emitted
       content-scripts/content.js must contain ZERO module statements. */
    const files = JSON.parse(readFile(ext("manifest.json"))).content_scripts[0].js;
    expect(files.length).toBe(20);
    for (const f of files) {
      expect(/^\s*(import|export)\s/m.test(readFile(ext(f)))).toBe(true);
    }
  });
});

describe("بدون رجیستری سراسری (Phase 12)", () => {
  test("هیچ فایل محصولی globalThis.HL نمی‌نویسد و نمی‌خواند", () => {
    /* The migration's final form: no globalThis.HL ANYWHERE in the product —
       every file is an ES module with real bindings; the theme write side
       lives on ui.applyThemeNow (ui/base.js), the anti-flash read stays in
       the classic theme-boot (which touches only localStorage + the root
       attributes). The test harness harvests module bindings instead. */
    const files = walkJs(ext("."));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      /* code only — doc comments may narrate the retired registry */
      const code = readFile(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code).not.toMatch(/globalThis\.HL|\bHL\s*=\s*globalThis/);
    }
  });
});

describe("صفحات ماژولی (7c-1/7c-3)", () => {
  test("popup و dashboard: یک اسکریپت کلاسیک (theme-boot) + یک entry ماژول", () => {
    /* theme-boot stays classic on purpose: a blocking <head> script runs
       BEFORE every deferred module (anti-flash window) and it is first in both
       pages — mixed classic+module is order-safe ONLY while classic exists
       exclusively first. Everything else is ONE module entry whose import list
       is the page's load-order contract (7c-3). A classic tag on any converted
       file would SyntaxError it. */
    /* Phase 8: the dashboard side reads the WXT entrypoint template — same
       anti-flash shape, output-rooted theme-boot path, module entry = the
       main.tsx bridge. */
    const cases: Array<[string, string, string]> = [
      ["popup/popup.html", `src="../shared/theme-boot.js"`, `type="module" src="popup.js"`],
      ["../entrypoints/dashboard/index.html", `src="/shared/theme-boot.js"`, `type="module" src="./main.tsx"`],
    ];
    for (const [page, boot, entry] of cases) {
      const html = readFile(ext(page));
      const tags = [...html.matchAll(/<script([^>]*)><\/script>/g)].map((m) => m[1].trim());
      expect(tags).toEqual([boot, entry]);
    }
  });
});

describe("نسخه‌ی واحد در کل افزونه", () => {
  let V = "";
  beforeAll(() => { V = HL.VERSION; });

  test("manifest.json", () => {
    const manifest = JSON.parse(readFile(ext("manifest.json")));
    expect(manifest.version).toBe(V);
  });

  test("popup.html و dashboard.html (لیبل استاتیک fallback)", () => {
    const popup = readFile(ext("popup", "popup.html"));
    expect(popup).toContain(`v${V}`);
    /* Phase 8: the dashboard template lives in the WXT entrypoint now */
    const dash = readFile(ext("..", "entrypoints", "dashboard", "index.html"));
    expect(dash).toContain(`v${V}`);
  });
});
