#!/usr/bin/env node
/**
 * Web Highlighter — release zip builder
 *
 * Packs the WXT product output .output/chrome-mv3 (Phase 7a: the shipped
 * artifact IS the WXT build — content/background ship as the parity-gated
 * bundles, everything else byte-copied from extension/). extension/ remains
 * the SOURCE tree (tests + harnesses read it; the manifest there is the
 * config source wxt.config.ts parses).
 *
 * The chain `bun run zip` = build:ext → build:wxt (runs wxt-parity: output
 * must be byte-identical to extension/ + manifest equal) → this packer, so a
 * zip can never contain a stale or unverified output.
 *
 * The generated E2E harness (popup/_e2e_harness.html) is always excluded —
 * test tooling, never shipped. (The dashboard harness retired with Phase 8
 * slice 4: the React list renders from real storage; a mocked static page
 * has nothing left to exercise.)
 *
 * Version source of truth: extension/manifest.json (the single version source
 * — never hardcode a version here; parity proves the output manifest equal).
 * Output:
 *
 *     dist/highlighter-extension-v${VERSION}.zip
 *
 * Usage:   node scripts/build-zip.mjs   (or: bun run zip)
 * Requires the `zip` CLI on PATH.
 */
import { readFileSync, mkdirSync, rmSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT = join(ROOT, "extension"); /* source tree — version + config source */
const OUT_DIR = join(ROOT, ".output", "chrome-mv3"); /* WXT product output (packed) */

if (!existsSync(join(OUT_DIR, "manifest.json"))) {
  console.error("missing .output/chrome-mv3 — run: bun run build:ext && bun run build:wxt");
  process.exit(1);
}

/* single source of truth for the version — the real manifest */
const VERSION = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf-8")).version;

const DIST = join(ROOT, "dist");
const OUT = join(DIST, `highlighter-extension-v${VERSION}.zip`);

/* test tooling inside extension/ — never shipped */
const EXCLUDES = ["popup/_e2e_harness.html"];

mkdirSync(DIST, { recursive: true });
rmSync(OUT, { force: true });

/* zip the output contents from inside .output/chrome-mv3 so archive paths
   are root-relative — exactly the shipped layout */
execFileSync(
  "zip",
  ["-rq", OUT, ".", ...EXCLUDES.flatMap((x) => ["-x", x])],
  { cwd: OUT_DIR, stdio: "inherit" }
);

/* release-contract numbers: entry count + exact size */
const entries = execFileSync("unzip", ["-Z1", OUT]).toString().split("\n").filter(Boolean);
const size = statSync(OUT).size;
console.log(`zip built: dist/highlighter-extension-v${VERSION}.zip`);
console.log(`entries: ${entries.length}   size: ${size} bytes   (v${VERSION})`);
