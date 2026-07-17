/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowRunCache } from './useWorkflowRunCache';

const STORAGE_KEY = 'rfg-workflow-run-cache';

describe('useWorkflowRunCache — coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resets stale running status to stopped on load', () => {
    const cache = new Map([
      ['wf-1', {
        nodeStatuses: {},
        lastRunStatus: 'running' as const,
        lastRunTime: 100,
        lastRunError: null,
        runVariableSnapshot: null,
        history: [],
        consoleLines: [],
      }],
    ]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cache.entries()]));
    const { result } = renderHook(() => useWorkflowRunCache('wf-1'));
    expect(result.current.lastRunStatus).toBe('stopped');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as [string, { lastRunStatus: string }][];
    expect(stored[0]?.[1].lastRunStatus).toBe('stopped');
  });

  it('trimCacheEntries keeps newest workflows when over max', () => {
    const entries: [string, ReturnType<typeof useWorkflowRunCache> extends never ? never : {
      nodeStatuses: Record<string, never>;
      lastRunStatus: 'idle';
      lastRunTime: number;
      lastRunError: null;
      runVariableSnapshot: null;
      history: [];
      consoleLines: { text: string; ts: number }[];
    }][] = [];
    for (let i = 0; i < 8; i++) {
      entries.push([`wf-${i}`, {
        nodeStatuses: {},
        lastRunStatus: 'idle',
        lastRunTime: i,
        lastRunError: null,
        runVariableSnapshot: null,
        history: [],
        consoleLines: Array.from({ length: 600 }, (_, j) => ({ text: `line-${j}`, ts: j })),
      }]);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    const { result, rerender } = renderHook(({ id }) => useWorkflowRunCache(id), {
      initialProps: { id: 'wf-7' },
    });
    act(() => {
      result.current.setLastRunStatus('pass');
    });
    rerender({ id: 'wf-7' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as [string, { consoleLines: unknown[] }][];
    expect(stored.length).toBeLessThanOrEqual(6);
    expect(stored[0]?.[1].consoleLines.length).toBeLessThanOrEqual(500);
  });

  it('pushHistory returns id without caching when workflowId is null', () => {
    const { result } = renderHook(() => useWorkflowRunCache(null));
    const id = result.current.pushHistory({
      timestamp: 1,
      durationMs: 1,
      passed: true,
      nodeStatuses: {},
      variableSnapshot: null,
      stepsExecuted: 1,
      stepSummaries: [],
      error: null,
    });
    expect(id).toMatch(/^wrh-/);
    expect(result.current.history).toHaveLength(0);
  });
});
