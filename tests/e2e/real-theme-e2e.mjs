#!/usr/bin/env node
/**
 * Web Highlighter — "real" E2E test for content widget theming (v1.2.1)
 *
 * Proving the real user path (everything real — no mocks):
 *   1) real Chrome + the real loaded extension (the extension/ folder)
 *   2) the real extension popup in a tab: a real click on the theme cycle button
 *      (#btn-theme) → hlx:settings.theme changes in chrome.storage (source of truth)
 *   3) test site in another tab: the content script picks the theme up "live"
 *      via chrome.storage.onChanged (the same onSettingsChanged → HL.ui.setTheme)
 *   4) real text selection with the mouse → toolbar → green → mark → note popover
 *   5) assertions: toolbar/popover palettes via real getComputedStyle inside the
 *      Shadow DOM (forced dark on a light system = against media, so the
 *      data-theme path is proven)
 *   6) live flip: with the popover open, switching the theme from the popup in
 *      the other tab re-palettes the open window instantly (dark → auto on a
 *      light system = light)
 *   7) boot path: reload the site page after saving the theme → the toolbar is
 *      dark from the very start
 *
 * Usage: bun tests/e2e/real-theme-e2e.mjs
 */
import { spawn, execSync } from "node:child_process";
import { rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
/* Default: the SHIPPED artifact (.output/chrome-mv3 — WXT build, parity-gated).
   Rebuild it fresh here so the rig never tests a stale output. HLX_EXT_DIR can
   point at any OTHER built extension dir; it cannot point at extension/ (the
   source tree) since 7b — see the guard below. */
const EXT_DIR = process.env.HLX_EXT_DIR || join(ROOT, '.output', 'chrome-mv3');
if (!process.env.HLX_EXT_DIR) {
  execSync('bun run build:ext && bun run build:wxt', { cwd: ROOT, stdio: 'inherit' });
}

/* extension/ (the source tree) is NOT loadable unpacked since 7b: its content
   files carry ES-module import/export and MV3 content_scripts are ALWAYS
   classic in Chrome (there is no content_scripts "type" key — verified against
   BCD and Chrome 145: a planted value is ignored). Only the WXT bundle
   (.output/chrome-mv3) is a loadable extension. Fail fast + honestly instead
   of letting probe failures obscure the reason. */
if (EXT_DIR.replace(/[\/]$/, '') === join(ROOT, 'extension')) {
  console.log('[FAIL] extension/ is source data, not a loadable extension (content files are ES modules; MV3 content_scripts are always classic). Drop HLX_EXT_DIR to build+test .output/chrome-mv3.');
  process.exit(1);
}
const CHROME = process.env.HLX_CHROME || '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const CDP_PORT = 9340 + Math.floor(Math.random() * 40); /* random port — zombies from a previous run must not hold us hostage */
const SITE_PORT = 8079;
const SITE = `http://127.0.0.1:${SITE_PORT}/`;
const PROFILE = '/tmp/hlx-theme-profile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[e2e-theme]', ...a);
const fail = (...a) => console.log('[FAIL]', ...a);

const INDEX_HTML = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
<title>مقاله آزمایشی تم هایلایتر</title>
<style>body{font-family:sans-serif;max-width:680px;margin:40px auto;line-height:2;direction:rtl}
h1{color:#333}p{color:#222;font-size:17px}</style></head><body>
<h1>مقاله آزمایشی برای تم ویجت‌های وب هایلایتر</h1>
<p>این متن اول برای انتخاب و هایلایت کردن است و باید به‌سادگی با ماوس انتخاب شود.</p>
<p>این متن دوم برای باز کردن پاپ‌اور یادداشت است و روی آن کلیک می‌کنیم.</p>
<p>این متن سوم صرفاً برای طولانی‌تر شدن صفحه است تا رفتار اسکرول هم قابل ارزیابی باشد.</p>
</body></html>`;

Bun.serve({
  port: SITE_PORT,
  fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === '/' || u.pathname === '/index.html') return new Response(INDEX_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    return new Response('not found', { status: 404 });
  },
});

/* ---------- real Chrome + real extension ---------- */
const args = [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`,
  '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', '--window-size=1280,900', 'about:blank',
];

