/**
 * Purge GraphQL demo environments from persistent storage.
 * Does not require Environment Manager or GraphQL Studio to be mounted.
 */
import {
  GQL_DEMO_ENV_NAME,
  GQL_DEMO_SVC_NAME,
  GQL_STUDIO_DEMO_ENV_NAME,
} from './env-manager-lesson-helpers';
import { purgeGqlStudioEnvironmentsByName } from '../adapters';
import { purgeGqlDemoEphemeralStorage } from './gql-demo-storage-cleanup';
import {
  loadEnvironments,
  saveEnvironments,
  loadMicroservices,
  saveMicroservices,
  loadSelectedEnvId,
  loadSelectedSvcId,
  saveSelectedEnvId,
  saveSelectedSvcId,
} from '@shared/utils/storage';

export interface GqlDemoAppEnvironmentPurgeResult {
  removedStudioEnv: boolean;
  removedEmEnvId: string | null;
  removedEmSvcId: string | null;
  resetEnvSelection: boolean;
  resetSvcSelection: boolean;
}

export async function purgeGqlDemoLessonEnvironmentsFromStorage(): Promise<GqlDemoAppEnvironmentPurgeResult> {
  const removedStudioEnv = await purgeGqlStudioEnvironmentsByName(GQL_STUDIO_DEMO_ENV_NAME);

  const envs = await loadEnvironments();
  const demoEnv = envs.find((e) => e.name === GQL_DEMO_ENV_NAME);
  const nextEnvs = envs.filter((e) => e.name !== GQL_DEMO_ENV_NAME);
  if (demoEnv) {
    await saveEnvironments(nextEnvs);
  }

  const svcs = await loadMicroservices();
  const demoSvc = svcs.find((s) => s.name === GQL_DEMO_SVC_NAME);
  const nextSvcs = svcs.filter((s) => s.name !== GQL_DEMO_SVC_NAME);
  if (demoSvc) {
    await saveMicroservices(nextSvcs);
  }

  const [selEnvId, selSvcId] = await Promise.all([loadSelectedEnvId(), loadSelectedSvcId()]);
  let resetEnvSelection = false;
  let resetSvcSelection = false;

  if (demoEnv && selEnvId === demoEnv.id) {
    await saveSelectedEnvId(nextEnvs[0]?.id ?? '');
    resetEnvSelection = true;
  }
  if (demoSvc && selSvcId === demoSvc.id) {
    await saveSelectedSvcId(nextSvcs[0]?.id ?? '');
    resetSvcSelection = true;
  }

  await purgeGqlDemoEphemeralStorage();

  return {
    removedStudioEnv,
    removedEmEnvId: demoEnv?.id ?? null,
    removedEmSvcId: demoSvc?.id ?? null,
    resetEnvSelection,
    resetSvcSelection,
  };
}
