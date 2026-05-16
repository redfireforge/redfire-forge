/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationVerify } from './useValidationVerify';
import type { Assertion } from '../../../types';
import type { Mapping, MapperAdapter } from '../types';
import * as mapperExpressionEvaluator from '../utils/mapperExpressionEvaluator';

const createMockAdapter = (fields: { jsonPath: string; expectedValue: string; operator?: string; operatorValue?: string }[]): MapperAdapter => ({
  contextId: 'test',
  title: 'Test',
  sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
  target: { label: 'Target', sampleData: '{}' },
  serialize: () => ({ expectedFields: fields }),
  deserialize: () => [],
});

/**
 * Adapter that always returns one dummy expectedField so `expectedFields.length > 0`,
 * allowing execution to proceed past the "no mapper rules → idle" guard.
 * The dummy field uses `exists` on root `$`, which passes for any non-null sample data.
 */
const createAdapterWithDummyField = (extraFields: { jsonPath: string; expectedValue: string; operator?: string; operatorValue?: string }[] = []): MapperAdapter => ({
  contextId: 'test',
  title: 'Test',
  sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
  target: { label: 'Target', sampleData: '{}' },
  serialize: () => ({ expectedFields: [{ jsonPath: '$', expectedValue: '', operator: 'exists' }, ...extraFields] }),
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

  it('evaluates DSL assertions alongside mapping fields', () => {
    const adapter = createAdapterWithDummyField();
    const assertions: Assertion[] = [
      { type: 'typeCheck', jsonPath: '$.name', expectedType: 'string' },
      { type: 'existence', jsonPath: '$.data', expectExists: true },
    ];
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions,
      sampleResponseData: JSON.stringify({ name: 'hello', data: [1] }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.assertionResults).toHaveLength(2);
    expect(result.current.result.passedCount).toBe(3);
    expect(result.current.result.failedCount).toBe(0);
    expect(result.current.result.skippedCount).toBe(0);
  });

  it('ignores non-DSL assertions (status, responseTime, header)', () => {
    const adapter = createAdapterWithDummyField();
    const assertions: Assertion[] = [
      { type: 'status', expected: '200' },
      { type: 'responseTime', maxMs: 5000 },
    ] as Assertion[];
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions,
      sampleResponseData: JSON.stringify({ count: 5 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.assertionResults).toHaveLength(0);
    expect(result.current.result.passedCount).toBe(1);
  });

  it('assertions-only with 0 mappings still evaluates DSL assertions', () => {
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

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.passedCount).toBe(1);
    expect(result.current.result.failedCount).toBe(0);
    expect(result.current.result.assertionResults).toHaveLength(1);
    expect(result.current.result.assertionResults[0].passed).toBe(true);
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

  it('assertions with null sample data are ignored in mapper verify', () => {
    const adapter = createAdapterWithDummyField();
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [{ type: 'regex', jsonPath: '$.name', pattern: '.*' } as Assertion],
      sampleResponseData: null as unknown as string,
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.assertionResults).toHaveLength(0);
    expect(result.current.result.skippedCount).toBe(0);
  });

  it('HTTP-only assertions are ignored in mapper verify', () => {
    const adapter = createAdapterWithDummyField();
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
    expect(result.current.result.assertionResults).toHaveLength(0);
    expect(result.current.result.skippedCount).toBe(0);
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

  it('assertions do not contribute to failedMappingIds in mapper verify', () => {
    const adapter = createAdapterWithDummyField();
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
    expect(result.current.result.assertionResults).toHaveLength(0);
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

  it('DSL assertion type mismatch is reported as failed', () => {
    const adapter = createAdapterWithDummyField();
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
    expect(result.current.result.assertionResults).toHaveLength(1);
    expect(result.current.result.assertionResults[0].passed).toBe(false);
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

  it('custom DSL assertions are evaluated in mapper verify', () => {
    const adapter = createAdapterWithDummyField();
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: [{ type: 'custom', expression: '$eq($.count, 5)' }] as Assertion[],
      sampleResponseData: JSON.stringify({ count: 5 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.assertionResults).toHaveLength(1);
  });

  it('treats serialized output without expectedFields as no rules', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => ({ other: true }),
      deserialize: () => [],
    };
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: 1 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('idle');
  });

  it('unorderedArrays strips matched-by context from failure actual', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.items[0].x', expectedValue: '"a"', operator: 'equals' },
      { jsonPath: '$.items[0].y', expectedValue: '"b"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'items[0].x', sourceId: 'src', targetPath: '$.items[0].x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ items: [{ x: 'a', y: 'wrong' }] }),
      adapter,
      enabled: true,
      unorderedArrays: true,
    }));

    act(() => { result.current.verifyAll(); });

    const fr = result.current.result.fieldResults.get('$.items[0].y');
    expect(fr?.passed).toBe(false);
    expect(fr?.matchContext).toContain('matched by');
    expect(fr?.actual).not.toContain('matched by');
  });

  it('getNodeStatus resolves bare paths without $. prefix', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.deep.leaf', expectedValue: '"ok"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'leaf', sourceId: 'src', targetPath: '$.deep.leaf' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ deep: { leaf: 'ok' } }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.getNodeStatus('deep.leaf')).toBe('pass');
  });

  it('nodeStatusMap registers status under mapping targetPath when paths differ', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.target.only', expectedValue: '"v"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{
        id: 'mx',
        sourcePath: '$.different.source',
        sourceId: 'src',
        targetPath: '$.target.only',
      }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ target: { only: 'v' } }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.nodeStatusMap.get('target.only')).toBe('pass');
    expect(result.current.nodeStatusMap.get('different.source')).toBeUndefined();
  });

  it('handles adapter without serialize helper — verify stays idle', () => {
    const base = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"1"', operator: 'equals' },
    ]);
    const adapterNoSer = Object.assign({}, base, { serialize: undefined }) as unknown as MapperAdapter;
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: 2 }),
      adapter: adapterNoSer,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('idle');
  });

  it('failed verify does not add mapping id when serializer path lacks a mapper mapping row', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.orphan.only', expectedValue: '"gone"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ orphan: { only: 'nope' } }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.failedMappingIds.has('m1')).toBe(false);
  });

  it('unorderedArrays unmatched rows use failures without matched-by suffix (strip branch)', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.items[0].id', expectedValue: '"missing"', operator: 'equals' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'items[0].id', sourceId: 'src', targetPath: '$.items[0].id' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ items: [] }),
      adapter,
      enabled: true,
      unorderedArrays: true,
    }));

    act(() => { result.current.verifyAll(); });

    const fr = result.current.result.fieldResults.get('$.items[0].id');
    expect(fr?.passed).toBe(false);
    expect(fr?.actual ?? '').not.toContain('matched by');
  });

  it('getNodeStatus is undefined until verify completes', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: 1 }),
      adapter,
      enabled: false,
    }));

    expect(result.current.getNodeStatus('$.x')).toBeUndefined();
    expect(result.current.result.status).toBe('idle');
  });

  it('clears auto-verify debounce on unmount', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"y"', operator: 'equals' },
    ]);
    const { unmount } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: 'y' }),
      adapter,
      enabled: true,
      autoVerify: true,
    }));

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => {
      unmount();
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  // ─── Branch-coverage tests ─────────────────────────────

  it('covers expression evaluation path in non-unordered mode', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => ({
        expectedFields: [{ jsonPath: '$.name', expectedValue: 'ALICE', operator: 'equals' }],
      }),
      deserialize: () => [],
    };
    const mappings: Mapping[] = [{
      id: 'm1',
      sourcePath: 'name',
      sourceId: 'src',
      targetPath: '$.name',
      expression: '$upper($.name)',
    }];
    const { result } = renderHook(() => useValidationVerify({
      mappings,
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'Alice' }),
      adapter,
      enabled: true,
    }));
    act(() => { result.current.verifyAll(); });
    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.fieldResults.get('$.name')).toBeDefined();
  });

  it('expression evaluation with undefined responseBody skips expression path', () => {
    const adapter = createMockAdapter([{ jsonPath: '$.name', expectedValue: 'Alice', operator: 'equals' }]);
    const mappings: Mapping[] = [{
      id: 'm1',
      sourcePath: 'name',
      sourceId: 'src',
      targetPath: '$.name',
      expression: '$upper($.name)',
    }];
    const { result } = renderHook(() => useValidationVerify({
      mappings,
      assertions: [],
      sampleResponseData: undefined,
      adapter,
      enabled: true,
    }));
    act(() => { result.current.verifyAll(); });
    expect(result.current.result.fieldResults.get('$.name')).toBeDefined();
  });

  it('DSL assertions with undefined responseBody produces skippedCount', () => {
    const adapter = createMockAdapter([]);
    const dslAssertions: Assertion[] = [{
      type: 'arrayLength',
      path: '$.items',
      operator: '>=',
      value: '1',
    }];
    const adapterWithField: MapperAdapter = {
      ...adapter,
      serialize: () => ({
        expectedFields: [{ jsonPath: '$', expectedValue: '', operator: 'exists' }],
      }),
    };
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions: dslAssertions,
      sampleResponseData: undefined,
      adapter: adapterWithField,
      enabled: true,
    }));
    act(() => { result.current.verifyAll(); });
    expect(result.current.result.skippedCount).toBe(1);
  });

  it('getNodeStatus returns fail for a failed field', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.name', expectedValue: 'Bob', operator: 'equals' },
    ]);
    const mappings: Mapping[] = [{
      id: 'm1', sourcePath: 'name', sourceId: 'src', targetPath: '$.name',
    }];
    const { result } = renderHook(() => useValidationVerify({
      mappings,
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'Alice' }),
      adapter,
      enabled: true,
    }));
    act(() => { result.current.verifyAll(); });
    expect(result.current.getNodeStatus('$.name')).toBe('fail');
    expect(result.current.getNodeStatus('name')).toBe('fail');
  });

  it('nodeStatusMap registers both prefixed and stripped target paths', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.email', expectedValue: 'a@b.com', operator: 'equals' },
    ]);
    const mappings: Mapping[] = [{
      id: 'm1', sourcePath: 'email', sourceId: 'src', targetPath: 'email',
    }];
    const { result } = renderHook(() => useValidationVerify({
      mappings,
      assertions: [],
      sampleResponseData: JSON.stringify({ email: 'a@b.com' }),
      adapter,
      enabled: true,
    }));
    act(() => { result.current.verifyAll(); });
    expect(result.current.nodeStatusMap.get('email')).toBe('pass');
    expect(result.current.nodeStatusMap.get('$.email')).toBe('pass');
  });

  it('serializer returning output without expectedFields produces empty array', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => ({ someOtherKey: [] }),
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
  });

  it('negate flag on field inverts pass/fail in unordered mode', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => ({
        expectedFields: [{ jsonPath: '$.name', expectedValue: 'Alice', operator: 'equals', negate: true }],
      }),
      deserialize: () => [],
    };
    const mappings: Mapping[] = [{ id: 'm1', sourcePath: 'name', sourceId: 'src', targetPath: '$.name' }];
    const { result } = renderHook(() => useValidationVerify({
      mappings,
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'Alice' }),
      adapter,
      enabled: true,
      unorderedArrays: true,
    }));
    act(() => { result.current.verifyAll(); });
    const fr = result.current.result.fieldResults.get('$.name');
    expect(fr).toBeDefined();
    expect(fr!.expected).toMatch(/^NOT /);
  });

  it('debounce timer is not set when auto-verify cleanup runs', () => {
    const adapter = createMockAdapter([{ jsonPath: '$.x', expectedValue: 'a', operator: 'equals' }]);
    const { result, unmount } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ x: 'a' }),
      adapter,
      enabled: true,
      autoVerify: true,
    }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.result.status).toBe('complete');
    unmount();
  });

  it('keeps rules on array/object paths when operator is container-allowed', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.items', expectedValue: '', operator: 'is_not_empty' },
    ]);
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'items', sourceId: 'src', targetPath: '$.items' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ items: [1, 2] }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.status).toBe('complete');
    expect(result.current.result.fieldResults.get('$.items')?.passed).toBe(true);
    expect(result.current.result.failedCount).toBe(0);
  });

  it('filters out equals rules on container paths while retaining non-container rules', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => ({
        expectedFields: [
          { jsonPath: '$', expectedValue: '', operator: 'exists' },
          { jsonPath: '$.items', expectedValue: '"nope"', operator: 'equals' },
        ],
      }),
      deserialize: () => [],
    };
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'items', sourceId: 'src', targetPath: '$.items' }] as Mapping[],
      assertions: [],
      sampleResponseData: JSON.stringify({ items: [9] }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.fieldResults.has('$.items')).toBe(false);
    expect(result.current.result.passedCount).toBe(1);
    expect(result.current.result.failedCount).toBe(0);
  });

  it('does not adopt expression value when preview string looks like an unresolved {{ }} placeholder', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => ({
        expectedFields: [{ jsonPath: '$.name', expectedValue: 'Alice', operator: 'equals' }],
      }),
      deserialize: () => [],
    };
    const mappings: Mapping[] = [{
      id: 'm1',
      sourcePath: 'name',
      sourceId: 'src',
      targetPath: '$.name',
      expression: '$bogusFn',
    }];
    const { result } = renderHook(() => useValidationVerify({
      mappings,
      assertions: [],
      sampleResponseData: JSON.stringify({ name: 'Alice' }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    const fr = result.current.result.fieldResults.get('$.name');
    expect(fr?.passed).toBe(true);
    expect(String(fr?.actual)).toContain('Alice');
    expect(String(fr?.actual)).not.toMatch(/^\{\{/);
  });

  it('falls back to JSON path value when mapper expression evaluation returns an error', () => {
    const spy = vi.spyOn(mapperExpressionEvaluator, 'evaluateMapperExpression').mockReturnValueOnce({
      value: undefined,
      preview: '',
      error: 'Synthetic evaluation failure',
    });
    const adapter = createMockAdapter([
      { jsonPath: '$.name', expectedValue: 'Alice', operator: 'equals' },
    ]);
    const mappings: Mapping[] = [{
      id: 'm1',
      sourcePath: 'name',
      sourceId: 'src',
      targetPath: '$.name',
      expression: '$anyExpression()',
    }];
    try {
      const { result } = renderHook(() => useValidationVerify({
        mappings,
        assertions: [],
        sampleResponseData: JSON.stringify({ name: 'Alice' }),
        adapter,
        enabled: true,
      }));

      act(() => { result.current.verifyAll(); });

      const fr = result.current.result.fieldResults.get('$.name');
      expect(fr?.passed).toBe(true);
      expect(String(fr?.actual)).toContain('Alice');
    } finally {
      spy.mockRestore();
    }
  });

  it('mergedFieldResults and nodeStatusMap prefer failing DSL assertions over passing field rules on the same path', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.id', expectedValue: '42', operator: 'equals' },
    ]);
    const assertions: Assertion[] = [
      { type: 'typeCheck', jsonPath: '$.id', expectedType: 'string' },
    ];
    const { result } = renderHook(() => useValidationVerify({
      mappings: [{ id: 'm1', sourcePath: 'id', sourceId: 'src', targetPath: '$.id' }] as Mapping[],
      assertions,
      sampleResponseData: JSON.stringify({ id: 42 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.fieldResults.get('$.id')?.passed).toBe(true);
    expect(result.current.result.assertionResults[0].passed).toBe(false);
    expect(result.current.mergedFieldResults.get('$.id')?.passed).toBe(false);
    expect(result.current.nodeStatusMap.get('$.id')).toBe('fail');
    expect(result.current.nodeStatusMap.get('id')).toBe('fail');
  });

  it('resets to idle when hook becomes disabled after a completed verify', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"ok"', operator: 'equals' },
    ]);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useValidationVerify({
        mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
        assertions: [],
        sampleResponseData: JSON.stringify({ x: 'ok' }),
        adapter,
        enabled,
      }),
      { initialProps: { enabled: true } },
    );

    act(() => { result.current.verifyAll(); });
    expect(result.current.result.status).toBe('complete');

    rerender({ enabled: false });
    expect(result.current.result.status).toBe('idle');
    expect(result.current.result.passedCount).toBe(0);
  });

  it('handles serialize output with expectedFields key explicitly undefined', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => ({ expectedFields: undefined }),
      deserialize: () => [],
    };
    const assertions: Assertion[] = [
      { type: 'existence', jsonPath: '$.z', expectExists: true },
    ];
    const { result } = renderHook(() => useValidationVerify({
      mappings: [],
      assertions,
      sampleResponseData: JSON.stringify({ z: 1 }),
      adapter,
      enabled: true,
    }));

    act(() => { result.current.verifyAll(); });

    expect(result.current.result.assertionResults).toHaveLength(1);
    expect(result.current.result.assertionResults[0].passed).toBe(true);
  });

  it('non-object serialize result leaves expectedFields empty', () => {
    const adapter: MapperAdapter = {
      contextId: 'test',
      title: 'Test',
      sources: [{ id: 'src', label: 'Source', sampleData: '{}' }],
      target: { label: 'Target', sampleData: '{}' },
      serialize: () => null as unknown as Record<string, never>,
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
  });

  it('auto-verify clears pending timer when deps change so only the latest sample is verified', () => {
    const adapter = createMockAdapter([
      { jsonPath: '$.x', expectedValue: '"a"', operator: 'equals' },
    ]);
    const { result, rerender } = renderHook(
      ({ x }: { x: string }) => useValidationVerify({
        mappings: [{ id: 'm1', sourcePath: 'x', sourceId: 'src', targetPath: '$.x' }] as Mapping[],
        assertions: [],
        sampleResponseData: JSON.stringify({ x }),
        adapter,
        enabled: true,
        autoVerify: true,
      }),
      { initialProps: { x: 'a' } },
    );

    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.result.passedCount).toBe(1);
    expect(result.current.result.failedCount).toBe(0);

    rerender({ x: 'b' });
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.result.failedCount).toBe(1);
  });
});

