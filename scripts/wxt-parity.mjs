/**
 * WXT output parity check (Phase 6a gate): .output/chrome-mv3 must be a
 * functional twin of extension/ — every file present byte-for-byte, manifest
 * identical (WXT must not invent/drop keys: name/version/description come
 * from extension/manifest.json via wxt.config.ts).
 *
 * Run: node scripts/wxt-parity.mjs   (chained into `bun run build:wxt`)
 * Exits non-zero on the first class of drift it finds.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "extension");
const OUT = join(ROOT, ".output", "chrome-mv3");

if (!existsSync(OUT)) {
  console.error(`wxt-parity: ${relative(ROOT, OUT)} missing — run \`bun run build:wxt\` first (wxt build runs before this script).`);
  process.exit(1);
}

/** All files under dir, as posix-ish relative paths. */
function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out.push(relative(base, p).split("\\").join("/"));
  }
  return out;
}

const problems = [];
const srcFiles = walk(SRC);
const outFiles = new Set(walk(OUT));

// 1) every source file exists in the output
for (const f of srcFiles) {
  if (!outFiles.has(f)) problems.push(`missing in output: ${f}`);
}

// 2) extras: only what WXT generates for entrypoints (the background bundle
//    at its manifest path, plus anything under assets/), never stray files
const outM_pre = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf-8"));
const swBundle = outM_pre.background && outM_pre.background.service_worker;
for (const f of outFiles) {
  if (f === "manifest.json") continue;
  if (f === swBundle) continue;
  if (f.startsWith("assets/")) continue;
  if (!srcFiles.includes(f)) problems.push(`unexpected extra in output: ${f}`);
}

// 3) byte equality for shared files
for (const f of srcFiles) {
  if (f === "manifest.json") continue; /* compared structurally below */
  if (!outFiles.has(f)) continue;
  const a = readFileSync(join(SRC, f));
  const b = readFileSync(join(OUT, f));
  if (!a.equals(b)) problems.push(`content differs: ${f}`);
}

// 4) manifest deep-equality (JSON)
const srcM = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf-8"));
const outM = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf-8"));
const srcKeys = Object.keys(srcM).sort();
const outKeys = Object.keys(outM).sort();
for (const k of srcKeys) {
  if (k === "background") continue; /* modeled below: service_worker path is entrypoint-owned */
  if (JSON.stringify(srcM[k]) !== JSON.stringify(outM[k])) problems.push(`manifest.${k} differs`);
}
/* background: entirely entrypoint-owned (wxt.config deletes the key) — WXT
   picks path AND module style; the only contract: it points at a bundle that
   exists in the output (MV3 service workers are valid module-less when the
   bundle has no import statements — WXT guarantees that). */
if (!outM.background || typeof outM.background.service_worker !== "string") {
  problems.push("manifest.background missing in WXT output");
} else if (!outFiles.has(outM.background.service_worker)) {
  problems.push(`manifest.background.service_worker bundle missing: ${outM.background.service_worker}`);
}
for (const k of outKeys) {
  if (!srcKeys.includes(k)) problems.push(`manifest: unexpected key from WXT: ${k} = ${JSON.stringify(outM[k]).slice(0, 120)}`);
}

if (problems.length) {
  console.error(`wxt-parity: FAILED (${problems.length} problem${problems.length > 1 ? "s" : ""}):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`wxt-parity: OK — ${srcFiles.length} files byte-identical, manifest equal (${srcKeys.length} keys).`);
