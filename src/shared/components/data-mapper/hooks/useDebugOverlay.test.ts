/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebugOverlay } from './useDebugOverlay';
import type { MappingTrace } from '../utils/mappingTrace';

const makeTrace = (overrides: Partial<MappingTrace> = {}): MappingTrace => ({
  mappingId: 'm1',
  sourcePath: 'name',
  sourceId: 's1',
  sourceValue: 'Alice',
  targetPath: 'userName',
  targetValue: 'Alice',
  timestamp: Date.now(),
  durationMs: 1,
  ...overrides,
});

describe('useDebugOverlay', () => {
  it('returns hasTraceData=false when no traces', () => {
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: undefined, currentMappingIds: new Set(), activeSourceId: 's1' }),
    );
    expect(result.current.hasTraceData).toBe(false);
    expect(result.current.traceByMappingId).toBeNull();
  });

  it('returns hasTraceData=false when traces are empty', () => {
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: [], currentMappingIds: new Set(), activeSourceId: 's1' }),
    );
    expect(result.current.hasTraceData).toBe(false);
  });

  it('builds traceByMappingId from matching traces', () => {
    const traces = [makeTrace({ mappingId: 'm1' }), makeTrace({ mappingId: 'm2' })];
    const ids = new Set(['m1', 'm2']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    expect(result.current.hasTraceData).toBe(true);
    expect(result.current.traceByMappingId!.size).toBe(2);
  });

  it('filters out traces for non-existing mapping ids', () => {
    const traces = [makeTrace({ mappingId: 'm1' }), makeTrace({ mappingId: 'm999' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    expect(result.current.traceByMappingId!.size).toBe(1);
    expect(result.current.traceByMappingId!.has('m1')).toBe(true);
  });

  it('counts trace errors', () => {
    const traces = [
      makeTrace({ mappingId: 'm1', targetValue: undefined, error: 'fail' }),
      makeTrace({ mappingId: 'm2', targetValue: 'ok' }),
    ];
    const ids = new Set(['m1', 'm2']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    expect(result.current.traceErrorCount).toBe(1);
  });

  it('sets debugMode off when no trace data', () => {
    const { result, rerender } = renderHook(
      ({ traceData }) => useDebugOverlay({ traceData, currentMappingIds: new Set(['m1']), activeSourceId: 's1' }),
      { initialProps: { traceData: [makeTrace()] as MappingTrace[] } },
    );
    act(() => { result.current.setDebugMode(true); });
    expect(result.current.debugMode).toBe(true);
    rerender({ traceData: [] });
    expect(result.current.debugMode).toBe(false);
  });

  it('clears errorPopover when debugMode turns off', () => {
    const traces = [makeTrace({ mappingId: 'm1', targetValue: undefined, error: 'fail' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => {
      result.current.setDebugMode(true);
      result.current.setErrorPopover({ data: { mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }, y: 100 });
    });
    expect(result.current.errorPopover).not.toBeNull();
    act(() => { result.current.setDebugMode(false); });
    expect(result.current.errorPopover).toBeNull();
  });

  it('provides handleShowErrorDetail callback', () => {
    const traces = [makeTrace()];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => {
      result.current.handleShowErrorDetail({ mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }, 200);
    });
    expect(result.current.errorPopover).toEqual({
      data: { mappingId: 'm1', sourcePath: 'a', targetPath: 'b' },
      y: 200,
    });
  });

  it('produces sourceTraceOverlay only in debug mode', () => {
    const traces = [makeTrace({ mappingId: 'm1', sourceId: 's1' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    expect(result.current.sourceTraceOverlay).toBeUndefined();
    act(() => { result.current.setDebugMode(true); });
    expect(result.current.sourceTraceOverlay).toBeDefined();
    expect(result.current.sourceTraceOverlay!.size).toBe(1);
  });

  it('filters sourceTraceOverlay by activeSourceId', () => {
    const traces = [makeTrace({ mappingId: 'm1', sourceId: 's2' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => { result.current.setDebugMode(true); });
    expect(result.current.sourceTraceOverlay!.size).toBe(0);
  });

  it('produces targetTraceOverlay only in debug mode', () => {
    const traces = [makeTrace({ mappingId: 'm1' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    expect(result.current.targetTraceOverlay).toBeUndefined();
    act(() => { result.current.setDebugMode(true); });
    expect(result.current.targetTraceOverlay).toBeDefined();
    expect(result.current.targetTraceOverlay!.size).toBe(1);
  });

  it('marks target trace as error for error traces', () => {
    const traces = [makeTrace({ mappingId: 'm1', targetValue: undefined, error: 'fail' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => { result.current.setDebugMode(true); });
    const entry = result.current.targetTraceOverlay!.get('userName');
    expect(entry!.isError).toBe(true);
  });
});
