#!/usr/bin/env node
/**
 * Weboo — real E2E rig for the BOOKLET upgrades (Task 88):
 * the article picker, the clickable TOC and the print font choice.
 *
 * The real user path, everything real (no mocks):
 *   1) real Chrome + the real built extension (.output/chrome-mv3, parity-gated)
 *   2) real storage injection through the service worker's chrome.storage
 *      (2 sites / 3 articles / tags)
 *   3) the real dashboard: the «کتابچه» topbar button opens the BookletModal;
 *      the article picker renders the 3 injected articles, the font radios
 *      render the 4 registry options with وزیرمتن checked, and the status
 *      line states the default-all rule («همه‌ی مقاله‌ها»)
 *   4) a real click on «ساخت کتابچه» with NOTHING selected → the REAL
 *      downloaded HTML is parsed: a TOC of 3 internal anchors (href="#art-N"
 *      ↔ id="art-N", link before target) and the default font (no font class)
 *   5) reopen → fresh picker; select ONE article (مقاله زومیت الف) + the
 *      تاهوما font → the live count shows that article's ۱ هایلایت; Escape
 *      closes
 *   6) a FRESH dashboard tab (Chrome allows one automatic download per page)
 *      exports the selection for real: the downloaded file carries body
 *      class "mode-color font-tahoma", exactly one article and no TOC (the
 *      over-application guard); the modal closes after each export
 *   7) zero-globals probe (noHLGlobal) inside the real page; zero uncaught
 *      exceptions during the whole run
 *
 * Usage: HLX_CHROME=... bun tests/e2e/real-booklet-e2e.mjs
 */
