/**
 * Weboo — localization core (SRP: language state + translation lookup)
 *
 * One shared i18n layer for EVERY surface: React dashboard, popup, content
 * widgets (Shadow DOM), toasts, the service worker's context menu and the
 * generated export documents. Pure, DOM-optional, React-free, platform-free —
 * the same port pattern as the rest of src/shared.
 *
 * Design:
 *  - The ENGLISH dictionary is the canonical key set (`TranslationKey`); the
 *    Persian dictionary is typed `Record<TranslationKey, …>` — a key present
 *    in one and missing in the other is a COMPILE error (types-contract test
 *    re-pins it at runtime; a grep test covers the JS-only call sites).
 *  - `t(key, params)` interpolates `{name}` placeholders. A plural value is
 *    `{ one, other }` and picks `one` only for n === 1 (English; Persian has
 *    no plural after numerals — its entries stay plain strings).
 *  - A missing key degrades to the OTHER language, then to the key itself —
 *    never an empty UI; the completeness tests make this path unreachable.
 *  - Language state is module-scoped with explicit ownership: composition
 *    roots set it from settings (content.js / popup.js / dashboard data.ts /
 *    the service worker); `onChange` subscriptions keep it from leaking.
 *  - Direction is a UI-language property (dirOf): fa → rtl, en → ltr. It is
 *    INDEPENDENT of content direction (shared/detect-dir.js stays the single
 *    source for article/page content).
 *  - `applyDom` translates static page markup via data-i18n* attributes —
 *    the popup and the dashboard shell keep their byte-stable templates and
 *    stay the markup contract; the attributes are the only addition.
 *
 * Compiled by `bun run build:ext` into extension/shared/i18n.js — never edit
 * the .js. Loaded right after shared/constants.js everywhere (manifest list
 * + every page/entry import); format.js consumes it for language-aware
 * number/date rendering.
 */

export type Language = 'fa' | 'en';

/** A plural-capable value: English picks `one` for exactly n === 1. */
export interface Plural {
  one: string;
  other: string;
}

type DictValue = string | Plural;

type Params = Record<string, string | number>;

/* ------------------------------------------------------------------ */
/* English — the canonical key set                                     */
/* ------------------------------------------------------------------ */

