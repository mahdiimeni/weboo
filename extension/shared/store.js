/* ============================================================
   Port type mirror (type-only — erased at emit): StorageBackend below is the
   exact duplicate of src/types/storage.ts StorageBackend; the compile-time
   mutual-assignability tripwire in tests/unit/types-contract.test.ts fails if
   the two ever drift. ReaderBackend = Pick of exactly the members the reader
   validates. File contract: see the header below.
   ============================================================ */
import { APP_ID, APP_NAME, BACKUP_FORMAT, VERSION, COLORS, DEFAULT_SETTINGS } from "./constants.js";
import { tags as tagRules } from "./tags.js";
/**
 *
 * GENERATED TARGET — this source (src/shared/store.ts) compiles to
 * extension/shared/store.js via `bun run build:ext`; edit HERE, never the .js.
 * Web Highlighter — storage domain layer (pure of chrome.*)
 *
 * Per-host partitioning for fast reads of the same site's data:
 *   hlx:settings  → user settings
 *   hlx:d:<host>  → { <id>: Record }
 *   hlx:f:<host>  → { icon: dataURL, capturedAt }  ← favicon captured from the page itself
 *   hlx:tags      → { <urlNorm>: [tag, …] }        ← article tags (v1.2.15, article-scoped)
 * Export/Import: versioned JSON backup (favicons and article tags are included
 * in the backup). Tag values are normalized through HL.tags (shared/tags.js —
 * loaded before this file everywhere) — the same integrity-gate pattern as
 * sanitizeFaviconMeta.
 *
 * Schema versioning (Phase 4): hlx:schemaVersion (number) marks the shape a
 * build reads/writes; absence = legacy v0 (the pre-versioning shape IS v1).
 * Forward-only migrations live in MIGRATIONS below; the first store operation
 * awaits migrated() (one memoized gate for reads and writes) — nothing can
 * overtake it, a backend error surfaces at that first op and is retried on the
 * next one (the memo resets), never stamped over.
 * Data-safety rules: stamp each step only after its run() succeeded; a gap in
 * the chain stamps nothing (data beats cosmetics); a stored version newer than
 * ours (user downgraded) is never touched. clearAll wipes user keys but keeps
 * the version (empty storage = current shape). The backup format has its own
 * contract (BACKUP_FORMAT + sanitize gates on import) and stays unchanged.
 * createContext note: createStoreReader never migrates (read-only ISP role) —
 * settings reads are default-merged, so new keys default in; a future migration
 * that REWRITES settings must run from a writer context first.
 *
 * DIP: this module is a factory — HL.createStore(backend) — and instead of a
 * direct chrome.storage dependency it accepts any backend implementing the
 * port contract (chrome-storage / in-memory). Wiring happens in the
 * "composition root" of each entry point: content/popup/dashboard build a
 * LOCAL store and inject it (cfg.store for the highlighter — no namespace
 * slot); the SW wires the read-only reader.
 *
 * Write/read consistency:
 *  - writes are read-modify-write; to prevent data being swallowed by
 *    concurrent writes (e.g. a batched heal + a user save), all public writes
 *    go through a single-threaded queue (enqueueWrite).
 *  - public reads first drain the queue (read-your-writes) so a reader right
 *    after a write sees fresh data.
 *  - internal in-queue calls (e.g. importData → clearAll+saveMany) use the raw
 *    non-draining variants so no deadlock can occur.
 *
 * Phase 5 migration (TypeScript): this file is the source of truth and is
 * compiled by `bun run build:ext` (tsconfig.extension.json) into
 * extension/shared/store.js — never edit the .js directly. Classic-script
 * invariant: NO import/export (would emit `export {};` — see textindex.ts).
 * The port type below is declared GLOBAL (script file, erased at emit) and
 * is pinned byte-for-byte to src/types/storage.ts by the compile-time
 * mutual-assignability tripwire in tests/unit/types-contract.test.ts.
  */
