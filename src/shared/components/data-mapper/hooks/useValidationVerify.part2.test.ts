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
const _createAdapterWithDummyField = (extraFields: { jsonPath: string; expectedValue: string; operator?: string; operatorValue?: string }[] = []): MapperAdapter => ({
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

