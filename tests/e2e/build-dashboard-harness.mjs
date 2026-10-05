#!/usr/bin/env node
/**
 * Web Highlighter — dashboard E2E harness builder
 *
 * The extension dashboard depends on chrome.* and won't open in a regular
 * browser; this script builds a copy of the dashboard page with a full chrome
 * mock (storage.local + onChanged + runtime.getManifest) and sample data
 * injected before the shared scripts + window.open calls are recorded.
 *
 * Usage:   node tests/e2e/build-dashboard-harness.mjs
 * Input:   entrypoints/dashboard/index.html  (Phase 8 WXT entrypoint template —
 *          subdir index.html is WXT's convention; emitted as dashboard.html at root)
 * Output:  extension/dashboard/_e2e_harness.html  (byte-copied into .output by
 *          publicDir; load via chrome-extension://<id>/dashboard/_e2e_harness.html
 *          — file:// cannot load the module graph since Phase 7b)
 * ⚠️ Must be deleted before zip packaging (build-zip.mjs EXCLUDES it).
 *
 * The template's module entry (./main.tsx) is REPLACED by the byte-copied
 * controller entry (dashboard.js): the bundle filename is hashed/unstable,
 * while dashboard.js + its relative import graph ship verbatim in .output —
 * identical behavior, stable anchor.
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "entrypoints", "dashboard", "index.html");
const OUT = join(ROOT, "extension", "dashboard", "_e2e_harness.html");

/* version from the real manifest — the mock never hardcodes the version (single source) */
const MANIFEST_VERSION = JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf-8")).version;

const html = readFileSync(SRC, "utf-8");

