/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createEmptyGrpcCollectionsStore } from '../../../shared/grpc/grpcPersistenceSchema';

const loadMock = vi.fn();
const mutateMock = vi.fn();

vi.mock('../data/grpcCollectionRepository', () => ({
  loadGrpcCollectionsStoreFromPersistence: (...args: unknown[]) => loadMock(...args),
  runGrpcCollectionMutation: (fn: (store: unknown) => unknown) => mutateMock(fn),
  exportGrpcCollectionsStore: vi.fn().mockResolvedValue({
    _exportMeta: {
      version: '1.0',
      exportedAt: '2026-07-01T00:00:00.000Z',
      source: 'RedfireForge/gRPC',
    },
    store: createEmptyGrpcCollectionsStore(),
  }),
  importGrpcCollectionsStore: vi.fn().mockResolvedValue(createEmptyGrpcCollectionsStore()),
  createGrpcCollectionInStore: (store: ReturnType<typeof createEmptyGrpcCollectionsStore>, input: { name: string }) => ({
    ...store,
    collections: [...store.collections, { id: 'col-1', name: input.name, savedRequests: [] }],
  }),
  updateGrpcCollectionInStore: vi.fn(),
  deleteGrpcCollectionFromStore: vi.fn(),
  duplicateGrpcCollectionInStore: vi.fn(),
  addGrpcSavedRequestToStore: vi.fn(),
  updateGrpcSavedRequestInStore: vi.fn(),
  deleteGrpcSavedRequestFromStore: vi.fn(),
  duplicateGrpcSavedRequestInStore: vi.fn(),
  incrementGrpcSavedRequestRunStatsInStore: vi.fn((store) => store),
}));

import { useGrpcCollections } from './useGrpcCollections';

beforeEach(() => {
  loadMock.mockReset();
  loadMock.mockResolvedValue(createEmptyGrpcCollectionsStore());
  mutateMock.mockReset();
});

describe('useGrpcCollections (Phase 5H)', () => {
  it('loads store on mount', async () => {
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.collections).toEqual([]);
  });

  it('addCollection runs mutation and updates local store', async () => {
    mutateMock.mockImplementation(async (fn: (store: unknown) => unknown) => fn(createEmptyGrpcCollectionsStore()));

    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const created = await act(async () => result.current.addCollection('Alpha'));
    expect(created.id).toBe('col-1');
    await waitFor(() => expect(result.current.collections).toHaveLength(1));
  });

  it('surfaces mutation errors without throwing to callers that catch', async () => {
    mutateMock.mockRejectedValue(new Error('IDB write failed'));

    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try {
        await result.current.addCollection('Alpha');
      } catch {
        /* hook rethrows after recording lastMutationError */
      }
    });
    expect(result.current.lastMutationError).toBe('IDB write failed');
  });
});
