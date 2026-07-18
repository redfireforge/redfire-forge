#!/usr/bin/env node
/**
 * Print the lowest-coverage product source files (default top 10 under threshold).
 */
import { readFileSync } from 'node:fs';
import {
  computeCoverageMetrics,
  shouldSkipProductGateFile,
  toProductGatePath,
} from './coverageGateUtils.ts';

const INPUT = process.argv.includes('--demo')
  ? 'coverage/coverage-final.json'
  : 'coverage/coverage-final.product.json';
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 10);
const THRESHOLD = Number(process.argv.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? 90);

type Gap = {
  file: string;
  stmts: number;
  branches: number;
  funcs: number;
  lines: number;
  min: number;
};

let raw: Record<string, import('istanbul-lib-coverage').CoverageMapData>;
try {
  raw = JSON.parse(readFileSync(INPUT, 'utf8')) as Record<string, import('istanbul-lib-coverage').CoverageMapData>;
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌ Could not read ${INPUT}: ${message}`);
  process.exit(1);
}

const gaps: Gap[] = [];

for (const [file, cov] of Object.entries(raw)) {
  if (shouldSkipProductGateFile(file)) continue;

  const metrics = computeCoverageMetrics(cov);
  const min = Math.min(metrics.stmts, metrics.branches, metrics.funcs, metrics.lines);
  if (min < THRESHOLD) {
    gaps.push({ file: toProductGatePath(file), ...metrics, min });
  }
}

gaps.sort((a, b) => a.min - b.min);

console.log(`Top ${Math.min(LIMIT, gaps.length)} lowest product files below ${THRESHOLD}% (of ${gaps.length} total):`);
for (const g of gaps.slice(0, LIMIT)) {
  console.log(
    `${g.min.toFixed(1)}% min | ${g.file} | `
    + `stmts=${g.stmts.toFixed(1)}% branches=${g.branches.toFixed(1)}% `
    + `funcs=${g.funcs.toFixed(1)}% lines=${g.lines.toFixed(1)}%`,
  );
}
