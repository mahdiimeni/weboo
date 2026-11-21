# Weboo — Layouts & Page Shell

There is no SPA router: the dashboard is a **static HTML shell** (`entrypoints/dashboard/index.html`, loaded as `dashboard.html`, the extension's options page) into which React "regions" mount. The settings UI is a **left-side drawer** (`aside.drawer` — it opens from the inline/start edge, RTL-aware) over an overlay, plus four modals. The drawer frame (open/close/Escape/focus) is imperative code (`src/dashboard/chrome.ts`); the sections inside are React regions.

## The static shell — `entrypoints/dashboard/index.html` (the drawer is at the bottom)

```html
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>داشبورد — وبو</title>
  <link rel="stylesheet" href="/globals.css">
  <link rel="stylesheet" href="/dashboard/dashboard.css">
  <!-- Theme anti-flash: CSP-safe (MV3 blocks inline scripts) -->
  <script src="/shared/theme-boot.js"></script>
</head>
<body>

  <!-- Sticky header -->
  <header class="topbar">
    <div class="topbar-in">
      <div class="brand">
        <span class="logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </span>
        <span class="brand-txt">
          <strong data-i18n="app.name">وبو</strong>
          <span class="muted small" data-i18n="dash.brandSub">داشبورد مدیریت</span>
        </span>
        <span class="ver" id="ver" title="نسخه">v0.22.1</span>
      </div>
      <div class="topbar-actions" id="topbar-actions-host"></div>
    </div>
  </header>

  <!-- Body -->
  <main class="container">
    <!-- Stats -->
    <section class="stats" aria-label="آمار کلی">
      <div class="stat-card"><span class="stat-num" id="st-total">۰</span><span class="stat-lbl">کل هایلایت‌ها</span></div>
      <div class="stat-card"><span class="stat-num" id="st-notes">۰</span><span class="stat-lbl">یادداشت‌ها</span></div>
      <div class="stat-card"><span class="stat-num" id="st-pages">۰</span><span class="stat-lbl">صفحات</span></div>
      <div class="stat-card"><span class="stat-num" id="st-sites">۰</span><span class="stat-lbl">سایت‌ها</span></div>
    </section>

    <!-- Filter toolbar -->
    <section class="toolbar" aria-label="فیلتر و جست‌وجو">
      <div class="search-box">
        <svg class="search-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" id="q" placeholder="جست‌وجو در متن، یادداشت یا عنوان صفحه…" aria-label="جست‌وجو">
      </div>
      <div class="filter-row">
        <div class="color-chips" id="color-chips" role="group" aria-label="فیلتر رنگ"></div>
        <label class="switch-box">
          <span class="switch">
            <input type="checkbox" id="f-notes">
            <span class="track"><span class="knob"></span></span>
          </span>
          <span class="switch-lbl">فقط یادداشت‌دار</span>
        </label>
        <div class="seg" id="f-sort" role="radiogroup" aria-label="ترتیب">
          <label class="seg-item active"><input type="radio" name="sort-mode" value="newest" checked><span>جدیدترین</span></label>
          <label class="seg-item"><input type="radio" name="sort-mode" value="oldest"><span>قدیمی‌ترین</span></label>
          <label class="seg-item"><input type="radio" name="sort-mode" value="page"><span>ترتیب خواندن</span></label>
        </div>
      </div>
      <div class="tag-filter" id="tag-filter" hidden>
        <span class="muted small tag-filter-lbl">برچسب مقاله‌ها:</span>
        <div class="tag-chips" id="tag-chips" role="group" aria-label="فیلتر برچسب مقاله‌ها"></div>
      </div>
    </section>

    <!-- Main list -->
    <section class="list-wrap" aria-label="هایلایت‌ها">
      <div class="list-bar">
        <button type="button" class="btn btn-ghost bulk-toggle" id="btn-bulk" hidden></button>
      </div>
      <div id="groups"></div>
      <div id="empty-host"></div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="foot">
    <p class="muted small">وبو — همه‌ی داده‌ها فقط روی همین دستگاه ذخیره می‌شوند؛ هیچ چیزی به سرور ارسال نمی‌شود.</p>
  </footer>

  <!-- Settings panel overlay -->
  <div class="overlay" id="overlay" aria-hidden="true"></div>

  <!-- Settings panel (left-side drawer = start-edge drawer) -->
  <aside class="drawer" id="drawer" role="dialog" aria-modal="false" aria-label="تنظیمات" aria-hidden="true">
    <div class="drawer-head">
      <strong data-i18n="dash.settings">تنظیمات</strong>
      <button type="button" class="icon-btn" id="drawer-close" aria-label="بستن تنظیمات" title="بستن">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="drawer-body">

      <section class="set-sec">
        <h3 data-i18n="dash.sectionAppearance">ظاهر</h3>
        <div class="radio-list" id="theme-radios" role="radiogroup" aria-label="قالب رابط"></div>
      </section>

      <section class="set-sec">
        <h3 data-i18n="lang.label">زبان رابط کاربری</h3>
        <p class="muted small" data-i18n="lang.desc">روی پنجره، داشبورد و ابزارهای شناور فوراً اعمال می‌شود.</p>
        <div id="language-select"></div>
      </section>

      <section class="set-sec">
        <h3 data-i18n="dash.sectionColor">رنگ پیش‌فرض هایلایت</h3>
        <div class="color-dots" id="color-dots" role="radiogroup" aria-label="رنگ پیش‌فرض هایلایت"></div>
      </section>

      <section class="set-sec">
        <h3 data-i18n="dash.sectionBehavior">رفتار</h3>
        <div id="behavior-host"></div>
      </section>

      <section class="set-sec">
        <h3>سایت‌های غیرفعال</h3>
        <p class="muted small">روی این سایت‌ها هایلایت ساخته یا نمایش داده نمی‌شود (داده‌ها حذف نمی‌شوند).</p>
        <div class="host-chips" id="host-chips"></div>
        <div class="host-add">
          <input type="text" id="host-input" placeholder="افزودن دامنه (مثل example.com)" aria-label="دامنه‌ی جدید">
          <button type="button" class="btn btn-ghost" id="host-add">افزودن</button>
        </div>
      </section>

      <div id="restore-sec-host"></div>   <!-- RestoreSectionRegion: backup restore button -->
      <div id="danger-sec-host"></div>    <!-- DangerSectionRegion: delete-all, 3-step confirm -->

    </div>
  </aside>

  <div id="restore-modal-host"></div>
  <div id="booklet-modal-host"></div>
  <div id="backup-modal-host"></div>
  <div id="hl-modal-host"></div>
  <div class="toasts" id="toasts" aria-live="polite"></div>
  <input type="file" id="file-input" accept="application/json,.json" hidden>

  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

## Drawer chrome (frame behavior) — `src/dashboard/chrome.ts`

```ts
import { getData, subscribeData, setDrawerOpen } from "./data";

const SETTINGS_HASH_OPEN = "#hlx-settings";

export function initDrawerChrome(): void {
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  const drawerClose = document.getElementById("drawer-close");
  const btnSettings = document.getElementById("btn-settings");
  if (!drawer || !overlay) return;

  function apply(open: boolean) {
    drawer!.classList.toggle("open", open);
    overlay!.classList.toggle("show", open);
    drawer!.setAttribute("aria-hidden", String(!open));
    if (open) { try { drawerClose?.focus(); } catch (e) { /* noop */ } }
  }
  apply(getData().drawerOpen);
  subscribeData(() => apply(getData().drawerOpen));

  btnSettings?.addEventListener("click", () => setDrawerOpen(true));
  drawerClose?.addEventListener("click", () => setDrawerOpen(false));
  overlay.addEventListener("click", () => setDrawerOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && getData().drawerOpen) setDrawerOpen(false);
  });

  function checkSettingsHash() {
    if ((location.hash || "") !== SETTINGS_HASH_OPEN) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* noop */ }
    setDrawerOpen(true);
  }
  checkSettingsHash();
  window.addEventListener("hashchange", checkSettingsHash);
}
```

## Drawer CSS (the settings panel's current visual language) — from `extension/dashboard/dashboard.css`

```css
.overlay { position: fixed; inset: 0; background: rgba(17, 24, 39, .45); backdrop-filter: blur(4px); z-index: 110; opacity: 0; pointer-events: none; transition: opacity var(--motion) var(--motion-ease); }
.overlay.show { opacity: 1; pointer-events: auto; }

