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
 *    Persian and German dictionaries are typed `Record<TranslationKey, …>` — a key present
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

export type Language = 'fa' | 'en' | 'de' | 'es' | 'ru' | 'it' | 'fr' | 'tr';

/** A plural-capable value — CLDR plural categories (Intl.PluralRules).
 *  `other` is required (every locale resolves to it); `one`/`few`/`many`
 *  are provided only where the language's morphology needs them:
 *  en/de/es/it/tr use one+other, fr one+other (+many beyond a million,
 *  covered by other's fallback), ru one+few+many (1 заметка / 2 заметки /
 *  5 заметок — and 21 correctly re-selects `one`). */
export interface Plural {
  one?: string;
  few?: string;
  many?: string;
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
  'lang.de': 'German',
  'lang.es': 'Spanish',
  'lang.ru': 'Russian',
  'lang.it': 'Italian',
  'lang.fr': 'French',
  'lang.tr': 'Turkish',

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
  'lang.de': 'Deutsch',
  'lang.es': 'Español',
  'lang.ru': 'Русский',
  'lang.it': 'Italiano',
  'lang.fr': 'Français',
  'lang.tr': 'Türkçe',
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
/* German — typed against the canonical key set (compile-time parity);  */
/* Sie-form register; plural objects only where German morphology needs */
/* them (Artikel/Tag are invariable after numerals)                     */
/* ------------------------------------------------------------------ */

const de: Record<TranslationKey, DictValue> = {
  /* ---------- app identity ---------- */
  'app.name': 'Weboo',

  /* ---------- common ---------- */
  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.delete': 'Löschen',
  'common.add': 'Hinzufügen',
  'common.confirm': 'Sicher?',
  'common.version': 'Version',
  'common.untitled': 'Ohne Titel',
  'common.localFile': 'Lokale Datei',
  'common.from': ' von ',
  'common.copy': 'Text kopieren',
  'common.copyShort': 'Kopieren',
  'common.copyOk': 'Kopiert ✓',
  'common.copyFail': 'Kopieren fehlgeschlagen',
  'common.saveFail': 'Speichern der Einstellungen fehlgeschlagen',
  'common.deleteFail': 'Löschen fehlgeschlagen',
  'common.nHighlights': { one: '1 Highlight', other: '{n} Highlights' },
  'common.nNotes': { one: '1 Notiz', other: '{n} Notizen' },
  'common.nArticles': '{n} Artikel',
  'common.nItems': { one: '1 Element', other: '{n} Elemente' },

  /* ---------- colors ---------- */
  'color.yellow': 'Gelb',
  'color.orange': 'Orange',
  'color.green': 'Grün',
  'color.teal': 'Türkis',
  'color.pink': 'Pink',
  'color.purple': 'Lila',

  /* ---------- themes ---------- */
  'theme.auto': 'System',
  'theme.light': 'Hell',
  'theme.dark': 'Dunkel',
  'theme.autoHint': 'Folgt der Hell-/Dunkeleinstellung des Systems',
  'theme.lightHint': 'Immer ein heller Hintergrund',
  'theme.darkHint': 'Immer ein dunkler Hintergrund',

  /* ---------- interface language ---------- */
  'lang.label': 'Sprache der Benutzeroberfläche',
  'lang.fa': 'فارسی',
  'lang.en': 'English',
  'lang.de': 'Deutsch',
  'lang.es': 'Español',
  'lang.ru': 'Русский',
  'lang.it': 'Italiano',
  'lang.fr': 'Français',
  'lang.tr': 'Türkçe',
  'lang.desc': 'Gilt sofort für Popup, Dashboard und schwebende Werkzeuge.',
  'lang.groupAria': 'Sprache der Benutzeroberfläche',

  /* ---------- dashboard shell ---------- */
  'dash.title': 'Dashboard — Weboo',
  'dash.brandSub': 'Verwaltungs-Dashboard',
  'dash.statsAria': 'Gesamtstatistik',
  'dash.toolbarAria': 'Filter und Suche',
  'dash.listAria': 'Highlights',
  'dash.footer': 'Weboo — alle Daten bleiben ausschließlich auf diesem Gerät; nichts wird an einen Server gesendet.',
  'dash.settings': 'Einstellungen',
  'dash.settingsAria': 'Einstellungen',
  'dash.drawerCloseAria': 'Einstellungen schließen',
  'dash.sectionAppearance': 'Erscheinungsbild',
  'dash.sectionColor': 'Standard-Highlight-Farbe',
  'dash.sectionBehavior': 'Verhalten',
  'dash.themeGroupAria': 'Design der Oberfläche',
  'dots.title': 'Standardfarbe: {name}',
  'behavior.toolbar': 'Schwebende Werkzeugleiste bei Textauswahl zeigen',
  'behavior.badge': 'Zähler auf dem Symbol anzeigen',

  /* ---------- dashboard topbar ---------- */
  'tb.booklet': 'Booklet',
  'tb.selectiveBackup': 'Selektiver Export',
  'tb.selectiveBackupTitle': 'Selektives Backup — nach Websites, Artikeln und Tags',
  'tb.backup': 'Backup-Export',
  'tb.backupTitle': 'Backup-Export (gesamte Bibliothek)',
  'tb.sizeBadgeTitle': 'Größe der auf diesem Gerät gespeicherten Daten',

  /* ---------- dashboard stats ---------- */
  'stats.total': 'Highlights insgesamt',
  'stats.notes': 'Notizen',
  'stats.pages': 'Seiten',
  'stats.sites': 'Websites',

  /* ---------- dashboard filter toolbar ---------- */
  'search.placeholder': 'Text, Notizen oder Seitentitel durchsuchen…',
  'search.aria': 'Suche',
  'filter.colorAria': 'Farbfilter',
  'filter.notesOnly': 'Nur mit Notizen',
  'filter.sortLabel': 'Sortierung:',
  'sort.newest': 'Neueste',
  'sort.oldest': 'Älteste',
  'sort.page': 'Nach Seite',
  'filter.tagsLabel': 'Artikel-Tags:',
  'filter.tagsAria': 'Artikel-Tag-Filter',

  /* ---------- list chrome ---------- */
  'bulk.expand': 'Alle Artikel aufklappen',
  'bulk.expandTitle': 'Alle Artikelkarten klappen auf und alle nicht geladenen Highlights werden geladen',
  'bulk.collapse': 'Alle Artikel einklappen',
  'bulk.collapseTitle': 'Alle Artikelkarten klappen sich zu und alle nicht geladenen Highlights werden geladen; beim Öffnen eines Artikels werden dessen Highlights vollständig angezeigt',
  'list.loadMore': 'Mehr laden ({n} verbleibend)',
  'empty.noResults': 'Keine Ergebnisse gefunden.',
  'empty.noResultsSub': 'Anderen Suchbegriff oder andere Farb-/Tag-Filter ausprobieren.',
  'empty.first': 'Noch keine Highlights. Markieren Sie Ihren ersten Text!',
  'empty.firstSub': 'Wählen Sie auf einer beliebigen Webseite Text aus und benutzen Sie die schwebende Werkzeugleiste der Erweiterung.',
  'dirsec.rtl': 'RTL-Artikel',
  'dirsec.ltr': 'LTR-Artikel',
  'dirsec.lead': 'Der neueste Highlight ist hier',
  'dirsec.leadTitle': 'Der zuletzt markierte Artikel befindet sich in diesem Abschnitt, deshalb wird er zuerst angezeigt',

  /* ---------- article card ---------- */
  'card.order.newest': 'Neueste',
  'card.order.oldest': 'Älteste',
  'card.order.page': 'Seite',
  'card.order.pageRev': 'Seite rückwärts',
  'card.order.newestTitle': 'Aktuelle Reihenfolge der Highlights: von den neuesten zu den ältesten; zum Umdrehen drücken',
  'card.order.oldestTitle': 'Aktuelle Reihenfolge der Highlights: von den ältesten zu den neuesten; zum Umdrehen drücken',
  'card.order.pageTitle': 'Aktuelle Reihenfolge der Highlights: in Lesereihenfolge der Seite; zum Umdrehen drücken',
  'card.order.pageRevTitle': 'Aktuelle Reihenfolge der Highlights: umgekehrte Lesereihenfolge der Seite; zum Umdrehen drücken',
  'card.orderAria': 'Reihenfolge der Highlights dieses Artikels: {label}',
  'card.viewPageTitle': 'Diese Seite in einem neuen Tab öffnen',
  'card.deleteGroupTitle': 'Alles von dieser Seite löschen',
  'card.remaining': '…{n} weitere von dieser Seite (zum Anzeigen „Mehr laden“ drücken)',

  /* ---------- highlight item ---------- */
  'item.previewTitle': 'Vollständigen Text dieses Highlights anzeigen',
  'item.notePreviewTitle': 'Vollständigen Text und die Notiz dieses Highlights anzeigen',
  'item.viewTitle': 'Auf der Seite ansehen',
  'item.deleteTitle': 'Dieses Highlight löschen',

  /* ---------- tags row ---------- */
  'tags.add': 'Tag',
  'tags.addTitle': 'Diesem Artikel einen Tag hinzufügen',
  'tags.placeholder': 'Tag-Name…',
  'tags.inputAria': 'Neuer Tag-Name',
  'tags.removeTitle': 'Tag {tag} entfernen',

  /* ---------- disabled hosts ---------- */
  'hosts.title': 'Deaktivierte Websites',
  'hosts.desc': 'Auf diesen Websites werden keine Highlights erstellt oder angezeigt (Daten bleiben erhalten).',
  'hosts.empty': 'Noch keine Website deaktiviert.',
  'hosts.addPlaceholder': 'Domain hinzufügen (z. B. example.com)',
  'hosts.inputAria': 'Neue Domain',
  'hosts.invalid': 'Gültige Domain eingeben (z. B. example.com)',
  'hosts.duplicate': 'Diese Domain ist bereits in der Liste',
  'hosts.disabledOk': '{host} ist jetzt deaktiviert',
  'hosts.removeTitle': '{host} entfernen',

  /* ---------- language section ---------- */

  /* ---------- restore section + modal ---------- */
  'restore.title': 'Backup wiederherstellen',
  'restore.desc': 'Wählen Sie eine JSON-Backup-Datei; vor dem Ausführen wird zwischen Zusammenführen und vollständigem Ersetzen gefragt.',
  'restore.fileFail': 'Datei konnte nicht geöffnet werden',
  'modal.name': 'Name der Sammlung',
  'modal.highlights': 'Highlights',
  'modal.exportDate': 'Exportdatum',
  'modal.type': 'Typ',
  'modal.partialValue': 'Selektives Backup (Teil der Bibliothek)',
  'modal.merge': 'Zusammenführen',
  'modal.mergeDesc': 'Neuere Einträge gewinnen; die aktuellen Daten bleiben erhalten.',
  'modal.replace': 'Vollständig ersetzen',
  'modal.replaceDesc': 'Alle aktuellen Daten werden gelöscht!',
  'modal.start': 'Wiederherstellung starten',

  /* ---------- danger zone ---------- */
  'danger.title': 'Gefahrenzone',
  'danger.desc': 'Das kann nicht rückgängig gemacht werden — exportieren Sie zuerst ein Backup.',
  'danger.arm': 'Alle Highlights und Notizen löschen',
  'danger.placeholder': 'Zur Bestätigung „delete“ eingeben',
  'danger.inputAria': 'Löschen bestätigen',
  'danger.go': 'Bestätigen und löschen',
  'danger.done': 'Alle Highlights und Notizen wurden gelöscht',

  /* ---------- modals ---------- */
  'bk.title': 'Booklet & Markdown',
  'bk.mdDesc': 'Für Obsidian und jeden Markdown-Editor — die gesamte Bibliothek in einer Datei, ein Abschnitt pro Artikel.',
  'bk.mdBtn': 'Markdown-Datei herunterladen',
  'bk.pickerTitle': 'Booklet-Artikel',
  'bk.pickerHint': 'Ohne Auswahl kommen alle Artikel ins Booklet; mit Auswahl nur diese.',
  'bk.pickerAria': 'Booklet-Artikel auswählen',
  'bk.allArticles': 'Alle Artikel kommen ins Booklet.',
  'bk.pickedStatus': '{n} Highlights aus {m} Artikeln kommen ins Booklet.',
  'bk.printTitle': 'Druckbares Booklet',
  'bk.printDesc': 'Für A4-Druck gestaltet — Deckblatt, Inhaltsverzeichnis und ein Artikel pro Seite.',
  'bk.formatAria': 'Booklet-Format',
  'bk.html': 'HTML-Datei',
  'bk.htmlDesc': 'Eine druckfertige Datei — im Browser öffnen und Strg+P drücken.',
  'bk.pdf': 'PDF',
  'bk.pdfDesc': 'Der Druckdialog des Browsers öffnet sich — dort „Save as PDF“ wählen.',
  'bk.colorAria': 'Farbmodus des Booklets',
  'bk.color': 'Farbig',
  'bk.colorDesc': 'Mit den Originalfarben der Highlights',
  'bk.bw': 'Schwarz-Weiß',
  'bk.bwDesc': 'Weniger Tinte — gut für normale Drucker',
  'bk.fontAria': 'Booklet-Schriftart',
  'bk.fontDefault': '{name} — Standard',
  'bk.fontDesc': 'Ist sie nicht installiert, zeigt der Browser eine ähnliche Schrift',
  'bk.fontCustom': 'Eigene Schriftart',
  'bk.fontCustomDesc': 'Jede auf Ihrem Gerät installierte Schrift — geben Sie den genauen Namen ein',
  'bk.fontCustomPlaceholder': 'z. B. B Nazanin',
  'bk.build': 'Booklet erstellen',
  'sel.title': 'Selektives Backup',
  'sel.desc': 'Exportieren Sie einen Teil der Bibliothek — jede gewählte Website, jeder Artikel oder Tag nimmt seine Highlights mit in die Datei.',
  'sel.sites': 'Websites',
  'sel.sitesHint': 'Alle Highlights dieser Websites',
  'sel.sitesAria': 'Websites auswählen',
  'sel.articles': 'Artikel',
  'sel.articlesHint': 'Highlights dieser Artikel',
  'sel.articlesAria': 'Artikel auswählen',
  'sel.tags': 'Tags',
  'sel.tagsHint': 'Alle Highlights von Artikeln mit diesem Tag',
  'sel.tagsAria': 'Tags auswählen',
  'sel.emptySites': 'Noch keine Websites',
  'sel.emptyArticles': 'Noch keine Artikel',
  'sel.emptyTags': 'Noch keine Tags',
  'sel.pickOne': 'Wählen Sie mindestens einen Eintrag aus.',
  'sel.noMatch': 'Keine Highlights passen zu dieser Auswahl.',
  'sel.status': { one: '1 Highlight kommt in die Datei.', other: '{n} Highlights kommen in die Datei.' },
  'sel.download': 'Backup-Datei herunterladen',

  /* ---------- dashboard toasts ---------- */
  'toast.openPageNoUrl': 'Diese Seite hat keine gespeicherte Adresse',
  'toast.openPageFail': 'Seite konnte nicht geöffnet werden',
  'toast.openHlNoUrl': 'Dieses Highlight hat keine gespeicherte Adresse',
  'toast.nothingToCopy': 'Nichts zu kopieren',
  'toast.deleted': 'Highlight gelöscht',
  'toast.groupDeleted': 'Die Highlights dieser Seite wurden gelöscht',
  'toast.readFail': 'Daten konnten nicht gelesen werden',
  'toast.backupOk': { one: 'Backup-Datei mit 1 Highlight heruntergeladen', other: 'Backup-Datei mit {n} Highlights heruntergeladen' },
  'toast.partialBackupOk': { one: 'Selektives Backup mit 1 Highlight heruntergeladen', other: 'Selektives Backup mit {n} Highlights heruntergeladen' },
  'toast.exportFail': 'Export fehlgeschlagen',
  'toast.fileReadFail': 'Datei konnte nicht gelesen werden',
  'toast.invalidBackup': 'Keine gültige Weboo-Backup-Datei',
  'toast.importDone': '{a} hinzugefügt, {u} aktualisiert, {s} übersprungen',
  'toast.restoreFail': 'Wiederherstellung fehlgeschlagen',
  'toast.mdOk': { one: 'Markdown-Datei mit 1 Highlight heruntergeladen', other: 'Markdown-Datei mit {n} Highlights heruntergeladen' },
  'toast.mdFail': 'Markdown-Export fehlgeschlagen',
  'toast.nothingToExport': 'Es gibt keine Highlights zum Exportieren',
  'toast.noArticlesForBooklet': 'Für das Booklet wurden keine Artikel ausgewählt',
  'toast.printOpened': 'Der Druckdialog wurde geöffnet — für ein PDF „Save as PDF“ wählen',
  'toast.bookletOk': { one: 'HTML-Booklet mit 1 Highlight heruntergeladen', other: 'HTML-Booklet mit {n} Highlights heruntergeladen' },
  'toast.bookletFail': 'Booklet konnte nicht erstellt werden',
  'toast.tagInvalid': 'Ungültiger Tag-Name (maximal {n} Zeichen)',
  'toast.tagExists': 'Dieser Tag ist bereits an diesem Artikel',
  'toast.tagCap': 'Maximal {n} Tags pro Artikel',
  'toast.tagAdded': 'Tag „{tag}“ hinzugefügt',
  'toast.tagSaveFail': 'Speichern des Tags fehlgeschlagen',
  'toast.tagRemoved': 'Tag entfernt',
  'toast.tagRemoveFail': 'Entfernen des Tags fehlgeschlagen',

  /* ---------- popup ---------- */
  'popup.brandSub': 'Highlights & Notizen — 100 % lokal',
  'popup.settingsBtnTitle': 'Dashboard & Einstellungen',
  'popup.unsupportedT': 'Diese Seite wird nicht unterstützt',
  'popup.unsupportedDesc': 'Die Erweiterung funktioniert nur auf http-, https- und file-Seiten.',
  'popup.openDash': 'Dashboard öffnen',
  'popup.genericLbl': 'Gespeicherte Highlights insgesamt',
  'popup.genericHint': 'Klicken Sie auf einer Webseite auf das Erweiterungssymbol, um die Highlights dieser Seite zu sehen.',
  'popup.enabledHere': 'Auf dieser Website aktiv',
  'popup.toggleAria': 'Erweiterung auf dieser Website aktiv',
  'popup.applied': 'Angewendet ✓',
  'popup.refreshHint': 'Wenn die Highlights nicht sofort erscheinen, laden Sie die Seite neu.',
  'popup.listTitle': 'Highlights dieser Seite',
  'popup.emptyT': 'Auf dieser Seite gibt es noch keine Highlights.',
  'popup.emptyHint': 'Text auswählen und die schwebende Werkzeugleiste benutzen!',
  'popup.dashboardBtn': 'Gesamtes Dashboard',
  'popup.jumpTitle': 'Zu diesem Highlight springen',
  'popup.hasNote': 'Hat eine Notiz',
  'popup.themeTitle': 'Design: {name}',
  'popup.themeChangeAria': 'Design wechseln ({name})',
  'popup.countOf': '{a} von {b}',
  'popup.backupOk': 'Backup-Datei heruntergeladen',

  /* ---------- floating widgets ---------- */
  'fw.toolbarAria': 'Highlight-Werkzeugleiste',
  'fw.highlightColor': '{name} markieren',
  'fw.noteTitle': 'Highlight + Notiz',
  'fw.noteAria': 'Highlight mit Notiz',
  'fw.copyAria': 'Den ausgewählten Text kopieren',
  'fw.gripTitle': 'Fenster verschieben; ziehen und loslassen',
  'fw.colorAria': 'Farbe {name}',
  'fw.noNote': 'Für dieses Highlight gibt es noch keine Notiz.',
  'fw.addNote': 'Notiz hinzufügen',
  'fw.editNote': 'Notiz bearbeiten',
  'fw.notePlaceholder': 'Ihre Notiz zu diesem Highlight…',
  'fw.saved': 'Gespeichert ✓',
  'fw.saveNote': 'Notiz speichern',
  'fw.copyAllTitle': 'Text und Notiz kopieren',
  'fw.deleteTitle': 'Highlight löschen',
  'fw.deleteConfirm': 'Löschen?',

  /* ---------- highlighter toasts ---------- */
  'hl.copied': 'Kopiert ✓',
  'hl.saveError': 'Speichern fehlgeschlagen.',
  'hl.notHighlightable': 'Dieser Teil der Seite kann nicht markiert werden.',
  'hl.deleted': 'Highlight gelöscht.',
  'hl.notePrefix': '📝 Notiz: ',

  /* ---------- service worker context menu ---------- */
  'menu.highlight': '✨ „%s“ markieren',

  /* ---------- export documents ---------- */
  'ex.mdTitle': 'Mein Highlight-Booklet',
  'ex.exportedFrom': 'Exportiert aus „{app}“',
  'ex.mdEmpty': 'Noch keine Highlights.',
  'ex.note': 'Notiz:',
  'ex.tags': 'Tags:',
  'ex.source': 'Quelle',
  'ex.bookletTitle': 'Highlight-Booklet',
  'ex.coverSub': 'Die vollständige Sammlung der Highlights und Notizen',
  'ex.toc': 'Inhaltsverzeichnis',
  'ex.madeWith': 'Erstellt mit „{app}“ · Version {v}',
  'ex.foot': 'Erstellt mit „{app}“ — alle Daten bleiben ausschließlich auf Ihrem Gerät.',
  'ex.coverAria': 'Booklet-Deckblatt'
};


/* ------------------------------------------------------------------ */
/* Spanish — typed against the canonical key set; tú register, «» quotes */
/* ------------------------------------------------------------------ */

const es: Record<TranslationKey, DictValue> = {
  /* ---------- app identity ---------- */
  'app.name': 'Weboo',

  /* ---------- common ---------- */
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.delete': 'Eliminar',
  'common.add': 'Añadir',
  'common.confirm': '¿Seguro?',
  'common.version': 'Versión',
  'common.untitled': 'Sin título',
  'common.localFile': 'Archivo local',
  'common.from': ' de ',
  'common.copy': 'Copiar texto',
  'common.copyShort': 'Copiar',
  'common.copyOk': 'Copiado ✓',
  'common.copyFail': 'No se pudo copiar',
  'common.saveFail': 'No se pudo guardar la configuración',
  'common.deleteFail': 'No se pudo eliminar',
  'common.nHighlights': { one: '1 resaltado', other: '{n} resaltados' },
  'common.nNotes': { one: '1 nota', other: '{n} notas' },
  'common.nArticles': '{n} artículos',
  'common.nItems': { one: '1 elemento', other: '{n} elementos' },

  /* ---------- colors ---------- */
  'color.yellow': 'Amarillo',
  'color.orange': 'Naranja',
  'color.green': 'Verde',
  'color.teal': 'Turquesa',
  'color.pink': 'Rosa',
  'color.purple': 'Morado',

  /* ---------- themes ---------- */
  'theme.auto': 'Sistema',
  'theme.light': 'Claro',
  'theme.dark': 'Oscuro',
  'theme.autoHint': 'Sigue el modo claro/oscuro del sistema',
  'theme.lightHint': 'Siempre con fondo claro',
  'theme.darkHint': 'Siempre con fondo oscuro',

  /* ---------- interface language ---------- */
  'lang.label': 'Idioma de la interfaz',
  'lang.fa': 'فارسی',
  'lang.en': 'English',
  'lang.de': 'Deutsch',
  'lang.es': 'Español',
  'lang.ru': 'Русский',
  'lang.it': 'Italiano',
  'lang.fr': 'Français',
  'lang.tr': 'Türkçe',
  'lang.desc': 'Se aplica al instante al popup, al panel y a las herramientas flotantes.',
  'lang.groupAria': 'Idioma de la interfaz',

  /* ---------- dashboard shell ---------- */
  'dash.title': 'Panel — Weboo',
  'dash.brandSub': 'Panel de gestión',
  'dash.statsAria': 'Estadísticas generales',
  'dash.toolbarAria': 'Filtro y búsqueda',
  'dash.listAria': 'Resaltados',
  'dash.footer': 'Weboo — todos los datos se guardan solo en este dispositivo; nada se envía a ningún servidor.',
  'dash.settings': 'Ajustes',
  'dash.settingsAria': 'Ajustes',
  'dash.drawerCloseAria': 'Cerrar los ajustes',
  'dash.sectionAppearance': 'Apariencia',
  'dash.sectionColor': 'Color de resaltado por defecto',
  'dash.sectionBehavior': 'Comportamiento',
  'dash.themeGroupAria': 'Tema de la interfaz',
  'dots.title': 'Color por defecto: {name}',
  'behavior.toolbar': 'Mostrar la barra flotante al seleccionar texto',
  'behavior.badge': 'Mostrar el contador en el icono',

  /* ---------- dashboard topbar ---------- */
  'tb.booklet': 'Cuaderno',
  'tb.selectiveBackup': 'Exportación selectiva',
  'tb.selectiveBackupTitle': 'Copia selectiva — por sitios, artículos y etiquetas',
  'tb.backup': 'Exportar copia',
  'tb.backupTitle': 'Exportar copia (toda la biblioteca)',
  'tb.sizeBadgeTitle': 'Tamaño de los datos guardados en este dispositivo',

  /* ---------- dashboard stats ---------- */
  'stats.total': 'Resaltados totales',
  'stats.notes': 'Notas',
  'stats.pages': 'Páginas',
  'stats.sites': 'Sitios',

  /* ---------- dashboard filter toolbar ---------- */
  'search.placeholder': 'Buscar en el texto, las notas o los títulos de página…',
  'search.aria': 'Buscar',
  'filter.colorAria': 'Filtro de color',
  'filter.notesOnly': 'Solo con notas',
  'filter.sortLabel': 'Ordenar:',
  'sort.newest': 'Más recientes',
  'sort.oldest': 'Más antiguos',
  'sort.page': 'Por página',
  'filter.tagsLabel': 'Etiquetas de artículos:',
  'filter.tagsAria': 'Filtro de etiquetas de artículos',

  /* ---------- list chrome ---------- */
  'bulk.expand': 'Desplegar todos los artículos',
  'bulk.expandTitle': 'Todas las tarjetas de artículo se despliegan y también se cargan los resaltados sin cargar',
  'bulk.collapse': 'Plegar todos los artículos',
  'bulk.collapseTitle': 'Todas las tarjetas de artículo se pliegan y también se cargan los resaltados sin cargar; al abrir un artículo se muestran sus resaltados completos',
  'list.loadMore': 'Cargar más ({n} restantes)',
  'empty.noResults': 'No se encontraron resultados.',
  'empty.noResultsSub': 'Prueba con otra búsqueda o cambia los filtros de color y etiquetas.',
  'empty.first': 'Aún no hay resaltados. ¡Selecciona tu primer texto!',
  'empty.firstSub': 'En cualquier página web, selecciona texto y usa la barra flotante de la extensión.',
  'dirsec.rtl': 'Artículos RTL',
  'dirsec.ltr': 'Artículos LTR',
  'dirsec.lead': 'El resaltado más reciente está aquí',
  'dirsec.leadTitle': 'El artículo resaltado más recientemente está en esta sección, por eso se muestra primero',

  /* ---------- article card ---------- */
  'card.order.newest': 'Más recientes',
  'card.order.oldest': 'Más antiguos',
  'card.order.page': 'Página',
  'card.order.pageRev': 'Página inversa',
  'card.order.newestTitle': 'Orden actual de los resaltados: del más reciente al más antiguo; pulsa para invertirlo',
  'card.order.oldestTitle': 'Orden actual de los resaltados: del más antiguo al más reciente; pulsa para invertirlo',
  'card.order.pageTitle': 'Orden actual de los resaltados: según su posición en la página; pulsa para invertirlo',
  'card.order.pageRevTitle': 'Orden actual de los resaltados: posición inversa en la página; pulsa para restaurar el orden de lectura',
  'card.orderAria': 'Orden de los resaltados de este artículo: {label}',
  'card.viewPageTitle': 'Abrir esta página en una pestaña nueva',
  'card.deleteGroupTitle': 'Eliminar todo lo de esta página',
  'card.remaining': '…{n} más de esta página (pulsa «Cargar más» para verlos)',

  /* ---------- highlight item ---------- */
  'item.previewTitle': 'Ver el texto completo de este resaltado',
  'item.notePreviewTitle': 'Ver el texto completo y la nota de este resaltado',
  'item.viewTitle': 'Ver en la página',
  'item.deleteTitle': 'Eliminar este resaltado',

  /* ---------- tags row ---------- */
  'tags.add': 'Etiqueta',
  'tags.addTitle': 'Añadir una etiqueta a este artículo',
  'tags.placeholder': 'Nombre de la etiqueta…',
  'tags.inputAria': 'Nombre de la nueva etiqueta',
  'tags.removeTitle': 'Quitar la etiqueta {tag}',

  /* ---------- disabled hosts ---------- */
  'hosts.title': 'Sitios desactivados',
  'hosts.desc': 'En estos sitios no se crean ni se muestran resaltados (los datos se conservan).',
  'hosts.empty': 'Aún no hay sitios desactivados.',
  'hosts.addPlaceholder': 'Añadir un dominio (p. ej. example.com)',
  'hosts.inputAria': 'Dominio nuevo',
  'hosts.invalid': 'Escribe un dominio válido (p. ej. example.com)',
  'hosts.duplicate': 'Este dominio ya está en la lista',
  'hosts.disabledOk': '{host} está ahora desactivado',
  'hosts.removeTitle': 'Quitar {host}',

  /* ---------- restore section + modal ---------- */
  'restore.title': 'Restaurar copia',
  'restore.desc': 'Elige un archivo de copia JSON; antes de ejecutar nada se te preguntará si quieres fusionar o reemplazar todo.',
  'restore.fileFail': 'No se pudo abrir el archivo',
  'modal.name': 'Nombre de la colección',
  'modal.highlights': 'Resaltados',
  'modal.exportDate': 'Fecha de exportación',
  'modal.type': 'Tipo',
  'modal.partialValue': 'Copia selectiva (parte de la biblioteca)',
  'modal.merge': 'Fusionar',
  'modal.mergeDesc': 'Ganan los registros más recientes; los datos actuales se conservan.',
  'modal.replace': 'Reemplazo completo',
  'modal.replaceDesc': '¡Todos los datos actuales se eliminarán!',
  'modal.start': 'Iniciar restauración',

  /* ---------- danger zone ---------- */
  'danger.title': 'Zona de peligro',
  'danger.desc': 'Esto no se puede deshacer — exporta antes una copia.',
  'danger.arm': 'Eliminar todos los resaltados y notas',
  'danger.placeholder': 'Para confirmar, escribe “delete”',
  'danger.inputAria': 'Confirmar eliminación',
  'danger.go': 'Confirmar y eliminar',
  'danger.done': 'Se han eliminado todos los resaltados y notas',

  /* ---------- modals ---------- */
  'bk.title': 'Cuaderno y Markdown',
  'bk.mdDesc': 'Para Obsidian y cualquier editor Markdown — toda la biblioteca en un archivo, una sección por artículo.',
  'bk.mdBtn': 'Descargar archivo Markdown',
  'bk.pickerTitle': 'Artículos del cuaderno',
  'bk.pickerHint': 'Sin selección entran todos los artículos en el cuaderno; con selección, solo estos.',
  'bk.pickerAria': 'Elegir los artículos del cuaderno',
  'bk.allArticles': 'Todos los artículos estarán en el cuaderno.',
  'bk.pickedStatus': '{n} resaltados de {m} artículos estarán en el cuaderno.',
  'bk.printTitle': 'Cuaderno imprimible',
  'bk.printDesc': 'Diseñado para imprimir en A4 — portada, índice y un artículo por página.',
  'bk.formatAria': 'Formato del cuaderno',
  'bk.html': 'Archivo HTML',
  'bk.htmlDesc': 'Un archivo listo para imprimir — ábrelo en el navegador y pulsa Ctrl+P.',
  'bk.pdf': 'PDF',
  'bk.pdfDesc': 'Se abre el diálogo de impresión del navegador — elige “Save as PDF”.',
  'bk.colorAria': 'Modo de color del cuaderno',
  'bk.color': 'A color',
  'bk.colorDesc': 'Con los colores originales de los resaltados',
  'bk.bw': 'Blanco y negro',
  'bk.bwDesc': 'Menos tinta — ideal para impresoras normales',
  'bk.fontAria': 'Tipografía del cuaderno',
  'bk.fontDefault': '{name} — por defecto',
  'bk.fontDesc': 'Si no está instalada, el navegador muestra una tipografía similar',
  'bk.fontCustom': 'Tipografía personalizada',
  'bk.fontCustomDesc': 'Cualquier tipografía instalada en tu equipo — escribe su nombre exacto',
  'bk.fontCustomPlaceholder': 'p. ej. B Nazanin',
  'bk.build': 'Crear cuaderno',
  'sel.title': 'Copia selectiva',
  'sel.desc': 'Exporta una parte de la biblioteca — cada sitio, artículo o etiqueta que elijas lleva sus resaltados al archivo.',
  'sel.sites': 'Sitios',
  'sel.sitesHint': 'Todos los resaltados de estos sitios',
  'sel.sitesAria': 'Elegir sitios',
  'sel.articles': 'Artículos',
  'sel.articlesHint': 'Resaltados de estos artículos',
  'sel.articlesAria': 'Elegir artículos',
  'sel.tags': 'Etiquetas',
  'sel.tagsHint': 'Todos los resaltados de artículos con esta etiqueta',
  'sel.tagsAria': 'Elegir etiquetas',
  'sel.emptySites': 'Aún no hay sitios',
  'sel.emptyArticles': 'Aún no hay artículos',
  'sel.emptyTags': 'Aún no hay etiquetas',
  'sel.pickOne': 'Elige al menos un elemento.',
  'sel.noMatch': 'Ningún resaltado coincide con esta selección.',
  'sel.status': { one: '1 resaltado irá al archivo.', other: '{n} resaltados irán al archivo.' },
  'sel.download': 'Descargar archivo de copia',

  /* ---------- dashboard toasts ---------- */
  'toast.openPageNoUrl': 'Esta página no tiene dirección guardada',
  'toast.openPageFail': 'No se pudo abrir la página',
  'toast.openHlNoUrl': 'Este resaltado no tiene dirección guardada',
  'toast.nothingToCopy': 'Nada que copiar',
  'toast.deleted': 'Resaltado eliminado',
  'toast.groupDeleted': 'Se han eliminado los resaltados de esta página',
  'toast.readFail': 'No se pudieron leer los datos',
  'toast.backupOk': { one: 'Archivo de copia con 1 resaltado descargado', other: 'Archivo de copia con {n} resaltados descargado' },
  'toast.partialBackupOk': { one: 'Copia selectiva con 1 resaltado descargada', other: 'Copia selectiva con {n} resaltados descargada' },
  'toast.exportFail': 'La exportación falló',
  'toast.fileReadFail': 'No se pudo leer el archivo',
  'toast.invalidBackup': 'No es un archivo de copia válido de Weboo',
  'toast.importDone': '{a} añadidos, {u} actualizados, {s} omitidos',
  'toast.restoreFail': 'La restauración falló',
  'toast.mdOk': { one: 'Archivo Markdown con 1 resaltado descargado', other: 'Archivo Markdown con {n} resaltados descargado' },
  'toast.mdFail': 'La exportación Markdown falló',
  'toast.nothingToExport': 'No hay resaltados para exportar',
  'toast.noArticlesForBooklet': 'No se han elegido artículos para el cuaderno',
  'toast.printOpened': 'Se abrió el diálogo de impresión — elige “Save as PDF” para un PDF',
  'toast.bookletOk': { one: 'Cuaderno HTML con 1 resaltado descargado', other: 'Cuaderno HTML con {n} resaltados descargado' },
  'toast.bookletFail': 'No se pudo crear el cuaderno',
  'toast.tagInvalid': 'Nombre de etiqueta no válido (máx. {n} caracteres)',
  'toast.tagExists': 'Esta etiqueta ya está en este artículo',
  'toast.tagCap': 'Máximo {n} etiquetas por artículo',
  'toast.tagAdded': 'Etiqueta «{tag}» añadida',
  'toast.tagSaveFail': 'No se pudo guardar la etiqueta',
  'toast.tagRemoved': 'Etiqueta quitada',
  'toast.tagRemoveFail': 'No se pudo quitar la etiqueta',

  /* ---------- popup ---------- */
  'popup.brandSub': 'Resaltados y notas — 100 % local',
  'popup.settingsBtnTitle': 'Panel y ajustes',
  'popup.unsupportedT': 'Esta página no es compatible',
  'popup.unsupportedDesc': 'La extensión solo funciona en páginas http, https y file.',
  'popup.openDash': 'Abrir el panel',
  'popup.genericLbl': 'Resaltados guardados en total',
  'popup.genericHint': 'Haz clic en el icono de la extensión dentro de una página web para ver sus resaltados.',
  'popup.enabledHere': 'Activada en este sitio',
  'popup.toggleAria': 'Extensión activada en este sitio',
  'popup.applied': 'Aplicado ✓',
  'popup.refreshHint': 'Si los resaltados no aparecen enseguida, recarga la página.',
  'popup.listTitle': 'Resaltados de esta página',
  'popup.emptyT': 'Todavía no hay resaltados en esta página.',
  'popup.emptyHint': '¡Selecciona texto y usa la barra flotante!',
  'popup.dashboardBtn': 'Panel completo',
  'popup.jumpTitle': 'Ir a este resaltado',
  'popup.hasNote': 'Tiene nota',
  'popup.themeTitle': 'Tema: {name}',
  'popup.themeChangeAria': 'Cambiar el tema ({name})',
  'popup.countOf': '{a} de {b}',
  'popup.backupOk': 'Archivo de copia descargado',

  /* ---------- floating widgets ---------- */
  'fw.toolbarAria': 'Barra de resaltado',
  'fw.highlightColor': 'Resaltar en {name}',
  'fw.noteTitle': 'Resaltado + nota',
  'fw.noteAria': 'Resaltado con nota',
  'fw.copyAria': 'Copiar el texto seleccionado',
  'fw.gripTitle': 'Mover la ventana; arrastra y suelta',
  'fw.colorAria': 'Color {name}',
  'fw.noNote': 'Este resaltado todavía no tiene nota.',
  'fw.addNote': 'Añadir una nota',
  'fw.editNote': 'Editar la nota',
  'fw.notePlaceholder': 'Tu nota para este resaltado…',
  'fw.saved': 'Guardado ✓',
  'fw.saveNote': 'Guardar nota',
  'fw.copyAllTitle': 'Copiar texto y nota',
  'fw.deleteTitle': 'Eliminar el resaltado',
  'fw.deleteConfirm': '¿Eliminar?',

  /* ---------- highlighter toasts ---------- */
  'hl.copied': 'Copiado ✓',
  'hl.saveError': 'El guardado falló.',
  'hl.notHighlightable': 'Esta parte de la página no se puede resaltar.',
  'hl.deleted': 'Resaltado eliminado.',
  'hl.notePrefix': '📝 Nota: ',

  /* ---------- service worker context menu ---------- */
  'menu.highlight': '✨ Resaltar «%s»',

  /* ---------- export documents ---------- */
  'ex.mdTitle': 'Mi cuaderno de resaltados',
  'ex.exportedFrom': 'Exportado desde «{app}»',
  'ex.mdEmpty': 'Aún no hay resaltados.',
  'ex.note': 'Nota:',
  'ex.tags': 'Etiquetas:',
  'ex.source': 'Fuente',
  'ex.bookletTitle': 'Cuaderno de resaltados',
  'ex.coverSub': 'La colección completa de resaltados y notas',
  'ex.toc': 'Índice',
  'ex.madeWith': 'Creado con «{app}» · versión {v}',
  'ex.foot': 'Creado con «{app}» — todos los datos se quedan solo en tu dispositivo.',
  'ex.coverAria': 'Portada del cuaderno'
};

/* ------------------------------------------------------------------ */
/* Russian — typed against the canonical key set; вы register, «»       */
/* quotes, full CLDR plurals (one/few/many — вы́деление/выделения/      */
/* выделений)                                                           */
/* ------------------------------------------------------------------ */

const ru: Record<TranslationKey, DictValue> = {
  /* ---------- app identity ---------- */
  'app.name': 'Weboo',

  /* ---------- common ---------- */
  'common.cancel': 'Отмена',
  'common.close': 'Закрыть',
  'common.delete': 'Удалить',
  'common.add': 'Добавить',
  'common.confirm': 'Вы уверены?',
  'common.version': 'Версия',
  'common.untitled': 'Без названия',
  'common.localFile': 'Локальный файл',
  'common.from': ' из ',
  'common.copy': 'Копировать текст',
  'common.copyShort': 'Копировать',
  'common.copyOk': 'Скопировано ✓',
  'common.copyFail': 'Не удалось скопировать',
  'common.saveFail': 'Не удалось сохранить настройки',
  'common.deleteFail': 'Не удалось удалить',
  'common.nHighlights': { one: '{n} выделение', few: '{n} выделения', many: '{n} выделений', other: '{n} выделений' },
  'common.nNotes': { one: '{n} заметка', few: '{n} заметки', many: '{n} заметок', other: '{n} заметок' },
  'common.nArticles': { one: '{n} статья', few: '{n} статьи', many: '{n} статей', other: '{n} статей' },
  'common.nItems': { one: '{n} элемент', few: '{n} элемента', many: '{n} элементов', other: '{n} элементов' },

  /* ---------- colors ---------- */
  'color.yellow': 'Жёлтый',
  'color.orange': 'Оранжевый',
  'color.green': 'Зелёный',
  'color.teal': 'Бирюзовый',
  'color.pink': 'Розовый',
  'color.purple': 'Фиолетовый',

  /* ---------- themes ---------- */
  'theme.auto': 'Системная',
  'theme.light': 'Светлая',
  'theme.dark': 'Тёмная',
  'theme.autoHint': 'Следует светлому/тёмному режиму системы',
  'theme.lightHint': 'Всегда светлый фон',
  'theme.darkHint': 'Всегда тёмный фон',

  /* ---------- interface language ---------- */
  'lang.label': 'Язык интерфейса',
  'lang.fa': 'فارسی',
  'lang.en': 'English',
  'lang.de': 'Deutsch',
  'lang.es': 'Español',
  'lang.ru': 'Русский',
  'lang.it': 'Italiano',
  'lang.fr': 'Français',
  'lang.tr': 'Türkçe',
  'lang.desc': 'Мгновенно применяется к всплывающему окну, панели и плавающим инструментам.',
  'lang.groupAria': 'Язык интерфейса',

  /* ---------- dashboard shell ---------- */
  'dash.title': 'Панель — Weboo',
  'dash.brandSub': 'Панель управления',
  'dash.statsAria': 'Общая статистика',
  'dash.toolbarAria': 'Фильтр и поиск',
  'dash.listAria': 'Выделения',
  'dash.footer': 'Weboo — все данные хранятся только на этом устройстве; ничего не отправляется на сервер.',
  'dash.settings': 'Настройки',
  'dash.settingsAria': 'Настройки',
  'dash.drawerCloseAria': 'Закрыть настройки',
  'dash.sectionAppearance': 'Оформление',
  'dash.sectionColor': 'Цвет выделения по умолчанию',
  'dash.sectionBehavior': 'Поведение',
  'dash.themeGroupAria': 'Тема интерфейса',
  'dots.title': 'Цвет по умолчанию: {name}',
  'behavior.toolbar': 'Показывать плавающую панель при выделении текста',
  'behavior.badge': 'Показывать счётчик на значке',

  /* ---------- dashboard topbar ---------- */
  'tb.booklet': 'Сборник',
  'tb.selectiveBackup': 'Выборочный экспорт',
  'tb.selectiveBackupTitle': 'Выборочная копия — по сайтам, статьям и тегам',
  'tb.backup': 'Экспорт копии',
  'tb.backupTitle': 'Экспорт копии (вся библиотека)',
  'tb.sizeBadgeTitle': 'Объём данных, сохранённых на этом устройстве',

  /* ---------- dashboard stats ---------- */
  'stats.total': 'Всего выделений',
  'stats.notes': 'Заметки',
  'stats.pages': 'Страницы',
  'stats.sites': 'Сайты',

  /* ---------- dashboard filter toolbar ---------- */
  'search.placeholder': 'Искать в тексте, заметках или заголовках страниц…',
  'search.aria': 'Поиск',
  'filter.colorAria': 'Фильтр по цвету',
  'filter.notesOnly': 'Только с заметками',
  'filter.sortLabel': 'Сортировка:',
  'sort.newest': 'Сначала новые',
  'sort.oldest': 'Сначала старые',
  'sort.page': 'По странице',
  'filter.tagsLabel': 'Теги статей:',
  'filter.tagsAria': 'Фильтр по тегам статей',

  /* ---------- list chrome ---------- */
  'bulk.expand': 'Развернуть все статьи',
  'bulk.expandTitle': 'Все карточки статей развернутся, и все незагруженные выделения тоже загрузятся',
  'bulk.collapse': 'Свернуть все статьи',
  'bulk.collapseTitle': 'Все карточки статей свернутся, и все незагруженные выделения тоже загрузятся; при открытии статьи её выделения показываются полностью',
  'list.loadMore': 'Загрузить ещё (осталось {n})',
  'empty.noResults': 'Ничего не найдено.',
  'empty.noResultsSub': 'Измените поисковый запрос или фильтры цвета и тегов.',
  'empty.first': 'Выделений ещё нет. Выделите свой первый текст!',
  'empty.firstSub': 'На любой веб-странице выделите текст и воспользуйтесь плавающей панелью расширения.',
  'dirsec.rtl': 'Статьи справа налево',
  'dirsec.ltr': 'Статьи слева направо',
  'dirsec.lead': 'Здесь самое свежее выделение',
  'dirsec.leadTitle': 'Статья, выделенная последней, находится в этом разделе — поэтому он показан первым',

  /* ---------- article card ---------- */
  'card.order.newest': 'Сначала новые',
  'card.order.oldest': 'Сначала старые',
  'card.order.page': 'Страница',
  'card.order.pageRev': 'Страница наоборот',
  'card.order.newestTitle': 'Текущий порядок выделений: от новых к старым; нажмите, чтобы изменить порядок',
  'card.order.oldestTitle': 'Текущий порядок выделений: от старых к новым; нажмите, чтобы изменить порядок',
  'card.order.pageTitle': 'Текущий порядок выделений: по расположению в тексте страницы; нажмите, чтобы изменить порядок',
  'card.order.pageRevTitle': 'Текущий порядок выделений: обратный порядку в тексте страницы; нажмите, чтобы вернуть порядок чтения',
  'card.orderAria': 'Порядок выделений этой статьи: {label}',
  'card.viewPageTitle': 'Открыть эту страницу в новой вкладке',
  'card.deleteGroupTitle': 'Удалить всё с этой страницы',
  'card.remaining': '…ещё {n} с этой страницы (нажмите «Загрузить ещё», чтобы показать)',

  /* ---------- highlight item ---------- */
  'item.previewTitle': 'Показать полный текст этого выделения',
  'item.notePreviewTitle': 'Показать полный текст и заметку этого выделения',
  'item.viewTitle': 'Открыть на странице',
  'item.deleteTitle': 'Удалить это выделение',

  /* ---------- tags row ---------- */
  'tags.add': 'Тег',
  'tags.addTitle': 'Добавить тег к этой статье',
  'tags.placeholder': 'Название тега…',
  'tags.inputAria': 'Название нового тега',
  'tags.removeTitle': 'Убрать тег {tag}',

  /* ---------- disabled hosts ---------- */
  'hosts.title': 'Отключённые сайты',
  'hosts.desc': 'На этих сайтах выделения не создаются и не показываются (данные сохраняются).',
  'hosts.empty': 'Отключённых сайтов пока нет.',
  'hosts.addPlaceholder': 'Добавить домен (например, example.com)',
  'hosts.inputAria': 'Новый домен',
  'hosts.invalid': 'Введите корректный домен (например, example.com)',
  'hosts.duplicate': 'Этот домен уже есть в списке',
  'hosts.disabledOk': 'Сайт {host} отключён',
  'hosts.removeTitle': 'Убрать {host}',

  /* ---------- restore section + modal ---------- */
  'restore.title': 'Восстановить копию',
  'restore.desc': 'Выберите JSON-файл копии; перед выполнением спросим: объединить или полностью заменить.',
  'restore.fileFail': 'Не удалось открыть файл',
  'modal.name': 'Название коллекции',
  'modal.highlights': 'Выделения',
  'modal.exportDate': 'Дата экспорта',
  'modal.type': 'Тип',
  'modal.partialValue': 'Выборочная копия (часть библиотеки)',
  'modal.merge': 'Объединение',
  'modal.mergeDesc': 'Побеждают более новые записи; текущие данные сохраняются.',
  'modal.replace': 'Полная замена',
  'modal.replaceDesc': 'Все текущие данные будут удалены!',
  'modal.start': 'Начать восстановление',

  /* ---------- danger zone ---------- */
  'danger.title': 'Опасная зона',
  'danger.desc': 'Это действие необратимо — сначала сделайте экспорт копии.',
  'danger.arm': 'Удалить все выделения и заметки',
  'danger.placeholder': 'Для подтверждения введите «delete»',
  'danger.inputAria': 'Подтверждение удаления',
  'danger.go': 'Подтвердить и удалить',
  'danger.done': 'Все выделения и заметки удалены',

  /* ---------- modals ---------- */
  'bk.title': 'Сборник и Markdown',
  'bk.mdDesc': 'Для Obsidian и любого Markdown-редактора — вся библиотека в одном файле, по разделу на статью.',
  'bk.mdBtn': 'Скачать Markdown-файл',
  'bk.pickerTitle': 'Статьи сборника',
  'bk.pickerHint': 'Без выбора в сборник попадут все статьи; с выбором — только отмеченные.',
  'bk.pickerAria': 'Выбрать статьи сборника',
  'bk.allArticles': 'В сборник попадут все статьи.',
  'bk.pickedStatus': '{n} выделений из {m} статей попадут в сборник.',
  'bk.printTitle': 'Сборник для печати',
  'bk.printDesc': 'Свёрстан для печати A4 — обложка, оглавление и по статье на страницу.',
  'bk.formatAria': 'Формат сборника',
  'bk.html': 'HTML-файл',
  'bk.htmlDesc': 'Готовый к печати файл — откройте его в браузере и нажмите Ctrl+P.',
  'bk.pdf': 'PDF',
  'bk.pdfDesc': 'Откроется диалог печати браузера — выберите «Save as PDF».',
  'bk.colorAria': 'Цветовой режим сборника',
  'bk.color': 'Цветной',
  'bk.colorDesc': 'С исходными цветами выделений',
  'bk.bw': 'Чёрно-белый',
  'bk.bwDesc': 'Меньше краски — для обычного принтера',
  'bk.fontAria': 'Шрифт сборника',
  'bk.fontDefault': '{name} — по умолчанию',
  'bk.fontDesc': 'Если шрифт не установлен, браузер покажет похожий',
  'bk.fontCustom': 'Свой шрифт',
  'bk.fontCustomDesc': 'Любой шрифт, установленный на вашем устройстве — введите его точное название',
  'bk.fontCustomPlaceholder': 'например, B Nazanin',
  'bk.build': 'Создать сборник',
  'sel.title': 'Выборочная копия',
  'sel.desc': 'Экспортируйте часть библиотеки — каждый выбранный сайт, статья или тег возьмёт свои выделения в файл.',
  'sel.sites': 'Сайты',
  'sel.sitesHint': 'Все выделения этих сайтов',
  'sel.sitesAria': 'Выбрать сайты',
  'sel.articles': 'Статьи',
  'sel.articlesHint': 'Выделения этих статей',
  'sel.articlesAria': 'Выбрать статьи',
  'sel.tags': 'Теги',
  'sel.tagsHint': 'Все выделения статей с этим тегом',
  'sel.tagsAria': 'Выбрать теги',
  'sel.emptySites': 'Сайтов пока нет',
  'sel.emptyArticles': 'Статей пока нет',
  'sel.emptyTags': 'Тегов пока нет',
  'sel.pickOne': 'Выберите хотя бы один пункт.',
  'sel.noMatch': 'С этим выбором не совпадает ни одно выделение.',
  'sel.status': { one: 'В файл попадёт {n} выделение.', few: 'В файл попадут {n} выделения.', many: 'В файл попадут {n} выделений.', other: 'В файл попадут {n} выделений.' },
  'sel.download': 'Скачать файл копии',

  /* ---------- dashboard toasts ---------- */
  'toast.openPageNoUrl': 'У этой страницы нет сохранённого адреса',
  'toast.openPageFail': 'Не удалось открыть страницу',
  'toast.openHlNoUrl': 'У этого выделения нет сохранённого адреса',
  'toast.nothingToCopy': 'Нечего копировать',
  'toast.deleted': 'Выделение удалено',
  'toast.groupDeleted': 'Выделения этой страницы удалены',
  'toast.readFail': 'Не удалось прочитать данные',
  'toast.backupOk': { one: 'Скачан файл копии с {n} выделением', few: 'Скачан файл копии с {n} выделениями', many: 'Скачан файл копии с {n} выделениями', other: 'Скачан файл копии с {n} выделениями' },
  'toast.partialBackupOk': { one: 'Скачана выборочная копия с {n} выделением', few: 'Скачана выборочная копия с {n} выделениями', many: 'Скачана выборочная копия с {n} выделениями', other: 'Скачана выборочная копия с {n} выделениями' },
  'toast.exportFail': 'Экспорт не удался',
  'toast.fileReadFail': 'Не удалось прочитать файл',
  'toast.invalidBackup': 'Это не корректный файл копии Weboo',
  'toast.importDone': 'Добавлено: {a}, обновлено: {u}, пропущено: {s}',
  'toast.restoreFail': 'Восстановление не удалось',
  'toast.mdOk': { one: 'Скачан Markdown-файл с {n} выделением', few: 'Скачан Markdown-файл с {n} выделениями', many: 'Скачан Markdown-файл с {n} выделениями', other: 'Скачан Markdown-файл с {n} выделениями' },
  'toast.mdFail': 'Экспорт Markdown не удался',
  'toast.nothingToExport': 'Нет выделений для экспорта',
  'toast.noArticlesForBooklet': 'Для сборника не выбраны статьи',
  'toast.printOpened': 'Открылся диалог печати — для PDF выберите «Save as PDF»',
  'toast.bookletOk': { one: 'Скачан HTML-сборник с {n} выделением', few: 'Скачан HTML-сборник с {n} выделениями', many: 'Скачан HTML-сборник с {n} выделениями', other: 'Скачан HTML-сборник с {n} выделениями' },
  'toast.bookletFail': 'Не удалось создать сборник',
  'toast.tagInvalid': 'Некорректное имя тега (максимум {n} символов)',
  'toast.tagExists': 'Этот тег уже есть у статьи',
  'toast.tagCap': 'Максимум {n} тегов на статью',
  'toast.tagAdded': 'Тег «{tag}» добавлен',
  'toast.tagSaveFail': 'Не удалось сохранить тег',
  'toast.tagRemoved': 'Тег убран',
  'toast.tagRemoveFail': 'Не удалось убрать тег',

  /* ---------- popup ---------- */
  'popup.brandSub': 'Выделения и заметки — 100 % локально',
  'popup.settingsBtnTitle': 'Панель и настройки',
  'popup.unsupportedT': 'Эта страница не поддерживается',
  'popup.unsupportedDesc': 'Расширение работает только на страницах http, https и file.',
  'popup.openDash': 'Открыть панель',
  'popup.genericLbl': 'Всего сохранённых выделений',
  'popup.genericHint': 'Нажмите на значок расширения на веб-странице, чтобы увидеть её выделения.',
  'popup.enabledHere': 'Включено на этом сайте',
  'popup.toggleAria': 'Расширение включено на этом сайте',
  'popup.applied': 'Применено ✓',
  'popup.refreshHint': 'Если выделения появились не сразу, обновите страницу.',
  'popup.listTitle': 'Выделения этой страницы',
  'popup.emptyT': 'На этой странице пока нет выделений.',
  'popup.emptyHint': 'Выделите текст и воспользуйтесь плавающей панелью!',
  'popup.dashboardBtn': 'Вся панель',
  'popup.jumpTitle': 'Перейти к этому выделению',
  'popup.hasNote': 'Есть заметка',
  'popup.themeTitle': 'Тема: {name}',
  'popup.themeChangeAria': 'Сменить тему ({name})',
  'popup.countOf': '{a} из {b}',
  'popup.backupOk': 'Файл копии скачан',

  /* ---------- floating widgets ---------- */
  'fw.toolbarAria': 'Панель выделения',
  'fw.highlightColor': 'Выделить цветом «{name}»',
  'fw.noteTitle': 'Выделение + заметка',
  'fw.noteAria': 'Выделение с заметкой',
  'fw.copyAria': 'Копировать выделенный текст',
  'fw.gripTitle': 'Переместить окно; потяните и отпустите',
  'fw.colorAria': 'Цвет «{name}»',
  'fw.noNote': 'У этого выделения пока нет заметки.',
  'fw.addNote': 'Добавить заметку',
  'fw.editNote': 'Редактировать заметку',
  'fw.notePlaceholder': 'Ваша заметка к этому выделению…',
  'fw.saved': 'Сохранено ✓',
  'fw.saveNote': 'Сохранить заметку',
  'fw.copyAllTitle': 'Копировать текст и заметку',
  'fw.deleteTitle': 'Удалить выделение',
  'fw.deleteConfirm': 'Удалить?',

  /* ---------- highlighter toasts ---------- */
  'hl.copied': 'Скопировано ✓',
  'hl.saveError': 'Не удалось сохранить.',
  'hl.notHighlightable': 'Эта часть страницы не может быть выделена.',
  'hl.deleted': 'Выделение удалено.',
  'hl.notePrefix': '📝 Заметка: ',

  /* ---------- service worker context menu ---------- */
  'menu.highlight': '✨ Выделить «%s»',

  /* ---------- export documents ---------- */
  'ex.mdTitle': 'Мой сборник выделений',
  'ex.exportedFrom': 'Экспорт из «{app}»',
  'ex.mdEmpty': 'Выделений пока нет.',
  'ex.note': 'Заметка:',
  'ex.tags': 'Теги:',
  'ex.source': 'Источник',
  'ex.bookletTitle': 'Сборник выделений',
  'ex.coverSub': 'Полная коллекция выделений и заметок',
  'ex.toc': 'Оглавление',
  'ex.madeWith': 'Создано в «{app}» · версия {v}',
  'ex.foot': 'Создано в «{app}» — все данные хранятся только на вашем устройстве.',
  'ex.coverAria': 'Обложка сборника'
};

/* ------------------------------------------------------------------ */
/* Italian — typed against the canonical key set; tu register, «» quotes */
/* ------------------------------------------------------------------ */

const it: Record<TranslationKey, DictValue> = {
  /* ---------- app identity ---------- */
  'app.name': 'Weboo',

  /* ---------- common ---------- */
  'common.cancel': 'Annulla',
  'common.close': 'Chiudi',
  'common.delete': 'Elimina',
  'common.add': 'Aggiungi',
  'common.confirm': 'Sicuro?',
  'common.version': 'Versione',
  'common.untitled': 'Senza titolo',
  'common.localFile': 'File locale',
  'common.from': ' da ',
  'common.copy': 'Copia testo',
  'common.copyShort': 'Copia',
  'common.copyOk': 'Copiato ✓',
  'common.copyFail': 'Copia non riuscita',
  'common.saveFail': 'Salvataggio delle impostazioni non riuscito',
  'common.deleteFail': 'Eliminazione non riuscita',
  'common.nHighlights': { one: '1 evidenziazione', other: '{n} evidenziazioni' },
  'common.nNotes': { one: '1 nota', other: '{n} note' },
  'common.nArticles': '{n} articoli',
  'common.nItems': { one: '1 elemento', other: '{n} elementi' },

  /* ---------- colors ---------- */
  'color.yellow': 'Giallo',
  'color.orange': 'Arancione',
  'color.green': 'Verde',
  'color.teal': 'Turchese',
  'color.pink': 'Rosa',
  'color.purple': 'Viola',

  /* ---------- themes ---------- */
  'theme.auto': 'Sistema',
  'theme.light': 'Chiaro',
  'theme.dark': 'Scuro',
  'theme.autoHint': 'Segue il tema chiaro/scuro del sistema',
  'theme.lightHint': 'Sempre con sfondo chiaro',
  'theme.darkHint': 'Sempre con sfondo scuro',

  /* ---------- interface language ---------- */
  'lang.label': 'Lingua dell’interfaccia',
  'lang.fa': 'فارسی',
  'lang.en': 'English',
  'lang.de': 'Deutsch',
  'lang.es': 'Español',
  'lang.ru': 'Русский',
  'lang.it': 'Italiano',
  'lang.fr': 'Français',
  'lang.tr': 'Türkçe',
  'lang.desc': 'Si applica subito al popup, al pannello e agli strumenti flottanti.',
  'lang.groupAria': 'Lingua dell’interfaccia',

  /* ---------- dashboard shell ---------- */
  'dash.title': 'Pannello — Weboo',
  'dash.brandSub': 'Pannello di gestione',
  'dash.statsAria': 'Statistiche generali',
  'dash.toolbarAria': 'Filtro e ricerca',
  'dash.listAria': 'Evidenziazioni',
  'dash.footer': 'Weboo — tutti i dati restano solo su questo dispositivo; nulla viene inviato a un server.',
  'dash.settings': 'Impostazioni',
  'dash.settingsAria': 'Impostazioni',
  'dash.drawerCloseAria': 'Chiudi le impostazioni',
  'dash.sectionAppearance': 'Aspetto',
  'dash.sectionColor': 'Colore di evidenziazione predefinito',
  'dash.sectionBehavior': 'Comportamento',
  'dash.themeGroupAria': 'Tema dell’interfaccia',
  'dots.title': 'Colore predefinito: {name}',
  'behavior.toolbar': 'Mostra la barra flottante alla selezione del testo',
  'behavior.badge': 'Mostra il contatore sull’icona',

  /* ---------- dashboard topbar ---------- */
  'tb.booklet': 'Quaderno',
  'tb.selectiveBackup': 'Esportazione selettiva',
  'tb.selectiveBackupTitle': 'Copia selettiva — per siti, articoli e tag',
  'tb.backup': 'Esporta copia',
  'tb.backupTitle': 'Esporta copia (interna biblioteca)',
  'tb.sizeBadgeTitle': 'Dimensione dei dati salvati su questo dispositivo',

  /* ---------- dashboard stats ---------- */
  'stats.total': 'Evidenziazioni totali',
  'stats.notes': 'Note',
  'stats.pages': 'Pagine',
  'stats.sites': 'Siti',

  /* ---------- dashboard filter toolbar ---------- */
  'search.placeholder': 'Cerca nel testo, nelle note o nei titoli delle pagine…',
  'search.aria': 'Cerca',
  'filter.colorAria': 'Filtro per colore',
  'filter.notesOnly': 'Solo con note',
  'filter.sortLabel': 'Ordina:',
  'sort.newest': 'Più recenti',
  'sort.oldest': 'Più vecchi',
  'sort.page': 'Per pagina',
  'filter.tagsLabel': 'Tag degli articoli:',
  'filter.tagsAria': 'Filtro per tag degli articoli',

  /* ---------- list chrome ---------- */
  'bulk.expand': 'Espandi tutti gli articoli',
  'bulk.expandTitle': 'Tutte le schede articolo si aprono e si caricano anche le evidenziazioni non ancora caricate',
  'bulk.collapse': 'Comprimi tutti gli articoli',
  'bulk.collapseTitle': 'Tutte le schede articolo si chiudono e si caricano anche le evidenziazioni non ancora caricate; aprendo un articolo le sue evidenziazioni si mostrano complete',
  'list.loadMore': 'Carica altri ({n} rimanenti)',
  'empty.noResults': 'Nessun risultato trovato.',
  'empty.noResultsSub': 'Prova un’altra ricerca o cambia i filtri colore e tag.',
  'empty.first': 'Ancora nessuna evidenziazione. Seleziona il tuo primo testo!',
  'empty.firstSub': 'Su qualsiasi pagina web, seleziona del testo e usa la barra flottante dell’estensione.',
  'dirsec.rtl': 'Articoli RTL',
  'dirsec.ltr': 'Articoli LTR',
  'dirsec.lead': 'Qui c’è l’evidenziazione più recente',
  'dirsec.leadTitle': 'L’articolo evidenziato più di recente si trova in questa sezione, per questo viene mostrato per primo',

  /* ---------- article card ---------- */
  'card.order.newest': 'Più recenti',
  'card.order.oldest': 'Più vecchi',
  'card.order.page': 'Pagina',
  'card.order.pageRev': 'Pagina inversa',
  'card.order.newestTitle': 'Ordine attuale delle evidenziazioni: dal più recente al più vecchio; premi per invertirlo',
  'card.order.oldestTitle': 'Ordine attuale delle evidenziazioni: dal più vecchio al più recente; premi per invertirlo',
  'card.order.pageTitle': 'Ordine attuale delle evidenziazioni: secondo la posizione nella pagina; premi per invertirlo',
  'card.order.pageRevTitle': 'Ordine attuale delle evidenziazioni: posizione inversa nella pagina; premi per ripristinare l’ordine di lettura',
  'card.orderAria': 'Ordine delle evidenziazioni di questo articolo: {label}',
  'card.viewPageTitle': 'Apri questa pagina in una nuova scheda',
  'card.deleteGroupTitle': 'Elimina tutto di questa pagina',
  'card.remaining': '…altri {n} da questa pagina (premi «Carica altri» per mostrarli)',

  /* ---------- highlight item ---------- */
  'item.previewTitle': 'Mostra il testo completo di questa evidenziazione',
  'item.notePreviewTitle': 'Mostra il testo completo e la nota di questa evidenziazione',
  'item.viewTitle': 'Vedi nella pagina',
  'item.deleteTitle': 'Elimina questa evidenziazione',

  /* ---------- tags row ---------- */
  'tags.add': 'Tag',
  'tags.addTitle': 'Aggiungi un tag a questo articolo',
  'tags.placeholder': 'Nome del tag…',
  'tags.inputAria': 'Nome del nuovo tag',
  'tags.removeTitle': 'Rimuovi il tag {tag}',

  /* ---------- disabled hosts ---------- */
  'hosts.title': 'Siti disattivati',
  'hosts.desc': 'Su questi siti non si creano né si mostrano evidenziazioni (i dati restano al loro posto).',
  'hosts.empty': 'Nessun sito disattivato finora.',
  'hosts.addPlaceholder': 'Aggiungi un dominio (es. example.com)',
  'hosts.inputAria': 'Nuovo dominio',
  'hosts.invalid': 'Inserisci un dominio valido (es. example.com)',
  'hosts.duplicate': 'Questo dominio è già nell’elenco',
  'hosts.disabledOk': '{host} ora è disattivato',
  'hosts.removeTitle': 'Rimuovi {host}',

  /* ---------- restore section + modal ---------- */
  'restore.title': 'Ripristina copia',
  'restore.desc': 'Scegli un file di copia JSON; prima di eseguire verrà chiesto se fondere o sostituire tutto.',
  'restore.fileFail': 'Apertura del file non riuscita',
  'modal.name': 'Nome della raccolta',
  'modal.highlights': 'Evidenziazioni',
  'modal.exportDate': 'Data dell’esportazione',
  'modal.type': 'Tipo',
  'modal.partialValue': 'Copia selettiva (parte della biblioteca)',
  'modal.merge': 'Unisci',
  'modal.mergeDesc': 'Vincono le voci più recenti; i dati attuali restano al loro posto.',
  'modal.replace': 'Sostituzione totale',
  'modal.replaceDesc': 'Tutti i dati attuali verranno eliminati!',
  'modal.start': 'Avvia il ripristino',

  /* ---------- danger zone ---------- */
  'danger.title': 'Zona di pericolo',
  'danger.desc': 'L’operazione è irreversibile — prima esporta una copia.',
  'danger.arm': 'Elimina tutte le evidenziazioni e le note',
  'danger.placeholder': 'Per confermare, scrivi “delete”',
  'danger.inputAria': 'Conferma l’eliminazione',
  'danger.go': 'Conferma ed elimina',
  'danger.done': 'Tutte le evidenziazioni e le note sono state eliminate',

  /* ---------- modals ---------- */
  'bk.title': 'Quaderno e Markdown',
  'bk.mdDesc': 'Per Obsidian e qualsiasi editor Markdown — tutta la biblioteca in un file, una sezione per articolo.',
  'bk.mdBtn': 'Scarica il file Markdown',
  'bk.pickerTitle': 'Articoli del quaderno',
  'bk.pickerHint': 'Senza selezione nel quaderno entrano tutti gli articoli; con selezione solo questi.',
  'bk.pickerAria': 'Scegli gli articoli del quaderno',
  'bk.allArticles': 'Tutti gli articoli saranno nel quaderno.',
  'bk.pickedStatus': '{n} evidenziazioni da {m} articoli saranno nel quaderno.',
  'bk.printTitle': 'Quaderno stampabile',
  'bk.printDesc': 'Progettato per la stampa A4 — copertina, indice e un articolo per pagina.',
  'bk.formatAria': 'Formato del quaderno',
  'bk.html': 'File HTML',
  'bk.htmlDesc': 'Un file pronto per la stampa — aprilo nel browser e premi Ctrl+P.',
  'bk.pdf': 'PDF',
  'bk.pdfDesc': 'Si apre la finestra di stampa del browser — scegli “Save as PDF”.',
  'bk.colorAria': 'Modalità colore del quaderno',
  'bk.color': 'A colori',
  'bk.colorDesc': 'Con i colori originali delle evidenziazioni',
  'bk.bw': 'Bianco e nero',
  'bk.bwDesc': 'Meno inchiostro — ideale per una stampante normale',
  'bk.fontAria': 'Carattere del quaderno',
  'bk.fontDefault': '{name} — predefinito',
  'bk.fontDesc': 'Se non è installato, il browser ne mostra uno simile',
  'bk.fontCustom': 'Carattere personalizzato',
  'bk.fontCustomDesc': 'Qualsiasi carattere installato sul tuo dispositivo — scrivi il nome esatto',
  'bk.fontCustomPlaceholder': 'es. B Nazanin',
  'bk.build': 'Crea il quaderno',
  'sel.title': 'Copia selettiva',
  'sel.desc': 'Esporta una parte della biblioteca — ogni sito, articolo o tag scelto porta le sue evidenziazioni nel file.',
  'sel.sites': 'Siti',
  'sel.sitesHint': 'Tutte le evidenziazioni di questi siti',
  'sel.sitesAria': 'Scegli i siti',
  'sel.articles': 'Articoli',
  'sel.articlesHint': 'Evidenziazioni di questi articoli',
  'sel.articlesAria': 'Scegli gli articoli',
  'sel.tags': 'Tag',
  'sel.tagsHint': 'Tutte le evidenziazioni degli articoli con questo tag',
  'sel.tagsAria': 'Scegli i tag',
  'sel.emptySites': 'Ancora nessun sito',
  'sel.emptyArticles': 'Ancora nessun articolo',
  'sel.emptyTags': 'Ancora nessun tag',
  'sel.pickOne': 'Scegli almeno una voce.',
  'sel.noMatch': 'Nessuna evidenziazione corrisponde a questa selezione.',
  'sel.status': { one: '1 evidenziazione andrà nel file.', other: '{n} evidenziazioni andranno nel file.' },
  'sel.download': 'Scarica il file di copia',

  /* ---------- dashboard toasts ---------- */
  'toast.openPageNoUrl': 'Questa pagina non ha un indirizzo salvato',
  'toast.openPageFail': 'Apertura della pagina non riuscita',
  'toast.openHlNoUrl': 'Questa evidenziazione non ha un indirizzo salvato',
  'toast.nothingToCopy': 'Niente da copiare',
  'toast.deleted': 'Evidenziazione eliminata',
  'toast.groupDeleted': 'Le evidenziazioni di questa pagina sono state eliminate',
  'toast.readFail': 'Lettura dei dati non riuscita',
  'toast.backupOk': { one: 'File di copia con 1 evidenziazione scaricato', other: 'File di copia con {n} evidenziazioni scaricato' },
  'toast.partialBackupOk': { one: 'Copia selettiva con 1 evidenziazione scaricata', other: 'Copia selettiva con {n} evidenziazioni scaricata' },
  'toast.exportFail': 'Esportazione non riuscita',
  'toast.fileReadFail': 'Lettura del file non riuscita',
  'toast.invalidBackup': 'Non è un file di copia Weboo valido',
  'toast.importDone': '{a} aggiunte, {u} aggiornate, {s} saltate',
  'toast.restoreFail': 'Ripristino non riuscito',
  'toast.mdOk': { one: 'File Markdown con 1 evidenziazione scaricato', other: 'File Markdown con {n} evidenziazioni scaricato' },
  'toast.mdFail': 'Esportazione Markdown non riuscita',
  'toast.nothingToExport': 'Non ci sono evidenziazioni da esportare',
  'toast.noArticlesForBooklet': 'Nessun articolo scelto per il quaderno',
  'toast.printOpened': 'Si è aperta la finestra di stampa — per un PDF scegli “Save as PDF”',
  'toast.bookletOk': { one: 'Quaderno HTML con 1 evidenziazione scaricato', other: 'Quaderno HTML con {n} evidenziazioni scaricato' },
  'toast.bookletFail': 'Creazione del quaderno non riuscita',
  'toast.tagInvalid': 'Nome del tag non valido (max {n} caratteri)',
  'toast.tagExists': 'Questo tag è già su questo articolo',
  'toast.tagCap': 'Al massimo {n} tag per articolo',
  'toast.tagAdded': 'Tag «{tag}» aggiunto',
  'toast.tagSaveFail': 'Salvataggio del tag non riuscito',
  'toast.tagRemoved': 'Tag rimosso',
  'toast.tagRemoveFail': 'Rimozione del tag non riuscita',

  /* ---------- popup ---------- */
  'popup.brandSub': 'Evidenziazioni e note — 100% locale',
  'popup.settingsBtnTitle': 'Pannello e impostazioni',
  'popup.unsupportedT': 'Questa pagina non è supportata',
  'popup.unsupportedDesc': 'L’estensione funziona solo su pagine http, https e file.',
  'popup.openDash': 'Apri il pannello',
  'popup.genericLbl': 'Evidenziazioni salvate in totale',
  'popup.genericHint': 'Fai clic sull’icona dell’estensione dentro una pagina web per vederne le evidenziazioni.',
  'popup.enabledHere': 'Attiva su questo sito',
  'popup.toggleAria': 'Estensione attiva su questo sito',
  'popup.applied': 'Applicato ✓',
  'popup.refreshHint': 'Se le evidenziazioni non compaiono subito, ricarica la pagina.',
  'popup.listTitle': 'Evidenziazioni di questa pagina',
  'popup.emptyT': 'In questa pagina non ci sono ancora evidenziazioni.',
  'popup.emptyHint': 'Seleziona del testo e usa la barra flottante!',
  'popup.dashboardBtn': 'Pannello completo',
  'popup.jumpTitle': 'Vai a questa evidenziazione',
  'popup.hasNote': 'Ha una nota',
  'popup.themeTitle': 'Tema: {name}',
  'popup.themeChangeAria': 'Cambia il tema ({name})',
  'popup.countOf': '{a} di {b}',
  'popup.backupOk': 'File di copia scaricato',

  /* ---------- floating widgets ---------- */
  'fw.toolbarAria': 'Barra di evidenziazione',
  'fw.highlightColor': 'Evidenzia in {name}',
  'fw.noteTitle': 'Evidenziazione + nota',
  'fw.noteAria': 'Evidenziazione con nota',
  'fw.copyAria': 'Copia il testo selezionato',
  'fw.gripTitle': 'Sposta la finestra; trascina e rilascia',
  'fw.colorAria': 'Colore {name}',
  'fw.noNote': 'Questa evidenziazione non ha ancora una nota.',
  'fw.addNote': 'Aggiungi una nota',
  'fw.editNote': 'Modifica la nota',
  'fw.notePlaceholder': 'La tua nota per questa evidenziazione…',
  'fw.saved': 'Salvato ✓',
  'fw.saveNote': 'Salva la nota',
  'fw.copyAllTitle': 'Copia testo e nota',
  'fw.deleteTitle': 'Elimina l’evidenziazione',
  'fw.deleteConfirm': 'Eliminare?',

  /* ---------- highlighter toasts ---------- */
  'hl.copied': 'Copiato ✓',
  'hl.saveError': 'Salvataggio non riuscito.',
  'hl.notHighlightable': 'Questa parte della pagina non può essere evidenziata.',
  'hl.deleted': 'Evidenziazione eliminata.',
  'hl.notePrefix': '📝 Nota: ',

  /* ---------- service worker context menu ---------- */
  'menu.highlight': '✨ Evidenzia «%s»',

  /* ---------- export documents ---------- */
  'ex.mdTitle': 'Il mio quaderno di evidenziazioni',
  'ex.exportedFrom': 'Esportato da «{app}»',
  'ex.mdEmpty': 'Ancora nessuna evidenziazione.',
  'ex.note': 'Nota:',
  'ex.tags': 'Tag:',
  'ex.source': 'Fonte',
  'ex.bookletTitle': 'Quaderno di evidenziazioni',
  'ex.coverSub': 'La raccolta completa di evidenziazioni e note',
  'ex.toc': 'Indice',
  'ex.madeWith': 'Creato con «{app}» · versione {v}',
  'ex.foot': 'Creato con «{app}» — tutti i dati restano solo sul tuo dispositivo.',
  'ex.coverAria': 'Copertina del quaderno'
};

/* ------------------------------------------------------------------ */
/* French — typed against the canonical key set; vous register, « »     */
/* quotes, one+other plurals (fr's «many» beyond a million falls back   */
/* to other)                                                            */
/* ------------------------------------------------------------------ */

const fr: Record<TranslationKey, DictValue> = {
  /* ---------- app identity ---------- */
  'app.name': 'Weboo',

  /* ---------- common ---------- */
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',
  'common.delete': 'Supprimer',
  'common.add': 'Ajouter',
  'common.confirm': 'Êtes-vous sûr ?',
  'common.version': 'Version',
  'common.untitled': 'Sans titre',
  'common.localFile': 'Fichier local',
  'common.from': ' de ',
  'common.copy': 'Copier le texte',
  'common.copyShort': 'Copier',
  'common.copyOk': 'Copié ✓',
  'common.copyFail': 'Échec de la copie',
  'common.saveFail': 'Échec de l’enregistrement des réglages',
  'common.deleteFail': 'Échec de la suppression',
  'common.nHighlights': { one: '1 surlignage', other: '{n} surlignages' },
  'common.nNotes': { one: '1 note', other: '{n} notes' },
  'common.nArticles': '{n} articles',
  'common.nItems': { one: '1 élément', other: '{n} éléments' },

  /* ---------- colors ---------- */
  'color.yellow': 'Jaune',
  'color.orange': 'Orange',
  'color.green': 'Vert',
  'color.teal': 'Turquoise',
  'color.pink': 'Rose',
  'color.purple': 'Violet',

  /* ---------- themes ---------- */
  'theme.auto': 'Système',
  'theme.light': 'Clair',
  'theme.dark': 'Sombre',
  'theme.autoHint': 'Suit le mode clair/sombre du système',
  'theme.lightHint': 'Toujours un fond clair',
  'theme.darkHint': 'Toujours un fond sombre',

  /* ---------- interface language ---------- */
  'lang.label': 'Langue de l’interface',
  'lang.fa': 'فارسی',
  'lang.en': 'English',
  'lang.de': 'Deutsch',
  'lang.es': 'Español',
  'lang.ru': 'Русский',
  'lang.it': 'Italiano',
  'lang.fr': 'Français',
  'lang.tr': 'Türkçe',
  'lang.desc': 'S’applique aussitôt au popup, au tableau de bord et aux outils flottants.',
  'lang.groupAria': 'Langue de l’interface',

  /* ---------- dashboard shell ---------- */
  'dash.title': 'Tableau de bord — Weboo',
  'dash.brandSub': 'Tableau de bord de gestion',
  'dash.statsAria': 'Statistiques générales',
  'dash.toolbarAria': 'Filtre et recherche',
  'dash.listAria': 'Surlignages',
  'dash.footer': 'Weboo — toutes les données restent sur cet appareil uniquement ; rien n’est envoyé à un serveur.',
  'dash.settings': 'Réglages',
  'dash.settingsAria': 'Réglages',
  'dash.drawerCloseAria': 'Fermer les réglages',
  'dash.sectionAppearance': 'Apparence',
  'dash.sectionColor': 'Couleur de surlignage par défaut',
  'dash.sectionBehavior': 'Comportement',
  'dash.themeGroupAria': 'Thème de l’interface',
  'dots.title': 'Couleur par défaut : {name}',
  'behavior.toolbar': 'Afficher la barre flottante à la sélection de texte',
  'behavior.badge': 'Afficher le compteur sur l’icône',

  /* ---------- dashboard topbar ---------- */
  'tb.booklet': 'Recueil',
  'tb.selectiveBackup': 'Export sélectif',
  'tb.selectiveBackupTitle': 'Sauvegarde sélective — par sites, articles et tags',
  'tb.backup': 'Exporter la sauvegarde',
  'tb.backupTitle': 'Exporter la sauvegarde (toute la bibliothèque)',
  'tb.sizeBadgeTitle': 'Taille des données enregistrées sur cet appareil',

  /* ---------- dashboard stats ---------- */
  'stats.total': 'Surlignages au total',
  'stats.notes': 'Notes',
  'stats.pages': 'Pages',
  'stats.sites': 'Sites',

  /* ---------- dashboard filter toolbar ---------- */
  'search.placeholder': 'Rechercher dans le texte, les notes ou les titres de page…',
  'search.aria': 'Rechercher',
  'filter.colorAria': 'Filtre par couleur',
  'filter.notesOnly': 'Avec notes uniquement',
  'filter.sortLabel': 'Tri :',
  'sort.newest': 'Plus récents',
  'sort.oldest': 'Plus anciens',
  'sort.page': 'Par page',
  'filter.tagsLabel': 'Tags des articles :',
  'filter.tagsAria': 'Filtre par tags d’articles',

  /* ---------- list chrome ---------- */
  'bulk.expand': 'Déplier tous les articles',
  'bulk.expandTitle': 'Toutes les cartes d’article se déplient et les surlignages non chargés sont chargés aussi',
  'bulk.collapse': 'Replier tous les articles',
  'bulk.collapseTitle': 'Toutes les cartes d’article se replient et les surlignages non chargés sont chargés aussi ; en ouvrant un article, ses surlignages s’affichent en entier',
  'list.loadMore': 'Charger plus ({n} restants)',
  'empty.noResults': 'Aucun résultat.',
  'empty.noResultsSub': 'Essayez une autre recherche ou changez les filtres de couleur et de tags.',
  'empty.first': 'Aucun surlignage pour l’instant. Sélectionnez votre premier texte !',
  'empty.firstSub': 'Sur n’importe quelle page web, sélectionnez du texte et utilisez la barre flottante de l’extension.',
  'dirsec.rtl': 'Articles RTL',
  'dirsec.ltr': 'Articles LTR',
  'dirsec.lead': 'Le surlignage le plus récent est ici',
  'dirsec.leadTitle': 'L’article surligné le plus récemment se trouve dans cette section, c’est pourquoi elle apparaît en premier',

  /* ---------- article card ---------- */
  'card.order.newest': 'Plus récents',
  'card.order.oldest': 'Plus anciens',
  'card.order.page': 'Page',
  'card.order.pageRev': 'Page inversée',
  'card.order.newestTitle': 'Ordre actuel des surlignages : du plus récent au plus ancien ; appuyez pour inverser',
  'card.order.oldestTitle': 'Ordre actuel des surlignages : du plus ancien au plus récent ; appuyez pour inverser',
  'card.order.pageTitle': 'Ordre actuel des surlignages : selon leur position dans la page ; appuyez pour inverser',
  'card.order.pageRevTitle': 'Ordre actuel des surlignages : position inverse dans la page ; appuyez pour rétablir l’ordre de lecture',
  'card.orderAria': 'Ordre des surlignages de cet article : {label}',
  'card.viewPageTitle': 'Ouvrir cette page dans un nouvel onglet',
  'card.deleteGroupTitle': 'Supprimer tout le contenu de cette page',
  'card.remaining': '…{n} autres de cette page (appuyez sur « Charger plus » pour les afficher)',

  /* ---------- highlight item ---------- */
  'item.previewTitle': 'Afficher le texte complet de ce surlignage',
  'item.notePreviewTitle': 'Afficher le texte complet et la note de ce surlignage',
  'item.viewTitle': 'Voir dans la page',
  'item.deleteTitle': 'Supprimer ce surlignage',

  /* ---------- tags row ---------- */
  'tags.add': 'Tag',
  'tags.addTitle': 'Ajouter un tag à cet article',
  'tags.placeholder': 'Nom du tag…',
  'tags.inputAria': 'Nom du nouveau tag',
  'tags.removeTitle': 'Retirer le tag {tag}',

  /* ---------- disabled hosts ---------- */
  'hosts.title': 'Sites désactivés',
  'hosts.desc': 'Sur ces sites, aucun surlignage n’est créé ni affiché (les données sont conservées).',
  'hosts.empty': 'Aucun site n’est désactivé pour l’instant.',
  'hosts.addPlaceholder': 'Ajouter un domaine (ex. example.com)',
  'hosts.inputAria': 'Nouveau domaine',
  'hosts.invalid': 'Saisissez un domaine valide (ex. example.com)',
  'hosts.duplicate': 'Ce domaine est déjà dans la liste',
  'hosts.disabledOk': '{host} est maintenant désactivé',
  'hosts.removeTitle': 'Retirer {host}',

  /* ---------- restore section + modal ---------- */
  'restore.title': 'Restaurer une sauvegarde',
  'restore.desc': 'Choisissez un fichier de sauvegarde JSON ; avant l’exécution, fusion ou remplacement complet vous sera demandé.',
  'restore.fileFail': 'Impossible d’ouvrir le fichier',
  'modal.name': 'Nom de la collection',
  'modal.highlights': 'Surlignages',
  'modal.exportDate': 'Date de l’export',
  'modal.type': 'Type',
  'modal.partialValue': 'Sauvegarde sélective (une partie de la bibliothèque)',
  'modal.merge': 'Fusion',
  'modal.mergeDesc': 'Les enregistrements plus récents l’emportent ; les données actuelles sont conservées.',
  'modal.replace': 'Remplacement complet',
  'modal.replaceDesc': 'Toutes les données actuelles seront supprimées !',
  'modal.start': 'Lancer la restauration',

  /* ---------- danger zone ---------- */
  'danger.title': 'Zone de danger',
  'danger.desc': 'Action irréversible — exportez d’abord une sauvegarde.',
  'danger.arm': 'Supprimer tous les surlignages et notes',
  'danger.placeholder': 'Pour confirmer, tapez « delete »',
  'danger.inputAria': 'Confirmer la suppression',
  'danger.go': 'Confirmer et supprimer',
  'danger.done': 'Tous les surlignages et notes ont été supprimés',

  /* ---------- modals ---------- */
  'bk.title': 'Recueil & Markdown',
  'bk.mdDesc': 'Pour Obsidian et tout éditeur Markdown — toute la bibliothèque dans un fichier, une section par article.',
  'bk.mdBtn': 'Télécharger le fichier Markdown',
  'bk.pickerTitle': 'Articles du recueil',
  'bk.pickerHint': 'Sans sélection, tous les articles entrent dans le recueil ; avec sélection, seulement ceux-ci.',
  'bk.pickerAria': 'Choisir les articles du recueil',
  'bk.allArticles': 'Tous les articles seront dans le recueil.',
  'bk.pickedStatus': '{n} surlignages de {m} articles seront dans le recueil.',
  'bk.printTitle': 'Recueil imprimable',
  'bk.printDesc': 'Conçu pour l’impression A4 — couverture, sommaire et un article par page.',
  'bk.formatAria': 'Format du recueil',
  'bk.html': 'Fichier HTML',
  'bk.htmlDesc': 'Un fichier prêt à imprimer — ouvrez-le dans le navigateur et faites Ctrl+P.',
  'bk.pdf': 'PDF',
  'bk.pdfDesc': 'La boîte de dialogue d’impression du navigateur s’ouvre — choisissez « Save as PDF ».',
  'bk.colorAria': 'Mode couleur du recueil',
  'bk.color': 'Couleur',
  'bk.colorDesc': 'Avec les couleurs d’origine des surlignages',
  'bk.bw': 'Noir et blanc',
  'bk.bwDesc': 'Moins d’encre — idéal pour une imprimante classique',
  'bk.fontAria': 'Police du recueil',
  'bk.fontDefault': '{name} — par défaut',
  'bk.fontDesc': 'Si elle n’est pas installée, le navigateur en montre une semblable',
  'bk.fontCustom': 'Police personnalisée',
  'bk.fontCustomDesc': 'N’importe quelle police installée sur votre appareil — tapez son nom exact',
  'bk.fontCustomPlaceholder': 'ex. B Nazanin',
  'bk.build': 'Créer le recueil',
  'sel.title': 'Sauvegarde sélective',
  'sel.desc': 'Exportez une partie de la bibliothèque — chaque site, article ou tag choisi emmène ses surlignages dans le fichier.',
  'sel.sites': 'Sites',
  'sel.sitesHint': 'Tous les surlignages de ces sites',
  'sel.sitesAria': 'Choisir les sites',
  'sel.articles': 'Articles',
  'sel.articlesHint': 'Surlignages de ces articles',
  'sel.articlesAria': 'Choisir les articles',
  'sel.tags': 'Tags',
  'sel.tagsHint': 'Tous les surlignages des articles portant ce tag',
  'sel.tagsAria': 'Choisir les tags',
  'sel.emptySites': 'Aucun site pour l’instant',
  'sel.emptyArticles': 'Aucun article pour l’instant',
  'sel.emptyTags': 'Aucun tag pour l’instant',
  'sel.pickOne': 'Choisissez au moins un élément.',
  'sel.noMatch': 'Aucun surlignage ne correspond à cette sélection.',
  'sel.status': { one: '1 surlignage ira dans le fichier.', other: '{n} surlignages iront dans le fichier.' },
  'sel.download': 'Télécharger le fichier de sauvegarde',

  /* ---------- dashboard toasts ---------- */
  'toast.openPageNoUrl': 'Cette page n’a pas d’adresse enregistrée',
  'toast.openPageFail': 'Impossible d’ouvrir la page',
  'toast.openHlNoUrl': 'Ce surlignage n’a pas d’adresse enregistrée',
  'toast.nothingToCopy': 'Rien à copier',
  'toast.deleted': 'Surlignage supprimé',
  'toast.groupDeleted': 'Les surlignages de cette page ont été supprimés',
  'toast.readFail': 'Impossible de lire les données',
  'toast.backupOk': { one: 'Fichier de sauvegarde avec 1 surlignage téléchargé', other: 'Fichier de sauvegarde avec {n} surlignages téléchargé' },
  'toast.partialBackupOk': { one: 'Sauvegarde sélective avec 1 surlignage téléchargée', other: 'Sauvegarde sélective avec {n} surlignages téléchargée' },
  'toast.exportFail': 'Échec de l’export',
  'toast.fileReadFail': 'Impossible de lire le fichier',
  'toast.invalidBackup': 'Ce n’est pas un fichier de sauvegarde Weboo valide',
  'toast.importDone': '{a} ajoutés, {u} mis à jour, {s} ignorés',
  'toast.restoreFail': 'Échec de la restauration',
  'toast.mdOk': { one: 'Fichier Markdown avec 1 surlignage téléchargé', other: 'Fichier Markdown avec {n} surlignages téléchargé' },
  'toast.mdFail': 'Échec de l’export Markdown',
  'toast.nothingToExport': 'Aucun surlignage à exporter',
  'toast.noArticlesForBooklet': 'Aucun article choisi pour le recueil',
  'toast.printOpened': 'La boîte de dialogue d’impression s’est ouverte — pour un PDF, choisissez « Save as PDF »',
  'toast.bookletOk': { one: 'Recueil HTML avec 1 surlignage téléchargé', other: 'Recueil HTML avec {n} surlignages téléchargé' },
  'toast.bookletFail': 'Échec de la création du recueil',
  'toast.tagInvalid': 'Nom de tag invalide ({n} caractères maximum)',
  'toast.tagExists': 'Ce tag est déjà sur cet article',
  'toast.tagCap': '{n} tags maximum par article',
  'toast.tagAdded': 'Tag « {tag} » ajouté',
  'toast.tagSaveFail': 'Échec de l’enregistrement du tag',
  'toast.tagRemoved': 'Tag retiré',
  'toast.tagRemoveFail': 'Échec du retrait du tag',

  /* ---------- popup ---------- */
  'popup.brandSub': 'Surlignages et notes — 100 % local',
  'popup.settingsBtnTitle': 'Tableau de bord et réglages',
  'popup.unsupportedT': 'Cette page n’est pas prise en charge',
  'popup.unsupportedDesc': 'L’extension ne fonctionne que sur les pages http, https et file.',
  'popup.openDash': 'Ouvrir le tableau de bord',
  'popup.genericLbl': 'Total des surlignages enregistrés',
  'popup.genericHint': 'Cliquez sur l’icône de l’extension dans une page web pour voir ses surlignages.',
  'popup.enabledHere': 'Activé sur ce site',
  'popup.toggleAria': 'Extension activée sur ce site',
  'popup.applied': 'Appliqué ✓',
  'popup.refreshHint': 'Si les surlignages n’apparaissent pas tout de suite, rechargez la page.',
  'popup.listTitle': 'Surlignages de cette page',
  'popup.emptyT': 'Aucun surlignage sur cette page pour l’instant.',
  'popup.emptyHint': 'Sélectionnez du texte et utilisez la barre flottante !',
  'popup.dashboardBtn': 'Tableau de bord complet',
  'popup.jumpTitle': 'Aller à ce surlignage',
  'popup.hasNote': 'A une note',
  'popup.themeTitle': 'Thème : {name}',
  'popup.themeChangeAria': 'Changer de thème ({name})',
  'popup.countOf': '{a} sur {b}',
  'popup.backupOk': 'Fichier de sauvegarde téléchargé',

  /* ---------- floating widgets ---------- */
  'fw.toolbarAria': 'Barre de surlignage',
  'fw.highlightColor': 'Surligner en {name}',
  'fw.noteTitle': 'Surlignage + note',
  'fw.noteAria': 'Surlignage avec note',
  'fw.copyAria': 'Copier le texte sélectionné',
  'fw.gripTitle': 'Déplacer la fenêtre ; faites glisser puis relâchez',
  'fw.colorAria': 'Couleur {name}',
  'fw.noNote': 'Ce surlignage n’a pas encore de note.',
  'fw.addNote': 'Ajouter une note',
  'fw.editNote': 'Modifier la note',
  'fw.notePlaceholder': 'Votre note pour ce surlignage…',
  'fw.saved': 'Enregistré ✓',
  'fw.saveNote': 'Enregistrer la note',
  'fw.copyAllTitle': 'Copier le texte et la note',
  'fw.deleteTitle': 'Supprimer le surlignage',
  'fw.deleteConfirm': 'Supprimer ?',

  /* ---------- highlighter toasts ---------- */
  'hl.copied': 'Copié ✓',
  'hl.saveError': 'Échec de l’enregistrement.',
  'hl.notHighlightable': 'Cette partie de la page ne peut pas être surlignée.',
  'hl.deleted': 'Surlignage supprimé.',
  'hl.notePrefix': '📝 Note : ',

  /* ---------- service worker context menu ---------- */
  'menu.highlight': '✨ Surligner « %s »',

  /* ---------- export documents ---------- */
  'ex.mdTitle': 'Mon recueil de surlignages',
  'ex.exportedFrom': 'Exporté depuis « {app} »',
  'ex.mdEmpty': 'Aucun surlignage pour l’instant.',
  'ex.note': 'Note :',
  'ex.tags': 'Tags :',
  'ex.source': 'Source',
  'ex.bookletTitle': 'Recueil de surlignages',
  'ex.coverSub': 'La collection complète des surlignages et notes',
  'ex.toc': 'Sommaire',
  'ex.madeWith': 'Créé avec « {app} » · version {v}',
  'ex.foot': 'Créé avec « {app} » — toutes les données restent sur votre appareil uniquement.',
  'ex.coverAria': 'Couverture du recueil'
};

/* ------------------------------------------------------------------ */
/* Turkish — typed against the canonical key set; sen register, " "     */
/* quotes, one+other plurals                                            */
/* ------------------------------------------------------------------ */

const tr: Record<TranslationKey, DictValue> = {
  /* ---------- app identity ---------- */
  'app.name': 'Weboo',

  /* ---------- common ---------- */
  'common.cancel': 'İptal',
  'common.close': 'Kapat',
  'common.delete': 'Sil',
  'common.add': 'Ekle',
  'common.confirm': 'Emin misiniz?',
  'common.version': 'Sürüm',
  'common.untitled': 'Başlıksız',
  'common.localFile': 'Yerel dosya',
  'common.from': ' / ',
  'common.copy': 'Metni kopyala',
  'common.copyShort': 'Kopyala',
  'common.copyOk': 'Kopyalandı ✓',
  'common.copyFail': 'Kopyalama başarısız',
  'common.saveFail': 'Ayarlar kaydedilemedi',
  'common.deleteFail': 'Silme başarısız',
  'common.nHighlights': { one: '1 vurgulama', other: '{n} vurgulama' },
  'common.nNotes': { one: '1 not', other: '{n} not' },
  'common.nArticles': '{n} makale',
  'common.nItems': { one: '1 öğe', other: '{n} öğe' },

  /* ---------- colors ---------- */
  'color.yellow': 'Sarı',
  'color.orange': 'Turuncu',
  'color.green': 'Yeşil',
  'color.teal': 'Turkuaz',
  'color.pink': 'Pembe',
  'color.purple': 'Mor',

  /* ---------- themes ---------- */
  'theme.auto': 'Sistem',
  'theme.light': 'Açık',
  'theme.dark': 'Koyu',
  'theme.autoHint': 'Sistemin açık/koyu modunu izler',
  'theme.lightHint': 'Her zaman açık zemin',
  'theme.darkHint': 'Her zaman koyu zemin',

  /* ---------- interface language ---------- */
  'lang.label': 'Arayüz dili',
  'lang.fa': 'فارسی',
  'lang.en': 'English',
  'lang.de': 'Deutsch',
  'lang.es': 'Español',
  'lang.ru': 'Русский',
  'lang.it': 'Italiano',
  'lang.fr': 'Français',
  'lang.tr': 'Türkçe',
  'lang.desc': 'Açılır pencereye, panele ve yüzen araçlara anında uygulanır.',
  'lang.groupAria': 'Arayüz dili',

  /* ---------- dashboard shell ---------- */
  'dash.title': 'Panel — Weboo',
  'dash.brandSub': 'Yönetim paneli',
  'dash.statsAria': 'Genel istatistikler',
  'dash.toolbarAria': 'Filtre ve arama',
  'dash.listAria': 'Vurgulamalar',
  'dash.footer': 'Weboo — tüm veriler yalnızca bu cihazda saklanır; hiçbir şey sunucuya gönderilmez.',
  'dash.settings': 'Ayarlar',
  'dash.settingsAria': 'Ayarlar',
  'dash.drawerCloseAria': 'Ayarları kapat',
  'dash.sectionAppearance': 'Görünüm',
  'dash.sectionColor': 'Varsayılan vurgulama rengi',
  'dash.sectionBehavior': 'Davranış',
  'dash.themeGroupAria': 'Arayüz teması',
  'dots.title': 'Varsayılan renk: {name}',
  'behavior.toolbar': 'Metin seçilirken yüzen araç çubuğunu göster',
  'behavior.badge': 'Simgede sayacı göster',

  /* ---------- dashboard topbar ---------- */
  'tb.booklet': 'Kitapçık',
  'tb.selectiveBackup': 'Seçmeli dışa aktarma',
  'tb.selectiveBackupTitle': 'Seçmeli yedek — site, makale ve etikete göre',
  'tb.backup': 'Yedek dışa aktar',
  'tb.backupTitle': 'Yedek dışa aktar (tüm kitaplık)',
  'tb.sizeBadgeTitle': 'Bu cihazda saklanan verilerin boyutu',

  /* ---------- dashboard stats ---------- */
  'stats.total': 'Toplam vurgulama',
  'stats.notes': 'Notlar',
  'stats.pages': 'Sayfalar',
  'stats.sites': 'Siteler',

  /* ---------- dashboard filter toolbar ---------- */
  'search.placeholder': 'Metin, not veya sayfa başlıklarında ara…',
  'search.aria': 'Ara',
  'filter.colorAria': 'Renk filtresi',
  'filter.notesOnly': 'Yalnızca notlu olanlar',
  'filter.sortLabel': 'Sıralama:',
  'sort.newest': 'En yeni',
  'sort.oldest': 'En eski',
  'sort.page': 'Sayfaya göre',
  'filter.tagsLabel': 'Makale etiketleri:',
  'filter.tagsAria': 'Makale etiketi filtresi',

  /* ---------- list chrome ---------- */
  'bulk.expand': 'Tüm makaleleri aç',
  'bulk.expandTitle': 'Tüm makale kartları açılır ve yüklenmemiş vurgulamalar da yüklenir',
  'bulk.collapse': 'Tüm makaleleri kapat',
  'bulk.collapseTitle': 'Tüm makale kartları kapanır ve yüklenmemiş vurgulamalar da yüklenir; bir makaleyi açtığınızda vurgulamaları tam olarak gösterilir',
  'list.loadMore': 'Daha fazla yükle ({n} kaldı)',
  'empty.noResults': 'Sonuç bulunamadı.',
  'empty.noResultsSub': 'Başka bir arama deneyin veya renk ile etiket filtrelerini değiştirin.',
  'empty.first': 'Henüz vurgulama yok. İlk metninizi seçin!',
  'empty.firstSub': 'Herhangi bir web sayfasında metni seçin ve eklentinin yüzen araç çubuğunu kullanın.',
  'dirsec.rtl': 'Sağdan sola makaleler',
  'dirsec.ltr': 'Soldan sağa makaleler',
  'dirsec.lead': 'En yeni vurgulama burada',
  'dirsec.leadTitle': 'En son vurgulanan makale bu bölümde olduğu için bu bölüm önce gösterilir',

  /* ---------- article card ---------- */
  'card.order.newest': 'En yeni',
  'card.order.oldest': 'En eski',
  'card.order.page': 'Sayfa',
  'card.order.pageRev': 'Sayfa ters',
  'card.order.newestTitle': 'Mevcut vurgulama sırası: en yeniden en eskiye; tersine çevirmek için basın',
  'card.order.oldestTitle': 'Mevcut vurgulama sırası: en eskiden en yeniye; tersine çevirmek için basın',
  'card.order.pageTitle': 'Mevcut vurgulama sırası: sayfadaki konumuna göre; tersine çevirmek için basın',
  'card.order.pageRevTitle': 'Mevcut vurgulama sırası: sayfadaki konumunun tersi; okuma sırasını geri almak için basın',
  'card.orderAria': 'Bu makalenin vurgulama sırası: {label}',
  'card.viewPageTitle': 'Bu sayfayı yeni sekmede aç',
  'card.deleteGroupTitle': 'Bu sayfanın her şeyini sil',
  'card.remaining': '…bu sayfadan {n} tane daha (görmek için "Daha fazla yükle"ye basın)',

  /* ---------- highlight item ---------- */
  'item.previewTitle': 'Bu vurgulamanın tam metnini göster',
  'item.notePreviewTitle': 'Bu vurgulamanın tam metnini ve notunu göster',
  'item.viewTitle': 'Sayfada gör',
  'item.deleteTitle': 'Bu vurgulamayı sil',

  /* ---------- tags row ---------- */
  'tags.add': 'Etiket',
  'tags.addTitle': 'Bu makaleye bir etiket ekle',
  'tags.placeholder': 'Etiket adı…',
  'tags.inputAria': 'Yeni etiket adı',
  'tags.removeTitle': '{tag} etiketini kaldır',

  /* ---------- disabled hosts ---------- */
  'hosts.title': 'Devre dışı siteler',
  'hosts.desc': 'Bu sitelerde vurgulama yapılmaz ve gösterilmez (veriler saklanır).',
  'hosts.empty': 'Henüz devre dışı bırakılmış site yok.',
  'hosts.addPlaceholder': 'Domain ekle (ör. example.com)',
  'hosts.inputAria': 'Yeni domain',
  'hosts.invalid': 'Geçerli bir domain girin (ör. example.com)',
  'hosts.duplicate': 'Bu domain zaten listede',
  'hosts.disabledOk': '{host} artık devre dışı',
  'hosts.removeTitle': '{host} sitesini kaldır',

  /* ---------- restore section + modal ---------- */
  'restore.title': 'Yedeği geri yükle',
  'restore.desc': 'Bir JSON yedek dosyası seçin; işlem öncesi birleştirme mi yoksa tamamen değiştirme mi istediğiniz sorulur.',
  'restore.fileFail': 'Dosya açılamadı',
  'modal.name': 'Koleksiyon adı',
  'modal.highlights': 'Vurgulamalar',
  'modal.exportDate': 'Dışa aktarma tarihi',
  'modal.type': 'Tür',
  'modal.partialValue': 'Seçmeli yedek (kitaplığın bir bölümü)',
  'modal.merge': 'Birleştir',
  'modal.mergeDesc': 'Daha yeni kayıtlar kazanır; mevcut veriler korunur.',
  'modal.replace': 'Tamamen değiştir',
  'modal.replaceDesc': 'Mevcut tüm veriler silinecek!',
  'modal.start': 'Geri yüklemeyi başlat',

  /* ---------- danger zone ---------- */
  'danger.title': 'Tehlikeli bölge',
  'danger.desc': 'Bu işlem geri alınamaz — önce bir yedek dışa aktarın.',
  'danger.arm': 'Tüm vurgulamaları ve notları sil',
  'danger.placeholder': 'Onaylamak için "delete" yazın',
  'danger.inputAria': 'Silmeyi onayla',
  'danger.go': 'Onayla ve sil',
  'danger.done': 'Tüm vurgulamalar ve notlar silindi',

  /* ---------- modals ---------- */
  'bk.title': 'Kitapçık ve Markdown',
  'bk.mdDesc': 'Obsidian ve herhangi bir Markdown düzenleyicisi için — tüm kitaplık tek dosyada, her makale bir bölüm.',
  'bk.mdBtn': 'Markdown dosyasını indir',
  'bk.pickerTitle': 'Kitapçık makaleleri',
  'bk.pickerHint': 'Seçim yoksa tüm makaleler kitapçığa girer; seçim varsa yalnızca bunlar.',
  'bk.pickerAria': 'Kitapçık makalelerini seç',
  'bk.allArticles': 'Tüm makaleler kitapçıkta olacak.',
  'bk.pickedStatus': '{m} makaleden {n} vurgulama kitapçıkta olacak.',
  'bk.printTitle': 'Yazdırılabilir kitapçık',
  'bk.printDesc': 'A4 baskı için tasarlandı — kapak, içindekiler ve sayfa başına bir makale.',
  'bk.formatAria': 'Kitapçık biçimi',
  'bk.html': 'HTML dosyası',
  'bk.htmlDesc': 'Baskıya hazır bir dosya — tarayıcıda açın ve Ctrl+P yapın.',
  'bk.pdf': 'PDF',
  'bk.pdfDesc': 'Tarayıcının yazdırma penceresi açılır — "Save as PDF" seçin.',
  'bk.colorAria': 'Kitapçık renk modu',
  'bk.color': 'Renkli',
  'bk.colorDesc': 'Vurgulamaların özgün renkleriyle',
  'bk.bw': 'Siyah-beyaz',
  'bk.bwDesc': 'Daha az mürekkep — normal yazıcılar için uygun',
  'bk.fontAria': 'Kitapçık yazı tipi',
  'bk.fontDefault': '{name} — varsayılan',
  'bk.fontDesc': 'Yüklü değilse tarayıcı benzer bir yazı tipi gösterir',
  'bk.fontCustom': 'Özel yazı tipi',
  'bk.fontCustomDesc': 'Cihazınızda yüklü herhangi bir yazı tipi — tam adını yazın',
  'bk.fontCustomPlaceholder': 'ör. B Nazanin',
  'bk.build': 'Kitapçığı oluştur',
  'sel.title': 'Seçmeli yedek',
  'sel.desc': 'Kitaplığın bir bölümünü dışa aktarın — seçtiğiniz her site, makale veya etiket kendi vurgulamalarını dosyaya taşır.',
  'sel.sites': 'Siteler',
  'sel.sitesHint': 'Bu sitelerin tüm vurgulamaları',
  'sel.sitesAria': 'Siteleri seç',
  'sel.articles': 'Makaleler',
  'sel.articlesHint': 'Bu makalelerin vurgulamaları',
  'sel.articlesAria': 'Makaleleri seç',
  'sel.tags': 'Etiketler',
  'sel.tagsHint': 'Bu etiketi taşıyan makalelerin tüm vurgulamaları',
  'sel.tagsAria': 'Etiketleri seç',
  'sel.emptySites': 'Henüz site yok',
  'sel.emptyArticles': 'Henüz makale yok',
  'sel.emptyTags': 'Henüz etiket yok',
  'sel.pickOne': 'En az bir öğe seçin.',
  'sel.noMatch': 'Bu seçimle eşleşen vurgulama yok.',
  'sel.status': { one: '1 vurgulama dosyada olacak.', other: '{n} vurgulama dosyada olacak.' },
  'sel.download': 'Yedek dosyasını indir',

  /* ---------- dashboard toasts ---------- */
  'toast.openPageNoUrl': 'Bu sayfanın kayıtlı adresi yok',
  'toast.openPageFail': 'Sayfa açılamadı',
  'toast.openHlNoUrl': 'Bu vurgulamanın kayıtlı adresi yok',
  'toast.nothingToCopy': 'Kopyalanacak bir şey yok',
  'toast.deleted': 'Vurgulama silindi',
  'toast.groupDeleted': 'Bu sayfanın vurgulamaları silindi',
  'toast.readFail': 'Veriler okunamadı',
  'toast.backupOk': { one: '1 vurgulamalı yedek dosyası indirildi', other: '{n} vurgulamalı yedek dosyası indirildi' },
  'toast.partialBackupOk': { one: '1 vurgulamalı seçmeli yedek indirildi', other: '{n} vurgulamalı seçmeli yedek indirildi' },
  'toast.exportFail': 'Dışa aktarma başarısız',
  'toast.fileReadFail': 'Dosya okunamadı',
  'toast.invalidBackup': 'Geçerli bir Weboo yedek dosyası değil',
  'toast.importDone': '{a} eklendi, {u} güncellendi, {s} atlandı',
  'toast.restoreFail': 'Geri yükleme başarısız',
  'toast.mdOk': { one: '1 vurgulamalı Markdown dosyası indirildi', other: '{n} vurgulamalı Markdown dosyası indirildi' },
  'toast.mdFail': 'Markdown dışa aktarma başarısız',
  'toast.nothingToExport': 'Dışa aktarılacak vurgulama yok',
  'toast.noArticlesForBooklet': 'Kitapçık için makale seçilmedi',
  'toast.printOpened': 'Yazdırma penceresi açıldı — PDF için "Save as PDF" seçin',
  'toast.bookletOk': { one: '1 vurgulamalı HTML kitapçığı indirildi', other: '{n} vurgulamalı HTML kitapçığı indirildi' },
  'toast.bookletFail': 'Kitapçık oluşturulamadı',
  'toast.tagInvalid': 'Geçersiz etiket adı (en fazla {n} karakter)',
  'toast.tagExists': 'Bu etiket bu makalede zaten var',
  'toast.tagCap': 'Makale başına en fazla {n} etiket',
  'toast.tagAdded': '"{tag}" etiketi eklendi',
  'toast.tagSaveFail': 'Etiket kaydedilemedi',
  'toast.tagRemoved': 'Etiket kaldırıldı',
  'toast.tagRemoveFail': 'Etiket kaldırılamadı',

  /* ---------- popup ---------- */
  'popup.brandSub': 'Vurgulamalar ve notlar — %100 yerel',
  'popup.settingsBtnTitle': 'Panel ve ayarlar',
  'popup.unsupportedT': 'Bu sayfa desteklenmiyor',
  'popup.unsupportedDesc': 'Eklenti yalnızca http, https ve file sayfalarında çalışır.',
  'popup.openDash': 'Paneli aç',
  'popup.genericLbl': 'Kayıtlı toplam vurgulama',
  'popup.genericHint': 'Bir web sayfasında eklenti simgesine tıklayın, sayfanın vurgulamalarını görün.',
  'popup.enabledHere': 'Bu sitede etkin',
  'popup.toggleAria': 'Eklenti bu sitede etkin',
  'popup.applied': 'Uygulandı ✓',
  'popup.refreshHint': 'Vurgulamalar hemen görünmezse sayfayı yenileyin.',
  'popup.listTitle': 'Bu sayfanın vurgulamaları',
  'popup.emptyT': 'Bu sayfada henüz vurgulama yok.',
  'popup.emptyHint': 'Metin seçin ve yüzen araç çubuğunu kullanın!',
  'popup.dashboardBtn': 'Tam panel',
  'popup.jumpTitle': 'Bu vurgulamaya git',
  'popup.hasNote': 'Notu var',
  'popup.themeTitle': 'Tema: {name}',
  'popup.themeChangeAria': 'Temayı değiştir ({name})',
  'popup.countOf': '{a} / {b}',
  'popup.backupOk': 'Yedek dosyası indirildi',

  /* ---------- floating widgets ---------- */
  'fw.toolbarAria': 'Vurgulama çubuğu',
  'fw.highlightColor': '{name} ile vurgula',
  'fw.noteTitle': 'Vurgulama + not',
  'fw.noteAria': 'Notlu vurgulama',
  'fw.copyAria': 'Seçili metni kopyala',
  'fw.gripTitle': 'Pencereyi taşı; sürükleyip bırakın',
  'fw.colorAria': '{name} rengi',
  'fw.noNote': 'Bu vurgulamanın henüz notu yok.',
  'fw.addNote': 'Not ekle',
  'fw.editNote': 'Notu düzenle',
  'fw.notePlaceholder': 'Bu vurgulama için notunuz…',
  'fw.saved': 'Kaydedildi ✓',
  'fw.saveNote': 'Notu kaydet',
  'fw.copyAllTitle': 'Metni ve notu kopyala',
  'fw.deleteTitle': 'Vurgulamayı sil',
  'fw.deleteConfirm': 'Silinsin mi?',

  /* ---------- highlighter toasts ---------- */
  'hl.copied': 'Kopyalandı ✓',
  'hl.saveError': 'Kaydetme başarısız.',
  'hl.notHighlightable': 'Sayfanın bu bölümü vurgulanamaz.',
  'hl.deleted': 'Vurgulama silindi.',
  'hl.notePrefix': '📝 Not: ',

  /* ---------- service worker context menu ---------- */
  'menu.highlight': '✨ "%s" vurgula',

  /* ---------- export documents ---------- */
  'ex.mdTitle': 'Vurgulama kitapçığım',
  'ex.exportedFrom': '"{app}" ile dışa aktarıldı',
  'ex.mdEmpty': 'Henüz vurgulama yok.',
  'ex.note': 'Not:',
  'ex.tags': 'Etiketler:',
  'ex.source': 'Kaynak',
  'ex.bookletTitle': 'Vurgulama kitapçığı',
  'ex.coverSub': 'Vurgulamaların ve notların tam koleksiyonu',
  'ex.toc': 'İçindekiler',
  'ex.madeWith': '"{app}" ile oluşturuldu · sürüm {v}',
  'ex.foot': '"{app}" ile oluşturuldu — tüm veriler yalnızca cihazınızda saklanır.',
  'ex.coverAria': 'Kitapçık kapağı'
};
/* ------------------------------------------------------------------ */
/* Language registry + state                                           */
/* ------------------------------------------------------------------ */

/**
 * The language registry — order is the selector's display order; `dir` is
 * THE UI-direction policy (a language property, independent of content
 * direction — see shared/detect-dir.js). A new language = one entry here,
 * one dictionary below, and the union/type mirror in src/types/settings.ts.
 */
export const LANGUAGES: Record<Language, { label: TranslationKey; dir: 'rtl' | 'ltr' }> = {
  fa: { label: 'lang.fa', dir: 'rtl' },
  en: { label: 'lang.en', dir: 'ltr' },
  de: { label: 'lang.de', dir: 'ltr' },
  es: { label: 'lang.es', dir: 'ltr' },
  ru: { label: 'lang.ru', dir: 'ltr' },
  it: { label: 'lang.it', dir: 'ltr' },
  fr: { label: 'lang.fr', dir: 'ltr' },
  tr: { label: 'lang.tr', dir: 'ltr' }
};

export const LANG_KEYS: Language[] = ['fa', 'en', 'de', 'es', 'ru', 'it', 'fr', 'tr'];

/**
 * The BCP-47 locale each language renders numbers and dates with — the ONE
 * home of that mapping (format.js consumes it; no scattered conditionals).
 */
export const LOCALES: Record<Language, string> = {
  fa: 'fa-IR',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  ru: 'ru-RU',
  it: 'it-IT',
  fr: 'fr-FR',
  tr: 'tr-TR'
};

const DICTS: Record<Language, Record<TranslationKey, DictValue>> = { fa: fa, en: en, de: de, es: es, ru: ru, it: it, fr: fr, tr: tr };

const DEFAULT_LANG: Language = 'fa';

/* Module-scoped state with explicit ownership: composition roots set it
   (content.js / popup.js / data.ts / the SW); everything else reads. */
let current: Language = DEFAULT_LANG;
const subscribers = new Set<() => void>();

/** Validates raw storage values — anything unknown degrades to the default
 *  (the same boundary-validation pattern as themes/colors). */
export function validLanguage(v: unknown): Language {
  return (LANG_KEYS.indexOf(v as Language) !== -1) ? v as Language : DEFAULT_LANG;
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

/* CLDR plural form selection — cached rules per language (the same LOCALES
   that format the digits; one home). 'zero'/'two' never occur for our eight
   locales and fall through to `other` at the lookup. */
const pluralRulesCache: Partial<Record<Language, Intl.PluralRules>> = {};
function pluralForm(lang: Language, n: number): 'one' | 'few' | 'many' | 'other' {
  try {
    if (typeof Intl !== 'undefined' && Intl.PluralRules) {
      if (!pluralRulesCache[lang]) pluralRulesCache[lang] = new Intl.PluralRules(LOCALES[lang]);
      const f = pluralRulesCache[lang]!.select(n);
      if (f === 'one' || f === 'few' || f === 'many') return f;
    }
  } catch (e) { /* no ICU — the one/other fallback below */ }
  return n === 1 ? 'one' : 'other';
}

/**
 * Translates a key in the active language with `{name}` interpolation.
 * Fallback order: active dictionary → the other dictionary → the key itself
 * (visible, never empty — and unreachable for typed TS call sites).
 * A plural value (`{one, other}`) picks `one` only for n === 1 (English;
 * Persian numerals never pluralize — its plural-capable keys stay strings).
 */
export function t(key: TranslationKey, params?: Params): string {
  const own = DICTS[current][key];
  const raw: DictValue | undefined = own !== undefined ? own : DICTS.en[key]; /* fallback: the canonical dictionary, then the key itself */
  let s: string;
  if (raw && typeof raw === 'object') {
    const n = Number(params && params.n);
    s = (n === 1 && raw.one) ? raw.one : raw.other;
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
  const own = DICTS[current][key];
  const raw: DictValue | undefined = own !== undefined ? own : DICTS.en[key];
  let s: string;
  if (raw && typeof raw === 'object') {
    s = raw[pluralForm(current, num)] || raw.other;
  } else {
    s = String(raw === undefined ? key : raw);
  }
  let formatted: string;
  try { formatted = num.toLocaleString(LOCALES[current]); }
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
