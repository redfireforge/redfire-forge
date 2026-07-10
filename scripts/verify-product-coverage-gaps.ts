#!/usr/bin/env node
/**
 * Fail when any product source file (src/, src-server/, cli/) is below 90%
 * on statements, branches, functions, or lines.
 *
 * Skips test helpers and barrels — see shouldSkipProductGateFile().
 */
import { readFileSync } from 'node:fs';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import {
  computeCoverageMetrics,
  shouldSkipProductGateFile,
  toProductGatePath,
} from './coverageGateUtils';

const INPUT = 'coverage/coverage-final.product.json';
const THRESHOLD = 90;

const PRODUCT_COVERAGE_ALLOWLIST: string[] = [];

function isAllowlistedProductPath(file: string): boolean {
  const gatePath = toProductGatePath(file);
  return PRODUCT_COVERAGE_ALLOWLIST.some((pattern) => {
    if (pattern.endsWith('/')) return gatePath.startsWith(pattern);
    return gatePath === pattern || gatePath.endsWith(`/${pattern}`);
  });
}

const raw = JSON.parse(readFileSync(INPUT, 'utf8')) as Record<string, CoverageMapData>;
const gaps: Array<{ file: string; stmts: number; branches: number; funcs: number; lines: number; min: number }> = [];
let evaluated = 0;

for (const [file, cov] of Object.entries(raw)) {
  if (shouldSkipProductGateFile(file)) continue;
  if (isAllowlistedProductPath(file)) continue;

  evaluated += 1;

  const metrics = computeCoverageMetrics(cov);
  const min = Math.min(metrics.stmts, metrics.branches, metrics.funcs, metrics.lines);
  if (min < THRESHOLD) {
    gaps.push({
      file: toProductGatePath(file),
      ...metrics,
      min,
    });
  }
}

gaps.sort((a, b) => a.min - b.min);

const passing = evaluated - gaps.length;
console.log(
  `Product files evaluated: ${evaluated} | `
  + `>= ${THRESHOLD}% all metrics: ${passing} | `
  + `below ${THRESHOLD}% on any metric: ${gaps.length}`,
);

if (gaps.length === 0) {
  console.log(`✅ All product files >= ${THRESHOLD}% on every coverage metric`);
  process.exit(0);
}

console.error(`❌ ${gaps.length} product file(s) below ${THRESHOLD}% on at least one metric:`);
for (const g of gaps) {
  console.error(
    `   ${g.file} | stmts=${g.stmts.toFixed(1)}% branches=${g.branches.toFixed(1)}% `
    + `funcs=${g.funcs.toFixed(1)}% lines=${g.lines.toFixed(1)}%`,
  );
}
process.exit(1);
