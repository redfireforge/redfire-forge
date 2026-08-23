import type { Scenario, ScenarioKind } from '@shared/types';

export interface AllocationResult {
  testId: string;
  testName: string;
  iterations: number;
  /** 0 for standard tests, N for parameterized (enabled rows) */
  rowCount: number;
  /** iterations × max(rowCount, 1) */
  totalRequests: number;
}

export interface AllocationSummary {
  items: AllocationResult[];
  totalRequests: number;
  kind: ScenarioKind;
}

function countEnabledRows(scenario: Scenario): number {
  const ds = scenario.dataSource;
  if (!ds || ds.rows.length === 0) return 0;
  return ds.rows.filter((r) => r.enabled !== false).length;
}

export function computeAllocation(
  tests: Scenario[],
  iterations: number,
  kind: ScenarioKind,
): AllocationSummary {
  if (iterations <= 0 || tests.length === 0) {
    return { items: [], totalRequests: 0, kind };
  }

  const items: AllocationResult[] = tests.map((test) => {
    const rowCount = kind === 'parameterized' ? countEnabledRows(test) : 0;
    const totalRequests = iterations * Math.max(rowCount, 1);

    return {
      testId: test.id,
      testName: test.name,
      iterations,
      rowCount,
      totalRequests,
    };
  });

  const totalRequests = items.reduce((sum, item) => sum + item.totalRequests, 0);

  return { items, totalRequests, kind };
}
