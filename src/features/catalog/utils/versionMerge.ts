import { v4 as uuidv4 } from 'uuid';
import type { RequestItem, RequestCollection, RequestFolder, SpecVersion } from '../../../shared/types';
import { collectAllRequestsFromCollection } from '../../requests/utils/requestTree';

export interface MergeResult {
  mergedCount: number;
  newCount: number;
  /** Collection containing only truly new requests (folders stripped of merged ones). */
  newCollection: RequestCollection;
  /** Patches to apply to existing requests (via updateRequest). */
  updates: Array<{
    collectionId: string;
    requestId: string;
    patch: Partial<RequestItem>;
  }>;
}

/** Build a SpecVersion snapshot from a RequestItem's current fields. */
export function buildSpecVersion(
  request: RequestItem,
  catalogVersion: string,
  catalogEntryId: string,
): SpecVersion {
  return {
    id: uuidv4(),
    catalogVersion,
    catalogEntryId,
    catalogEndpointId: request.catalogMeta?.catalogEndpointId ?? '',
    importedAt: Date.now(),
    url: request.url,
    method: request.method,
    headers: request.headers,
    body: request.body,
    bodyType: request.bodyType,
    bodyForm: request.bodyForm,
    savedQueryParams: request.savedQueryParams,
    savedPathParams: request.savedPathParams,
  };
}

/** Apply a SpecVersion snapshot back to a RequestItem, producing a partial patch. */
export function applySpecVersion(
  version: SpecVersion,
): Partial<RequestItem> {
  return {
    url: version.url,
    method: version.method,
    headers: version.headers,
    body: version.body,
    bodyType: version.bodyType,
    bodyForm: version.bodyForm,
    savedQueryParams: version.savedQueryParams,
    savedPathParams: version.savedPathParams,
    activeSpecVersionId: version.id,
  };
}

interface EndpointMatch {
  collectionId: string;
  requestId: string;
  request: RequestItem;
}

function findExistingByEndpointId(
  endpointId: string,
  catalogEntryId: string,
  collections: RequestCollection[],
): EndpointMatch | undefined {
  for (const col of collections) {
    const found = findInCollection(endpointId, catalogEntryId, col);
    if (found) return { collectionId: col.id, ...found };
  }
  return undefined;
}

function findInCollection(
  endpointId: string,
  catalogEntryId: string,
  col: RequestCollection,
): { requestId: string; request: RequestItem } | undefined {
  for (const r of col.requests) {
    if (matchesCatalogEndpoint(r, endpointId, catalogEntryId)) {
      return { requestId: r.id, request: r };
    }
  }
  for (const f of col.folders ?? []) {
    const found = findInFolder(endpointId, catalogEntryId, f);
    if (found) return found;
  }
  return undefined;
}

function findInFolder(
  endpointId: string,
  catalogEntryId: string,
  folder: RequestFolder,
): { requestId: string; request: RequestItem } | undefined {
  for (const r of folder.requests) {
    if (matchesCatalogEndpoint(r, endpointId, catalogEntryId)) {
      return { requestId: r.id, request: r };
    }
  }
  for (const sub of folder.folders ?? []) {
    const found = findInFolder(endpointId, catalogEntryId, sub);
    if (found) return found;
  }
  return undefined;
}

function matchesCatalogEndpoint(r: RequestItem, endpointId: string, catalogEntryId: string): boolean {
  return r.catalogMeta?.catalogEndpointId === endpointId
    && r.catalogMeta?.catalogEntryId === catalogEntryId;
}

function stripMergedFromFolder(folder: RequestFolder, mergedIds: Set<string>): RequestFolder {
  return {
    ...folder,
    requests: folder.requests.filter(r => !mergedIds.has(r.catalogMeta?.catalogEndpointId ?? '')),
    folders: (folder.folders ?? []).map(f => stripMergedFromFolder(f, mergedIds)),
  };
}

/**
 * Merge exported requests into existing collections. Requests whose
 * catalogEndpointId already exists get a new SpecVersion appended;
 * truly new requests are kept in the returned newCollection.
 */
export function mergeExportIntoCollections(
  exportedCollection: RequestCollection,
  existingCollections: RequestCollection[],
  catalogVersion: string,
  catalogEntryId: string,
): MergeResult {
  const updates: MergeResult['updates'] = [];
  const mergedEndpointIds = new Set<string>();

  const allExportedRequests = collectAllRequestsFromCollection(exportedCollection);

  for (const req of allExportedRequests) {
    const epId = req.catalogMeta?.catalogEndpointId;
    if (!epId) continue;

    const existing = findExistingByEndpointId(epId, catalogEntryId, existingCollections);
    if (!existing) continue;

    const newVersion = buildSpecVersion(req, catalogVersion, catalogEntryId);
    const existingVersions = existing.request.specVersions ?? [];

    const patch: Partial<RequestItem> = {
      ...applySpecVersion(newVersion),
      specVersions: [...existingVersions, newVersion],
      activeSpecVersionId: newVersion.id,
    };

    if (existing.request.catalogMeta) {
      patch.catalogMeta = {
        ...existing.request.catalogMeta,
        catalogVersion,
      };
    }

    updates.push({
      collectionId: existing.collectionId,
      requestId: existing.requestId,
      patch,
    });
    mergedEndpointIds.add(epId);
  }

  const newCollection: RequestCollection = {
    ...exportedCollection,
    requests: exportedCollection.requests.filter(
      r => !mergedEndpointIds.has(r.catalogMeta?.catalogEndpointId ?? ''),
    ),
    folders: (exportedCollection.folders ?? []).map(f => stripMergedFromFolder(f, mergedEndpointIds)),
  };

  const newCount = collectAllRequestsFromCollection(newCollection).length;

  return {
    mergedCount: updates.length,
    newCount,
    newCollection,
    updates,
  };
}

/** Check whether the new collection is empty (no requests in any folder). */
export function isCollectionEmpty(col: RequestCollection): boolean {
  return collectAllRequestsFromCollection(col).length === 0;
}
