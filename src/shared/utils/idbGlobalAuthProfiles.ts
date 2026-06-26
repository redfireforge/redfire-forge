/**
 * IndexedDB storage for global auth profiles (browser only).
 */

import type { GlobalAuthProfile } from '../types';
import { createIdbBlobStore } from './idbHelpers';

const globalAuthProfilesStore = createIdbBlobStore<GlobalAuthProfile[]>(
  'globalAuthProfiles',
  (d) => Array.isArray(d),
);

export const idbLoadGlobalAuthProfiles = globalAuthProfilesStore.load;
export const idbSaveGlobalAuthProfiles = globalAuthProfilesStore.save;
export const idbMigrateGlobalAuthProfiles = globalAuthProfilesStore.migrate;
