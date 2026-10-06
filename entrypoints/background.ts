/**
 * Phase 6 first entrypoint — the background service worker.
 *
 * The real SW (extension/background/service-worker.js) is ALREADY an ES module
 * that side-effect-imports the classic shared scripts (its own header documents
 * the globalThis.HL pattern). This entrypoint only hands it to WXT: bundling
 * preserves import order, the SW's top-level code still runs at worker start,
 * and `defineBackground` marks the entry (WXT owns manifest.background now —
 * wxt.config.ts drops that key so config and entrypoint never both claim it).
 */
import { defineBackground } from "wxt/utils/define-background";
import "../extension/background/service-worker.js";

export default defineBackground(() => void 0);
