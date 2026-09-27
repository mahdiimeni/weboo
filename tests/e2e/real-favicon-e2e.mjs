#!/usr/bin/env node
/**
 * Web Highlighter — "real" favicon E2E test (root-cause research edition)
 *
 * Unlike the harness: real Chrome + the real loaded extension (the extension/
 * folder) + the real content script on a real HTTP site + drag-selection with
 * a real CDP mouse + opening the extension's real dashboard and probing
 * chrome://favicon2 behavior.
 *
 * Everything in one run (the sandbox env kills background processes):
 *   1) test site with a red favicon (Bun.serve)
 *   2) spawn headless=new Chrome with --load-extension
 *   3) raw CDP: select text → click the toolbar's green button (Shadow DOM) → real record
 *   4) extension dashboard: .fl-img / .has-fav / naturalWidth state + screenshot
 *   5) systematic chrome://favicon2 experiments (size/scale/v1/fetch) in the extension context
 *
 * Usage: bun tests/e2e/real-favicon-e2e.mjs
 */
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const EXT_DIR = join(ROOT, 'extension');
const CHROME = '/home/z/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const CDP_PORT = 9333;
const SITE_PORT = 8078;
const SITE = `http://127.0.0.1:${SITE_PORT}/`;
const PROFILE = '/tmp/hlx-real-profile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[e2e]', ...a);
const fail = (...a) => console.log('[FAIL]', ...a);

/* ---------- 1) distinctive red favicon (32×32, white dot in the center) ---------- */
function redFavicon() {
  const cached = '/tmp/hlx-site/favicon.png';
  if (existsSync(cached)) return readFileSync(cached);
  const w = 32, h = 32;
  let rows = Buffer.alloc(0);
  for (let y = 0; y < h; y++) {
    rows = Buffer.concat([rows, Buffer.from([0])]);
    const line = Buffer.alloc(w * 3);
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2 + 0.5, dy = y - h / 2 + 0.5;
      const white = dx * dx + dy * dy < (w / 4) ** 2;
      line[x * 3] = white ? 255 : 200; line[x * 3 + 1] = white ? 255 : 30; line[x * 3 + 2] = white ? 255 : 30;
    }
    rows = Buffer.concat([rows, line]);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = (() => { let c, table = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; } let r = 0xffffffff; for (const b of body) r = table[(r ^ b) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; })();
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc);
    return Buffer.concat([len, body, crcB]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const FAV = redFavicon();

const INDEX_HTML = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
<title>مقاله آزمایشی هایلایتر</title>
<link rel="icon" type="image/png" href="/favicon.png">
<style>body{font-family:sans-serif;max-width:680px;margin:40px auto;line-height:2;direction:rtl}
h1{color:#333}p{color:#444;font-size:17px}</style></head><body>
<h1>مقاله آزمایشی برای وب هایلایتر</h1>
<p>این متن اول برای انتخاب و هایلایت کردن است و باید به‌سادگی با ماوس انتخاب شود.</p>
<p>این متن دوم برای یادداشت است و بعد از هایلایت می‌توان روی آن یادداشت نوشت.</p>
<p>این متن سوم صرفاً برای طولانی‌تر شدن صفحه است تا رفتار اسکرول هم قابل ارزیابی باشد.</p>
</body></html>`;

Bun.serve({
  port: SITE_PORT,
  fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === '/favicon.png') return new Response(FAV, { headers: { 'content-type': 'image/png' } });
    if (u.pathname === '/' || u.pathname === '/index.html') return new Response(INDEX_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    return new Response('not found', { status: 404 });
  },
});

/* ---------- 2) real Chrome + real extension ---------- */
const args = [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`,
  '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', '--window-size=1280,900', 'about:blank',
];
const chrome = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => { /* noise */ });

let wsInfo;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) { wsInfo = await r.json(); break; } } catch {}
}
if (!wsInfo) { fail('CDP never came up'); chrome.kill(); process.exit(1); }
log('chrome up:', wsInfo.Browser);

/* ---------- 3) raw CDP client ---------- */
class CDP {
  constructor(ws) { this.ws = ws; this.nextId = 1; this.pending = new Map(); this.listeners = []; this.closed = false; }
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

async function evalIn(sessionId, expression, awaitPromise = true) {
  const r = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') };
  return r.result.value;
}
const mouse = (sessionId, type, x, y, extra = {}) =>
  browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0, ...extra }, sessionId);

