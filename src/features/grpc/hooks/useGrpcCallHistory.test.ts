/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist } from '../../../shared/grpc/grpcPersistenceSchema';
import { GRPC_CALL_HISTORY_UPDATED_EVENT } from '../utils/grpcStudioCallHistoryCapture';

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

function entry(id: string) {
  return prepareGrpcCallHistoryEntryForPersist({
    id,
    snapshot: {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: TS,
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    },
  });
}

beforeEach(() => {
  loadMock.mockReset();
  loadMock.mockResolvedValue([entry('h-1')]);
  clearMock.mockReset();
  clearMock.mockResolvedValue(undefined);
  clearFilteredMock.mockReset();
  clearFilteredMock.mockResolvedValue(undefined);
  deleteMock.mockReset();
  deleteMock.mockResolvedValue(undefined);
});

describe('useGrpcCallHistory (Phase 5H)', () => {
  it('loads entries on mount', async () => {
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
  });

  it('reloads when history updated event fires', async () => {
    renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new CustomEvent(GRPC_CALL_HISTORY_UPDATED_EVENT));
    await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(2));
  });

  it('clearAll delegates to recorder', async () => {
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.clearAll();
    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it('records lastMutationError when delete fails', async () => {
    deleteMock.mockRejectedValueOnce(new Error('IDB delete failed'));
    const { result } = renderHook(() => useGrpcCallHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try {
        await result.current.deleteEntry('h-1');
      } catch {
        /* hook rethrows after recording lastMutationError */
      }
    });
    expect(result.current.lastMutationError).toBe('IDB delete failed');
  });
});
