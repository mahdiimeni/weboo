#!/usr/bin/env bun
/**
 * Web Highlighter — real-browser compatibility E2E on a Next.js (React) stack
 *
 * Everything real: Chrome for Testing + the real loaded extension (extension/)
 * + the real fixture Next.js App-Router site (tests/e2e/fixtures/next-app).
 * Real mouse input for selection/toolbar/link clicks — no DOM fakes.
 *
 * Scenarios (the Next.js/React-specific risk surface):
 *   1  highlight on a hydrated Next page (baseline)
 *   2  hard-reload persistence
 *   3  popover open/close smoke
 *   4  client-side navigation (Link → pushState — same document)
 *   5  highlight created AFTER a soft nav must save under the NEW url
 *      (proved by hard reload afterwards)
 *   6  soft return to a page must RESTORE its highlights (no boot runs)
 *   7  React remount (key change) wipes the <mark> — must come back
 *   8  delayed/streamed content (paragraph appears at t+2.5s) — orphan
 *      retry must restore the highlight after a reload (non-regression)
 *
 * Usage: bun tests/e2e/next-compat-e2e.mjs
 * Env:   HLX_CHROME (chrome binary), HLX_FIXTURE_PORT (default 8090)
 */
import { spawn, execSync } from "node:child_process";
import { writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
/* Default: the SHIPPED artifact (.output/chrome-mv3 — WXT build, parity-gated).
   Rebuild it fresh here so the rig never tests a stale output; point
   HLX_EXT_DIR at extension/ to test the source tree instead. */
const EXT_DIR = process.env.HLX_EXT_DIR || join(ROOT, '.output', 'chrome-mv3');
if (!process.env.HLX_EXT_DIR) {
  execSync('bun run build:ext && bun run build:wxt', { cwd: ROOT, stdio: 'inherit' });
}
const FIXTURE = join(HERE, 'fixtures', 'next-app');
const CHROME = process.env.HLX_CHROME || join(process.env.HOME, '.hermes/tools/chromium-1208/chrome-linux64/chrome');
const CDP_PORT = 9340 + Math.floor(Math.random() * 40);
const SITE_PORT = Number(process.env.HLX_FIXTURE_PORT || 8090);
const SITE = `http://127.0.0.1:${SITE_PORT}`;
const PROFILE = '/tmp/hlx-next-compat-profile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[next-compat]', ...a);
const fail = (...a) => console.log('[FAIL]', ...a);

