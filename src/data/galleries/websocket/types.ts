import type { GalleryEntry } from '../types';
import type { FeatureGroup } from '@shared/types';

export type WsSampleCategory = 'echo' | 'subscribe' | 'chat' | 'json-feed' | 'auth';

export interface WsSampleEntry extends GalleryEntry<FeatureGroup> {
  category: WsSampleCategory;
  scenarioCount: number;
  assertionTypes: string[];
}