/* ---------- 4) find the extension ID from the targets ---------- */
let extId = null;
for (let i = 0; i < 30 && !extId; i++) {
  const { targetInfos } = await browser.send('Target.getTargets');
  const sw = targetInfos.find((t) => t.url.startsWith('chrome-extension://') && t.url.includes('background/service-worker.js'));
  const any = sw || targetInfos.find((t) => t.url.startsWith('chrome-extension://'));
  if (any) extId = any.url.split('/')[2];
  else await sleep(600);
}
if (!extId) { fail('extension did not load (no chrome-extension target)'); chrome.kill(); process.exit(1); }
log('extension loaded, id =', extId, '→ manifest accepted, permissions OK');

/* ---------- 5) site page + real highlight ---------- */
const { targetId } = await browser.send('Target.createTarget', { url: SITE });
const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
await browser.send('Page.enable', {}, sessionId);
await browser.send('Runtime.enable', {}, sessionId);

// wait for full load + content-script boot + Chrome's favicon download
for (let i = 0; i < 30; i++) {
  const ready = await evalIn(sessionId, 'document.readyState === "complete" && !!document.querySelector("div[data-hlx-ui]")', false);
  if (ready === true) break;
  await sleep(400);
}
await sleep(2500);
const title = await evalIn(sessionId, 'document.title', false);
const contentOk = await evalIn(sessionId, '!!document.querySelector("div[data-hlx-ui]")', false);
log(`site loaded "${title}" | content script injected: ${contentOk}`);
if (contentOk !== true) { fail('content script NOT injected — extension broken'); }

// real drag-selection on the first paragraph (RTL — from 20% to 80% of the width)
const rect = await evalIn(sessionId, `(() => { const p = document.querySelectorAll('p')[0]; const r = p.getBoundingClientRect(); return { x1: r.left + r.width*0.2, y: r.top + r.height/2, x2: r.left + r.width*0.8, y2: r.top + r.height/2 }; })()`, false);
await mouse(sessionId, 'mousePressed', rect.x1, rect.y);
for (let s = 1; s <= 12; s++) {
  await mouse(sessionId, 'mouseMoved', rect.x1 + (rect.x2 - rect.x1) * (s / 12), rect.y);
  await sleep(40);
}
await mouse(sessionId, 'mouseReleased', rect.x2, rect.y2);
await sleep(150);
const selText = await evalIn(sessionId, '(window.getSelection() || {toString:()=>""}).toString()', false);
log('selection text after real drag:', JSON.stringify(String(selText).slice(0, 40)));
await sleep(700);

// the toolbar must be visible → green button coordinates from the Shadow DOM
// (several data-hlx-ui hosts exist: popover/toolbar/toast — we must scan them all)
const btn = await evalIn(sessionId, `(() => {
  const hosts = document.querySelectorAll('div[data-hlx-ui]');
  for (const h of hosts) {
    const tb = h.shadowRoot && h.shadowRoot.querySelector('.hlx-tb');
    if (!tb || tb.style.display === 'none') continue;
    const b = tb.querySelector('button[data-color="green"]');
    if (!b) continue;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  }
  return null;
})()`, false);
if (!btn) { fail('toolbar did not appear after real mouse selection'); }
else {
  log('toolbar visible, green button at', Math.round(btn.x), Math.round(btn.y));
  await mouse(sessionId, 'mousePressed', btn.x, btn.y, { button: 'left', clickCount: 1 });
  await mouse(sessionId, 'mouseReleased', btn.x, btn.y, { button: 'left', clickCount: 1 });
  await sleep(1000);
}
const mark = await evalIn(sessionId, `(() => { const m = document.querySelector('mark.hlx-marker[data-hl-color="green"]'); return m ? { text: m.textContent, count: document.querySelectorAll('mark.hlx-marker').length } : null; })()`, false);
log('real highlight created:', JSON.stringify(mark));

/* v1.1.4: the favicon capture must have run alongside the highlight save → wait and prove it */
await sleep(2000);

// screenshot of the page with the highlight
const siteShot = await browser.send('Page.captureScreenshot', { format: 'png' }, sessionId);
writeFileSync(join(HERE, 'real-site-highlight.png'), Buffer.from(siteShot.data, 'base64'));