/* ---------- fixture Next.js server (reuse if already healthy) ---------- */
let nextProc = null;
async function healthy() {
  try { const r = await fetch(SITE + '/'); return r.ok; } catch { return false; }
}
if (!(await healthy())) {
  /* self-contained fixture: its own package.json + node_modules (the repo root
     carries no Next.js — the landing page was removed in Task 63) */
  const nextBin = join(FIXTURE, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!existsSync(nextBin)) {
    log('fixture deps missing — bun install in', FIXTURE);
    const inst = spawn(process.execPath, ['install'], { cwd: FIXTURE, stdio: 'inherit' });
    await new Promise((res) => inst.on('exit', res));
    if (!existsSync(nextBin)) { fail('fixture bun install did not produce next'); process.exit(1); }
  }
  /* production mode — what real Next.js sites run (dev-mode HMR does not
     hydrate in this sandbox, with or without the extension) */
  if (!existsSync(join(FIXTURE, '.next'))) {
    const build = spawn(process.execPath, [nextBin, 'build', FIXTURE], { cwd: ROOT, stdio: 'inherit' });
    await new Promise((res) => build.on('exit', res));
  }
  nextProc = spawn(process.execPath, [nextBin, 'start', FIXTURE, '-p', String(SITE_PORT)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  nextProc.stdout.on('data', () => {});
  nextProc.stderr.on('data', () => {});
  let up = false;
  for (let i = 0; i < 60; i++) { await sleep(1000); if (await healthy()) { up = true; break; } }
  if (!up) { fail('fixture Next.js server never came up'); nextProc.kill(); process.exit(1); }
}
log('fixture site up:', SITE);

/* ---------- real Chrome + real extension ---------- */
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`,
  '--no-proxy-server', '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', '--window-size=1280,900', 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => {});

let wsInfo;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) { wsInfo = await r.json(); break; } } catch {}
}
if (!wsInfo) { fail('CDP never came up'); chrome.kill(); process.exit(1); }
log('chrome up:', wsInfo.Browser);

/* ---------- raw CDP client (same proven pattern as real-theme-e2e) ---------- */
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

async function evalIn(sessionId, expression, awaitPromise = true) {
  const r = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  if (r.exceptionDetails) return { __error: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') };
  return r.result.value;
}
const mouse = (sessionId, type, x, y) =>
  browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0 }, sessionId);
const key = (sessionId, k) =>
  browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, text: k === 'Escape' ? '\u001b' : '' }, sessionId)
    .then(() => browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k }, sessionId));

async function shot(sessionId, file) {
  try {
    const s = await browser.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(HERE, file), Buffer.from(s.data, 'base64'));
    return true;
  } catch (e) { log('screenshot failed', file, String(e && e.message || e)); return false; }
}

/* ---------- find the extension id (from its own SW target) ---------- */
let extId = null;
/* dev-tree layout (background/service-worker.js) AND WXT layout (background.js
   — collides with the sandbox's foreign extensions, so CONFIRM via HL sentinel) */
for (let i = 0; i < 40 && !extId; i++) {
  const { targetInfos } = await browser.send('Target.getTargets');
  const cands = targetInfos.filter((t) => t.url.startsWith('chrome-extension://') &&
    (t.url.includes('background/service-worker.js') || t.url.endsWith('/background.js')));
  for (const c of cands) {
    try {
      const { sessionId } = await browser.send('Target.attachToTarget', { targetId: c.targetId, flatten: true });
      const r = await browser.send('Runtime.evaluate', { expression: 'typeof HL !== "undefined" && typeof HL.createStore === "function"', returnByValue: true }, sessionId);
      if (r.result && r.result.value === true) { extId = c.url.split('/')[2]; break; }
    } catch (e) { /* foreign */ }
  }
  if (!extId) await sleep(600);
}
if (!extId) { fail('extension did not load'); chrome.kill(); process.exit(1); }
log('extension loaded, id =', extId);

/* ---------- site tab ---------- */
const { targetId: siteT } = await browser.send('Target.createTarget', { url: SITE + '/' });
const site = await browser.send('Target.attachToTarget', { targetId: siteT, flatten: true });
const S = site.sessionId;
await browser.send('Page.enable', {}, S);
await browser.send('Runtime.enable', {}, S);

/* collect page-side JS errors (React hydration failures show up here) */
const pageErrors = [];
browser.on((msg) => {
  if (msg.sessionId !== S || !msg.method) return;
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    pageErrors.push(String(d.text || '') + ' ' + String((d.exception && d.exception.description) || ''));
  } else if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
    const args = (msg.params.args || []).map((a) => a.value !== undefined ? String(a.value) : String(a.description || '')).join(' ');
    pageErrors.push('console.' + msg.params.type + ': ' + args);
  }
});

async function waitFor(expr, timeoutMs = 15000, pollMs = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await evalIn(S, expr);
    if (v === true) return true;
    await sleep(pollMs);
  }
  return false;
}
async function ready() {
  return waitFor('document.readyState === "complete" && !!document.querySelector("div[data-hlx-ui]") && !!document.querySelector("main") && window.__hlxHydrated === true', 30000);
}
/* distinct highlight ids inside a container (a record can produce several <mark>) */
const COUNT_IDS = (sel) => `(() => {
  const root = ${sel === null ? 'document' : `document.querySelector(${JSON.stringify(sel)})`};
  if (!root) return -1;
  const ids = new Set();
  root.querySelectorAll('mark.hlx-marker').forEach((m) => ids.add(m.getAttribute('data-hl-id')));
  return ids.size;
})()`;
const HREF = 'location.href';
const PATHNAME = 'location.pathname';

async function dragSelectIn(sel) {
  const rect = await evalIn(S, `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x1: r.left + 4, x2: r.left + r.width - 4, y: r.top + Math.min(14, Math.max(6, r.height / 3)) };
  })()`, false);
  if (!rect || rect.__error) return false;
  await mouse(S, 'mousePressed', rect.x1, rect.y);
  for (let i = 1; i <= 10; i++) { await mouse(S, 'mouseMoved', rect.x1 + (rect.x2 - rect.x1) * (i / 10), rect.y); await sleep(35); }
  await mouse(S, 'mouseReleased', rect.x2, rect.y);
  return true;
}
/* wait for the real floating toolbar, then click the green swatch for real */
async function toolbarGreenClick() {
  const btn = await waitFor(`(() => {
    for (const h of document.querySelectorAll('div[data-hlx-ui]')) {
      const tb = h.shadowRoot && h.shadowRoot.querySelector('.hlx-tb');
      if (!tb || tb.style.display === 'none') continue;
      const b = tb.querySelector('button[data-color="green"]');
      if (!b) continue;
      const r = b.getBoundingClientRect();
      if (r.width > 0) return true;
    }
    return false;
  })()`, 4000, 200);
  if (!btn) return false;
  const pt = await evalIn(S, `(() => {
    for (const h of document.querySelectorAll('div[data-hlx-ui]')) {
      const tb = h.shadowRoot && h.shadowRoot.querySelector('.hlx-tb');
      if (!tb || tb.style.display === 'none') continue;
      const b = tb.querySelector('button[data-color="green"]');
      if (!b) continue;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`, false);
  if (!pt || pt.__error) return false;
  await mouse(S, 'mousePressed', pt.x, pt.y);
  await mouse(S, 'mouseReleased', pt.x, pt.y);
  await sleep(600);
  return true;
}
async function highlightIn(sel, expectCount) {
  const okSel = await dragSelectIn(sel);
  if (!okSel) return false;
  const okTb = await toolbarGreenClick();
  if (!okTb) return false;
  return waitFor(COUNT_IDS(sel) + ' === ' + expectCount, 5000, 250);
}
async function clickAt(expr) {
  const pt = await evalIn(S, expr, false);
  if (!pt || pt.__error || !pt.x) return false;
  await mouse(S, 'mousePressed', pt.x, pt.y);
  await mouse(S, 'mouseReleased', pt.x, pt.y);
  return true;
}
const linkPt = (sel) => `(() => { const a = document.querySelector(${JSON.stringify(sel)}); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
const markPt = (sel) => `(() => { const m = document.querySelector(${JSON.stringify(sel)} + ' mark.hlx-marker'); if (!m) return null; const r = (m.getClientRects()[0] || m.getBoundingClientRect()); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail });
  log((pass ? 'PASS ' : 'FAIL '), name, detail !== undefined ? JSON.stringify(detail) : '');
}

/* ================= scenarios ================= */

/* 1) baseline: highlight on a hydrated Next page */
await ready();
const bootInjected = await evalIn(S, '!!document.querySelector("div[data-hlx-ui]")', false);
check('S1-content-script-on-next', bootInjected === true, { href: await evalIn(S, HREF, false) });
const s1 = await highlightIn('#p1', 1);
check('S2-highlight-create-on-next', s1);

/* 2) hard reload persistence */
await browser.send('Page.navigate', { url: SITE + '/' }, S);
await ready(); await sleep(600);
const s2 = await waitFor(COUNT_IDS('#p1') + ' === 1', 6000);
check('S3-hard-reload-restore', s2);

/* 3) popover smoke on the Next page */
await clickAt(markPt('#p1'));
const popOpen = await waitFor(`(() => {
  for (const h of document.querySelectorAll('div[data-hlx-ui]')) {
    const po = h.shadowRoot && h.shadowRoot.querySelector('.hlx-po');
    if (po && po.style.display !== 'none') return true;
  }
  return false;
})()`, 4000, 250);
check('S4-popover-opens', popOpen);
await key(S, 'Escape'); await sleep(400);
const popClosed = await evalIn(S, `(() => {
  for (const h of document.querySelectorAll('div[data-hlx-ui]')) {
    const po = h.shadowRoot && h.shadowRoot.querySelector('.hlx-po');
    if (po && po.style.display !== 'none') return false;
  }
  return true;
})()`, false);
check('S5-popover-escape-closes', popClosed === true);

/* 4) client-side navigation (same document) */
await evalIn(S, 'window.__hlxProbe = "alive"', false);
await clickAt(linkPt('#to-b'));
const softNavOk = await waitFor(`location.pathname === '/b' && !!document.querySelector('#title-b') && window.__hlxProbe === 'alive'`, 10000, 300);
check('S6-soft-nav-same-document', softNavOk, softNavOk ? undefined : {
  pathname: await evalIn(S, 'location.pathname', false),
  probe: await evalIn(S, 'window.__hlxProbe', false),
  titleB: await evalIn(S, '!!document.querySelector("#title-b")', false),
});

/* 5) highlight created AFTER the soft nav (must key to /b) */
const s5 = await highlightIn('#bp1', 1);
check('S7-highlight-after-soft-nav', s5);
await sleep(800); /* let the save land */

/* 6a) soft return to A — restore without a boot */
await clickAt(linkPt('#to-a'));
const backA = await waitFor(`location.pathname === '/' && !!document.querySelector('#title-a')`, 10000, 300);
check('S8-soft-back-to-a', backA);
const s6a = await waitFor(COUNT_IDS('#p1') + ' === 1', 6000, 400);
check('S9-restore-on-soft-return', s6a, { marks: await evalIn(S, COUNT_IDS('#p1'), false) });

/* 6b) soft nav to B again — restore */
await clickAt(linkPt('#to-b'));
const backB = await waitFor(`location.pathname === '/b' && !!document.querySelector('#title-b')`, 10000, 300);
const s6b = backB && await waitFor(COUNT_IDS('#bp1') + ' === 1', 6000, 400);
check('S10-restore-on-soft-nav-to-b', s6b, { marks: await evalIn(S, COUNT_IDS('#bp1'), false) });

/* 6c) hard reload of B — proves the save key is B's url */
await browser.send('Page.navigate', { url: SITE + '/b' }, S);
await ready(); await sleep(600);
const s6c = await waitFor(COUNT_IDS('#bp1') + ' === 1', 6000);
check('S11-save-key-is-current-url', s6c, { marks: await evalIn(S, COUNT_IDS('#bp1'), false) });
const globalMarks = await evalIn(S, `(() => { const ids = new Set(); document.querySelectorAll('mark.hlx-marker').forEach((m) => ids.add(m.getAttribute('data-hl-id'))); return ids.size; })()`, false);
check('S12-no-cross-page-contamination', globalMarks === 1, { globalMarks });

/* 7) React remount (key change) wipes the mark — must come back */
await browser.send('Page.navigate', { url: SITE + '/' }, S);
await ready(); await sleep(600);
const s7a = await highlightIn('#rw', 1);
check('S13-highlight-on-rerender-paragraph', s7a);
await clickAt(linkPt('#rerender'));
await sleep(500);
const wiped = await waitFor(COUNT_IDS('#rw') + ' === 0', 3000, 200);
log('remount wiped the mark (expected true):', wiped);
const s7b = await waitFor(COUNT_IDS('#rw') + ' === 1', 6000, 300);
check('S14-mark-survives-react-remount', s7b, { wipedFirst: wiped });
await shot(S, 'next-compat-remount.png');

/* 8) delayed/streamed content — orphan retry after reload (non-regression) */
await browser.send('Page.navigate', { url: SITE + '/c' }, S);
await ready();
const lateShown = await waitFor('!!document.querySelector("#late-p")', 10000, 400);
const s8a = lateShown && await highlightIn('#late-p', 1);
check('S15-highlight-on-delayed-content', s8a, lateShown ? undefined : {
  hydrated: await evalIn(S, 'window.__hlxHydrated === true', false),
  waitP: await evalIn(S, '!!document.querySelector("#wait-p")', false),
  lateP: await evalIn(S, '!!document.querySelector("#late-p")', false),
  href: await evalIn(S, 'location.href', false),
  main: await evalIn(S, 'document.querySelector("main") ? document.querySelector("main").textContent.slice(0, 120) : null', false),
});
await sleep(800);
await browser.send('Page.navigate', { url: SITE + '/c' }, S);
await ready();
const s8b = await waitFor(COUNT_IDS('#late-p') + ' === 1', 12000, 500);
check('S16-delayed-content-restore', s8b, { lateShown });
await shot(S, 'next-compat-final.png');

/* ---------- summary ---------- */
const report = {
  browser: wsInfo.Browser,
  extensionId: extId,
  site: SITE,
  ranAt: new Date().toISOString(),
  passed: results.filter((r) => r.pass).length,
  failed: results.filter((r) => !r.pass).length,
  pageErrors: pageErrors.slice(0, 20),
  results,
};
writeFileSync(join(HERE, 'next-compat-report.json'), JSON.stringify(report, null, 2));
log('SUMMARY:', report.passed, 'passed /', report.failed, 'failed');
for (const r of results.filter((x) => !x.pass)) log('  FAILED:', r.name, JSON.stringify(r.detail ?? null));

chrome.kill();
if (nextProc) nextProc.kill();
process.exit(report.failed ? 1 : 0);