import { spawn, execSync } from "node:child_process";
import { rmSync, writeFileSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const EXT_DIR = process.env.HLX_EXT_DIR || join(ROOT, '.output', 'chrome-mv3');
if (!process.env.HLX_EXT_DIR) {
  execSync('bun run build:ext && bun run build:wxt', { cwd: ROOT, stdio: 'inherit' });
}
const CHROME = process.env.HLX_CHROME || '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const CDP_PORT = 9460 + Math.floor(Math.random() * 40); /* random port — zombies must not hold us hostage */
const PROFILE = '/tmp/hlx-booklet-profile';
const DL_DIR = '/tmp/hlx-booklet-dl';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[e2e-booklet]', ...a);
const fail = (...a) => console.log('[FAIL]', ...a);

/* ---------- real Chrome + real extension ---------- */
const args = [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`,
  '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', '--window-size=1280,900', 'about:blank',
];
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
try { rmSync(DL_DIR, { recursive: true, force: true }); } catch {}

const chrome = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => { /* noise */ });

let wsInfo;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) { wsInfo = await r.json(); break; } } catch {}
}
if (!wsInfo) { fail('CDP never came up'); chrome.kill(); process.exit(1); }
log('chrome up:', wsInfo.Browser);

/* ---------- raw CDP client (same shape as the other rigs) ---------- */
class CDP {
  constructor(ws) { this.ws = ws; this.nextId = 1; this.pending = new Map(); this.listeners = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); setTimeout(() => rej(new Error('ws timeout')), 5000); });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) { const { res, rej } = c.pending.get(msg.id); c.pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
      else if (msg.method) for (const fn of c.listeners) fn(msg);
    };
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    const p = new Promise((res, rej) => { this.pending.set(id, { res, rej }); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(method + ' timeout')); } }, 20000); });
    this.ws.send(JSON.stringify(msg));
    return p;
  }
  on(fn) { this.listeners.push(fn); }
}
const browser = await CDP.connect(wsInfo.webSocketDebuggerUrl);

/* uncaught exceptions + console errors across the whole run (the dashboard
   smoke's zero-exceptions contract) */
const exceptions = [];
browser.on((msg) => {
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'exception');
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    exceptions.push('console.error: ' + (msg.params.args || []).map((a) => a.value || a.description || '').join(' '));
  }
});

async function evalIn(sessionId, expression, awaitPromise = true) {
  const r = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') };
  return r.result.value;
}

/** A REAL (trusted) mouse click at an element's center: element.click() via
 *  Runtime.evaluate carries no user gesture, and Chrome silently blocks a
 *  page's SECOND gesture-less download (the multiple-automatic-downloads
 *  rule — no file, no exception). A dispatched input event IS a gesture. */
async function realClick(sessionId, selector) {
  const box = await evalIn(sessionId, `(() => {
    const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId);
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId);
}

/** screenshot with retry (the composer is sometimes not ready on the first try) */
async function shot(sessionId, file) {
  for (let i = 0; i < 3; i++) {
    try {
      const s = await Promise.race([
        browser.send('Page.captureScreenshot', { format: 'png' }, sessionId),
        new Promise((_, rej) => setTimeout(() => rej(new Error('capture timeout')), 8000)),
      ]);
      writeFileSync(join(HERE, file), Buffer.from(s.data, 'base64'));
      return true;
    } catch (e) { log('screenshot retry', file, String(e && e.message || e)); await sleep(1500); }
  }
  return false;
}

/* ---------- find the extension ID (the __HLX_APP sentinel, per rig contract) ---------- */
let extId = null;
let swSession = null;
for (let i = 0; i < 40 && !extId; i++) {
  const { targetInfos } = await browser.send('Target.getTargets');
  const cands = targetInfos.filter((t) => t.url.startsWith('chrome-extension://') &&
    (t.url.includes('background/service-worker.js') || t.url.endsWith('/background.js')));
  for (const c of cands) {
    try {
      const { sessionId } = await browser.send('Target.attachToTarget', { targetId: c.targetId, flatten: true });
      const ours = await evalIn(sessionId, 'globalThis.__HLX_APP === "weboo"');
      if (ours === true) { extId = c.url.split('/')[2]; swSession = sessionId; break; }
    } catch (e) { /* foreign extension — ignore */ }
  }
  if (!extId) await sleep(600);
}
if (!extId) { fail('extension did not load'); chrome.kill(); process.exit(1); }
log('extension loaded, id =', extId);

/* ---------- real storage injection THROUGH the service worker ---------- */
const rec = (id, host, url, title, text, extra = {}) => ({
  id, host, site: 'https://' + host, url, urlNorm: url,
  title, text, prefix: '', suffix: '', color: 'yellow', note: '',
  createdAt: 1700000000000, updatedAt: 1700000000000, ...extra,
});
const seed = {
  'hlx:d:zoomit.ir': {
    r1: rec('r1', 'zoomit.ir', 'https://zoomit.ir/a', 'مقاله زومیت الف', 'متن اول زومیت', { note: 'یادداشت' }),
    r2: rec('r2', 'zoomit.ir', 'https://zoomit.ir/b', 'مقاله زومیت ب', 'متن دوم زومیت'),
  },
  'hlx:d:en.wikipedia.org': {
    r3: rec('r3', 'en.wikipedia.org', 'https://en.wikipedia.org/wiki/Book', 'Book - Wikipedia', 'A book is a medium for recording information.'),
  },
  'hlx:tags': { 'https://zoomit.ir/a': ['فناوری'], 'https://en.wikipedia.org/wiki/Book': ['علم'] },
  'hlx:schemaVersion': 1,
};
const injected = await evalIn(swSession,
  'chrome.storage.local.set(' + JSON.stringify(seed) + ').then(() => true)');
if (injected !== true) { fail('storage injection failed', JSON.stringify(injected)); chrome.kill(); process.exit(1); }
log('storage injected');

/* ---------- the real dashboard tab ---------- */
const DASH_URL = `chrome-extension://${extId}/dashboard.html`;
const { targetId: dashT } = await browser.send('Target.createTarget', { url: DASH_URL });
const dash = await browser.send('Target.attachToTarget', { targetId: dashT, flatten: true });
const D = dash.sessionId;
await browser.send('Page.enable', {}, D);
await browser.send('Runtime.enable', {}, D);

/* wait for the React render: the topbar actions are a React region */
let dashReady = false;
for (let i = 0; i < 30 && !dashReady; i++) {
  dashReady = (await evalIn(D, '!!document.querySelector("#btn-booklet")', false)) === true;
  if (!dashReady) await sleep(400);
}
if (!dashReady) { fail('dashboard never rendered'); chrome.kill(); process.exit(1); }

/* ---------- probes ---------- */
const probes = {};
probes.extensionLoaded = !!extId;
probes.noHLGlobal = (await evalIn(D, 'typeof globalThis.HL === "undefined" && typeof globalThis.__HLX_APP === "undefined"')) === true;

/* 1) the booklet topbar button opens the modal; the picker + font radios are
      fed from REAL storage and the status states the default-all rule */
await evalIn(D, 'document.querySelector("#btn-booklet").click()');
await sleep(400);
const modalState = await evalIn(D, `(() => {
  const m = document.querySelector("#booklet-modal");
  if (!m || m.hidden) return { open: false };
  const rows = [...(m.querySelector(".sel-list")?.querySelectorAll(".sel-item") || [])].map((r) => r.textContent);
  const fonts = [...m.querySelectorAll('input[name="bk-font"]')].map((r) => r.value);
  return {
    open: true,
    rows,
    status: m.querySelector("#booklet-status")?.textContent || '',
    fonts,
    vazirChecked: m.querySelector('input[name="bk-font"][value="vazir"]')?.checked,
    goDisabled: m.querySelector("#bk-go")?.disabled,
  };
})()`);
probes.modalOpens = modalState.open === true;
probes.pickerFedFromRealStorage = modalState.rows?.length === 3 &&
  modalState.rows.some((r) => r.includes('زومیت الف')) &&
  modalState.rows.some((r) => r.includes('Book - Wikipedia'));
/* v0.9.0+: the picker is vazir (the preset) + the custom local-font row —
   the tahoma/segoe/system suggestions are gone by design */
probes.fontRadiosDefaultVazir = modalState.fonts?.length === 2 &&
  modalState.fonts.includes('vazir') && modalState.fonts.includes('custom') &&
  modalState.vazirChecked === true;
probes.defaultAllStatus = (modalState.status || '').includes('همه‌ی مقاله‌ها') &&
  modalState.goDisabled === false; /* default-all arms the button with no selection */
await shot(D, 'real-booklet-modal.png'); /* visual evidence: the open picker + font radios */

/* 2) real download #1 — NOTHING selected (all articles), default font */
const listBookletFiles = () => {
  try { return readdirSync(DL_DIR).filter((n) => /^weboo-booklet-.*\.html$/.test(n)); }
  catch (e) { return []; }
};
await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });
await evalIn(D, 'document.querySelector("#bk-go").click()');
let file1 = null;
for (let i = 0; i < 40 && !file1; i++) {
  await sleep(500);
  const names = listBookletFiles();
  if (names.length) file1 = names[0];
}
let doc1 = file1 ? readFileSync(join(DL_DIR, file1), 'utf-8') : null;
probes.fullFileDownloaded = !!doc1 && doc1.startsWith('<!DOCTYPE html>');
probes.tocAnchorsWork = !!doc1 && [1, 2, 3].every((n) => {
  const link = doc1.indexOf(`<a class="toc-row" href="#art-${n}">`);
  const target = doc1.indexOf(`<section class="article" id="art-${n}"`);
  return link > -1 && target > link;
}) && doc1.indexOf('id="art-1"') < doc1.indexOf('id="art-2"') &&
     doc1.indexOf('id="art-2"') < doc1.indexOf('id="art-3"');
