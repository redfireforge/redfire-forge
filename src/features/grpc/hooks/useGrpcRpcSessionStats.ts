/**
 * Phase 11K — React bridge for per-tab RPC session statistics.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getGrpcRpcSessionStats,
  getGrpcRpcSessionSummary,
  GRPC_RPC_STATS_UPDATED_EVENT,
  pruneGrpcRpcSessionStatsForTabs,
  resetGrpcRpcSessionStats,
} from '@shared/grpc/grpcRpcSessionStats';

export interface UseGrpcRpcSessionStatsResult {
  rpcSessionStats: ReturnType<typeof getGrpcRpcSessionStats>;
  rpcSessionSummary: ReturnType<typeof getGrpcRpcSessionSummary>;
  resetRpcSessionStats: () => void;
}

export function useGrpcRpcSessionStats(
  tabId: string | undefined,
  liveTabIds: ReadonlySet<string>,
): UseGrpcRpcSessionStatsResult {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    pruneGrpcRpcSessionStatsForTabs(liveTabIds);
  }, [liveTabIds]);

  useEffect(() => {
    if (!tabId) {
      return undefined;
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tabId?: string }>).detail;
      if (!detail?.tabId || detail.tabId === tabId) {
        setRevision((value) => value + 1);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(GRPC_RPC_STATS_UPDATED_EVENT, handler);
      return () => window.removeEventListener(GRPC_RPC_STATS_UPDATED_EVENT, handler);
    }
    return undefined;
  }, [tabId]);

  const rpcSessionStats = useMemo(
    () => {
      void revision;
      return getGrpcRpcSessionStats(tabId ?? '');
    },
    [tabId, revision],
  );

  const rpcSessionSummary = useMemo(
    () => {
      void revision;
      return getGrpcRpcSessionSummary(tabId ?? '');
    },
    [tabId, revision],
  );

  const resetRpcSessionStats = useCallback(() => {
    if (!tabId) return;
    resetGrpcRpcSessionStats(tabId);
  }, [tabId]);

  return {
    rpcSessionStats,
    rpcSessionSummary,
    resetRpcSessionStats,
  };
}
