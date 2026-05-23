/**
 * IndexedDB storage backend for request collections (browser only).
 * Same pattern as idbFeatureGroups.ts — single key "all" in "requests" store.
 */

import type { RequestsData } from '../types';
import { createIdbBlobStore } from './idbHelpers';

const STORE_NAME = 'requests';

const requestsStore = createIdbBlobStore<RequestsData>(
  STORE_NAME,
  (d) => d != null && typeof d === 'object',
);

export const idbLoadRequests = requestsStore.load;
export const idbSaveRequests = requestsStore.save;
export const idbMigrateRequests = requestsStore.migrate;