(function () {
    'use strict';
    const HL = (globalThis.HL = globalThis.HL || {}); /* unknown hop: entrypoints/background.ts pulls the classic JS into the program and infers globalThis.HL */
    var K_SETTINGS = 'hlx:settings';
    var P_DATA = 'hlx:d:';
    var P_FAVICON = 'hlx:f:';
    var K_TAGS = 'hlx:tags';
    var K_SCHEMA = 'hlx:schemaVersion';
    /* The shape this build reads/writes (v1 = the explicit name for the
       pre-versioning shape — no data rewritten when versioning landed). */
    var SCHEMA_VERSION = 1;
    function dataKey(host) { return P_DATA + host; }
    function faviconKey(host) { return P_FAVICON + host; }
    /* Max icon dataURL length (base64) — real favicons are a few kilobytes;
       this is a protective cap for huge files/unusual SVGs. */
    var FAVICON_MAX_URL = 200000;
    /** Validates/sanitizes favicon meta; invalid → null (the consumer keeps the first letter) */
    function sanitizeFaviconMeta(m) {
        if (!m || typeof m !== 'object')
            return null;
        /* untrusted input — the guard below IS the validation (fields checked inline) */
        var icon = String(m.icon || '');
        if (icon.indexOf('data:image/') !== 0 || icon.length > FAVICON_MAX_URL)
            return null;
        var host = String(m.host || '');
        if (!host || /\s|\/|:/.test(host) || host.length > 253)
            return null;
        var at = Number(m.capturedAt);
        return { host: host, icon: icon, capturedAt: (at > 0 ? at : Date.now()) };
    }
    function mergeSettings(s) {
        return Object.assign({}, DEFAULT_SETTINGS, s || {});
    }
    /**
     * Ordered, forward-only schema migrations: { from, to, run(backend) }.
     * Rules (data safety — do not relax):
     *  - run() must be IDEMPOTENT: contexts boot concurrently (content + popup
     *    can both start the same step) and a crash after run() but before the
     *    stamp makes the next boot re-run it;
     *  - run() writes only what it transforms; the version key is stamped by the
     *    runner AFTER success, once per step (crash mid-chain resumes at step);
     *  - a missing/invalid step → stamp NOTHING for the remaining gap;
     *  - stored > target (downgrade) → hands off, no backward migration.
     * ponytail: when the record schema first changes (TS-era fields), the first
     * real step lands here — target stays at SCHEMA_VERSION and bump it.
     */
    var MIGRATIONS = [
        { from: 0, to: 1, run: async function () { } }
    ];
    async function migrateSchema(backend, opts) {
        var target = (opts && opts.schemaVersion) || SCHEMA_VERSION;
        var steps = (opts && opts.migrations) || MIGRATIONS;
        var o = await backend.get(K_SCHEMA);
        var stored = Number(o ? o[K_SCHEMA] : undefined);
        if (!(stored >= 0))
            stored = 0; /* absent / garbage → legacy v0 */
        if (stored >= target)
            return stored; /* current or newer: forward-only */
        var v = stored;
        while (v < target) {
            var step = null;
            for (var i = 0; i < steps.length; i++)
                if (steps[i] && steps[i].from === v)
                    step = steps[i];
            if (!step || typeof step.run !== 'function' || !(step.to > v) || step.to > target)
                return v; /* gap: no stamp */
            await step.run(backend);
            var stamp = {};
            stamp[K_SCHEMA] = step.to;
            await backend.set(stamp);
            v = step.to;
        }
        return v;
    }
    /**
     * Builds a store on top of a backend.
     * The output is the same facade as previous versions so consumers work unchanged.
     * opts (optional, injected like the backend): { schemaVersion, migrations } —
     * the migration chain's collaborators; production callers pass nothing.
     */
    function createStore(backend, opts) {
        if (!backend ||
            typeof backend.get !== 'function' ||
            typeof backend.set !== 'function' ||
            typeof backend.remove !== 'function' ||
            typeof backend.bytes !== 'function' ||
            typeof backend.onChange !== 'function') {
            throw new Error('HL.createStore: بک‌اند باید قرارداد پورت ذخیره‌سازی (get/set/remove/bytes/onChange) را پیاده کند.');
        }
        /* ---------- Write queue + read draining ---------- */
        var writeTail = Promise.resolve();
        /* Schema migration gate: memoized until it settles; a failure resets the
           memo so the NEXT operation retries (transient storage errors heal) and
           surfaces at THIS operation — data is left untouched/unstamped. */
        var migrationP = null;
        function migrated() {
            if (!migrationP) {
                migrationP = migrateSchema(backend, opts).catch(function (e) {
                    migrationP = null;
                    throw e;
                });
            }
            return migrationP;
        }
        /** Runs the job at the tail of the write queue; a previous error doesn't break the chain */
        function enqueueWrite(job) {
            /* every write first passes the migration gate — ordering without touching call sites */
            var run = writeTail.then(migrated, migrated).then(job);
            writeTail = run.then(function () { }, function () { });
            return run;
        }
        /** Public read: migration first, then waits for previous writes */
        async function drained() {
            await migrated();
            await writeTail.then(function () { return true; }, function () { return false; });
        }
        /* ---------- Raw reads (for inside queue jobs) ---------- */
        function getRaw(key, def) {
            return backend.get(key).then(function (o) {
                return (o && key in o) ? o[key] : def;
            });
        }
        async function setRaw(obj) {
            if (!obj || !Object.keys(obj).length)
                return;
            await backend.set(obj);
        }
        function getAllRaw() { return backend.get(null); }
        function makeObj(k, v) { var o = {}; o[k] = v; return o; }
        async function getSettingsRaw() {
            var s = await getRaw(K_SETTINGS, {});
            return mergeSettings(s);
        }
        async function getHostMapRaw(host) {
            var m = await getRaw(dataKey(host), {});
            return (m || {});
        }
        async function getForUrlRaw(urlNorm, host) {
            var m = await getHostMapRaw(host);
            var out = new Map();
            Object.keys(m).forEach(function (id) {
                var r = m[id];
                if (r && r.urlNorm === urlNorm)
                    out.set(id, r);
            });
            return out;
        }
        async function getFaviconRaw(host) {
            var m = await getRaw(faviconKey(host), null);
            return sanitizeFaviconMeta(m && Object.assign({}, m, { host: host }));
        }
        async function setFaviconRaw(host, meta) {
            var clean = sanitizeFaviconMeta(Object.assign({}, meta || {}, { host: host }));
            if (!clean)
                return null;
            await setRaw(makeObj(faviconKey(host), clean));
            return clean;
        }
        async function getFaviconMapRaw() {
            var all = await getAllRaw();
            var out = {};
            Object.keys(all).forEach(function (k) {
                if (k.indexOf(P_FAVICON) !== 0)
                    return;
                var clean = sanitizeFaviconMeta(Object.assign({}, all[k], { host: k.slice(P_FAVICON.length) }));
                if (clean)
                    out[clean.host] = clean;
            });
            return out;
        }
        /* ---------- Article tags (v1.2.15) — raw ---------- */
        async function getTagsRaw() {
            var m = await getRaw(K_TAGS, {});
            return tagRules.normalizeTagMap(m);
        }
        async function setArticleTagsRaw(urlNorm, tags) {
            var key = String(urlNorm || '');
            if (!key)
                return;
            var clean = tagRules.sanitizeTagList(tags);
            var m = await getTagsRaw();
            if (clean.length)
                m[key] = clean;
            else
                delete m[key]; /* an emptied list removes the article from the map */
            await setRaw(makeObj(K_TAGS, m));
            return m;
        }
        async function removeArticleTagsRaw(urlNorm) {
            var key = String(urlNorm || '');
            if (!key)
                return false;
            var m = await getTagsRaw();
            if (!(key in m))
                return false;
            delete m[key];
            await setRaw(makeObj(K_TAGS, m));
            return true;
        }
        async function getAllRecordsRaw() {
            var all = await getAllRaw();
            var out = new Map();
            Object.keys(all).forEach(function (k) {
                if (k.indexOf(P_DATA) !== 0)
                    return;
                var m = (all[k] || {});
                Object.keys(m).forEach(function (id) {
                    var r = m[id];
                    if (r && r.id)
                        out.set(id, r);
                });
            });
            return out;
        }
        async function hostsWithDataRaw() {
            var all = await getAllRaw();
            return Object.keys(all).filter(function (k) { return k.indexOf(P_DATA) === 0; }).map(function (k) { return k.slice(6); });
        }
        /* ---------- Raw writes (for inside queue jobs) ---------- */
        async function setSettingsRaw(patch) {
            var cur = await getSettingsRaw();
            var next = Object.assign({}, cur, patch || {});
            await setRaw(makeObj(K_SETTINGS, next));
            return next;
        }
        async function saveManyRaw(recs) {
            if (!recs || !recs.length)
                return;
            var byHost = {};
            recs.forEach(function (r) {
                if (!r || !r.id || !r.host)
                    return;
                byHost[r.host] = byHost[r.host] || {};
                byHost[r.host][r.id] = r;
            });
            var obj = {};
            var hosts = Object.keys(byHost);
            for (var i = 0; i < hosts.length; i++) {
                var h = hosts[i];
                var m = await getHostMapRaw(h);
                Object.assign(m, byHost[h]);
                obj[dataKey(h)] = m;
            }
            await setRaw(obj);
        }
        async function removeRaw(id, hostHint) {
            var hosts = hostHint ? [hostHint] : await hostsWithDataRaw();
            var obj = {};
            var found = false;
            for (var i = 0; i < hosts.length; i++) {
                var m = await getHostMapRaw(hosts[i]);
                if (m[id]) {
                    delete m[id];
                    obj[dataKey(hosts[i])] = m;
                    found = true;
                }
            }
            if (found)
                await setRaw(obj);
            return found;
        }
        async function removeManyRaw(ids, hostHint) {
            var idSet = {};
            (ids || []).forEach(function (i) { idSet[i] = 1; });
            var hosts = hostHint ? [hostHint] : await hostsWithDataRaw();
            var obj = {};
            var any = false;
            for (var i = 0; i < hosts.length; i++) {
                var m = await getHostMapRaw(hosts[i]);
                var changed = false;
                Object.keys(m).forEach(function (id) { if (idSet[id]) {
                    delete m[id];
                    changed = true;
                } });
                if (changed) {
                    obj[dataKey(hosts[i])] = m;
                    any = true;
                }
            }
            if (any)
                await setRaw(obj);
        }
        async function removeForUrlRaw(urlNorm, host) {
            var m = await getHostMapRaw(host);
            var out = {};
            var changed = false;
            Object.keys(m).forEach(function (id) {
                var r = m[id];
                if (r && r.urlNorm === urlNorm) {
                    changed = true;
                    return;
                }
                out[id] = r;
            });
            if (changed)
                await setRaw(makeObj(dataKey(host), out));
            return changed;
        }
        async function clearAllRaw() {
            var all = await getAllRaw();
            /* hlx:schemaVersion is schema metadata, not user data: an empty store IS
               the current shape — wiping the stamp would re-run legacy steps for nothing */
            var keys = Object.keys(all).filter(function (k) { return k.indexOf('hlx:') === 0 && k !== K_SCHEMA; });
            if (keys.length)
                await backend.remove(keys);
        }
        /* ---------- Public API: reads drain, writes queue ---------- */
        async function getSettings() {
            await drained();
            return getSettingsRaw();
        }
        function setSettings(patch) {
            return enqueueWrite(function () { return setSettingsRaw(patch); });
        }
        async function getHostMap(host) {
            await drained();
            return getHostMapRaw(host);
        }
        async function getForUrl(urlNorm, host) {
            await drained();
            return getForUrlRaw(urlNorm, host);
        }
        async function getFavicon(host) {
            await drained();
            return getFaviconRaw(host);
        }
        function setFavicon(host, meta) {
            return enqueueWrite(function () { return setFaviconRaw(host, meta); });
        }
        async function getFaviconMap() {
            await drained();
            return getFaviconMapRaw();
        }
        async function getTags() {
            await drained();
            return getTagsRaw();
        }
        function setArticleTags(urlNorm, tags) {
            return enqueueWrite(function () { return setArticleTagsRaw(urlNorm, tags); });
        }
        function removeArticleTags(urlNorm) {
            return enqueueWrite(function () { return removeArticleTagsRaw(urlNorm); });
        }
        async function getAllRecords() {
            await drained();
            return getAllRecordsRaw();
        }
        async function hostsWithData() {
            await drained();
            return hostsWithDataRaw();
        }
        function save(rec) {
            return enqueueWrite(function () { return saveManyRaw([rec]); });
        }
        function saveMany(recs) {
            return enqueueWrite(function () { return saveManyRaw(recs); });
        }
        function remove(id, hostHint) {
            return enqueueWrite(function () { return removeRaw(id, hostHint); });
        }
        function removeMany(ids, hostHint) {
            return enqueueWrite(function () { return removeManyRaw(ids, hostHint); });
        }
        function removeForUrl(urlNorm, host) {
            return enqueueWrite(function () { return removeForUrlRaw(urlNorm, host); });
        }
        function clearAll() {
            return enqueueWrite(function () { return clearAllRaw(); });
        }
        /* ---------- Backup ---------- */
        async function exportData() {
            await drained();
            var settings = await getSettingsRaw();
            var highlights = {};
            var records = await getAllRecordsRaw();
            records.forEach(function (r, id) { highlights[id] = r; });
            var favicons = await getFaviconMapRaw();
            var tags = await getTagsRaw();
            return {
                app: APP_ID,
                name: APP_NAME,
                format: BACKUP_FORMAT,
                version: VERSION,
                exportedAt: Date.now(),
                settings: settings,
                highlights: highlights,
                favicons: favicons,
                tags: tags,
                meta: { count: Object.keys(highlights).length }
            };
        }
        var RECORD_FIELDS = ['id', 'host', 'site', 'url', 'urlNorm', 'title', 'text', 'prefix', 'suffix', 'start', 'end', 'anchor', 'color', 'note', 'createdAt', 'updatedAt'];
        function sanitizeRecord(r, id) {
            var out = {};
            RECORD_FIELDS.forEach(function (f) { if (r[f] !== undefined)
                out[f] = r[f]; });
            out.id = r.id || id;
            out.host = String(r.host || '');
            out.site = String(r.site || '');
            out.url = String(r.url || '');
            out.urlNorm = String(r.urlNorm || r.url || '');
            out.title = String(r.title || '');
            out.text = String(r.text || '');
            out.prefix = String(r.prefix || '');
            out.suffix = String(r.suffix || '');
            out.color = (COLORS && COLORS[r.color]) ? r.color : 'yellow';
            out.note = String(r.note || '');
            out.createdAt = Number(r.createdAt) || Date.now();
            out.updatedAt = Number(r.updatedAt) || out.createdAt;
            return out;
        }
        /**
         * Imports a backup (itself runs inside the write queue).
         * mode='merge': new records are added, duplicates resolved by updatedAt (newer wins)
         * mode='replace': everything is cleared and replaced (settings are rewritten too)
         */
        async function importDataRaw(backup, mode) {
            var report = { added: 0, updated: 0, skipped: 0, removed: 0 };
            if (!backup || backup.app !== APP_ID || !backup.highlights || typeof backup.highlights !== 'object') {
                throw new Error('فایل پشتیبان معتبر «وب هایلایتر» نیست.');
            }
            var current = await getAllRecordsRaw();
            if (mode === 'replace') {
                await clearAllRaw();
                report.removed = current.size;
                if (backup.settings) {
                    await setRaw(makeObj(K_SETTINGS, mergeSettings(backup.settings)));
                }
            }
            var incoming = [];
            Object.keys(backup.highlights).forEach(function (id) {
                var r = backup.highlights[id];
                if (!r || !r.text || !r.urlNorm || !r.host) {
                    report.skipped++;
                    return;
                }
                var clean = sanitizeRecord(r, id);
                if (mode === 'merge' && current.has(id)) {
                    var old = current.get(id);
                    if ((clean.updatedAt || 0) > (old.updatedAt || 0)) {
                        incoming.push(clean);
                        report.updated++;
                    }
                    else
                        report.skipped++;
                }
                else {
                    incoming.push(clean);
                    report.added++;
                }
            });
            await saveManyRaw(incoming);
            /* Backup favicons: only valid metas; in merge the newer version (capturedAt) wins */
            if (backup.favicons && typeof backup.favicons === 'object') {
                var curFav = await getFaviconMapRaw();
                var favObj = {};
                Object.keys(backup.favicons).forEach(function (h) {
                    var clean = sanitizeFaviconMeta(Object.assign({}, backup.favicons[h], { host: h }));
                    if (!clean)
                        return;
                    if (mode === 'merge' && curFav[h] && (curFav[h].capturedAt || 0) >= (clean.capturedAt || 0))
                        return;
                    favObj[faviconKey(h)] = clean;
                });
                await setRaw(favObj);
            }
            /* Article tags (v1.2.15): merge = per-article union (a tag set can only
               grow — tags carry no timestamps, exactly like merge never deletes
               records); replace = wholesale swap after clearAll. A backup without
               `tags` keeps (merge) / clears (replace — clearAll already wiped them)
               the current tags, mirroring the highlights' behavior. */
            if (backup.tags && typeof backup.tags === 'object') {
                var incTags = tagRules.normalizeTagMap(backup.tags);
                if (mode === 'replace') {
                    await setRaw(makeObj(K_TAGS, incTags));
                }
                else {
                    var curTags = await getTagsRaw();
                    var mergedTags = Object.assign({}, curTags);
                    Object.keys(incTags).forEach(function (k) {
                        mergedTags[k] = tagRules.sanitizeTagList((curTags[k] || []).concat(incTags[k]));
                    });
                    await setRaw(makeObj(K_TAGS, mergedTags));
                }
            }
            return report;
        }
        function importData(backup, mode) {
            return enqueueWrite(function () { return importDataRaw(backup, mode); });
        }
        /* ---------- Change listening (backend-agnostic) ---------- */
        function onSettingsChanged(cb) {
            return backend.onChange(function (changes) {
                if (changes[K_SETTINGS])
                    cb(mergeSettings(changes[K_SETTINGS].newValue));
            });
        }
        function onRecordsChanged(cb) {
            return backend.onChange(function (changes) {
                var keys = Object.keys(changes).filter(function (k) { return k.indexOf(P_DATA) === 0; });
                if (keys.length)
                    cb();
            });
        }
        function onTagsChanged(cb) {
            return backend.onChange(function (changes) {
                if (changes[K_TAGS])
                    cb();
            });
        }
        async function getBytesInUse() {
            await drained();
            return backend.bytes();
        }
        return {
            getSettings: getSettings,
            setSettings: setSettings,
            getHostMap: getHostMap,
            getForUrl: getForUrl,
            getFavicon: getFavicon,
            setFavicon: setFavicon,
            getFaviconMap: getFaviconMap,
            getTags: getTags,
            setArticleTags: setArticleTags,
            removeArticleTags: removeArticleTags,
            getAllRecords: getAllRecords,
            hostsWithData: hostsWithData,
            save: save,
            saveMany: saveMany,
            remove: remove,
            removeMany: removeMany,
            removeForUrl: removeForUrl,
            clearAll: clearAll,
            exportData: exportData,
            importData: importData,
            onSettingsChanged: onSettingsChanged,
            onRecordsChanged: onRecordsChanged,
            onTagsChanged: onTagsChanged,
            getBytesInUse: getBytesInUse
        };
    }
    /**
     * Read-only slice of the storage port (ISP: the "settings reader" role).
     * Example consumer: the service worker — which never writes and shouldn't
     * see the full 17-method facade. It has the same contract validation;
     * reads go straight to the backend (no write queue, since no writes
     * originate from this role; read-your-writes applies within the same context).
     * Contract: { getSettings() → Promise<Settings>,
     *            onSettingsChanged(cb) → unsubscribe,
     *            onRecordsChanged(cb) → unsubscribe }
     */
    function createStoreReader(backend) {
        if (!backend ||
            typeof backend.get !== 'function' ||
            typeof backend.onChange !== 'function') {
            throw new Error('HL.createStoreReader: بک‌اند باید get و onChange را پیاده کند.');
        }
        async function getSettings() {
            var o = await backend.get(K_SETTINGS);
            return mergeSettings((o && K_SETTINGS in o) ? o[K_SETTINGS] : {});
        }
        function onSettingsChanged(cb) {
            return backend.onChange(function (changes) {
                if (changes[K_SETTINGS])
                    cb(mergeSettings(changes[K_SETTINGS].newValue));
            });
        }
        function onRecordsChanged(cb) {
            return backend.onChange(function (changes) {
                var keys = Object.keys(changes).filter(function (k) { return k.indexOf(P_DATA) === 0; });
                if (keys.length)
                    cb();
            });
        }
        return {
            getSettings: getSettings,
            onSettingsChanged: onSettingsChanged,
            onRecordsChanged: onRecordsChanged
        };
    }
    HL.createStore = createStore;
    HL.createStoreReader = createStoreReader;
})();
/* identity export (7c-1): read the namespace the IIFE above assigned —
   same instance every classic/module consumer shares. */
export const createStore = globalThis.HL.createStore;
export const createStoreReader = globalThis.HL.createStoreReader;
