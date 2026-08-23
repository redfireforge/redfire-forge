import type { FeatureGroup, SharedDataSource } from '@shared/types';
import type { GalleryEntry } from '../types';

export type TestCategory = 'smoke' | 'regression' | 'contract' | 'security' | 'load';

export interface TestSampleEntry extends GalleryEntry<FeatureGroup> {
  category: TestCategory;
  scenarioCount: number;
  /** Which assertion types are demonstrated in this test */
  assertionTypes: string[];
  /** Total data rows across all scenarios (parameterized tests only) */
  dataRowCount?: number;
  /** 
   * Factory for shared data sources that accompany the feature group.
   * If present, loading this sample also creates these top-level shared DS.
   */
  sharedDataSourceFactory?: () => SharedDataSource[];
  /**
   * For samples that create multiple feature groups (e.g., cross-FG shared DS demo),
   * this returns additional feature groups beyond the main one.
   */
  additionalFeatureGroupsFactory?: () => FeatureGroup[];
}