const en = {
  /* ---------- app identity (display only — the APP_NAME registry, manifest,
     storage and backups stay single-source; see constants.js) ---------- */
  'app.name': 'Weboo',

  /* ---------- common ---------- */
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.add': 'Add',
  'common.confirm': 'Sure?',
  'common.version': 'Version',
  'common.untitled': 'Untitled',
  'common.localFile': 'Local file',
  'common.from': ' from ',
  'common.copy': 'Copy text',
  'common.copyShort': 'Copy',
  'common.copyOk': 'Copied ✓',
  'common.copyFail': 'Copy failed',
  'common.saveFail': 'Saving settings failed',
  'common.deleteFail': 'Delete failed',
  'common.nHighlights': { one: '1 highlight', other: '{n} highlights' },
  'common.nNotes': { one: '1 note', other: '{n} notes' },
  'common.nArticles': { one: '1 article', other: '{n} articles' },
  'common.nItems': { one: '1 item', other: '{n} items' },

  /* ---------- colors (the COLORS registry keys) ---------- */
  'color.yellow': 'Yellow',
  'color.orange': 'Orange',
  'color.green': 'Green',
  'color.teal': 'Teal',
  'color.pink': 'Pink',
  'color.purple': 'Purple',

  /* ---------- themes (the THEMES registry keys) ---------- */
  'theme.auto': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.autoHint': 'Follows the system light/dark setting',
  'theme.lightHint': 'Always a light background',
  'theme.darkHint': 'Always a dark background',

  /* ---------- interface language ---------- */
  'lang.label': 'Interface language',
  'lang.fa': 'Persian',
  'lang.en': 'English',

  /* ---------- dashboard shell (static markup via data-i18n) ---------- */
  'dash.title': 'Dashboard — Weboo',
  'dash.brandSub': 'Management dashboard',
  'dash.statsAria': 'Overall stats',
  'dash.toolbarAria': 'Filter and search',
  'dash.listAria': 'Highlights',
  'dash.footer': 'Weboo — all data stays on this device only; nothing is sent to any server.',
  'dash.settings': 'Settings',
  'dash.settingsAria': 'Settings',
  'dash.drawerCloseAria': 'Close settings',
  'dash.sectionAppearance': 'Appearance',
  'dash.sectionColor': 'Default highlight color',
  'dash.sectionBehavior': 'Behavior',
  'dash.themeGroupAria': 'Interface theme',
  'lang.groupAria': 'Interface language',
  'dots.title': 'Default color: {name}',
  'behavior.toolbar': 'Show the floating toolbar when text is selected',
  'behavior.badge': 'Show the counter on the icon',

  /* ---------- dashboard topbar ---------- */
  'tb.booklet': 'Booklet',
  'tb.selectiveBackup': 'Selective export',
  'tb.selectiveBackupTitle': 'Selective backup — by sites, articles and tags',
  'tb.backup': 'Backup export',
  'tb.backupTitle': 'Backup export (whole library)',
  'tb.sizeBadgeTitle': 'Size of the data stored on this device',

  /* ---------- dashboard stats ---------- */
  'stats.total': 'Total highlights',
  'stats.notes': 'Notes',
  'stats.pages': 'Pages',
  'stats.sites': 'Sites',

  /* ---------- dashboard filter toolbar ---------- */
  'search.placeholder': 'Search text, notes or page titles…',
  'search.aria': 'Search',
  'filter.colorAria': 'Color filter',
  'filter.notesOnly': 'With notes only',
  'filter.sortLabel': 'Sort:',
  'sort.newest': 'Newest',
  'sort.oldest': 'Oldest',
  'sort.page': 'By page',
  'filter.tagsLabel': 'Article tags:',
  'filter.tagsAria': 'Article tag filter',

  /* ---------- list chrome ---------- */
  'bulk.expand': 'Expand all articles',
  'bulk.expandTitle': 'All article cards open, and every unloaded highlight loads too',
  'bulk.collapse': 'Collapse all articles',
  'bulk.collapseTitle': 'All article cards close and every unloaded highlight loads too; opening any article then shows its highlights in full',
  'list.loadMore': 'Load more ({n} remaining)',
  'empty.noResults': 'No results found.',
  'empty.noResultsSub': 'Try a different search phrase or color/tag filters.',
  'empty.first': 'No highlights yet. Select your first text!',
  'empty.firstSub': 'On any web page, select text and use the extension’s floating toolbar.',
  'dirsec.rtl': 'Right-to-left',
  'dirsec.ltr': 'Left-to-right',
  'dirsec.lead': 'Latest highlight lives here',
  'dirsec.leadTitle': 'The most recently highlighted article is in this section, so it is shown first',

  /* ---------- article card ---------- */
  'card.order.newest': 'Newest',
  'card.order.oldest': 'Oldest',
  'card.order.page': 'Page',
  'card.order.pageRev': 'Page reversed',
  'card.order.newestTitle': 'Highlights are currently ordered newest first; press to reverse the order',
  'card.order.oldestTitle': 'Highlights are currently ordered oldest first; press to reverse the order',
  'card.order.pageTitle': 'Highlights are currently in page (reading) order; press to reverse the order',
  'card.order.pageRevTitle': 'Highlights are currently in reversed page order; press to restore reading order',
  'card.orderAria': 'Highlight order for this article: {label}',
  'card.viewPageTitle': 'Open this page in a new tab',
  'card.deleteGroupTitle': 'Delete everything from this page',
  'card.remaining': '…{n} more from this page (press “Load more” to show them)',

  /* ---------- highlight item ---------- */
  'item.previewTitle': 'Show this highlight’s full text',
  'item.notePreviewTitle': 'Show this highlight’s full text and note',
  'item.viewTitle': 'View on page',
  'item.deleteTitle': 'Delete this highlight',

  /* ---------- tags row ---------- */
  'tags.add': 'Tag',
  'tags.addTitle': 'Add a tag to this article',
  'tags.placeholder': 'Tag name…',
  'tags.inputAria': 'New tag name',
  'tags.removeTitle': 'Remove tag {tag}',

  /* ---------- disabled hosts ---------- */
  'hosts.title': 'Disabled sites',
  'hosts.desc': 'No highlights are created or shown on these sites (data is kept).',
  'hosts.empty': 'No sites are disabled yet.',
  'hosts.addPlaceholder': 'Add a domain (e.g. example.com)',
  'hosts.inputAria': 'New domain',
  'hosts.invalid': 'Enter a valid domain (e.g. example.com)',
  'hosts.duplicate': 'This domain is already in the list',
  'hosts.disabledOk': '{host} is now disabled',
  'hosts.removeTitle': 'Remove {host}',

  /* ---------- language section (dashboard settings) ---------- */
  'lang.desc': 'Applies to the popup, dashboard and floating tools — instantly.',

  /* ---------- restore section + modal ---------- */
  'restore.title': 'Restore backup',
  'restore.desc': 'Pick a JSON backup file; you will choose merge or full replace before anything runs.',
  'restore.fileFail': 'Could not open the file',
  'modal.name': 'Collection name',
  'modal.highlights': 'Highlights',
  'modal.exportDate': 'Export date',
  'modal.type': 'Type',
  'modal.partialValue': 'Selective backup (part of the library)',
  'modal.merge': 'Merge',
  'modal.mergeDesc': 'Newer records win; current data is kept.',
  'modal.replace': 'Full replace',
  'modal.replaceDesc': 'All current data will be deleted!',
  'modal.start': 'Start restore',

  /* ---------- danger zone ---------- */
  'danger.title': 'Danger zone',
  'danger.desc': 'This cannot be undone — export a backup first.',
  'danger.arm': 'Delete all highlights and notes',
  'danger.placeholder': 'To confirm, type “delete”',
  'danger.inputAria': 'Confirm deletion',
  'danger.go': 'Confirm and delete',
  'danger.done': 'All highlights and notes were deleted',

  /* ---------- restore/booklet/backup modals ---------- */
  'bk.title': 'Booklet & Markdown',
  'bk.mdDesc': 'For Obsidian and any Markdown editor — the whole library in one file, one section per article.',
  'bk.mdBtn': 'Download Markdown file',
  'bk.pickerTitle': 'Booklet articles',
  'bk.pickerHint': 'With nothing selected every article goes into the booklet; with a selection, only these.',
  'bk.pickerAria': 'Select booklet articles',
  'bk.allArticles': 'All articles will be in the booklet.',
  'bk.pickedStatus': '{n} highlights from {m} articles will be in the booklet.',
  'bk.printTitle': 'Printable booklet',
  'bk.printDesc': 'Designed for A4 printing — cover, table of contents, and one article per page.',
  'bk.formatAria': 'Booklet format',
  'bk.html': 'HTML file',
  'bk.htmlDesc': 'A print-ready file — open it in the browser and press Ctrl+P.',
  'bk.pdf': 'PDF',
  'bk.pdfDesc': 'The browser’s print dialog opens — choose “Save as PDF”.',
  'bk.colorAria': 'Booklet color mode',
  'bk.color': 'Color',
  'bk.colorDesc': 'With the highlights’ original colors',
  'bk.bw': 'Black & white',
  'bk.bwDesc': 'Less ink — good for a regular printer',
  'bk.fontAria': 'Booklet font',
  'bk.fontDefault': '{name} — default',
  'bk.fontDesc': 'If it is not installed, the browser shows a similar font',
  'bk.fontCustom': 'Custom font',
  'bk.fontCustomDesc': 'Any font installed on your device — type its exact name',
  'bk.fontCustomPlaceholder': 'e.g. B Nazanin',
  'bk.build': 'Build booklet',
  'sel.title': 'Selective backup',
  'sel.desc': 'Export part of the library — any site, article or tag you pick brings its highlights into the file.',
  'sel.sites': 'Sites',
  'sel.sitesHint': 'All highlights from these sites',
  'sel.sitesAria': 'Select sites',
  'sel.articles': 'Articles',
  'sel.articlesHint': 'Highlights from these articles',
  'sel.articlesAria': 'Select articles',
  'sel.tags': 'Tags',
  'sel.tagsHint': 'All highlights from articles carrying this tag',
  'sel.tagsAria': 'Select tags',
  'sel.emptySites': 'No sites yet',
  'sel.emptyArticles': 'No articles yet',
  'sel.emptyTags': 'No tags yet',
  'sel.pickOne': 'Pick at least one item.',
  'sel.noMatch': 'No highlights match this selection.',
  'sel.status': { one: '1 highlight will be in the file.', other: '{n} highlights will be in the file.' },
  'sel.download': 'Download backup file',

  /* ---------- dashboard toasts (data.ts) ---------- */
  'toast.openPageNoUrl': 'This page has no saved address',
  'toast.openPageFail': 'Could not open the page',
  'toast.openHlNoUrl': 'This highlight has no saved address',
  'toast.nothingToCopy': 'Nothing to copy',
  'toast.deleted': 'Highlight deleted',
  'toast.groupDeleted': 'This page’s highlights were deleted',
  'toast.readFail': 'Could not read the data',
  'toast.backupOk': { one: 'Backup file with 1 highlight downloaded', other: 'Backup file with {n} highlights downloaded' },
  'toast.partialBackupOk': { one: 'Selective backup with 1 highlight downloaded', other: 'Selective backup with {n} highlights downloaded' },
  'toast.exportFail': 'Export failed',
  'toast.fileReadFail': 'Could not read the file',
  'toast.invalidBackup': 'Not a valid Weboo backup file',
  'toast.importDone': '{a} added, {u} updated, {s} skipped',
  'toast.restoreFail': 'Restore failed',
  'toast.mdOk': { one: 'Markdown file with 1 highlight downloaded', other: 'Markdown file with {n} highlights downloaded' },
  'toast.mdFail': 'Markdown export failed',
  'toast.nothingToExport': 'There are no highlights to export',
  'toast.noArticlesForBooklet': 'No articles were picked for the booklet',
  'toast.printOpened': 'The print dialog opened — choose “Save as PDF” for a PDF',
  'toast.bookletOk': { one: 'HTML booklet with 1 highlight downloaded', other: 'HTML booklet with {n} highlights downloaded' },
  'toast.bookletFail': 'Booklet build failed',
  'toast.tagInvalid': 'Invalid tag name (max {n} characters)',
  'toast.tagExists': 'This tag is already on this article',
  'toast.tagCap': 'At most {n} tags per article',
  'toast.tagAdded': 'Tag “{tag}” added',
  'toast.tagSaveFail': 'Saving the tag failed',
  'toast.tagRemoved': 'Tag removed',
  'toast.tagRemoveFail': 'Removing the tag failed',

  /* ---------- popup ---------- */
  'popup.brandSub': 'Highlights & notes — 100% local',
  'popup.settingsBtnTitle': 'Dashboard & settings',
  'popup.unsupportedT': 'This page isn’t supported',
  'popup.unsupportedDesc': 'The extension only works on http, https and file pages.',
  'popup.openDash': 'Open dashboard',
  'popup.genericLbl': 'Total saved highlights',
  'popup.genericHint': 'Click the extension icon on a web page to see that page’s highlights.',
  'popup.enabledHere': 'Enabled on this site',
  'popup.toggleAria': 'Extension enabled on this site',
  'popup.applied': 'Applied ✓',
  'popup.refreshHint': 'If highlights don’t appear right away, refresh the page.',
  'popup.listTitle': 'This page’s highlights',
  'popup.emptyT': 'No highlights on this page yet.',
  'popup.emptyHint': 'Select some text and use the floating toolbar!',
  'popup.dashboardBtn': 'Full dashboard',
  'popup.jumpTitle': 'Jump to this highlight',
  'popup.hasNote': 'Has a note',
  'popup.themeTitle': 'Theme: {name}',
  'popup.themeChangeAria': 'Change theme ({name})',
  'popup.countOf': '{a} of {b}',
  'popup.backupOk': 'Backup file downloaded',

  /* ---------- floating widgets (content script) ---------- */
  'fw.toolbarAria': 'Highlight toolbar',
  'fw.highlightColor': 'Highlight {name}',
  'fw.noteTitle': 'Highlight + note',
  'fw.noteAria': 'Highlight with a note',
  'fw.copyAria': 'Copy the selected text',
  'fw.gripTitle': 'Move the window; drag and release',
  'fw.colorAria': '{name} color',
  'fw.noNote': 'No note for this highlight yet.',
  'fw.addNote': 'Add a note',
  'fw.editNote': 'Edit note',
  'fw.notePlaceholder': 'Your note for this highlight…',
  'fw.saved': 'Saved ✓',
  'fw.saveNote': 'Save note',
  'fw.copyAllTitle': 'Copy text and note',
  'fw.deleteTitle': 'Delete highlight',
  'fw.deleteConfirm': 'Delete?',

  /* ---------- highlighter toasts ---------- */
  'hl.copied': 'Copied ✓',
  'hl.saveError': 'Saving failed.',
  'hl.notHighlightable': 'This part of the page can’t be highlighted.',
  'hl.deleted': 'Highlight deleted.',
  'hl.notePrefix': '📝 Note: ',

  /* ---------- service worker context menu ---------- */
  'menu.highlight': '✨ Highlight “%s”',

  /* ---------- export documents (Markdown / booklet) ---------- */
  'ex.mdTitle': 'My Highlight Booklet',
  'ex.exportedFrom': 'Exported from “{app}”',
  'ex.mdEmpty': 'No highlights yet.',
  'ex.note': 'Note:',
  'ex.tags': 'Tags:',
  'ex.source': 'Source',
  'ex.bookletTitle': 'Highlight Booklet',
  'ex.coverSub': 'The complete collection of highlights and notes',
  'ex.toc': 'Table of contents',
  'ex.madeWith': 'Made with “{app}” · version {v}',
  'ex.foot': 'Made with “{app}” — all data stays on your device only.',
  'ex.coverAria': 'Booklet cover'
} as const;

