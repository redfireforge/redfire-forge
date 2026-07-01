#!/usr/bin/env tsx
/**
 * Strips demo-hub sources from the product Vitest coverage map and prints
 * product-only totals. Demo files can appear in raw coverage when product
 * tests import demo helpers (e.g. SettingsStorageTab → gql-demo-storage-cleanup).
 *
 * @see docs/plan/feature/separate-demo/separate-demo-codebase-plan.md Phase 1
 */
import { readFileSync, writeFileSync } from 'node:fs';
import libCoverage from 'istanbul-lib-coverage';
import { isDemoCoveragePath } from '../vitest.projectPatterns';

const INPUT = 'coverage/coverage-final.json';
const SUMMARY_OUT = 'coverage/coverage-summary.product.json';

let raw: Record<string, unknown>;
try {
  raw = JSON.parse(readFileSync(INPUT, 'utf8')) as Record<string, unknown>;
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌ Could not read ${INPUT}:`, message);
  process.exit(1);
}

const map = libCoverage.createCoverageMap(raw);
const before = map.files().length;

map.filter((file: string) => !isDemoCoveragePath(file) && !file.includes('.testHelpers.'));

const removed = before - map.files().length;

const remainingDemo = map.files().filter(isDemoCoveragePath);
if (remainingDemo.length > 0) {
  console.error('❌ Failed to strip demo paths from product coverage map:');
  for (const file of remainingDemo.slice(0, 5)) {
    console.error(`   - ${file}`);
  }
  process.exit(1);
}

const summary = map.getCoverageSummary().toJSON();
writeFileSync(SUMMARY_OUT, JSON.stringify(summary, null, 2));
writeFileSync('coverage/coverage-final.product.json', JSON.stringify(map.toJSON(), null, 2));

const pct = (n: number | string) => `${Number(n).toFixed(2)}%`;
console.log(`✅ Product coverage map excludes demo-hub (${removed} path(s) stripped from raw report)`);
console.log(
  `   Statements ${pct(summary.statements.pct)} | `
  + `Branches ${pct(summary.branches.pct)} | `
  + `Functions ${pct(summary.functions.pct)} | `
  + `Lines ${pct(summary.lines.pct)}`,
);
console.log(`   Summary written to ${SUMMARY_OUT}`);
console.log('   Filtered map written to coverage/coverage-final.product.json');
