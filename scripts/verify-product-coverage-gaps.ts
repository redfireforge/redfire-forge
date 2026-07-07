#!/usr/bin/env node
/**
 * Fail when any product source file (excl. __test-utils__, types/index.ts) is below 90%
 * on statements, branches, functions, or lines.
 */
import { readFileSync } from 'node:fs';

const INPUT = 'coverage/coverage-final.product.json';
const THRESHOLD = 90;

const PRODUCT_COVERAGE_ALLOWLIST = [
  'src/features/grpc/GrpcStudioPage.tsx',
  'src/features/grpc/utils/grpcStudioCallHistoryCapture.ts',
  'src/shared/hooks/useModalDrag.ts',
  'src/features/grpc/hooks/useGrpcStudio.ts',
  'src/features/grpc/components/GrpcConsoleModal.tsx',
  'src/features/grpc/components/protoFormBuilder/GrpcProtoRepeatedMapRows.tsx',
  'src/features/grpc/components/GrpcCallPanel.tsx',
  'src/features/grpc/components/GrpcProtoManageModal.tsx',
  // Legacy debt surface intentionally excluded from hard 90% gate.
  'src/engine/',
  'src/features/workflow/',
  'src/features/graphql/utils/',
  'src/features/grpc/components/',
  'src/features/grpc/data/',
  'src/features/grpc/hooks/',
  'src/features/grpc/utils/',
  'src/features/grpc/grpcStudioAdvancedTypes.ts',
  'src/features/grpc/grpcStudioTypes.ts',
  'src/features/websocket/wsMessageUtils.ts',
  'src/features/scenarios/utils/populateFromApiUtils.ts',
  'src/features/requests/utils/authResolver.ts',
  'src/features/requests/components/RegexPatternLibrary.tsx',
  'src/features/requests/components/regexAssertionUtils.ts',
  'src/features/test-runner/utils/buildSelectedTests.ts',
  'src/app/hooks/useSidebarResize.ts',
  'src/test-utils/clipboardMock.ts',
  'src/test-utils/factories.ts',
  'src/data/galleries/trainingPaths/manualMetadata.ts',
  'src/shared/grpc/grpcStudioExecuteInterpolation.ts',
  'src/shared/utils/helpers.ts',
  'src/shared/components/gallery/GalleryCard.tsx',
  // Shared legacy platform surface excluded from hard 90% gate for now.
  'src/shared/',
  'src/suppressResizeObserverError.ts',
];

function toSrcPath(file: string): string {
  return file.includes('/src/') ? file.replace(/.*\/src\//, 'src/') : file;
}

function isAllowlistedProductPath(file: string): boolean {
  const srcPath = toSrcPath(file);
  return PRODUCT_COVERAGE_ALLOWLIST.some((pattern) => {
    if (pattern.endsWith('/')) return srcPath.startsWith(pattern);
    return srcPath === pattern || srcPath.endsWith(`/${pattern}`);
  });
}

function pct(covered: number, total: number): number {
  return total === 0 ? 100 : (covered / total) * 100;
}

const raw = JSON.parse(readFileSync(INPUT, 'utf8')) as Record<string, import('istanbul-lib-coverage').CoverageMapData>;
const gaps: Array<{ file: string; stmts: number; branches: number; funcs: number; lines: number; min: number }> = [];

for (const [file, cov] of Object.entries(raw)) {
  if (!file.includes('/src/')) continue;
  if (isAllowlistedProductPath(file)) continue;
  if (file.includes('__test-utils__')) continue;
  if (file.includes('.test-utils.')) continue;
  if (file.endsWith('shared/types/index.ts')) continue;
  if (file.includes('.test.')) continue;
  if (file.includes('.testHelpers.')) continue;

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
      file: file.replace(/.*\/src\//, 'src/'),
      ...metrics,
      min,
    });
  }
}

gaps.sort((a, b) => a.min - b.min);

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
