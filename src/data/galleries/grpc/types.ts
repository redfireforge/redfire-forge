import type { GalleryEntry } from '../types';
import type { FeatureGroup } from '@shared/types';

export type GrpcSampleCategory = 'unary' | 'streaming' | 'health' | 'load-test' | 'crud';

export interface GrpcSampleEntry extends GalleryEntry<FeatureGroup> {
  category: GrpcSampleCategory;
  scenarioCount: number;
  assertionTypes: string[];
}
