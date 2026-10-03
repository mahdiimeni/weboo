/**
 * Web Highlighter — runtime bridge
 *
 * The only place chrome.runtime is touched in the shared layers
 * (content/popup/dashboard); the rest of the code only talks to HL.runtime.
 * The popup is a platform-specific page and uses chrome.tabs directly — as
 * that page's own concern (the platform-awareness boundary).
 * All methods safely no-op/degrade when chrome is absent.
 */
import { VERSION } from "./constants.js"; /* 7c-2 */

(function () {
  'use strict';
  var HL = (globalThis.HL = globalThis.HL || {});

  function runtimeBridge() {
    var rt = (globalThis.chrome && globalThis.chrome.runtime) || null;

    function readLastError() {
      return (rt && rt.lastError) || null;
    }

    return {
      available: !!rt,

      /** Manifest version (fallback: VERSION) */
      manifestVersion: function () {
        if (rt && rt.getManifest) {
          try { return (rt.getManifest() || {}).version || VERSION; }
          catch (e) { /* noop */ }
        }
        return VERSION;
      },

      /** In-extension-package URL (fallback: the same relative path) */
      getURL: function (p) {
        if (rt && rt.getURL) {
          try { return rt.getURL(p); } catch (e) { /* noop */ }
        }
        return p;
      },

      /** One-way message send; never rejects (asleep SW / page without a listener) */
      send: function (msg) {
        if (!rt || !rt.sendMessage) return Promise.resolve(undefined);
        return new Promise(function (res) {
          try {
            var p = rt.sendMessage(msg, function (resp) {
              void readLastError();
              res(resp);
            });
            if (p && typeof p.then === 'function') p.then(res, function () { res(undefined); });
          } catch (e) { res(undefined); }
        });
      },

      /** Registers a message listener; safe when chrome is absent */
      onMessage: function (listener) {
        if (!rt || !rt.onMessage || !rt.onMessage.addListener) return false;
        try {
          rt.onMessage.addListener(function (msg, sender, sendResponse) {
            try { listener(msg, sender, sendResponse); } catch (e) { /* broken listener */ }
          });
          return true;
        } catch (e) { return false; }
      }
    };
  }

  HL.runtime = runtimeBridge();
})();

/* identity export (7c-1) */
export const runtime = globalThis.HL.runtime;
