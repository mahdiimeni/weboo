/**
 * Unit-test infrastructure for «وب هایلایتر» (Web Highlighter)
 *
 * Core scripts are classic scripts mounted on globalThis.HL;
 * this helper prepares a simulated DOM (happy-dom), loads the modules
 * with a global eval, and provides utilities (chrome mock, sleep, …).
 * Each test builds a fresh "world" via setupDom + loadEngine.
 */
import { Window } from "happy-dom";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dir, "..", "..", "..");

/* The version is read from the real manifest (single source) so the chrome mock always stays in sync with the extension version */
const MANIFEST_VERSION = JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf-8")).version as string;

export const ext = (...p: string[]) => join(ROOT, "extension", ...p);
export const readFile = (f: string) => readFileSync(f, "utf-8");
export const exists = (f: string) => existsSync(f);
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function evalClassic(file: string): void {
  /* indirect eval — evaluates in global scope, exactly like a <script> tag */
  (0, eval)(readFileSync(file, "utf-8"));
}

/* ---------- module-aware loading (Phase 7b) ----------
   A converted file carries a top-level import/export. Two paths:
   export-only  → synchronous: exports are stripped and the body is wrapped in
                  a function, so every world is isolated exactly like classic
                  eval. Tests read the HL namespace, never the bindings, so
                  stripping costs nothing.
   has imports  → async dynamic import with a world-busted URL (?world=N re-
                  executes the module graph for this world). Callers of such
                  worlds must `await loadEngine()` — none exist yet; the path
                  is here so the first import-bearing conversion needs no
                  engine rework. Ceiling: relative imports inside a converted
                  file resolve canonically (no bust) — only safe while files
                  stay stateless. */
const srcCache = new Map<string, string>();
const readSrc = (f: string): string => {
  let c = srcCache.get(f);
  if (c === undefined) { c = readFileSync(f, "utf-8"); srcCache.set(f, c); }
  return c;
};
const RE_TOP_IMPORT = /^import\s/m;
const RE_TOP_MODULE = /^(?:import|export)\s/m;
let worldSeq = 0;

function loadModuleSync(file: string): void {
  const stripped = readSrc(file)
    .replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)/gm, "")
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, "");
  (0, eval)("(function(){\n" + stripped + "\n})()");
}

/* ---------- XPath polyfill for happy-dom ----------
   document.evaluate is not implemented in happy-dom; the expressions produced
   by domwrap.xpathOf have a simple shape: ./div[1]/p[2]/text()[1] — we
   implement exactly this subset (so resolveAnchor can be tested). */
function installXpathPolyfill(doc: any) {
  if (typeof doc.evaluate === "function") return;
  const resolve = (expr: string, ctx: any): any => {
    let p = String(expr || "");
    if (p.startsWith("./")) p = p.slice(2);
    let node: any = ctx;
    const segs = p.split("/").filter(Boolean);
    for (const seg of segs) {
      if (!node) return null;
      const m = seg.match(/^(.+?)\[(\d+)\]$/);
      if (!m) return null;
      const name = m[1];
      const idx = parseInt(m[2], 10);
      if (name === "text()") {
        const texts = Array.from(node.childNodes).filter((x: any) => x.nodeType === 3);
        node = texts[idx - 1];
      } else {
        const els = Array.from(node.childNodes).filter(
          (x: any) => x.nodeType === 1 && x.tagName === name.toUpperCase()
        );
        node = els[idx - 1];
      }
      if (!node) return null;
    }
    return node;
  };
  doc.evaluate = (expr: string, ctx: any, _ns: any, _type: number, _res: any) => ({
    singleNodeValue: resolve(expr, ctx),
  });
}

export interface DomOptions {
  html?: string;
  url?: string;
}

/** Creates a fresh DOM and installs it on globalThis */
export function setupDom(opts: DomOptions = {}): any {
  const win = new Window({ url: opts.url || "https://example.test/article?utm_source=x&id=2" } as any) as any;
  const g: any = globalThis;
  g.window = win;
  g.document = win.document;
  g.navigator = win.navigator;
  g.MutationObserver = win.MutationObserver;
  g.Node = win.Node;
  g.Element = win.Element;
  g.HTMLElement = win.HTMLElement;
  g.Text = win.Text;
  g.Range = win.Range;
  g.Event = win.Event;
  g.MouseEvent = win.MouseEvent;
  g.KeyboardEvent = win.KeyboardEvent;
  g.StorageEvent = win.StorageEvent;
  g.localStorage = win.localStorage;
  g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 16);

  /* happy-dom returns a zero rect and keeps maybeShowToolbar closed;
     a logical rect for the UI tests: */
  const R: any = win.Range;
  if (R && R.prototype) {
    R.prototype.getBoundingClientRect = function () {
      return { width: 120, height: 24, top: 100, left: 100, right: 220, bottom: 124, x: 100, y: 100, toJSON: () => ({}) };
    };
  }

  installXpathPolyfill(win.document);

  try { win.localStorage.clear(); } catch { /* noop */ }
  if (opts.html) win.document.body.innerHTML = opts.html;
  return win;
}