export type TranslationKey = keyof typeof en;

/* ------------------------------------------------------------------ */
/* Persian — typed against the canonical key set (compile-time parity) */
/* ------------------------------------------------------------------ */

const fa: Record<TranslationKey, DictValue> = {
  /* ---------- app identity ---------- */
  'app.name': 'وبو',

  /* ---------- common ---------- */
  'common.cancel': 'انصراف',
  'common.close': 'بستن',
  'common.delete': 'حذف',
  'common.add': 'افزودن',
  'common.confirm': 'مطمئنید؟',
  'common.version': 'نسخه',
  'common.untitled': 'بدون عنوان',
  'common.localFile': 'فایل محلی',
  'common.from': ' از ',
  'common.copy': 'کپی متن',
  'common.copyShort': 'کپی',
  'common.copyOk': 'کپی شد ✓',
  'common.copyFail': 'کپی ناموفق بود',
  'common.saveFail': 'ذخیره تنظیمات ناموفق بود',
  'common.deleteFail': 'حذف ناموفق بود',
  'common.nHighlights': '{n} هایلایت',
  'common.nNotes': '{n} یادداشت',
  'common.nArticles': '{n} مقاله',
  'common.nItems': '{n} مورد',

  /* ---------- colors ---------- */
  'color.yellow': 'زرد',
  'color.orange': 'نارنجی',
  'color.green': 'سبز',
  'color.teal': 'فیروزه‌ای',
  'color.pink': 'صورتی',
  'color.purple': 'بنفش',

  /* ---------- themes ---------- */
  'theme.auto': 'هماهنگ با سیستم',
  'theme.light': 'روشن',
  'theme.dark': 'تاریک',
  'theme.autoHint': 'روشن/تیره سیستم‌عامل را دنبال می‌کند',
  'theme.lightHint': 'همیشه پس‌زمینه‌ی روشن',
  'theme.darkHint': 'همیشه پس‌زمینه‌ی تیره',

  /* ---------- interface language ---------- */
  'lang.label': 'زبان رابط کاربری',
  'lang.fa': 'فارسی',
  'lang.en': 'English',
  'lang.desc': 'روی پنجره، داشبورد و ابزارهای شناور فوراً اعمال می‌شود.',

  /* ---------- dashboard shell ---------- */
  'dash.title': 'داشبورد — وبو',
  'dash.brandSub': 'داشبورد مدیریت',
  'dash.statsAria': 'آمار کلی',
  'dash.toolbarAria': 'فیلتر و جست‌وجو',
  'dash.listAria': 'هایلایت‌ها',
  'dash.footer': 'وبو — همه‌ی داده‌ها فقط روی همین دستگاه ذخیره می‌شوند؛ هیچ چیزی به سرور ارسال نمی‌شود.',
  'dash.settings': 'تنظیمات',
  'dash.settingsAria': 'تنظیمات',
  'dash.drawerCloseAria': 'بستن تنظیمات',
  'dash.sectionAppearance': 'ظاهر',
  'dash.sectionColor': 'رنگ پیش‌فرض هایلایت',
  'dash.sectionBehavior': 'رفتار',
  'dash.themeGroupAria': 'قالب رابط',
  'lang.groupAria': 'زبان رابط کاربری',
  'dots.title': 'رنگ پیش‌فرض: {name}',
  'behavior.toolbar': 'نمایش نوار ابزار هنگام انتخاب متن',
  'behavior.badge': 'نمایش شمارنده روی آیکون',

  /* ---------- dashboard topbar ---------- */
  'tb.booklet': 'کتابچه',
  'tb.selectiveBackup': 'خروجی انتخابی',
  'tb.selectiveBackupTitle': 'بک‌آپ انتخابی — از سایت‌ها، مقاله‌ها و برچسب‌ها',
  'tb.backup': 'خروجی پشتیبان',
  'tb.backupTitle': 'خروجی پشتیبان (کل کتابخانه)',
  'tb.sizeBadgeTitle': 'حجم داده‌های ذخیره‌شده روی دستگاه',

  /* ---------- dashboard stats ---------- */
  'stats.total': 'کل هایلایت‌ها',
  'stats.notes': 'یادداشت‌ها',
  'stats.pages': 'صفحات',
  'stats.sites': 'سایت‌ها',

  /* ---------- dashboard filter toolbar ---------- */
  'search.placeholder': 'جست‌وجو در متن، یادداشت یا عنوان صفحه…',
  'search.aria': 'جست‌وجو',
  'filter.colorAria': 'فیلتر رنگ',
  'filter.notesOnly': 'فقط یادداشت‌دار',
  'filter.sortLabel': 'مرتب‌سازی:',
  'sort.newest': 'جدیدترین',
  'sort.oldest': 'قدیمی‌ترین',
  'sort.page': 'بر اساس صفحه',
  'filter.tagsLabel': 'برچسب مقاله‌ها:',
  'filter.tagsAria': 'فیلتر برچسب مقاله‌ها',

  /* ---------- list chrome ---------- */
  'bulk.expand': 'باز کردن همه‌ی مقاله‌ها',
  'bulk.expandTitle': 'همه‌ی کارت مقاله‌ها باز می‌شوند و همه‌ی هایلایت‌های بارگذاری‌نشده هم بارگذاری می‌شوند',
  'bulk.collapse': 'بستن همه‌ی مقاله‌ها',
  'bulk.collapseTitle': 'همه‌ی کارت مقاله‌ها بسته می‌شوند و همه‌ی هایلایت‌های بارگذاری‌نشده هم بارگذاری می‌شوند؛ با باز کردن هر مقاله، هایلایت‌هایش کامل نمایش داده می‌شوند',
  'list.loadMore': 'بارگذاری بیشتر ({n} مورد باقی‌مانده)',
  'empty.noResults': 'نتیجه‌ای پیدا نشد.',
  'empty.noResultsSub': 'عبارت جست‌وجو یا فیلترهای رنگ و برچسب را تغییر بده.',
  'empty.first': 'هنوز هایلایتی ثبت نشده. اولین متن را انتخاب کنید!',
  'empty.firstSub': 'روی هر صفحه‌ی وب، متن را انتخاب کن و از نوار شناور افزونه استفاده کن.',
  'dirsec.rtl': 'راست‌چین‌ها',
  'dirsec.ltr': 'چپ‌چین‌ها',
  'dirsec.lead': 'آخرین هایلایت اینجاست',
  'dirsec.leadTitle': 'تازه‌ترین مقاله‌ی هایلایت‌شده در این بخش است؛ برای همین این بخش بالاتر نمایش داده می‌شود',

  /* ---------- article card ---------- */
  'card.order.newest': 'جدیدترین',
  'card.order.oldest': 'قدیمی‌ترین',
  'card.order.page': 'صفحه',
  'card.order.pageRev': 'برعکسِ صفحه',
  'card.order.newestTitle': 'ترتیب فعلی هایلایت‌ها: از جدیدترین به قدیمی‌ترین؛ برای تغییر ترتیب، این دکمه را بزنید',
  'card.order.oldestTitle': 'ترتیب فعلی هایلایت‌ها: از قدیمی‌ترین به جدیدترین؛ برای تغییر ترتیب، این دکمه را بزنید',
  'card.order.pageTitle': 'ترتیب فعلی هایلایت‌ها: به ترتیب قرارگیری در متن صفحه؛ برای تغییر ترتیب، این دکمه را بزنید',
  'card.order.pageRevTitle': 'ترتیب فعلی هایلایت‌ها: برعکسِ ترتیب قرارگیری در متن صفحه؛ برای تغییر ترتیب، این دکمه را بزنید',
  'card.orderAria': 'ترتیب نمایش هایلایت‌های این مقاله: {label}',
  'card.viewPageTitle': 'باز کردن این صفحه در تب جدید',
  'card.deleteGroupTitle': 'حذف همه‌ی این صفحه',
  'card.remaining': '…{n} مورد دیگر از این صفحه (برای نمایش، «بارگذاری بیشتر» را بزنید)',

  /* ---------- highlight item ---------- */
  'item.previewTitle': 'نمایش متن کامل این هایلایت',
  'item.notePreviewTitle': 'نمایش متن و یادداشت کامل این هایلایت',
  'item.viewTitle': 'مشاهده در صفحه',
  'item.deleteTitle': 'حذف این هایلایت',

  /* ---------- tags row ---------- */
  'tags.add': 'برچسب',
  'tags.addTitle': 'افزودن برچسب به این مقاله',
  'tags.placeholder': 'نام برچسب…',
  'tags.inputAria': 'نام برچسب جدید',
  'tags.removeTitle': 'حذف برچسب {tag}',

  /* ---------- disabled hosts ---------- */
  'hosts.title': 'سایت‌های غیرفعال',
  'hosts.desc': 'روی این سایت‌ها هایلایت ساخته یا نمایش داده نمی‌شود (داده‌ها حذف نمی‌شوند).',
  'hosts.empty': 'هنوز سایتی غیرفعال نشده است.',
  'hosts.addPlaceholder': 'افزودن دامنه (مثل example.com)',
  'hosts.inputAria': 'دامنه‌ی جدید',
  'hosts.invalid': 'دامنه‌ی معتبر وارد کنید (مثل example.com)',
  'hosts.duplicate': 'این دامنه قبلاً اضافه شده است',
  'hosts.disabledOk': 'سایت {host} غیرفعال شد',
  'hosts.removeTitle': 'حذف {host}',

  /* ---------- language section ---------- */

  /* ---------- restore section + modal ---------- */
  'restore.title': 'بازیابی بک‌آپ',
  'restore.desc': 'فایل پشتیبان JSON را انتخاب کن؛ پیش از اجرا، حالت ادغام یا جایگزینی کامل پرسیده می‌شود.',
  'restore.fileFail': 'باز کردن فایل ناموفق بود',
  'modal.name': 'نام مجموعه',
  'modal.highlights': 'تعداد هایلایت‌ها',
  'modal.exportDate': 'تاریخ خروجی',
  'modal.type': 'نوع',
  'modal.partialValue': 'بک‌آپ انتخابی (بخشی از کتابخانه)',
  'modal.merge': 'ادغام (merge)',
  'modal.mergeDesc': 'رکوردهای جدیدتر برنده می‌شوند؛ داده‌های فعلی حفظ می‌شوند.',
  'modal.replace': 'جایگزینی کامل (replace)',
  'modal.replaceDesc': 'همه‌ی داده‌های فعلی حذف می‌شوند!',
  'modal.start': 'شروع بازیابی',

  /* ---------- danger zone ---------- */
  'danger.title': 'منطقه‌ی خطر',
  'danger.desc': 'این عمل غیرقابل بازگشت است؛ پیشنهاد می‌کنیم ابتدا «خروجی پشتیبان» بگیرید.',
  'danger.arm': 'حذف همه‌ی هایلایت‌ها و یادداشت‌ها',
  'danger.placeholder': 'برای تأیید، کلمه «حذف» یا delete را بنویس',
  'danger.inputAria': 'تأیید حذف',
  'danger.go': 'تأیید و حذف',
  'danger.done': 'همه‌ی هایلایت‌ها و یادداشت‌ها حذف شد',

  /* ---------- modals ---------- */
  'bk.title': 'کتابچه و Markdown',
  'bk.mdDesc': 'برای Obsidian و هر ویرایشگر Markdown — کل کتابخانه در یک فایل، هر مقاله یک بخش.',
  'bk.mdBtn': 'دریافت فایل Markdown',
  'bk.pickerTitle': 'مقاله‌های کتابچه',
  'bk.pickerHint': 'بدون انتخاب، همه‌ی مقاله‌ها در کتابچه می‌آیند؛ با انتخاب، فقط همین‌ها.',
  'bk.pickerAria': 'انتخاب مقاله‌های کتابچه',
  'bk.allArticles': 'همه‌ی مقاله‌ها در کتابچه خواهند بود.',
  'bk.pickedStatus': '{n} هایلایت از {m} مقاله در کتابچه خواهد بود.',
  'bk.printTitle': 'کتابچه چاپی',
  'bk.printDesc': 'طراحی‌شده برای چاپ A4 — جلد، فهرست و هر مقاله در صفحه‌ای جدا.',
  'bk.formatAria': 'قالب کتابچه',
  'bk.html': 'فایل HTML',
  'bk.htmlDesc': 'یک فایل آماده‌ی چاپ — در مرورگر باز کن و Ctrl+P بزن.',
  'bk.pdf': 'PDF',
  'bk.pdfDesc': 'پنجره‌ی چاپ مرورگر باز می‌شود — «Save as PDF» را انتخاب کن.',
  'bk.colorAria': 'حالت رنگ کتابچه',
  'bk.color': 'رنگی',
  'bk.colorDesc': 'با رنگ اصلی هایلایت‌ها',
  'bk.bw': 'سیاه‌وسفید',
  'bk.bwDesc': 'جوهر کمتر — مناسب چاپگر معمولی',
  'bk.fontAria': 'فونت کتابچه',
  'bk.fontDefault': '{name} — پیش‌فرض',
  'bk.fontDesc': 'اگر روی سیستم نصب نباشد، مرورگر فونت مشابهی نشان می‌دهد',
  'bk.fontCustom': 'فونت دلخواه',
  'bk.fontCustomDesc': 'هر فونتی که روی دستگاه شما نصب است — نامش را دقیق بنویسید',
  'bk.fontCustomPlaceholder': 'مثلاً: B Nazanin',
  'bk.build': 'ساخت کتابچه',
  'sel.title': 'بک‌آپ انتخابی',
  'sel.desc': 'بخشی از کتابخانه را خروجی بگیر — هر سایت، مقاله یا برچسبی که انتخاب کنی، هایلایت‌هایش داخل فایل می‌آیند.',
  'sel.sites': 'سایت‌ها',
  'sel.sitesHint': 'تمام هایلایت‌های این سایت‌ها',
  'sel.sitesAria': 'انتخاب سایت‌ها',
  'sel.articles': 'مقاله‌ها',
  'sel.articlesHint': 'هایلایت‌های همین مقاله‌ها',
  'sel.articlesAria': 'انتخاب مقاله‌ها',
  'sel.tags': 'برچسب‌ها',
  'sel.tagsHint': 'تمام هایلایت‌های مقاله‌های دارای این برچسب',
  'sel.tagsAria': 'انتخاب برچسب‌ها',
  'sel.emptySites': 'سایتی ثبت نشده است',
  'sel.emptyArticles': 'مقاله‌ای ثبت نشده است',
  'sel.emptyTags': 'برچسبی ثبت نشده است',
  'sel.pickOne': 'حداقل یک مورد را انتخاب کنید.',
  'sel.noMatch': 'هیچ هایلایتی با این انتخاب مطابقت ندارد.',
  'sel.status': '{n} هایلایت در فایل خواهد بود.',
  'sel.download': 'دریافت فایل بک‌آپ',

  /* ---------- dashboard toasts ---------- */
  'toast.openPageNoUrl': 'آدرس این صفحه ثبت نشده است',
  'toast.openPageFail': 'باز کردن صفحه ناموفق بود',
  'toast.openHlNoUrl': 'آدرس این هایلایت ثبت نشده است',
  'toast.nothingToCopy': 'چیزی برای کپی نیست',
  'toast.deleted': 'هایلایت حذف شد',
  'toast.groupDeleted': 'هایلایت‌های این صفحه حذف شد',
  'toast.readFail': 'خواندن داده‌ها ناموفق بود',
  'toast.backupOk': 'فایل بک‌آپ با {n} هایلایت دانلود شد',
  'toast.partialBackupOk': 'فایل بک‌آپ انتخابی با {n} هایلایت دانلود شد',
  'toast.exportFail': 'خروجی گرفتن ناموفق بود',
  'toast.fileReadFail': 'خواندن فایل ناموفق بود',
  'toast.invalidBackup': 'فایل پشتیبان معتبر نیست',
  'toast.importDone': '{a} مورد اضافه، {u} به‌روزرسانی، {s} رد شد',
  'toast.restoreFail': 'بازیابی ناموفق بود',
  'toast.mdOk': 'فایل Markdown با {n} هایلایت دانلود شد',
  'toast.mdFail': 'خروجی Markdown ناموفق بود',
  'toast.nothingToExport': 'هایلایتی برای خروجی وجود ندارد',
  'toast.noArticlesForBooklet': 'مقاله‌ای برای کتابچه انتخاب نشده است',
  'toast.printOpened': 'پنجره‌ی چاپ باز شد — برای PDF گزینه‌ی «Save as PDF» را انتخاب کن',
  'toast.bookletOk': 'کتابچه HTML با {n} هایلایت دانلود شد',
  'toast.bookletFail': 'ساخت کتابچه ناموفق بود',
  'toast.tagInvalid': 'نام برچسب معتبر نیست (حداکثر {n} نویسه)',
  'toast.tagExists': 'این برچسب روی این مقاله هست',
  'toast.tagCap': 'حداکثر {n} برچسب برای هر مقاله',
  'toast.tagAdded': 'برچسب «{tag}» اضافه شد',
  'toast.tagSaveFail': 'ذخیره‌ی برچسب ناموفق بود',
  'toast.tagRemoved': 'برچسب حذف شد',
  'toast.tagRemoveFail': 'حذف برچسب ناموفق بود',

  /* ---------- popup ---------- */
  'popup.brandSub': 'هایلایت و یادداشت — ۱۰۰٪ محلی',
  'popup.settingsBtnTitle': 'داشبورد و تنظیمات',
  'popup.unsupportedT': 'این صفحه پشتیبانی نمی‌شود',
  'popup.unsupportedDesc': 'افزونه فقط روی صفحات http، https و file کار می‌کند.',
  'popup.openDash': 'باز کردن داشبورد',
  'popup.genericLbl': 'کل هایلایت‌های ذخیره‌شده',
  'popup.genericHint': 'برای دیدن هایلایت‌های صفحه‌ی فعلی، روی آیکون افزونه در یک صفحه‌ی وب کلیک کنید.',
  'popup.enabledHere': 'فعال در این سایت',
  'popup.toggleAria': 'فعال بودن افزونه در این سایت',
  'popup.applied': 'اعمال شد ✓',
  'popup.refreshHint': 'اگر هایلایت‌ها فوراً ظاهر نشدند صفحه را رفرش کنید.',
  'popup.listTitle': 'هایلایت‌های این صفحه',
  'popup.emptyT': 'هنوز روی این صفحه هایلایتی نداری.',
  'popup.emptyHint': 'متن را انتخاب و از نوار شناور استفاده کن!',
  'popup.dashboardBtn': 'داشبورد کامل',
  'popup.jumpTitle': 'پرش به این هایلایت',
  'popup.hasNote': 'دارد یادداشت',
  'popup.themeTitle': 'قالب: {name}',
  'popup.themeChangeAria': 'تغییر قالب ({name})',
  'popup.countOf': '{a} از {b}',
  'popup.backupOk': 'فایل بک‌آپ دانلود شد',

  /* ---------- floating widgets ---------- */
  'fw.toolbarAria': 'ابزار هایلایت',
  'fw.highlightColor': 'هایلایت {name}',
  'fw.noteTitle': 'هایلایت + یادداشت',
  'fw.noteAria': 'هایلایت با یادداشت',
  'fw.copyAria': 'کپی متن انتخاب‌شده',
  'fw.gripTitle': 'جابه‌جایی پنجره؛ بکشید و رها کنید',
  'fw.colorAria': 'رنگ {name}',
  'fw.noNote': 'برای این هایلایت یادداشتی ثبت نشده است.',
  'fw.addNote': 'افزودن یادداشت',
  'fw.editNote': 'ویرایش یادداشت',
  'fw.notePlaceholder': 'یادداشت شما برای این هایلایت…',
  'fw.saved': 'ذخیره شد ✓',
  'fw.saveNote': 'ذخیره یادداشت',
  'fw.copyAllTitle': 'کپی متن و یادداشت',
  'fw.deleteTitle': 'حذف هایلایت',
  'fw.deleteConfirm': 'حذف؟',

  /* ---------- highlighter toasts ---------- */
  'hl.copied': 'کپی شد ✓',
  'hl.saveError': 'ذخیره‌سازی با خطا مواجه شد.',
  'hl.notHighlightable': 'این قسمت از صفحه قابل هایلایت نیست.',
  'hl.deleted': 'هایلایت حذف شد.',
  'hl.notePrefix': '📝 یادداشت: ',

  /* ---------- service worker context menu ---------- */
  'menu.highlight': '✨ هایلایت «%s»',

  /* ---------- export documents ---------- */
  'ex.mdTitle': 'کتابچه هایلایت‌های من',
  'ex.exportedFrom': 'خروجی از «{app}»',
  'ex.mdEmpty': 'هنوز هایلایتی ثبت نشده است.',
  'ex.note': 'یادداشت:',
  'ex.tags': 'برچسب‌ها:',
  'ex.source': 'منبع',
  'ex.bookletTitle': 'کتابچه هایلایت‌ها',
  'ex.coverSub': 'مجموعه‌ی کامل هایلایت‌ها و یادداشت‌ها',
  'ex.toc': 'فهرست مقاله‌ها',
  'ex.madeWith': 'ساخته‌شده با «{app}» · نسخه {v}',
  'ex.foot': 'ساخته‌شده با «{app}» — همه‌ی داده‌ها فقط روی دستگاه شما ذخیره می‌شوند.',
  'ex.coverAria': 'جلد کتابچه'
};

