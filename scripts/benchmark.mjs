#!/usr/bin/env bun
/**
 * Phase 11 — engine benchmark: create + restore costs across doc sizes ×
 * highlight densities (docs/migration-baseline.md §8, Phase 11).
 *
 * Measures the anchor engine's two user-visible costs on synthetic docs:
 *   create  — K × highlighter.createFromRange (selection → record + mark)
 *   restore — a fresh world + fresh doc + hl.applyAll() over the SAME K
 *             records (the boot path: structural anchors first, self-heal
 *             fallback), applied count asserted = K
 * Cells: {small, medium, large} doc × {0, 10, 100, 500} highlights, median of
 * 3 runs per cell after a warmup pass. Records carry REAL anchors (created by
 * the engine itself) so restore exercises the structural path — the common
 * case; the textual fallback is the orphan path, not boot.
 *
 * Runs unmodified on BOTH sides of the migration (main = classic files via
 * the eval path, branch = ES-module graphs via the vm path) — the helper's
 * loadEngine handles both; the engine API (createHighlighter/createFromRange/
 * applyAll) is migration-stable. Storage is the in-memory backend: the bench
 * isolates engine/DOM cost from chrome.storage I/O by design.
 *
 * Usage:  bun scripts/benchmark.mjs [--json]
 */
import { performance } from "node:perf_hooks";
import { setupDom, loadEngine } from "../tests/unit/helpers/engine.ts";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- synthetic docs ---------- */

const WORDS = "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu".split(" ");

/** n paragraphs, ~40 unique-ish words each; word k gets a global index so a
    span picked by index is unambiguous in the whole doc. */
function buildParagraphs(n) {
  const paras = [];
  let w = 0;
  for (let p = 0; p < n; p++) {
    const out = [];
    for (let i = 0; i < 40; i++) {
      out.push(WORDS[(w * 7 + i * 3) % WORDS.length] + w);
      w++;
    }
    paras.push(out.join(" "));
  }
  return paras;
}

function buildDoc(doc, paras) {
  doc.body.innerHTML = "";
  const main = doc.createElement("main");
  for (const text of paras) {
    const p = doc.createElement("p");
    p.textContent = text;
    main.appendChild(p);
  }
  doc.body.appendChild(main);
  return main;
}

/** a DOM Range over words [i, i+2) of the flattened doc — walks the text
    nodes; every paragraph is one text node, so spans never cross nodes. */
function rangeForWord(doc, paras, wordIndex) {
  const per = 40;
  const p = Math.floor(wordIndex / per);
  const offset = (wordIndex % per);
  const node = doc.body.querySelectorAll("p")[p].firstChild;
  const words = paras[p].split(" ");
  const start = words.slice(0, offset).join(" ").length + (offset ? 1 : 0);
  const end = start + words.slice(offset, offset + 3).join(" ").length;
  const r = doc.createRange();
  r.setStart(node, start);
  r.setEnd(node, end);
  return r;
}

/* ---------- one measured world ---------- */

/* The engine's file set in manifest order. adaptive: main (pre-Phase-3) has
   no shared/anchor.js — the file list filters to what exists so the SAME
   script runs on both sides of the migration. */
const ENGINE_FILES = [
  "shared/constants.js",
  "shared/backends/chrome-storage.js",
  "shared/url.js",
  "shared/utils.js",
  "shared/format.js",
  "shared/detect-dir.js",
  "shared/clipboard.js",
  "shared/tags.js",
  "shared/textindex.js",
  "shared/domwrap.js",
  "shared/anchor.js",
  "shared/ui/base.js",
  "shared/ui/toast.js",
  "shared/ui/toolbar.js",
  "shared/ui/popover.js",
  "shared/store.js",
  "shared/runtime-bridge.js",
  "shared/highlighter.js",
  "content/favicon.js",
].filter((f) => existsSync(join(ROOT, "extension", f)));

