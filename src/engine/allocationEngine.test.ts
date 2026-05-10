import { describe, it, expect } from 'vitest';
import { computeAllocation } from './allocationEngine';
import type { Scenario, DataSource } from '../shared/types';

function makeTest(id: string, name: string, overrides: Partial<Scenario> = {}): Scenario {
  return {
    id,
    name,
    url: '/api',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  } as Scenario;
}

function makeDataSource(rowCount: number, disabledCount = 0): DataSource {
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    id: `r${i}`,
    values: { c1: `val${i}` },
    enabled: i >= disabledCount,
  }));
  return {
    id: 'ds1',
    columns: [{ id: 'c1', name: 'col1', type: 'param' as const, mapping: 'q' }],
    rows,
    source: { type: 'inline' as const },
  };
}

describe('computeAllocation', () => {
  describe('standard kind', () => {
    it('allocates iterations × tests for standard tests', () => {
      const tests = [makeTest('t1', 'A'), makeTest('t2', 'B'), makeTest('t3', 'C')];
      const result = computeAllocation(tests, 5, 'standard');

      expect(result.kind).toBe('standard');
      expect(result.items).toHaveLength(3);
      expect(result.totalRequests).toBe(15); // 5 × 3

      for (const item of result.items) {
        expect(item.iterations).toBe(5);
        expect(item.rowCount).toBe(0);
        expect(item.totalRequests).toBe(5);
      }
    });

    it('returns 0 for zero iterations', () => {
      const tests = [makeTest('t1', 'A')];
      const result = computeAllocation(tests, 0, 'standard');

      expect(result.items).toHaveLength(0);
      expect(result.totalRequests).toBe(0);
    });

    it('returns 0 for empty test list', () => {
      const result = computeAllocation([], 10, 'standard');

      expect(result.items).toHaveLength(0);
      expect(result.totalRequests).toBe(0);
    });

    it('ignores data sources when kind is standard', () => {
      const tests = [makeTest('t1', 'A', { dataSource: makeDataSource(10) })];
      const result = computeAllocation(tests, 3, 'standard');

      expect(result.items[0].rowCount).toBe(0);
      expect(result.items[0].totalRequests).toBe(3);
      expect(result.totalRequests).toBe(3);
    });

    it('single test with iterations=1 produces 1 request', () => {
      const tests = [makeTest('t1', 'A')];
      const result = computeAllocation(tests, 1, 'standard');

      expect(result.totalRequests).toBe(1);
    });
  });

  describe('parameterized kind', () => {
    it('allocates iterations × rows for parameterized tests', () => {
      const tests = [makeTest('t1', 'A', { dataSource: makeDataSource(10) })];
      const result = computeAllocation(tests, 5, 'parameterized');

      expect(result.kind).toBe('parameterized');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].iterations).toBe(5);
      expect(result.items[0].rowCount).toBe(10);
      expect(result.items[0].totalRequests).toBe(50); // 5 × 10
      expect(result.totalRequests).toBe(50);
    });

    it('handles multiple parameterized tests', () => {
      const tests = [
        makeTest('t1', 'A', { dataSource: makeDataSource(5) }),
        makeTest('t2', 'B', { dataSource: makeDataSource(8) }),
      ];
      const result = computeAllocation(tests, 3, 'parameterized');

      expect(result.items[0].totalRequests).toBe(15); // 3 × 5
      expect(result.items[1].totalRequests).toBe(24); // 3 × 8
      expect(result.totalRequests).toBe(39);
    });

    it('only counts enabled rows', () => {
      const tests = [makeTest('t1', 'A', { dataSource: makeDataSource(10, 3) })];
      const result = computeAllocation(tests, 2, 'parameterized');

      expect(result.items[0].rowCount).toBe(7); // 10 - 3 disabled
      expect(result.items[0].totalRequests).toBe(14); // 2 × 7
    });

    it('treats parameterized test with no data source as 1 request per iteration', () => {
      const tests = [makeTest('t1', 'A')];
      const result = computeAllocation(tests, 3, 'parameterized');

      expect(result.items[0].rowCount).toBe(0);
      expect(result.items[0].totalRequests).toBe(3); // iterations × max(0, 1) = 3
    });

    it('handles empty data source (0 rows)', () => {
      const tests = [makeTest('t1', 'A', { dataSource: makeDataSource(0) })];
      const result = computeAllocation(tests, 5, 'parameterized');

      expect(result.items[0].rowCount).toBe(0);
      expect(result.items[0].totalRequests).toBe(5); // fallback to 1
    });

    it('handles all rows disabled', () => {
      const tests = [makeTest('t1', 'A', { dataSource: makeDataSource(5, 5) })];
      const result = computeAllocation(tests, 3, 'parameterized');

      expect(result.items[0].rowCount).toBe(0);
      expect(result.items[0].totalRequests).toBe(3); // fallback to 1
    });
  });

  describe('edge cases', () => {
    it('preserves test ids and names in results', () => {
      const tests = [makeTest('abc-123', 'My Test')];
      const result = computeAllocation(tests, 1, 'standard');

      expect(result.items[0].testId).toBe('abc-123');
      expect(result.items[0].testName).toBe('My Test');
    });

    it('negative iterations produces empty allocation', () => {
      const tests = [makeTest('t1', 'A')];
      const result = computeAllocation(tests, -1, 'standard');

      expect(result.items).toHaveLength(0);
      expect(result.totalRequests).toBe(0);
    });

    it('large iteration count works correctly', () => {
      const tests = [makeTest('t1', 'A')];
      const result = computeAllocation(tests, 100000, 'standard');

      expect(result.totalRequests).toBe(100000);
    });
  });
});
