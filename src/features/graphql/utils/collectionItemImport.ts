/**
 * Maps GraphQL Studio collection items into workflow node config patches.
 */
import type { GraphqlCollectionItem } from '@shared/types/graphql';
import type { GraphqlQueryNodeData } from '../../workflow/types/workflow';
import type { ConnectionProfile } from './connectionProfileStorage';

export type WorkflowGraphqlImportNodeType = 'graphqlQuery' | 'graphqlMutation';

export interface CollectionImportEntry {
  item: GraphqlCollectionItem;
  collectionName: string;
}

export function operationTypeForNodeType(
  nodeType: WorkflowGraphqlImportNodeType,
): 'query' | 'mutation' {
  return nodeType === 'graphqlMutation' ? 'mutation' : 'query';
}

export function filterCollectionItemsForNodeType(
  items: GraphqlCollectionItem[],
  nodeType: WorkflowGraphqlImportNodeType,
): GraphqlCollectionItem[] {
  const expected = operationTypeForNodeType(nodeType);
  return items.filter((item) => item.operation.operationType === expected);
}

export function flattenCollectionImportEntries(
  trees: Array<{ collection: { name: string }; items: GraphqlCollectionItem[] }>,
  nodeType: WorkflowGraphqlImportNodeType,
): CollectionImportEntry[] {
  const entries: CollectionImportEntry[] = [];
  for (const tree of trees) {
    const items = filterCollectionItemsForNodeType(tree.items, nodeType);
    for (const item of items) {
      entries.push({ item, collectionName: tree.collection.name });
    }
  }
  return entries.sort((a, b) => {
    const byCollection = a.collectionName.localeCompare(b.collectionName);
    if (byCollection !== 0) return byCollection;
    return a.item.name.localeCompare(b.item.name);
  });
}

export function filterImportEntriesBySearch(
  entries: CollectionImportEntry[],
  query: string,
): CollectionImportEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) =>
      e.item.name.toLowerCase().includes(q) ||
      e.collectionName.toLowerCase().includes(q) ||
      e.item.operation.query.toLowerCase().includes(q),
  );
}

export function buildWorkflowImportPatch(
  item: GraphqlCollectionItem,
  profile?: ConnectionProfile | null,
): Partial<GraphqlQueryNodeData> {
  const patch: Partial<GraphqlQueryNodeData> = {
    query: item.operation.query,
  };

  const vars = item.operation.variables?.trim();
  if (vars) {
    patch.variables = vars;
  }

  if (profile?.endpoint?.trim()) {
    patch.endpoint = profile.endpoint;
    if (profile.auth) {
      patch.auth = profile.auth;
    }
  }

  return patch;
}

export async function resolveImportPatchForItem(
  item: GraphqlCollectionItem,
  profiles: ConnectionProfile[],
): Promise<Partial<GraphqlQueryNodeData>> {
  const profile = item.connectionId
    ? profiles.find((p) => p.id === item.connectionId) ?? null
    : null;
  return buildWorkflowImportPatch(item, profile);
}