/* ---------- 6) the extension's real dashboard ---------- */
await browser.send('Page.navigate', { url: `chrome-extension://${extId}/dashboard/dashboard.html` }, sessionId);
for (let i = 0; i < 30; i++) {
  const ready = await evalIn(sessionId, 'document.readyState === "complete" && !!document.querySelector(".group")', false);
  if (ready === true) break;
  await sleep(400);
}
// wait for the favicons to settle (load or error)
await sleep(3500);

const dashReport = await evalIn(sessionId, `(async () => {
  const out = { groups: [], storage: null };
  document.querySelectorAll('.group').forEach(g => {
    const fl = g.querySelector('.fl');
    const img = fl && fl.querySelector('img.fl-img');
    out.groups.push({
      title: (g.querySelector('.group-title')||{textContent:''}).textContent.trim(),
      url: (g.querySelector('.group-url')||{textContent:''}).textContent.trim(),
      letter: fl ? fl.textContent.trim() : null,
      tileHasFav: !!(fl && fl.classList.contains('has-fav')),
      hasImg: !!img,
      imgOn: !!(img && img.classList.contains('on')),
      imgComplete: img ? img.complete : null,
      naturalW: img ? img.naturalWidth : null,
      naturalH: img ? img.naturalHeight : null,
      src: img ? img.src : null
    });
  });
  try { const all = await chrome.storage.local.get(null); out.storage = Object.keys(all).map(k => k + ' (' + (JSON.stringify(all[k]).length) + 'b)'); } catch (e) { out.storage = 'ERR ' + e; }
  return out;
})()`);

const dashShot = await browser.send('Page.captureScreenshot', { format: 'png' }, sessionId);
writeFileSync(join(HERE, 'real-dashboard.png'), Buffer.from(dashShot.data, 'base64'));
log('dashboard report:', JSON.stringify(dashReport, null, 2));

/* ---------- 7) reference experiment: chrome://favicon2 behavior (for the root-cause doc) ---------- */
const exp = await evalIn(sessionId, `(async () => {
  const page = 'http://127.0.0.1:8078/';
  const enc = encodeURIComponent(page);
  const variants = [
    ['size=64 1x (مسیر قدیمی v1.1.3)', 'chrome://favicon2/?size=64&scale_factor=1x&page_url=' + enc],
    ['size=32 1x', 'chrome://favicon2/?size=32&scale_factor=1x&page_url=' + enc]
  ];
  const probe = (url) => new Promise(res => { const im = new Image(); let done = false;
    im.onload = () => { done = true; res({ ok: true, w: im.naturalWidth, h: im.naturalHeight }); };
    im.onerror = () => { done = true; res({ ok: false }); };
    setTimeout(() => { if (!done) res({ ok: false, timeout: true }); }, 5000);
    im.src = url; });
  const results = [];
  for (const [name, url] of variants) results.push({ name, ...(await probe(url)) });
  return { results, note: 'chrome://favicon2 در مرورگر واقعی با شکست مواجه می‌شود — علت مهاجرت به dataURL' };
})()`);
log('favicon2 reference check:', JSON.stringify(exp));

/* ---------- 8) summary ---------- */
const g = (dashReport.groups || [])[0] || {};
const summary = {
  extensionLoaded: !!extId,
  contentScriptInjected: contentOk === true,
  realHighlight: !!mark && mark.count >= 1,
  selectionText: String(selText || '').trim().length,
  dashboardOpened: (dashReport.groups || []).length >= 1,
  storageKeys: dashReport.storage,
  faviconCaptured: (dashReport.storage || []).some((k) => String(k).indexOf('hlx:f:') === 0),
  faviconImgMounted: g.hasImg === true,
  faviconLoaded: g.imgOn === true && (g.naturalW || 0) > 0,
  imgSrcStartsWithData: String(g.src || '').startsWith('data:image/'),
  naturalSize: [g.naturalW, g.naturalH],
  favicon2StillBroken: (exp.results || []).every((r) => !r.ok),
};
writeFileSync(join(HERE, 'real-favicon-report.json'), JSON.stringify(summary, null, 2));
log('SUMMARY:', JSON.stringify(summary, null, 2));
chrome.kill();
process.exit(0);