/* fresh profile every run: chrome.storage (theme cycle etc.) persists in the
   profile and the probes assume a fresh 'auto' start — stale state walks the
   cycle one step off (observed: runs failing in sequence, passing after /tmp cleanup) */
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}

const chrome = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => { /* noise */ });

let wsInfo;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) { wsInfo = await r.json(); break; } } catch {}
}
if (!wsInfo) { fail('CDP never came up'); chrome.kill(); process.exit(1); }
log('chrome up:', wsInfo.Browser);

/* ---------- raw CDP client ---------- */
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

/** screenshot with retry (the composer is sometimes not ready on the first try) */
async function shot(sessionId, file) {
  for (let i = 0; i < 3; i++) {
    try {
      /* hard cap per attempt — a hung composer must not hang the whole run */
      const s = await Promise.race([
        browser.send('Page.captureScreenshot', { format: 'png' }, sessionId),
        new Promise((_, rej) => setTimeout(() => rej(new Error('capture timeout')), 8000)),
      ]);
      writeFileSync(join(HERE, file), Buffer.from(s.data, 'base64'));
      return true;
    } catch (e) { log('screenshot retry', file, String(e && e.message || e)); await sleep(1500); }
  }
  fail('screenshot failed:', file);
  return false;
}

/* ---------- find the extension ID ----------
   only from the extension's own target (background/service-worker.js) — the
   sandbox also ships other preinstalled extensions (thunk.js / background.js)
   with foreign IDs that yield ERR_FILE_NOT_FOUND. */
let extId = null;
/* candidate SWs: dev-tree layout (background/service-worker.js) and the
   WXT-bundled layout (background.js — collides with sandbox's foreign
   extensions, so each candidate is CONFIRMED by evaluating an HL sentinel). */
for (let i = 0; i < 40 && !extId; i++) {
  const { targetInfos } = await browser.send('Target.getTargets');
  const cands = targetInfos.filter((t) => t.url.startsWith('chrome-extension://') &&
    (t.url.includes('background/service-worker.js') || t.url.endsWith('/background.js')));
  for (const c of cands) {
    try {
      const { sessionId } = await browser.send('Target.attachToTarget', { targetId: c.targetId, flatten: true });
      const ours = await evalIn(sessionId, 'typeof HL !== "undefined" && typeof HL.createStore === "function"');
      if (ours === true) { extId = c.url.split('/')[2]; break; }
    } catch (e) { /* foreign extension — ignore */ }
  }
  if (!extId) await sleep(600);
}
if (!extId) { fail('extension did not load'); chrome.kill(); process.exit(1); }
log('extension loaded, id =', extId);

/* ---------- site tab (real content script) ---------- */
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
const injected = await evalIn(S, '!!document.querySelector("div[data-hlx-ui]")', false);
log('site loaded, content script injected:', injected);

/* ---------- the extension's real popup tab (with retry against startup races) ---------- */
const POPUP_URL = `chrome-extension://${extId}/popup/popup.html`;
const { targetId: popT } = await browser.send('Target.createTarget', { url: POPUP_URL });
const pop = await browser.send('Target.attachToTarget', { targetId: popT, flatten: true });
const P = pop.sessionId;
await browser.send('Page.enable', {}, P);
await browser.send('Runtime.enable', {}, P);

let popupReady = false;
for (let attempt = 0; attempt < 4 && !popupReady; attempt++) {
  for (let i = 0; i < 8 && !popupReady; i++) {
    const ok = await evalIn(P, 'document.readyState === "complete" && !!document.getElementById("btn-theme")', false);
    if (ok === true) { popupReady = true; break; }
    await sleep(500);
  }
  if (!popupReady) {
    log(`popup tab not ready (attempt ${attempt + 1}) — re-navigating`);
    try { await browser.send('Page.navigate', { url: POPUP_URL }, P); } catch (e) { /* noop */ }
    await sleep(1200);
  }
}
log('real popup page ready:', popupReady);

/* hook: a real click on the popup's theme cycle button (the real popup.js handler) —
   the handler is async (awaits setSettings), so we read the result one tick later */
async function clickThemeButton() {
  await evalIn(P, 'document.getElementById("btn-theme").click(), true', false);
  await sleep(350);
  const r = await evalIn(P, 'document.documentElement.getAttribute("data-theme") || "auto"', false);
  return typeof r === 'string' ? r : JSON.stringify(r);
}

