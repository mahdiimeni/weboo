/**
 * Weboo — page URL normalization (SRP: the URL concern only)
 *
 * Consumers: content script (current page context — normalizeUrl at boot and
 * watchHref for SPA navigations) and popup (active tab URL).
 * Output: { url, norm, site, host } or null
 *   - url  : clean address without hash and tracking params
 *   - norm : like url + sorted params (page identity key across sessions)
 *
 * Phase 2 migration (TypeScript): compiled by `bun run build:ext` into
 * extension/shared/url.js — never edit the .js directly.
 */
const TRACKING_PARAMS = ['fbclid', 'gclid', 'msclkid', 'igshid', 'mc_cid', 'mc_eid', 'yclid', 'vk_click_id', '_ga', '_gl', 'ref', 'source'];
function normalizeUrl(href) {
    try {
        const u = new URL(String(href));
        u.hash = '';
        u.hostname = u.hostname.toLowerCase();
        if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80'))
            u.port = '';
        const drop = [];
        u.searchParams.forEach(function (v, k) {
            const lk = k.toLowerCase();
            if (lk.indexOf('utm_') === 0 || TRACKING_PARAMS.indexOf(lk) !== -1)
                drop.push(k);
        });
        drop.forEach(function (k) { u.searchParams.delete(k); });
        let path = u.pathname;
        if (path.length > 1 && path.charAt(path.length - 1) === '/')
            path = path.replace(/\/+$/, '');
        const url = u.protocol + '//' + u.host + path + (u.search || '');
        const entries = [];
        u.searchParams.forEach(function (v, k) { entries.push([k, v]); });
        entries.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
        const p2 = new URLSearchParams();
        entries.forEach(function (e) { p2.set(e[0], e[1]); });
        const qs = p2.toString();
        const norm = u.protocol + '//' + u.host + path + (qs ? '?' + qs : '');
        return { url: url, norm: norm, site: u.protocol + '//' + u.host, host: u.hostname };
    }
    catch (e) {
        return null;
    }
}
export const url = { normalizeUrl: normalizeUrl, watchHref: watchHref };
/**
 * Watch for client-side (SPA) navigations — pushState/replaceState have no
 * DOM event, so href is compared on a light interval plus the popstate/
 * hashchange events (all observed on the injected window — DIP, testable).
 * Fires onChange(newHref) once per real href change (deduped).
 * Returns an unwatch() function.
 */
function watchHref(win, onChange, intervalMs) {
    var last = String(win.location.href);
    var check = function () {
        var now = String(win.location.href);
        if (now === last)
            return;
        last = now;
        onChange(now);
    };
    var timer = win.setInterval(check, intervalMs || 400);
    win.addEventListener('popstate', check);
    win.addEventListener('hashchange', check);
    return function unwatch() {
        win.clearInterval(timer);
        win.removeEventListener('popstate', check);
        win.removeEventListener('hashchange', check);
    };
}
