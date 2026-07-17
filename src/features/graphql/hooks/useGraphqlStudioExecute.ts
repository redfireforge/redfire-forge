import { useCallback, useRef } from 'react';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GraphqlAuth, GraphqlEnvironment } from '../../../shared/types/graphql';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';
import type { FileEntry } from '../utils/multipartBuilder';
import { buildMultipartFormData } from '../utils/multipartBuilder';
import { findUnresolvedVars, resolveVars } from '../utils/envUtils';
import { normalizeGraphqlEndpoint } from '../utils/graphqlEndpointUtils';
import { buildGraphqlSchemaHeaders } from '../utils/graphqlStudioEnvUtils';
import type { ComplexityResult } from '../utils/complexityEstimator';
import type { useGraphqlExecution } from './useGraphqlExecution';

type ExecuteFn = ReturnType<typeof useGraphqlExecution>['execute'];

/** Prefer the live Monaco model when it matches the active tab — tab state can lag programmatic edits. */
export function resolveLiveGqlQuery(
  activeTab: GqlStudioTab,
  editorMountRef?: React.MutableRefObject<import('monaco-editor').editor.IStandaloneCodeEditor | null>,
): string {
  const editor = editorMountRef?.current;
  const model = editor?.getModel();
  if (model && model.uri.toString() === activeTab.modelUri) {
    return model.getValue();
  }
  return activeTab.query;
}

export interface UseGraphqlStudioExecuteParams {
  activeTab: GqlStudioTab | undefined;
  resolvedTabEndpoint: string;
  selectedOperation: string | undefined;
  activeTabHeaders: Record<string, string>;
  auth: GraphqlAuth | null;
  globalAuthProfiles?: GlobalAuthProfile[];
  activeEnvironment: GraphqlEnvironment | null;
  globalEnvMap: Record<string, string>;
  skipTlsVerify: boolean;
  resolvedTabTls?: GqlTlsSettings;
  fileEntries: FileEntry[];
  executing: boolean;
  /** Phase 6D-6 — true while the upload source tab (not necessarily active tab) is executing. */
  isTabExecutingRef: React.MutableRefObject<(tabId: string) => boolean>;
  complexityResult: ComplexityResult | null;
  complexityWarningPending: boolean;
  setComplexityWarningPending: (pending: boolean) => void;
  complexityGatePending: boolean;
  setComplexityGatePending: (pending: boolean) => void;
  pendingExecuteAfterGateRef: React.MutableRefObject<(() => void) | null>;
  skipComplexityGateRef: React.MutableRefObject<boolean>;
  sessionBypassComplexityGateRef: React.MutableRefObject<boolean>;
  advSettings: AdvancedSettingsValues;
  execute: ExecuteFn;
  pushRecentEndpoint: (ep: string) => void;
  isDuplicate: boolean;
  duplicateSourceTabId: string | null;
  responseModelUriRef: React.MutableRefObject<string>;
  setRightView: (view: 'response' | 'schema') => void;
  setTabUploadProgress: (tabId: string, progress: number | null) => void;
  /** Phase 6F — block execute while a profile-linked endpoint is still resolving. */
  endpointLinkPending?: boolean;
  editorMountRef?: React.MutableRefObject<import('monaco-editor').editor.IStandaloneCodeEditor | null>;
}

