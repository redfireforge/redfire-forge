#!/usr/bin/env node
/**
 * Fail when any gRPC production source file is below 90% on statements,
 * branches, functions, or lines.
 *
 * Scope:
 * - src/features/grpc/
 * - src/shared/grpc/
 * - src-server/grpc/
 * - src-server/routes/grpc/
 *
 * Excludes *.test.* files and *testHelpers* modules.
 */
import { readFileSync } from 'node:fs';

const INPUT = 'coverage/coverage-final.product.json';
const THRESHOLD = 90;

const GRPC_PATH_MARKERS = [
  '/src/features/grpc/',
  '/src/shared/grpc/',
  '/src-server/grpc/',
  '/src-server/routes/grpc/',
];

function pct(covered: number, total: number): number {
  return total === 0 ? 100 : (covered / total) * 100;
}

function isGrpcProductionFile(file: string): boolean {
  if (!GRPC_PATH_MARKERS.some((marker) => file.includes(marker))) return false;
  if (file.includes('.test.')) return false;
  if (file.includes('testHelpers')) return false;
  return true;
}

function displayPath(file: string): string {
  const srcIdx = file.indexOf('/src/');
  if (srcIdx >= 0) return file.slice(srcIdx + 1);
  const serverIdx = file.indexOf('/src-server/');
  if (serverIdx >= 0) return file.slice(serverIdx + 1);
  return file;
}

const raw = JSON.parse(readFileSync(INPUT, 'utf8')) as Record<string, import('istanbul-lib-coverage').CoverageMapData>;
const gaps: Array<{ file: string; stmts: number; branches: number; funcs: number; lines: number; min: number }> = [];

for (const [file, cov] of Object.entries(raw)) {
  if (!isGrpcProductionFile(file)) continue;

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
      file: displayPath(file),
      ...metrics,
      min,
    });
  }
}

gaps.sort((a, b) => a.min - b.min);

if (gaps.length === 0) {
  console.log(`✅ All gRPC production files >= ${THRESHOLD}% on every coverage metric`);
  process.exit(0);
}

console.error(`❌ ${gaps.length} gRPC file(s) below ${THRESHOLD}% on at least one metric:`);
for (const g of gaps) {
  console.error(
    `   ${g.file} | stmts=${g.stmts.toFixed(1)}% branches=${g.branches.toFixed(1)}% `
    + `funcs=${g.funcs.toFixed(1)}% lines=${g.lines.toFixed(1)}%`,
  );
}
process.exit(1);
