/**
 * Phase 5H — React hook for call history load/filter/clear (5D recorder).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import {
  clearGrpcCallHistory,
  clearGrpcCallHistoryFiltered,
  deleteGrpcCallHistoryEntry,
  loadGrpcCallHistoryEntries,
} from '../data/grpcCallHistoryRecorder';
import {
  collectGrpcCallHistoryFilterOptions,
  filterGrpcCallHistoryEntries,
  type GrpcCallHistoryFilters,
} from '../utils/grpcHistoryFilters';
import { GRPC_CALL_HISTORY_UPDATED_EVENT } from '../utils/grpcStudioCallHistoryCapture';

export interface UseGrpcCallHistoryResult {
  entries: GrpcCallHistoryEntryV1[];
  filteredEntries: GrpcCallHistoryEntryV1[];
  filters: GrpcCallHistoryFilters;
  filterOptions: ReturnType<typeof collectGrpcCallHistoryFilterOptions>;
  loading: boolean;
  lastMutationError?: string;
  clearLastMutationError: () => void;
  setFilters: (patch: Partial<GrpcCallHistoryFilters>) => void;
  reload: () => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  clearFiltered: () => Promise<void>;
}

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'History update failed';
}

export function useGrpcCallHistory(): UseGrpcCallHistoryResult {
  const [entries, setEntries] = useState<GrpcCallHistoryEntryV1[]>([]);
  const [filters, setFiltersState] = useState<GrpcCallHistoryFilters>({});
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
      const loaded = await loadGrpcCallHistoryEntries();
      setEntries(loaded);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onUpdated = () => { void reload(); };
    window.addEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(GRPC_CALL_HISTORY_UPDATED_EVENT, onUpdated);
  }, [reload]);

  const setFilters = useCallback((patch: Partial<GrpcCallHistoryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const filteredEntries = useMemo(
    () => filterGrpcCallHistoryEntries(entries, filters),
    [entries, filters],
  );

  const filterOptions = useMemo(
    () => collectGrpcCallHistoryFilterOptions(entries),
    [entries],
  );

  const deleteEntry = useCallback(async (id: string) => runWithMutationError(async () => {
    await deleteGrpcCallHistoryEntry(id);
    await reload();
  }), [reload, runWithMutationError]);

  const clearAll = useCallback(async () => runWithMutationError(async () => {
    await clearGrpcCallHistory();
    await reload();
  }), [reload, runWithMutationError]);

  const clearFiltered = useCallback(async () => runWithMutationError(async () => {
    await clearGrpcCallHistoryFiltered(filters);
    await reload();
  }), [filters, reload, runWithMutationError]);

  return {
    entries,
    filteredEntries,
    filters,
    filterOptions,
    loading,
    lastMutationError,
    clearLastMutationError,
    setFilters,
    reload,
    deleteEntry,
    clearAll,
    clearFiltered,
  };
}
