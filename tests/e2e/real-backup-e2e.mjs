#!/usr/bin/env node
/**
 * Web Highlighter — real E2E rig for the SELECTIVE backup (بک‌آپ انتخابی)
 *
 * The real user path, everything real (no mocks):
 *   1) real Chrome + the real built extension (.output/chrome-mv3, parity-gated)
 *   2) real storage injection through the service worker's chrome.storage
 *      (2 sites / 3 articles / tags / favicon)
 *   3) the real dashboard: the new topbar button «خروجی انتخابی» opens the
 *      BackupModal; the three pickers render the injected sites/articles/tags
 *   4) a real checkbox click on ONE site → the live count shows exactly that
 *      site's highlights (۲) and the download button arms
 *   5) a real click on «دریافت فایل بک‌آپ» → the REAL downloaded file is
 *      parsed: meta.partial, meta.selection, only the selected site's
 *      records, favicons/tags following the included records
 *   6) Escape closes the modal; zero-globals probe (noHLGlobal) inside the
 *      real page; zero uncaught exceptions during the whole run
 *
 * Usage: HLX_CHROME=... bun tests/e2e/real-backup-e2e.mjs
 */
import { spawn, execSync } from "node:child_process";
import { rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const EXT_DIR = process.env.HLX_EXT_DIR || join(ROOT, '.output', 'chrome-mv3');
if (!process.env.HLX_EXT_DIR) {
  execSync('bun run build:ext && bun run build:wxt', { cwd: ROOT, stdio: 'inherit' });
}
const CHROME = process.env.HLX_CHROME || '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const CDP_PORT = 9420 + Math.floor(Math.random() * 40); /* random port — zombies must not hold us hostage */
const PROFILE = '/tmp/hlx-backup-profile';
const DL_DIR = '/tmp/hlx-backup-dl';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[e2e-backup]', ...a);
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
      const ours = await evalIn(sessionId, 'globalThis.__HLX_APP === "web-highlighter"');
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
  'hlx:f:zoomit.ir': { icon: 'data:image/png;base64,iVBORw0KGgo=', capturedAt: 1700000000000 },
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
  dashReady = (await evalIn(D, '!!document.querySelector("#btn-export")', false)) === true;
  if (!dashReady) await sleep(400);
}
if (!dashReady) { fail('dashboard never rendered'); chrome.kill(); process.exit(1); }

/* stats strip renders from REAL storage → the data layer read the injection */
const stats = await evalIn(D, 'document.querySelector("#st-total")?.textContent');
log('stats total rendered:', stats);

/* ---------- probes ---------- */
const probes = {};
probes.extensionLoaded = !!extId;
probes.noHLGlobal = (await evalIn(D, 'typeof globalThis.HL === "undefined" && typeof globalThis.__HLX_APP === "undefined"')) === true;

/* 1) the new topbar button exists */
probes.topbarButton = (await evalIn(D, '!!document.querySelector("#btn-backup-select")')) === true;

/* 2) click → the modal opens with the three pickers fed from real storage */
await evalIn(D, 'document.querySelector("#btn-backup-select").click()');
await sleep(300);
const modalState = await evalIn(D, `(() => {
  const m = document.querySelector("#backup-modal");
  if (!m || m.hidden) return { open: false };
  const lists = [...m.querySelectorAll(".sel-list")];
  return {
    open: true,
    lists: lists.length,
    sites: [...(lists[0]?.querySelectorAll(".sel-item") || [])].map((r) => r.textContent),
    articles: lists[1]?.querySelectorAll(".sel-item").length,
    tags: lists[2]?.querySelectorAll(".sel-item").length,
    goDisabled: m.querySelector("#backup-go")?.disabled,
  };
})()`);
probes.modalOpens = modalState.open === true;
probes.pickersFedFromRealStorage = modalState.lists === 3 &&
  modalState.sites?.length === 2 &&
  modalState.sites?.some((s) => s.includes('zoomit.ir')) &&
  modalState.articles === 3 && modalState.tags === 2 &&
  modalState.goDisabled === true; /* nothing selected yet */