.drawer {
  position: fixed; top: 0; bottom: 0; left: 0;
  width: min(380px, 92vw); z-index: 120;
  background: var(--card);
  border-left: none;
  border-right: 1px solid var(--hairline, var(--line));
  border-radius: 0 var(--r-surface) var(--r-surface) 0; /* soft leading edge (content-facing corners) */
  box-shadow: var(--depth-overlay);
  transform: translateX(-105%);
  transition: transform var(--motion) var(--motion-ease);
  display: flex; flex-direction: column;
}
.drawer.open { transform: translateX(0); }
.drawer-head { flex: none; display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4); border-bottom: 1px solid var(--line); }
.drawer-head strong { font-size: 15px; font-weight: 800; }
.drawer-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 20px; }

.set-sec { display: flex; flex-direction: column; gap: 10px; }
.set-sec h3 { margin: 0; font-size: 13.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: var(--accent-h); }

.danger-zone { border: 1px solid var(--danger-line); background: var(--danger-bg); border-radius: var(--r-surface); padding: var(--sp-4); }
.danger-zone h3 { color: var(--danger-h); }
.danger-flow { display: flex; flex-direction: column; gap: 10px; }
.danger-confirm { display: flex; gap: 6px; flex-wrap: wrap; }
.danger-confirm input { flex: 1; min-width: 160px; border: 1px solid var(--danger-line); border-radius: var(--r-ctl); background: var(--card); color: var(--text); font: inherit; font-size: 13px; padding: 7px 12px; }

