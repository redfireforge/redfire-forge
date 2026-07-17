import { describe, expect, it } from 'vitest';
import { computeCoverageMetrics, isAllowlistedPath, toSrcPath } from '../../../scripts/coverageGateUtils';

describe('coverageGateUtils', () => {
  it('normalizes absolute src path to workspace-relative src path', () => {
    expect(toSrcPath('/tmp/work/redfire/src/features/demo.ts')).toBe('src/features/demo.ts');
    expect(toSrcPath('src/features/demo.ts')).toBe('src/features/demo.ts');
  });

  it('matches both prefix and exact allowlist patterns', () => {
    const allowlist = ['src/features/grpc/', 'src/shared/utils/helpers.ts'];

    expect(isAllowlistedPath('/repo/src/features/grpc/panel.tsx', allowlist)).toBe(true);
    expect(isAllowlistedPath('/repo/src/shared/utils/helpers.ts', allowlist)).toBe(true);
    expect(isAllowlistedPath('/repo/src/shared/utils/other.ts', allowlist)).toBe(false);
  });

  it('computes per-metric coverage percentages correctly', () => {
    const cov = {
      path: '/repo/src/demo.ts',
      statementMap: {
        '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
        '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 1 } },
      },
      fnMap: {},
      branchMap: {},
      s: { '0': 1, '1': 0 },
      f: { '0': 1, '1': 0 },
      b: { '0': [1, 0] },
      _coverageSchema: '',
      hash: '',
    };

    const metrics = computeCoverageMetrics(cov);
    expect(metrics.stmts).toBe(50);
    expect(metrics.funcs).toBe(50);
    expect(metrics.branches).toBe(50);
    expect(metrics.lines).toBe(50);
  });
});