probes.threeArticlesInFile = !!doc1 && (doc1.match(/<section class="article" id="art-\d+"/g) || []).length === 3;
probes.defaultFontNoClass = !!doc1 &&
  (doc1.match(/<body[^>]*>/) || [''])[0] === '<body class="mode-color">';
if (file1) {
  /* free the stamp name — a same-minute second export would OVERWRITE it
     (CDP download behavior renames nothing), and the second file is tracked
     by set difference */
  renameSync(join(DL_DIR, file1), join(DL_DIR, 'first-booklet.html'));
}

/* the modal closes after a successful export (onBooklet().then(onClose)) */
await sleep(400);
probes.modalClosesAfterExport = (await evalIn(D, 'document.querySelector("#booklet-modal")?.hidden')) === true;

/* 3) reopen → fresh picker; select ONE article + تاهوما → live count arms;
      Escape closes (no download here — see phase 4) */
await evalIn(D, 'document.querySelector("#btn-booklet").click()');
await sleep(400);
probes.freshPickerPerOpen = (await evalIn(D,
  'document.querySelector("#booklet-modal .sel-list input")?.checked')) === false;
await evalIn(D, `(() => {
  const row = [...document.querySelectorAll("#booklet-modal .sel-list .sel-item")]
    .find((r) => r.textContent.includes("زومیت الف"));
  row.querySelector("input").click();
})()`);
/* pick the custom local-font row and type a name — the React-controlled
   input needs the native value setter so onChange really fires */
await evalIn(D, 'document.querySelector(\'#booklet-modal input[name="bk-font"][value="custom"]\').click()');
await evalIn(D, `(() => {
  const input = document.querySelector("#bk-custom-font");
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  set.call(input, "B Nazanin");
  input.dispatchEvent(new Event("input", { bubbles: true }));
})()`);
await sleep(200);
const armed = await evalIn(D, `(() => {
  const m = document.querySelector("#booklet-modal");
  return {
    status: m.querySelector("#booklet-status")?.textContent || '',
    vazirChecked: m.querySelector('input[name="bk-font"][value="vazir"]')?.checked,
    customChecked: m.querySelector('input[name="bk-font"][value="custom"]')?.checked,
    goArmed: m.querySelector("#bk-go")?.disabled === false,
  };
})()`);
probes.liveCountOnSelection = (armed.status || '').includes('۱') && armed.customChecked === true &&
  armed.vazirChecked === false && armed.goArmed === true;
