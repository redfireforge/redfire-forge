/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataMapperLifecycleEffects } from './useDataMapperLifecycleEffects';
import type { MapperAdapter, Mapping } from '../types';

function makeAdapter(overrides: Partial<MapperAdapter> = {}): MapperAdapter {
  return {
    contextId: 'test-ctx',
    title: 'Test Adapter',
    sources: [{ id: 'src1', label: 'Source' }],
    target: { label: 'Target', allowCustomFields: false },
    serialize: vi.fn().mockReturnValue({}),
    deserialize: vi.fn().mockReturnValue([]),
    ...overrides,
  } as unknown as MapperAdapter;
}

function makeMapping(id: string): Mapping {
  return { id, sourcePath: 'a', sourceId: 'src1', targetPath: 'x' };
}

describe('useDataMapperLifecycleEffects', () => {
  it('removes stale patternMappingIds when a mapped ID is removed from mappings', () => {
    const autoMapScoresRef = { current: new Map<string, number>() };
    const patternMappingIdsRef = { current: new Set<string>(['m1', 'm2']) };
    const setMappings = vi.fn();
    const clearIgnoredRepairIssues = vi.fn();
    const setToast = vi.fn();

    const initialMappings = [makeMapping('m1'), makeMapping('m2')];
    const adapter = makeAdapter();

    const { rerender } = renderHook(
      ({ mappings }: { mappings: Mapping[] }) =>
        useDataMapperLifecycleEffects({
          mappings,
          repairTick: undefined,
          repairedMappingsRef: undefined,
          setMappings,
          onChange: undefined,
          autoMapScoresRef,
          patternMappingIdsRef,
          adapter,
          activeSourceId: 'src1',
          sourceSampleOverrides: {},
          setSourceSample: vi.fn(),
          clearIgnoredRepairIssues,
          toast: null,
          setToast,
        }),
      { initialProps: { mappings: initialMappings } },
    );

    // Both IDs present — patternMappingIdsRef unchanged
    expect(patternMappingIdsRef.current.has('m1')).toBe(true);
    expect(patternMappingIdsRef.current.has('m2')).toBe(true);

    // Remove m1 from mappings — should trigger cleanup
    rerender({ mappings: [makeMapping('m2')] });

    expect(patternMappingIdsRef.current.has('m1')).toBe(false);
    expect(patternMappingIdsRef.current.has('m2')).toBe(true);
  });

  it('does not call setSourceSample when fetchSampleData resolves to null', async () => {
    const setSourceSample = vi.fn();
    const fetchSampleData = vi.fn().mockResolvedValue(null);
    const adapter = makeAdapter({
      contextId: 'validation',
      fetchSampleData,
    });

    await act(async () => {
      renderHook(() =>
        useDataMapperLifecycleEffects({
          mappings: [makeMapping('m1')],
          repairTick: undefined,
          repairedMappingsRef: undefined,
          setMappings: vi.fn(),
          onChange: undefined,
          autoMapScoresRef: { current: new Map() },
          patternMappingIdsRef: { current: new Set() },
          adapter,
          activeSourceId: 'src1',
          sourceSampleOverrides: {},
          setSourceSample,
          clearIgnoredRepairIssues: vi.fn(),
          toast: null,
          setToast: vi.fn(),
        }),
      );
    });

    expect(fetchSampleData).toHaveBeenCalled();
    expect(setSourceSample).not.toHaveBeenCalled();
  });

  it('auto-fetches source sample for populate-from-api without existing mappings', async () => {
    const setSourceSample = vi.fn();
    const sample = { id: 1, name: 'Leanne' };
    const fetchSampleData = vi.fn().mockResolvedValue(sample);
    const adapter = makeAdapter({
      contextId: 'populate-from-api',
      fetchSampleData,
      sources: [{ id: 'api-response', label: 'API Response' }],
    });

    await act(async () => {
      renderHook(() =>
        useDataMapperLifecycleEffects({
          mappings: [],
          repairTick: undefined,
          repairedMappingsRef: undefined,
          setMappings: vi.fn(),
          onChange: undefined,
          autoMapScoresRef: { current: new Map() },
          patternMappingIdsRef: { current: new Set() },
          adapter,
          activeSourceId: 'api-response',
          sourceSampleOverrides: {},
          setSourceSample,
          clearIgnoredRepairIssues: vi.fn(),
          toast: null,
          setToast: vi.fn(),
        }),
      );
    });

    expect(fetchSampleData).toHaveBeenCalled();
    expect(setSourceSample).toHaveBeenCalledWith('api-response', sample);
  });
});
