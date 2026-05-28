/**
 * IndexedDB storage backend for feature groups (browser only).
 * Provides effectively unlimited storage compared to localStorage's ~5MB cap.
 *
 * Schema: DB "redfireforge", object store "featureGroups", single key "all".
 * Feature groups are stored as a single JSON blob for atomic reads/writes.
 */

import type { FeatureGroup } from '../types';
import { createIdbBlobStore } from './idbHelpers';

const STORE_NAME = 'featureGroups';

const featureGroupsStore = createIdbBlobStore<FeatureGroup[]>(
  STORE_NAME,
  (d) => Array.isArray(d) && d.length > 0,
);

export const idbLoadFeatureGroups = featureGroupsStore.load;
export const idbSaveFeatureGroups = featureGroupsStore.save;
export const idbMigrateFeatureGroups = featureGroupsStore.migrate;
