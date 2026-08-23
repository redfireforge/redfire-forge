import type { MutableRefObject } from 'react';
import type { GraphqlAuth } from '@shared/types/graphql';
import type { GraphqlResponseViewerTab } from '../components/GraphqlResponseViewer';
import type { useGraphqlCollections } from './useGraphqlCollections';
import { syncBatchResultsToTabResponses } from '../utils/syncBatchResultsToTabResponses';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { BottomPanelTabExtended } from '../graphqlStudioPageTypes';
import type { GraphqlStudioActivityTab } from '@shared/types/graphql';

export function createUpdateLinkedProfileAuth(
  updateProfile: (profileId: string, patch: { auth: GraphqlAuth | null }) => void,
): (profileId: string, newAuth: GraphqlAuth | null) => void {
  return (profileId, newAuth) => {
    updateProfile(profileId, { auth: newAuth });
  };
}

export function createHandleDemoSetGqlQuery(
  editorMountRef: MutableRefObject<{ setValue: (q: string) => void } | null>,
  handleQueryChange: (query: string) => void,
): (query: string) => void {
  return (query) => {
    editorMountRef.current?.setValue(query);
    handleQueryChange(query);
  };
}

export function createHandleCancel(
  activeTabId: string,
  cancel: () => void,
  setTabUploadProgress: (tabId: string, progress: number | null) => void,
): () => void {
  return () => {
    setTabUploadProgress(activeTabId, null);
    cancel();
  };
}

export function createOnIntrospectComplete(
  setRightView: (view: 'response' | 'schema') => void,
): () => void {
  return () => setRightView('schema');
}

export function createHandleResponseSubTabChange(
  updateActiveTab: (patch: Partial<GqlStudioTab>) => void,
): (subTab: GraphqlResponseViewerTab) => void {
  return (subTab) => {
    updateActiveTab({ responseSubTab: subTab });
  };
}

export function createSyncBatchResultsHandler(
  cacheExecutionResult: Parameters<typeof syncBatchResultsToTabResponses>[2]['cacheExecutionResult'],
  applyTabResult: Parameters<typeof syncBatchResultsToTabResponses>[2]['applyTabResult'],
): (
  batchedTabs: Parameters<typeof syncBatchResultsToTabResponses>[0],
  batchResult: Parameters<typeof syncBatchResultsToTabResponses>[1],
) => void {
  return (batchedTabs, batchResult) => {
    syncBatchResultsToTabResponses(batchedTabs, batchResult, {
      cacheExecutionResult,
      applyTabResult,
    });
  };
}

export function createHandleSaveToCollection(
  collections: Pick<ReturnType<typeof useGraphqlCollections>, 'addItem'>,
): (
  collectionId: string,
  folderId: string | undefined,
  name: string,
  operation: Parameters<ReturnType<typeof useGraphqlCollections>['addItem']>[3],
) => ReturnType<ReturnType<typeof useGraphqlCollections>['addItem']> {
  return (collectionId, folderId, name, operation) =>
    collections.addItem(collectionId, folderId, name, operation);
}

export function createHandleDismissComplexityWarning(
  setComplexityWarningPending: (v: boolean) => void,
): () => void {
  return () => setComplexityWarningPending(false);
}

export function buildTabConnectionPageDefaults(
  endpoint: string,
  auth: GraphqlAuth | null,
  skipTlsVerify: boolean,
  tlsCaCert: string | undefined,
  tlsClientCert: string | undefined,
  tlsClientKey: string | undefined,
  pollingEnabled: boolean,
  pollingIntervalSeconds: number,
) {
  return {
    endpoint,
    auth,
    skipTlsVerify,
    tlsCaCert,
    tlsClientCert,
    tlsClientKey,
    pollingEnabled,
    pollingIntervalSeconds,
  };
}

export function createTabsExecutionCallbacks(
  setTabUploadProgress: (tabId: string, progress: number | null) => void,
  cancelTabRef: MutableRefObject<(tabId: string) => void>,
  isTabExecutingRef: MutableRefObject<(tabId: string) => boolean>,
) {
  return {
    onCancelExecution: (tabId: string) => {
      setTabUploadProgress(tabId, null);
      cancelTabRef.current(tabId);
    },
    isTabExecuting: (tabId: string) => isTabExecutingRef.current(tabId),
  };
}

export function wireExecutionRefs(
  cancelTabRef: MutableRefObject<(tabId: string) => void>,
  isTabExecutingRef: MutableRefObject<(tabId: string) => boolean>,
  executingRef: MutableRefObject<boolean>,
  cancelTab: (tabId: string) => void,
  isTabExecuting: (tabId: string) => boolean,
  executing: boolean,
): void {
  cancelTabRef.current = cancelTab;
  isTabExecutingRef.current = isTabExecuting;
  executingRef.current = executing;
}

/** Fire-and-forget collection item executed marker (collection run). */
export function createMarkCollectionItemExecuted(
  markItemExecuted: (id: string) => Promise<void>,
): (id: string) => void {
  return (id) => {
    markItemExecuted(id).catch(() => {});
  };
}

export function createSetBottomPanelTab(
  setBottomTab: (tab: BottomPanelTabExtended) => void,
): (tab: string) => void {
  return (tab) => setBottomTab(tab as BottomPanelTabExtended);
}

export function createSetGqlActivityTab(
  setActivityTab: (tab: GraphqlStudioActivityTab | null) => void,
): (tab: string) => void {
  return (tab) => setActivityTab(tab as GraphqlStudioActivityTab);
}
