/**
 * Web Highlighter — Chrome backend for the storage port
 *
 * Port contract (every backend must implement exactly these 5 members — minimal ISP):
 *   get(key|null) → Promise<object>      — one key's value, or all items
 *   set(items)    → Promise<void>        — batch write of {key: value}
 *   remove(keys)  → Promise<void>        — remove an array of keys
 *   bytes()       → Promise<number>      — bytes in use
 *   onChange(cb)  → unsubscribe          — cb(changes) shaped {key:{oldValue,newValue}}
 *
 * This file is the "only" place that knows about chrome.storage;
 * the domain layer (store.js) and the orchestrator (highlighter.js) never touch chrome.*.
 * If chrome.storage is unavailable, an in-memory backend is returned on the
 * spot to preserve the previous versions' graceful degradation (error at
 * composition time, not at runtime).
 */
(function () {
  'use strict';
  var HL = (globalThis.HL = globalThis.HL || {});

  /* ---------- In-memory backend (fallback and test utility) ---------- */

  function memoryArea() {
    var data = {};
    var listeners = [];

    function emit(changes) {
      listeners.slice().forEach(function (cb) {
        try { cb(changes); } catch (e) { /* a broken listener must not break the chain */ }
      });
    }

    return {
      get: function (key) {
        var out = {};
        if (key === null || key === undefined) {
          Object.keys(data).forEach(function (k) { out[k] = data[k]; });
        } else if (key in data) {
          out[key] = data[key];
        }
        return Promise.resolve(out);
      },
      set: function (items) {
        var changes = {};
        Object.keys(items || {}).forEach(function (k) {
          changes[k] = { oldValue: (k in data) ? data[k] : undefined, newValue: items[k] };
          data[k] = items[k];
        });
        emit(changes);
        return Promise.resolve();
      },
      remove: function (keys) {
        var changes = {};
        (keys || []).forEach(function (k) {
          if (k in data) {
            changes[k] = { oldValue: data[k], newValue: undefined };
            delete data[k];
          }
        });
        emit(changes);
        return Promise.resolve();
      },
      bytes: function () {
        try { return Promise.resolve(JSON.stringify(data).length); }
        catch (e) { return Promise.resolve(0); }
      },
      onChange: function (cb) {
        listeners.push(cb);
        return function () {
          var i = listeners.indexOf(cb);
          if (i !== -1) listeners.splice(i, 1);
        };
      }
    };
  }

  /* ---------- chrome.storage.local backend ---------- */

  function chromeStorage() {
    var area = (globalThis.chrome && globalThis.chrome.storage && globalThis.chrome.storage.local) || null;
    if (!area) return memoryArea(); /* graceful degradation — same behavior as v1.0.5 */

    function lastError() {
      return (globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.lastError) || null;
    }

    function get(key) {
      return new Promise(function (res, rej) {
        area.get(key, function (o) {
          var err = lastError();
          if (err) rej(new Error(err.message || 'chrome.storage خطا داد'));
          else res(o || {});
        });
      });
    }

    function set(items) {
      return new Promise(function (res, rej) {
        area.set(items, function () {
          var err = lastError();
          if (err) rej(new Error(err.message || 'chrome.storage خطا داد'));
          else res();
        });
      });
    }

    function remove(keys) {
      return new Promise(function (res, rej) {
        area.remove(keys, function () {
          var err = lastError();
          if (err) rej(new Error(err.message || 'chrome.storage خطا داد'));
          else res();
        });
      });
    }

    function bytes() {
      return new Promise(function (res) {
        if (!area.getBytesInUse) return res(0);
        try {
          area.getBytesInUse(null, function (b) {
            void lastError();
            res(b || 0);
          });
        } catch (e) { res(0); }
      });
    }

    function onChange(cb) {
      var wrapped = function (changes, areaName) {
        if (areaName === 'local') cb(changes || {});
      };
      try {
        globalThis.chrome.storage.onChanged.addListener(wrapped);
      } catch (e) {
        return function () { /* noop */ };
      }
      return function () {
        try { globalThis.chrome.storage.onChanged.removeListener(wrapped); } catch (e) { /* noop */ }
      };
    }

    return { get: get, set: set, remove: remove, bytes: bytes, onChange: onChange };
  }

  HL.backends = HL.backends || {};
  HL.backends.chromeStorage = chromeStorage;
  HL.backends.memoryArea = memoryArea;
})();
