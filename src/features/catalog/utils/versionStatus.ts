import type { RequestCollection, RequestItem, RequestFolder } from '@shared/types';
import type { CatalogEndpoint } from '../types/catalog';

export interface EndpointVersionInfo {
  status: 'new' | 'exported';
  exportedVersion?: string;
}

/**
 * Check whether a catalog endpoint has been previously exported to any
 * RequestCollection. Returns 'exported' with version if found, 'new' otherwise.
 */
export function getEndpointVersionInfo(
  endpointId: string,
  collections: RequestCollection[],
): EndpointVersionInfo {
  for (const col of collections) {
    for (const req of allRequests(col)) {
      if (req.catalogMeta?.catalogEndpointId === endpointId) {
        return {
          status: 'exported',
          exportedVersion: req.catalogMeta.catalogVersion,
        };
      }
    }
  }
  return { status: 'new' };
}

/**
 * Count how many endpoints from the list have never been exported.
 */
export function getNewEndpointsCount(
  endpoints: CatalogEndpoint[],
  collections: RequestCollection[],
): number {
  return endpoints.filter(
    ep => getEndpointVersionInfo(ep.id, collections).status === 'new',
  ).length;
}

/**
 * Build a lookup map for a batch of endpoints: endpointId → EndpointVersionInfo.
 */
export function buildVersionInfoMap(
  endpoints: CatalogEndpoint[],
  collections: RequestCollection[],
): Map<string, EndpointVersionInfo> {
  const allReqs: RequestItem[] = [];
  for (const col of collections) {
    for (const req of allRequests(col)) {
      if (req.catalogMeta?.catalogEndpointId) allReqs.push(req);
    }
  }

  const map = new Map<string, EndpointVersionInfo>();
  for (const ep of endpoints) {
    const match = allReqs.find(r => r.catalogMeta?.catalogEndpointId === ep.id);
    if (match) {
      map.set(ep.id, { status: 'exported', exportedVersion: match.catalogMeta?.catalogVersion });
    } else {
      map.set(ep.id, { status: 'new' });
    }
  }
  return map;
}

function allRequests(col: RequestCollection): RequestItem[] {
  const results: RequestItem[] = [...col.requests];
  const walk = (folders?: RequestFolder[]) => {
    if (!folders) return;
    for (const f of folders) {
      results.push(...f.requests);
      walk(f.folders);
    }
  };
  walk(col.folders);
  return results;
}
