/**
 * IndexedDB storage backend for projects (browser only).
 * Same pattern as idbFeatureGroups.ts — single key "all" in "projects" store.
 */

import { createIdbBlobStore } from './idbHelpers';

const STORE_NAME = 'projects';

const projectsStore = createIdbBlobStore<unknown[]>(
  STORE_NAME,
  (d) => Array.isArray(d) && d.length > 0,
);

export const idbLoadProjects = projectsStore.load;
export const idbSaveProjects = projectsStore.save;
export const idbMigrateProjects = projectsStore.migrate;
