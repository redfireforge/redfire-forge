import type { GalleryEntry } from '../types';
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';

export interface ApiMockSampleEntry extends GalleryEntry<ApiMockServerDefinitionV1> {
  routeCount: number;
  teaches: string[];
}
