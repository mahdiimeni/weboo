/**
 * Phase 6b — content entrypoint (R1 critical path): the 20 classic content
 * scripts become ONE WXT bundle.
 *
 * Every file is IIFE-wrapped and communicates only via the globalThis.HL
 * registry (zero column-0 declarations — verified), so module scope changes
 * nothing at runtime; bundling preserves IMPORT ORDER, which is the contract:
 * scripts/wxt-parity.mjs fails the build if this list drifts from
 * extension/manifest.json content_scripts[0].js (still the canonical order —
 * the dev tree and every test harness keep loading it file-by-file).
 *
 * CSS: mark-style.css is imported here with cssInjectionMode "manifest"
 * (WXT output puts it in content_scripts.css under its own path — modeled
 * drift in the parity gate; the source file stays byte-copied).
 *
 * noScriptStartedPostMessage: true — WXT's dev-handshake postMessage must not
 * reach real pages (behavior preservation: the original had none).
 */
import { defineContentScript } from "wxt/utils/define-content-script";

import "../extension/shared/constants.js";
import "../extension/shared/backends/chrome-storage.js";
import "../extension/shared/url.js";
import "../extension/shared/utils.js";
import "../extension/shared/format.js";
import "../extension/shared/detect-dir.js";
import "../extension/shared/clipboard.js";
import "../extension/shared/tags.js";
import "../extension/shared/textindex.js";
import "../extension/shared/domwrap.js";
import "../extension/shared/anchor.js";
import "../extension/shared/ui/base.js";
import "../extension/shared/ui/toast.js";
import "../extension/shared/ui/toolbar.js";
import "../extension/shared/ui/popover.js";
import "../extension/shared/store.js";
import "../extension/shared/runtime-bridge.js";
import "../extension/shared/highlighter.js";
import "../extension/shared/message-guard.js";
import "../extension/content/favicon.js";
import "../extension/content/content.js";
import "../extension/content/mark-style.css";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*", "file://*/*"],
  runAt: "document_idle",
  allFrames: false,
  cssInjectionMode: "manifest",
  noScriptStartedPostMessage: true,
  main() {
    /* the side-effect imports above ARE the content script (classic files,
       top-level code — runs at document_idle exactly as before) */
  },
});
