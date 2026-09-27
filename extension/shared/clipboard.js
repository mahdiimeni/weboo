/**
 * Web Highlighter — clipboard text copy (SRP: the single copy implementation)
 *
 * Contract: HL.clipboard.copyText(text) → Promise<boolean>
 *   true = copied, false = both paths failed (Async Clipboard API and
 *   execCommand). Empty text → false without calling any API.
 * The module knows nothing about "display"; messages/toasts are the caller's job (ISP).
 * The legacy path (textarea + execCommand) is kept for browsers without the
 * Clipboard permission (e.g. file:// pages or iframes without allow).
 */
(function () {
  'use strict';
  const HL = (globalThis.HL = globalThis.HL || {});

  function legacyCopy(t) {
    var ok = false;
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (e) { ok = false; }
    return ok;
  }

  function copyText(t) {
    return new Promise(function (resolve) {
      if (!t) { resolve(false); return; }
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () {
          resolve(true);
        }, function () {
          resolve(legacyCopy(t));
        });
      } else {
        resolve(legacyCopy(t));
      }
    });
  }

  HL.clipboard = { copyText: copyText };
})();
