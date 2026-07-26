import type { CatalogEndpoint, CatalogEntry } from '../types/catalog';

/**
 * Returns true when the endpoint was published from a spec version
 * that is no longer the current version of its parent entry.
 */
export function isPublicationStale(
  endpoint: CatalogEndpoint,
  currentVersionId: string,
): boolean {
  if (!endpoint.workflowPublication) return false;
  return endpoint.workflowPublication.publishedFromVersionId !== currentVersionId;
}

/**
 * Republish an endpoint at the entry's current version.
 * Returns a new WorkflowPublication with updated timestamp and version.
 */
export function republishAtCurrentVersion(
  endpoint: CatalogEndpoint,
  entry: CatalogEntry,
): CatalogEndpoint['workflowPublication'] {
  const pub = endpoint.workflowPublication;
  if (!pub) return undefined;
  return {
    ...pub,
    publishedAt: Date.now(),
    publishedFromVersionId: entry.currentVersionId,
  };
}
