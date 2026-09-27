/**
 * Web Highlighter — dashboard view layer (DOM builders, no state, no storage)
 *
 * SRP/MVC: this module only "builds" — where data comes from and what happens
 * after a click is the controller's (dashboard.js) concern, injected into these
 * builders via handlers. There is no getElementById/save/remove here.
 * DOM widgets come from HL.domkit and display formats from HL.format.
 * Text is rendered only via textContent/createTextNode (XSS-safe against web
 * page content); innerHTML is used only for our own constant icon strings.
 *
 * Direction contracts: the group card frame follows the title+texts policy
 * (g.dir, v1.2.6); each item's quote (.item-text) carries its own per-text
 * direction (v1.2.12); each note ROW (.note: icon + text) carries its own
 * direction from the note's language (v1.2.13) — the text inherits the row;
 * the dashboard's own Persian chrome strings (count capsules, item dates,
 * cut-off notices) always render in their own isolated RTL context (v0.5.2)
 * — faEl below is that rule.
 *
 * Article tags (v1.2.15): buildGroupCard renders the article's own tag chips
 * (.group-tags) — a row under the header that stays visible when the card is
 * collapsed (tags are article metadata, not highlight content). It lives
 * OUTSIDE the toggle surface (.group-head): no stopPropagation juggling, no
 * interactive content nested in the header's role=button. Add/remove are
 * injected via handlers (onAddTag/onRemoveTag); the inline add input is a
 * per-card micro state machine owned by this builder (idle ⇄ editing).
 *
 * Direction sections (v0.2.0): buildDirSection wraps the (unchanged) group
 * cards in per-direction containers — a quiet header (arrow icon + Persian
 * label + article count) and, on the section that holds the most-recently-
 * highlighted article, the «آخرین هایلایت» badge that explains WHY it renders
 * first. The direction DECISION (which section leads) is the data layer's
 * (dash.leadDir) — this builder only PRESENTS a computed section; per-card
 * state stays injected via ui.cardUi (DIP: collapsedGroups never reaches here).
 *
 * Collapsible direction sections (v0.5.0): the section header is the section's
 * toggle — the exact interaction contract the group-card head gives the card,
 * one level up. ui.collapsed (controller-injected, DIP) decides the initial
 * state; a click / Enter / Space flips the DOM locally (collapsed class +
 * body hidden + aria-expanded — no re-render, the onToggle mirror) and asks
 * the controller to sync its collapsedSections set via handlers.
 * onSectionToggle(dir, willCollapse). Without the handler the head still
 * toggles its own DOM (state display is the view's job — the sync is the
 * optional part; the same progressive-enhancement contract buildOrderBtn
 * gives its pill). A rotating chevron (.dir-sec-chev) carries the affordance.
 *
 * Per-card item order (v0.4.0): each group card's header carries the order
 * pill (.order-btn) — it presents the card's CURRENT highlight order (the
 * ui.order presentation key dash.itemOrder derives from base sort + flip
 * flag) and a click asks the controller to flip it (handlers.onItemOrder).
 * Hidden when the card holds fewer than two highlights (nothing to flip);
 * without the handler it renders inert (older test contexts — progressive
 * enhancement, the same contract buildTagsRow gives its add-chip).
 *
 * Preview window head + meta (v0.6.3): the full-text modal's title is the
 * article's OWN title (fillHighlightTitle over the shared articleTitleOf
 * chain — the exact policy the card header uses, DRY), and its meta line is
 * date/time only (the color name dropped — the .cbar bar carries the color).
 * Direction sections renamed to the alignment vocabulary: «راست‌چین‌ها» /
 * «چپ‌چین‌ها» — same keys, same registry, shorter labels.
 *
 * Fully-smart preview window (v0.6.4): the modal's CARD FRAME now carries the
 * record's own direction (fillHighlightDir — detectTextDir over the highlight
 * text, the window's subject; neutral inherits the doc's rtl), so the whole
 * window — title alignment, base flow, scrollbar side, logical paddings —
 * reads in the direction of the content it shows, while every text keeps its
 * per-text direction and the fa date rides as an INLINE RTL island inside a
 * frame-flow row (.hl-meta > .hl-meta-t — the .item-date idiom: aligned by
 * the frame, ordered by the language). The X button is gone (the owner's
 * call): the overlay click and Escape close; the card itself is the focus
 * anchor (dashboard.html tabindex="-1").
 */
