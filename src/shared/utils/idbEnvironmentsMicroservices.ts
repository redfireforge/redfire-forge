/**
 * IndexedDB storage for environments and microservices (browser only).
 * Keeps small app-config blobs out of localStorage so demo lessons can persist
 * graphql-demo / GraphQL Demo rows without hitting the ~5 MB quota.
 */

import type { Environment, Microservice } from '../types';
import { createIdbBlobStore } from './idbHelpers';

const environmentsStore = createIdbBlobStore<Environment[]>(
  'environments',
  (d) => Array.isArray(d),
);

const microservicesStore = createIdbBlobStore<Microservice[]>(
  'microservices',
  (d) => Array.isArray(d),
);

export const idbLoadEnvironments = environmentsStore.load;
export const idbSaveEnvironments = environmentsStore.save;
export const idbMigrateEnvironments = environmentsStore.migrate;

export const idbLoadMicroservices = microservicesStore.load;
export const idbSaveMicroservices = microservicesStore.save;
export const idbMigrateMicroservices = microservicesStore.migrate;