/* ------------------------------------------------------------------ */
/* Language registry + state                                           */
/* ------------------------------------------------------------------ */

/**
 * The language registry — order is the selector's display order; `dir` is
 * THE UI-direction policy (a language property, independent of content
 * direction — see shared/detect-dir.js).
 */
export const LANGUAGES: Record<Language, { label: TranslationKey; dir: 'rtl' | 'ltr' }> = {
  fa: { label: 'lang.fa', dir: 'rtl' },
  en: { label: 'lang.en', dir: 'ltr' }
};

export const LANG_KEYS: Language[] = ['fa', 'en'];

const DICTS: Record<Language, Record<TranslationKey, DictValue>> = { fa: fa, en: en };

const DEFAULT_LANG: Language = 'fa';

/* Module-scoped state with explicit ownership: composition roots set it
   (content.js / popup.js / data.ts / the SW); everything else reads. */
let current: Language = DEFAULT_LANG;
const subscribers = new Set<() => void>();

/** Validates raw storage values — anything unknown degrades to the default
 *  (the same boundary-validation pattern as themes/colors). */
export function validLanguage(v: unknown): Language {
  return (v === 'fa' || v === 'en') ? v : DEFAULT_LANG;
}

/** The active UI language. */
export function getLanguage(): Language {
  return current;
}

