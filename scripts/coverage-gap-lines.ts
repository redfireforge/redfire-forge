#!/usr/bin/env node
/**
 * Show per-file coverage metrics and uncovered line numbers.
 *
 * Product (default):
 *   npx tsx scripts/coverage-gap-lines.ts grpcCollectionRepository
 *
 * Demo hub:
 *   npx tsx scripts/coverage-gap-lines.ts --demo grpc-first-call
 */
import { existsSync, readFileSync } from 'node:fs';

const demoMode = process.argv.includes('--demo');
const THRESHOLD = Number(process.argv.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? 90);
const targetArg = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);

if (!targetArg) {
  console.error('Usage: npx tsx scripts/coverage-gap-lines.ts [--demo] <file-substring-or-path> [--threshold=90]');
  process.exit(1);
}

const INPUT = demoMode
  ? (existsSync('coverage/coverage-final.json') ? 'coverage/coverage-final.json' : null)
  : (existsSync('coverage/coverage-final.product.json')
    ? 'coverage/coverage-final.product.json'
    : existsSync('coverage/coverage-final.json')
      ? 'coverage/coverage-final.json'
      : null);

if (!INPUT) {
  console.error('❌ No coverage report found.');
  if (demoMode) {
    console.error('   bash scripts/run-demo-coverage-scope.sh <packages/demo-hub/src/...>');
  } else {
    console.error('   bash scripts/run-product-coverage-batch.sh <shared|features|app|server>');
  }
  process.exit(1);
}

function pct(covered: number, total: number): number {
  return total === 0 ? 100 : (covered / total) * 100;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function formatLines(lines: number[], max = 40): string {
  if (lines.length === 0) return '(none)';
  if (lines.length <= max) return lines.join(', ');
  return `${lines.slice(0, max).join(', ')} … (+${lines.length - max} more)`;
}

type Cov = import('istanbul-lib-coverage').CoverageMapData;

const raw = JSON.parse(readFileSync(INPUT, 'utf8')) as Record<string, Cov>;
const matches = Object.entries(raw).filter(([file]) => {
  if (!file.includes(targetArg)) return false;
  if (!demoMode) return true;
  if (!file.includes('/packages/demo-hub/src/')) return false;
  if (file.includes('.test.')) return false;
  if (file.includes('__test-utils__')) return false;
  if (file.includes('.coverage-helpers.')) return false;
  return true;
});

if (matches.length === 0) {
  console.error(`❌ No coverage entry matching "${targetArg}" in ${INPUT}`);
  process.exit(1);
}

if (matches.length > 1) {
  console.warn(`⚠ ${matches.length} files matched; showing each:\n`);
}

let anyBelow = false;

for (const [file, cov] of matches) {
  const s = cov.s ?? {};
  const f = cov.f ?? {};
  const b = cov.b ?? {};
  const fnMap = cov.fnMap ?? {};
  const stmtMap = cov.statementMap ?? {};
  const branchMap = cov.branchMap ?? {};

  const stmtTotal = Object.keys(s).length;
  const stmtCovered = Object.values(s).filter((v) => v > 0).length;
  const fnTotal = Object.keys(f).length;
  const fnCovered = Object.values(f).filter((v) => v > 0).length;
  const branchArr = Object.values(b);
  const branchTotal = branchArr.reduce((a, arr) => a + arr.length, 0);
  const branchCovered = branchArr.reduce((a, arr) => a + arr.filter((v) => v > 0).length, 0);

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
  const short = demoMode
    ? file.replace(/.*\/packages\/demo-hub\//, 'packages/demo-hub/')
    : file.replace(/.*\/(src(?:-server)?|cli)\//, '$1/');

  const uncoveredStmtLines = uniqueSorted(
    Object.entries(s)
      .filter(([, count]) => count === 0)
      .map(([id]) => stmtMap[id]?.start.line)
      .filter((line): line is number => typeof line === 'number'),
  );

  const uncoveredBranchLines = uniqueSorted(
    Object.entries(b).flatMap(([id, counts]) =>
      counts
        .map((count, index) => (count === 0 ? branchMap[id]?.locations[index]?.start.line : undefined))
        .filter((line): line is number => typeof line === 'number'),
    ),
  );

  const uncoveredFnLines = uniqueSorted(
    Object.entries(f)
      .filter(([, count]) => count === 0)
      .map(([id]) => fnMap[id]?.loc.start.line)
      .filter((line): line is number => typeof line === 'number'),
  );

  const gate = min >= THRESHOLD ? 'PASS' : 'FAIL';
  if (min < THRESHOLD) anyBelow = true;

  console.log(`${short}`);
  console.log(`  gate (${THRESHOLD}%): ${gate} — min ${min.toFixed(1)}%`);
  console.log(
    `  stmts=${metrics.stmts.toFixed(1)}% branches=${metrics.branches.toFixed(1)}% `
    + `funcs=${metrics.funcs.toFixed(1)}% lines=${metrics.lines.toFixed(1)}%`,
  );
  console.log(`  uncovered statements: ${formatLines(uncoveredStmtLines)}`);
  console.log(`  uncovered branches:   ${formatLines(uncoveredBranchLines)}`);
  console.log(`  uncovered functions:  ${formatLines(uncoveredFnLines)}`);
  console.log('');
}

process.exit(anyBelow ? 1 : 0);
