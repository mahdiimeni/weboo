/**
 * Packaging integrity tests (mechanical DRY)
 *
 * Everything the shipped package references must exist, load in the right
 * order, and carry the same version. The version stays identical across all
 * extension spots (manifest / shared constants / popup.html / dashboard.html).
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { setupDom, loadEngine, readFile, ext, exists } from "./helpers/engine";

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
      manifest.options_ui?.page,
    ];
    for (const f of files) {
      expect(exists(ext(f))).toBe(true);
    }
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
    const html = readFile(ext("dashboard", "dashboard.html"));
    const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    expect(srcs).toEqual(["../shared/theme-boot.js", "dashboard.js"]);
    for (const s of srcs) expect(exists(ext(s.startsWith("../") ? s.slice(3) : "dashboard/" + s))).toBe(true);
    const names = [...readFile(ext("dashboard", "dashboard.js")).matchAll(/^import\s+(?:[^"']*?from\s+)?["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThanOrEqual(13);
    for (const sp of names) expect(exists(ext("dashboard", sp))).toBe(true);
    expect(names.indexOf("../shared/constants.js")).toBeLessThan(names.indexOf("../shared/backends/chrome-storage.js"));
    expect(names.indexOf("../shared/tags.js")).toBeLessThan(names.indexOf("../shared/store.js"));
    expect(names.indexOf("../shared/store.js")).toBeLessThan(names.indexOf("./dashboard-data.js"));
    expect(names.indexOf("./dashboard-data.js")).toBeLessThan(names.indexOf("./dashboard-view.js"));
    /* reading exports (v0.6.0): both document builders consume format → imported
       before them; the controller consumes both → later in the entry list */
    expect(names.indexOf("../shared/format.js")).toBeLessThan(names.indexOf("../shared/markdown-export.js"));
    expect(names.indexOf("../shared/format.js")).toBeLessThan(names.indexOf("../shared/booklet-export.js"));
    expect(names.indexOf("../shared/markdown-export.js")).toBeLessThan(names.indexOf("./dashboard-data.js"));
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

describe("صفحات ماژولی (7c-1/7c-3)", () => {
  test("popup و dashboard: یک اسکریپت کلاسیک (theme-boot) + یک entry ماژول", () => {
    /* theme-boot stays classic on purpose: a blocking <head> script runs
       BEFORE every deferred module (anti-flash window) and it is first in both
       pages — mixed classic+module is order-safe ONLY while classic exists
       exclusively first. Everything else is ONE module entry whose import list
       is the page's load-order contract (7c-3). A classic tag on any converted
       file would SyntaxError it. */
    const cases: Array<[string, string]> = [["popup/popup.html", "popup.js"], ["dashboard/dashboard.html", "dashboard.js"]];
    for (const [page, entry] of cases) {
      const html = readFile(ext(page));
      const tags = [...html.matchAll(/<script([^>]*)><\/script>/g)].map((m) => m[1].trim());
      expect(tags).toEqual([`src="../shared/theme-boot.js"`, `type="module" src="${entry}"`]);
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
    const dash = readFile(ext("dashboard", "dashboard.html"));
    expect(dash).toContain(`v${V}`);
  });
});
