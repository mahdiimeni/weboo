/**
 * Weboo — site favicon capture (content-script module, v1.2.9)
 *
 * Extracted from content.js (SRP): the orchestrator keeps only the one-time
 * page policy; pick → fetch → validate → store lives here.
 * Source: whatever the page declares — <link rel="icon"> (best sizes area)
 * and, in its absence, /favicon.ico. The fetch runs in the page's own context
 * (credentials omitted), is converted to a dataURL and stored once per host
 * in the hlx:f:<host> partition. Any failure shape (CORS, local file, size,
 * type) is swallowed → resolves false; the consumer keeps the first-letter
 * fallback. Pure where possible: pickIconHref(doc, base) is unit-testable.
 * DIP: storage is injected (an HL.createStore instance).
 */
  var MAX_BYTES = 96 * 1024;

  function pickIconHref(doc, base) {
    /* Best candidate: the larger sizes area (SVG/APNG take this path too);
       root fallback: /favicon.ico */
    var best = null, bestArea = -1;
    var links = doc.querySelectorAll('link[rel~="icon"][href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href) continue;
      var area = 0;
      var sizes = (links[i].getAttribute('sizes') || '').toLowerCase();
      var m = sizes.match(/(\d+)\s*[x×]\s*(\d+)/);
      if (m) area = parseInt(m[1], 10) * parseInt(m[2], 10);
      else if (sizes.indexOf('any') !== -1 || /svg/i.test(links[i].getAttribute('type') || '')) area = 1024;
      if (area > bestArea) { bestArea = area; best = href; }
    }
    var raw = best || '/favicon.ico';
    try {
      var u = new URL(raw, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.href;
    } catch (e) { return null; }
  }

  function blobToDataURL(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result || '')); };
      fr.onerror = function () { rej(new Error('read')); };
      try { fr.readAsDataURL(blob); } catch (e) { rej(e); }
    });
  }

  /**
   * store: HL.createStore instance; host: string; doc: the page document;
   * loc: the page location (uses loc.href as the base for relative hrefs).
   * → Promise<boolean> — true if an icon is stored (captured now or already
   * present). Never rejects.
   */
  function captureSiteFavicon(store, host, doc, loc) {
    if (!host || !store) return Promise.resolve(false);
    var href = pickIconHref(doc, loc && loc.href ? loc.href : '');
    if (!href) return Promise.resolve(false);
    return store.getFavicon(host).then(function (meta) {
      if (meta && meta.icon) return true; /* already captured */
      return fetch(href, { credentials: 'omit' }).then(function (r) {
        if (!r || !r.ok) throw new Error('http');
        return r.blob();
      }).then(function (b) {
        if (!b || !b.size || b.size > MAX_BYTES) throw new Error('size');
        if (!/^image\//i.test(b.type || '')) throw new Error('type');
        return blobToDataURL(b);
      }).then(function (dataUrl) {
        if (dataUrl.indexOf('data:image/') !== 0) throw new Error('data');
        return store.setFavicon(host, { icon: dataUrl, capturedAt: Date.now() });
      });
    }).then(function () { return true; }, function () { return false; });
  }

export const favicon = { MAX_BYTES: MAX_BYTES, pickIconHref: pickIconHref, captureSiteFavicon: captureSiteFavicon };



