#!/usr/bin/env node
/**
 * Web Highlighter — popup E2E harness builder
 *
 * The extension popup depends on chrome.tabs/runtime and storage and won't
 * open in a regular browser; this script builds a copy of popup.html with a
 * chrome mock (tabs + runtime + storage) and sample data injected before the
 * shared scripts.
 * Modes (v1.2.7 + precise scoping v1.2.8 — smart-direction page card):
 *  - default: Persian article (fa.wikipedia.org) — RTL card as always.
 *  - ?page=en: English MDN article — page card dir=ltr and list items dir=ltr;
 *    the Persian list-section header («هایلایت‌های این صفحه» + counter) stays RTL.
 * The mock reads the version from the real manifest.json (single source —
 * rooted like engine.ts so a version bump cannot break it).
 *
 * Usage:   node tests/e2e/build-popup-harness.mjs
 * Output:  extension/popup/_e2e_harness.html  (open with file://)
 * ⚠️ Must be deleted before zip packaging.
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "extension", "popup", "popup.html");
const OUT = join(ROOT, "extension", "popup", "_e2e_harness.html");

/* version from the real manifest — the mock never hardcodes the version (single source) */
const MANIFEST_VERSION = JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf-8")).version;

const html = readFileSync(SRC, "utf-8");

const MOCK = `<script>
/* ==== E2E popup harness: chrome mock + fake active tab (generated — not part of the shipped package) ====
   Default: Persian article; ?page=en: English MDN article (smart card v1.2.7/v1.2.8). */
(function () {
  if (window.__hlxE2EMock) return;
  window.__hlxE2EMock = true;

  var EN = /[?&]page=en(=|&|$)/.test(location.search);

  var t = function (n) { return 1700000000000 + n * 1000; };
  var rec = function (id, host, url, title, text, color, note, ts) {
    return {
      id: id, host: host, site: 'https://' + host, url: url, urlNorm: url,
      title: title, text: text, prefix: 'پیش ', suffix: ' پس',
      start: 10, end: 20,
      anchor: { start: 'p[1]', startOffset: 0, end: 'p[1]', endOffset: 4 },
      color: color, note: note || '',
      createdAt: ts, updatedAt: ts
    };
  };

  /* Seed memory — served through chrome.storage.local so the real
     chrome-storage.js backend reads it; EN → English MDN article (dir=ltr card) */
  var HOST = EN ? 'developer.mozilla.org' : 'fa.wikipedia.org';
  var PAGE_URL = EN
    ? 'https://developer.mozilla.org/docs/Web/CSS/CSS_logical_properties'
    : 'https://fa.wikipedia.org/wiki/Persian';
  var PAGE_TITLE = EN
    ? 'Using logical properties and logical values - CSS | MDN'
    : 'دانشنامه‌ی فارسی — ویکی‌پدیا';

  var DATA = EN ? {
    'hlx:settings': {
      defaultColor: 'teal', showToolbar: true, showBadge: true,
      disabledHosts: []
    },
    'hlx:d:developer.mozilla.org': {
      'm1': rec('m1', 'developer.mozilla.org', PAGE_URL, PAGE_TITLE, 'Logical properties, like inline-start and block-end, flow relative to the writing mode of the document.', 'teal', 'Remember: inline-start flips with dir.', t(1)),
      'm2': rec('m2', 'developer.mozilla.org', PAGE_URL, PAGE_TITLE, 'The dir attribute on an element sets its base direction for bidi text.', 'green', '', t(2)),
      'm3': rec('m3', 'developer.mozilla.org', PAGE_URL, PAGE_TITLE, 'Directional and logical properties make layout writing-mode agnostic.', 'pink', '', t(3))
    }
    /* EN deliberately has no favicon → the fallback letter D is visible inside the LTR card */
  } : {
    'hlx:settings': {
      defaultColor: 'teal', showToolbar: true, showBadge: true,
      disabledHosts: []
    },
    'hlx:d:fa.wikipedia.org': {
      'w1': rec('w1', 'fa.wikipedia.org', PAGE_URL, PAGE_TITLE, 'مغز ما هنگام خواندن وارد گفت‌وگو با نویسنده می‌شود', 'yellow', 'ایده‌ی کلیدی', t(1)),
      'w2': rec('w2', 'fa.wikipedia.org', PAGE_URL, PAGE_TITLE, 'یادداشت‌برداری فعال حافظه را تقویت می‌کند', 'green', '', t(2)),
      'w3': rec('w3', 'fa.wikipedia.org', PAGE_URL, PAGE_TITLE, 'ذخیره‌سازی محلی بدون سرور', 'pink', '', t(3))
    },
    /* Captured favicon (v1.1.4): dataURL in hlx:f:<host> — the popup shows it next to the title */
    'hlx:f:fa.wikipedia.org': {
      host: 'fa.wikipedia.org',
      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAV0lEQVR4nO3VwQ0AIAhDUSdh/1HcSgcgKTURMVrj1f8uBFs3S71NgIB3gOHONsCnl5gAwHXGQABTD406gK9jQ8DPQPqYngBIAxeqlx1gyIfXfDgCBBQCE7JkqpxO/VKSAAAAAElFTkSuQmCC',
      capturedAt: t(3)
    }
  };
  var storageListeners = [];
  function fireStorage(changes) {
    storageListeners.slice().forEach(function (l) { try { l(changes, 'local'); } catch (e) {} });
  }

  /* Opening real links/tabs must not happen in E2E — record only */
  window.__openCalls = [];
  window.__createdTabs = [];
  window.open = function (url, target) {
    window.__openCalls.push({ url: String(url), target: String(target) });
    return { focus: function () {} };
  };

  window.chrome = {
    runtime: {
      lastError: null,
      id: 'hlx-e2e',
      getManifest: function () { return { version: "${MANIFEST_VERSION}" }; },
      getURL: function (p) { return p; }
    },
    storage: {
      local: {
        get: function (key, cb) {
          setTimeout(function () {
            var o = {};
            if (key === null || key === undefined) Object.assign(o, DATA);
            else if (key in DATA) o[key] = DATA[key];
            cb(o);
          }, 0);
        },
        set: function (items, cb) {
          setTimeout(function () {
            var changes = {};
            Object.keys(items || {}).forEach(function (k) {
              changes[k] = { oldValue: DATA[k], newValue: items[k] };
              DATA[k] = items[k];
            });
            cb();
            fireStorage(changes);
          }, 0);
        },
        remove: function (keys, cb) {
          setTimeout(function () {
            (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { delete DATA[k]; });
            cb();
          }, 0);
        },
        getBytesInUse: function (_k, cb) { setTimeout(function () { cb(JSON.stringify(DATA).length); }, 0); }
      },
      onChanged: {
        addListener: function (l) { storageListeners.push(l); },
        removeListener: function (l) { var i = storageListeners.indexOf(l); if (i !== -1) storageListeners.splice(i, 1); }
      }
    },
    tabs: {
      query: function (_q, cb) {
        setTimeout(function () {
          cb([{
            id: EN ? 8 : 7,
            url: EN ? PAGE_URL : PAGE_URL + '?utm_source=x#section',
            title: PAGE_TITLE
          }]);
        }, 0);
      },
      sendMessage: function (tabId, msg, cb) {
        setTimeout(function () { cb({ ok: true }); }, 0);
      },
      create: function (opts, cb) {
        window.__createdTabs.push(opts);
        setTimeout(function () { cb({ id: 99 }); }, 0);
      }
    }
  };
})();
</script>`;

if (!html.includes('<script type="module" src="popup.js"></script>')) {
  console.error("anchor script tag not found in popup.html");
  process.exit(1);
}

const out = html.replace(
  '<script type="module" src="popup.js"></script>',
  MOCK + '\n<script type="module" src="popup.js"></script>'
);

writeFileSync(OUT, out);
console.log("harness written:", OUT);
console.log("open with: file://" + OUT + "  (or  file://" + OUT + "?page=en  for the LTR English card)");

/* --clean: remove the harness before packaging */
if (process.argv.includes("--clean")) {
  rmSync(OUT, { force: true });
  console.log("cleaned:", OUT);
}
