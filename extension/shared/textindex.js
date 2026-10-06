/**
 * Web Highlighter — text anchoring engine
 * Turns page text into a character index so we can:
 *   1) compute a Range's offsets (at save time)
 *   2) restore the equivalent Range from the saved text (on page reload)
 * The engine is independent of DOM structure; even if the page is rewritten,
 * as long as the text is still there the highlight comes back.
 *
 * Phase 2/3: resolution strategies (findRange + scoring) moved to
 * shared/anchor.js — this module is now the index PRIMITIVE only (build,
 * locate, offsets, range normalization). Compiled by `bun run build:ext`
 * into extension/shared/textindex.js — never edit the .js directly.
 *
 * NOTE (Phase 7b — ES module): this file IS a converted module (tail export,
 * identity-exported HL.text). It may carry module syntax ONLY because no
 * classic loader of it remains: content ships as the WXT bundle, the test
 * engine strips-and-wraps module files for world isolation, and the manifest
 * content list is order-data (7a). Every OTHER emitted file must stay
 * classic until its loaders migrate — packaging.test's allowlist tripwire
 * enforces both directions.
 */
/** Tags whose text does not count as "document text" */
var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TEXTAREA: 1, TITLE: 1,
    IFRAME: 1, CANVAS: 1, SVG: 1, OBJECT: 1, EMBED: 1, SELECT: 1, OPTION: 1,
    VIDEO: 1, AUDIO: 1
};
/**
 * TreeWalker filter for highlightable text nodes.
 * Nodes inside the extension's own UI (data-hlx-ui) and contenteditable areas are rejected.
 * Values: 1=ACCEPT, 2=REJECT (NodeFilter hard-coded numerically for compatibility)
 */
function acceptTextNode(node) {
    var p = node.parentElement;
    while (p) {
        if (SKIP_TAGS[p.tagName])
            return 2;
        if (p.hasAttribute && p.hasAttribute('data-hlx-ui'))
            return 2;
        if (p.isContentEditable)
            return 2;
        p = p.parentElement;
    }
    var data = node.data;
    if (!data || data.length === 0)
        return 2;
    return 1;
}
/**
 * Builds the document text index: contiguous text + a map of chunks (text node + its start)
 */
function buildTextIndex(root) {
    var chunks = [];
    var text = '';
    if (!root) {
        return {
            root: root || null, text: '', chunks: [], length: 0,
            locate: function () { return null; },
            offsetOf: function () { return -1; },
            offsetsOfRange: function () { return null; }
        };
    }
    var walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */, { acceptNode: acceptTextNode });
    var n;
    while ((n = walker.nextNode())) {
        chunks.push({ node: n, start: text.length });
        text += n.data;
    }
    function locate(index) {
        if (!chunks.length || index < 0 || index >= text.length)
            return null;
        var lo = 0, hi = chunks.length - 1;
        while (lo < hi) {
            var mid = (lo + hi + 1) >> 1;
            if (chunks[mid].start <= index)
                lo = mid;
            else
                hi = mid - 1;
        }
        var c = chunks[lo];
        return { node: c.node, offset: index - c.start };
    }
    function offsetOf(node, offset) {
        for (var i = 0; i < chunks.length; i++) {
            if (chunks[i].node === node)
                return chunks[i].start + offset;
        }
        return -1;
    }
    function offsetsOfRange(range) {
        var s = offsetOf(range.startContainer, range.startOffset);
        var e = offsetOf(range.endContainer, range.endOffset);
        if (s < 0 || e < 0 || e < s)
            return null;
        return { start: s, end: e };
    }
    return {
        root: root, text: text, chunks: chunks, length: text.length,
        locate: locate, offsetOf: offsetOf, offsetsOfRange: offsetsOfRange
    };
}
/** Squashes whitespace for comparison tolerant to whitespace changes */
function squash(s) {
    return String(s == null ? '' : s).replace(/[\s\u00a0\u200b]+/g, ' ').trim();
}
/**
 * Builds normalized text + a map from each normalized character to its original index
 * (consecutive spaces collapse into one; the text is trimmed at both ends)
 */
