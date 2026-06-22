/**
 * useGraphqlCollectionRun — encapsulates the logic for running a GraphQL
 * collection (all items, folder-scoped, or single item) through the runner.
 *
 * Extracted from GraphqlStudioPage.tsx to reduce its line count.
 */
import { useCallback } from 'react';
import type { GlobalAuthProfile } from '../../../shared/types';
import type { GraphqlCollectionItem, GraphqlEnvironment } from '../../../shared/types/graphql';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';
import type { UseGraphqlCollectionRunnerResult } from './useGraphqlCollectionRunner';
import { buildAuthHeaders } from '../utils/authUtils';
import { resolveVars } from '../utils/envUtils';

import type { GraphqlCollection } from '../../../shared/types/graphql';

type CollectionTree = {
  collection: GraphqlCollection;
  items: GraphqlCollectionItem[];
  folders: Array<{ id: string; parentId?: string | null; sortOrder: number }>;
};

interface CollectionRunArgs {
  collectionTrees: CollectionTree[];
  endpoint: string;
  skipTlsVerify?: boolean;
  tls?: GqlTlsSettings;
  activeEnvironment: GraphqlEnvironment | null | undefined;
  globalEnvMap?: Record<string, string>;
  activeTabHeaders: Record<string, string>;
  auth: GraphqlAuth | null;
  globalAuthProfiles?: GlobalAuthProfile[];
  runner: UseGraphqlCollectionRunnerResult;
  updateVariables: (id: string, vars: GraphqlEnvironment['variables']) => void;
  onSetRunnerCollectionId: (id: string) => void;
  onSetBottomTab: (tab: string) => void;
  onItemExecuted: (id: string) => void;
  /** Phase 6F — block collection run while profile link is unresolved. */
  endpointLinkPending?: boolean;
}

export function useGraphqlCollectionRun({
  collectionTrees,
  endpoint,
  skipTlsVerify = false,
  tls,
  activeEnvironment,
  globalEnvMap,
  activeTabHeaders,
  auth,
  globalAuthProfiles = [],
  runner,
  updateVariables,
  onSetRunnerCollectionId,
  onSetBottomTab,
  onItemExecuted,
  endpointLinkPending = false,
}: CollectionRunArgs) {
  const handleRunCollection = useCallback((
    collectionId: string,
    folderId?: string,
    itemOverride?: GraphqlCollectionItem,
  ) => {
    if (endpointLinkPending) return;
    const tree = collectionTrees.find((t) => t.collection.id === collectionId);
    if (!tree) return;
    onSetRunnerCollectionId(collectionId);
    onSetBottomTab('runner');

    const envVarsSnapshot: Record<string, string> = { ...(globalEnvMap ?? {}) };
    for (const v of (activeEnvironment?.variables ?? [])) {
      if (v.enabled && v.key.trim()) envVarsSnapshot[v.key.trim()] = v.value;
    }

    const authH = buildAuthHeaders(auth, globalAuthProfiles);
    const resolvedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...authH, ...activeTabHeaders })) {
      resolvedHeaders[k] = resolveVars(v, activeEnvironment, globalEnvMap);
    }

    const sortItems = (its: GraphqlCollectionItem[]) =>
      [...its].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });

    const collectFolderItems = (folId: string): GraphqlCollectionItem[] => {
      const direct = sortItems(tree.items.filter((i) => i.folderId === folId));
      const subFolders = tree.folders
        .filter((f) => f.parentId === folId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return [...direct, ...subFolders.flatMap((sf) => collectFolderItems(sf.id))];
    };

    let items: GraphqlCollectionItem[];
    if (itemOverride) {
      items = [itemOverride];
    } else if (folderId) {
      items = collectFolderItems(folderId);
    } else {
      const rootItems = sortItems(tree.items.filter((i) => !i.folderId));
      const rootFolders = tree.folders
        .filter((f) => !f.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      items = [...rootItems, ...rootFolders.flatMap((f) => collectFolderItems(f.id))];
    }

    runner.run({
      items,
      collection: tree.collection,
      endpoint: resolveVars(endpoint, activeEnvironment, globalEnvMap),
      headers: resolvedHeaders,
      skipTlsVerify,
      tls,
      envVars: envVarsSnapshot,
      onEnvUpdate: (key, value) => {
        if (!activeEnvironment) return;
        const vars = activeEnvironment.variables.map((v) =>
          v.key === key ? { ...v, value } : v,
        );
        const exists = activeEnvironment.variables.some((v) => v.key === key);
        if (!exists) vars.push({ key, value, enabled: true });
        updateVariables(activeEnvironment.id, vars);
      },
      onItemExecuted,
    }).catch(() => {});
  }, [collectionTrees, endpoint, skipTlsVerify, tls, activeEnvironment, globalEnvMap, activeTabHeaders, auth,
      globalAuthProfiles, runner, updateVariables, onSetRunnerCollectionId, onSetBottomTab, onItemExecuted,
      endpointLinkPending]);

  return { handleRunCollection };
}
