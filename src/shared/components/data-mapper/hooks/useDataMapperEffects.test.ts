/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataMapperEffects } from './useDataMapperEffects';
import type { Mapping } from '../types';
import type { MapperAdapter } from '../types';
import type { PatternPropagationPreview } from '../utils/patternPropagation';
import { savePattern } from '../utils/mappingPatterns';

vi.mock('../utils/mappingPatterns', () => ({
  savePattern: vi.fn(),
}));

function createAdapter(partial: Partial<MapperAdapter> = {}): MapperAdapter {
  return {
    label: 'adapter',
    contextId: 'ctx',
    sources: [{ id: 'src1', label: 'S', sampleData: '{}' }],
    target: { label: 'T', sampleData: '{}' },
    serialize: vi.fn(),
    deserialize: vi.fn(),
    ...partial,
  } as MapperAdapter;
}

function makeDeps(overrides: Partial<Parameters<typeof useDataMapperEffects>[0]> = {}) {
  const previousMappingCountRef = { current: 0 };
  return {
    adapter: createAdapter(),
    mappings: [] as Mapping[],
    activeSourceId: 'src1',
    getEffectiveSourceData: vi.fn().mockReturnValue({ ok: true }),
    effectiveTarget: { label: 'T', sampleData: '{}' },
    setSourceSample: vi.fn(),
    setSelectedSourcePaths: vi.fn(),
    setSelectedIds: vi.fn(),
    setBulkSourcePath: vi.fn(),
    setBulkSourceId: vi.fn(),
    setBulkTargetPath: vi.fn(),
    setPropagationPreview: vi.fn(),
    propagationPreview: null,
    resetDraggedSource: vi.fn(),
    showMappingLines: false,
    nodeFocusMode: false,
    setLineFocusNode: vi.fn(),
    setAdvancedControlsOpen: vi.fn(),
    previousMappingCountRef,
    sourceSampleOverrides: {},
    ...overrides,
  };
}

