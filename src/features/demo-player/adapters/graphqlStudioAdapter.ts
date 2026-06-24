/**
 * Demo Hub ↔ GraphQL Studio adapter (Phase 5).
 * Lessons import from here — not from `features/graphql/utils/*` or `app/hooks/*`.
 */
export {
  prepareDemoWorkspace,
  closeDemoWorkspace,
  loadDemoSession,
  patchDemoTabConnection,
  dispatchGqlTabsReload,
  dispatchGqlPageAuthReload,
  dispatchGqlPageEndpointReload,
  countUserTabsInStorage,
  userTabsToCloseForLesson,
  filterTabsForPersistence,
  pickPersistedActiveTabId,
  purgeOrphanDemoTabs,
  isGraphqlStudioLesson,
  MAX_TABS,
  MAX_USER_TABS,
  DEMO_SESSION_KEY,
  GQL_TABS_RELOAD_EVENT,
  GQL_PAGE_AUTH_RELOAD_EVENT,
  GQL_PAGE_ENDPOINT_RELOAD_EVENT,
  type PrepareDemoWorkspaceResult,
  type GqlDemoSession,
  type DemoTabConnectionPatch,
} from '../../graphql/utils/gqlDemoWorkspace';

export {
  purgeGqlDemoConnectionProfiles,
  GQL6_DEMO_PROFILE_NAME,
  GQL14_STAGING_PROFILE_NAME,
  GQL14_PRODUCTION_PROFILE_NAME,
  ALL_GQL_DEMO_CONNECTION_PROFILE_NAMES,
} from '../../graphql/utils/gqlDemoConnectionProfiles';

export {
  restorePageEndpointSnapshot,
  loadTabs,
} from '../../graphql/utils/tabPersistence';
export { normalizeGraphqlEndpoint } from '../../graphql/utils/graphqlEndpointUtils';
export { loadCachedGraphqlSchemaSdl } from '../../graphql/utils/graphqlSchemaCache';
export { computeSchemaDiff } from '../../graphql/utils/schemaDiff';
export {
  loadSnapshots,
  saveSnapshot,
  deleteSnapshot,
  relabelSnapshot,
} from '../../graphql/utils/schemaSnapshot';
export { purgeGqlStudioEnvironmentsByName, GQL_ENVS_STORAGE_KEY } from '../../graphql/utils/gqlStudioEnvironmentStorage';

export {
  applyGqlTlsSettings,
  deleteGqlEnvironmentByName,
  upsertGqlEnvironment,
  upsertGlobalAuthProfile,
  type GqlDemoEnvVar,
} from './environmentAdapter';
