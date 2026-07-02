/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useGrpcRpcSessionStats } from './useGrpcRpcSessionStats';
import {
  clearGrpcRpcSessionStatsForTests,
  recordGrpcRpcStatsEvent,
} from '../../../shared/grpc/grpcRpcSessionStats';

describe('useGrpcRpcSessionStats', () => {
  beforeEach(() => {
    clearGrpcRpcSessionStatsForTests();
  });

  it('subscribes to tab-scoped stats updates and reset', () => {
    const liveTabIds = new Set(['tab-hook']);
    const { result } = renderHook(() => useGrpcRpcSessionStats('tab-hook', liveTabIds));

    expect(result.current.rpcSessionSummary.totalCalls).toBe(0);

    act(() => {
      recordGrpcRpcStatsEvent({
        tabId: 'tab-hook',
        service: 'svc',
        method: 'M',
        callType: 'unary',
        grpcStatus: 0,
        durationMs: 12,
        recordedAt: '2026-07-01T00:00:00.000Z',
        source: 'unary',
      });
    });

    expect(result.current.rpcSessionSummary.totalCalls).toBe(1);

    act(() => {
      result.current.resetRpcSessionStats();
    });

    expect(result.current.rpcSessionSummary.totalCalls).toBe(0);
  });

  it('shows the active tab stats immediately when tabId changes', () => {
    const liveTabIds = new Set(['tab-a', 'tab-b']);
    const { result, rerender } = renderHook(
      ({ activeTabId }: { activeTabId: string }) => useGrpcRpcSessionStats(activeTabId, liveTabIds),
      { initialProps: { activeTabId: 'tab-a' } },
    );

    act(() => {
      recordGrpcRpcStatsEvent({
        tabId: 'tab-a',
        service: 'svc',
        method: 'A',
        callType: 'unary',
        grpcStatus: 0,
        durationMs: 10,
        recordedAt: '2026-07-01T00:00:00.000Z',
        source: 'unary',
      });
      recordGrpcRpcStatsEvent({
        tabId: 'tab-b',
        service: 'svc',
        method: 'B',
        callType: 'unary',
        grpcStatus: 0,
        durationMs: 20,
        recordedAt: '2026-07-01T00:00:00.000Z',
        source: 'unary',
      });
    });

    expect(result.current.rpcSessionSummary.totalCalls).toBe(1);
    expect(result.current.rpcSessionStats.tabId).toBe('tab-a');

    rerender({ activeTabId: 'tab-b' });

    expect(result.current.rpcSessionSummary.totalCalls).toBe(1);
    expect(result.current.rpcSessionStats.tabId).toBe('tab-b');
    expect(result.current.rpcSessionStats.byMethodKey['svc/B']?.calls).toBe(1);
  });

  it('ignores global stats events for other tabs', () => {
    const liveTabIds = new Set(['tab-hook']);
    const { result } = renderHook(() => useGrpcRpcSessionStats('tab-hook', liveTabIds));

    act(() => {
      window.dispatchEvent(new CustomEvent('grpc-rpc-stats-updated', {
        detail: { tabId: 'other-tab' },
      }));
      recordGrpcRpcStatsEvent({
        tabId: 'other-tab',
        service: 'svc',
        method: 'Other',
        callType: 'unary',
        grpcStatus: 0,
        durationMs: 10,
        recordedAt: '2026-07-01T00:00:00.000Z',
        source: 'unary',
      });
    });

    expect(result.current.rpcSessionSummary.totalCalls).toBe(0);
  });

  it('resetRpcSessionStats is a no-op without tabId', () => {
    const liveTabIds = new Set<string>();
    const { result } = renderHook(() => useGrpcRpcSessionStats(undefined, liveTabIds));
    act(() => {
      result.current.resetRpcSessionStats();
    });
    expect(result.current.rpcSessionStats.tabId).toBe('');
  });
});
