#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const INPUT = process.argv[2] || 'coverage/coverage-final.product.json';
const THRESHOLD = Number(process.argv[3] || 90);

function pct(covered, total) {
  return total === 0 ? 100 : (covered / total) * 100;
}

const raw = JSON.parse(readFileSync(INPUT, 'utf8'));
const rows = [];

for (const [file, cov] of Object.entries(raw)) {
  const normalized = file.replace(/\\/g, '/');
  if (!normalized.includes('/src/') && !normalized.includes('/src-server/') && !normalized.includes('/cli/')) continue;
  if (file.includes('__test-utils__')) continue;
  if (file.includes('.test-utils.')) continue;
  if (file.endsWith('shared/types/index.ts')) continue;
  if (file.includes('.test.')) continue;
  if (file.includes('.testHelpers.')) continue;

  const s = cov.s || {};
  const f = cov.f || {};
  const b = cov.b || {};
  const stmtMap = cov.statementMap || {};

  const stmtTotal = Object.keys(s).length;
  const stmtCovered = Object.values(s).filter((v) => v > 0).length;
  const fnTotal = Object.keys(f).length;
  const fnCovered = Object.values(f).filter((v) => v > 0).length;

  const branchArr = Object.values(b);
  const branchTotal = branchArr.reduce((a, arr) => a + arr.length, 0);
  const branchCovered = branchArr.reduce((a, arr) => a + arr.filter((v) => v > 0).length, 0);

  const lineSet = new Set(Object.values(stmtMap).map((x) => x.start.line));
  const coveredLines = new Set();
  for (const [id, count] of Object.entries(s)) {
    if (count > 0 && stmtMap[id]) coveredLines.add(stmtMap[id].start.line);
  }

  const stmts = pct(stmtCovered, stmtTotal);
  const branches = pct(branchCovered, branchTotal);
  const funcs = pct(fnCovered, fnTotal);
  const lines = pct(coveredLines.size, lineSet.size);
  const min = Math.min(stmts, branches, funcs, lines);

  rows.push({
    file: normalized.includes('/src-server/')
      ? normalized.replace(/.*\/src-server\//, 'src-server/')
      : normalized.includes('/cli/')
        ? normalized.replace(/.*\/cli\//, 'cli/')
        : normalized.replace(/.*\/src\//, 'src/'),
    stmts,
    branches,
    funcs,
    lines,
    min,
  });
}

rows.sort((a, b) => a.min - b.min);
const lows = rows.filter((r) => r.min < THRESHOLD);

if (lows.length === 0) {
  console.log(JSON.stringify({ threshold: THRESHOLD, total: rows.length, belowThreshold: 0, files: [] }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify({
  threshold: THRESHOLD,
  total: rows.length,
  belowThreshold: lows.length,
  files: lows,
}, null, 2));
