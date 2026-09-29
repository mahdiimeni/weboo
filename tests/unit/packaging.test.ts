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

beforeAll(() => {
  setupDom();
  HL = loadEngine({ files: ["shared/constants.js"] });
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
    const html = readFile(ext("popup", "popup.html"));
    const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThanOrEqual(5);
    for (const s of srcs) {
      const rel = s.startsWith("../") ? s.slice(3) : "popup/" + s;
      expect(exists(ext(rel))).toBe(true);
    }
    /* order: constants → backends → store before popup.js */
    const names = srcs.map((s) => s.split("/").pop());
    expect(names.indexOf("constants.js")).toBeLessThan(names.indexOf("chrome-storage.js"));
    expect(names.indexOf("store.js")).toBeLessThan(names.indexOf("popup.js"));
    expect(names.indexOf("format.js")).toBeLessThan(names.indexOf("popup.js"));
    /* article tags (v1.2.15): the tag domain loads with the store everywhere */
    expect(names.indexOf("tags.js")).toBeLessThan(names.indexOf("store.js"));
    /* MVC order (v1.2.9): pure data → view → controller */
    expect(names.indexOf("popup-data.js")).toBeLessThan(names.indexOf("popup-view.js"));
    expect(names.indexOf("popup-view.js")).toBeLessThan(names.indexOf("popup.js"));
    /* ISP: the popup does not load utils/clipboard (not needed) */
    expect(srcs.some((s) => s.endsWith("utils.js") || s.endsWith("clipboard.js"))).toBe(false);
  });

  test("هر اسکریپت ارجاع‌شده در dashboard.html وجود دارد", () => {
    const html = readFile(ext("dashboard", "dashboard.html"));
    const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThanOrEqual(7);
    for (const s of srcs) {
      const rel = s.startsWith("../") ? s.slice(3) : "dashboard/" + s;
      expect(exists(ext(rel))).toBe(true);
    }
    const names = srcs.map((s) => s.split("/").pop());
    expect(names.indexOf("constants.js")).toBeLessThan(names.indexOf("chrome-storage.js"));
    expect(names.indexOf("store.js")).toBeLessThan(names.indexOf("dashboard-data.js"));
    expect(names.indexOf("dashboard-view.js")).toBeLessThan(names.indexOf("dashboard.js"));
    /* article tags (v1.2.15): tag domain → store → dashboard-data (its applyFilters consumes HL.tags) */
    expect(names.indexOf("tags.js")).toBeLessThan(names.indexOf("store.js"));
    expect(names.indexOf("tags.js")).toBeLessThan(names.indexOf("dashboard-data.js"));
    /* reading exports (v0.6.0): both document builders consume HL.format → load
       after it; the controller consumes both → load before dashboard.js */
    expect(names.indexOf("format.js")).toBeLessThan(names.indexOf("markdown-export.js"));
    expect(names.indexOf("format.js")).toBeLessThan(names.indexOf("booklet-export.js"));
    expect(names.indexOf("markdown-export.js")).toBeLessThan(names.indexOf("dashboard.js"));
    expect(names.indexOf("booklet-export.js")).toBeLessThan(names.indexOf("dashboard.js"));
    /* ISP: the export builders are dashboard-only — the content-script list must NOT carry them */
    const manifest = JSON.parse(readFile(ext("manifest.json")));
    expect(manifest.content_scripts[0].js.includes("shared/markdown-export.js")).toBe(false);
    expect(manifest.content_scripts[0].js.includes("shared/booklet-export.js")).toBe(false);
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
    const allowedModules = new Set(["textindex", "anchor"]); /* 7b: bundler-only files */
    for (const name of emitted) {
      /* source of truth lives in src/shared (ext() is extension/-rooted — ".." climbs out) */
      expect(exists(ext("..", "src", "shared", name + ".ts"))).toBe(true);
      const js = readFile(ext("shared", name + ".js"));
      const isModule = /^\s*(import|export)\s/m.test(js);
      if (allowedModules.has(name)) expect(isModule).toBe(true); /* drift-proof the other way */
      else expect(isModule).toBe(false); /* classic: no module statements */
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
