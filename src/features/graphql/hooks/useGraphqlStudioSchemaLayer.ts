/**
 * Schema introspection, mock server wiring, and snapshot management for GraphQL Studio.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GraphqlSchemaInfo } from '@shared/types/graphql';
import { useGraphqlSchema } from './useGraphqlSchema';
import { useGraphqlMockServer } from './useGraphqlMockServer';
import { useGraphqlSchemaSnapshots } from './useGraphqlSchemaSnapshots';
import { isGraphqlMockEndpoint, resolveMockServerConnectionId } from '../utils/graphqlEndpointUtils';
import { loadCachedGraphqlSchemaSdl } from '../utils/graphqlSchemaCache';
import { computeInvalidCollectionItemIds } from '../utils/graphqlCollectionValidation';
import { clearGraphqlSchema, setGraphqlSchema } from '../utils/monacoGraphqlSetup';
import type { GqlTlsSettings } from '@shared/types/gqlTls';
import type { CollectionTree } from './useGraphqlCollections';

export interface GraphqlStudioSchemaLayerInput {
  tabSchemaConnectionId: string | null;
  resolvedTabEndpointForSchema: string;
  schemaHeaders: Record<string, string>;
  resolvedTabPollingIntervalMs: number;
  resolvedTabSkipTlsVerify: boolean;
  resolvedTabTls: GqlTlsSettings;
  hasPendingProfileEndpoint: boolean;
  hasActiveTabEndpointOverride: boolean;
  pageDefaultEndpointResolved: string;
  historyConnectionId: string | null;
  collectionTrees: CollectionTree[];
  onIntrospectComplete: () => void;
}

export function useGraphqlStudioSchemaLayer({
  tabSchemaConnectionId,
  resolvedTabEndpointForSchema,
  schemaHeaders,
  resolvedTabPollingIntervalMs,
  resolvedTabSkipTlsVerify,
  resolvedTabTls,
  hasPendingProfileEndpoint,
  hasActiveTabEndpointOverride,
  pageDefaultEndpointResolved,
  historyConnectionId,
  collectionTrees,
  onIntrospectComplete,
}: GraphqlStudioSchemaLayerInput) {
  const {
    status: schemaStatus,
    schemaInfo,
    rawIntrospection,
    errorMessage: schemaErrorMessage,
    introspecting,
    introspect,
    pollErrorMessage,
  } = useGraphqlSchema(resolvedTabEndpointForSchema, schemaHeaders, {
    pollingIntervalMs: hasPendingProfileEndpoint ? 0 : resolvedTabPollingIntervalMs,
    skipTlsVerify: resolvedTabSkipTlsVerify,
    tls: resolvedTabTls,
  });

  const handleIntrospect = useCallback(() => {
    if (hasPendingProfileEndpoint) return;
    introspect();
  }, [hasPendingProfileEndpoint, introspect]);

  const mockServerConnectionId = useMemo(
    () => resolveMockServerConnectionId(
      pageDefaultEndpointResolved,
      historyConnectionId,
      tabSchemaConnectionId,
      hasActiveTabEndpointOverride,
    ),
    [pageDefaultEndpointResolved, historyConnectionId, tabSchemaConnectionId, hasActiveTabEndpointOverride],
  );

  const lastLiveSchemaSdlRef = useRef<string | null>(null);
  useEffect(() => {
    if (schemaInfo?.sdl && !isGraphqlMockEndpoint(resolvedTabEndpointForSchema)) {
      lastLiveSchemaSdlRef.current = schemaInfo.sdl;
    }
  }, [schemaInfo?.sdl, resolvedTabEndpointForSchema]);

  const mockIntrospectedSdl = useMemo(() => {
    if (schemaInfo?.sdl?.trim()) return schemaInfo.sdl;
    if (isGraphqlMockEndpoint(resolvedTabEndpointForSchema) && lastLiveSchemaSdlRef.current?.trim()) {
      return lastLiveSchemaSdlRef.current;
    }
    for (const id of [mockServerConnectionId, pageDefaultEndpointResolved, resolvedTabEndpointForSchema]) {
      if (!id || isGraphqlMockEndpoint(id)) continue;
      const cached = loadCachedGraphqlSchemaSdl(id);
      if (cached) return cached;
    }
    return null;
  }, [
    schemaInfo?.sdl,
    resolvedTabEndpointForSchema,
    mockServerConnectionId,
    pageDefaultEndpointResolved,
  ]);

  const mockServer = useGraphqlMockServer(mockServerConnectionId, mockIntrospectedSdl);

  useEffect(() => {
    if (rawIntrospection) {
      try { setGraphqlSchema(rawIntrospection); } catch { /* non-fatal */ }
    } else {
      try { clearGraphqlSchema(); } catch { /* non-fatal */ }
    }
  }, [rawIntrospection]);

  const invalidItemIds = useMemo<Set<string>>(() => {
    const allItems = collectionTrees.flatMap((t) => t.items);
    return computeInvalidCollectionItemIds(rawIntrospection, allItems);
  }, [rawIntrospection, collectionTrees]);

  const {
    snapshots,
    deprecatedUsages,
    diffModal,
    setDiffModal,
    schemaDiffToast,
    setSchemaDiffToast,
    toastBaselineSnapshotIdRef,
    handleSaveSnapshot,
    handleDeleteSnapshot,
    handleClearOlderSnapshots,
    handleOpenDiff,
    handleAcknowledge,
    handleUnacknowledge,
  } = useGraphqlSchemaSnapshots(
    tabSchemaConnectionId ?? '',
    schemaInfo,
    schemaStatus,
    rawIntrospection,
    collectionTrees,
  );

  const prevIntrospectingRef = useRef(introspecting);
  const introspectStartResolvedRef = useRef('');
  useEffect(() => {
    if (introspecting && !prevIntrospectingRef.current) {
      introspectStartResolvedRef.current = resolvedTabEndpointForSchema;
    }
    if (
      prevIntrospectingRef.current
      && !introspecting
      && schemaStatus === 'loaded'
      && resolvedTabEndpointForSchema === introspectStartResolvedRef.current
    ) {
      onIntrospectComplete();
    }
    prevIntrospectingRef.current = introspecting;
  }, [introspecting, schemaStatus, resolvedTabEndpointForSchema, onIntrospectComplete]);

  const connectionBarSchemaStatus: 'loaded' | 'error' | 'none' =
    schemaStatus === 'loaded'
      ? 'loaded'
      : (schemaStatus === 'error' || schemaStatus === 'introspection-disabled')
        ? 'error'
        : 'none';

  return {
    schemaStatus,
    schemaInfo: schemaInfo as GraphqlSchemaInfo | null,
    rawIntrospection,
    schemaErrorMessage,
    introspecting,
    handleIntrospect,
    pollErrorMessage,
    mockServer,
    invalidItemIds,
    snapshots,
    deprecatedUsages,
    diffModal,
    setDiffModal,
    schemaDiffToast,
    setSchemaDiffToast,
    toastBaselineSnapshotIdRef,
    handleSaveSnapshot,
    handleDeleteSnapshot,
    handleClearOlderSnapshots,
    handleOpenDiff,
    handleAcknowledge,
    handleUnacknowledge,
    connectionBarSchemaStatus,
  };
}