function normInfo(s) {
    var norm = '';
    var map = [];
    var prevWs = true; // leading whitespace is dropped
    for (var i = 0; i < s.length; i++) {
        var code = s.charCodeAt(i);
        var ws = (code === 32 || code === 9 || code === 10 || code === 13 || code === 12 || code === 160 || code === 8203);
        if (ws) {
            if (!prevWs) {
                norm += ' ';
                map.push(i);
                prevWs = true;
            }
        }
        else {
            norm += s.charAt(i);
            map.push(i);
            prevWs = false;
        }
    }
    while (norm.length && norm.charAt(norm.length - 1) === ' ') {
        norm = norm.slice(0, -1);
        map.pop();
    }
    return { norm: norm, map: map };
}
/* ---------- Range boundary normalization ---------- */
/**
 * The first highlightable text node in a node's subtree (or the node itself).
 */
function firstTextNodeIn(node) {
    if (!node)
        return null;
    if (node.nodeType === 3)
        return acceptTextNode(node) === 1 ? node : null;
    if (node.nodeType !== 1)
        return null;
    var w = document.createTreeWalker(node, 4 /* SHOW_TEXT */, { acceptNode: acceptTextNode });
    return w.nextNode() || null;
}
/**
 * The last highlightable text node in a node's subtree (or the node itself).
 */
function lastTextNodeIn(node) {
    if (!node)
        return null;
    if (node.nodeType === 3)
        return acceptTextNode(node) === 1 ? node : null;
    if (node.nodeType !== 1)
        return null;
    var w = document.createTreeWalker(node, 4 /* SHOW_TEXT */, { acceptNode: acceptTextNode });
    var last = null, n;
    while ((n = w.nextNode()))
        last = n;
    return last;
}
function childIndexOf(parent, node) {
    return Array.prototype.indexOf.call(parent.childNodes, node);
}
/**
 * Converts a boundary (container, offset) to the equivalent text node.
 * When a selection reaches the start/end of a block (e.g. double-clicking
 * the last word of a paragraph so the trailing period is included), browsers
 * put the boundary on the element itself (e.g. endContainer=<p> with
 * endOffset=child count).
 * This function converts the boundary to the nearest equivalent text node:
 *   - start (backward=false): the first text after the boundary
 *   - end (backward=true): the last text before the boundary
 * Returns: { node, offset } or null.
 */
function boundaryToText(container, offset, backward) {
    if (!container)
        return null;
    if (container.nodeType === 3)
        return { node: container, offset: offset };
    if (container.nodeType !== 1)
        return null;
    var children = container.childNodes;
    var i;
    if (backward) {
        // the boundary is after children[offset-1] → the last text inside/before it
        for (i = Math.min(offset, children.length) - 1; i >= 0; i--) {
            var t = lastTextNodeIn(children[i]);
            if (t)
                return { node: t, offset: t.data.length };
        }
        var parent = container.parentNode;
        if (!parent || parent.nodeType !== 1)
            return null;
        return boundaryToText(parent, childIndexOf(parent, container), true);
    }
    // the boundary is before children[offset] → the first text inside/after it
    for (i = Math.min(offset, children.length); i < children.length; i++) {
        var t2 = firstTextNodeIn(children[i]);
        if (t2)
            return { node: t2, offset: 0 };
    }
    var parent2 = container.parentNode;
    if (!parent2 || parent2.nodeType !== 1)
        return null;
    return boundaryToText(parent2, childIndexOf(parent2, container) + 1, false);
}
/**
 * Normalizes a Range's boundaries to indexable text nodes (in place).
 * The index engine only knows text nodes; element boundaries must be converted.
 * If the boundaries end up inverted/coincident after normalization, the Range
 * may collapse — the caller handles that case as "not highlightable".
 */
function normalizeRange(range) {
    if (!range)
        return range;
    try {
        var s = boundaryToText(range.startContainer, range.startOffset, false);
        if (s)
            range.setStart(s.node, s.offset);
        var e = boundaryToText(range.endContainer, range.endOffset, true);
        if (e)
            range.setEnd(e.node, e.offset);
    }
    catch (e2) { /* noop: invalid Range — the caller handles it */ }
    return range;
}
export const text = {
    build: buildTextIndex,
    normInfo: normInfo,
    squash: squash,
    acceptTextNode: acceptTextNode,
    normalizeRange: normalizeRange,
    boundaryToText: boundaryToText
};
