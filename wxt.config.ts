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
delete manifest.background; /* owned by entrypoints/background.ts (Phase 6 entry #1) */

export default defineConfig({
  publicDir: "extension",
  manifest,
});
