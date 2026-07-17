/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import { GRPC_CALL_HISTORY_MAX_ENTRIES } from '../../../shared/grpc/grpcPersistenceSchema';

const appendMock = vi.fn().mockResolvedValue(undefined);
const loadMock = vi.fn().mockResolvedValue([]);
const deleteMock = vi.fn().mockResolvedValue(undefined);
const clearMock = vi.fn().mockResolvedValue(undefined);
const deleteManyMock = vi.fn().mockResolvedValue(undefined);
const syncMock = vi.fn().mockResolvedValue(false);

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => false,
}));

vi.mock('../../../shared/utils/idbGrpcCallHistory', () => ({
  idbAppendGrpcCallHistoryEntry: (...args: unknown[]) => appendMock(...args),
  idbLoadGrpcCallHistoryEntries: (...args: unknown[]) => loadMock(...args),
  idbLoadGrpcCallHistoryByService: (...args: unknown[]) => loadMock(...args),
  idbDeleteGrpcCallHistoryEntry: (...args: unknown[]) => deleteMock(...args),
  idbClearGrpcCallHistory: (...args: unknown[]) => clearMock(...args),
  idbDeleteGrpcCallHistoryEntries: (...args: unknown[]) => deleteManyMock(...args),
  idbSyncGrpcCallHistoryFromLocalStorage: (...args: unknown[]) => syncMock(...args),
}));

vi.mock('../../../shared/utils/idbHelpers', () => ({
  idbAvailable: () => true,
}));

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn().mockResolvedValue(null),
  writeKey: vi.fn().mockResolvedValue(undefined),
}));

import {
  appendGrpcCallHistory,
  clearGrpcCallHistory,
  clearGrpcCallHistoryFiltered,
  deleteGrpcCallHistoryEntry,
  loadGrpcCallHistoryEntries,
  queryGrpcCallHistory,
  resetGrpcCallHistoryPersistQueueForTests,
} from './grpcCallHistoryRecorder';
import { prepareGrpcCallHistoryEntryForPersist } from '../../../shared/grpc/grpcPersistenceSchema';
import { readKey } from '../../../shared/utils/storage';

const TS = '2026-06-29T12:00:00.000Z';

function snapshot() {
  return {
    tabId: 'tab-1',
    requestId: 'req-1',
    capturedAt: TS,
    callType: 'unary' as const,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body: { message: 'hi' },
    metadata: { authorization: 'Bearer raw-secret-token-value' },
    timeoutMs: 30_000,
    descriptorKey: 'desc-1',
    auth: { type: 'bearer' as const, bearerToken: 'raw-secret-token-value' },
  };
}

beforeEach(() => {
  appendMock.mockClear();
  loadMock.mockReset();
  loadMock.mockResolvedValue([]);
  deleteMock.mockClear();
  clearMock.mockClear();
  deleteManyMock.mockClear();
  syncMock.mockReset();
  syncMock.mockResolvedValue(false);
  resetGrpcCallHistoryPersistQueueForTests();
});

describe('grpcCallHistoryRecorder (Phase 5D)', () => {
  it('appendGrpcCallHistory redacts secrets and writes through IDB append', async () => {
    const entry = await appendGrpcCallHistory({ snapshot: snapshot() });
    expect(entry.record.snapshot.auth?.bearerToken).toBe('[REDACTED]');
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock.mock.calls[0][1]).toBe(GRPC_CALL_HISTORY_MAX_ENTRIES);
  });

  it('loadGrpcCallHistoryEntries delegates to IDB loader', async () => {
    const prepared = prepareGrpcCallHistoryEntryForPersist({ id: 'h-1', snapshot: snapshot() });
    loadMock.mockResolvedValue([prepared]);
    const entries = await loadGrpcCallHistoryEntries();
    expect(entries).toHaveLength(1);
  });

  it('queryGrpcCallHistory applies filters on loaded entries', async () => {
    const alpha = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-a',
      snapshot: { ...snapshot(), service: 'alpha.Service' },
    });
    const beta = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-b',
      snapshot: { ...snapshot(), service: 'beta.Service' },
    });
    loadMock.mockResolvedValue([alpha, beta]);
    const filtered = await queryGrpcCallHistory({ service: 'alpha.Service' });
    expect(filtered.map((entry) => entry.id)).toEqual(['h-a']);
  });

  it('deleteGrpcCallHistoryEntry and clearGrpcCallHistory forward to IDB', async () => {
    await deleteGrpcCallHistoryEntry('h-1');
    await clearGrpcCallHistory();
    expect(deleteMock).toHaveBeenCalledWith('h-1');
    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it('clearGrpcCallHistoryFiltered deletes matching rows', async () => {
    const alpha = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-a',
      snapshot: { ...snapshot(), service: 'alpha.Service' },
    });
    const beta = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-b',
      snapshot: { ...snapshot(), service: 'beta.Service' },
    });
    loadMock.mockResolvedValue([alpha, beta]);
    const removed = await clearGrpcCallHistoryFiltered({ service: 'alpha.Service' });
    expect(removed).toBe(1);
    expect(deleteManyMock).toHaveBeenCalledWith(['h-a']);
  });

  it('migrates legacy localStorage history when IDB is empty', async () => {
    const lsEntry = prepareGrpcCallHistoryEntryForPersist({ id: 'h-1', snapshot: snapshot() });
    const envelope = JSON.stringify({ schemaVersion: 1, updatedAt: TS, entries: [lsEntry] });
    vi.mocked(readKey).mockResolvedValue(envelope);
    syncMock.mockResolvedValueOnce(true);
    loadMock.mockResolvedValue([lsEntry]);

    const entries = await loadGrpcCallHistoryEntries();
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(entries).toHaveLength(1);
  });

  it('appendGrpcCallHistory syncs legacy localStorage before append', async () => {
    const lsEntry = prepareGrpcCallHistoryEntryForPersist({ id: 'h-ls', snapshot: snapshot() });
    const envelope = JSON.stringify({ schemaVersion: 1, updatedAt: TS, entries: [lsEntry] });
    vi.mocked(readKey).mockResolvedValueOnce(envelope);
    syncMock.mockResolvedValueOnce(true);
    loadMock.mockResolvedValue([]);

    await appendGrpcCallHistory({ snapshot: snapshot() });

    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(syncMock.mock.invocationCallOrder[0]).toBeLessThan(appendMock.mock.invocationCallOrder[0]);
  });

  it('appendGrpcCallHistory does not clear localStorage when sync fails', async () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('legacy'),
      removeItem,
    });
    const lsEntry = prepareGrpcCallHistoryEntryForPersist({ id: 'h-ls', snapshot: snapshot() });
    vi.mocked(readKey).mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      entries: [lsEntry],
    }));
    syncMock.mockResolvedValue(false);
    loadMock.mockResolvedValue([]);

    await appendGrpcCallHistory({ snapshot: snapshot() });

    expect(removeItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('clearGrpcCallHistory clears legacy localStorage after IDB wipe', async () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('legacy'),
      removeItem,
    });
    const lsEntry = prepareGrpcCallHistoryEntryForPersist({ id: 'h-ls', snapshot: snapshot() });
    vi.mocked(readKey).mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      entries: [lsEntry],
    }));
    syncMock.mockResolvedValue(false);
    loadMock.mockResolvedValue([]);

    await clearGrpcCallHistory();

    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
