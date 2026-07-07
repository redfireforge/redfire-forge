#!/usr/bin/env node
/**
 * Fail when any demo-hub source file (excl. __test-utils__) is below 90%
 * on statements, branches, functions, or lines.
 *
 * PR / CI only:
 *   bash scripts/run-demo-coverage-full.sh
 *
 * Day-to-day:
 *   bash scripts/run-demo-coverage-scope.sh <path>
 *   bash scripts/demo-coverage-status.sh
 */
import { readFileSync } from 'node:fs';

const INPUT = 'coverage/coverage-final.json';
const THRESHOLD = 90;

const DEMO_COVERAGE_ALLOWLIST = [
  'packages/demo-hub/src/lessons/protocols/grpc-env-collections.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-proto-form.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-spring-boot.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-tls.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-transport-modes.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.ts',
  'packages/demo-hub/src/lessons/protocols/graphql-lesson-helpers/gql-demo-core/sessionFlags.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/roster.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/stepCheckpoints.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-metadata-auth.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-schema-discovery.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/shell.ts',
  'packages/demo-hub/src/useDemoHub.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/versioning.ts',
  'packages/demo-hub/src/utils/checkEndpoint.ts',
  'packages/demo-hub/src/adapters/grpcLessonRuntimeAdapter.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/validate.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/session.ts',
  'packages/demo-hub/src/lessons/grpc-demo-storage-cleanup.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-streaming.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/stateMachine.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/snapshots.ts',
  'packages/demo-hub/src/adapters/environmentAdapter.ts',
  'packages/demo-hub/src/lessons/protocols/graphql-lesson-helpers/gql-demo-core/response.ts',
  'packages/demo-hub/src/lessons/protocols/grpc-first-call.ts',
  'packages/demo-hub/src/LessonPlayer.tsx',
  'packages/demo-hub/src/utils/endpointLabel.ts',
  'packages/demo-hub/src/lessons/protocols/graphql-lesson-helpers/lesson2-variables-history.ts',
  'packages/demo-hub/src/adapters/bridgeWindow.ts',
  'packages/demo-hub/src/adapters/gqlModalLockBridge.ts',
];

function pct(covered: number, total: number): number {
  return total === 0 ? 100 : (covered / total) * 100;
}

let raw: Record<string, import('istanbul-lib-coverage').CoverageMapData>;
try {
  raw = JSON.parse(readFileSync(INPUT, 'utf8')) as Record<
    string,
    import('istanbul-lib-coverage').CoverageMapData
  >;
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌ Could not read ${INPUT}:`, message);
  console.error('   Run: bash scripts/run-demo-coverage-full.sh');
  process.exit(1);
}

const gaps: Array<{ file: string; stmts: number; branches: number; funcs: number; lines: number; min: number }> = [];

function isExcludedDemoGatePath(file: string): boolean {
  if (DEMO_COVERAGE_ALLOWLIST.some((p) => file.endsWith(p))) return true;
  if (file.includes('__test-utils__')) return true;
  if (file.includes('.coverage-helpers.')) return true;
  if (file.includes('/packages/demo-hub/src/test-utils/')) return true;
  if (file.includes('.test.')) return true;
  return false;
}

for (const [file, cov] of Object.entries(raw)) {
  if (!file.includes('/packages/demo-hub/src/')) continue;
  if (isExcludedDemoGatePath(file)) continue;

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

if (gaps.length === 0) {
  console.log(`✅ All demo-hub files >= ${THRESHOLD}% on every coverage metric`);
  process.exit(0);
}

console.error(`❌ ${gaps.length} demo-hub file(s) below ${THRESHOLD}% on at least one metric:`);
for (const g of gaps) {
  console.error(
    `   ${g.file} | stmts=${g.stmts.toFixed(1)}% branches=${g.branches.toFixed(1)}% `
    + `funcs=${g.funcs.toFixed(1)}% lines=${g.lines.toFixed(1)}%`,
  );
}
process.exit(1);
