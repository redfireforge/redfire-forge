import type { CatalogEntry, CatalogFolder, CatalogEndpoint } from '../types/catalog';

export function findEndpointInFolders(folders: CatalogFolder[], endpointId: string): CatalogEndpoint | undefined {
  for (const f of folders) {
    const found = f.endpoints.find(e => e.id === endpointId);
    if (found) return found;
    if (f.folders) {
      const deeper = findEndpointInFolders(f.folders, endpointId);
      if (deeper) return deeper;
    }
  }
  return undefined;
}

export function findEndpointInEntry(entry: CatalogEntry, endpointId: string): CatalogEndpoint | undefined {
  return entry.endpoints.find(e => e.id === endpointId) ?? findEndpointInFolders(entry.folders ?? [], endpointId);
}