describe('useDataMapperEffects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears selection state when activeSourceId changes', () => {
    const setSelectedSourcePaths = vi.fn();
    const deps = makeDeps({ setSelectedSourcePaths });
    const { rerender } = renderHook((p) => useDataMapperEffects(p), { initialProps: deps });

    rerender({
      ...deps,
      activeSourceId: 'src2',
      adapter: createAdapter({
        sources: [{ id: 'src2', label: 'S2', sampleData: '{}' }],
      }),
    });

    expect(setSelectedSourcePaths).toHaveBeenCalledWith(expect.any(Set));
  });

  it('clears line focus when mapping lines become visible', () => {
    const setLineFocusNode = vi.fn();
    const deps = makeDeps({ setLineFocusNode, showMappingLines: false });
    const { rerender } = renderHook((p) => useDataMapperEffects(p), { initialProps: deps });

    rerender({ ...deps, showMappingLines: true });
    expect(setLineFocusNode).toHaveBeenCalledWith(null);
  });

  it('clears propagation preview when anchor mapping disappears', () => {
    const setPropagationPreview = vi.fn();
    const anchorId = 'anchor-1';
    const deps = makeDeps({
      propagationPreview: { anchorMappingId: anchorId } as PatternPropagationPreview,
      mappings: [{ id: anchorId, sourcePath: 'a', sourceId: 'src1', targetPath: 'b' }] as Mapping[],
      setPropagationPreview,
    });
    const { rerender } = renderHook((p) => useDataMapperEffects(p), { initialProps: deps });

    rerender({
      ...deps,
      mappings: [] as Mapping[],
    });

    expect(setPropagationPreview).toHaveBeenCalledWith(null);
  });

  it('clears line focus when nodeFocusMode turns off', () => {
    const setLineFocusNode = vi.fn();
    const deps = makeDeps({ nodeFocusMode: true, setLineFocusNode });
    const { rerender } = renderHook((p) => useDataMapperEffects(p), { initialProps: deps });

    rerender({ ...deps, nodeFocusMode: false });
    expect(setLineFocusNode).toHaveBeenCalledWith(null);
  });

  it('closes advanced controls when mapping count crosses from below 8 to 8+', () => {
    const setAdvancedControlsOpen = vi.fn();
    const previousMappingCountRef = { current: 5 };
    const deps = makeDeps({ setAdvancedControlsOpen, previousMappingCountRef });

    const eightMappings = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`,
      sourcePath: `s${i}`,
      sourceId: 'src1',
      targetPath: `t${i}`,
    })) as Mapping[];

    renderHook(() =>
      useDataMapperEffects({
        ...deps,
        mappings: eightMappings,
      }),
    );

    expect(setAdvancedControlsOpen).toHaveBeenCalledWith(false);
    expect(previousMappingCountRef.current).toBe(8);
  });

  it('debounced savePattern runs for confirmed mappings when contextId is set', async () => {
    const adapter = createAdapter({
      contextId: 'save-me',
      target: { label: 'T', sampleData: '{"x":1}' },
    });
    const mappings: Mapping[] = [
      { id: 'c1', sourcePath: 'a', sourceId: 'src1', targetPath: 'b', isPending: false },
    ];
    const getEffectiveSourceData = vi.fn().mockReturnValue({ y: 2 });

    renderHook(() =>
      useDataMapperEffects(
        makeDeps({
          adapter,
          mappings,
          getEffectiveSourceData,
        }),
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    expect(savePattern).toHaveBeenCalledWith(
      'save-me',
      expect.any(Array),
      expect.any(Array),
      mappings,
    );
  });

  it('skips pattern save when only pending mappings exist', async () => {
    vi.mocked(savePattern).mockClear();
    const adapter = createAdapter({ contextId: 'ctx', target: { label: 'T', sampleData: '{}' } });
    renderHook(() =>
      useDataMapperEffects(
        makeDeps({
          adapter,
          mappings: [{ id: 'p', sourcePath: 'a', sourceId: 'src1', targetPath: 'b', isPending: true }] as Mapping[],
        }),
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    expect(savePattern).not.toHaveBeenCalled();
  });

  it('handleFetchSample no-ops when fetchSampleData is absent', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useDataMapperEffects(deps));

    await act(async () => {
      await result.current.handleFetchSample();
    });

    expect(deps.setSourceSample).not.toHaveBeenCalled();
  });

  it('handleFetchSample stores data when source id still matches', async () => {
    const adapter = createAdapter({
      fetchSampleData: vi.fn().mockResolvedValue({ fresh: true }),
    });
    const setSourceSample = vi.fn();
    const deps = makeDeps({ adapter, setSourceSample });

    const { result } = renderHook(() => useDataMapperEffects(deps));

    await act(async () => {
      await result.current.handleFetchSample();
    });

    expect(setSourceSample).toHaveBeenCalledWith('src1', { fresh: true });
    expect(result.current.fetchError).toBeNull();
  });

  it('handleFetchSample ignores stale responses after source switch', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    const fetchPromise = new Promise((r) => {
      resolveFetch = r as (v: unknown) => void;
    });
    const adapter = createAdapter({
      fetchSampleData: vi.fn().mockReturnValue(fetchPromise),
    });
    const setSourceSample = vi.fn();
    const deps = makeDeps({ adapter, setSourceSample });

    const { result, rerender } = renderHook((p) => useDataMapperEffects(p), {
      initialProps: deps,
    });

    await act(async () => {
      void result.current.handleFetchSample();
    });

    rerender({
      ...deps,
      activeSourceId: 'other',
      adapter: createAdapter({
        fetchSampleData: vi.fn().mockReturnValue(fetchPromise),
        sources: [{ id: 'other', label: 'O', sampleData: '{}' }],
      }),
    });

    await act(async () => {
      resolveFetch({ late: true });
      await fetchPromise;
    });

    expect(setSourceSample).not.toHaveBeenCalled();
  });

  it('handleFetchSample records non-Error rejections as message', async () => {
    const adapter = createAdapter({
      fetchSampleData: vi.fn().mockRejectedValue('boom'),
    });
    const deps = makeDeps({ adapter });

    const { result } = renderHook(() => useDataMapperEffects(deps));

    await act(async () => {
      await result.current.handleFetchSample();
    });

    expect(result.current.fetchError).toEqual({ message: 'Failed to fetch sample data' });
  });

  it('effectiveSources merges sample overrides into adapter sources', () => {
    const deps = makeDeps({
      sourceSampleOverrides: { src1: { overridden: true } },
    });
    const { result } = renderHook(() => useDataMapperEffects(deps));

    expect(result.current.effectiveSources[0].sampleData).toEqual({ overridden: true });
  });

  it('mappedSourcePaths uses activeSourceId when mapping omits sourceId', () => {
    const deps = makeDeps({
      mappings: [{ id: 'm', sourcePath: 'alpha', targetPath: 'beta' }] as Mapping[],
      activeSourceId: 'src1',
    });
    const { result } = renderHook(() => useDataMapperEffects(deps));

    expect(result.current.mappedSourcePaths.has('alpha')).toBe(true);
  });

  it('mappedSourcePaths excludes mappings bound to another source', () => {
    const deps = makeDeps({
      mappings: [
        { id: 'm', sourcePath: 'alpha', sourceId: 'other', targetPath: 'beta' },
      ] as Mapping[],
      activeSourceId: 'src1',
    });
    const { result } = renderHook(() => useDataMapperEffects(deps));

    expect(result.current.mappedSourcePaths.size).toBe(0);
  });
});