(function () {
  'use strict';
  var HL = (globalThis.HL = globalThis.HL || {});
  var dash = HL.dash;
  var el = HL.domkit.el;
  var txtNode = HL.domkit.txtNode;

  /* Our own constant icons — the only place innerHTML is used */
  var ICONS = {
    x: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    view: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    quote: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1Z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    /* Direction arrows (v0.2.0) — the reading direction of a section's articles:
       → left-to-right (Latin & co), ← right-to-left (Persian/Arabic/Hebrew). */
    arrowLtr: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/></svg>',
    arrowRtl: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="12" x2="4" y2="12"/><polyline points="10 6 4 12 10 18"/></svg>',
    /* Bulk toggle (v0.3.0) — double chevrons, the same family as the single
       card chev: down = open every card, up = close them all. */
    chevsDown: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 7 12 13 18 7"/><polyline points="6 13 12 19 18 13"/></svg>',
    chevsUp: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 13 12 7 18 13"/><polyline points="6 19 12 13 18 19"/></svg>',
    /* Per-card item order (v0.4.0) — the classic opposing vertical arrows:
       one glyph covers both directions; the pill's label carries the state. */
    sort: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/></svg>'
  };

  function iconBtn(icon, title, cls) {
    var b = el('button', 'icon-btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = ICONS[icon]; /* our own constant */
    return b;
  }

  /** Two-step confirmation: first click → «مطمئنی؟», second click → run */
  function armButton(btn, confirmText, action) {
    var origHTML = btn.innerHTML;
    var armed = false;
    var timer = null;
    var reset = function () {
      armed = false;
      clearTimeout(timer);
      btn.classList.remove('armed');
      btn.innerHTML = origHTML; /* our own stored constant */
      btn.removeAttribute('aria-pressed');
    };
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (!armed) {
        armed = true;
        btn.classList.add('armed');
        btn.setAttribute('aria-pressed', 'true');
        btn.textContent = confirmText;
        timer = setTimeout(reset, 3200);
        return;
      }
      clearTimeout(timer);
      reset();
      action();
    });
  }

  /* ---------- Persian chrome text (v0.5.2) ---------- */

  /**
   * The dashboard's own UI strings — count capsules («N هایلایت» /
   * «N یادداشت»), item dates (always fa-IR) and cut-off notices — are ALWAYS
   * Persian, while their host card may be either direction (the v1.2.6 smart
   * card). Persian is mixed-directional content (Persian digits + words +
   * neutral punctuation), so inside an LTR card the bidi algorithm scrambles
   * it: the number jumps to the far side of the word, mirrored brackets flip.
   * Every chrome string renders in its own isolated RTL context instead: an
   * UNCONDITIONAL dir="rtl" (the browser isolates dir attributes) — a no-op
   * inside an RTL card and a correct RTL island inside an LTR one. The same
   * context-independent idiom the per-text quote/note directions established
   * (v1.2.12), with the decision even simpler: the chrome's language is fixed,
   * so there is nothing to detect (and detectTextDir stays reserved for USER
   * content, where the language genuinely varies).
   */
  function faEl(tag, cls, text) {
    var n = el(tag, cls);
    n.setAttribute('dir', 'rtl');
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- Toast ---------- */

  function toast(container, msg, type) {
    var t = el('div', 'toast ' + (type || 'success'));
    t.textContent = msg;
    t.setAttribute('role', 'status');
    container.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 3200);
  }

  /* ---------- Article tags row (v1.2.15) ---------- */

  /**
   * The article's own categorization chips — under the header, visible even
   * when the card is collapsed. Chips render the tag text (XSS-safe textNode
   * in a .atag-t span with ellipsis) + a remove button; the dashed add chip
   * swaps into an inline text input (Enter commits via handlers.onAddTag,
   * Escape/blur cancels; whitespace-only input is never submitted — full
   * validation and the Persian toasts are the controller's job). The row
   * itself always renders; without the handlers the chips are read-only
   * (older test contexts keep passing untouched).
   *
   * Direction intelligence (v0.6.2): direction sits at TWO granularities, each
   * on the element it governs. The CHIP is Persian chrome — where the X sits,
   * which side carries the wide padding — so it takes an UNCONDITIONAL
   * dir="rtl" (the v0.5.2 faEl rule): the X stays at the reading-flow END
   * (the left) and the pill keeps one shape whatever the tag's language or
   * the card's direction is — an English tag reads [× frontend] exactly like
   * a Persian one reads [× طراحی] (the owner-confirmed v0.6.2 contract: a
   * per-text chip direction put the English tag's X at the reading START —
   * the reported swap). The tag TEXT is user content — its own direction
   * (dash.detectTextDir, the same single decision source every content
   * surface reads) moves to the .atag-t LABEL, the exact idiom quotes
   * (.item-text) and note rows (.note) already use: 'ltr' keeps multi-word
   * Latin tags and their trailing punctuation in order inside the RTL chip,
   * 'rtl' is explicit, and neutral tags (no strong letters) inherit the
   * chip's rtl — the v1.2.12 "same text, same direction, everywhere"
   * invariant at label granularity. The add button «+ برچسب» is Persian
   * CHROME — the v0.5.2 faEl rule: an unconditional dir="rtl" (nothing to
   * detect — the chrome's language is fixed), so the plus icon sits at the
   * start edge and the word flows after it identically in LTR and RTL
   * cards. The inline input takes dir="auto": typing-time first-strong
   * detection — the tag being typed may be either language (placeholder
   * stays centered, v0.5.2).
   */
  function buildTagsRow(g, handlers) {
    var onAddTag = (handlers && handlers.onAddTag) || null;
    var onRemoveTag = (handlers && handlers.onRemoveTag) || null;
    var row = el('div', 'group-tags');

    (g.tags || []).forEach(function (t) {
      /* The pill is chrome (faEl — X at the reading end, one shape everywhere);
         the label is content (its own direction, like every quote and note) */
      var chip = faEl('span', 'atag');
      chip.title = t;
      var label = el('span', 'atag-t');
      var labelDir = dash.detectTextDir(t);
      if (labelDir) label.setAttribute('dir', labelDir);
      label.textContent = t;
      chip.appendChild(label);
      if (onRemoveTag) {
        var x = el('button', 'atag-x');
        x.type = 'button';
        x.title = 'حذف برچسب ' + t;
        x.setAttribute('aria-label', 'حذف برچسب ' + t);
        x.innerHTML = ICONS.x; /* our own constant */
        x.addEventListener('click', function () { onRemoveTag(g, t); });
        chip.appendChild(x);
      }
      row.appendChild(chip);
    });

    if (!onAddTag) return row;

    var addBtn = el('button', 'atag-add');
    addBtn.type = 'button';
    addBtn.title = 'افزودن برچسب به این مقاله';
    addBtn.setAttribute('aria-label', 'افزودن برچسب به این مقاله');
    addBtn.setAttribute('dir', 'rtl'); /* Persian chrome — its own RTL context (v0.6.1) */
    addBtn.innerHTML = ICONS.plus; /* our own constant */
    addBtn.appendChild(txtNode('برچسب'));

    function openTagInput() {
      var inp = el('input', 'tag-input');
      inp.type = 'text';
      inp.maxLength = HL.TAG_MAX_LEN;
      inp.setAttribute('dir', 'auto'); /* typing-time first-strong (v0.6.1) */
      inp.placeholder = 'نام برچسب…';
      inp.setAttribute('aria-label', 'نام برچسب جدید');
      var closed = false;
      function close() {
        if (closed) return;
        closed = true;
        if (inp.parentNode) inp.parentNode.replaceChild(addBtn, inp);
      }
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          var v = String(inp.value || '').trim();
          close();
          if (v) onAddTag(g, v);
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          close();
        }
      });
      inp.addEventListener('blur', function () { close(); });
      row.replaceChild(inp, addBtn);
      try { inp.focus(); } catch (e) { /* noop */ }
    }

    addBtn.addEventListener('click', openTagInput);
    row.appendChild(addBtn);
    return row;
  }

  /* ---------- Per-card item order (v0.4.0) ---------- */

  /* Persian presentation of the four order keys (dash.itemOrder's output):
     the CURRENT order of that article's highlights — the pill always shows
     what IS, and the tooltip promises the flip. Labels are the view's (LSP —
     the data layer only decides the key). */
  var ITEM_ORDER_META = {
    newest: {
      label: 'جدیدترین',
      title: 'ترتیب فعلی هایلایت‌ها: از جدیدترین به قدیمی‌ترین — برای تغییر ترتیب، این دکمه را بزن'
    },
    oldest: {
      label: 'قدیمی‌ترین',
      title: 'ترتیب فعلی هایلایت‌ها: از قدیمی‌ترین به جدیدترین — برای تغییر ترتیب، این دکمه را بزن'
    },
    page: {
      label: 'صفحه',
      title: 'ترتیب فعلی هایلایت‌ها: به ترتیب قرارگیری در متن صفحه — برای تغییر ترتیب، این دکمه را بزن'
    },
    'page-rev': {
      label: 'برعکسِ صفحه',
      title: 'ترتیب فعلی هایلایت‌ها: برعکسِ ترتیب قرارگیری در متن صفحه — برای تغییر ترتیب، این دکمه را بزن'
    }
  };

  /**
   * The card's order pill: [label ⇅] — CURRENT-order label + icon. Built
   * inline by buildGroupCard (the header is rebuilt from scratch on every
   * render, so no idempotent re-render dance is needed — unlike the static
   * #btn-bulk). Clicks stopPropagation AND the header's own click guard skips
   * every button, so flipping the order never collapses the card. Without
   * handlers.onItemOrder the pill stays a plain inert state chip (test
   * contexts — the controller always provides the handler).
   *
   * Direction (v0.6.2): the pill is Persian CHROME — «جدیدترین» is a fixed
   * Persian label and the icon is a fixed symbol — so it takes an
   * UNCONDITIONAL dir="rtl" (the v0.5.2 faEl rule, the same one the count
   * capsules and «+ برچسب» already follow). The button was born in v0.4.0,
   * BEFORE that rule existed, and the v0.5.2 sweep missed it: inside an LTR
   * card it inherited ltr and flipped to [icon label] — the icon jumped to
   * the opposite edge vs every RTL card's [label icon] (the owner-reported
   * swap). One arrangement everywhere now, exactly like the add chip.
   */
  function buildOrderBtn(g, order, handlers) {
    var meta = ITEM_ORDER_META[order] || ITEM_ORDER_META.newest;
    var b = el('button', 'order-btn');
    b.type = 'button';
    b.title = meta.title;
    b.setAttribute('aria-label', 'ترتیب نمایش هایلایت‌های این مقاله: ' + meta.label);
    b.setAttribute('dir', 'rtl'); /* Persian chrome — its own RTL context (v0.6.2, the faEl rule) */
    var ic = el('span', 'order-ic');
    ic.setAttribute('aria-hidden', 'true'); /* decorative — the label carries the meaning */
    ic.innerHTML = ICONS.sort; /* our own constant */
    b.appendChild(ic);
    b.appendChild(txtNode(meta.label));
    if (handlers && handlers.onItemOrder) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        handlers.onItemOrder(g);
      });
    }
    return b;
  }

  /* ---------- Shared article-title presentation (v0.6.3) ---------- */

  /**
   * ONE fallback chain for "the article's own title" (DRY): the group-card
   * header (buildGroupCard) and the preview modal's head (fillHighlightTitle)
   * present the same content the same way — title, else host, else url, else
   * the «بدون عنوان» placeholder. Works on a group g OR a record rec (both
   * carry title/host/url); presentation-only, no direction decisions here.
   */
  function articleTitleOf(src) {
    return (src && (src.title || src.host || src.url)) || 'بدون عنوان';
  }

  /* ---------- Group card (one page) ---------- */

  /**
   * g: output of dash.groupRecords (g.tags: the article's tag array, v1.2.15);
   * remaining: cut-off items (display cap)
   * ui:  { collapsed: bool, order?: 'newest'|'oldest'|'page'|'page-rev' }
   *      — order (v0.4.0): the card's CURRENT item-order presentation key
   *      (dash.itemOrder's output, injected via ui.cardUi; absent → 'newest')
   * handlers: { onOpen(g), onDeleteGroup(g), onToggle(g, willCollapse),
   *             onItemOrder(g) ← v0.4.0: flip this card's highlight order,
   *             onAddTag(g, rawTag), onRemoveTag(g, tag), onView(rec), … }
   */
  function buildGroupCard(g, remaining, ui, handlers) {
    var card = el('div', 'group' + (ui.collapsed ? ' collapsed' : ''));
    card.dataset.key = g.key;
    /* Smart card (v1.2.6): a non-RTL article → this very card becomes LTR.
       The data layer decides the direction (g.dir) — the view only applies it (DIP);
       RTL cards take no attribute and rely on the document's rtl inheritance exactly as before. */
    if (g.dir === 'ltr') card.setAttribute('dir', 'ltr');

    /* Group header */
    var head = el('div', 'group-head');
    head.setAttribute('role', 'button');
    head.tabIndex = 0;
    head.setAttribute('aria-expanded', String(!ui.collapsed));

    var fl = el('span', 'fl');
    fl.textContent = dash.faviconLetter(g.host);
    fl.title = g.host || 'فایل محلی';
    /* Real favicon — dataURL captured from the page itself (hlx:f:<host>);
       without it (old records/failed capture) the first letter stays (fallback) */
    HL.domkit.mountFavicon(fl, g.favicon || null);

    var gt = el('span', 'group-txt');
    var title = el('strong', 'group-title');
    /* the shared article-title chain (v0.6.3) — excerpted for the header row */
    title.textContent = HL.format.excerpt(articleTitleOf(g), 60) || 'بدون عنوان';
    /* Only the host part is shown (full link → tooltip) */
    var url = el('span', 'group-url');
    url.textContent = dash.displayHost(g.url || g.host);
    url.title = g.url || g.host || '';
    gt.appendChild(title);
    gt.appendChild(url);

    /* Count capsules (v0.5.2): Persian chrome — their own RTL context, so an
       LTR card frame never scrambles «۳ هایلایت» into «هایلایت ۳». */
    var chips = el('span', 'gchips');
    chips.appendChild(faEl('span', 'chip', dash.faNum(g.items.length + remaining) + ' هایلایت'));
    if (g.notes > 0) {
      chips.appendChild(faEl('span', 'chip', dash.faNum(g.notes) + ' یادداشت'));
    }

    var chev = el('span', 'chev');
    chev.innerHTML = ICONS.chev;
    chev.setAttribute('aria-hidden', 'true');

    /* Item order pill (v0.4.0) — presents the card's current highlight order
       (ui.order — controller-injected via cardUi, DIP) and flips it on click
       (handlers.onItemOrder). Only cards that CAN visually change carry it:
       fewer than two total highlights (visible + remaining) → no pill. */
    var orderBtn = (g.items.length + remaining > 1)
      ? buildOrderBtn(g, ui.order || 'newest', handlers)
      : null;

    /* Open the article link — next to the trash button */
    var openBtn = iconBtn('view', 'باز کردن این صفحه در تب جدید');
    openBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      handlers.onOpen(g);
    });

    var delBtn = iconBtn('trash', 'حذف همه‌ی این صفحه', 'danger');
    armButton(delBtn, 'مطمئنی؟', function () { handlers.onDeleteGroup(g); });

    head.appendChild(fl);
    head.appendChild(gt);
    head.appendChild(chips);
    if (orderBtn) head.appendChild(orderBtn); /* between the count chips and the collapse chevron */
    head.appendChild(chev);
    head.appendChild(openBtn);
    head.appendChild(delBtn);

    /* Items */
    var items = el('div', 'group-items');
    if (ui.collapsed) items.hidden = true;
    g.items.forEach(function (rec) { items.appendChild(buildItemCard(rec, handlers)); });

    if (remaining > 0) {
      /* Cut-off notice (v0.5.2): Persian chrome — the same RTL isolation as
         the count capsules (mixed digits/words/mirrored «» brackets above an
         LTR card frame would scramble without it). */
      items.appendChild(faEl('div', 'item-more',
        '…' + dash.faNum(remaining) + ' مورد دیگر از این صفحه (برای نمایش، «بارگذاری بیشتر» را بزن)'));
    }

    var toggle = function () {
      var willCollapse = !card.classList.contains('collapsed');
      card.classList.toggle('collapsed', willCollapse);
      items.hidden = willCollapse;
      head.setAttribute('aria-expanded', String(!willCollapse));
      handlers.onToggle(g, willCollapse);
    };
    head.addEventListener('click', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('button')) return; /* click on ANY header button (open/delete/order) → don't toggle */
      toggle();
    });
    head.addEventListener('keydown', function (ev) {
      /* Buttons inside the header (open link / delete) activate on their own with Enter/Space */
      if (ev.target && ev.target.closest && ev.target.closest('button')) return;
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggle();
      }
    });

    card.appendChild(head);
    /* Article tags row (v1.2.15) — between the header and the items, never
       hidden by the collapse state (article-level metadata, scannable at boot) */
    card.appendChild(buildTagsRow(g, handlers));
    card.appendChild(items);
    return card;
  }

  /* ---------- Direction sections (v0.2.0) ---------- */

  /* Persian labels of the two sections (v0.6.3): the alignment vocabulary the
     owner asked for — «راست‌چین‌ها» / «چپ‌چین‌ها» — still the DIRECTION of the
     articles, not a language guess (Arabic/Hebrew articles land in the same
     RTL section as Persian ones). Same registry shape, shorter labels. */
  var DIR_SECTION_LABELS = {
    rtl: 'راست‌چین‌ها',
    ltr: 'چپ‌چین‌ها'
  };

  /**
   * One direction section: a quiet header (arrow icon + label + article
   * count, and the «آخرین هایلایت» badge on the LEADING section — the one
   * holding the most-recently-highlighted article, which is why it renders
   * first) followed by that direction's cards — built by the UNCHANGED
   * buildGroupCard (the v1.2.6 smart-card frame keeps its own dir attribute).
   *
   * Collapsible (v0.5.0): the header IS the section's toggle — the group-card
   * head's interaction contract one level up. role=button + tabIndex=0 +
   * aria-expanded on the head; the section carries the `collapsed` class and
   * the body (.dir-sec-body) goes hidden; a chevron (.dir-sec-chev) rotates
   * with the state (the head lives in the document's RTL flow — one rotation
   * rule, mirroring .group.collapsed .chev). Click / Enter / Space flip the
   * DOM locally (never a re-render) and then ask the controller to sync its
   * user-owned set: handlers.onSectionToggle(dir, willCollapse).
   *
   * section: dash.splitDirSections output entry — { dir: 'rtl'|'ltr',
   *   entries: [{ group, remaining }] } (paginate's visible array verbatim).
   * ui:   { lead: bool, collapsed?: bool, cardUi(group) → { collapsed } } —
   *   collapsed (v0.5.0): whether THIS section starts hidden (controller-
   *   injected; absent → expanded, the pre-v0.5.0 default that keeps older
   *   test contexts passing untouched); cardUi is the controller-injected
   *   per-card state lookup (collapsedGroups stays a controller concern;
   *   absent cardUi → cards render expanded).
   * handlers: passed through to buildGroupCard verbatim (onOpen/onDeleteGroup/
   *   onToggle/onAddTag/onRemoveTag/onView/onCopy/onDelete) + consumed here:
   *   onSectionToggle(dir, willCollapse) — absent → the head still toggles
   *   its own DOM, only the controller sync is skipped (progressive
   *   enhancement, the buildOrderBtn contract).
   *
   * The section container deliberately takes NO dir attribute: the header
   * texts are Persian (document RTL flow) while each card below applies its
   * own direction — exactly the v1.2.6 contract, one level up. Styling hooks
   * come from the dir-rtl/dir-ltr classes.
   */
  function buildDirSection(section, ui, handlers) {
    var dir = section && section.dir === 'ltr' ? 'ltr' : 'rtl';
    var lead = !!(ui && ui.lead);
    var collapsed = !!(ui && ui.collapsed);
    var cardUi = (ui && ui.cardUi) || null;
    var onSectionToggle = (handlers && handlers.onSectionToggle) || null;

    var sec = el('section', 'dir-sec dir-' + dir + (lead ? ' lead' : '') + (collapsed ? ' collapsed' : ''));
    sec.setAttribute('aria-labelledby', 'hlx-dir-' + dir);

    var head = el('div', 'dir-sec-head');
    /* The whole header row is the toggle surface (the group-head contract):
       role/tabIndex/aria + cursor live here, the chevron shows the state. */
    head.setAttribute('role', 'button');
    head.tabIndex = 0;
    head.setAttribute('aria-expanded', String(!collapsed));

    var title = el('h2', 'dir-sec-title');
    title.id = 'hlx-dir-' + dir;
    var ic = el('span', 'dir-ic');
    ic.innerHTML = dir === 'ltr' ? ICONS.arrowLtr : ICONS.arrowRtl; /* our own constant */
    ic.setAttribute('aria-hidden', 'true');
    title.appendChild(ic);
    title.appendChild(txtNode(DIR_SECTION_LABELS[dir]));
    head.appendChild(title);

    var count = el('span', 'dir-sec-count');
    count.textContent = dash.faNum((section && section.entries || []).length) + ' مقاله';
    head.appendChild(count);

    if (lead) {
      var badge = el('span', 'dir-sec-lead');
      badge.textContent = 'آخرین هایلایت اینجاست';
      badge.title = 'تازه‌ترین مقاله‌ی هایلایت‌شده در این بخش است؛ برای همین این بخش بالاتر نمایش داده می‌شود';
      head.appendChild(badge);
    }

    /* State chevron (v0.5.0) — the same glyph family as the card chev; the
       CSS rotates it on .collapsed (the head is always in the doc's RTL flow,
       so one rule mirrors .group.collapsed .chev). */
    var chev = el('span', 'dir-sec-chev');
    chev.innerHTML = ICONS.chev; /* our own constant */
    chev.setAttribute('aria-hidden', 'true');
    head.appendChild(chev);
    sec.appendChild(head);

    var body = el('div', 'dir-sec-body');
    if (collapsed) body.hidden = true;
    (section && section.entries || []).forEach(function (v) {
      body.appendChild(buildGroupCard(v.group, v.remaining, cardUi ? cardUi(v.group) : {}, handlers));
    });
    sec.appendChild(body);

    /* Local DOM toggle + controller sync — never a re-render (the onToggle
       mirror: the view already moved, the controller only records it). */
    var toggle = function () {
      var willCollapse = !sec.classList.contains('collapsed');
      sec.classList.toggle('collapsed', willCollapse);
      body.hidden = willCollapse;
      head.setAttribute('aria-expanded', String(!willCollapse));
      if (onSectionToggle) onSectionToggle(dir, willCollapse);
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggle();
      }
    });
    return sec;
  }

  /* ---------- Item card (one highlight) ---------- */

  /**
   * handlers: { onView(rec), onCopy(rec), onDelete(rec),
   *             onPreview(rec) ← v0.6.1: open the full-text preview modal }
   *
   * Preview affordance (v0.6.1): the card shows an excerpt (200 chars) while
   * a highlight may be far longer — clicking it opens the floating window
   * with the FULL text (and note). When handlers.onPreview is present the
   * quote becomes a button-shaped surface (the group-head contract: role=
   * button + tabIndex + Enter/Space) and the note row an extra click surface
   * (mouse convenience — the modal is reachable from the quote for keyboard
   * users, one tab stop per item, no nested buttons on either surface).
   * Without the handler both stay plain text (older test contexts — LSP:
   * no role, no tab stop, no listener, nothing to click).
   */
  function buildItemCard(rec, handlers) {
    var onPreview = (handlers && handlers.onPreview) || null;
    var item = el('article', 'item');

    var bar = el('span', 'cbar');
    bar.style.background = dash.dotColorOf(rec.color);
    bar.setAttribute('aria-hidden', 'true');

    var text = el('p', 'item-text');
    /* Smart quote direction (v1.2.12): the highlight text renders in its own
       language direction — the same record text and the same decision source
       (detectTextDir) as the popover's .q, so one content keeps one direction
       across every view. Context-independent rule, unlike the popover's
       fixed-RTL window ("LTR → dir, RTL → no attribute"): a dashboard card can
       be either direction (g.dir), so BOTH branches are explicit here — RTL
       without an attribute would inherit an LTR card and break the invariant
       ("RTL always RTL, LTR always LTR"). Neutral text (no strong letters)
       takes no attribute and follows the card, exactly as before. */
    var textDir = dash.detectTextDir(rec.text);
    if (textDir) text.setAttribute('dir', textDir);
    text.textContent = HL.format.excerpt(rec.text, 200);
    if (onPreview) {
      /* "click the highlight → see its full text" (v0.6.1) — the quote is
         text-only (no nested buttons), so the group-head a11y contract is
         safe here too: role=button, one tab stop, Enter/Space open. */
      text.classList.add('peek');
      text.setAttribute('role', 'button');
      text.tabIndex = 0;
      text.title = 'نمایش متن کامل این هایلایت';
      text.addEventListener('click', function () { onPreview(rec); });
      text.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onPreview(rec);
        }
      });
    }
    item.appendChild(bar);
    item.appendChild(text);

    if (rec.note) {
      var note = el('div', 'note');
      var ic = el('span', 'note-ic');
      ic.innerHTML = ICONS.quote; /* our own constant */
      var nt = el('span', 'note-text');
      /* Smart note ROW (v1.2.13): the whole quote row — icon + text — renders
         in the note's own language direction. The attribute sits on the row
         (not the text span): flex order flips with it, so the quote icon moves
         to the row's start edge and the text inherits the row's direction —
         an LTR note inside an RTL card reads as a coherent LTR quote block
         (icon left, text left), and the mirror for an RTL note in an LTR card.
         Same decision source as every other content surface (HL.detectDir
         .detectTextDir via the dash facade) — only the granularity changed.
         Context-independent rule (v1.2.12): BOTH branches explicit; a note
         must never inherit the card's direction. Neutral text (no strong
         letters) takes no attribute: the row follows the card, exactly as
         before. The card frame (g.dir), the other items and the other notes
         are untouched — only this note's row flips. */
      var noteDir = dash.detectTextDir(rec.note);
      if (noteDir) note.setAttribute('dir', noteDir);
      nt.textContent = HL.format.excerpt(rec.note, 300);
      if (onPreview) {
        /* The note preview (300 chars) opens the same full-text window — an
           extra mouse surface, deliberately NOT a tab stop (the quote already
           is; one modal, one keyboard path per item). */
        note.classList.add('peek');
        note.title = 'نمایش متن و یادداشت کامل این هایلایت';
        note.addEventListener('click', function () { onPreview(rec); });
      }
      note.appendChild(ic);
      note.appendChild(nt);
      item.appendChild(note);
    }

    var meta = el('div', 'item-meta');
    /* fa-IR date (v0.5.2): Persian chrome — its own RTL context, so an LTR card
       frame never scrambles «۱۵ خرداد ۱۴۰۳، ۱۴:۳۰» (day-month-year order and
       the mirrored punctuation stay intact). */
    meta.appendChild(faEl('span', 'item-date', HL.format.fmtDateTime(rec.updatedAt || rec.createdAt)));

    var actions = el('div', 'item-actions');

    var viewBtn = iconBtn('view', 'مشاهده در صفحه');
    viewBtn.addEventListener('click', function () { handlers.onView(rec); });

    var copyBtn = iconBtn('copy', 'کپی متن');
    copyBtn.addEventListener('click', function () { handlers.onCopy(rec); });

    var delBtn = iconBtn('trash', 'حذف این هایلایت', 'danger');
    armButton(delBtn, 'مطمئنی؟', function () { handlers.onDelete(rec); });

    actions.appendChild(viewBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);
    meta.appendChild(actions);
    item.appendChild(meta);

    return item;
  }

  /* ---------- Color filter chips ---------- */

  /**
   * container gets filled; selected: Set of active keys; onToggle(key, active)
   */
  function buildColorChips(container, selected, onToggle) {
    container.textContent = '';
    (HL.COLOR_KEYS || []).forEach(function (k) {
      var c = HL.COLORS[k];
      var b = el('button', 'cchip');
      b.type = 'button';
      b.dataset.key = k;
      b.setAttribute('role', 'checkbox');
      b.setAttribute('aria-checked', String(selected.has(k)));
      if (selected.has(k)) b.classList.add('active');
      var dot = el('span', 'dot');
      dot.style.background = c.dot;
      b.appendChild(dot);
      b.appendChild(txtNode(c.label));
      b.addEventListener('click', function () {
        var active = !selected.has(k);
        if (active) selected.add(k); else selected.delete(k);
        b.classList.toggle('active', active);
        b.setAttribute('aria-checked', String(active));
        onToggle(k, active);
      });
      container.appendChild(b);
    });
  }

  /* ---------- Tag filter chips (toolbar — v1.2.15) ---------- */

  /**
   * container gets filled; tagList: [{tag, count}] (HL.tags.tagCounts);
   * selected: Set of active tags; onToggle(tag, active).
   * Mirrors buildColorChips (same role=checkbox pattern) — the color chips
   * filter highlights, these filter whole articles (union semantics).
   */
  function buildTagChips(container, tagList, selected, onToggle) {
    container.textContent = '';
    (tagList || []).forEach(function (t) {
      var b = el('button', 'tchip');
      b.type = 'button';
      b.dataset.tag = t.tag;
      b.setAttribute('role', 'checkbox');
      b.setAttribute('aria-checked', String(selected.has(t.tag)));
      if (selected.has(t.tag)) b.classList.add('active');
      b.appendChild(txtNode(t.tag));
      var n = el('span', 'tchip-n');
      n.textContent = dash.faNum(t.count);
      b.appendChild(n);
      b.addEventListener('click', function () {
        var active = !selected.has(t.tag);
        if (active) selected.add(t.tag); else selected.delete(t.tag);
        b.classList.toggle('active', active);
        b.setAttribute('aria-checked', String(active));
        onToggle(t.tag, active);
      });
      container.appendChild(b);
    });
  }

  /* ---------- Default color dots (settings) ---------- */

  /**
   * container gets filled; current: active key; onSelect(key)
   */
  function buildColorDots(container, current, onSelect) {
    container.textContent = '';
    (HL.COLOR_KEYS || []).forEach(function (k) {
      var c = HL.COLORS[k];
      var b = el('button', 'cdot');
      b.type = 'button';
      b.dataset.key = k;
      b.setAttribute('role', 'radio');
      b.title = 'رنگ پیش‌فرض: ' + c.label;
      b.setAttribute('aria-label', c.label);
      if (k === current) {
        b.classList.add('active');
        b.setAttribute('aria-checked', 'true');
      }
      var dot = el('span', 'dot');
      dot.style.background = c.dot;
      b.appendChild(dot);
      b.addEventListener('click', function () { onSelect(k); });
      container.appendChild(b);
    });
  }

  /* ---------- Theme options (settings) ---------- */

  /** Short description of each theme — next to the registry label */
  var THEME_HINTS = {
    auto: 'روشن/تیره سیستم‌عامل را دنبال می‌کند',
    light: 'همیشه پس‌زمینه‌ی روشن',
    dark: 'همیشه پس‌زمینه‌ی تیره'
  };

  /**
   * container gets filled; current: active key ('auto' default); onSelect(key)
   * Built from the HL.THEMES registry (OCP: a new theme = a registry entry).
   * Same pattern as buildColorDots — but radios wrapped in labels (native keyboard/AT).
   */
  function buildThemeRadios(container, current, onSelect) {
    container.textContent = '';
    var cur = (HL.THEME_KEYS && HL.THEME_KEYS.indexOf(current) !== -1) ? current : 'auto';
    (HL.THEME_KEYS || []).forEach(function (k) {
      var t = HL.THEMES[k];
      var lab = el('label', 'radio');
      var input = el('input');
      input.type = 'radio';
      input.name = 'hlx-theme';
      input.value = k;
      input.checked = (k === cur);
      input.addEventListener('change', function () { if (input.checked) onSelect(k); });
      var txt = el('span', 'radio-txt');
      var strong = el('strong');
      strong.textContent = t.label;
      var hint = el('span', 'muted small');
      hint.textContent = THEME_HINTS[k] || '';
      txt.appendChild(strong);
      txt.appendChild(hint);
      lab.appendChild(input);
      lab.appendChild(txt);
      container.appendChild(lab);
    });
  }

  /* ---------- Disabled-sites chips ---------- */

  /**
   * container gets filled; hosts: array of strings; onRemove(host)
   */
  function renderHostChips(container, hosts, onRemove) {
    container.textContent = '';
    if (!hosts.length) {
      var p = el('p', 'muted small');
      p.textContent = 'هنوز سایتی غیرفعال نشده است.';
      container.appendChild(p);
      return;
    }
    hosts.forEach(function (h) {
      var chip = el('span', 'hchip');
      chip.appendChild(txtNode(h));
      var x = el('button', 'hchip-x');
      x.type = 'button';
      x.title = 'حذف ' + h;
      x.setAttribute('aria-label', 'حذف ' + h);
      x.innerHTML = ICONS.x; /* our own constant */
      x.addEventListener('click', function () { onRemove(h); });
      chip.appendChild(x);
      container.appendChild(chip);
    });
  }

  /* ---------- Restore modal summary ---------- */

  /**
   * container gets filled; b: backup object
   */
  function fillModalSummary(container, b) {
    container.textContent = '';
    var count = (b.meta && b.meta.count) || Object.keys(b.highlights).length;
    addRow('نام مجموعه', b.name || HL.APP_NAME);
    addRow('تعداد هایلایت‌ها', dash.faNum(count));
    addRow('تاریخ خروجی', b.exportedAt ? HL.format.fmtDateTime(b.exportedAt) : '—');
    addRow('نسخه', 'v' + (b.version || HL.VERSION));
    function addRow(k, v) {
      var r = el('div', 'sum-row');
      var kk = el('span', 'muted');
      kk.textContent = k;
      var vv = el('strong');
      vv.textContent = v;
      r.appendChild(kk);
      r.appendChild(vv);
      container.appendChild(r);
    }
  }

  /* ---------- Export modal summary (v0.6.0) ---------- */

  /**
   * The «کتابچه و Markdown» modal's summary rows — the library snapshot the
   * exports will contain (the SAME computeStats the dashboard's stat cards
   * read — one source, the controller passes it). stats: { total, notes,
   * pages, sites }. textContent-only, like every view builder.
   */
  function fillBookletSummary(container, stats) {
    container.textContent = '';
    var s = stats || { total: 0, notes: 0, pages: 0, sites: 0 };
    addRow('هایلایت‌ها', dash.faNum(s.total));
    addRow('مقاله‌ها', dash.faNum(s.pages));
    addRow('یادداشت‌ها', dash.faNum(s.notes));
    function addRow(k, v) {
      var r = el('div', 'sum-row');
      var kk = el('span', 'muted');
      kk.textContent = k;
      var vv = el('strong');
      vv.textContent = v;
      r.appendChild(kk);
      r.appendChild(vv);
      container.appendChild(r);
    }
  }

  /* ---------- Highlight preview modal (v0.6.1 — frame + head + body fills) ---------- */

  /**
   * The preview window's FRAME direction (v0.6.4) — the last piece of the
   * fully-smart window. The highlight TEXT is what the window exists to
   * show, so ITS language decides the frame: an English highlight gets an
   * LTR window (title at the reading start, scrollbar right, logical
   * paddings flipped), a Persian one keeps the dashboard's RTL. The exact
   * v1.2.6 smart-card idiom one level down — and the same single decision
   * source every content surface reads (dash.detectTextDir — no new
   * policy). BOTH branches explicit with a reset in between, so re-opens
   * never leak the previous record's direction onto the next one; neutral
   * text (no strong letters) takes NO attribute: the window falls back to
   * the document's rtl, the Persian UI's conservative default.
   *
   * Everything inside already owns its direction at its own granularity:
   * the title/quote/note per-text (v0.6.3/v1.2.12/v1.2.13) and the meta
   * date as an inline RTL island (below) — the frame only sets the STAGE
   * those texts play on.
   *
   * card: the static .hl-card element (dashboard.html, #hl-card); rec: one
   * highlight record — only rec.text is consulted.
   */
  function fillHighlightDir(card, rec) {
    var d = dash.detectTextDir(rec && rec.text);
    if (d) card.setAttribute('dir', d);
    else card.removeAttribute('dir'); /* neutral → the doc's rtl */
  }

  /**
   * The preview window's HEAD fill (v0.6.3): the article's OWN title replaces
   * the old static «متن کامل هایلایت» caption — the window already says what
   * it is by its content; what the reader needs up there is WHICH article the
   * highlight belongs to. Same chain as the card header (articleTitleOf — one
   * policy), excerpted at the SAME 60 chars; the full title rides the title
   * attribute (the .group-url tooltip idiom), and CSS ellipsis is the backstop.
   *
   * Direction: the title is USER content — its own detectTextDir, BOTH
   * branches explicit with a reset in between (idempotent re-fills), the exact
   * .atag-t label idiom; v0.6.4 made the ALIGNMENT smart too — CSS no longer
   * pins the title to the RTL edge: text-align: start resolves against the
   * title's own dir, so an English title heads the window from the LEFT edge
   * exactly where its reading starts (and a Persian one from the right).
   *
   * el: the static #hl-title h2 (dashboard.html); rec: one highlight record
   * (title/host/url captured at highlight time — the article's own title).
   */
  function fillHighlightTitle(el, rec) {
    var full = articleTitleOf(rec);
    el.textContent = HL.format.excerpt(full, 60) || 'بدون عنوان';
    el.title = full; /* the untruncated title on hover */
    var d = dash.detectTextDir(full);
    if (d) el.setAttribute('dir', d);
    else el.removeAttribute('dir'); /* neutral title → back to the doc's rtl */
  }

  /**
   * The full-text preview window's body — the WHOLE record content, no
   * excerpting: the highlight text and (when present) the note render in
   * full, exactly the two things the card truncates. Pure fill builder over
   * a static #hl-modal skeleton (dashboard.html) — the same division the
   * restore and export modals use (fillModalSummary / fillBookletSummary):
   * structure in HTML, content here, wiring in the controller.
   *
   * Direction contracts are the dashboard's own, applied unchanged so the
   * window reads exactly like the card it came from: the quote keeps its
   * per-text direction (v1.2.12, detectTextDir — BOTH branches explicit),
   * the note ROW keeps its per-note direction (v1.2.13), and the meta line
   * is Persian chrome in its own isolated RTL context (v0.5.2 faEl — a fa-IR
   * date would scramble inside an LTR quote otherwise). The meta line is
   * DATE-ONLY (v0.6.3): the color is already carried by the .cbar bar — a
   * color NAME next to it was redundant chrome, the owner asked it gone.
   * Visual language is reused, not reinvented: the card's own .cbar color
   * bar and .note row classes (DRY — one quote/note look across surfaces).
   *
   * rec: one highlight record ({ text, note?, color, updatedAt|createdAt }).
   */
  function fillHighlightPreview(container, rec) {
    container.textContent = '';

    var quote = el('div', 'hl-quote');
    var qDir = dash.detectTextDir(rec.text);
    if (qDir) quote.setAttribute('dir', qDir);
    var bar = el('span', 'cbar');
    bar.style.background = dash.dotColorOf(rec.color);
    bar.setAttribute('aria-hidden', 'true');
    quote.appendChild(bar);
    var qt = el('p', 'hl-quote-t');
    qt.textContent = rec.text; /* FULL text — never excerpted here */
    quote.appendChild(qt);
    container.appendChild(quote);

    if (rec.note) {
      var note = el('div', 'note');
      var nDir = dash.detectTextDir(rec.note);
      if (nDir) note.setAttribute('dir', nDir);
      var ic = el('span', 'note-ic');
      ic.innerHTML = ICONS.quote; /* our own constant */
      var nt = el('span', 'note-text');
      nt.textContent = rec.note; /* FULL note */
      note.appendChild(ic);
      note.appendChild(nt);
      container.appendChild(note);
    }

    /* Meta line (v0.6.3): date/time ONLY — the color NAME is gone (the .cbar
       bar above already carries the color; a word for it was redundant chrome).
       v0.6.4 shape — the .item-date idiom, one level up: a frame-flow ROW
       (.hl-meta, NO dir: the line sits at the window's reading start — left
       in an LTR window, right in an RTL one) wrapping an INLINE RTL island
       (.hl-meta-t via faEl: the fa-IR date keeps its day-month-year order and
       mirrored punctuation inside LTR windows). Aligned by the frame,
       ordered by the language — exactly how the card's item dates behave. */
    var meta = HL.format.fmtDateTime(rec.updatedAt || rec.createdAt);
    var metaRow = el('div', 'hl-meta');
    metaRow.appendChild(faEl('span', 'hl-meta-t', meta));
    container.appendChild(metaRow);
  }

  /* ---------- Empty state + load-more (v1.2.9 — moved from the controller) ---------- */

  /** No results: reason differs for an empty store vs. a filtered-out store. */
  function renderEmptyState(empty, emptyTitle, emptySub, hasRecords) {
    empty.hidden = false;
    if (hasRecords) {
      emptyTitle.textContent = 'نتیجه‌ای پیدا نشد.';
      emptySub.textContent = 'عبارت جست‌وجو یا فیلترهای رنگ و برچسب را تغییر بده.';
    } else {
      emptyTitle.textContent = 'هنوز هایلایتی ثبت نشده — اولین متن را انتخاب کن!';
      emptySub.textContent = 'روی هر صفحه‌ی وب، متن را انتخاب کن و از نوار شناور افزونه استفاده کن.';
    }
  }

  /** Load-more button: hidden unless there is an overflow to reveal. */
  function renderLoadMore(loadMore, overflow) {
    if (overflow > 0) {
      loadMore.hidden = false;
      loadMore.textContent = 'بارگذاری بیشتر (' + dash.faNum(overflow) + ' مورد باقی‌مانده)';
    } else {
      loadMore.hidden = true;
    }
  }

  /* ---------- Bulk expand/collapse (v0.3.0) ---------- */

  /* Persian presentation of the two bulk modes — the direction the button
     flips the whole list to. Both modes also load every unloaded highlight;
     the tooltip says so (the behavior itself is the controller's concern). */
  var BULK_ACTION_META = {
    expand: {
      icon: 'chevsDown',
      label: 'باز کردن همه‌ی مقاله‌ها',
      title: 'همه‌ی کارت مقاله‌ها باز می‌شوند و همه‌ی هایلایت‌های بارگذاری‌نشده هم بارگذاری می‌شوند'
    },
    collapse: {
      icon: 'chevsUp',
      label: 'بستن همه‌ی مقاله‌ها',
      title: 'همه‌ی کارت مقاله‌ها بسته می‌شوند و همه‌ی هایلایت‌های بارگذاری‌نشده هم بارگذاری می‌شوند؛ با باز کردن هر مقاله، هایلایت‌هایش کامل نمایش داده می‌شوند'
    }
  };

  /**
   * The list-level bulk toggle (static #btn-bulk in dashboard.html — the same
   * pattern as #load-more): presents the NEXT action so the button always
   * says what a click will do. 'expand' → «باز کردن همه‌ی مقاله‌ها» with the
   * double-chevron-down icon (any card is collapsed); 'collapse' → «بستن
   * همه‌ی مقاله‌ها» with double-chevron-up (every card is open); '' (empty
   * list) hides the button. The inner structure (.bt-ic icon span + .bt-lbl
   * label span) is rebuilt from scratch on every call — idempotent re-renders,
   * no duplicated nodes, and the builder works on any button element. The
   * decision (dash.bulkAction) and the click behavior (bulk flip + load-all)
   * are the data layer's and the controller's jobs — this layer only presents.
   */
  function renderBulkToggle(btn, action) {
    var meta = BULK_ACTION_META[action];
    if (!meta) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.title = meta.title;
    btn.textContent = '';
    var ic = el('span', 'bt-ic');
    ic.setAttribute('aria-hidden', 'true'); /* decorative — the label carries the meaning */
    ic.innerHTML = ICONS[meta.icon]; /* our own constant */
    var lbl = el('span', 'bt-lbl');
    lbl.textContent = meta.label;
    btn.appendChild(ic);
    btn.appendChild(lbl);
  }

  HL.dashView = {
    el: el,
    txtNode: txtNode,
    ICONS: ICONS,
    iconBtn: iconBtn,
    armButton: armButton,
    toast: toast,
    buildGroupCard: buildGroupCard,
    buildDirSection: buildDirSection,
    buildItemCard: buildItemCard,
    buildTagsRow: buildTagsRow,
    buildColorChips: buildColorChips,
    buildTagChips: buildTagChips,
    buildColorDots: buildColorDots,
    buildThemeRadios: buildThemeRadios,
    renderHostChips: renderHostChips,
    fillModalSummary: fillModalSummary,
    fillBookletSummary: fillBookletSummary,
    fillHighlightDir: fillHighlightDir,
    fillHighlightTitle: fillHighlightTitle,
    fillHighlightPreview: fillHighlightPreview,
    renderEmptyState: renderEmptyState,
    renderLoadMore: renderLoadMore,
    renderBulkToggle: renderBulkToggle
  };
})();
