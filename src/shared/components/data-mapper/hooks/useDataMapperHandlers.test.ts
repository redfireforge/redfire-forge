/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataMapperHandlers } from './useDataMapperHandlers';
import type { Mapping } from '../types';

function makeDeps(overrides: Partial<Parameters<typeof useDataMapperHandlers>[0]> = {}) {
  return {
    mappings: [] as Mapping[],
    activeSourceId: 'src1',
    clearAll: vi.fn(),
    selectMapping: vi.fn(),
    updateMapping: vi.fn(),
    setMappings: vi.fn(),
    setSelectedIds: vi.fn(),
    setSelectedSourcePaths: vi.fn(),
    setBulkSourcePath: vi.fn(),
    setBulkSourceId: vi.fn(),
    setBulkTargetPath: vi.fn(),
    setPropagationPreview: vi.fn(),
    setLineFocusNode: vi.fn(),
    setEditingMappingId: vi.fn(),
    setTargetResetSignal: vi.fn((fn: (value: number | null) => number | null) => fn(null)),
    setToast: vi.fn(),
    resetDraggedSource: vi.fn(),
    ...overrides,
  };
}

describe('useDataMapperHandlers', () => {
  it('handleClearAllMappings resets UI state and bumps reset signal from null', () => {
    const deps = makeDeps({
      setTargetResetSignal: vi.fn((fn: (value: number | null) => number | null) => fn(null)),
    });
    const { result } = renderHook(() => useDataMapperHandlers(deps));

    act(() => {
      result.current.handleClearAllMappings();
    });

    expect(deps.clearAll).toHaveBeenCalled();
    expect(deps.selectMapping).toHaveBeenCalledWith(null);
    expect(deps.setSelectedIds).toHaveBeenCalledWith(expect.any(Set));
    expect(deps.setToast).toHaveBeenCalledWith('Cleared all mappings');
    expect(deps.setTargetResetSignal).toHaveBeenCalled();
    const updater = vi.mocked(deps.setTargetResetSignal).mock.calls[0][0] as (v: number | null) => number;
    expect(updater(5)).toBe(6);
    expect(updater(null)).toBe(1);
  });

  it('handleSaveExpression updates mapping and clears editing id', () => {
    const updateMapping = vi.fn();
    const setEditingMappingId = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ updateMapping, setEditingMappingId })),
    );

    act(() => {
      result.current.handleSaveExpression('m1', '$trim($.x)');
    });

    expect(updateMapping).toHaveBeenCalledWith('m1', { expression: '$trim($.x)' });
    expect(setEditingMappingId).toHaveBeenCalledWith(null);
  });

  it('handleQuickFix applies suggested expression', () => {
    const updateMapping = vi.fn();
    const { result } = renderHook(() => useDataMapperHandlers(makeDeps({ updateMapping })));

    act(() => {
      result.current.handleQuickFix('m1', '$upper($.name)');
    });

    expect(updateMapping).toHaveBeenCalledWith('m1', { expression: '$upper($.name)' });
  });

  it('handleApplySuggestion updates mapping and shows toast', () => {
    const updateMapping = vi.fn();
    const setToast = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ updateMapping, setToast })),
    );

    act(() => {
      result.current.handleApplySuggestion('m2', '$eq(1,1)');
    });

    expect(updateMapping).toHaveBeenCalledWith('m2', { expression: '$eq(1,1)' });
    expect(setToast).toHaveBeenCalledWith('Expression applied');
  });

  it('handleUpdateMappingOperator patches operator fields', () => {
    const updateMapping = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ updateMapping })),
    );

    act(() => {
      result.current.handleUpdateMappingOperator('m3', 'contains', 'foo');
    });

    expect(updateMapping).toHaveBeenCalledWith('m3', { operator: 'contains', operatorValue: 'foo' });
  });

  it('handleToggleMappingNegate turns negate on when absent', () => {
    const updateMapping = vi.fn();
    const mappings: Mapping[] = [
      { id: 'x', sourcePath: 'a', sourceId: 's', targetPath: 'b', negate: undefined },
    ];
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ mappings, updateMapping })),
    );

    act(() => {
      result.current.handleToggleMappingNegate('x');
    });

    expect(updateMapping).toHaveBeenCalledWith('x', { negate: true });
  });

  it('handleToggleMappingNegate clears negate when already true', () => {
    const updateMapping = vi.fn();
    const mappings: Mapping[] = [
      { id: 'x', sourcePath: 'a', sourceId: 's', targetPath: 'b', negate: true },
    ];
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ mappings, updateMapping })),
    );

    act(() => {
      result.current.handleToggleMappingNegate('x');
    });

    expect(updateMapping).toHaveBeenCalledWith('x', { negate: undefined });
  });

  it('handleToggleMappingNegate enables negate when mapping id is missing', () => {
    const updateMapping = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ mappings: [], updateMapping })),
    );

    act(() => {
      result.current.handleToggleMappingNegate('missing');
    });

    expect(updateMapping).toHaveBeenCalledWith('missing', { negate: true });
  });

  it('handleExampleInferenceApply dedupes targets already mapped', () => {
    const setToast = vi.fn();
    const mappings: Mapping[] = [
      { id: 'm1', sourcePath: '$.a', sourceId: 'src1', targetPath: '$.a' },
    ];
    const { result } = renderHook(() =>
      useDataMapperHandlers(
        makeDeps({
          mappings,
          activeSourceId: 'src1',
          setMappings: vi.fn(),
          setToast,
        }),
      ),
    );

    act(() => {
      result.current.handleExampleInferenceApply([
        { sourcePath: 'src', targetPath: '$.a', expression: '$x' },
      ]);
    });

    expect(setToast).toHaveBeenCalledWith('No new mappings — all targets already mapped');
  });

  it('handleExampleInferenceApply appends inferred mappings with plural toast', () => {
    const setMappings = vi.fn();
    const setToast = vi.fn();
    const mappings: Mapping[] = [];
    const { result } = renderHook(() =>
      useDataMapperHandlers(
        makeDeps({
          mappings,
          activeSourceId: 'src1',
          setMappings,
          setToast,
        }),
      ),
    );

    act(() => {
      result.current.handleExampleInferenceApply([
        { sourcePath: 'x', targetPath: 'a' },
        { sourcePath: 'y', targetPath: 'b' },
      ]);
    });

    expect(setMappings).toHaveBeenCalled();
    const merged = vi.mocked(setMappings).mock.calls[0][0] as Mapping[];
    expect(merged).toHaveLength(2);
    expect(setToast).toHaveBeenCalledWith('2 mappings inferred from examples');
  });

  it('handleExampleInferenceApply uses singular toast for one mapping', () => {
    const setMappings = vi.fn();
    const setToast = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperHandlers(
        makeDeps({
          mappings: [],
          activeSourceId: 'src1',
          setMappings,
          setToast,
        }),
      ),
    );

    act(() => {
      result.current.handleExampleInferenceApply([{ sourcePath: 'x', targetPath: 'only.one' }]);
    });

    expect(setToast).toHaveBeenCalledWith('1 mapping inferred from examples');
  });

  it('handleToggleSelectMapping adds and removes ids', () => {
    const setSelectedIds = vi.fn((fn: (p: Set<string>) => Set<string>) => fn(new Set(['a'])));
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ setSelectedIds })),
    );

    act(() => {
      result.current.handleToggleSelectMapping('b');
    });

    expect(setSelectedIds).toHaveBeenCalled();
    const updater = vi.mocked(setSelectedIds).mock.calls[0][0] as (p: Set<string>) => Set<string>;
    let next = updater(new Set(['a']));
    expect(next.has('b')).toBe(true);
    next = updater(new Set(['a', 'b']));
    expect(next.has('b')).toBe(false);
  });

  it('handleToggleSourcePath adds and removes paths', () => {
    const setSelectedSourcePaths = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ setSelectedSourcePaths })),
    );

    act(() => {
      result.current.handleToggleSourcePath('p1');
    });

    const updater = vi.mocked(setSelectedSourcePaths).mock.calls[0][0] as (p: Set<string>) => Set<string>;
    expect(updater(new Set()).has('p1')).toBe(true);
    expect(updater(new Set(['p1'])).has('p1')).toBe(false);
  });

  it('handleEditExpression sets editing mapping id', () => {
    const setEditingMappingId = vi.fn();
    const { result } = renderHook(() =>
      useDataMapperHandlers(makeDeps({ setEditingMappingId })),
    );

    act(() => {
      result.current.handleEditExpression('mid');
    });

    expect(setEditingMappingId).toHaveBeenCalledWith('mid');
  });
});
