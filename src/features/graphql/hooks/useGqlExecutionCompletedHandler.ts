import { useCallback, useRef } from 'react';
import type { GraphqlEnvironment, GraphqlResponse } from '../../../shared/types/graphql';
import type { ApqInfo, ExecutionStatus } from './useGraphqlExecution';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import { resolveTabRawEndpoint } from '../utils/tabConnectionResolution';
import { normalizeGraphqlEndpoint } from '../utils/graphqlEndpointUtils';
import { resolveVars } from '../utils/envUtils';
import type { UseGraphqlHistoryResult } from './useGraphqlHistory';

export interface UseGqlExecutionCompletedHandlerParams {
  cacheExecutionResult: (
    tabId: string,
    status: ExecutionStatus,
    response: GraphqlResponse | null,
    apqInfo?: ApqInfo | null,
  ) => void;
  tabs: GqlStudioTab[];
  pageEndpoint: string;
  profiles: ConnectionProfile[];
  activeEnvironment: GraphqlEnvironment | null;
  globalEnvMap: Record<string, string>;
  saveHistory: UseGraphqlHistoryResult['saveHistory'];
}

/** Phase 6 — cache per-tab results and save history keyed to the request's source tab. */
export function useGqlExecutionCompletedHandler({
  cacheExecutionResult,
  tabs,
  pageEndpoint,
  profiles,
  activeEnvironment,
  globalEnvMap,
  saveHistory,
}: UseGqlExecutionCompletedHandlerParams): (
  tabId: string,
  status: ExecutionStatus,
  response: GraphqlResponse | null,
  apqInfo?: ApqInfo | null,
) => void {
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const pageEndpointRef = useRef(pageEndpoint);
  pageEndpointRef.current = pageEndpoint;
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const activeEnvironmentRef = useRef(activeEnvironment);
  activeEnvironmentRef.current = activeEnvironment;
  const globalEnvMapRef = useRef(globalEnvMap);
  globalEnvMapRef.current = globalEnvMap;

  return useCallback((
    tabId: string,
    status: ExecutionStatus,
    response: GraphqlResponse | null,
    apqInfo?: ApqInfo | null,
  ) => {
    const executedTab = tabsRef.current.find((t) => t.id === tabId);
    if (!executedTab) return;

    cacheExecutionResult(tabId, status, response, apqInfo);

    if (status !== 'success' && status !== 'error') return;
    const executedTabEndpoint = normalizeGraphqlEndpoint(
      resolveVars(
        resolveTabRawEndpoint(executedTab, profilesRef.current, pageEndpointRef.current),
        activeEnvironmentRef.current,
        globalEnvMapRef.current,
      ),
    );
    if (!executedTabEndpoint.trim() || !response) return;

    saveHistory({
      connectionId: executedTabEndpoint,
      operation: {
        id: executedTab.id,
        name: executedTab.selectedOperation ?? (executedTab.label !== 'Untitled' ? executedTab.label : undefined),
        query: executedTab.query,
        variables: executedTab.variables,
        operationType: (executedTab.operationType ?? 'query') as 'query' | 'mutation' | 'subscription',
      },
      response,
    }).catch(() => {});
  }, [cacheExecutionResult, saveHistory]);
}