const MOCK = `<script>
/* ==== E2E harness: chrome mock + sample data (generated — not part of the shipped package) ==== */
(function () {
  if (window.__hlxE2EMock) return;
  window.__hlxE2EMock = true;

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

  var DATA = {
    'hlx:settings': {
      defaultColor: 'teal', showToolbar: true, showBadge: true,
      disabledHosts: ['old.example.com']
    },
    'hlx:d:fa.wikipedia.org': {
      'w1': rec('w1', 'fa.wikipedia.org', 'https://fa.wikipedia.org/wiki/Persian', 'دانشنامه‌ی فارسی', 'مغز ما هنگام خواندن وارد گفت‌وگو با نویسنده می‌شود', 'yellow', 'ایده‌ی کلیدی: خواندن یعنی گفت‌وگو', t(1)),
      'w2': rec('w2', 'fa.wikipedia.org', 'https://fa.wikipedia.org/wiki/Persian', 'دانشنامه‌ی فارسی', 'یادداشت‌برداری فعال حافظه را تقویت می‌کند', 'green', '', t(2)),
      /* v1.2.12 E2E: an English highlight (quote + note) inside the RTL Persian card —
         the owner-reported case (per-text direction must not follow the card's direction) */
      'w3': rec('w3', 'fa.wikipedia.org', 'https://fa.wikipedia.org/wiki/Persian', 'دانشنامه‌ی فارسی', 'what was that? hah?', 'teal', 'what was that? hah?', t(6)),
      /* v0.6.1 E2E: a LONG Persian highlight (>200 chars → the card excerpts it with «…",
         the preview modal must show it in full) with a LONG note (>300 chars, same contract) */
      'w4': rec('w4', 'fa.wikipedia.org', 'https://fa.wikipedia.org/wiki/Persian', 'دانشنامه‌ی فارسی', 'خواندن فعال فرایندی است که در آن ذهن ما پیوسته با متن گفت‌وگو می‌کند: پیش‌بینی می‌سازد، پرسش می‌طرحد، و معنا را لایه‌به‌لایه می‌سازد. پژوهش‌ها نشان می‌دهند کسانی که هنگام مطالعه یادداشت‌برداری فعال دارند، مفاهیم را عمیق‌تر رمزگذاری می‌کنند و بخش بیشتری از آنچه خوانده‌اند را در بلندمدت به یاد می‌آورند؛ در حالی که خواندن منفعل — تنها عبور چشم از روی کلمات — اثری گذرا بر جای می‌گذارد و پس از چند روز بیشترِ آن محو می‌شود.', 'yellow', 'ایده‌ی کلیدی این بخش: خواندن فعال یعنی گفت‌وگو با متن. سه پرسش که باید هنگام خواندن از خود بپرسم: نویسنده چه ادعایی دارد؟ چه شواهدی برایش می‌آورد؟ و من با کدام بخش تجربه‌ی خودم می‌توانم آن را بسنجیم؟ این سه پرسش را در ابتدای هر فصل مرور می‌کنم.', t(8))
    },
    'hlx:d:developer.mozilla.org': {
      'm1': rec('m1', 'developer.mozilla.org', 'https://developer.mozilla.org/docs/Web/CSS/CSS_logical_properties', 'Using logical properties and logical values', 'Logical properties, like inline-start and block-end, flow relative to the writing mode of the document.', 'teal', 'Remember: inline-start flips with dir.', t(4)),
      'm2': rec('m2', 'developer.mozilla.org', 'https://developer.mozilla.org/docs/Web/CSS/CSS_logical_properties', 'Using logical properties and logical values', 'The dir attribute on an element sets its base direction for bidi text.', 'purple', '', t(5)),
      /* v1.2.13 E2E mirror case: an English highlight carrying a Persian note inside the
         LTR MDN card — the note ROW must flip RTL (icon at the row's start = right) while
         the quote stays LTR and the card frame stays LTR */
      'x1': rec('x1', 'developer.mozilla.org', 'https://developer.mozilla.org/docs/Web/CSS/CSS_logical_properties', 'Using logical properties and logical values', 'An English highlight with a Persian note attached to it.', 'pink', 'این یادداشت فارسی روی هایلایت انگلیسی نوشته شده', t(7)),
      /* v0.6.1 E2E: a LONG English highlight in the LTR card — the modal must render it
         LTR, fully, with the pinned X above the scrolling body */
      'm3': rec('m3', 'developer.mozilla.org', 'https://developer.mozilla.org/docs/Web/CSS/CSS_logical_properties', 'Using logical properties and logical values', 'CSS logical properties, unlike their physical counterparts, are writing-mode aware: inline-start and inline-end resolve against the writing mode and direction of the containing block, so the same stylesheet lays out correctly in left-to-right, right-to-left, and vertical writing systems alike. This is the mechanism the whole extension dashboard card system builds on: one set of rules, every direction, no per-direction overrides needed.', 'green', 'Same text, same direction, everywhere — the dashboard invariant in one sentence.', t(9))
    },
    'hlx:d:example.com': {
      'e1': rec('e1', 'example.com', 'https://example.com/article-one', 'مقاله‌ی نمونه', 'ذخیره‌سازی محلی بدون سرور', 'pink', 'کاملاً آفلاین', t(3))
    },
    /* Captured favicon for fa.wikipedia.org (like the v1.1.4 behavior: dataURL in hlx:f:<host>)
       — example.com deliberately has no favicon so the fallback path (letter E) is visible too */
    'hlx:f:fa.wikipedia.org': {
      host: 'fa.wikipedia.org',
      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAV0lEQVR4nO3VwQ0AIAhDUSdh/1HcSgcgKTURMVrj1f8uBFs3S71NgIB3gOHONsCnl5gAwHXGQABTD406gK9jQ8DPQPqYngBIAxeqlx1gyIfXfDgCBBQCE7JkqpxO/VKSAAAAAElFTkSuQmCC',
      capturedAt: t(3)
    },
    /* Article tags (v1.2.15): fa=Persian tags on the RTL card, example=one tag,
       MDN=one English tag on the LTR card — the toolbar filter row gets 4 chips.
       v0.6.1 E2E: MDN also carries a PERSIAN tag («طراحی») inside the LTR card —
       the owner-reported case: the chip (label + X placement) must stay RTL-arranged. */
    'hlx:tags': {
      'https://fa.wikipedia.org/wiki/Persian': ['دانشنامه', 'مطالعه'],
      'https://example.com/article-one': ['آزمایش'],
      'https://developer.mozilla.org/docs/Web/CSS/CSS_logical_properties': ['frontend', 'طراحی']
    }
  };

  var listeners = [];
  function fire(changes) {
    listeners.slice().forEach(function (l) { try { l(changes, 'local'); } catch (e) {} });
  }

  window.__openCalls = [];
  var realOpen = window.open ? window.open.bind(window) : null;

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
            fire(changes);
          }, 0);
        },
        remove: function (keys, cb) {
          setTimeout(function () {
            var changes = {};
            (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
              if (k in DATA) { changes[k] = { oldValue: DATA[k], newValue: undefined }; delete DATA[k]; }
            });
            cb();
            fire(changes);
          }, 0);
        },
        getBytesInUse: function (_k, cb) { setTimeout(function () { cb(JSON.stringify(DATA).length); }, 0); }
      },
      onChanged: {
        addListener: function (l) { listeners.push(l); },
        removeListener: function (l) { var i = listeners.indexOf(l); if (i !== -1) listeners.splice(i, 1); }
      }
    }
  };

  /* Opening real links must not open new tabs in E2E — record only */
  window.open = function (url, target) {
    window.__openCalls.push({ url: String(url), target: String(target) });
    return { focus: function () {} };
  };
  void realOpen;

  /* ==== v0.6.0 E2E instrumentation: capture every download + every print frame ====
     (harness-only — never shipped; the zip builder excludes this file) */
  window.__exports = [];      /* [{ filename, blob, text, done }] — set on anchor click */
  window.__printFrames = [];  /* [{ srcdoc }] — capture-phase load listener on print iframes */
  var __blobByUrl = Object.create(null);
  var __realCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (b) {
    var u = __realCreate(b);
    __blobByUrl[u] = b;
    return u;
  };
  URL.revokeObjectURL = function () { /* keep the map resolvable for late assertions */ };
  var __anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var blob = __blobByUrl[this.href];
    if (this.download && blob) {
      var entry = { filename: this.download, blob: blob, done: false };
      window.__exports.push(entry);
      blob.text().then(function (t) { entry.text = t; entry.done = true; })
        .catch(function () { entry.done = true; });
    }
    return __anchorClick.apply(this, arguments);
  };
  document.addEventListener('load', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IFRAME' && t.title === 'print-frame') {
      window.__printFrames.push({ srcdoc: t.srcdoc });
    }
  }, true);
})();
</script>`;

const TEMPLATE_ENTRY = '<script type="module" src="./main.tsx"></script>';
if (!html.includes(TEMPLATE_ENTRY)) {
  console.error("anchor script tag not found in entrypoints/dashboard/index.html");
  process.exit(1);
}

const out = html.replace(
  TEMPLATE_ENTRY,
  MOCK + '\n  <script type="module" src="dashboard.js"></script>'
);

writeFileSync(OUT, out);
console.log("harness written:", OUT);
console.log("open with: file://" + OUT);

/* --clean: remove the harness before packaging */
if (process.argv.includes("--clean")) {
  rmSync(OUT, { force: true });
  console.log("cleaned:", OUT);
}
