/**
 * Web Highlighter — file export (SRP: getting data out of the app)
 *
 * Consumers: popup and dashboard (JSON backup export) and the dashboard's
 * reading exports (v0.6.0): the Markdown library document and the print
 * booklet. This module owns the DELIVERY concerns only — file naming, the
 * download mechanism, and the print window — never the document content
 * (the builders' job: HL.markdown / HL.booklet).
 *
 * saveBackup performs the whole "file name + pretty JSON + download" flow in
 * one place so the pages don't repeat those same three lines; the toast is
 * the caller's responsibility. Only works on pages with a document
 * (internal guard).
 *
 * printHtml (v0.6.0) renders an HTML document in a hidden same-origin iframe
 * and opens the browser's print dialog on it — the dependency-free "PDF"
 * export: the user picks «Save as PDF» and gets the fully designed document
 * as a real PDF (no library, no server, CSP-safe: the booklet carries no
 * scripts at all). The frame is removed after the dialog is dismissed.
 */
(function () {
  'use strict';
  const HL = (globalThis.HL = globalThis.HL || {});

  /** Downloads text as a file */
  function downloadText(filename, text, mime) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  /** Today's date stamp shared by every export file name: YYYY-MM-DD-HHMM */
  function stamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  /** Backup file name: web-highlighter-backup-YYYY-MM-DD-HHMM.json */
  function backupFileName() {
    return 'web-highlighter-backup-' + stamp() + '.json';
  }

  /** Markdown library document name (v0.6.0): web-highlighter-markdown-YYYY-MM-DD-HHMM.md */
  function markdownFileName() {
    return 'web-highlighter-markdown-' + stamp() + '.md';
  }

  /** Print booklet name (v0.6.0): web-highlighter-booklet-YYYY-MM-DD-HHMM.html */
  function bookletFileName() {
    return 'web-highlighter-booklet-' + stamp() + '.html';
  }

  /** Saves a backup object (the store.exportData output) as a downloadable JSON file */
  function saveBackup(backup) {
    downloadText(backupFileName(), JSON.stringify(backup, null, 2));
  }

  /**
   * Prints a complete HTML document (v0.6.0) — the booklet's PDF path.
   * A zero-size hidden iframe with srcdoc (same-origin, no navigation, no
   * popup blocker) hosts the document; its onload opens the print dialog on
   * the frame's window. The frame is cleaned up after the dialog and, as a
   * leak guard, after 10 seconds no matter what. Synchronous by design —
   * the dialog is fire-and-forget from the caller's perspective.
   */
  function printHtml(html) {
    if (typeof document === 'undefined' || !document.body) return;
    const f = document.createElement('iframe');
    f.title = 'print-frame';           /* a11y: a named, hidden frame */
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;inset:auto;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    f.onload = function () {
      try { f.contentWindow.print(); } catch (e) { /* headless/older engines: silent no-op */ }
      setTimeout(function () { f.remove(); }, 500);
    };
    f.srcdoc = html;
    document.body.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.remove(); }, 10000);
  }

  HL.export = {
    downloadText: downloadText,
    backupFileName: backupFileName,
    markdownFileName: markdownFileName,
    bookletFileName: bookletFileName,
    saveBackup: saveBackup,
    printHtml: printHtml
  };
})();
