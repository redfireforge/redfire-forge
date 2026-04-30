import type { GalleryEntry } from '../types';

export type CatalogSpecCategory = 'webhooks' | 'rest-api' | 'microservices' | 'public-api';

export interface CatalogSpecEntry extends GalleryEntry<string> {
  category: CatalogSpecCategory;
  endpointCount: number;
  /** OpenAPI version (e.g. "3.0.3"). */
  specVersion: string;
  /** @deprecated Use factory() instead. Kept for backward compatibility. */
  specYaml: string;
}
