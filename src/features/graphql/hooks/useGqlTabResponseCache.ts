import { useCallback, useRef, useState } from 'react';
import type { GraphqlResponse } from '@shared/types/graphql';
import type { ApqInfo, ExecutionStatus } from './useGraphqlExecution';

export interface TabExecutionSnapshot {
  status: ExecutionStatus;
  response: GraphqlResponse | null;
  /** Last APQ metadata for this tab's most recent completed execution (Phase 6D). */
  apqInfo?: ApqInfo | null;
  /** In-flight multipart upload progress for this tab (Phase 6D-6). */
  uploadProgress?: number | null;
}

export interface TabResponsePaneState {
  response: GraphqlResponse | null;
  execStatus: ExecutionStatus;
  executing: boolean;
}

/**
 * Resolves which response/status the right pane should show for the active tab.
 * Live execution state applies only when the in-flight request belongs to activeTabId.
 */
export function resolveTabResponsePaneState(
  activeTabId: string,
  executingTabId: string | null,
  liveStatus: ExecutionStatus,
  liveResponse: GraphqlResponse | null,
  cache: ReadonlyMap<string, TabExecutionSnapshot>,
): TabResponsePaneState {
  if (executingTabId === activeTabId) {
    if (liveStatus === 'loading') {
      return { response: liveResponse, execStatus: liveStatus, executing: true };
    }
    if (liveStatus === 'success' || liveStatus === 'error') {
      return { response: liveResponse, execStatus: liveStatus, executing: false };
    }
  }

  const cached = cache.get(activeTabId);
  if (cached) {
    return {
      response: cached.response,
      execStatus: cached.status,
      executing: false,
    };
  }

  return { response: null, execStatus: 'idle', executing: false };
}

/**
 * Resolves APQ badge metadata for the active tab's connection bar (Phase 6D).
 * Live hook state applies only when the in-flight/completed execution belongs to activeTabId.
 */
export function resolveActiveTabApqInfo(
  activeTabId: string,
  executingTabId: string | null,
  liveApqInfo: ApqInfo | null,
  cache: ReadonlyMap<string, TabExecutionSnapshot>,
): ApqInfo | null {
  if (executingTabId === activeTabId) {
    return liveApqInfo;
  }
  const cached = cache.get(activeTabId)?.apqInfo;
  return cached ?? null;
}

/**
 * Resolves multipart upload progress for the active tab (Phase 6D-6).
 * Progress is cached per tab so switching away during upload does not reset the bar.
 */
export function resolveActiveTabUploadProgress(
  activeTabId: string,
  cache: ReadonlyMap<string, TabExecutionSnapshot>,
): number | null {
  const progress = cache.get(activeTabId)?.uploadProgress;
  return progress ?? null;
}

export interface UseGqlTabResponseCacheResult {
  responseCache: Map<string, TabExecutionSnapshot>;
  executingTabIdRef: React.MutableRefObject<string | null>;
  markExecutionStarted: (tabId: string) => void;
  cacheExecutionResult: (
    tabId: string,
    status: ExecutionStatus,
    response: GraphqlResponse | null,
    apqInfo?: ApqInfo | null,
  ) => void;
  getCachedApqInfo: (tabId: string) => ApqInfo | null | undefined;
  setTabUploadProgress: (tabId: string, progress: number | null) => void;
  removeTabFromCache: (tabId: string) => void;
  resolvePaneState: (
    activeTabId: string,
    liveStatus: ExecutionStatus,
    liveResponse: GraphqlResponse | null,
  ) => TabResponsePaneState;
}

/** Phase 6 PT-4A — per-tab HTTP response cache for the right pane. */
export function useGqlTabResponseCache(): UseGqlTabResponseCacheResult {
  const [responseCache, setResponseCache] = useState<Map<string, TabExecutionSnapshot>>(() => new Map());
  const executingTabIdRef = useRef<string | null>(null);
  /** Tab ids removed via close — blocks late completion callbacks from repopulating cache (Phase 6D+6E). */
  const evictedTabIdsRef = useRef<Set<string>>(new Set());

  const markExecutionStarted = useCallback((tabId: string) => {
    executingTabIdRef.current = tabId;
  }, []);

  const cacheExecutionResult = useCallback(
    (
      tabId: string,
      status: ExecutionStatus,
      response: GraphqlResponse | null,
      apqInfo?: ApqInfo | null,
    ) => {
      if (evictedTabIdsRef.current.has(tabId)) return;
      setResponseCache((prev) => {
        const existing = prev.get(tabId);
        const snapshot: TabExecutionSnapshot = {
          status,
          response,
          apqInfo: apqInfo !== undefined ? apqInfo : existing?.apqInfo,
          uploadProgress: undefined,
        };
        return new Map(prev).set(tabId, snapshot);
      });
    },
    [],
  );

  const setTabUploadProgress = useCallback((tabId: string, progress: number | null) => {
    if (evictedTabIdsRef.current.has(tabId)) return;
    setResponseCache((prev) => {
      const existing = prev.get(tabId);
      const snapshot: TabExecutionSnapshot = {
        status: existing?.status ?? 'loading',
        response: existing?.response ?? null,
        apqInfo: existing?.apqInfo,
        uploadProgress: progress === null ? undefined : progress,
      };
      return new Map(prev).set(tabId, snapshot);
    });
  }, []);

  const getCachedApqInfo = useCallback(
    (tabId: string) => responseCache.get(tabId)?.apqInfo,
    [responseCache],
  );

  const removeTabFromCache = useCallback((tabId: string) => {
    evictedTabIdsRef.current.add(tabId);
    setResponseCache((prev) => {
      if (!prev.has(tabId)) return prev;
      const next = new Map(prev);
      next.delete(tabId);
      return next;
    });
    if (executingTabIdRef.current === tabId) {
      executingTabIdRef.current = null;
    }
  }, []);

  const resolvePaneState = useCallback(
    (activeTabId: string, liveStatus: ExecutionStatus, liveResponse: GraphqlResponse | null) =>
      resolveTabResponsePaneState(
        activeTabId,
        executingTabIdRef.current,
        liveStatus,
        liveResponse,
        responseCache,
      ),
    [responseCache],
  );

  return {
    responseCache,
    executingTabIdRef,
    markExecutionStarted,
    cacheExecutionResult,
    getCachedApqInfo,
    setTabUploadProgress,
    removeTabFromCache,
    resolvePaneState,
  };
}