async function makeWorld(paras) {
  setupDom();
  const HL = await loadEngine({ files: ENGINE_FILES });
  const doc = document;
  buildDoc(doc, paras);
  const store = HL.createStore(HL.backends.memoryArea());
  const hl = HL.createHighlighter({
    page: { url: "https://bench.test/article", norm: "https://bench.test/article", site: "https://bench.test/article", host: "bench.test" },
    scope: doc.body,
    eventRoot: doc,
    store,
  });
  return { HL, doc, store, hl };
}

async function runCell(paras, K, label) {
  /* phase A — create K highlights (real anchors), capture the records.
     Each rep is a FRESH world: createFromRange saves as it goes, so a shared
     world would accumulate records across reps. */
  const totalWords = paras.length * 40;
  const createMs = [];
  let all = null;
  for (let rep = 0; rep < 3; rep++) {
    const a = await makeWorld(paras);
    /* pre-compute every range on the PRISTINE doc, then create DESCENDING:
       createFromRange splits the text node at each mark, and the original
       node object keeps the PREFIX — so each next create (earlier words in
       the same node) always finds its offsets intact */
    const ranges = [];
    for (let i = 0; i < K; i++) {
      const word = Math.floor((i * totalWords) / Math.max(K, 1));
      ranges.push(rangeForWord(a.doc, paras, word));
    }
    const t0 = performance.now();
    for (let i = K - 1; i >= 0; i--) {
      const range = ranges[i];
      a.hl.createFromRange(range, range.toString(), "yellow", "");
    }
    createMs.push(performance.now() - t0);
    all = Array.from((await a.store.getAllRecords()).values());
  }
  createMs.sort((x, y) => x - y);

  if (all.length !== K) throw new Error(`${label}: expected ${K} records, got ${all.length}`);

  /* phase B — fresh world + fresh doc + the same records → applyAll */
  const restoreMs = [];
  let applied = 0;
  for (let rep = 0; rep < 3; rep++) {
    const b = await makeWorld(paras);
    await b.store.saveMany(all);
    /* the orchestrator's boot contract: read the store, adopt, then apply */
    const fresh = await b.store.getForUrl("https://bench.test/article", "bench.test");
    fresh.forEach((rec) => { b.hl.adoptRecord(rec); });
    const t0 = performance.now();
    applied = b.hl.applyAll();
    restoreMs.push(performance.now() - t0);
    if (applied !== K) throw new Error(`${label}: applyAll restored ${applied}/${K}`);
  }
  restoreMs.sort((x, y) => x - y);

  return {
    cell: label,
    createMedianMs: +createMs[1].toFixed(1),
    createPerItemMs: +(createMs[1] / Math.max(K, 1)).toFixed(3),
    restoreMedianMs: +restoreMs[1].toFixed(1),
    restorePerItemMs: +(restoreMs[1] / Math.max(K, 1)).toFixed(3),
    applied,
  };
}

/* ---------- matrix ---------- */

const SIZES = {
  small: 40,   /* ~1,600 words */
  medium: 200, /* ~8,000 words */
  large: 1000, /* ~40,000 words */
};
const DENSITIES = [0, 10, 100, 500];

const rows = [];
for (const [name, n] of Object.entries(SIZES)) {
  const paras = buildParagraphs(n);
  for (const K of DENSITIES) {
    const label = `${name} × ${K}`;
    process.stdout.write(`  ${label} ... `);
    const row = await runCell(paras, K, label);
    rows.push(row);
    console.log(`create ${row.createMedianMs}ms · restore ${row.restoreMedianMs}ms`);
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log("\n| doc | K | create (median) | per item | restore (median) | per item |");
  console.log("|---|---|---|---|---|---|");
  for (const r of rows) {
    console.log(`| ${r.cell.split(" × ")[0]} | ${r.cell.split(" × ")[1]} | ${r.createMedianMs}ms | ${r.createPerItemMs}ms | ${r.restoreMedianMs}ms | ${r.restorePerItemMs}ms |`);
  }
}
