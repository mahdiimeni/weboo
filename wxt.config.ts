import { readFileSync } from "node:fs";
import { defineConfig } from "wxt";

/**
 * Phase 6a — WXT toolchain (plan of record: docs/migration-baseline.md §7–8).
 *
 * For now WXT builds the existing tree as-is:
 *  - publicDir = extension/ → every file copied verbatim (same relative paths
 *    the manifest, tests, and harnesses already reference);
 *  - manifest = extension/manifest.json verbatim (single version source stays
 *    the manifest; WXT must not invent name/version — scripts/wxt-parity.mjs
 *    fails the build if output drifts from extension/).
 * Later phases migrate entrypoints one at a time (content bundle first — R1);
 * each step updates this config and the parity check together.
 */
const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf-8"));
delete manifest.background; /* owned by entrypoints/background.ts (entry #1) */
delete manifest.content_scripts; /* owned by entrypoints/content.ts (entry #2, 6b) — the file's js list stays the CANONICAL ORDER, pinned to the entrypoint imports by wxt-parity */
/* action + options_ui: CONFIG-owned by design (6c). WXT's html entrypoint types
   cannot preserve the shipped paths: entrypoints/popup.html would emit
   default_popup "popup.html" at the root, where the page's relative
   ../shared/* refs break; options.html/options/index.html would emit an
   options page path that is not dashboard/dashboard.html. Both pages stay
   byte-copied (publicDir) behind the config pointers — the output is
   behavior-identical (parity proves file bytes + manifest values). Revisit
   when popup/dashboard migrate to React: fresh entrypoints are written WITH
   that rewrite, and WXT owns the manifest keys then. */

export default defineConfig({
  publicDir: "extension",
  manifest,
});
