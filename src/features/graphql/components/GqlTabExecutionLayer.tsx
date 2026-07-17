import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import { useGraphqlExecution } from '../hooks/useGraphqlExecution';
import type { ExecuteParams } from '../hooks/useGraphqlExecution';
import { stampAuthHeaders } from '../utils/authUtils';
import type { GqlAuthSentSource } from '../utils/gqlAuthResolve';
import type { GqlTabExecutionHandle, GqlTabExecutionState } from '../types/gqlTabExecution';

export interface GqlTabExecutionLayerProps {
  tabId: string;
  /** Phase 6F — profile-scoped auth for this tab (from resolveTabConnection). */
  resolvedAuth?: GraphqlAuth | null;
  /** Phase 6H — where resolved auth credentials originated. */
  authSentSource?: GqlAuthSentSource;
  /** Global auth profiles for inherit resolution. */
  globalAuthProfiles?: GlobalAuthProfile[];
  onExecutionCompleted?: ExecuteParams['onExecutionCompleted'];
  onRegister: (tabId: string, handle: GqlTabExecutionHandle) => void;
  onUnregister: (tabId: string) => void;
  /** Called when this tab's execution state changes (not on every handle identity refresh). */
  onStateChange?: (tabId: string) => void;
}

/**
 * Phase 6E — invisible per-tab execution shell (WebSocket Studio parity).
 * Owns one `useGraphqlExecution` instance while the tab is mounted.
 */
export function GqlTabExecutionLayer({
  tabId,
  resolvedAuth = null,
  authSentSource = 'page',
  globalAuthProfiles = [],
  onExecutionCompleted,
  onRegister,
  onUnregister,
  onStateChange,
}: GqlTabExecutionLayerProps) {
  const {
    status,
    response,
    apqInfo,
    isDuplicate,
    duplicateSourceTabId,
    execute,
    cancel,
    resolveDedupChoice,
    applyResult,
  } = useGraphqlExecution();

  const resolvedAuthRef = useRef(resolvedAuth);
  resolvedAuthRef.current = resolvedAuth;
  const authSentSourceRef = useRef(authSentSource);
  authSentSourceRef.current = authSentSource;
  const globalAuthProfilesRef = useRef(globalAuthProfiles);
  globalAuthProfilesRef.current = globalAuthProfiles;

  const stateRef = useRef<GqlTabExecutionState>({
    status,
    response,
    apqInfo,
    isDuplicate,
    duplicateSourceTabId,
  });
  stateRef.current = {
    status,
    response,
    apqInfo,
    isDuplicate,
    duplicateSourceTabId,
  };

  const wrappedExecute = useCallback(
    (params: ExecuteParams) => {
      const incomingHeaders = params.headers ?? {};
      const resolvedAuthHeaderKeys = Object.keys(
        stampAuthHeaders({}, resolvedAuthRef.current, globalAuthProfilesRef.current),
      );
      const hasResolvedAuthAlready = resolvedAuthHeaderKeys.some((key) =>
        Object.prototype.hasOwnProperty.call(incomingHeaders, key),
      );
      const finalHeaders = hasResolvedAuthAlready
        ? incomingHeaders
        : stampAuthHeaders(incomingHeaders, resolvedAuthRef.current, globalAuthProfilesRef.current);

      execute({
        ...params,
        headers: finalHeaders,
        authSentStamp: {
          source: authSentSourceRef.current,
          storedAuth: resolvedAuthRef.current,
          globalAuthProfiles: globalAuthProfilesRef.current,
        },
        sourceTabId: tabId,
        onExecutionCompleted,
      });
    },
    [execute, tabId, onExecutionCompleted],
  );

  const handle = useMemo<GqlTabExecutionHandle>(
    () => ({
      execute: wrappedExecute,
      cancel,
      resolveDedupChoice,
      applyResult,
      getState: () => stateRef.current,
    }),
    [wrappedExecute, cancel, resolveDedupChoice, applyResult],
  );

  useLayoutEffect(() => {
    onRegister(tabId, handle);
    return () => onUnregister(tabId);
  }, [tabId, handle, onRegister, onUnregister]);

  useLayoutEffect(() => {
    onStateChange?.(tabId);
  }, [status, response, apqInfo, isDuplicate, duplicateSourceTabId, tabId, onStateChange]);

  return null;
}