/* ---------- 1) theme cycle from the popup: auto → light → dark ---------- */
const afterLight = await clickThemeButton();
await sleep(300);
const afterDark = await clickThemeButton();
await sleep(700); /* propagation of chrome.storage.onChanged to the site tab's content script */
const storageTheme = await evalIn(P, '(async () => { try { const o = await chrome.storage.local.get("hlx:settings"); return (o && o["hlx:settings"] && o["hlx:settings"].theme) || "MISSING"; } catch (e) { return "ERR"; } })()');
log(`popup cycle: → ${afterLight} → ${afterDark} | storage.theme = ${storageTheme}`);

/* live flip of the hosts in the site tab (before any interaction) */
const hostFlipLive = await evalIn(S, `(() => { const themes = []; for (const h of document.querySelectorAll('div[data-hlx-ui]')) themes.push(h.getAttribute('data-theme')); return themes; })()`, false);
log('site widget hosts after popup clicks:', JSON.stringify(hostFlipLive));

/* ---------- 2) real text selection → dark toolbar ---------- */
async function dragSelect() {
  const rect = await evalIn(S, `(() => { const p = document.querySelectorAll('p')[0]; const r = p.getBoundingClientRect(); return { x1: r.left + r.width*0.2, y: r.top + r.height/2, x2: r.left + r.width*0.8 }; })()`, false);
  await mouse(S, 'mousePressed', rect.x1, rect.y);
  for (let s = 1; s <= 12; s++) {
    await mouse(S, 'mouseMoved', rect.x1 + (rect.x2 - rect.x1) * (s / 12), rect.y);
    await sleep(40);
  }
  await mouse(S, 'mouseReleased', rect.x2, rect.y);
  await sleep(900);
}
async function toolbarInfo() {
  return evalIn(S, `(() => {
    for (const h of document.querySelectorAll('div[data-hlx-ui]')) {
      const tb = h.shadowRoot && h.shadowRoot.querySelector('.hlx-tb');
      if (!tb || tb.style.display === 'none') continue;
      const cs = getComputedStyle(tb);
      return { theme: h.getAttribute('data-theme'), bg: cs.backgroundColor, color: cs.color,
               btn: (() => { const b = tb.querySelector('button[data-color="green"]'); const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })() };
    }
    return null;
  })()`, false);
}
await dragSelect();
const tb1 = await toolbarInfo();
log('toolbar dark:', JSON.stringify(tb1));
await shot(S, 'real-theme-toolbar-dark.png');

/* ---------- 3) green click → mark → click on the mark → dark popover ---------- */
if (tb1 && tb1.btn) {
  await mouse(S, 'mousePressed', tb1.btn.x, tb1.btn.y);
  await mouse(S, 'mouseReleased', tb1.btn.x, tb1.btn.y);
  await sleep(1000);
}
const markInfo = await evalIn(S, `(() => {
  const m = document.querySelector('mark.hlx-marker');
  if (!m) return null;
  const cr = m.getClientRects()[0] || m.getBoundingClientRect();
  return { text: m.textContent.slice(0, 30), x: cr.left + cr.width/2, y: cr.top + cr.height/2 };
})()`, false);
log('mark created:', JSON.stringify(markInfo));

await evalIn(S, 'window.getSelection().removeAllRanges(), true', false);
if (markInfo) {
  await mouse(S, 'mousePressed', markInfo.x, markInfo.y);
  await mouse(S, 'mouseReleased', markInfo.x, markInfo.y);
  await sleep(1000);
}
const poDark = await evalIn(S, `(() => {
  for (const h of document.querySelectorAll('div[data-hlx-ui]')) {
    const po = h.shadowRoot && h.shadowRoot.querySelector('.hlx-po');
    if (!po || po.style.display === 'none') continue;
    const cs = getComputedStyle(po);
    return { theme: h.getAttribute('data-theme'), bg: cs.backgroundColor, color: cs.color };
  }
  return null;
})()`, false);
log('popover dark:', JSON.stringify(poDark));
await shot(S, 'real-theme-popover-dark.png');

