/**
 * Release integrity validator — run by .github/workflows/release.yml after
 * `bun run zip` (also safe to run locally before tagging).
 *
 *   node scripts/validate-release.mjs <tag>      # e.g. v0.12.0
 *
 * Enforces, in order:
 *   1. the tag matches the accepted release format (vMAJOR.MINOR.PATCH)
 *   2. extension/manifest.json — the canonical version source — carries the
 *      SAME version as the tag
 *   3. dist/weboo-v<version>.zip exists and is non-empty (fresh artifact of
 *      the current run; build-zip.mjs rmSync's it before packing)
 *   4. the manifest.json INSIDE the zip states the same version (a stale or
 *      foreign archive can never be published)
 *
 * Exits non-zero with a specific message on the first violated check.
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => {
  console.error(`release-validate: FAIL — ${msg}`);
  process.exit(1);
};

const tag = process.argv[2];
if (!tag) fail("usage: node scripts/validate-release.mjs <tag>  (e.g. v0.12.0)");

// 1) tag format
if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  fail(`tag "${tag}" does not match the release format vMAJOR.MINOR.PATCH`);
}

// 2) manifest (the single version source) must agree with the tag
const manifest = JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf-8"));
if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  fail(`extension/manifest.json has no valid semver version: ${JSON.stringify(manifest.version)}`);
}
if (tag !== `v${manifest.version}`) {
  fail(`tag ${tag} does not match extension/manifest.json version ${manifest.version} — bump the version (all five synced sites) and re-tag`);
}

// 3) the artifact exists, is non-empty, and is named for THIS version
const zipPath = join(ROOT, "dist", `weboo-v${manifest.version}.zip`);
if (!existsSync(zipPath)) {
  fail(`missing ${join("dist", `weboo-v${manifest.version}.zip`)} — run \`bun run zip\` first`);
}
const size = statSync(zipPath).size;
if (size <= 0) {
  fail(`${zipPath} is empty (${size} bytes)`);
}

// 4) the archive's own manifest states the same version (stale/foreign zip guard)
const innerManifest = execFileSync("unzip", ["-p", zipPath, "manifest.json"], { encoding: "utf-8" });
let inner;
try {
  inner = JSON.parse(innerManifest);
} catch (e) {
  fail(`the archive's manifest.json is not valid JSON (${e.message})`);
}
if (inner.version !== manifest.version) {
  fail(`the zip's manifest version (${inner.version}) does not match ${manifest.version} — stale archive`);
}

console.log(`release-validate: OK — tag ${tag} == manifest ${manifest.version}, ` +
  `${zipPath} (${size} bytes) carries manifest ${inner.version}`);
