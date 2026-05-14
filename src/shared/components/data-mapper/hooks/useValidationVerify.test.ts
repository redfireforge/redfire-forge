/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationVerify } from './useValidationVerify';
import type { Assertion } from '../../../types';
import type { Mapping, MapperAdapter } from '../types';

const createMockAdapter = (fields: { jsonPath: string; expectedValue: string; operator?: string; operatorValue?: string }[]): MapperAdapter => ({
  contextId: 'test',
  title: 'Test',
  sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
  target: { label: 'Target', sampleData: '{}' },
  serialize: () => ({ expectedFields: fields }),
  deserialize: () => [],
});

describe('useValidationVerify', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with idle status', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [],
      sampleResponseData: '{}',
      adapter,
      enabled: false,
    }));
    expect(result.current.result.status).toBe('idle');
    expect(result.current.result.passedCount).toBe(0);
    expect(result.current.result.failedCount).toBe(0);
  });

  it('verifies fields pass when data matches', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.name', expectedValue: '"Alice"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'src', targetPath: '$.name' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'Alice' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.passedCount).toBe(1);
    expect(result.current.result.failedCount).toBe(0);
  });

  it('verifies fields fail when data mismatches', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.name', expectedValue: '"Alice"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'src', targetPath: '$.name' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'Bob' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.passedCount).toBe(0);
    expect(result.current.result.failedCount).toBe(1);
    expect(result.current.result.failedMappingIds.has('m1')).toBe(true);
  });

  it('populates fieldResults with actual/expected', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.count', expectedValue: '10', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'count', sourceId: 'src', targetPath: '$.count' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ count: 5 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    const fieldResult = result.current.result.fieldResults.get('$.count');
    expect(fieldResult).toBeDefined();
    expect(fieldResult!.passed).toBe(false);
    expect(fieldResult!.actual).toBeDefined();
  });

  it('evaluates standalone assertions (typeCheck pass)', () => {
    const adapter = createMockAdapter([]);
    const assertions: Assertion[] = [
      { type: 'typeCheck', jsonPath: '$.name', expectedType: 'string' },
    ];
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions,
      sampleResponseData: JSON.stringify({ name: 'hello' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.passedCount).toBe(1);
    expect(result.current.result.assertionResults).toHaveLength(1);
    expect(result.current.result.assertionResults[0].passed).toBe(true);
  });

  it('evaluates standalone assertions (typeCheck fail)', () => {
    const adapter = createMockAdapter([]);
    const assertions: Assertion[] = [
      { type: 'typeCheck', jsonPath: '$.name', expectedType: 'number' },
    ];
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions,
      sampleResponseData: JSON.stringify({ name: 'hello' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.failedCount).toBeGreaterThan(0);
  });

  it('evaluates existence assertion (pass)', () => {
    const adapter = createMockAdapter([]);
    const assertions: Assertion[] = [
      { type: 'existence', jsonPath: '$.data', expectExists: true },
    ];
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions,
      sampleResponseData: JSON.stringify({ data: [1, 2, 3] }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.passedCount).toBe(1);
  });

  it('evaluates existence assertion (fail)', () => {
    const adapter = createMockAdapter([]);
    const assertions: Assertion[] = [
      { type: 'existence', jsonPath: '$.missing', expectExists: true },
    ];
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions,
      sampleResponseData: JSON.stringify({ data: 1 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.failedCount).toBeGreaterThan(0);
  });

  it('handles empty mappings and assertions — stays idle', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [],
      sampleResponseData: '{}',
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('idle');
    expect(result.current.result.passedCount).toBe(0);
    expect(result.current.result.failedCount).toBe(0);
  });

  it('mixed fields: some pass, some fail', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.a', expectedValue: '"yes"', operator: 'equals' },
      { jsonPath: '$.b', expectedValue: '"no"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [
        { id: 'm1', sourcePath: 'a', sourceId: 'src', targetPath: '$.a' },
        { id: 'm2', sourcePath: 'b', sourceId: 'src', targetPath: '$.b' },
      ] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ a: 'yes', b: 'wrong' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.passedCount).toBe(1);
    expect(result.current.result.failedCount).toBe(1);
    expect(result.current.result.failedMappingIds.has('m2')).toBe(true);
    expect(result.current.result.failedMappingIds.has('m1')).toBe(false);
  });

  it('getNodeStatus returns correct status', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"1"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: '1' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.getNodeStatus('$.x')).toBe('pass');
    expect(result.current.getNodeStatus('$.unknown')).toBeUndefined();
  });

  it('nodeStatusMap contains stripped paths', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.name', expectedValue: '"A"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'src', targetPath: '$.name' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'A' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.nodeStatusMap.get('name')).toBe('pass');
    expect(result.current.nodeStatusMap.get('$.name')).toBe('pass');
  });

  it('reset clears results back to idle', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"1"' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: '1' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });
    expect(result.current.result.status).toBe('complete');

    act(() => { result.current.reset(); });
    expect(result.current.result.status).toBe('idle');
    expect(result.current.result.passedCount).toBe(0);
  });

  it('auto-verify triggers after debounce', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"hello"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: 'hello' }),
      adapter,
      enabled: true,
      autoVerify: true,
    }));

    act(() => { vi.advanceTimersByTime(600); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.passedCount).toBe(1);
  });

  it('does not auto-verify when disabled', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"y"' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: 'y' }),
      adapter,
      enabled: false,
      autoVerify: true,
    }));

    // Auto-verify should NOT fire when disabled
    expect(result.current.result.status).toBe('idle');
  });

  it('verifyAll force-runs even when disabled', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"y"' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: 'y' }),
      adapter,
      enabled: false,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
  });

  it('handles null/undefined sample data gracefully', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"a"' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: null,
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.failedCount).toBe(1);
  });

  it('uses greater_than operator correctly', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.count', expectedValue: '5', operator: 'greater_than', operatorValue: '5' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'count', sourceId: 'src', targetPath: '$.count' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ count: 10 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.passedCount).toBe(1);
    expect(result.current.result.failedCount).toBe(0);
  });

  it('handles adapter.serialize throwing an error — stays idle with no assertions', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => { throw new Error('Boom'); },
      deserialize: () => [],
    };
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [],
      sampleResponseData: '{}',
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('idle');
    expect(result.current.result.passedCount).toBe(0);
    expect(result.current.result.failedCount).toBe(0);
  });

  it('handles negate on expected fields', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => ({
        expectedFields: [
          { jsonPath: '$.name', expectedValue: 'Alice', operator: 'equals', negate: true },
        ],
      }),
      deserialize: () => [],
    };
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'name', sourceId: 'src', targetPath: '$.name' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'Alice' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.failedCount).toBe(1);
    const details = result.current.result.fieldResults;
    const entry = details?.get('$.name');
    expect(entry?.expected).toMatch(/^NOT /);
  });

  it('skips assertions when sampleResponseData is null', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [{ type: 'regex', jsonPath: '$.name', pattern: '.*' } as Assertion],
      sampleResponseData: null as unknown as string,
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.skippedCount).toBeGreaterThanOrEqual(1);
  });

  it('skips HTTP-only assertions (status, responseTime, header)', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [
        { type: 'status', expected: '200' } as Assertion,
        { type: 'responseTime', maxMs: 500 } as Assertion,
        { type: 'header', name: 'content-type', operator: 'contains', value: 'json' } as Assertion,
      ],
      sampleResponseData: JSON.stringify({ ok: true }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.skippedCount).toBeGreaterThanOrEqual(3);
  });

  it('parses invalid JSON sample gracefully', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$', expectedValue: 'hello', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: '$', sourceId: 'src', targetPath: '$' }] as Mapping[],
      assertions: [],
      sampleResponseData: 'not valid json',
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
  });

  it('maps assertion failure to failedMappingIds via name fallback', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'ct', sourceId: 'src', targetPath: 'content-type' }] as Mapping[],
      assertions: [
        { type: 'regex', jsonPath: '$.missing', pattern: 'abc' } as Assertion,
      ],
      sampleResponseData: JSON.stringify({ name: 'x' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
  });

  it('failedMappingIds includes mapping whose targetPath matches failed assertion jsonPath', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'map1', sourcePath: 'src.name', sourceId: 'src', targetPath: '$.name' }] as Mapping[],
      assertions: [
        { type: 'regex', jsonPath: '$.name', pattern: '^Z' } as Assertion,
      ],
      sampleResponseData: JSON.stringify({ name: 'Alice' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.failedCount).toBeGreaterThan(0);
    expect(result.current.result.failedMappingIds.has('map1')).toBe(true);
  });

  it('parseSampleData handles already-parsed object (non-string)', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.age', expectedValue: '30', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [],
      sampleResponseData: { age: 30 },
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.passedCount).toBe(1);
  });

  it('getAssertionPath uses name property when jsonPath is absent', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: 'myField' }] as Mapping[],
      assertions: [
        { type: 'regex', name: 'myField', jsonPath: '$.missing', pattern: '^Z' } as unknown as Assertion,
      ],
      sampleResponseData: JSON.stringify({ missing: 'Alice' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.failedCount).toBeGreaterThan(0);
  });

  it('getAssertionPath falls back to assertion.type when no jsonPath or name', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [
        { type: 'typeCheck', jsonPath: '$.x', expectedType: 'string' } as unknown as Assertion,
      ],
      sampleResponseData: JSON.stringify({ x: 123 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
  });

  it('unorderedArrays mode validates fields with unordered comparison', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.items[0]', expectedValue: '"a"', operator: 'equals' },
      { jsonPath: '$.items[1]', expectedValue: '"b"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.items[0]' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ items: ['b', 'a'] }),
      adapter,
      enabled: true,
      unorderedArrays: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.passedCount).toBeGreaterThanOrEqual(1);
  });

  it('unorderedArrays mode marks failed field and maps to failedMappingIds', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.name', expectedValue: '"WRONG"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'mx', sourcePath: 'a', sourceId: 'src', targetPath: '$.name' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'Alice' }),
      adapter,
      enabled: true,
      unorderedArrays: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.failedCount).toBeGreaterThan(0);
    expect(result.current.result.failedMappingIds.has('mx')).toBe(true);
  });
});
