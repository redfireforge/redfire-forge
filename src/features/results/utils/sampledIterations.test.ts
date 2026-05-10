import { describe, it, expect } from 'vitest';
import { isSampledIteration, filterSampledIterations } from './sampledIterations';
import type { WorkflowIterationTrace } from '../../../shared/types';

function makeIter(overrides?: Partial<WorkflowIterationTrace>): WorkflowIterationTrace {
  return {
    index: 0,
    passed: true,
    durationMs: 100,
    events: [],
    finalVariables: {},
    traversedEdges: [],
    ...overrides,
  };
}

describe('isSampledIteration', () => {
  it('returns true when sampled is undefined', () => {
    expect(isSampledIteration(makeIter())).toBe(true);
  });

  it('returns true when sampled is true', () => {
    expect(isSampledIteration(makeIter({ sampled: true }))).toBe(true);
  });

  it('returns false when sampled is false', () => {
    expect(isSampledIteration(makeIter({ sampled: false }))).toBe(false);
  });
});

describe('filterSampledIterations', () => {
  it('filters out unsampled iterations', () => {
    const iters = [
      makeIter({ index: 0 }),
      makeIter({ index: 1, sampled: false }),
      makeIter({ index: 2, sampled: true }),
    ];
    const result = filterSampledIterations(iters);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.index)).toEqual([0, 2]);
  });

  it('returns all when none are unsampled', () => {
    const iters = [makeIter({ index: 0 }), makeIter({ index: 1 })];
    expect(filterSampledIterations(iters)).toHaveLength(2);
  });

  it('returns empty array when all are unsampled', () => {
    const iters = [makeIter({ sampled: false }), makeIter({ sampled: false })];
    expect(filterSampledIterations(iters)).toHaveLength(0);
  });

  it('handles empty array', () => {
    expect(filterSampledIterations([])).toEqual([]);
  });
});
