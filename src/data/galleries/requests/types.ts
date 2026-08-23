import type { Scenario } from '@shared/types';
import type { GalleryEntry } from '../types';

export type RequestCategory = 'crud' | 'search' | 'auth' | 'pagination';

export interface RequestSampleEntry extends GalleryEntry<Scenario> {
  category: RequestCategory;
  method: Scenario['method'];
  /** Short preview of the target URL path (e.g. "/api/users") */
  previewPath: string;
}
