/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createEmptyGrpcCollectionsStore,
  type GrpcCollectionsStoreV1,
} from '../../../shared/grpc/grpcPersistenceSchema';
import {
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../../shared/grpc/contractFixtures';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';

const loadMock = vi.fn();
const mutateMock = vi.fn();

vi.mock('../data/grpcCollectionRepository', () => ({
  loadGrpcCollectionsStoreFromPersistence: (...args: unknown[]) => loadMock(...args),
  runGrpcCollectionMutation: (fn: (store: GrpcCollectionsStoreV1) => unknown) => mutateMock(fn),
  createGrpcCollectionInStore: (store: GrpcCollectionsStoreV1, input: { name: string }) => ({
    ...store,
    collections: [...store.collections, { id: 'col-new', name: input.name, savedRequests: [] }],
  }),
  updateGrpcCollectionInStore: (store: GrpcCollectionsStoreV1, id: string, patch: { name: string }) => ({
    ...store,
    collections: store.collections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  }),
  deleteGrpcCollectionFromStore: (store: GrpcCollectionsStoreV1, id: string) => ({
    ...store,
    collections: store.collections.filter((c) => c.id !== id),
  }),
  duplicateGrpcCollectionInStore: (store: GrpcCollectionsStoreV1, id: string) => ({
    ...store,
    collections: [
      ...store.collections,
      {
        id: 'col-dup',
        name: `${store.collections.find((c) => c.id === id)?.name ?? 'Copy'} (copy)`,
        savedRequests: [],
      },
    ],
  }),
  addGrpcSavedRequestToStore: (store: GrpcCollectionsStoreV1, collectionId: string, saved: { id: string }) => ({
    ...store,
    collections: store.collections.map((c) => (
      c.id === collectionId
        ? { ...c, savedRequests: [...c.savedRequests, saved] }
        : c
    )),
  }),
  updateGrpcSavedRequestInStore: (
    store: GrpcCollectionsStoreV1,
    collectionId: string,
    savedId: string,
    patch: { name?: string },
  ) => ({
    ...store,
    collections: store.collections.map((c) => (
      c.id === collectionId
        ? {
          ...c,
          savedRequests: c.savedRequests.map((s) => (
            s.id === savedId ? { ...s, ...patch } : s
          )),
        }
        : c
    )),
  }),
  deleteGrpcSavedRequestFromStore: (
    store: GrpcCollectionsStoreV1,
    collectionId: string,
    savedId: string,
  ) => ({
    ...store,
    collections: store.collections.map((c) => (
      c.id === collectionId
        ? { ...c, savedRequests: c.savedRequests.filter((s) => s.id !== savedId) }
        : c
    )),
  }),
  duplicateGrpcSavedRequestInStore: (
    store: GrpcCollectionsStoreV1,
    collectionId: string,
    savedId: string,
  ) => ({
    ...store,
    collections: store.collections.map((c) => {
      if (c.id !== collectionId) return c;
      const source = c.savedRequests.find((s) => s.id === savedId);
      if (!source) return c;
      return {
        ...c,
        savedRequests: [...c.savedRequests, { ...source, id: 'saved-dup', name: `${source.name} (copy)` }],
      };
    }),
  }),
}));

import { useGrpcCollections } from './useGrpcCollections';

const TS = '2026-06-29T12:00:00.000Z';

function seedStore(): GrpcCollectionsStoreV1 {
  const saved = createGrpcSavedRequestFromSnapshot(
    {
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
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    { id: 'saved-1', revisionId: 'rev-1', updatedAt: TS, name: 'Echo' },
  );
  return {
    version: 1,
    collections: [{ id: 'col-1', name: 'Alpha', savedRequests: [saved] }],
  };
}

beforeEach(() => {
  loadMock.mockReset();
  loadMock.mockResolvedValue(seedStore());
  mutateMock.mockReset();
  mutateMock.mockImplementation(async (fn: (store: GrpcCollectionsStoreV1) => unknown) => fn(seedStore()));
});

describe('useGrpcCollections coverage gaps (Phase 5H)', () => {
  it('reload refreshes store from persistence', async () => {
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.collections).toHaveLength(1);

    loadMock.mockResolvedValueOnce(createEmptyGrpcCollectionsStore());
    await act(async () => { await result.current.reload(); });
    expect(result.current.collections).toHaveLength(0);
  });

  it('renameCollection updates local store', async () => {
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.renameCollection('col-1', 'Renamed'); });
    expect(result.current.collections[0]?.name).toBe('Renamed');
  });

  it('deleteCollection removes collection', async () => {
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.deleteCollection('col-1'); });
    expect(result.current.collections).toHaveLength(0);
  });

  it('duplicateCollection appends copy', async () => {
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.duplicateCollection('col-1'); });
    expect(result.current.collections).toHaveLength(2);
  });

  it('saveRequest adds saved request to collection', async () => {
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: 'tab-1',
        requestId: 'req-2',
        capturedAt: TS,
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      { id: 'saved-2', revisionId: 'rev-2', updatedAt: TS, name: 'Second' },
    );

    await act(async () => { await result.current.saveRequest('col-1', saved); });
    expect(result.current.collections[0]?.savedRequests).toHaveLength(2);
  });

  it('updateSavedRequest and deleteSavedRequest mutate store', async () => {
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateSavedRequest('col-1', 'saved-1', { name: 'Updated' });
    });
    expect(result.current.collections[0]?.savedRequests[0]?.name).toBe('Updated');

    await act(async () => {
      await result.current.deleteSavedRequest('col-1', 'saved-1');
    });
    expect(result.current.collections[0]?.savedRequests).toHaveLength(0);
  });

  it('duplicateSavedRequest returns new copy', async () => {
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let copy: Awaited<ReturnType<typeof result.current.duplicateSavedRequest>>;
    await act(async () => {
      copy = await result.current.duplicateSavedRequest('col-1', 'saved-1');
    });
    expect(copy!.id).toBe('saved-dup');
    expect(result.current.collections[0]?.savedRequests).toHaveLength(2);
  });

  it('clearLastMutationError clears surfaced error', async () => {
    mutateMock.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try {
        await result.current.addCollection('X');
      } catch { /* rethrows */ }
    });
    expect(result.current.lastMutationError).toBe('fail');

    act(() => { result.current.clearLastMutationError(); });
    expect(result.current.lastMutationError).toBeUndefined();
  });

  it('duplicateSavedRequest throws when source is missing', async () => {
    mutateMock.mockImplementationOnce(async (fn: (store: GrpcCollectionsStoreV1) => unknown) => {
      const empty = createEmptyGrpcCollectionsStore();
      return fn({
        ...empty,
        collections: [{ id: 'col-1', name: 'Alpha', savedRequests: [] }],
      });
    });

    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try {
        await result.current.duplicateSavedRequest('col-1', 'missing');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
    expect(result.current.lastMutationError).toMatch(/Duplicate saved request failed/i);
  });

  it('surfaces addCollection mutation failure', async () => {
    mutateMock.mockRejectedValueOnce('string-fail');
    const { result } = renderHook(() => useGrpcCollections());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try {
        await result.current.renameCollection('col-1', 'Y');
      } catch { /* rethrows */ }
    });
    expect(result.current.lastMutationError).toBe('Collection update failed');
  });
});
