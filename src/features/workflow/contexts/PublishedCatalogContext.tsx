import { createContext, useContext } from 'react';

/**
 * Set of composite keys (`entryId::endpointId`) representing currently
 * published catalog endpoints. Used by HttpStepNode to detect orphaned
 * catalogRef links after an endpoint has been unpublished.
 */
export const PublishedCatalogContext = createContext<Set<string>>(new Set());

export function usePublishedCatalogKeys(): Set<string> {
  return useContext(PublishedCatalogContext);
}
