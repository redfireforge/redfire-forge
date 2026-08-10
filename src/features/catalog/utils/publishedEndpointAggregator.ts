import type { CatalogEntry, CatalogEndpoint, CatalogFolder, WorkflowPublication } from '../types/catalog';
import { isPublicationStale } from './publicationDrift';

export interface PublishedEndpointItem {
  entryId: string;
  entryName: string;
  endpointId: string;
  method: string;
  path: string;
  summary: string;
  currentVersionId: string;
  publication: WorkflowPublication;
  /** true when publishedFromVersionId differs from the entry's currentVersionId */
  isStale: boolean;
}

function collectFromEndpoints(
  endpoints: CatalogEndpoint[],
  entryId: string,
  entryName: string,
  currentVersionId: string,
  out: PublishedEndpointItem[],
): void {
  for (const ep of endpoints) {
    const pub = ep.workflowPublication;
    if (!pub) continue;
    out.push({
      entryId,
      entryName,
      endpointId: ep.id,
      method: ep.method.toUpperCase(),
      path: ep.path,
      summary: ep.summary || ep.path,
      currentVersionId,
      publication: pub,
      isStale: isPublicationStale(ep, currentVersionId),
    });
  }
}

function collectFromFolders(
  folders: CatalogFolder[],
  entryId: string,
  entryName: string,
  currentVersionId: string,
  out: PublishedEndpointItem[],
): void {
  for (const f of folders) {
    collectFromEndpoints(f.endpoints, entryId, entryName, currentVersionId, out);
    collectFromFolders(f.folders, entryId, entryName, currentVersionId, out);
  }
}

/**
 * Scan all catalog entries and return a flat list of every published endpoint.
 * Each item includes stale detection (publishedFromVersionId vs currentVersionId).
 */
export function aggregatePublishedEndpoints(entries: CatalogEntry[]): PublishedEndpointItem[] {
  const result: PublishedEndpointItem[] = [];
  for (const entry of entries) {
    collectFromEndpoints(entry.endpoints, entry.id, entry.name, entry.currentVersionId, result);
    collectFromFolders(entry.folders, entry.id, entry.name, entry.currentVersionId, result);
  }
  return result;
}

export type StatusFilter = 'all' | 'published' | 'stale';

/**
 * Filter and search published endpoints.
 */
export function filterPublishedEndpoints(
  items: PublishedEndpointItem[],
  query: string,
  status: StatusFilter,
): PublishedEndpointItem[] {
  let filtered = items;

  if (status === 'published') {
    filtered = filtered.filter(i => !i.isStale);
  } else if (status === 'stale') {
    filtered = filtered.filter(i => i.isStale);
  }

  if (query.trim()) {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter(i =>
      i.method.toLowerCase().includes(q) ||
      i.path.toLowerCase().includes(q) ||
      i.summary.toLowerCase().includes(q) ||
      i.entryName.toLowerCase().includes(q),
    );
  }

  return filtered;
}
