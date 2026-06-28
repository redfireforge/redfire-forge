/**
 * Foundation layer — layout, connection settings, collections bootstrap, shared refs.
 */
import { useRef, useState, useMemo } from 'react';
import { useMonaco } from '@monaco-editor/react';
import { loadPersistedActivityTab } from '../utils/gqlActivityBarUtils';
import { normalizeGraphqlEndpoint } from '../utils/graphqlEndpointUtils';
import { resolveVars } from '../utils/envUtils';
import { useGraphqlStudioUIState } from './useGraphqlStudioUIState';
import { useGraphqlStudioSplitPanes } from './useGraphqlStudioSplitPanes';
import { useGraphqlHistoryMaxItems } from './useGraphqlHistoryMaxItems';
import { useGraphqlConnectionSettings } from './useGraphqlConnectionSettings';
import { useGraphqlStudioEnvMap } from './useGraphqlStudioEnvMap';
import { useGraphqlCollections } from './useGraphqlCollections';
import { useGraphqlCollectionRunner } from './useGraphqlCollectionRunner';
import { useGqlTabResponseCache } from './useGqlTabResponseCache';
import { useGraphqlSubscription } from './useGraphqlSubscription';
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';
import type { GraphqlStudioPageProps } from '../graphqlStudioPageTypes';

export function useGraphqlStudioPageFoundation({
  resolvedBaseUrl,
  envName,
  svcName,
  selectedSvc,
  selectedEnvId,
}: GraphqlStudioPageProps) {
  const uiState = useGraphqlStudioUIState();
  const splitPanes = useGraphqlStudioSplitPanes();

  const [activityTab, setActivityTab] = useState(() => loadPersistedActivityTab());
  const [runnerCollectionId, setRunnerCollectionId] = useState<string | null>(null);
  const [saveToColItem, setSaveToColItem] = useState<GraphqlHistoryItem | null>(null);
  const { historyMaxItems, handleHistoryMaxItemsChange } = useGraphqlHistoryMaxItems();

  const connection = useGraphqlConnectionSettings(resolvedBaseUrl);
  const { globalEnvMap, endpointProtocolStatus } = useGraphqlStudioEnvMap({
    selectedSvc,
    selectedEnvId,
    resolvedBaseUrl,
    envName,
    svcName,
  });

  const pageDefaultEndpointResolved = useMemo(
    () => normalizeGraphqlEndpoint(
      resolveVars(connection.endpoint, connection.activeEnvironment, globalEnvMap),
    ),
    [connection.endpoint, connection.activeEnvironment, globalEnvMap],
  );

  const collections = useGraphqlCollections();
  const runner = useGraphqlCollectionRunner();
  const responseCacheLayer = useGqlTabResponseCache();
  const subscription = useGraphqlSubscription();

  const monacoInstance = useMonaco();
  const monacoRef = useRef(monacoInstance);
  monacoRef.current = monacoInstance;
  const responseModelUriRef = useRef<string>('');

  const cancelTabRef = useRef<(tabId: string) => void>(() => {});
  const isTabExecutingRef = useRef<(tabId: string) => boolean>(() => false);
  const executingRef = useRef(false);

  return {
    uiState,
    splitPanes,
    activityTab,
    setActivityTab,
    runnerCollectionId,
    setRunnerCollectionId,
    saveToColItem,
    setSaveToColItem,
    historyMaxItems,
    handleHistoryMaxItemsChange,
    connection,
    globalEnvMap,
    endpointProtocolStatus,
    pageDefaultEndpointResolved,
    collections,
    runner,
    responseCacheLayer,
    subscription,
    monacoInstance,
    monacoRef,
    responseModelUriRef,
    cancelTabRef,
    isTabExecutingRef,
    executingRef,
  };
}

export type GraphqlStudioPageFoundation = ReturnType<typeof useGraphqlStudioPageFoundation>;
