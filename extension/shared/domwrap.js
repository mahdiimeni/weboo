/**
 * Web Highlighter — DOM tools
 * - Wrapping (marking) a Range's extent with <mark> elements
 * - Fast XPath anchoring (serialize/resolve)
 * - Unwrapping a highlight, changing color, note marker, flash effect
 * Highlight element: <mark class="hlx-marker" data-hl-id="..." data-hl-color="..." data-hl-noted="1"?>
 * data-hl-noted is set only for highlights that have a note (the underline marker).
 */
/* Phase 7b module: textindex is a real import (squash/acceptTextNode reads —
   the old HL.text namespace seam shrinks). Identity via globalThis.HL; tail
   `export const dom` below. Consumers (anchor/highlighter/content) import dom. */
import { text as textIndex } from "./textindex.js"; /* alias: `text` is a common local name in DOM code */
(function () {
  'use strict';
  const HL = (globalThis.HL = globalThis.HL || {});

  /** XPath relative to body for a node (element or text) */
  function xpathOf(node) {
    if (!node) return null;
    var parts = [];
    var cur = node;
    var guard = 0;
    while (cur && cur !== document.body && cur.nodeType !== 9 && guard++ < 300) {
      var parent = cur.parentNode;
      if (!parent) break;
      if (cur.nodeType === 3) { // text node
        var idx = 0, sib = parent.firstChild;
        while (sib && sib !== cur) { if (sib.nodeType === 3) idx++; sib = sib.nextSibling; }
        parts.unshift('text()[' + (idx + 1) + ']');
      } else if (cur.nodeType === 1) { // element
        var eidx = 0, esib = parent.firstChild;
        while (esib && esib !== cur) { if (esib.nodeType === 1 && esib.tagName === cur.tagName) eidx++; esib = esib.nextSibling; }
        parts.unshift(cur.tagName.toLowerCase() + '[' + (eidx + 1) + ']');
      } else break;
      cur = parent;
    }
    return parts.join('/');
  }

  function evalXPath(path) {
    if (!path || !document.body) return null;
    try {
      var r = document.evaluate('./' + path, document.body, null, 9 /* FIRST_ORDERED_NODE_TYPE */, null);
      return r.singleNodeValue || null;
    } catch (e) {
      return null;
    }
  }

  function serializeRange(range) {
    try {
      return {
        start: xpathOf(range.startContainer),
        startOffset: range.startOffset,
        end: xpathOf(range.endContainer),
        endOffset: range.endOffset
      };
    } catch (e) {
      return null;
    }
  }

  function lenOf(node) {
    return node.nodeType === 3 ? node.data.length : node.childNodes.length;
  }

  /**
   * Fast Range restoration from an XPath anchor.
   * expectText: the first 24 characters of the range's text are compared
   * against the expected text; if the page has changed, null is returned so
   * the textual (fallback) path can be tried.
   */
  function resolveAnchor(anchor, expectText) {
    if (!anchor || !anchor.start || !anchor.end) return null;
    var sc = evalXPath(anchor.start);
    var ec = evalXPath(anchor.end);
    if (!sc || !ec) return null;
    try {
      var r = document.createRange();
      r.setStart(sc, Math.min(anchor.startOffset, lenOf(sc)));
      r.setEnd(ec, Math.min(anchor.endOffset, lenOf(ec)));
      if (r.collapsed) return null;
      if (expectText) {
        var a = textIndex.squash(r.toString()).slice(0, 24);
        var b = textIndex.squash(expectText).slice(0, 24);
        if (!a || !b || a !== b) return null;
      }
      return r;
    } catch (e) {
      return null;
    }
  }

  /** Text nodes intersecting the Range (in document order) */
  function intersectingTextNodes(range) {
    var out = [];
    if (!range || range.collapsed) return out;
    var root = range.commonAncestorContainer;
    if (root.nodeType === 3) root = root.parentNode;
    if (!root) return out;
    var walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */, { acceptNode: textIndex.acceptTextNode });
    var n;
    while ((n = walker.nextNode())) {
      var hit = true;
      try { hit = range.intersectsNode(n); } catch (e) { hit = false; }
      if (hit) out.push(n);
    }
    return out;
  }

  /**
   * Wraps (marks) all text inside the Range with mark elements.
   * Partially covered nodes are first split off with splitText.
   * Returns: the array of created marks (empty means nothing was highlightable).
   */
  function markRange(range, id, colorKey) {
    var marks = [];
    if (!range || range.collapsed) return marks;
    var nodes = intersectingTextNodes(range);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var s = (node === range.startContainer) ? range.startOffset : 0;
      var e = (node === range.endContainer) ? range.endOffset : node.data.length;
      if (e <= s) continue;

      var target = node;
      try {
        if (e < node.data.length) target.splitText(e);
        if (s > 0) target = target.splitText(s);
      } catch (err) { continue; }
      if (!target || !target.data || !target.parentNode) continue;

      var mark = document.createElement('mark');
      mark.className = 'hlx-marker';
      mark.setAttribute('data-hl-id', id);
      mark.setAttribute('data-hl-color', colorKey);

      var parent = target.parentNode;
      parent.insertBefore(mark, target);
      mark.appendChild(target);
      marks.push(mark);
    }
    return marks;
  }

  function marksOf(id) {
    try {
      var sel = 'mark.hlx-marker[data-hl-id="' + HL.util.cssEscape(id) + '"]';
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    } catch (e) {
      return [];
    }
  }

  function allMarks() {
    return Array.prototype.slice.call(document.querySelectorAll('mark.hlx-marker'));
  }

  /** Unwraps a highlight: marks are removed and the texts return to their original place */
  function unwrap(id) {
    var ms = marksOf(id);
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      var p = m.parentNode;
      if (!p) continue;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      m.remove();
      if (p.normalize) { try { p.normalize(); } catch (e) { /* noop */ } }
    }
    return ms.length;
  }

  function setColor(id, colorKey) {
    marksOf(id).forEach(function (m) { m.setAttribute('data-hl-color', colorKey); });
  }

  /**
   * Note marker: the highlight underline is shown only when the note is
   * non-empty. When the note is emptied/deleted, the attribute is removed.
   */
  function setNoted(id, hasNote) {
    marksOf(id).forEach(function (m) {
      if (hasNote) m.setAttribute('data-hl-noted', '1');
      else m.removeAttribute('data-hl-noted');
    });
  }

  /** Flash effect for jumping to a highlight */
  function flash(id) {
    var ms = marksOf(id);
    ms.forEach(function (m) {
      m.classList.remove('hlx-flash');
      void m.offsetWidth;
      m.classList.add('hlx-flash');
    });
    setTimeout(function () {
      ms.forEach(function (m) { m.classList.remove('hlx-flash'); });
    }, 2000);
  }

  /**
   * Is this element/text hidden from the user (display:none anywhere up the
   * tree)? Sites duplicate content (pre-hydration fallbacks, SEO/mobile
   * copies) and frameworks hide one copy after boot — a highlight wrapped in
   * the hidden copy is invisible and unclickable even though the marks exist.
   * Visibility checks must go through here so apply/reconcile/picking agree.
   * (visibility:hidden is NOT detected — it keeps layout boxes; ponytail:
   * add computed visibility/opacity when a real site needs it.)
   */
  function isHidden(el) {
    if (!el) return true;
    if (el.nodeType !== 1) el = el.parentElement;
    if (!el || !el.isConnected) return true;
    try {
      var win = el.ownerDocument && el.ownerDocument.defaultView;
      for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n.style && n.style.display === 'none') return true;
        if (win && win.getComputedStyle(n).display === 'none') return true;
      }
    } catch (e) { return false; }
    return false;
  }

  HL.dom = { /* the dom namespace — exported below (ES module identity) */
    xpathOf: xpathOf,
    evalXPath: evalXPath,
    serializeRange: serializeRange,
    resolveAnchor: resolveAnchor,
    intersectingTextNodes: intersectingTextNodes,
    markRange: markRange,
    marksOf: marksOf,
    allMarks: allMarks,
    unwrap: unwrap,
    setColor: setColor,
    setNoted: setNoted,
    flash: flash,
    isHidden: isHidden
  };
})();

export const dom = globalThis.HL.dom; /* identity export (same instance classic consumers share) */