/** The UI direction of a language (default: the active one). */
export function dirOf(lang?: Language): 'rtl' | 'ltr' {
  return LANGUAGES[lang || current].dir;
}

/**
 * Sets the active language (invalid → default) and notifies subscribers.
 * Returns the applied language. Does NOT touch the DOM — pages that need
 * the document root updated call ui.applyLangNow (ui/base.js, the same
 * split as theme: setTheme vs applyThemeNow).
 */
export function setLanguage(lang: unknown): Language {
  current = validLanguage(lang);
  subscribers.forEach(function (cb) {
    try { cb(); } catch (e) { /* a broken listener never blocks the rest */ }
  });
  return current;
}

/** Subscribes to language changes → unsubscribe (the store's onChange pattern). */
export function onChange(cb: () => void): () => void {
  subscribers.add(cb);
  return function () { subscribers.delete(cb); };
}

/* ------------------------------------------------------------------ */
/* Translation lookup                                                  */
/* ------------------------------------------------------------------ */

const INTERP_RE = /\{(\w+)\}/g;

/**
 * Translates a key in the active language with `{name}` interpolation.
 * Fallback order: active dictionary → the other dictionary → the key itself
 * (visible, never empty — and unreachable for typed TS call sites).
 * A plural value (`{one, other}`) picks `one` only for n === 1 (English;
 * Persian numerals never pluralize — its plural-capable keys stay strings).
 */
