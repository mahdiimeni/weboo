/**
 * Probe rig — the floating toolbar's COPY toast (the v0.14 regression report).
 *
 * Reproduces the user flow: real page → select text → the floating toolbar
 * appears → click the copy button → the localized toast must appear at the
 * bottom of the page and auto-dismiss.
 *
 * Run: HLX_CHROME=<chrome> bun tests/e2e/probe-copy-toast.mjs
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CHROME = process.env.HLX_CHROME;
if (!CHROME) { console.error('HLX_CHROME required'); process.exit(1); }
const EXT_DIR = process.env.HLX_EXT_DIR || join(ROOT, '.output', 'chrome-mv3');
if (!process.env.HLX_EXT_DIR) {
  execSync('bun run build:ext && bun run build:wxt', { cwd: ROOT, stdio: 'inherit' });
}
const CDP_PORT = 9400 + Math.floor(Math.random() * 40);
const SITE_PORT = 8091;
const SITE = `http://127.0.0.1:${SITE_PORT}/`;
const PROFILE = '/tmp/hlx-copysync-profile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[probe]', ...a);
const fail = (...a) => console.log('[FAIL]', ...a);

import { rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}

const INDEX_HTML = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
<title>probe page</title></head><body style="max-width:680px;margin:60px auto;line-height:2;direction:rtl">
<p>این متن اول برای آزمون دکمه‌ی کپی است و باید به‌سادگی انتخاب شود.</p>
<p>متن دوم فقط برای طول صفحه است.</p>
</body></html>`;

Bun.serve({ port: SITE_PORT, fetch(req) {
  const u = new URL(req.url);
  if (u.pathname === '/' || u.pathname === '/index.html') return new Response(INDEX_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new Response('nf', { status: 404 });
} });

const args = [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`,
  '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', '--window-size=1280,900', 'about:blank',
];
const chrome = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => {});
let wsInfo;
for (let i = 0; i < 40; i++) { await sleep(400); try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) { wsInfo = await r.json(); break; } } catch {} }
if (!wsInfo) { fail('CDP never came up'); chrome.kill(); process.exit(1); }

/* the proven CDP client — identical to the other rigs */
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
function evalIn(sessionId, expression, awaitPromise = true) {
  return browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId)
    .then((r) => { if (r.exceptionDetails) return { __error: r.exceptionDetails.text }; return r.result.value; });
}
async function mouse(sessionId, type, x, y) {
  await browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0 }, sessionId);
}

let extId = null;
let swSession = null;
for (let i = 0; i < 30 && !extId; i++) {
  const { targetInfos } = await browser.send('Target.getTargets');
  const cands = targetInfos.filter((t) => t.url.startsWith('chrome-extension://') &&
    (t.url.includes('background/service-worker.js') || t.url.endsWith('/background.js')));
  for (const c of cands) {
    try {
      const { sessionId } = await browser.send('Target.attachToTarget', { targetId: c.targetId, flatten: true });
      const app = await evalIn(sessionId, 'String(globalThis.__HLX_APP)');
      if (app === 'weboo') { extId = c.url.split('/')[2]; swSession = sessionId; break; }
    } catch (e) { /* foreign extension — ignore */ }
  }
  if (!extId) await sleep(500);
}
if (!extId) { fail('extension did not load'); chrome.kill(); process.exit(1); }
log('extension loaded:', extId);

function evalIn(sessionId, expression, awaitPromise = true) {
  return browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId)
    .then((r) => { if (r.exceptionDetails) return { __error: r.exceptionDetails.text }; return r.result.value; });
}
async function mouse(sessionId, type, x, y) {
  await browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0 }, sessionId);
}

/* the page */
const { targetId } = await browser.send('Target.createTarget', { url: SITE });
const { sessionId: S } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
await browser.send('Page.enable', {}, S);
await browser.send('Runtime.enable', {}, S);
for (let i = 0; i < 30; i++) {
  const ready = await evalIn(S, 'document.readyState === "complete" && !!document.querySelector("div[data-hlx-ui]")', false);
  if (ready === true) break;
  await sleep(400);
}
log('content injected:', await evalIn(S, '!!document.querySelector("div[data-hlx-ui]")', false));

