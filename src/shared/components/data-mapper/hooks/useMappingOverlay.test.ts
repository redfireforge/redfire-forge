/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Mapping, MapperSource } from '../types';
import * as mapperExpressionEvaluator from '../utils/mapperExpressionEvaluator';
import { useMappingOverlay } from './useMappingOverlay';

const baseSources: MapperSource[] = [
  {
    id: 'src1',
    label: 'Source',
    sampleData: {
      name: 'test',
      age: 25,
      nested: { x: 1 },
      nulled: null,
    },
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMappingOverlay', () => {
  it('returns undefined when mappings is empty', () => {
    const { result } = renderHook(() => useMappingOverlay([], 'src1', baseSources));
    expect(result.current).toBeUndefined();
  });

  it('resolves direct path (no expression) from source sample data', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 'src1', targetPath: 'out.name' },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.name')).toEqual({ value: 'test', isError: false });
  });

  it('evaluates expression mapping (sample uses $.age * 2; engine resolves $.age — infix * is not evaluated)', () => {
    const mappings: Mapping[] = [
      {
        id: 'm2',
        sourcePath: 'age',
        sourceId: 'src1',
        targetPath: 'out.age',
        expression: '$.age * 2',
      },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.age')).toEqual({ value: '25', isError: false });
  });

  it('returns isError with message when evaluateMapperExpression sets result.error', () => {
    vi.spyOn(mapperExpressionEvaluator, 'evaluateMapperExpression').mockReturnValueOnce({
      value: undefined,
      preview: '',
      error: 'Unknown function: $bad',
    });
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourcePath: 'name',
        sourceId: 'src1',
        targetPath: 'out.bad',
        expression: '$bad($.name)',
      },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.bad')).toEqual({
      value: 'Unknown function: $bad',
      isError: true,
    });
  });

  it('skips mappings with missing targetPath', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 'src1', targetPath: '' },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current).toBeUndefined();
  });

  it('marks isError when resolved direct value is undefined', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'missing', sourceId: 'src1', targetPath: 'out.missing' },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.missing')).toEqual({ value: 'undefined', isError: true });
  });

  it('marks isError when expression succeeds but value is undefined', () => {
    vi.spyOn(mapperExpressionEvaluator, 'evaluateMapperExpression').mockReturnValueOnce({
      value: undefined,
      preview: '',
    });
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourcePath: 'age',
        sourceId: 'src1',
        targetPath: 'out.expr',
        expression: '$identity($.age)',
      },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.expr')).toEqual({ value: 'undefined', isError: true });
  });

  it('catches exceptions during evaluation and surfaces the message', () => {
    vi.spyOn(mapperExpressionEvaluator, 'evaluateMapperExpression').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourcePath: 'name',
        sourceId: 'src1',
        targetPath: 'out.err',
        expression: '$crash()',
      },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.err')).toEqual({ value: 'boom', isError: true });
  });

  it('uses "Evaluation failed" when a non-Error is thrown', () => {
    vi.spyOn(mapperExpressionEvaluator, 'evaluateMapperExpression').mockImplementationOnce(() => {
      throw 'not an error';
    });
    const mappings: Mapping[] = [
      {
        id: 'm1',
        sourcePath: 'name',
        sourceId: 'src1',
        targetPath: 'out.err2',
        expression: 'x',
      },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.err2')).toEqual({ value: 'Evaluation failed', isError: true });
  });

  it('catches exceptions from direct path resolution', () => {
    vi.spyOn(mapperExpressionEvaluator, 'resolveMapperPath').mockImplementationOnce(() => {
      throw new Error('path boom');
    });
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 'src1', targetPath: 'out.direct' },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.direct')).toEqual({ value: 'path boom', isError: true });
  });

  describe('toDisplay helper branches', () => {
    it('formats null as "null"', () => {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'nulled', sourceId: 'src1', targetPath: 'out.null' },
      ];
      const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
      expect(result.current?.get('out.null')).toEqual({ value: 'null', isError: false });
    });

    it('formats numbers with JSON.stringify', () => {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'age', sourceId: 'src1', targetPath: 'out.num' },
      ];
      const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
      expect(result.current?.get('out.num')).toEqual({ value: '25', isError: false });
    });

    it('formats objects with JSON.stringify', () => {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'nested', sourceId: 'src1', targetPath: 'out.obj' },
      ];
      const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
      expect(result.current?.get('out.obj')).toEqual({ value: '{"x":1}', isError: false });
    });

    it('leaves strings as-is', () => {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'name', sourceId: 'src1', targetPath: 'out.str' },
      ];
      const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
      expect(result.current?.get('out.str')).toEqual({ value: 'test', isError: false });
    });

    it('formats undefined as "undefined" with isError for missing path', () => {
      const mappings: Mapping[] = [
        { id: 'm1', sourcePath: 'nope', sourceId: 'src1', targetPath: 'out.u' },
      ];
      const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
      expect(result.current?.get('out.u')).toEqual({ value: 'undefined', isError: true });
    });

    it('falls back to String(value) when JSON.stringify throws', () => {
      vi.spyOn(mapperExpressionEvaluator, 'evaluateMapperExpression').mockReturnValueOnce({
        value: BigInt(1),
        preview: '1',
      });
      const mappings: Mapping[] = [
        {
          id: 'm1',
          sourcePath: 'age',
          sourceId: 'src1',
          targetPath: 'out.bigint',
          expression: '1',
        },
      ];
      const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
      expect(result.current?.get('out.bigint')).toEqual({ value: '1', isError: false });
    });
  });

  it('returns undefined when every mapping is skipped (empty overlay)', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: 'src1', targetPath: '' },
      { id: 'm2', sourcePath: 'age', sourceId: 'src1', targetPath: '' },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current).toBeUndefined();
  });

  it('uses activeSourceId when mapping.sourceId is empty', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: 'name', sourceId: '', targetPath: 'out.fallback' },
    ];
    const { result } = renderHook(() => useMappingOverlay(mappings, 'src1', baseSources));
    expect(result.current?.get('out.fallback')).toEqual({ value: 'test', isError: false });
  });
});
