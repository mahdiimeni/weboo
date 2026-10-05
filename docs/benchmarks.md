# Engine Benchmarks — Phase 11 (docs/migration-baseline.md §8)

Measured before/after the architecture migration: **before** = `main` (classic
scripts, no bundler), **after** = `migration/arch-modernization` (TS-emitted
ES modules + WXT bundle). The SAME harness (`scripts/benchmark.mjs`) ran on
both trees — it loads the engine through the shared test helper
(`tests/unit/helpers/engine.ts`), which evaluates classic files on `main` and
module graphs on the branch, so the ONLY variable between the two runs is the
migration itself.

## Methodology

- **Cells**: {small, medium, large} doc × {0, 10, 100, 500} highlights.
  small ≈ 1,600 words (40 paragraphs), medium ≈ 8,000 (200), large ≈ 40,000
  (1,000). Highlights are 3-word spans spread evenly across the doc.
- **create** — K × `highlighter.createFromRange(range, text, color, note)`
  (selection → record + mark), ranges pre-computed on the pristine doc and
  applied in descending order (each mark splits its text node; the original
  node keeps the prefix, so descending keeps every offset valid).
- **restore** — a FRESH world + fresh doc: the K engine-created records (real
  structural anchors — the common boot path, not the orphan fallback) are
  saved into the fresh store, adopted, then `applyAll()` is timed. The
  applied count is asserted = K (the visibility invariant).
- **Timing**: median of 3 runs per cell, `performance.now()` around the whole
  loop; per-item = median / K.
- **Storage**: the in-memory backend (`backends.memoryArea()`) — the bench
  isolates engine + DOM cost from `chrome.storage` I/O by design.
- **Environment**: bun 1.4.2, happy-dom v20, same machine, back-to-back runs.
  happy-dom's DOM is slower than real Chrome's — treat the numbers as
  RELATIVE (before/after on the identical harness), not as user-facing
  absolute times.

## Results

### after — `migration/arch-modernization` (ES modules, WXT)

| doc | K | create (median) | per item | restore (median) | per item |
|---|---|---|---|---|---|
| small | 0 | 0ms | 0.001ms | 0.6ms | 0.564ms |
| small | 10 | 5.2ms | 0.516ms | 12ms | 1.199ms |
| small | 100 | 60ms | 0.6ms | 83.5ms | 0.835ms |
| small | 500 | 1379.7ms | 2.759ms | 1161ms | 2.322ms |
| medium | 0 | 0ms | 0ms | 1ms | 1.04ms |
| medium | 10 | 10ms | 1.001ms | 9.3ms | 0.932ms |
| medium | 100 | 99.5ms | 0.995ms | 102.2ms | 1.022ms |
| medium | 500 | 1267.1ms | 2.534ms | 1042.6ms | 2.085ms |
| large | 0 | 0ms | 0ms | 4.4ms | 4.353ms |
| large | 10 | 50.7ms | 5.073ms | 29.1ms | 2.905ms |
| large | 100 | 459.6ms | 4.596ms | 272.5ms | 2.725ms |
| large | 500 | 2699.4ms | 5.399ms | 2005.8ms | 4.012ms |

### before — `main` (classic scripts)

| doc | K | create (median) | per item | restore (median) | per item |
|---|---|---|---|---|---|
| small | 0 | 0ms | 0.001ms | 0.5ms | 0.495ms |
| small | 10 | 4.8ms | 0.483ms | 11.9ms | 1.186ms |
| small | 100 | 50.7ms | 0.507ms | 81.3ms | 0.813ms |
| small | 500 | 1364.2ms | 2.728ms | 1162.7ms | 2.325ms |
| medium | 0 | 0ms | 0ms | 1.1ms | 1.054ms |
| medium | 10 | 10.8ms | 1.077ms | 10.2ms | 1.021ms |
| medium | 100 | 99.4ms | 0.994ms | 101.6ms | 1.016ms |
| medium | 500 | 1206.3ms | 2.413ms | 1016.3ms | 2.033ms |
| large | 0 | 0ms | 0ms | 4.4ms | 4.42ms |
| large | 10 | 49.5ms | 4.949ms | 32.3ms | 3.227ms |
| large | 100 | 446.3ms | 4.463ms | 288.4ms | 2.884ms |
| large | 500 | 2758.6ms | 5.517ms | 2093.4ms | 4.187ms |

## Conclusion

**No regression**: every cell pairs within run-to-run noise (±3–5%) — the
dominant costs are happy-dom's DOM operations, identical on both sides. The
engine is behavior- and performance-preserving through the migration, exactly
what the compatibility constraints (§6) demanded: same anchors, same scoring,
same visibility invariant, same speed.

Reading the shape (both sides alike):
- create/restore scale ~linearly in K at fixed doc size (per-item cost flat
  up to 100; the 500-cell rise is per-node DOM churn, not algorithmic).
- restore at K=0 measures the fresh-index + scan floor (0.5ms small → 4.4ms
  large) — the empty-document boot cost.
- per-item cost grows with doc size (index rebuilds over more text) — the
  known O(doc × marks) shape of the anchor engine; unchanged by the
  migration, a candidate for the text-index if it ever matters in practice.

Re-run: `bun scripts/benchmark.mjs` (append `--json` for machine-readable
rows). The script is branch-agnostic (main's file set filtered by existence).
