#!/usr/bin/env node
/**
 * Print lowest-coverage demo-hub source files from the last demo coverage run.
 *
 *   npx tsx scripts/list-top-demo-coverage-gaps.ts
 *   npx tsx scripts/list-top-demo-coverage-gaps.ts --limit=5 --filter=grpc-first-call
 */
import { readFileSync } from 'node:fs';

const INPUT = 'coverage/coverage-final.json';
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 10);
const THRESHOLD = Number(process.argv.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? 90);
const FILTER = process.argv.find((a) => a.startsWith('--filter='))?.split('=')[1] ?? '';

function pct(covered: number, total: number): number {
  return total === 0 ? 100 : (covered / total) * 100;
}

function isExcludedDemoGatePath(file: string): boolean {
  if (file.includes('__test-utils__')) return true;
  if (file.includes('.coverage-helpers.')) return true;
  if (file.includes('/packages/demo-hub/src/test-utils/')) return true;
  if (file.includes('.test.')) return true;
  return false;
}

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
  console.error('   Run: bash scripts/run-demo-coverage-scope.sh <path>');
  console.error('   Or PR/CI: bash scripts/run-demo-coverage-full.sh');
  process.exit(1);
}

const gaps: Gap[] = [];

for (const [file, cov] of Object.entries(raw)) {
  if (!file.includes('/packages/demo-hub/src/')) continue;
  if (isExcludedDemoGatePath(file)) continue;
  if (FILTER && !file.includes(FILTER)) continue;

  const s = cov.s ?? {};
  const f = cov.f ?? {};
  const b = cov.b ?? {};
  const stmtTotal = Object.keys(s).length;
  const stmtCovered = Object.values(s).filter((v) => v > 0).length;
  const fnTotal = Object.keys(f).length;
  const fnCovered = Object.values(f).filter((v) => v > 0).length;
  const branchArr = Object.values(b);
  const branchTotal = branchArr.reduce((a, arr) => a + arr.length, 0);
  const branchCovered = branchArr.reduce((a, arr) => a + arr.filter((v) => v > 0).length, 0);
  const stmtMap = cov.statementMap ?? {};
  const lineSet = new Set(Object.values(stmtMap).map((x) => x.start.line));
  const coveredLines = new Set<number>();
  for (const [id, count] of Object.entries(s)) {
    if (count > 0 && stmtMap[id]) coveredLines.add(stmtMap[id].start.line);
  }

  const metrics = {
    stmts: pct(stmtCovered, stmtTotal),
    branches: pct(branchCovered, branchTotal),
    funcs: pct(fnCovered, fnTotal),
    lines: pct(coveredLines.size, lineSet.size),
  };
  const min = Math.min(metrics.stmts, metrics.branches, metrics.funcs, metrics.lines);
  if (min < THRESHOLD) {
    gaps.push({
      file: file.replace(/.*\/packages\/demo-hub\//, 'packages/demo-hub/'),
      ...metrics,
      min,
    });
  }
}

gaps.sort((a, b) => a.min - b.min);

const label = FILTER ? ` matching "${FILTER}"` : '';
console.log(
  `Top ${Math.min(LIMIT, gaps.length)} lowest demo-hub files below ${THRESHOLD}%${label} `
  + `(of ${gaps.length} total):`,
);
for (const g of gaps.slice(0, LIMIT)) {
  console.log(
    `${g.min.toFixed(1)}% min | ${g.file} | `
    + `stmts=${g.stmts.toFixed(1)}% branches=${g.branches.toFixed(1)}% `
    + `funcs=${g.funcs.toFixed(1)}% lines=${g.lines.toFixed(1)}%`,
  );
}