await evalIn(D, 'document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
await sleep(200);
probes.escapeCloses = (await evalIn(D, 'document.querySelector("#booklet-modal")?.hidden')) === true;

/* 4) real download #2 — one article + تاهوما, on a FRESH dashboard tab:
      Chrome allows ONE automatic download per page without a user gesture
      (the silent block, no exception), so the second export re-arms the
      allowance with a new page. A same-minute second export gets Chrome's
      " (1)" suffix — files are tracked by set difference. */
const { targetId: dashT2 } = await browser.send('Target.createTarget', { url: DASH_URL });
const dash2 = await browser.send('Target.attachToTarget', { targetId: dashT2, flatten: true });
const D2 = dash2.sessionId;
await browser.send('Page.enable', {}, D2);
await browser.send('Runtime.enable', {}, D2);
let dash2Ready = false;
for (let i = 0; i < 30 && !dash2Ready; i++) {
  dash2Ready = (await evalIn(D2, '!!document.querySelector("#btn-booklet")', false)) === true;
  if (!dash2Ready) await sleep(400);
}
if (!dash2Ready) { fail('second dashboard never rendered'); chrome.kill(); process.exit(1); }
await evalIn(D2, 'document.querySelector("#btn-booklet").click()');
await sleep(400);
await evalIn(D2, `(() => {
  const row = [...document.querySelectorAll("#booklet-modal .sel-list .sel-item")]
    .find((r) => r.textContent.includes("زومیت الف"));
  row.querySelector("input").click();
})()`);
await evalIn(D2, 'document.querySelector(\'#booklet-modal input[name="bk-font"][value="custom"]\').click()');
await evalIn(D2, `(() => {
  const input = document.querySelector("#bk-custom-font");
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  set.call(input, "B Nazanin");
  input.dispatchEvent(new Event("input", { bubbles: true }));
})()`);
await sleep(200);
const before2 = new Set(listBookletFiles());
await realClick(D2, "#bk-go");
let file2 = null;
for (let i = 0; i < 40 && !file2; i++) {
  await sleep(500);
  const fresh = listBookletFiles().filter((n) => !before2.has(n));
  if (fresh.length) file2 = fresh[0];
}
let doc2 = file2 ? readFileSync(join(DL_DIR, file2), 'utf-8') : null;
probes.selectedFileDownloaded = !!doc2 && doc2.startsWith('<!DOCTYPE html>');
probes.fontClassApplied = !!doc2 && doc2.includes('<body class="mode-color font-custom">') &&
  doc2.includes('body.font-custom { --bk-font: "B Nazanin"');
probes.selectionFiltered = !!doc2 &&
  (doc2.match(/<section class="article" id="art-\d+"/g) || []).length === 1 &&
  doc2.includes('مقاله زومیت الف') &&
  !doc2.includes('مقاله زومیت ب') && !doc2.includes('Book - Wikipedia');
probes.tocGuardForSingleArticle = !!doc2 && !doc2.includes('class="toc-row"') && !doc2.includes('href="#art-');

/* the modal closes after the second export; the Markdown button is untouched */
await sleep(400);
probes.modalClosesAfterExport2 = (await evalIn(D2, 'document.querySelector("#booklet-modal")?.hidden')) === true;
probes.markdownStillThere = (await evalIn(D2, '!!document.querySelector("#md-go")')) === true;

const summary = { ...probes, modalState, armed, file1, file2, doc1Body: doc1?.match(/<body[^>]*>/)?.[0], doc2Body: doc2?.match(/<body[^>]*>/)?.[0], exceptions };
writeFileSync(join(HERE, 'real-booklet-report.json'), JSON.stringify(summary, null, 2));
log('SUMMARY:', JSON.stringify(summary, null, 2));

const missingProbes = Object.entries(probes).filter(([, ok]) => !ok).map(([k]) => k);
if (exceptions.length) missingProbes.push('(uncaught exceptions: ' + exceptions.length + ')');
chrome.kill();
if (missingProbes.length) { fail('required probes failed:', missingProbes.join(', ')); process.exit(1); }
log('ALL PROBES PASS');
process.exit(0);
