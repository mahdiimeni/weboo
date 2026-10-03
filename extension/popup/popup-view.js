/**
 * Web Highlighter — popup view layer (DOM rendering, no state, no storage)
 *
 * SRP/MVC (the same trio the dashboard uses since v1.1.0): this module only
 * renders. Policy lives in popup-data.js (HL.pop) and orchestration (chrome,
 * storage, events) in popup.js. Unlike dashboard-view.js, which builds into
 * containers it creates itself, the popup renders into the page's static
 * markup — so every function receives the controller's els map (the same
 * injection style as view.toast(els.toasts, …) in dashboard.js); there is no
 * getElementById here.
 * DOM widgets come from HL.domkit and display formats from HL.format; the
 * view-owned icon constants (ICON_NOTE, THEME_ICON) live here.
 * Text is rendered only via textContent (XSS-safe against web page content);
 * innerHTML is used only for our own constant icon strings.
 * Dependencies (script order): shared/constants.js, shared/format.js,
 * shared/domkit.js, popup-data.js, popup-view.js → popup.js.
 */
import { THEMES } from "../shared/constants.js";
import { format } from "../shared/format.js";
import { domkit } from "../shared/domkit.js"; /* 7c-3 */
(function () {
  'use strict';
  var HL = (globalThis.HL = globalThis.HL || {});
  /* Module guard — same convention as the popup controller: HL rides on
     globalThis (in a real page window === globalThis; globalThis also works
     in unit tests) */
  
  /* ---------- Shared widgets (aliases — single implementation in HL.format/HL.domkit) ---------- */

  const el = domkit.el;
  const faNum = format.faNum;
  const dotColorOf = format.dotColorOf;

  /* StickyNote icon — our own constant string (innerHTML only for constants) */
  const ICON_NOTE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9l7-7V5a2 2 0 0 0-2-2Z"/><path d="M14 21v-4a2 2 0 0 1 2-2h4"/></svg>';

  /* Theme-state icons — our own constant strings (innerHTML only for constants) */
  const THEME_ICON = {
    auto: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
    light: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    dark: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
  };

  /* Module-local transient timers (one popup instance per document) */
  let toastTimer = null;
  let msgTimer = null;

  /* ---------- Render modes (section visibility) ---------- */

  function setVersion(els, ver) {
    els.ver.textContent = 'v' + ver;
  }

  /** Only the unsupported card — the footer's dashboard button stays hidden with it */
  function showUnsupported(els) {
    els.secUnsupported.hidden = false;
    els.secGeneric.hidden = true;
    els.secPage.hidden = true;
    els.secToggle.hidden = true;
    els.secList.hidden = true;
    els.secEmpty.hidden = true;
    els.foot.hidden = true; /* the dashboard button lives inside that card */
  }

  /** Generic mode (no tab URL) — footer visible */
  function showGeneric(els) {
    els.secGeneric.hidden = false;
    els.secUnsupported.hidden = true;
    els.secPage.hidden = true;
    els.secToggle.hidden = true;
    els.secList.hidden = true;
    els.secEmpty.hidden = true;
    els.foot.hidden = false;
  }

  /** Page mode — sec-list/sec-empty are owned by renderList */
  function showPage(els) {
    els.secPage.hidden = false;
    els.secToggle.hidden = false;
    els.secGeneric.hidden = true;
    els.secUnsupported.hidden = true;
    els.foot.hidden = false;
  }

  /** (n) — the generic card's total counter (Persian digits) */
  function setGenericTotal(els, n) {
    els.gTotal.textContent = faNum(n);
  }

  /* ---------- Page card ---------- */

  /**
   * card = { title, host, favicon } — host is the raw host ('' for file://),
   * so faviconLetter's fallback letter stays exact; the display label falls
   * back to «فایل محلی» (the controller computes the same hostLabel for the
   * site-toggle row). favicon is the dataURL captured from the page itself
   * (hlx:f:<host>); without it the first letter stays (fallback).
   */
  function fillPageCard(els, card) {
    const host = String((card && card.host) || '');
    const hostLabel = host || 'فایل محلی';
    els.pageTitle.textContent = format.excerpt((card && card.title) || hostLabel, 60) || hostLabel;
    els.pageHost.textContent = hostLabel;
    els.fl.textContent = format.faviconLetter(host);
    domkit.mountFavicon(els.fl, (card && card.favicon) || null);
  }

  /** sum = HL.pop.summarize(recs) → { total, notes } (Persian digits) */
  function setChips(els, sum) {
    els.chipHl.textContent = faNum(sum.total) + ' هایلایت';
    els.chipNote.textContent = faNum(sum.notes) + ' یادداشت';
  }

  /**
   * THE v1.2.8 CONTRACT — precise smart-direction scope (decision: HL.pop.directionOf).
   * 'ltr' → only "the page's own content" flips: the page card (favicon/title/host)
   * and the list items (ul#hl-list). The Persian header of the list section
   * («هایلایت‌های این صفحه» + counter) never gets dir — Persian UI, RTL layout.
   * sec-list is never touched either. RTL takes no attribute at all (rtl
   * inheritance of the document).
   */
  function applyCardDirection(els, dir) {
    if (dir === 'ltr') {
      els.secPage.setAttribute('dir', 'ltr');
      els.hlList.setAttribute('dir', 'ltr');
    } else {
      els.secPage.removeAttribute('dir');
      els.hlList.removeAttribute('dir');
    }
  }

  /* ---------- Highlight list ---------- */

  /**
   * items: HL.pop.visibleItems(recs, cap); label: HL.pop.countLabel(shown, total).
   * handlers: { onOpen(rec) } — the controller's gotoRec, injected per item
   * (the view never decides what a click does).
   */
  function renderList(els, items, label, handlers) {
    els.hlList.textContent = '';
    if (!items.length) {
      els.secList.hidden = true;
      els.secEmpty.hidden = false;
      return;
    }
    els.secEmpty.hidden = true;
    els.secList.hidden = false;
    els.listCount.textContent = label;
    items.forEach(function (rec) { els.hlList.appendChild(buildItem(rec, handlers)); });
  }

  /** One highlight row — click/Enter/Space → handlers.onOpen(rec) */
  function buildItem(rec, handlers) {
    const li = el('li', 'hl-item');
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.title = 'پرش به این هایلایت';

    const dot = el('span', 'dot');
    dot.style.background = dotColorOf(rec.color);

    const txt = el('span', 'txt');
    const line = el('p', 'hl-text');
    line.textContent = format.excerpt(rec.text, 80);

    const meta = el('span', 'hl-meta');
    const date = el('span', 'date');
    date.textContent = format.fmtDateTime(rec.updatedAt || rec.createdAt);
    meta.appendChild(date);
    if (rec.note) {
      const ic = el('span', 'note-ic');
      ic.innerHTML = ICON_NOTE; /* our own constant */
      ic.title = 'دارد یادداشت';
      meta.appendChild(ic);
    }

    txt.appendChild(line);
    txt.appendChild(meta);
    li.appendChild(dot);
    li.appendChild(txt);

    const go = function () { handlers.onOpen(rec); };
    li.addEventListener('click', go);
    li.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    return li;
  }

  /* ---------- Site toggle ---------- */

  function setSwitch(els, on) {
    els.toggle.setAttribute('aria-checked', String(!!on));
  }

  /** "Applied" confirmation next to the toggle — hidden again after 2400ms */
  function showApplied(els) {
    if (!els.toggleMsg) return;
    els.toggleMsg.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { els.toggleMsg.hidden = true; }, 2400);
  }

  /* ---------- Toast ---------- */

  /** The single toast div — 2600ms */
  function toast(els, msg, type) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.className = 'toast show ' + (type || 'success');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.className = 'toast'; }, 2600);
  }

  /* ---------- Theme button ---------- */

  /** key: valid theme key (HL.pop.validTheme) — label from the HL.THEMES registry */
  function renderThemeBtn(els, key) {
    if (!els.btnTheme) return;
    els.btnTheme.title = 'قالب: ' + THEMES[key].label;
    els.btnTheme.setAttribute('aria-label', 'تغییر قالب (' + THEMES[key].label + ')');
    els.btnTheme.innerHTML = THEME_ICON[key]; /* our own constant */
  }

  HL.popView = {
    setVersion: setVersion,
    showUnsupported: showUnsupported,
    showGeneric: showGeneric,
    showPage: showPage,
    setGenericTotal: setGenericTotal,
    fillPageCard: fillPageCard,
    setChips: setChips,
    applyCardDirection: applyCardDirection,
    renderList: renderList,
    buildItem: buildItem,
    setSwitch: setSwitch,
    showApplied: showApplied,
    toast: toast,
    renderThemeBtn: renderThemeBtn
  };
})();

/* identity export (7c-3) */
export const popView = globalThis.HL.popView;