.topbar { position: sticky; top: 0; z-index: 100; background: var(--glass, var(--card)); backdrop-filter: blur(10px); border-bottom: 1px solid var(--hairline, var(--line)); }
.topbar-in { max-width: 980px; margin-inline: auto; padding: 10px var(--sp-4); display: flex; align-items: center; gap: 12px; justify-content: space-between; }
.container { max-width: 980px; margin-inline: auto; padding: var(--sp-5) var(--sp-4); }
.stat-card { background: var(--card); border: 1px solid var(--edge, var(--line)); border-radius: var(--r-surface); padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: 2px; min-height: 64px; }
```

## Region wiring — `src/dashboard/App.tsx` (which region renders which drawer host)

- `ThemeRegion` → `#theme-radios` (renders `<ThemeRadios/>` inside a `.radio-list`)
- `LanguageRegion` → `#language-select` (renders `<LanguageSelect/>`)
- `DotsRegion` → `#color-dots` (renders `<ColorDots/>`)
- `SwitchesRegion` → `#behavior-host` (renders `<BehaviorSwitches/>`)
- `HostsRegion` → `.set-sec` around `#host-chips` (renders `<DisabledHosts/>` with section chrome h3/p)
- `RestoreSectionRegion` → `#restore-sec-host` (`.set-sec.restore-sec`: title, desc, full-width ghost button + hidden file input)
- `DangerSectionRegion` → `#danger-sec-host` (`.set-sec.danger-zone`: title with danger icon, desc, arm button → confirm input + go/cancel)
- `TopbarActionsRegion` → `.topbar-actions` (booklet / selective-backup ghost buttons, primary icon export button, ghost icon settings button, size badge)