/* select the first paragraph (real drag) */
const rect = await evalIn(S, `(() => { const p = document.querySelectorAll('p')[0]; const r = p.getBoundingClientRect(); return { x1: r.left + r.width*0.15, y: r.top + r.height/2, x2: r.left + r.width*0.85, y2: r.top + r.height/2 }; })()`);
await mouse(S, 'mousePressed', rect.x1, rect.y);
for (let s2 = 1; s2 <= 10; s2++) { await mouse(S, 'mouseMoved', rect.x1 + (rect.x2 - rect.x1) * (s2 / 10), rect.y); await sleep(40); }
await mouse(S, 'mouseReleased', rect.x2, rect.y2);
await sleep(300);

/* the toolbar's copy button */
/* wait for the copy button to become visible (the toolbar settles after
   the drag's selectionchange settles) */
let copyBtn = null;
for (let i = 0; i < 15 && !copyBtn; i++) {
  copyBtn = await evalIn(S, `(() => {
    const b = [...document.querySelectorAll('div[data-hlx-ui]')]
      .map((h) => h.shadowRoot?.querySelector('button[data-act="copy"]')).find(Boolean);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return (r.width > 0 && r.height > 0) ? { x: r.left + r.width/2, y: r.top + r.height/2 } : null;
  })()`);
  if (!copyBtn) await sleep(200);
}
if (!copyBtn) {
  const forensics = await evalIn(S, `(() => {
    const tb = [...document.querySelectorAll('div[data-hlx-ui]')].map((h) => h.shadowRoot?.querySelector('.hlx-tb')).find(Boolean);
    return tb ? { cls: tb.className, style: tb.getAttribute('style'), rect: JSON.stringify(tb.getBoundingClientRect()) } : 'no toolbar at all';
  })()`);
  fail('copy button never visible — toolbar forensics: ' + JSON.stringify(forensics));
  writeFileSync(join(HERE, 'probe-copy-toast-result.json'), JSON.stringify({ forensics }, null, 2));
  chrome.kill(); process.exit(1);
}
log('copy button visible at', JSON.stringify(copyBtn));
const pageErrors = [];
browser.on((msg) => {
  if (msg.sessionId !== S) return;
  if (msg.method === 'Runtime.exceptionThrown')
    pageErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
    pageErrors.push('console.error: ' + (msg.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 250));
});
await mouse(S, 'mousePressed', copyBtn.x, copyBtn.y);
await mouse(S, 'mouseReleased', copyBtn.x, copyBtn.y);
await sleep(400);
log('PAGE ERRORS during copy:', JSON.stringify(pageErrors, null, 1));

/* the toast */
const toastState = await evalIn(S, `(() => {
  const hosts = [...document.querySelectorAll('div[data-hlx-ui]')];
  const toast = hosts.map((h) => h.shadowRoot?.querySelector('.hlx-toast')).find(Boolean);
  return {
    hostCount: hosts.length,
    toastExists: !!toast,
    text: toast ? toast.textContent : null,
    showing: toast ? toast.classList.contains('show') : false,
    opacity: toast ? getComputedStyle(toast).opacity : null,
    dir: toast ? toast.getAttribute('dir') : null,
  };
})()`);
log('TOAST STATE:', JSON.stringify(toastState, null, 1));
await sleep(2300);
const after = await evalIn(S, `(() => {
  const t = [...document.querySelectorAll('div[data-hlx-ui]')].map((h) => h.shadowRoot?.querySelector('.hlx-toast')).find(Boolean);
  return t ? t.classList.contains('show') : null;
})()`);
log('toast auto-dismissed after 2.3s:', after === false);

writeFileSync(join(HERE, 'probe-copy-toast-result.json'), JSON.stringify({ toastState, dismissed: after === false }, null, 2));
const ok = toastState.toastExists && toastState.showing && (toastState.text || '').length > 0;
console.log(ok ? '[PROBE] PASS — the copy toast appears' : '[PROBE] FAIL — no visible toast');
chrome.kill();
process.exit(ok ? 0 : 1);
