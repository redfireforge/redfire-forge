/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '@shared/grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist } from '@shared/grpc/grpcPersistenceSchema';

const loadMock = vi.fn();
const clearMock = vi.fn();
const clearFilteredMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../data/grpcCallHistoryRecorder', () => ({
  loadGrpcCallHistoryEntries: (...args: unknown[]) => loadMock(...args),
  clearGrpcCallHistory: (...args: unknown[]) => clearMock(...args),
  clearGrpcCallHistoryFiltered: (...args: unknown[]) => clearFilteredMock(...args),
  deleteGrpcCallHistoryEntry: (...args: unknown[]) => deleteMock(...args),
}));

import { useGrpcCallHistory } from './useGrpcCallHistory';

const TS = '2026-06-29T12:00:00.000Z';

function entry(id: string, service = 'echo.EchoService', grpcStatus = 0) {
  return prepareGrpcCallHistoryEntryForPersist({
    id,
    snapshot: {
      tabId: 'tab-1',
      requestId: `req-${id}`,
      capturedAt: TS,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    },
    result: {
      callType: 'unary',
      status: grpcStatus,
      statusMessage: grpcStatus === 0 ? 'OK' : 'Failed',
      headers: {},
      trailers: {},
      message: {},
      durationMs: 1,
    },
  });
}

beforeEach(() => {
  loadMock.mockReset();
  loadMock.mockResolvedValue([
    entry('ok-1'),
    entry('err-1', 'other.Service', 16),
  ]);
  clearMock.mockReset();
  clearMock.mockResolvedValue(undefined);
  clearFilteredMock.mockReset();
  clearFilteredMock.mockResolvedValue(undefined);
  deleteMock.mockReset();
  deleteMock.mockResolvedValue(undefined);
});

describe('useGrpcCallHistory coverage gaps (Phase 5H)', () => {
  it('filters entries by service and outcome', async () => {
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(2);

    act(() => {
      result.current.setFilters({ service: 'other.Service' });
    });
    expect(result.current.filteredEntries).toHaveLength(1);
    expect(result.current.filteredEntries[0]?.id).toBe('err-1');

    act(() => {
      result.current.setFilters({ outcome: 'ok' });
    });
    expect(result.current.filteredEntries.every((e) => e.id === 'ok-1')).toBe(true);
  });

  it('exposes filter options from loaded entries', async () => {
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.filterOptions.services).toContain('echo.EchoService');
    expect(result.current.filterOptions.hasOkEntries).toBe(true);
    expect(result.current.filterOptions.hasErrorEntries).toBe(true);
  });

  it('clearFiltered passes current filters to recorder', async () => {
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ service: 'echo.EchoService' });
    });

    await act(async () => { await result.current.clearFiltered(); });
    expect(clearFilteredMock).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'echo.EchoService' }),
    );
  });

  it('clearLastMutationError clears surfaced error', async () => {
    clearMock.mockRejectedValueOnce(new Error('clear failed'));
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try {
        await result.current.clearAll();
      } catch { /* rethrows */ }
    });
    expect(result.current.lastMutationError).toBe('clear failed');

    act(() => { result.current.clearLastMutationError(); });
    expect(result.current.lastMutationError).toBeUndefined();
  });

  it('records generic mutation error for non-Error throws', async () => {
    clearFilteredMock.mockRejectedValueOnce('boom');
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try {
        await result.current.clearFiltered();
      } catch { /* rethrows */ }
    });
    expect(result.current.lastMutationError).toBe('History update failed');
  });

  it('deleteEntry reloads after successful delete', async () => {
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(1));

    await act(async () => { await result.current.deleteEntry('ok-1'); });
    expect(deleteMock).toHaveBeenCalledWith('ok-1');
    expect(loadMock).toHaveBeenCalledTimes(2);
  });
});
