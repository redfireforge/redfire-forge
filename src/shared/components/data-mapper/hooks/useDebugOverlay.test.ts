/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
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

  it('returns null trace map when no trace matches current mapping ids', () => {
    const traces = [makeTrace({ mappingId: 'orphan' })];
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: new Set(['m1']), activeSourceId: 's1' }),
    );
    expect(result.current.traceByMappingId).toBeNull();
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

  it('closes error popover on mousedown outside overlay', () => {
    const traces = [makeTrace({ mappingId: 'm1' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    const overlayEl = document.createElement('div');
    act(() => {
      result.current.errorPopoverRef.current = overlayEl;
      result.current.setErrorPopover({ data: { mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }, y: 10 });
    });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    act(() => {
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.errorPopover).toBeNull();
    document.body.removeChild(outside);
  });

  it('keeps error popover on mousedown inside overlay', () => {
    const traces = [makeTrace({ mappingId: 'm1' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    const overlayEl = document.createElement('div');
    const inner = document.createElement('span');
    overlayEl.appendChild(inner);
    act(() => {
      result.current.errorPopoverRef.current = overlayEl;
      result.current.setErrorPopover({ data: { mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }, y: 10 });
    });
    act(() => {
      inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.errorPopover).not.toBeNull();
  });

  it('does not clear popover on mousedown when ref is not attached', () => {
    const traces = [makeTrace({ mappingId: 'm1' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => {
      result.current.errorPopoverRef.current = null;
      result.current.setErrorPopover({ data: { mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }, y: 10 });
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.errorPopover).not.toBeNull();
  });

  it('uses first trace only for duplicate source paths in overlay', () => {
    const traces = [
      makeTrace({ mappingId: 'm1', sourcePath: 'same', sourceValue: 'first' }),
      makeTrace({ mappingId: 'm2', sourcePath: 'same', sourceValue: 'second' }),
    ];
    const ids = new Set(['m1', 'm2']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => { result.current.setDebugMode(true); });
    expect(result.current.sourceTraceOverlay!.get('same')!.value).toContain('first');
  });

  it('closes error popover on Escape', () => {
    const traces = [makeTrace({ mappingId: 'm1' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => {
      result.current.setErrorPopover({ data: { mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }, y: 10 });
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(result.current.errorPopover).toBeNull();
  });

  it('ignores non-Escape keys while popover listeners are active', () => {
    const traces = [makeTrace({ mappingId: 'm1' })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => {
      result.current.setErrorPopover({ data: { mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }, y: 10 });
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(result.current.errorPopover).not.toBeNull();
  });

  it('uses explicit trace sourceId when it matches the active source', () => {
    const traces = [makeTrace({ mappingId: 'm1', sourceId: 's1', sourcePath: 'p', sourceValue: 3 })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => { result.current.setDebugMode(true); });
    expect(result.current.sourceTraceOverlay!.has('p')).toBe(true);
  });

  it('removes document listeners when popover unmounts', () => {
    const traces = [makeTrace({ mappingId: 'm1' })];
    const ids = new Set(['m1']);
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => {
      result.current.setErrorPopover({ data: { mappingId: 'm1', sourcePath: 'a', targetPath: 'b' }, y: 10 });
    });
    unmount();
    expect(removeSpy.mock.calls.some((c) => c[0] === 'mousedown')).toBe(true);
    expect(removeSpy.mock.calls.some((c) => c[0] === 'keydown')).toBe(true);
    removeSpy.mockRestore();
  });

  it('uses active source id when trace sourceId is empty string', () => {
    const traces = [makeTrace({ mappingId: 'm1', sourceId: '', sourcePath: 'p', sourceValue: 9 })];
    const ids = new Set(['m1']);
    const { result } = renderHook(() =>
      useDebugOverlay({ traceData: traces, currentMappingIds: ids, activeSourceId: 's1' }),
    );
    act(() => { result.current.setDebugMode(true); });
    expect(result.current.sourceTraceOverlay!.get('p')).toBeDefined();
  });
});
