import type { Assertion } from '../../../shared/types';
import type { GalleryEntry } from '../types';

export type AssertionPresetCategory = 'api-validation' | 'data-quality' | 'security';

export interface AssertionPresetEntry extends GalleryEntry<Assertion[]> {
  category: AssertionPresetCategory;
  assertionCount: number;
  assertionTypes: string[];
}
