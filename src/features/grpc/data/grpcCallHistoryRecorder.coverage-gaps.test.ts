/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import { prepareGrpcCallHistoryEntryForPersist } from '../../../shared/grpc/grpcPersistenceSchema';

const {
  isTauriMock,
  idbAvailableMock,
  appendMock,
  loadMock,
  loadByServiceMock,
  deleteMock,
  clearMock,
  deleteManyMock,
  syncMock,
  readKeyMock,
  writeKeyMock,
} = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  idbAvailableMock: vi.fn(() => true),
  appendMock: vi.fn().mockResolvedValue(undefined),
  loadMock: vi.fn().mockResolvedValue([]),
  loadByServiceMock: vi.fn().mockResolvedValue([]),
  deleteMock: vi.fn().mockResolvedValue(undefined),
  clearMock: vi.fn().mockResolvedValue(undefined),
  deleteManyMock: vi.fn().mockResolvedValue(undefined),
  syncMock: vi.fn().mockResolvedValue(false),
  readKeyMock: vi.fn().mockResolvedValue(null),
  writeKeyMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('../../../shared/utils/idbGrpcCallHistory', () => ({
  idbAppendGrpcCallHistoryEntry: (...args: unknown[]) => appendMock(...args),
  idbLoadGrpcCallHistoryEntries: (...args: unknown[]) => loadMock(...args),
  idbLoadGrpcCallHistoryByService: (...args: unknown[]) => loadByServiceMock(...args),
  idbDeleteGrpcCallHistoryEntry: (...args: unknown[]) => deleteMock(...args),
  idbClearGrpcCallHistory: (...args: unknown[]) => clearMock(...args),
  idbDeleteGrpcCallHistoryEntries: (...args: unknown[]) => deleteManyMock(...args),
  idbSyncGrpcCallHistoryFromLocalStorage: (...args: unknown[]) => syncMock(...args),
}));

vi.mock('../../../shared/utils/idbHelpers', () => ({
  idbAvailable: () => idbAvailableMock(),
}));

vi.mock('../../../shared/utils/storage', () => ({
  readKey: (...args: unknown[]) => readKeyMock(...args),
  writeKey: (...args: unknown[]) => writeKeyMock(...args),
}));

import {
  appendGrpcCallHistory,
  clearGrpcCallHistory,
  clearGrpcCallHistoryFiltered,
  deleteGrpcCallHistoryEntry,
  loadGrpcCallHistoryEntries,
  resetGrpcCallHistoryPersistQueueForTests,
} from './grpcCallHistoryRecorder';

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
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: 'desc-1',
  };
}

beforeEach(() => {
  isTauriMock.mockReturnValue(false);
  idbAvailableMock.mockReturnValue(true);
  appendMock.mockClear();
  loadMock.mockReset();
  loadMock.mockResolvedValue([]);
  loadByServiceMock.mockReset();
  loadByServiceMock.mockResolvedValue([]);
  deleteMock.mockClear();
  clearMock.mockClear();
  deleteManyMock.mockClear();
  syncMock.mockReset();
  syncMock.mockResolvedValue(false);
  readKeyMock.mockReset();
  readKeyMock.mockResolvedValue(null);
  writeKeyMock.mockClear();
  resetGrpcCallHistoryPersistQueueForTests();
});

describe('grpcCallHistoryRecorder coverage gaps', () => {
  it('returns empty list when IndexedDB is unavailable on web', async () => {
    idbAvailableMock.mockReturnValue(false);
    const entries = await loadGrpcCallHistoryEntries();
    expect(entries).toEqual([]);
    expect(loadMock).not.toHaveBeenCalled();
  });

  it('throws when appending on web without IndexedDB', async () => {
    idbAvailableMock.mockReturnValue(false);
    await expect(appendGrpcCallHistory({ snapshot: snapshot() })).rejects.toThrow(/IndexedDB not available/i);
  });

  it('uses service-only IDB fast path when filtering by service alone', async () => {
    const alpha = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-a',
      snapshot: { ...snapshot(), service: 'alpha.Service' },
    });
    loadByServiceMock.mockResolvedValue([alpha]);
    const entries = await loadGrpcCallHistoryEntries({ service: 'alpha.Service' });
    expect(loadByServiceMock).toHaveBeenCalledWith('alpha.Service');
    expect(loadMock).not.toHaveBeenCalled();
    expect(entries).toHaveLength(1);
  });

  it('returns zero removed when filtered clear matches nothing', async () => {
    loadMock.mockResolvedValue([]);
    const removed = await clearGrpcCallHistoryFiltered({ service: 'missing.Service' });
    expect(removed).toBe(0);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it('removes legacy localStorage key when migrated envelope has zero entries', async () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('legacy'),
      removeItem,
    });
    readKeyMock.mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      entries: [],
    }));

    await loadGrpcCallHistoryEntries();

    expect(removeItem).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('persists through Tauri read/write envelope on load, append, delete, and clear', async () => {
    isTauriMock.mockReturnValue(true);
    const entry = prepareGrpcCallHistoryEntryForPersist({ id: 'h-tauri', snapshot: snapshot() });
    readKeyMock.mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      entries: [entry],
    }));

    const loaded = await loadGrpcCallHistoryEntries();
    expect(loaded).toHaveLength(1);

    await appendGrpcCallHistory({ id: 'h-new', snapshot: snapshot() });
    expect(writeKeyMock).toHaveBeenCalled();

    await deleteGrpcCallHistoryEntry('h-tauri');
    expect(writeKeyMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    await clearGrpcCallHistory();
    const lastWrite = writeKeyMock.mock.calls.at(-1)?.[1] as string;
    expect(JSON.parse(lastWrite).entries).toEqual([]);
  });

  it('clearGrpcCallHistoryFiltered removes rows through Tauri envelope rewrite', async () => {
    isTauriMock.mockReturnValue(true);
    const alpha = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-a',
      snapshot: { ...snapshot(), service: 'alpha.Service' },
    });
    const beta = prepareGrpcCallHistoryEntryForPersist({
      id: 'h-b',
      snapshot: { ...snapshot(), service: 'beta.Service' },
    });
    readKeyMock.mockResolvedValue(JSON.stringify({
      schemaVersion: 1,
      updatedAt: TS,
      entries: [alpha, beta],
    }));

    const removed = await clearGrpcCallHistoryFiltered({ service: 'alpha.Service' });
    expect(removed).toBe(1);
    const lastWrite = writeKeyMock.mock.calls.at(-1)?.[1] as string;
    const persisted = JSON.parse(lastWrite).entries as { id: string }[];
    expect(persisted.map((row) => row.id)).toEqual(['h-b']);
  });

  it('appendGrpcCallHistory accepts explicit entry id', async () => {
    const entry = await appendGrpcCallHistory({ id: 'explicit-id', snapshot: snapshot() });
    expect(entry.id).toBe('explicit-id');
  });

  it('loadEnvelopeFromTauri returns empty array when readKey throws', async () => {
    isTauriMock.mockReturnValue(true);
    readKeyMock.mockRejectedValue(new Error('fs unavailable'));
    const entries = await loadGrpcCallHistoryEntries();
    expect(entries).toEqual([]);
  });
});
