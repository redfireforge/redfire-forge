/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowRunCache, type WorkflowRunHistoryEntry } from './useWorkflowRunCache';
import type { NodeRunStatus } from '../types/workflow';

const STORAGE_KEY = 'rfg-workflow-run-cache';

const status = (s: NodeRunStatus['state']): NodeRunStatus => ({ state: s } as NodeRunStatus);

describe('useWorkflowRunCache', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns empty defaults when no cache and no workflowId', () => {
    const { result } = renderHook(() => useWorkflowRunCache(null));
    expect(result.current.nodeStatuses).toEqual({});
    expect(result.current.lastRunStatus).toBe('idle');
    expect(result.current.history).toEqual([]);
  });

  it('persists nodeStatuses to localStorage', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    act(() => result.current.setNodeStatuses({ a: status('pass') }));
    expect(result.current.nodeStatuses).toEqual({ a: status('pass') });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).toContain('"a"');
  });

  it('functional setNodeStatuses receives prev', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    act(() => result.current.setNodeStatuses({ a: status('pass') }));
    act(() => result.current.setNodeStatuses(prev => ({ ...prev, b: status('fail') })));
    expect(result.current.nodeStatuses).toEqual({ a: status('pass'), b: status('fail') });
  });

  it('pushHistory caps at 10 and prepends', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    const make = (i: number): Omit<WorkflowRunHistoryEntry, 'id'> => ({
      timestamp: i, durationMs: 0, passed: true,
      nodeStatuses: {}, variableSnapshot: null,
      stepsExecuted: 0, stepSummaries: [], error: null,
    });
    act(() => {
      for (let i = 0; i < 12; i++) result.current.pushHistory(make(i));
    });
    expect(result.current.history).toHaveLength(10);
    expect(result.current.history[0].timestamp).toBe(11);
    expect(result.current.history[9].timestamp).toBe(2);
  });

  it('clearConsole clears lines and storage', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    act(() => {
      result.current.pushConsoleLine({ text: 'a', ts: 1 });
      result.current.pushConsoleLine({ text: 'b', ts: 2 });
    });
    expect(result.current.consoleLines).toHaveLength(2);
    act(() => result.current.clearConsole());
    expect(result.current.consoleLines).toEqual([]);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as [string, unknown][];
    const entry = parsed.find(([k]) => k === 'w1');
    expect(entry?.[1] && typeof entry[1] === 'object' && 'consoleLines' in (entry[1] as object)).toBe(true);
    expect((entry?.[1] as { consoleLines: unknown }).consoleLines).toEqual([]);
  });

  it('saveCacheToStorage swallows setItem failures', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    expect(() => act(() => result.current.setLastRunStatus('running'))).not.toThrow();
    spy.mockRestore();
  });

  it('restoreFromHistory sets pass when entry.passed is true', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    let id = '';
    act(() => {
      id = result.current.pushHistory({
        timestamp: 1, durationMs: 99, passed: true,
        nodeStatuses: { a: status('pass') },
        variableSnapshot: { k: 'v' },
        stepsExecuted: 1, stepSummaries: [], error: null,
      });
    });
    act(() => {
      result.current.setLastRunStatus('fail');
      result.current.restoreFromHistory(id);
    });
    expect(result.current.lastRunStatus).toBe('pass');
    expect(result.current.lastRunTime).toBe(99);
    expect(result.current.runVariableSnapshot).toEqual({ k: 'v' });
  });

  it('restoreFromHistory and deleteHistoryEntry no-op when workflowId is null', () => {
    const { result } = renderHook(() => useWorkflowRunCache(null));
    expect(() => act(() => {
      result.current.restoreFromHistory('any');
      result.current.deleteHistoryEntry('any');
    })).not.toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restoreFromHistory updates statuses, status, time, error, snapshot', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    let id = '';
    act(() => {
      id = result.current.pushHistory({
        timestamp: 1, durationMs: 42, passed: false,
        nodeStatuses: { a: status('fail') },
        variableSnapshot: { x: '1' },
        stepsExecuted: 1, stepSummaries: [], error: 'boom',
      });
    });
    act(() => result.current.restoreFromHistory(id));
    expect(result.current.lastRunStatus).toBe('fail');
    expect(result.current.lastRunTime).toBe(42);
    expect(result.current.lastRunError).toBe('boom');
    expect(result.current.runVariableSnapshot).toEqual({ x: '1' });
    expect(result.current.nodeStatuses).toEqual({ a: status('fail') });
  });

  it('restoreFromHistory is no-op for unknown id', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    act(() => result.current.restoreFromHistory('nope'));
    expect(result.current.lastRunStatus).toBe('idle');
  });

  it('deleteHistoryEntry uses empty history when cache row omits history', () => {
    const partial = {
      nodeStatuses: {},
      lastRunStatus: 'idle' as const,
      lastRunTime: undefined,
      lastRunError: null,
      runVariableSnapshot: null,
      consoleLines: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([['w1', partial]]));
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    act(() => result.current.deleteHistoryEntry('missing-id'));
    expect(result.current.history).toEqual([]);
  });

  it('deleteHistoryEntry removes matching entry', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    let id = '';
    act(() => {
      id = result.current.pushHistory({
        timestamp: 1, durationMs: 0, passed: true,
        nodeStatuses: {}, variableSnapshot: null,
        stepsExecuted: 0, stepSummaries: [], error: null,
      });
    });
    expect(result.current.history).toHaveLength(1);
    act(() => result.current.deleteHistoryEntry(id));
    expect(result.current.history).toHaveLength(0);
  });

  it('clearHistory wipes everything', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    act(() => {
      result.current.setNodeStatuses({ a: status('pass') });
      result.current.setLastRunError('err');
      result.current.pushConsoleLine({ text: 'line', ts: 1 });
      result.current.pushHistory({
        timestamp: 1, durationMs: 0, passed: true,
        nodeStatuses: {}, variableSnapshot: null,
        stepsExecuted: 0, stepSummaries: [], error: null,
      });
    });
    act(() => result.current.clearHistory());
    expect(result.current.history).toHaveLength(0);
    expect(result.current.nodeStatuses).toEqual({});
    expect(result.current.lastRunStatus).toBe('idle');
    expect(result.current.lastRunError).toBeNull();
    expect(result.current.consoleLines).toEqual([]);
  });

  it('pushConsoleLine caps at 500 lines', () => {
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    act(() => {
      for (let i = 0; i < 510; i++) result.current.pushConsoleLine({ text: `line ${i}`, ts: i });
    });
    expect(result.current.consoleLines).toHaveLength(500);
    expect(result.current.consoleLines[0].text).toBe('line 10');
  });

  it('switching workflowId loads its cached state', () => {
    const { result, rerender } = renderHook(({ id }) => useWorkflowRunCache(id), { initialProps: { id: 'w1' } });
    act(() => result.current.setNodeStatuses({ a: status('pass') }));
    rerender({ id: 'w2' });
    expect(result.current.nodeStatuses).toEqual({});
    rerender({ id: 'w1' });
    expect(result.current.nodeStatuses).toEqual({ a: status('pass') });
  });

  it('rehydrates from previously persisted localStorage', () => {
    const cache = [['w1', {
      nodeStatuses: { z: { state: 'pass' } },
      lastRunStatus: 'pass', lastRunTime: 100, lastRunError: null,
      runVariableSnapshot: null, history: [], consoleLines: [],
    }]];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    expect(result.current.nodeStatuses).toEqual({ z: { state: 'pass' } });
    expect(result.current.lastRunStatus).toBe('pass');
    expect(result.current.lastRunTime).toBe(100);
  });

  it('handles malformed storage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    const { result } = renderHook(() => useWorkflowRunCache('w1'));
    expect(result.current.nodeStatuses).toEqual({});
  });

  it('null workflowId guards write paths', () => {
    const { result } = renderHook(() => useWorkflowRunCache(null));
    act(() => result.current.setNodeStatuses({ a: status('pass') }));
    // No throws; no persistence
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => {
      const id = result.current.pushHistory({
        timestamp: 1, durationMs: 0, passed: true,
        nodeStatuses: {}, variableSnapshot: null,
        stepsExecuted: 0, stepSummaries: [], error: null,
      });
      expect(typeof id).toBe('string');
    });
    expect(result.current.history).toHaveLength(0);
  });
});
