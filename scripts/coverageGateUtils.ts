import type { CoverageMapData } from 'istanbul-lib-coverage';

export type CoverageMetrics = {
  stmts: number;
  branches: number;
  funcs: number;
  lines: number;
};

export function pct(covered: number, total: number): number {
  return total === 0 ? 100 : (covered / total) * 100;
}

export function toSrcPath(file: string): string {
  return file.includes('/src/') ? file.replace(/.*\/src\//, 'src/') : file;
}

export function isAllowlistedPath(file: string, allowlist: string[]): boolean {
  const srcPath = toSrcPath(file);
  return allowlist.some((pattern) => {
    if (pattern.endsWith('/')) return srcPath.startsWith(pattern);
    return srcPath === pattern || srcPath.endsWith(`/${pattern}`);
  });
}

export function computeCoverageMetrics(cov: CoverageMapData): CoverageMetrics {
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

  return {
    stmts: pct(stmtCovered, stmtTotal),
    branches: pct(branchCovered, branchTotal),
    funcs: pct(fnCovered, fnTotal),
    lines: pct(coveredLines.size, lineSet.size),
  };
}