import { describe, it, expect } from 'vitest';
import { compareTraces, formatComparisonValue } from './traceComparison';
import type { MappingTrace } from './mappingTrace';

function makeTrace(overrides: Partial<MappingTrace> & { mappingId: string }): MappingTrace {
  return {
    sourcePath: 'name',
    sourceValue: 'Alice',
    targetPath: 'userName',
    targetValue: 'Alice',
    timestamp: Date.now(),
    durationMs: 1,
    ...overrides,
  };
}

describe('compareTraces', () => {
  it('reports unchanged when values match', () => {
    const baseline = [makeTrace({ mappingId: 'm1', targetValue: 'Alice' })];
    const current = [makeTrace({ mappingId: 'm1', targetValue: 'Alice' })];
    const result = compareTraces(baseline, current);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].status).toBe('unchanged');
    expect(result.summary.unchanged).toBe(1);
  });

  it('reports changed when values differ without error', () => {
    const baseline = [makeTrace({ mappingId: 'm1', targetValue: 'Alice' })];
    const current = [makeTrace({ mappingId: 'm1', targetValue: 'Bob' })];
    const result = compareTraces(baseline, current);
    expect(result.entries[0].status).toBe('changed');
    expect(result.summary.changed).toBe(1);
  });

  it('reports regression when baseline passes but current fails', () => {
    const baseline = [makeTrace({ mappingId: 'm1', targetValue: 'Alice' })];
    const current = [makeTrace({ mappingId: 'm1', targetValue: undefined, error: 'fail' })];
    const result = compareTraces(baseline, current);
    expect(result.entries[0].status).toBe('regression');
    expect(result.summary.regressions).toBe(1);
  });

  it('reports fixed when baseline fails but current passes', () => {
    const baseline = [makeTrace({ mappingId: 'm1', targetValue: undefined, error: 'fail' })];
    const current = [makeTrace({ mappingId: 'm1', targetValue: 'Alice' })];
    const result = compareTraces(baseline, current);
    expect(result.entries[0].status).toBe('fixed');
    expect(result.summary.fixed).toBe(1);
  });

  it('reports added for new mappings', () => {
    const baseline: MappingTrace[] = [];
    const current = [makeTrace({ mappingId: 'm1' })];
    const result = compareTraces(baseline, current);
    expect(result.entries[0].status).toBe('added');
    expect(result.summary.added).toBe(1);
  });

  it('reports removed for deleted mappings', () => {
    const baseline = [makeTrace({ mappingId: 'm1' })];
    const current: MappingTrace[] = [];
    const result = compareTraces(baseline, current);
    expect(result.entries[0].status).toBe('removed');
    expect(result.summary.removed).toBe(1);
  });

  it('handles multiple mappings with mixed statuses', () => {
    const baseline = [
      makeTrace({ mappingId: 'm1', targetValue: 'Alice' }),
      makeTrace({ mappingId: 'm2', targetValue: 'old' }),
      makeTrace({ mappingId: 'm3', targetValue: undefined, error: 'broken' }),
      makeTrace({ mappingId: 'm4', targetValue: 'delete-me' }),
    ];
    const current = [
      makeTrace({ mappingId: 'm1', targetValue: 'Alice' }),
      makeTrace({ mappingId: 'm2', targetValue: 'new' }),
      makeTrace({ mappingId: 'm3', targetValue: 'fixed!' }),
      makeTrace({ mappingId: 'm5', targetValue: 'fresh' }),
    ];
    const result = compareTraces(baseline, current);
    expect(result.summary.total).toBe(5);
    expect(result.summary.unchanged).toBe(1);
    expect(result.summary.changed).toBe(1);
    expect(result.summary.fixed).toBe(1);
    expect(result.summary.removed).toBe(1);
    expect(result.summary.added).toBe(1);
  });

  it('handles null vs undefined as different values', () => {
    const baseline = [makeTrace({ mappingId: 'm1', targetValue: null })];
    const current = [makeTrace({ mappingId: 'm1', targetValue: undefined, error: 'err' })];
    const result = compareTraces(baseline, current);
    expect(result.entries[0].status).toBe('regression');
  });

  it('handles object values correctly', () => {
    const baseline = [makeTrace({ mappingId: 'm1', targetValue: { a: 1 } })];
    const current = [makeTrace({ mappingId: 'm1', targetValue: { a: 1 } })];
    const result = compareTraces(baseline, current);
    expect(result.entries[0].status).toBe('unchanged');
  });

  it('empty baseline and current returns empty results', () => {
    const result = compareTraces([], []);
    expect(result.entries).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });
});

describe('formatComparisonValue', () => {
  it('returns dash for undefined trace', () => {
    expect(formatComparisonValue(undefined)).toBe('—');
  });

  it('formats error trace', () => {
    expect(formatComparisonValue(makeTrace({ mappingId: 'm1', error: 'broken' }))).toContain('broken');
  });

  it('formats string value', () => {
    expect(formatComparisonValue(makeTrace({ mappingId: 'm1', targetValue: 'hello' }))).toBe('hello');
  });

  it('formats null', () => {
    expect(formatComparisonValue(makeTrace({ mappingId: 'm1', targetValue: null }))).toBe('null');
  });

  it('formats undefined target', () => {
    expect(formatComparisonValue(makeTrace({ mappingId: 'm1', targetValue: undefined }))).toBe('undefined');
  });

  it('formats object as JSON', () => {
    expect(formatComparisonValue(makeTrace({ mappingId: 'm1', targetValue: { x: 1 } }))).toBe('{"x":1}');
  });
});
