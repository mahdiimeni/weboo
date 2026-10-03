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

// 2) extras: only files the output manifest itself references (entrypoint
//    bundles) or anything under assets/, never stray files
const outM_pre = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf-8"));
const referenced = new Set();
if (outM_pre.background && outM_pre.background.service_worker) referenced.add(outM_pre.background.service_worker);
/* manifest-referenced PAGES are output-owned too (Phase 8: the dashboard page
   becomes a WXT entrypoint and stops being byte-copied from extension/).
   options_ui.page / action.default_popup count as expected files. */
if (outM_pre.options_ui && outM_pre.options_ui.page) referenced.add(outM_pre.options_ui.page);
if (outM_pre.action && outM_pre.action.default_popup) referenced.add(outM_pre.action.default_popup);
for (const cs of outM_pre.content_scripts || []) {
  (cs.js || []).forEach((p) => referenced.add(p));
  (cs.css || []).forEach((p) => referenced.add(p));
}
for (const f of outFiles) {
  if (f === "manifest.json") continue;
  if (referenced.has(f)) continue;
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

/* 3b) page-shape contract (Phase 8): whether byte-copied or generated, the
      options page must keep the anti-flash shape — classic theme-boot FIRST,
      exactly ONE module entry script (the entry bundle). Mirrors the unit
      page-shape test at build level (fail-loud at packaging time). */
const dashPage = outM_pre.options_ui && outM_pre.options_ui.page;
if (dashPage && outFiles.has(dashPage)) {
  const html = readFileSync(join(OUT, dashPage), "utf-8");
  const tags = [...html.matchAll(/<script\b([^>]*)\/?\s*>/gi)].map((m) => m[1]);
  if (tags.length === 0) problems.push(`page contract: ${dashPage} has no <script> tags`);
  else if (/type\s*=\s*["']module["']/.test(tags[0])) {
    problems.push(`page contract: ${dashPage} first <script> must be classic theme-boot (anti-flash), got type=module`);
  } else if (!/theme-boot/.test(tags[0])) {
    problems.push(`page contract: ${dashPage} first <script> must be theme-boot, got:${tags[0].slice(0, 90)}`);
  }
  const mods = tags.filter((t) => /type\s*=\s*["']module["']/.test(t));
  if (mods.length !== 1) problems.push(`page contract: ${dashPage} must have exactly 1 module entry script, got ${mods.length}`);
}

// 4) manifest deep-equality (JSON)
const srcM = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf-8"));
const outM = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf-8"));
const srcKeys = Object.keys(srcM).sort();
const outKeys = Object.keys(outM).sort();
for (const k of srcKeys) {
  if (k === "background") continue; /* modeled below: entrypoint-owned */
  if (k === "content_scripts") continue; /* modeled below: entrypoint-owned */
  if (JSON.stringify(srcM[k]) !== JSON.stringify(outM[k])) problems.push(`manifest.${k} differs`);
}
/* background: entirely entrypoint-owned (wxt.config deletes the key) — WXT
   picks path AND module style; the only contract: it points at a bundle that
   exists in the output (MV3 service workers are valid module-less when the
   bundle has no import statements — WXT guarantees that). */
/* content (entrypoint-owned): contract = same registration as the source
   manifest, ONE self-contained bundle, css files present */
const srcCs = (srcM.content_scripts || [])[0];
const outCsList = outM.content_scripts || [];
if (!srcCs) {
  problems.push("source manifest lost content_scripts (canonical order source)");
} else if (outCsList.length !== 1) {
  problems.push(`expected exactly 1 content_scripts entry in output, got ${outCsList.length}`);
} else {
  const c = outCsList[0];
  /* set comparison: WXT sorts the array; Chrome treats matches as a set (order has no behavioral meaning) */
  const setEq = (a = [], b = []) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
  if (!setEq(c.matches, srcCs.matches)) problems.push(`content matches differ: ${JSON.stringify(c.matches)}`);
  if (c.run_at !== srcCs.run_at) problems.push(`content run_at: expected ${srcCs.run_at}, got ${c.run_at}`);
    /* 7b-3 finding: content_scripts has NO "type" key in Chrome (BCD lists
       only world/run_at/matches/...; Chrome 145 empirically ignores a planted
       "type":"module") — MV3 content scripts are ALWAYS classic. That is why
       the shipped artifact is the WXT bundle: extension/ content files carry
       import/export and are NOT loadable unpacked. Source-tree unpacked loading
       is retired; the rigs guard against it. */
  if ((c.all_frames ?? false) !== (srcCs.all_frames ?? false)) problems.push(`content all_frames: expected ${srcCs.all_frames}, got ${c.all_frames}`);
  if (!Array.isArray(c.js) || c.js.length !== 1) {
    problems.push(`expected single bundled content js, got ${JSON.stringify(c.js)}`);
  } else {
    const bundle = c.js[0];
    if (!outFiles.has(bundle)) problems.push(`content bundle missing: ${bundle}`);
    else {
      const code = readFileSync(join(OUT, bundle), "utf-8");
      if (/^\s*(import|export)\s/m.test(code)) problems.push(`content bundle has module statements (must be self-contained): ${bundle}`);
      /* the hand-off's whole point: one file must contain the product */
      for (const probe of ["hlx:schemaVersion", "mark", "hlx:count-report"]) {
        if (!code.includes(probe)) problems.push(`content bundle missing code probe "${probe}"`);
      }
    }
  }
  for (const p of c.css || []) {
    if (!outFiles.has(p)) problems.push(`content css missing: ${p}`);
  }
}

/* entrypoint import order == manifest js order (drift tripwire for the hand-off) */
const ctPath = join(ROOT, "entrypoints", "content.ts");
if (existsSync(ctPath)) {
  const ct = readFileSync(ctPath, "utf-8");
  const imports = [...ct.matchAll(/^\s*import\s+"([^"]+)"/gm)].map((m) => m[1])
    .filter((p) => p.endsWith(".js")).map((p) => p.replace(/^\.\.\/extension\//, ""));
  if (JSON.stringify(imports) !== JSON.stringify(srcCs ? srcCs.js : [])) {
    problems.push(`entrypoint import order != manifest js order\n    manifest: ${JSON.stringify(srcCs ? srcCs.js : [])}\n    imports : ${JSON.stringify(imports)}`);
  }
}

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
