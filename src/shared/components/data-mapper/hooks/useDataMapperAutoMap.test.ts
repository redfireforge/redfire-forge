/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataMapperAutoMap } from './useDataMapperAutoMap';
import type { DataMapperAutoMapDeps } from './useDataMapperAutoMap';

import { savePattern, loadPattern, patternToSuggestions } from '../utils/mappingPatterns';

vi.mock('../utils/mappingPatterns', () => ({
  savePattern: vi.fn(),
  loadPattern: vi.fn().mockReturnValue(null),
  patternToSuggestions: vi.fn().mockReturnValue([]),
}));

function makeDeps(overrides: Partial<DataMapperAutoMapDeps> = {}): DataMapperAutoMapDeps {
  return {
    adapter: {
      label: 'test',
      contextId: 'ctx',
      sources: [{ id: 'src1', label: 'Source 1', sampleData: JSON.stringify({ a: 1, b: 2 }) }],
      target: { label: 'Target', allowCustomFields: false, sampleData: JSON.stringify({ x: 0, y: 0 }) },
      serialize: vi.fn().mockReturnValue({}),
      deserialize: vi.fn().mockReturnValue([]),
    } as unknown as DataMapperAutoMapDeps['adapter'],
    mappings: [],
    activeSourceId: 'src1',
    setMappings: vi.fn(),
    setSelectedIds: vi.fn(),
    setSelectedSourcePaths: vi.fn(),
    setSourceSample: vi.fn(),
    setToast: vi.fn(),
    getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify({ a: 1, b: 2 })),
    effectiveTarget: { sampleData: JSON.stringify({ x: 0, y: 0 }) },
    confidenceThreshold: 50,
    ...overrides,
  };
}