/* 3) check the zoomit.ir SITE row → live count = ۲, button arms */
await evalIn(D, `(() => {
  const row = [...document.querySelectorAll("#backup-modal .sel-list")[0].querySelectorAll(".sel-item")]
    .find((r) => r.textContent.includes("zoomit.ir"));
  row.querySelector("input").click();
})()`);
await sleep(200);
const armed = await evalIn(D, `(() => {
  const m = document.querySelector("#backup-modal");
  return {
    status: m.querySelector("#backup-status")?.textContent || '',
    goDisabled: m.querySelector("#backup-go")?.disabled,
  };
})()`);
probes.liveCountAndArm = armed.goDisabled === false && armed.status.includes('۲');
await shot(D, 'real-backup-modal.png'); /* visual evidence: the open picker with the armed count */

/* 4) real download of the REAL selective file */
await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });
await evalIn(D, 'document.querySelector("#backup-go").click()');
let backupFile = null;
for (let i = 0; i < 40 && !backupFile; i++) {
  await sleep(500);
  try {
    const names = readdirSync(DL_DIR).filter((n) => n.endsWith('.json'));
    if (names.length) backupFile = join(DL_DIR, names[0]);
  } catch (e) { /* dir not there yet */ }
}
let fileShape = null;
if (backupFile) {
  const parsed = JSON.parse(readFileSync(backupFile, 'utf-8'));
  fileShape = {
    name: backupFile.split('/').pop(),
    app: parsed.app, format: parsed.format,
    partial: parsed.meta?.partial,
    selection: parsed.meta?.selection,
    count: parsed.meta?.count,
    ids: Object.keys(parsed.highlights || {}).sort(),
    faviconHosts: Object.keys(parsed.favicons || {}),
    tagKeys: Object.keys(parsed.tags || {}),
    settingsPresent: !!parsed.settings,
  };
}
probes.partialFileDownloaded = !!fileShape &&
  /^web-highlighter-backup-partial-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(fileShape.name || '');
probes.partialFileContent = !!fileShape &&
  fileShape.app === 'web-highlighter' && fileShape.format === 1 &&
  fileShape.partial === true &&
  fileShape.count === 2 &&
  JSON.stringify(fileShape.ids) === '["r1","r2"]' &&
  JSON.stringify(fileShape.faviconHosts) === '["zoomit.ir"]' &&
  JSON.stringify(fileShape.tagKeys) === '["https://zoomit.ir/a"]' &&
  JSON.stringify(fileShape.selection) === '{"hosts":["zoomit.ir"],"articles":[],"tags":[]}' &&
  fileShape.settingsPresent === true;

/* the modal closes after a successful export (onExport().then(onClose)) */
await sleep(400);
probes.modalClosesAfterExport = (await evalIn(D, 'document.querySelector("#backup-modal")?.hidden')) === true;

/* 5) reopen → fresh empty selection; Escape closes */
await evalIn(D, 'document.querySelector("#btn-backup-select").click()');
await sleep(200);
const reopened = await evalIn(D, 'document.querySelector("#backup-modal .sel-list input")?.checked');
await evalIn(D, 'document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
await sleep(200);
probes.freshSelectionPerOpen = reopened === false &&
  (await evalIn(D, 'document.querySelector("#backup-modal")?.hidden')) === true;

/* 6) the FULL backup button is still in place (feature is additive) */
probes.fullBackupStillThere = (await evalIn(D, '!!document.querySelector("#btn-export")')) === true;

const summary = { ...probes, modalState, armed, fileShape, exceptions };
writeFileSync(join(HERE, 'real-backup-report.json'), JSON.stringify(summary, null, 2));
log('SUMMARY:', JSON.stringify(summary, null, 2));

const missingProbes = Object.entries(probes).filter(([, ok]) => !ok).map(([k]) => k);
if (exceptions.length) missingProbes.push('(uncaught exceptions: ' + exceptions.length + ')');
chrome.kill();
if (missingProbes.length) { fail('required probes failed:', missingProbes.join(', ')); process.exit(1); }
log('ALL PROBES PASS');
process.exit(0);
