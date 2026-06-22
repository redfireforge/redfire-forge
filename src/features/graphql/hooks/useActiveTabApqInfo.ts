import { useMemo } from 'react';
import type { ApqInfo, ExecutionStatus } from './useGraphqlExecution';
import { resolveActiveTabApqInfo, type TabExecutionSnapshot } from './useGqlTabResponseCache';

/** Phase 6D — connection-bar APQ badge for the active tab (live or cached). */
export function useActiveTabApqInfo(
  activeTabId: string,
  executingTabIdRef: React.MutableRefObject<string | null>,
  liveApqInfo: ApqInfo | null,
  responseCache: ReadonlyMap<string, TabExecutionSnapshot>,
  execStatus: ExecutionStatus,
): ApqInfo | null {
  return useMemo(
    () => {
      // execStatus busts APQ badge when a run completes (even though resolver ignores status).
      void execStatus;
      return resolveActiveTabApqInfo(
        activeTabId,
        executingTabIdRef.current,
        liveApqInfo,
        responseCache,
      );
    },
    [activeTabId, liveApqInfo, responseCache, execStatus, executingTabIdRef],
  );
}
