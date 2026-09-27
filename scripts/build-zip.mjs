#!/usr/bin/env node
/**
 * Web Highlighter — release zip builder
 *
 * Packs exactly the shipped extension surface from extension/ (the same folder
 * you load unpacked in Chrome):
 *
 *     manifest.json  shared/  content/  background/  popup/  dashboard/  icons/
 *
 * The generated E2E harnesses (popup/_e2e_harness.html,
 * dashboard/_e2e_harness.html) are always excluded — they are test tooling,
 * never shipped.
 *
 * Version source of truth: extension/manifest.json (the single version source
 * — never hardcode a version here). Output:
 *
 *     dist/highlighter-extension-v${VERSION}.zip
 *
 * Usage:   node scripts/build-zip.mjs   (or: bun run zip)
 * Requires the `zip` CLI on PATH.
 */
import { readFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT = join(ROOT, "extension");

/* single source of truth for the version — the real manifest */
const VERSION = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf-8")).version;

const DIST = join(ROOT, "dist");
const OUT = join(DIST, `highlighter-extension-v${VERSION}.zip`);

/* test tooling inside extension/ — never shipped */
const EXCLUDES = ["popup/_e2e_harness.html", "dashboard/_e2e_harness.html"];

mkdirSync(DIST, { recursive: true });
rmSync(OUT, { force: true });

/* zip the extension contents from inside extension/ so archive paths are
   root-relative — exactly the shipped layout */
execFileSync(
  "zip",
  ["-rq", OUT, ".", ...EXCLUDES.flatMap((x) => ["-x", x])],
  { cwd: EXT, stdio: "inherit" }
);

/* release-contract numbers: entry count + exact size */
const entries = execFileSync("unzip", ["-Z1", OUT]).toString().split("\n").filter(Boolean);
const size = statSync(OUT).size;
console.log(`zip built: dist/highlighter-extension-v${VERSION}.zip`);
console.log(`entries: ${entries.length}   size: ${size} bytes   (v${VERSION})`);