export function t(key: TranslationKey, params?: Params): string {
  const raw: DictValue | undefined = DICTS[current][key] !== undefined ? DICTS[current][key] : DICTS[current === 'fa' ? 'en' : 'fa'][key];
  let s: string;
  if (raw && typeof raw === 'object') {
    const n = Number(params && params.n);
    s = (n === 1) ? raw.one : raw.other;
  } else {
    s = String(raw === undefined ? key : raw);
  }
  if (!params) return s;
  return s.replace(INTERP_RE, function (m, name) {
    return params[name] !== undefined ? String(params[name]) : m;
  });
}

/**
 * A formatted count fragment — the plural contract keyed on the NUMBER
 * (one/other) with the DIGITS rendered per the active language (fa →
 * Persian, en → Latin; the same rendering format.num applies — kept local
 * because format.js consumes i18n, not the reverse).
 */
export function count(key: TranslationKey, n: number): string {
  const num = Number(n) || 0;
  const raw: DictValue | undefined = DICTS[current][key] !== undefined ? DICTS[current][key] : DICTS[current === 'fa' ? 'en' : 'fa'][key];
  let s: string;
  if (raw && typeof raw === 'object') {
    s = (num === 1) ? raw.one : raw.other;
  } else {
    s = String(raw === undefined ? key : raw);
  }
  let formatted: string;
  try { formatted = num.toLocaleString(current === 'en' ? 'en-US' : 'fa-IR'); }
  catch (e) { formatted = String(num); }
  return s.replace(INTERP_RE, function (m, name) {
    return name === 'n' ? formatted : m;
  });
}

