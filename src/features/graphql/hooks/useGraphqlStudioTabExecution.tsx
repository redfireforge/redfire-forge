import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';
import { GqlTabExecutionLayer } from '../components/GqlTabExecutionLayer';
import type { ExecuteParams } from './useGraphqlExecution';
import {
  IDLE_GQL_TAB_EXECUTION_STATE,
  type GqlTabExecutionState,
} from '../types/gqlTabExecution';
import type { DedupChoice } from '../utils/dedupExecution';
import { useGqlTabExecutionRegistry } from './useGqlTabExecutionRegistry';
import {
  resolveTabConnection,
  type TabConnectionPageDefaults,
} from '../utils/tabConnectionResolution';

export interface UseGraphqlStudioTabExecutionParams {
  tabs: GqlStudioTab[];
  activeTabId: string;
  /** Saved connection profiles for per-tab auth resolution (Phase 6F). */
  profiles?: ConnectionProfile[];
  /** Page-level connection defaults — fallback when tab has no profile link. */
  pageDefaults?: TabConnectionPageDefaults;
  /** Global auth profiles for inherit resolution at execute time. */
  globalAuthProfiles?: GlobalAuthProfile[];
  onExecutionCompleted?: ExecuteParams['onExecutionCompleted'];
}

export interface UseGraphqlStudioTabExecutionResult {
  activeState: GqlTabExecutionState;
  execute: (params: ExecuteParams) => void;
  cancel: () => void;
  cancelTab: (tabId: string) => void;
  resolveDedupChoice: (choice: DedupChoice) => void;
  isTabExecuting: (tabId: string) => boolean;
  executionLayers: ReactNode;
}

const EMPTY_PROFILES: ConnectionProfile[] = [];

const DEFAULT_PAGE_DEFAULTS: TabConnectionPageDefaults = {
  endpoint: '',
  auth: null,
  skipTlsVerify: false,
  pollingEnabled: false,
  pollingIntervalSeconds: 30,
};

/** Phase 6E — wire per-tab execution layers + active-tab handle for the studio page. */
export function useGraphqlStudioTabExecution({
  tabs,
  activeTabId,
  profiles = EMPTY_PROFILES,
  pageDefaults = DEFAULT_PAGE_DEFAULTS,
  globalAuthProfiles = [],
  onExecutionCompleted,
}: UseGraphqlStudioTabExecutionParams): UseGraphqlStudioTabExecutionResult {
  const { register, unregister, getHandle, notifyStateChange, version } = useGqlTabExecutionRegistry();

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const getHandleRef = useRef(getHandle);
  getHandleRef.current = getHandle;

  const tabResolvedAuth = useMemo(() => {
    const map = new Map<string, GraphqlAuth | null>();
    for (const tab of tabs) {
      map.set(tab.id, resolveTabConnection(tab, profiles, pageDefaults).auth);
    }
    return map;
  }, [tabs, profiles, pageDefaults]);

  const activeHandle = useMemo(
    () => getHandle(activeTabId),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version forces refresh when any tab's handle updates
    [getHandle, activeTabId, version],
  );

  const activeState = useMemo(
    () => activeHandle?.getState() ?? IDLE_GQL_TAB_EXECUTION_STATE,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version forces refresh when any tab's handle updates
    [activeHandle, version],
  );

  const execute = useCallback((params: ExecuteParams) => {
    getHandleRef.current(activeTabIdRef.current)?.execute(params);
  }, []);

  const cancel = useCallback(() => {
    getHandleRef.current(activeTabIdRef.current)?.cancel();
  }, []);

  const cancelTab = useCallback((tabId: string) => {
    getHandleRef.current(tabId)?.cancel();
  }, []);

  const resolveDedupChoice = useCallback((choice: DedupChoice) => {
    getHandleRef.current(activeTabIdRef.current)?.resolveDedupChoice(choice);
  }, []);

  const isTabExecuting = useCallback((tabId: string) => {
    return getHandleRef.current(tabId)?.getState().status === 'loading';
  }, []);

  const executionLayers = useMemo(
    () => tabs.map((tab) => (
      <GqlTabExecutionLayer
        key={tab.id}
        tabId={tab.id}
        resolvedAuth={tabResolvedAuth.get(tab.id) ?? pageDefaults.auth}
        globalAuthProfiles={globalAuthProfiles}
        onExecutionCompleted={onExecutionCompleted}
        onRegister={register}
        onUnregister={unregister}
        onStateChange={notifyStateChange}
      />
    )),
    [tabs, tabResolvedAuth, pageDefaults.auth, globalAuthProfiles, onExecutionCompleted, register, unregister, notifyStateChange],
  );

  return {
    activeState,
    execute,
    cancel,
    cancelTab,
    resolveDedupChoice,
    isTabExecuting,
    executionLayers,
  };
}
