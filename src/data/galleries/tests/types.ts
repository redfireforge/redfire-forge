import type { FeatureGroup } from '../../../shared/types';
import type { GalleryEntry } from '../types';

export type TestCategory = 'smoke' | 'regression' | 'contract' | 'security' | 'load';

export interface TestSampleEntry extends GalleryEntry<FeatureGroup> {
  category: TestCategory;
  scenarioCount: number;
  /** Which assertion types are demonstrated in this test */
  assertionTypes: string[];
}
