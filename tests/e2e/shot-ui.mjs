#!/usr/bin/env node
/**
 * shot-ui — full-surface screenshot rig for design work (untracked, rig-style).
 * Loads the real built extension in headless Brave, seeds a realistic Persian
 * library, and captures every UI surface:
 *   dashboard (light/dark, desktop/mobile, drawer, both selection modals),
 *   popup (light/dark), and the in-page widgets (toolbar + popover, light).
 * Usage: HLX_CHROME=... bun tests/e2e/shot-ui.mjs [--prefix=before]
 */
import { spawn, execSync } from "node:child_process";
import { rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const EXT_DIR = process.env.HLX_EXT_DIR || join(ROOT, '.output', 'chrome-mv3');
if (!process.env.HLX_EXT_DIR) {
  execSync('bun run build:ext && bun run build:wxt', { cwd: ROOT, stdio: 'inherit' });
}
const CHROME = process.env.HLX_CHROME || '/opt/brave.com/brave/brave';
const PREFIX = (process.argv.find(a => a.startsWith('--prefix=')) || '--prefix=shot').slice(9);
const OUT = join(HERE, 'shots-' + PREFIX);
mkdirSync(OUT, { recursive: true });
const CDP_PORT = 9520 + Math.floor(Math.random() * 40);
const PROFILE = '/tmp/hlx-shot-profile';
const SITE_PORT = 8790 + Math.floor(Math.random() * 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[shot-ui]', ...a);
const fail = (...a) => console.log('[FAIL]', ...a);

/* ---------- the local article page (Persian RTL + an English block) ---------- */
const ARTICLE = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<title>حاشیه‌نویسی در خوانش</title><style>
body{font-family:Vazirmatn,Tahoma,sans-serif;max-width:680px;margin:40px auto;line-height:2;padding:0 20px;color:#1f2937}
h1{font-size:26px} .en{direction:ltr;text-align:left;font-family:Georgia,serif;color:#374151}
</style></head><body>
<h1>حاشیه‌نویسی؛ هنرِ گفت‌وگو با متن</h1>
<p>خواندنِ عمیق بدون گفت‌وگو با متن ممکن نیست. خوانندگانِ حرفه‌ای سال‌هاست که با کشیدن خط زیر جمله‌ها، کنارشان یادداشت نوشتن و علامت‌گذاریِ بخش‌های مهم، کتاب‌ها را به گفت‌وگویی ماندگار تبدیل می‌کنند. این سنت در دنیای وب گم شده است؛ ما می‌خوانیم و فراموش می‌کنیم.</p>
<p>مرورگرها ابزار خوبی برای بازخوانی‌اند، اما چیزی برای یادسپاری ندارند. بوکمارک نشانی صفحه را نگه می‌دارد، نه آن جمله‌ای که ذهن ما را قفل کرد. حاشیه‌نویسی دیجیتال یعنی بازگرداندن همین قلم به وب.</p>
<p class="en">Marginalia is the oldest memory technology of reading. From medieval scribes to the scientists who annotated their books in pencil, the conversation between reader and text has always lived in the margins — never in a separate notebook that never gets opened again.</p>
<p>ابزارهای ابری راه‌حل‌های خودشان را دارند: حساب کاربری، سرور، اشتراک ماهانه. اما یادداشتِ خواندن، مالکیتِ شخصی دارد؛ باید روی دستگاه خودت بماند، نه روی دیسک کسی دیگر. خوانش، داده‌ی خصوصی است.</p>
<p>در نهایت، چیزی که اهمیت دارد بازگشتن است: هفته‌ها بعد، داشبوردی که جمله‌ی آن روز را با پیوند به پاراگراف دقیقش نشان می‌دهد. حاشیه‌نویسی وقتی کامل است که مسیر بازگشت داشته باشد.</p>
</body></html>`;

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  /* the popup harness over http: module scripts + the mocked-chrome page mode,
     exactly what chrome-extension:// serves but debuggable */
  if (path.startsWith('/popup/') || path.startsWith('/shared/')) {
    const file = join(ROOT, 'extension', normalize(path).replace(/^([/\\])+/, ''));
    if (existsSync(file) && file.startsWith(join(ROOT, 'extension'))) {
      res.writeHead(200, { 'content-type': MIME[join(file).split('.').pop()] || 'application/octet-stream' });
      res.end(readFileSync(file));
      return;
    }
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(ARTICLE);
});
await new Promise((r) => server.listen(SITE_PORT, '127.0.0.1', r));
log('article served on', `http://127.0.0.1:${SITE_PORT}/`);

/* ---------- real Chrome + real extension ---------- */
const args = [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`,
  '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', '--window-size=1280,900', 'about:blank',
];
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}

const chrome = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => { /* noise */ });

let wsInfo;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) { wsInfo = await r.json(); break; } } catch {}
}
if (!wsInfo) { fail('CDP never came up'); chrome.kill(); process.exit(1); }
log('browser up:', wsInfo.Browser);

class CDP {
  constructor(ws) { this.ws = ws; this.nextId = 1; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); setTimeout(() => rej(new Error('ws timeout')), 5000); });
    const c = new CDP(ws);
    ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && c.pending.has(msg.id)) { const { res, rej } = c.pending.get(msg.id); c.pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); } };
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
}
const browser = await CDP.connect(wsInfo.webSocketDebuggerUrl);

async function evalIn(sessionId, expression, awaitPromise = true) {
  const r = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') };
  return r.result.value;
}
async function shot(sessionId, name) {
  for (let i = 0; i < 3; i++) {
    try {
      const s = await Promise.race([
        browser.send('Page.captureScreenshot', { format: 'png' }, sessionId),
        new Promise((_, rej) => setTimeout(() => rej(new Error('capture timeout')), 8000)),
      ]);
      writeFileSync(join(OUT, name + '.png'), Buffer.from(s.data, 'base64'));
      log('shot', name);
      return true;
    } catch (e) { log('retry', name, String(e && e.message || e)); await sleep(1200); }
  }
  return false;
}
async function mouse(sessionId, kind, x, y) {
  /* buttons/clickCount exactly as the proven rigs set them — a drag needs
     buttons:1 on moves or Chrome drops the selection */
  await browser.send('Input.dispatchMouseEvent', {
    type: kind, x, y, button: 'left',
    buttons: kind === 'mouseReleased' ? 0 : 1,
    clickCount: (kind === 'mousePressed' || kind === 'mouseReleased') ? 1 : 0,
    pointerType: 'mouse',
  }, sessionId);
}
async function viewport(sessionId, width, height) {
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
}

/* ---------- extension ID ---------- */
let extId = null, swSession = null;
for (let i = 0; i < 40 && !extId; i++) {
  const { targetInfos } = await browser.send('Target.getTargets');
  const cands = targetInfos.filter((t) => t.url.startsWith('chrome-extension://') && (t.url.includes('background/service-worker.js') || t.url.endsWith('/background.js')));
  for (const c of cands) {
    try {
      const { sessionId } = await browser.send('Target.attachToTarget', { targetId: c.targetId, flatten: true });
      if (await evalIn(sessionId, 'globalThis.__HLX_APP === "weboo"', false) === true) { extId = c.url.split('/')[2]; swSession = sessionId; break; }
    } catch {}
  }
  if (!extId) await sleep(600);
}
if (!extId) { fail('extension did not load'); chrome.kill(); process.exit(1); }
log('extension id', extId);

/* ---------- seed a realistic Persian library ---------- */
let now = Date.now();
const day = 86400000;
const rec = (id, host, url, title, text, color, note, age, extra = {}) => ({
  id, host, site: 'https://' + host, url, urlNorm: url, title, text,
  prefix: '', suffix: '', color, note, createdAt: now - age * day, updatedAt: now - age * day + 3600e3, ...extra,
});
const seed = {
  'hlx:settings': { defaultColor: 'yellow', showToolbar: true, showBadge: true, disabledHosts: [], theme: 'light', language: 'fa' },
  'hlx:d:zoomit.ir': {
    z1: rec('z1', 'zoomit.ir', 'https://zoomit.ir/marginalia', 'حاشیه‌نویسی؛ هنرِ گفت‌وگو با متن', 'خواندنِ عمیق بدون گفت‌وگو با متن ممکن نیست. خوانندگانِ حرفه‌ای سال‌هاست که با کشیدن خط زیر جمله‌ها، کنارشان یادداشت نوشتن و علامت‌گذاریِ بخش‌های مهم، کتاب‌ها را به گفت‌وگویی ماندگار تبدیل می‌کنند.', 'yellow', 'ایده‌ی مرکزی مقاله — دقیقاً همان چیزی که وبو ساخته', 1, { start: 60, end: 210 }),
    z2: rec('z2', 'zoomit.ir', 'https://zoomit.ir/marginalia', 'حاشیه‌نویسی؛ هنرِ گفت‌وگو با متن', 'بوکمارک نشانی صفحه را نگه می‌دارد، نه آن جمله‌ای که ذهن ما را قفل کرد.', 'teal', '', 1, { start: 480, end: 555 }),
    z3: rec('z3', 'zoomit.ir', 'https://zoomit.ir/marginalia', 'حاشیه‌نویسی؛ هنرِ گفت‌وگو با متن', 'حاشیه‌نویسی دیجیتال یعنی بازگرداندن همین قلم به وب.', 'pink', 'قلم و وب — تم مقاله', 1, { start: 590, end: 655 }),
    z4: rec('z4', 'zoomit.ir', 'https://zoomit.ir/local-first', 'یادداشت‌های محلی و مالکیت داده', 'یادداشتِ خواندن، مالکیتِ شخصی دارد؛ باید روی دستگاه خودت بماند، نه روی دیسک کسی دیگر.', 'green', 'شعار محصول: همه‌چیز محلی', 4, { start: 100, end: 190 }),
    z5: rec('z5', 'zoomit.ir', 'https://zoomit.ir/local-first', 'یادداشت‌های محلی و مالکیت داده', 'خوانش، داده‌ی خصوصی است.', 'orange', '', 4, { start: 230, end: 268 }),
  },
  'hlx:d:en.wikipedia.org': {
    w1: rec('w1', 'en.wikipedia.org', 'https://en.wikipedia.org/wiki/Marginalia', 'Marginalia - Wikipedia', 'Marginalia is the oldest memory technology of reading. From medieval scribes to the scientists who annotated their books in pencil, the conversation between reader and text has always lived in the margins.', 'purple', 'Historical anchor for the landing copy', 9, { start: 20, end: 220 }),
  },
  'hlx:d:iranicaonline.org': {
    i1: rec('i1', 'iranicaonline.org', 'https://iranicaonline.org/articles/ketabat', 'کتابت و سنت کتاب‌داری ایرانی', 'سنت حاشیه‌نویسی در نسخه‌های خطی فارسی از کهن‌ترین نمونه‌های گفت‌وگوی خواننده با متن است.', 'green', 'برای بخش تاریخ مقاله', 15, { start: 40, end: 130 }),
  },
  'hlx:f:zoomit.ir': { icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', capturedAt: now - 1 * day },
  'hlx:tags': {
    'https://zoomit.ir/marginalia': ['خوانش', 'حاشیه‌نویسی'],
    'https://zoomit.ir/local-first': ['حریم خصوصی'],
    'https://en.wikipedia.org/wiki/Marginalia': ['تاریخ'],
    'https://iranicaonline.org/articles/ketabat': ['تاریخ'],
  },
  'hlx:schemaVersion': 2,
};
const injected = await evalIn(swSession, 'chrome.storage.local.set(' + JSON.stringify(seed) + ').then(() => true)');
if (injected !== true) { fail('seed failed', JSON.stringify(injected)); chrome.kill(); process.exit(1); }
log('library seeded');

const setTheme = async (theme) => {
  const r = await evalIn(swSession, `(async () => { const o = await chrome.storage.local.get('hlx:settings'); const s = o['hlx:settings'] || {}; s.theme = '${theme}'; await chrome.storage.local.set({ 'hlx:settings': s }); return true; })()`);
  if (r !== true) { fail('setTheme failed: ' + JSON.stringify(r)); chrome.kill(); process.exit(1); }
  log('theme set to', theme);
};

/* ---------- dashboard captures ---------- */
const DASH_URL = `chrome-extension://${extId}/dashboard.html`;
const { targetId: dashT } = await browser.send('Target.createTarget', { url: DASH_URL });
const dash = await browser.send('Target.attachToTarget', { targetId: dashT, flatten: true });
const D = dash.sessionId;
await browser.send('Page.enable', {}, D);
await browser.send('Runtime.enable', {}, D);
for (let i = 0; i < 20; i++) {
  const ok = await evalIn(D, 'document.readyState === "complete" && document.querySelectorAll("#groups .group").length > 0', false);
  if (ok === true) break;
  await sleep(500);
}
await viewport(D, 1280, 900);
await sleep(800);
await shot(D, PREFIX + '-dash-light-1280');

/* settings drawer */
await evalIn(D, 'document.getElementById("btn-settings").click(), true', false);
await sleep(900);
await shot(D, PREFIX + '-dash-drawer');
await evalIn(D, 'document.getElementById("drawer-close").click(), true', false);
await sleep(500);

/* booklet modal */
await evalIn(D, 'document.querySelector(".topbar-actions .btn") ? document.querySelectorAll(".topbar-actions .btn")[0].click() : null, true', false);
await sleep(900);
await shot(D, PREFIX + '-dash-booklet-modal');
await evalIn(D, 'document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })), true', false);
await sleep(500);

/* selective backup modal */
await evalIn(D, 'document.querySelectorAll(".topbar-actions .btn")[1] ? document.querySelectorAll(".topbar-actions .btn")[1].click() : null, true', false);
await sleep(900);
await shot(D, PREFIX + '-dash-backup-modal');
await evalIn(D, 'document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })), true', false);
await sleep(500);

/* mobile */
await viewport(D, 400, 820);
await sleep(800);
await shot(D, PREFIX + '-dash-light-400');
await viewport(D, 1280, 900);

/* dark — write the storage setting AND the anti-flash mirror, then navigate
   and VERIFY the flip (the mirror alone would keep the old theme for a tick) */
await setTheme('dark');
await evalIn(D, 'localStorage.setItem("hlx:theme", "dark"), true', false);
await browser.send('Page.navigate', { url: DASH_URL }, D);
let darkOk = false;
for (let i = 0; i < 25; i++) {
  await sleep(400);
  darkOk = await evalIn(D, 'document.readyState === "complete" && document.documentElement.getAttribute("data-theme") === "dark"', false) === true;
  if (darkOk) break;
}
if (!darkOk) { fail('dashboard never went dark'); chrome.kill(); process.exit(1); }
await sleep(1200);
await shot(D, PREFIX + '-dash-dark-1280');

/* ---------- popup captures — best effort: the harness tab is fragile in
   headless; a dead popup must not cost us the widget shots ---------- */
await setTheme('dark');
try {
  const HARNESS_URL = `http://127.0.0.1:${SITE_PORT}/popup/_e2e_harness.html`;
  const { targetId: popT } = await browser.send('Target.createTarget', { url: HARNESS_URL });
  const pop = await browser.send('Target.attachToTarget', { targetId: popT, flatten: true });
  const P = pop.sessionId;
  await browser.send('Page.enable', {}, P);
  await browser.send('Runtime.enable', {}, P);
  await viewport(P, 370, 560);
  await sleep(1800);
  await shot(P, PREFIX + '-popup-dark');
  await evalIn(P, 'document.getElementById("btn-theme").click(), true', false);
  await sleep(1000);
  await shot(P, PREFIX + '-popup-light');
  await browser.send('Target.closeTarget', { targetId: popT });
} catch (e) { log('popup capture skipped:', String(e && e.message || e)); }

/* back to light for the content-page widgets */
await setTheme('light');

/* ---------- content-page widgets ---------- */
const SITE = `http://127.0.0.1:${SITE_PORT}/`;
const { targetId: siteT } = await browser.send('Target.createTarget', { url: SITE });
const site = await browser.send('Target.attachToTarget', { targetId: siteT, flatten: true });
const S = site.sessionId;
await browser.send('Page.enable', {}, S);
await browser.send('Runtime.enable', {}, S);
for (let i = 0; i < 30; i++) {
  const ready = await evalIn(S, 'document.readyState === "complete" && !!document.querySelector("div[data-hlx-ui]")', false);
  if (ready === true) break;
  await sleep(400);
}
/* highlight two sentences (green + pink) through the REAL toolbar */
async function dragSelect(pIdx, from = 0.15, to = 0.75) {
  const rect = await evalIn(S, `(() => { const p = document.querySelectorAll('p')[${pIdx}]; const r = p.getBoundingClientRect(); return { x1: r.left + r.width*${from}, y: r.top + r.height/2, x2: r.left + r.width*${to} }; })()`, false);
  await mouse(S, 'mousePressed', rect.x1, rect.y);
  for (let s = 1; s <= 10; s++) { await mouse(S, 'mouseMoved', rect.x1 + (rect.x2 - rect.x1) * (s / 10), rect.y); await sleep(35); }
  await mouse(S, 'mouseReleased', rect.x2, rect.y);
  await sleep(900);
}
async function pickColor(idx) {
  const btn = await evalIn(S, `(() => { for (const h of document.querySelectorAll('div[data-hlx-ui]')) { const tb = h.shadowRoot && h.shadowRoot.querySelector('.hlx-tb'); if (!tb || tb.style.display === 'none') continue; const b = tb.querySelectorAll('button[data-color]')[${idx}]; const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; } return null; })()`, false);
  if (!btn) return false;
  await mouse(S, 'mousePressed', btn.x, btn.y);
  await mouse(S, 'mouseReleased', btn.x, btn.y);
  await sleep(900);
  return true;
}
async function markClick() {
  const m = await evalIn(S, `(() => { const ms = document.querySelectorAll('mark.hlx-marker'); if (!ms.length) return null; const cr = ms[ms.length-1].getClientRects()[0] || ms[ms.length-1].getBoundingClientRect(); return { x: cr.left + cr.width/2, y: cr.top + cr.height/2 }; })()`, false);
  if (!m) return false;
  await mouse(S, 'mousePressed', m.x, m.y);
  await mouse(S, 'mouseReleased', m.x, m.y);
  await sleep(1000);
  return true;
}
async function waitToolbar() {
  for (let i = 0; i < 16; i++) {
    const vis = await evalIn(S, `(() => { for (const h of document.querySelectorAll('div[data-hlx-ui]')) { const tb = h.shadowRoot && h.shadowRoot.querySelector('.hlx-tb'); if (tb && tb.style.display !== 'none') return true; } return false; })()`, false);
    if (vis === true) return true;
    await sleep(300);
  }
  return false;
}
/* the toolbar presents reliably on the FIRST selection — capture it there,
   then proceed to highlights and the popover */
await dragSelect(0);
await waitToolbar();
await shot(S, PREFIX + '-toolbar-light');
await pickColor(2); /* green */
await dragSelect(3);
await pickColor(3); /* teal — best effort (re-selection is flaky in the rig) */
await viewport(S, 1280, 900);
await sleep(400);
await shot(S, PREFIX + '-page-highlights');
await markClick();
await sleep(400);
await shot(S, PREFIX + '-popover-light');

log('done →', OUT);
chrome.kill();
server.close();
process.exit(0);