/** Execute handler for GraphqlStudioPage — validates input then fires useGraphqlExecution. */
export function useGraphqlStudioExecute({
  activeTab,
  resolvedTabEndpoint,
  selectedOperation,
  activeTabHeaders,
  auth,
  globalAuthProfiles = [],
  activeEnvironment,
  globalEnvMap,
  skipTlsVerify,
  resolvedTabTls,
  fileEntries,
  executing,
  isTabExecutingRef,
  complexityResult,
  complexityWarningPending,
  setComplexityWarningPending,
  complexityGatePending,
  setComplexityGatePending,
  pendingExecuteAfterGateRef,
  skipComplexityGateRef,
  sessionBypassComplexityGateRef,
  advSettings,
  execute,
  pushRecentEndpoint,
  isDuplicate,
  duplicateSourceTabId,
  responseModelUriRef,
  setRightView,
  setTabUploadProgress,
  endpointLinkPending = false,
  editorMountRef,
}: UseGraphqlStudioExecuteParams): () => void {
  const executionLockRef = useRef(false);
  if (!executing) executionLockRef.current = false;

  const handleExecute = useCallback(() => {
    if (endpointLinkPending) return;
    if (!activeTab || !resolvedTabEndpoint.trim()) return;
    const query = resolveLiveGqlQuery(activeTab, editorMountRef);
    if (!query.trim()) return;
    if (findUnresolvedVars(resolvedTabEndpoint, activeEnvironment, globalEnvMap).length > 0) return;
    const trimmedVars = activeTab.variables.trim();
    if (trimmedVars && trimmedVars !== '{}') {
      try {
        const parsed = JSON.parse(trimmedVars) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      } catch { return; }
    }
    if (fileEntries.some((e) => e.error !== null)) return;
    if (executing || executionLockRef.current) return;
    if (isDuplicate && duplicateSourceTabId === activeTab.id) return;

    if (complexityResult?.shouldBlock && !complexityWarningPending) {
      setComplexityWarningPending(true);
      return;
    }
    setComplexityWarningPending(false);

    if (
      advSettings.complexityBlockEnabled &&
      complexityResult &&
      complexityResult.score > advSettings.complexityBlockThreshold &&
      !complexityGatePending &&
      !skipComplexityGateRef.current &&
      !sessionBypassComplexityGateRef.current
    ) {
      setComplexityGatePending(true);
      pendingExecuteAfterGateRef.current = handleExecute;
      return;
    }
    skipComplexityGateRef.current = false;

    executionLockRef.current = true;
    responseModelUriRef.current = activeTab.modelUri;
    setRightView('response');
    const resolvedEndpoint = normalizeGraphqlEndpoint(
      resolveVars(resolvedTabEndpoint, activeEnvironment, globalEnvMap),
    );
    pushRecentEndpoint(resolvedEndpoint);
    const resolvedHeaders = buildGraphqlSchemaHeaders(auth, activeTabHeaders, activeEnvironment, globalEnvMap, globalAuthProfiles);
    const resolvedVariables = resolveVars(activeTab.variables, activeEnvironment, globalEnvMap);
    const tabSkipTlsVerify = activeTab.skipTlsVerify ?? skipTlsVerify;
    const tabTls: GqlTlsSettings = resolvedTabTls ?? {
      skipTlsVerify: tabSkipTlsVerify || undefined,
      caCert: activeTab.tlsCaCert,
      clientCert: activeTab.tlsClientCert,
      clientKey: activeTab.tlsClientKey,
    };
    const validFiles = fileEntries.filter((e) => e.error === null && e.varPath.trim() !== '');

    if (validFiles.length > 0) {
      let parsedVars: Record<string, unknown> = {};
      try {
        const trimmed = resolvedVariables.trim();
        if (trimmed && trimmed !== '{}') {
          parsedVars = JSON.parse(trimmed) as Record<string, unknown>;
        }
      } catch { /* ignore */ }
      const formData = buildMultipartFormData(query, parsedVars, validFiles);
      const uploadTabId = activeTab.id;
      setTabUploadProgress(uploadTabId, 0);
      execute({
        endpoint: resolvedEndpoint,
        query,
        variables: resolvedVariables,
        operationName: selectedOperation,
        headers: resolvedHeaders,
        skipTlsVerify: tabSkipTlsVerify,
        tls: tabTls,
        formData,
        connectionId: resolvedEndpoint,
        operationType: activeTab.operationType === 'mutation' ? 'mutation' : 'query',
        onUploadProgress: (loaded, total) => {
          if (!isTabExecutingRef.current(uploadTabId) && loaded !== 0) return;
          if (total > 0) setTabUploadProgress(uploadTabId, Math.min(98, Math.round((loaded / total) * 100)));
        },
      });
    } else {
      setTabUploadProgress(activeTab.id, null);
      execute({
        endpoint: resolvedEndpoint,
        query,
        variables: resolvedVariables,
        operationName: selectedOperation,
        headers: resolvedHeaders,
        skipTlsVerify: tabSkipTlsVerify,
        tls: tabTls,
        connectionId: resolvedEndpoint,
        apqEnabled: advSettings.apqEnabled,
        apqUseGet: advSettings.apqUseGet,
        dedupEnabled: advSettings.dedupEnabled,
        operationType: activeTab.operationType === 'mutation' ? 'mutation' : 'query',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs omitted intentionally
  }, [activeTab, resolvedTabEndpoint, execute, executing, selectedOperation, activeTabHeaders, auth,
      globalAuthProfiles, pushRecentEndpoint, activeEnvironment, globalEnvMap, skipTlsVerify, resolvedTabTls,
      fileEntries, complexityResult,
      complexityWarningPending, complexityGatePending, advSettings, isTabExecutingRef, isDuplicate, duplicateSourceTabId,
      endpointLinkPending, setTabUploadProgress, setRightView, editorMountRef]);

  return handleExecute;
}