/* ------------------------------------------------------------------ */
/* Static-markup translation (data-i18n* attributes)                   */
/* ------------------------------------------------------------------ */

/**
 * Applies translations to static markup: every element carrying
 *   data-i18n           → textContent
 *   data-i18n-aria      → aria-label
 *   data-i18n-title     → title
 *   data-i18n-placeholder → placeholder
 * gets the corresponding key's translation. Idempotent — pages call it at
 * boot and on every language change. The templates keep their byte-stable
 * Persian markup (the packaging contract); the attributes are additive.
 */
export function applyDom(root: Document | Element | null | undefined): void {
  if (!root || !root.querySelectorAll) return;
  const walk = (sel: string, fn: (el: Element, v: string) => void) => {
    const list = root.querySelectorAll('[' + sel + ']');
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      const key = el.getAttribute(sel) as TranslationKey;
      const v = t(key);
      if (v) fn(el, v);
    }
  };
  walk('data-i18n', (el, v) => { el.textContent = v; });
  walk('data-i18n-aria', (el, v) => { el.setAttribute('aria-label', v); });
  walk('data-i18n-title', (el, v) => { el.setAttribute('title', v); });
  walk('data-i18n-placeholder', (el, v) => { el.setAttribute('placeholder', v); });
}

export const i18n = {
  LANGUAGES: LANGUAGES,
  LANG_KEYS: LANG_KEYS,
  validLanguage: validLanguage,
  getLanguage: getLanguage,
  setLanguage: setLanguage,
  dirOf: dirOf,
  onChange: onChange,
  t: t,
  count: count,
  applyDom: applyDom
};
