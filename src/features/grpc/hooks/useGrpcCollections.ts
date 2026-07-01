/**
 * Phase 5H — React hook for gRPC collections CRUD (5B repository).
 */
import { useCallback, useEffect, useState } from 'react';
import type { GrpcCollectionsStoreV1, GrpcCollectionV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import {
  addGrpcSavedRequestToStore,
  createGrpcCollectionInStore,
  deleteGrpcCollectionFromStore,
  deleteGrpcSavedRequestFromStore,
  duplicateGrpcCollectionInStore,
  duplicateGrpcSavedRequestInStore,
  loadGrpcCollectionsStoreFromPersistence,
  runGrpcCollectionMutation,
  updateGrpcCollectionInStore,
  updateGrpcSavedRequestInStore,
} from '../data/grpcCollectionRepository';
import { createEmptyGrpcCollectionsStore } from '../../../shared/grpc/grpcPersistenceSchema';

export interface UseGrpcCollectionsResult {
  store: GrpcCollectionsStoreV1;
  collections: GrpcCollectionV1[];
  loading: boolean;
  lastMutationError?: string;
  clearLastMutationError: () => void;
  reload: () => Promise<void>;
  addCollection: (name: string) => Promise<GrpcCollectionV1>;
  renameCollection: (collectionId: string, name: string) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  duplicateCollection: (collectionId: string) => Promise<void>;
  saveRequest: (collectionId: string, saved: GrpcSavedRequest) => Promise<GrpcSavedRequest>;
  updateSavedRequest: (
    collectionId: string,
    savedRequestId: string,
    patch: Partial<GrpcSavedRequest>,
  ) => Promise<void>;
  deleteSavedRequest: (collectionId: string, savedRequestId: string) => Promise<void>;
  duplicateSavedRequest: (collectionId: string, savedRequestId: string) => Promise<GrpcSavedRequest>;
}

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Collection update failed';
}

export function useGrpcCollections(): UseGrpcCollectionsResult {
  const [store, setStore] = useState<GrpcCollectionsStoreV1>(createEmptyGrpcCollectionsStore);
  const [loading, setLoading] = useState(true);
  const [lastMutationError, setLastMutationError] = useState<string | undefined>();

  const clearLastMutationError = useCallback(() => {
    setLastMutationError(undefined);
  }, []);

  const runWithMutationError = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      setLastMutationError(undefined);
      return await operation();
    } catch (error) {
      setLastMutationError(mutationErrorMessage(error));
      throw error;
    }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadGrpcCollectionsStoreFromPersistence();
      setStore(loaded);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addCollection = useCallback(async (name: string): Promise<GrpcCollectionV1> => runWithMutationError(async () => {
    const { store: next, result } = await runGrpcCollectionMutation((current) => {
      const updated = createGrpcCollectionInStore(current, { name });
      const collection = updated.collections[updated.collections.length - 1]!;
      return { store: updated, result: collection };
    });
    setStore(next);
    return result;
  }), [runWithMutationError]);

  const renameCollection = useCallback(async (collectionId: string, name: string) => runWithMutationError(async () => {
    const { store: next } = await runGrpcCollectionMutation((current) => ({
      store: updateGrpcCollectionInStore(current, collectionId, { name }),
      result: undefined,
    }));
    setStore(next);
  }), [runWithMutationError]);

  const deleteCollection = useCallback(async (collectionId: string) => runWithMutationError(async () => {
    const { store: next } = await runGrpcCollectionMutation((current) => ({
      store: deleteGrpcCollectionFromStore(current, collectionId),
      result: undefined,
    }));
    setStore(next);
  }), [runWithMutationError]);

  const duplicateCollection = useCallback(async (collectionId: string) => runWithMutationError(async () => {
    const { store: next } = await runGrpcCollectionMutation((current) => ({
      store: duplicateGrpcCollectionInStore(current, collectionId),
      result: undefined,
    }));
    setStore(next);
  }), [runWithMutationError]);

  const saveRequest = useCallback(async (
    collectionId: string,
    saved: GrpcSavedRequest,
  ): Promise<GrpcSavedRequest> => runWithMutationError(async () => {
    const { store: next, result } = await runGrpcCollectionMutation((current) => ({
      store: addGrpcSavedRequestToStore(current, collectionId, saved),
      result: saved,
    }));
    setStore(next);
    return result;
  }), [runWithMutationError]);

  const updateSavedRequest = useCallback(async (
    collectionId: string,
    savedRequestId: string,
    patch: Partial<GrpcSavedRequest>,
  ) => runWithMutationError(async () => {
    const { store: next } = await runGrpcCollectionMutation((current) => ({
      store: updateGrpcSavedRequestInStore(current, collectionId, savedRequestId, patch),
      result: undefined,
    }));
    setStore(next);
  }), [runWithMutationError]);

  const deleteSavedRequest = useCallback(async (collectionId: string, savedRequestId: string) => runWithMutationError(async () => {
    const { store: next } = await runGrpcCollectionMutation((current) => ({
      store: deleteGrpcSavedRequestFromStore(current, collectionId, savedRequestId),
      result: undefined,
    }));
    setStore(next);
  }), [runWithMutationError]);

  const duplicateSavedRequest = useCallback(async (
    collectionId: string,
    savedRequestId: string,
  ): Promise<GrpcSavedRequest> => runWithMutationError(async () => {
    const { store: next, result } = await runGrpcCollectionMutation((current) => {
      const updated = duplicateGrpcSavedRequestInStore(current, collectionId, savedRequestId);
      const collection = updated.collections.find((entry) => entry.id === collectionId);
      const copy = collection?.savedRequests[collection.savedRequests.length - 1];
      if (!copy) throw new Error('Duplicate saved request failed');
      return { store: updated, result: copy };
    });
    setStore(next);
    return result;
  }), [runWithMutationError]);

  return {
    store,
    collections: store.collections,
    loading,
    lastMutationError,
    clearLastMutationError,
    reload,
    addCollection,
    renameCollection,
    deleteCollection,
    duplicateCollection,
    saveRequest,
    updateSavedRequest,
    deleteSavedRequest,
    duplicateSavedRequest,
  };
}