/* ---------- 4) live flip: popover open + theme click in the other tab's popup (dark → auto) ---------- */
const flippedTo = await clickThemeButton(); /* dark → auto (headless system is light) */
await sleep(1000);
const poAfter = await evalIn(S, `(() => {
  for (const h of document.querySelectorAll('div[data-hlx-ui]')) {
    const po = h.shadowRoot && h.shadowRoot.querySelector('.hlx-po');
    if (!po || po.style.display === 'none') continue;
    const cs = getComputedStyle(po);
    return { stillOpen: true, theme: h.getAttribute('data-theme'), bg: cs.backgroundColor, color: cs.color };
  }
  return { stillOpen: false };
})()`, false);
log(`live flip (popup: dark → ${flippedTo}):`, JSON.stringify(poAfter));
await shot(S, 'real-theme-popover-flipped.png');

/* ---------- 5) boot path: dark theme → reload the site → toolbar dark from the start ---------- */
const afterDark2 = await clickThemeButton(); /* auto → light */
await sleep(200);
const afterDark3 = await clickThemeButton(); /* light → dark */
await sleep(300);
await browser.send('Page.navigate', { url: SITE }, S);
for (let i = 0; i < 30; i++) {
  const ready = await evalIn(S, 'document.readyState === "complete" && !!document.querySelector("div[data-hlx-ui]")', false);
  if (ready === true) break;
  await sleep(400);
}
await sleep(800);
await dragSelect();
const tb2 = await toolbarInfo();
log(`boot path (popup: → ${afterDark2} → ${afterDark3}), toolbar after reload:`, JSON.stringify(tb2));
await shot(S, 'real-theme-toolbar-boot-dark.png');

/* ---------- summary ---------- */
const summary = {
  extensionLoaded: !!extId,
  contentScriptInjected: injected === true,
  popupPageReady: popupReady === true,
  popupCycle: { afterLight, afterDark, storageTheme, finalCycle: [afterDark2, afterDark3] },
  hostsFlippedLive: (hostFlipLive || []).every((t) => t === 'dark') && (hostFlipLive || []).length >= 2,
  toolbarThemedDarkLive: !!tb1 && tb1.theme === 'dark' && String(tb1.bg).includes('17, 24, 39'),
  toolbarPaletteDark: tb1 ? [tb1.bg, tb1.color] : null,
  markCreated: !!markInfo,
  popoverThemedDark: !!poDark && poDark.theme === 'dark' && String(poDark.bg).includes('31, 41, 55'),
  popoverPaletteDark: poDark ? [poDark.bg, poDark.color] : null,
  liveFlip: {
    to: flippedTo,
    popoverStillOpen: !!poAfter && poAfter.stillOpen === true,
    flippedToLight: !!poAfter && poAfter.stillOpen && !poAfter.theme && String(poAfter.bg).includes('255, 255, 255'),
  },
  bootPathToolbarDark: !!tb2 && tb2.theme === 'dark' && String(tb2.bg).includes('17, 24, 39'),
};
writeFileSync(join(HERE, 'real-theme-report.json'), JSON.stringify(summary, null, 2));
log('SUMMARY:', JSON.stringify(summary, null, 2));

/* hard gate (7b-3): these were informational — the rig reported exit 0 while
   the source-tree content script never injected (module files injected as
   classic scripts). Core product probes must hold in BOTH layouts: the WXT
   bundle (.output) and the extension/ source tree. */
const required = {
  extensionLoaded: summary.extensionLoaded,
  contentScriptInjected: summary.contentScriptInjected,
  popupPageReady: summary.popupPageReady,
  popupCycleOk: summary.popupCycle.afterLight === 'light' && summary.popupCycle.afterDark === 'dark',
  hostsFlippedLive: summary.hostsFlippedLive,
  toolbarThemedDarkLive: summary.toolbarThemedDarkLive,
  markCreated: summary.markCreated,
  popoverThemedDark: summary.popoverThemedDark,
  bootPathToolbarDark: summary.bootPathToolbarDark,
};
const missingProbes = Object.entries(required).filter(([, ok]) => !ok).map(([k]) => k);
chrome.kill();
if (missingProbes.length) { fail('required probes failed:', missingProbes.join(', ')); process.exit(1); }
process.exit(0);

