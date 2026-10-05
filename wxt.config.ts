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
/* action: CONFIG-owned by design (6c) — popup stays byte-copied (publicDir)
   behind the manifest pointer: a WXT popup.html entrypoint would emit
   default_popup "popup.html" at the root, where the page's relative
   ../shared/* refs break. Phase 9 decides whether popup follows the
   dashboard's path (fresh entrypoint written WITH the React rewrite).
   options_ui: since Phase 8 Task 3 the dashboard IS a real entrypoint
   (entrypoints/dashboard/index.html — subdir index.html is WXT's html
   convention; a non-conventional name is SILENTLY ignored as an entrypoint,
   which shipped a manifest pointing at a missing file and broke unpacked
   loads). WXT flattens it to dashboard.html at the package root — the
   manifest's copied options_ui.page carries exactly that value, so the key
   needs no ownership transfer; wxt-parity §3b (existence + anti-flash
   shape) and the packaging page-shape test own the generated page. */

export default defineConfig({
  publicDir: "extension",
  manifest,
  /* Phase 8 — React module registered up front (Task 1); it only transforms
     .jsx/.tsx entrypoints, of which there are none yet, so the emitted tree
     stays byte-identical until the dashboard switchover (Task 3).
     NOTE: WXT resolves `modules` entries as PACKAGE ID STRINGS via
     import.meta.resolve — objects crash with "Cannot find package
     '[object Object]'" (resolveWxtUserModules). String, not import. */
  modules: ["@wxt-dev/module-react"],
});
