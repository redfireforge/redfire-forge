import type {
  GraphqlCollectionFolder,
  GraphqlCollectionItem,
} from '@shared/types/graphql';
import type { CollectionExportData } from '@shared/utils/idbGraphqlCollections';

export interface ImportPreviewOperation {
  name: string;
  operationType: 'query' | 'mutation' | 'subscription';
  queryPreview: string;
}

export interface ImportPreviewFolderNode {
  id: string;
  name: string;
  folders: ImportPreviewFolderNode[];
  items: ImportPreviewOperation[];
}

export interface ImportPreviewCollectionNode {
  id: string;
  name: string;
  folderCount: number;
  itemCount: number;
  variableCount: number;
  rootItems: ImportPreviewOperation[];
  folders: ImportPreviewFolderNode[];
}

export interface ImportPreviewMeta {
  version?: string;
  exportedAt?: string;
  source?: string;
}

export interface CollectionImportPreview {
  meta: ImportPreviewMeta;
  collections: ImportPreviewCollectionNode[];
  totalCollections: number;
  totalOperations: number;
}

export function formatImportQueryPreview(query: string, maxLen = 72): string {
  const line = query.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const collapsed = line.replace(/\s+/g, ' ');
  if (collapsed.length <= maxLen) return collapsed;
  return `${collapsed.slice(0, maxLen - 1)}…`;
}

function toPreviewItem(item: GraphqlCollectionItem): ImportPreviewOperation {
  return {
    name: item.name,
    operationType: item.operation.operationType,
    queryPreview: formatImportQueryPreview(item.operation.query),
  };
}

function buildFolderNodes(
  folders: GraphqlCollectionFolder[],
  items: GraphqlCollectionItem[],
  parentId?: string,
): ImportPreviewFolderNode[] {
  return folders
    .filter((f) => (f.parentId ?? undefined) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      folders: buildFolderNodes(folders, items, folder.id),
      items: items
        .filter((i) => i.folderId === folder.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(toPreviewItem),
    }));
}

function buildRootItems(
  folders: GraphqlCollectionFolder[],
  items: GraphqlCollectionItem[],
): ImportPreviewOperation[] {
  const folderIds = new Set(folders.map((f) => f.id));
  return items
    .filter((i) => !i.folderId || !folderIds.has(i.folderId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toPreviewItem);
}

export function buildCollectionImportPreview(data: CollectionExportData): CollectionImportPreview {
  const exportMeta = data._exportMeta as { version?: string; exportedAt?: string; source?: string } | undefined;
  const collections = data.collections.map(({ collection, folders, items }) => ({
    id: collection.id,
    name: collection.name,
    folderCount: folders.length,
    itemCount: items.length,
    variableCount: Object.keys(collection.variables ?? {}).length,
    rootItems: buildRootItems(folders, items),
    folders: buildFolderNodes(folders, items),
  }));

  return {
    meta: {
      version: exportMeta?.version,
      exportedAt: exportMeta?.exportedAt,
      source: exportMeta?.source,
    },
    collections,
    totalCollections: collections.length,
    totalOperations: collections.reduce((n, c) => n + c.itemCount, 0),
  };
}