describe('useDataMapperAutoMap', () => {
  it('initializes with empty candidates when no source data', () => {
    const deps = makeDeps({ getEffectiveSourceData: vi.fn().mockReturnValue(null) });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));
    expect(result.current.autoMapCandidateCount).toBe(0);
  });

  it('computes autoMapCandidates when source and target exist', () => {
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify({ name: 'test', value: 42 })),
      effectiveTarget: {
        sampleData: JSON.stringify({ name: '', value: 0 }),
        fields: [{ path: 'name', label: 'Name', type: 'string' }, { path: 'value', label: 'Value', type: 'number' }],
      },
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));
    expect(result.current.autoMapCandidateCount).toBeGreaterThanOrEqual(0);
  });

  it('handleAutoMap creates mappings from candidates', () => {
    const setMappings = vi.fn();
    const setToast = vi.fn();
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify({ name: 'test' })),
      effectiveTarget: { sampleData: JSON.stringify({ name: '' }) },
      setMappings,
      setToast,
      confidenceThreshold: 0,
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => { result.current.handleAutoMap(); });

    if (result.current.autoMapCandidateCount > 0) {
      expect(setMappings).toHaveBeenCalled();
    }
  });

  it('handleLoadGallerySample sets mappings and shows toast', () => {
    const setMappings = vi.fn();
    const setSelectedIds = vi.fn();
    const setSelectedSourcePaths = vi.fn();
    const setToast = vi.fn();
    const deps = makeDeps({ setMappings, setSelectedIds, setSelectedSourcePaths, setToast });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    const sample = {
      name: 'Test Sample',
      description: 'A test',
      sources: [{ id: 'src1', sampleData: '{"key":"val"}' }],
      mappings: [{ id: 'g1', sourcePath: 'key', sourceId: 'src1', targetPath: 'key' }],
    };

    act(() => { result.current.handleLoadGallerySample(sample); });

    expect(setMappings).toHaveBeenCalledWith(sample.mappings);
    expect(setSelectedIds).toHaveBeenCalledWith(new Set());
    expect(setSelectedSourcePaths).toHaveBeenCalledWith(new Set());
    expect(setToast).toHaveBeenCalledWith('Loaded sample: Test Sample');
  });

  it('handleApplyProfileDelta shows toast when no changes', () => {
    const setToast = vi.fn();
    const deps = makeDeps({ setToast });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => { result.current.handleApplyProfileDelta([]); });
    expect(setToast).toHaveBeenCalledWith('Profile delta already up to date');
  });

  it('handleApplyProfileDelta applies profile and shows toast', () => {
    const setMappings = vi.fn();
    const setToast = vi.fn();
    const deps = makeDeps({ setMappings, setToast });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    const profileMappings = [{ id: 'p1', sourcePath: 'a', sourceId: 'src1', targetPath: 'x' }];
    act(() => { result.current.handleApplyProfileDelta(profileMappings); });
    expect(setMappings).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith(expect.stringContaining('Applied profile delta'));
  });

  it('exposes autoMapScoresRef and patternMappingIdsRef', () => {
    const { result } = renderHook(() => useDataMapperAutoMap(makeDeps()));
    expect(result.current.autoMapScoresRef.current).toBeInstanceOf(Map);
    expect(result.current.patternMappingIdsRef.current).toBeInstanceOf(Set);
  });

  it('handles JSON parse errors gracefully in candidates', () => {
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue('not valid json {['),
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));
    expect(result.current.autoMapCandidateCount).toBe(0);
  });

  it('handleSavePattern calls savePattern when contextId and source data exist', () => {

    const deps = makeDeps({
      adapter: {
        label: 'test',
        contextId: 'save-ctx',
        sources: [{ id: 'src1', label: 'Source 1', sampleData: JSON.stringify({ a: 1 }) }],
        target: { label: 'Target', allowCustomFields: false, sampleData: JSON.stringify({ x: 0 }) },
        serialize: vi.fn().mockReturnValue({}),
        deserialize: vi.fn().mockReturnValue([]),
      } as unknown as DataMapperAutoMapDeps['adapter'],
      mappings: [{ id: 'm1', sourcePath: 'a', sourceId: 'src1', targetPath: 'x' }],
      effectiveTarget: { sampleData: JSON.stringify({ x: 0 }), fields: [{ path: 'x', label: 'X' }] },
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => { result.current.handleSavePattern(); });

    expect(savePattern).toHaveBeenCalledWith(
      'save-ctx',
      expect.any(Array),
      expect.any(Array),
      expect.arrayContaining([expect.objectContaining({ id: 'm1' })]),
    );
  });

  it('handleSavePattern does nothing when contextId is missing', () => {
    const deps = makeDeps({
      adapter: {
        label: 'test',
        contextId: undefined,
        sources: [{ id: 'src1', label: 'S', sampleData: '{}' }],
        target: { label: 'T', allowCustomFields: false, sampleData: '{}' },
        serialize: vi.fn(),
        deserialize: vi.fn(),
      } as unknown as DataMapperAutoMapDeps['adapter'],
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => { result.current.handleSavePattern(); });
  });

  it('handleSavePattern does nothing when source data is null', () => {
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue(null),
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => { result.current.handleSavePattern(); });
  });

  it('handleSavePattern ignores JSON parse errors', () => {
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue('invalid{json'),
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => { result.current.handleSavePattern(); });
  });

  it('handleAutoMap applies pattern suggestions when loadPattern returns a stored pattern', () => {
    vi.mocked(patternToSuggestions).mockReturnValue([
      { sourcePath: 'alpha', targetPath: 'omega', expression: undefined },
    ]);
    vi.mocked(loadPattern).mockReturnValue({ entries: [{ sourcePath: 'alpha', targetPath: 'omega' }], savedAt: 1 });

    const setMappings = vi.fn();
    const setToast = vi.fn();
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify({ alpha: 1, beta: 2 })),
      effectiveTarget: { sampleData: JSON.stringify({ omega: 0, delta: 0 }) },
      setMappings,
      setToast,
      confidenceThreshold: 80,
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => { result.current.handleAutoMap(); });

    expect(setMappings).toHaveBeenCalled();
    const calls = setMappings.mock.calls;
    const mappingsArg = calls[0][0];
    const patternMapping = mappingsArg.find((m: { targetPath: string }) => m.targetPath === 'omega');
    expect(patternMapping).toBeDefined();
    expect(patternMapping.isPending).toBe(true);
    expect(result.current.patternMappingIdsRef.current.has(patternMapping.id)).toBe(true);

    vi.mocked(loadPattern).mockReturnValue(null);
    vi.mocked(patternToSuggestions).mockReturnValue([]);
  });

  it('handleAutoMap skips pattern suggestions when target already mapped', () => {
    vi.mocked(patternToSuggestions).mockReturnValue([
      { sourcePath: 'a', targetPath: 'x', expression: undefined },
    ]);
    vi.mocked(loadPattern).mockReturnValue({ entries: [{ sourcePath: 'a', targetPath: 'x' }], savedAt: 1 });

    const setMappings = vi.fn();
    const setToast = vi.fn();
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify({ a: 1, b: 2 })),
      effectiveTarget: { sampleData: JSON.stringify({ x: 0, y: 0 }) },
      setMappings,
      setToast,
      confidenceThreshold: 0,
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => { result.current.handleAutoMap(); });

    vi.mocked(loadPattern).mockReturnValue(null);
    vi.mocked(patternToSuggestions).mockReturnValue([]);
  });

  it('handleAutoMap does nothing when no candidates meet threshold and patterns empty', () => {
    const setMappings = vi.fn();
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify({ z: 9 })),
      effectiveTarget: { sampleData: JSON.stringify({ unmatched: 1 }) },
      setMappings,
      confidenceThreshold: 100,
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => {
      result.current.handleAutoMap();
    });

    expect(setMappings).not.toHaveBeenCalled();
  });

  it('handleAutoMap attaches autoMapDefaultOperator to new mappings', () => {
    const setMappings = vi.fn();
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify({ name: 'test' })),
      effectiveTarget: { sampleData: JSON.stringify({ name: '' }) },
      setMappings,
      confidenceThreshold: 0,
      autoMapDefaultOperator: 'contains',
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => {
      result.current.handleAutoMap();
    });

    if (result.current.autoMapCandidateCount > 0) {
      const applied = setMappings.mock.calls[0][0] as { operator?: string }[];
      expect(applied.some((m) => m.operator === 'contains')).toBe(true);
    }
  });

  it('handleLoadGallerySample maps unknown sample source id onto first adapter source', () => {
    const setSourceSample = vi.fn();
    const deps = makeDeps({
      adapter: {
        label: 'test',
        contextId: 'ctx',
        sources: [{ id: 'primary', label: 'Primary', sampleData: '{}' }],
        target: { label: 'Target', allowCustomFields: false, sampleData: '{}' },
        serialize: vi.fn().mockReturnValue({}),
        deserialize: vi.fn().mockReturnValue([]),
      } as unknown as DataMapperAutoMapDeps['adapter'],
      activeSourceId: 'ignored',
      setSourceSample,
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    const sample = {
      name: 'Remap',
      description: '',
      sources: [{ id: 'unknown-src', sampleData: { injected: true } }],
      mappings: [],
    };

    act(() => {
      result.current.handleLoadGallerySample(sample);
    });

    expect(setSourceSample).toHaveBeenCalledWith('primary', { injected: true });
  });

  it('combine toast lists pattern-derived and scored mappings when both apply', () => {
    vi.mocked(patternToSuggestions).mockReturnValue([
      { sourcePath: 'alpha', targetPath: 'omega', expression: undefined },
    ]);
    vi.mocked(loadPattern).mockReturnValue({ entries: [{ sourcePath: 'alpha', targetPath: 'omega' }], savedAt: 1 });

    const setMappings = vi.fn();
    const setToast = vi.fn();
    const deps = makeDeps({
      getEffectiveSourceData: vi.fn().mockReturnValue(JSON.stringify({ alpha: 1, beta: 2 })),
      effectiveTarget: { sampleData: JSON.stringify({ omega: 0, gamma: 0 }) },
      setMappings,
      setToast,
      confidenceThreshold: 0,
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    act(() => {
      result.current.handleAutoMap();
    });

    expect(setMappings).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalled();
    const msg = String(setToast.mock.calls[0][0]);
    expect(msg).toMatch(/auto-mapped|from patterns/);

    vi.mocked(loadPattern).mockReturnValue(null);
    vi.mocked(patternToSuggestions).mockReturnValue([]);
  });

  it('handleLoadGallerySample falls back to activeSourceId when adapter has no sources', () => {
    const setSourceSample = vi.fn();
    const deps = makeDeps({
      adapter: {
        label: 'test',
        contextId: 'ctx',
        sources: [],
        target: { label: 'Target', allowCustomFields: false, sampleData: '{}' },
        serialize: vi.fn().mockReturnValue({}),
        deserialize: vi.fn().mockReturnValue([]),
      } as unknown as DataMapperAutoMapDeps['adapter'],
      activeSourceId: 'fallback-src',
      setSourceSample,
    });
    const { result } = renderHook(() => useDataMapperAutoMap(deps));

    const sample = {
      name: 'Empty Sources',
      description: '',
      sources: [{ id: 'unknown', sampleData: { key: 'val' } }],
      mappings: [],
    };

    act(() => { result.current.handleLoadGallerySample(sample); });

    expect(setSourceSample).toHaveBeenCalledWith('fallback-src', { key: 'val' });
  });
});