/* ---------- chrome mock (real chrome.storage.local + chrome.tabs contract) ---------- */

/**
 * initial: seed data inside storage.local; tabs: queryable tabs
 * (the popup reads the active tab from here — default empty, as if tabs were absent).
 */
export function makeChromeMock(initial: Record<string, any> = {}, tabs: any[] = []): any {
  const data: Record<string, any> = { ...initial };
  const listeners: any[] = [];
  const chromeMock: any = {
    runtime: { lastError: null, id: "hlx-mock-extension", getManifest: () => ({ version: MANIFEST_VERSION }) },
    tabs: {
      query: (_q: any, cb: any) => { setTimeout(() => cb([...tabs]), 0); },
      sendMessage: (_tabId: any, _msg: any, cb: any) => { setTimeout(() => cb({ ok: true }), 0); },
      create: (_opts: any, cb: any) => { setTimeout(() => cb({ id: 99 }), 0); },
    },
    storage: {
      local: {} as any,
      onChanged: {
        addListener: (l: any) => listeners.push(l),
        removeListener: (l: any) => {
          const i = listeners.indexOf(l);
          if (i !== -1) listeners.splice(i, 1);
        },
      },
    },
  };
  const state: any = { failNextSet: false, failNextGet: false, data };

  function snapshot() { return { ...data }; }
  function fire(before: Record<string, any>, keys: string[]) {
    const changes: any = {};
    for (const k of keys) changes[k] = { oldValue: before[k], newValue: data[k] };
    listeners.slice().forEach((l) => { try { l(changes, "local"); } catch { /* noop */ } });
  }

  chromeMock.storage.local = {
    get: (key: any, cb: any) => {
      setTimeout(() => {
        if (state.failNextGet) {
          state.failNextGet = false;
          chromeMock.runtime.lastError = { message: "mock get error" };
          cb({});
          chromeMock.runtime.lastError = null;
          return;
        }
        const out: any = {};
        if (key === null || key === undefined) Object.assign(out, data);
        else if (key in data) out[key] = data[key];
        cb(out);
      }, 0);
    },
    set: (items: any, cb: any) => {
      setTimeout(() => {
        if (state.failNextSet) {
          state.failNextSet = false;
          chromeMock.runtime.lastError = { message: "mock quota exceeded" };
          cb();
          chromeMock.runtime.lastError = null;
          return;
        }
        const before = snapshot();
        Object.assign(data, items);
        cb();
        fire(before, Object.keys(items));
      }, 0);
    },
    remove: (keys: any, cb: any) => {
      setTimeout(() => {
        const before = snapshot();
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete data[k]);
        cb();
        const removed = Object.keys(before).filter((k) => !(k in data));
        fire(before, removed);
      }, 0);
    },
    getBytesInUse: (_keys: any, cb: any) => {
      setTimeout(() => cb(JSON.stringify(data).length), 0);
    },
  };
  chromeMock.__state = state;
  return chromeMock;
}

/* ---------- engine loading (classic modules on globalThis.HL) ---------- */

const DEFAULT_FILES = [
  "shared/constants.js",
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
  "shared/highlighter.js",
];

export interface EngineOptions {
  chrome?: any;
  files?: string[];
  extraFiles?: string[]; /* extra absolute paths outside the shared engine (e.g. content/favicon.js) */
}

/** Returns a fresh HL (previous chrome/HL is cleared before loading).
 *  Sync for classic + export-only worlds; returns a Promise ONLY when the
 *  file set contains an import-bearing module (await it — HL lands after). */
export function loadEngine(opts: EngineOptions = {}): any {
  const g: any = globalThis;
  delete g.HL;
  delete g.chrome;
  if (opts.chrome !== undefined) g.chrome = opts.chrome;
  const files = [...(opts.files ?? DEFAULT_FILES), ...(opts.extraFiles || [])];
  const load = (f: string, seq: number): void | Promise<void> => {
    const path = f.startsWith("/") || /^[A-Za-z]:/.test(f) ? f : ext(f);
    if (!RE_TOP_MODULE.test(readSrc(path))) return evalClassic(path);
    if (RE_TOP_IMPORT.test(readSrc(path))) return import(pathToFileURL(path).href + "?world=" + seq);
    return loadModuleSync(path);
  };
  const paths = files.map((f) => (f.startsWith("/") || /^[A-Za-z]:/.test(f) ? f : ext(f)));
  if (!paths.some((p) => RE_TOP_IMPORT.test(readSrc(p) || ""))) {
    const seq = ++worldSeq;
    for (const p of paths) load(p, seq);
    return g.HL;
  }
  const seq = ++worldSeq;
  return (async () => {
    for (const p of paths) await load(p, seq);
    return g.HL;
  })();
}
