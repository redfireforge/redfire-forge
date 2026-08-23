import { describe, it, expect } from 'vitest';
import { getIterationByIndex, buildIterationIndexMap, getSortedIterationIndices } from './iterationLookup';
import type { WorkflowExecutionTrace, WorkflowIterationTrace } from '@shared/types';

function makeTrace(iterations: WorkflowIterationTrace[]): WorkflowExecutionTrace {
  return {
    iterations,
    traversedEdges: [],
    workflowSnapshot: { nodes: [], edges: [] },
    workflowId: 'w1',
    workflowName: 'Test',
    totalIterations: iterations.length,
    totalDurationMs: 100,
  };
}

function makeIter(index: number, passed = true): WorkflowIterationTrace {
  return {
    index,
    passed,
    durationMs: 50 + index * 10,
    events: [],
    finalVariables: {},
    traversedEdges: [],
  };
}

describe('getIterationByIndex', () => {
  it('finds iteration by logical index', () => {
    const trace = makeTrace([makeIter(0), makeIter(1), makeIter(2)]);
    const found = getIterationByIndex(trace, 1);
    expect(found).toBeDefined();
    expect(found!.index).toBe(1);
  });

  it('finds iteration when array order differs from index order (concurrent completion)', () => {
    const trace = makeTrace([makeIter(2), makeIter(0), makeIter(1)]);
    expect(getIterationByIndex(trace, 0)!.index).toBe(0);
    expect(getIterationByIndex(trace, 1)!.index).toBe(1);
    expect(getIterationByIndex(trace, 2)!.index).toBe(2);
  });

  it('returns undefined for non-existent index', () => {
    const trace = makeTrace([makeIter(0), makeIter(1)]);
    expect(getIterationByIndex(trace, 5)).toBeUndefined();
  });

  it('returns undefined for empty iterations', () => {
    const trace = makeTrace([]);
    expect(getIterationByIndex(trace, 0)).toBeUndefined();
  });

  it('handles negative index gracefully', () => {
    const trace = makeTrace([makeIter(0)]);
    expect(getIterationByIndex(trace, -1)).toBeUndefined();
  });
});

describe('buildIterationIndexMap', () => {
  it('builds correct map for in-order iterations', () => {
    const trace = makeTrace([makeIter(0), makeIter(1), makeIter(2)]);
    const map = buildIterationIndexMap(trace);
    expect(map.get(0)).toBe(0);
    expect(map.get(1)).toBe(1);
    expect(map.get(2)).toBe(2);
  });

  it('maps logical index to array position for out-of-order iterations', () => {
    const trace = makeTrace([makeIter(2), makeIter(0), makeIter(1)]);
    const map = buildIterationIndexMap(trace);
    expect(map.get(0)).toBe(1);
    expect(map.get(1)).toBe(2);
    expect(map.get(2)).toBe(0);
  });

  it('returns empty map for empty iterations', () => {
    const trace = makeTrace([]);
    const map = buildIterationIndexMap(trace);
    expect(map.size).toBe(0);
  });
});

describe('getSortedIterationIndices', () => {
  it('returns indices in sorted order', () => {
    const trace = makeTrace([makeIter(2), makeIter(0), makeIter(1)]);
    expect(getSortedIterationIndices(trace)).toEqual([0, 1, 2]);
  });

  it('returns empty array for empty iterations', () => {
    const trace = makeTrace([]);
    expect(getSortedIterationIndices(trace)).toEqual([]);
  });

  it('handles single iteration', () => {
    const trace = makeTrace([makeIter(5)]);
    expect(getSortedIterationIndices(trace)).toEqual([5]);
  });

  it('handles gaps in indices', () => {
    const trace = makeTrace([makeIter(10), makeIter(3), makeIter(7)]);
    expect(getSortedIterationIndices(trace)).toEqual([3, 7, 10]);
  });
});
