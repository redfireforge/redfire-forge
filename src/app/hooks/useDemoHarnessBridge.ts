import { useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Environment, Microservice, FeatureGroup, SharedDataSource, TestRun } from '../../shared/types';
import { saveTestRun, loadTestRuns, deleteTestRun } from '../../shared/utils/storage';

/** Fired after demo seed/delete so ResultsDashboard can reload without a remount. */
export const DEMO_TEST_RUNS_CHANGED_EVENT = 'demo-test-runs-changed';

function notifyDemoTestRunsChanged(): void {
  window.dispatchEvent(new CustomEvent(DEMO_TEST_RUNS_CHANGED_EVENT));
}

/**
 * Demo-player bridge for seeding a target environment + microservice
 * so Send-to-Harness cascade selects have at least one option,
 * and for cleaning up feature groups created during the lesson.
 */
export function useDemoHarnessBridge(
  environments: Environment[],
  microservices: Microservice[],
  setEnvironments: Dispatch<SetStateAction<Environment[]>>,
  setMicroservices: Dispatch<SetStateAction<Microservice[]>>,
  setFeatureGroups?: Dispatch<SetStateAction<FeatureGroup[]>>,
  setSelectedEnvId?: (id: string) => void,
  setSelectedSvcId?: (id: string) => void,
  setSharedDataSources?: Dispatch<SetStateAction<SharedDataSource[]>>,
): void {
  const seedTarget = useCallback(() => {
    const DEMO_ENV_NAME = 'demo';
    const DEMO_SVC_NAME = 'jsonplaceholder';

    let env = environments.find(e => e.name === DEMO_ENV_NAME);
    if (!env) {
      env = { id: crypto.randomUUID(), name: DEMO_ENV_NAME };
      setEnvironments(prev => [...prev, env!]);
    }

    const DEMO_BASE_URL = 'https://jsonplaceholder.typicode.com';
    let svc = microservices.find(s => s.name === DEMO_SVC_NAME);
    if (!svc) {
      svc = { id: crypto.randomUUID(), name: DEMO_SVC_NAME, baseUrls: { [env.id]: DEMO_BASE_URL } };
      setMicroservices(prev => [...prev, svc!]);
    } else if (!(env.id in svc.baseUrls) || !svc.baseUrls[env.id]) {
      svc = { ...svc, baseUrls: { ...svc.baseUrls, [env.id]: DEMO_BASE_URL } };
      setMicroservices(prev => prev.map(s => s.id === svc!.id ? svc! : s));
    }

    return { envId: env.id, svcId: svc.id };
  }, [environments, microservices, setEnvironments, setMicroservices]);

  const deleteFeatureGroupsByName = useCallback((name: string) => {
    setFeatureGroups?.(prev => prev.filter(fg => fg.name !== name));
  }, [setFeatureGroups]);

  const seedFeatureGroup = useCallback((fg: FeatureGroup) => {
    setFeatureGroups?.(prev => {
      if (prev.some(existing => existing.name === fg.name)) return prev;
      return [...prev, fg];
    });
  }, [setFeatureGroups]);

  const selectEnvSvc = useCallback((envId: string, svcId: string) => {
    setSelectedEnvId?.(envId);
    setSelectedSvcId?.(svcId);
  }, [setSelectedEnvId, setSelectedSvcId]);

  const seedDemoTestRun = useCallback(async (run: TestRun) => {
    await saveTestRun(run);
    notifyDemoTestRunsChanged();
  }, []);

  const deleteDemoTestRuns = useCallback(async (prefix: string) => {
    const all = await loadTestRuns();
    for (const r of all) {
      if (r.id.startsWith(prefix)) await deleteTestRun(r.id);
    }
    notifyDemoTestRunsChanged();
  }, []);

  const hasDemoTestRuns = useCallback(async (prefix: string) => {
    const all = await loadTestRuns();
    return all.some(r => r.id.startsWith(prefix));
  }, []);

  const seedSharedDataSources = useCallback((sources: SharedDataSource[]) => {
    setSharedDataSources?.(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const newOnes = sources.filter(s => !existingIds.has(s.id));
      return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
    });
  }, [setSharedDataSources]);

  const deleteSharedDataSourcesByName = useCallback((name: string) => {
    setSharedDataSources?.(prev => prev.filter(s => s.name !== name));
  }, [setSharedDataSources]);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__demoSeedHarnessTarget = seedTarget;
    w.__demoDeleteFeatureGroupsByName = deleteFeatureGroupsByName;
    w.__demoSeedFeatureGroup = seedFeatureGroup;
    w.__demoSelectEnvSvc = selectEnvSvc;
    w.__demoSeedTestRun = seedDemoTestRun;
    w.__demoDeleteTestRuns = deleteDemoTestRuns;
    w.__demoHasTestRuns = hasDemoTestRuns;
    w.__demoSeedSharedDataSources = seedSharedDataSources;
    w.__demoDeleteSharedDataSourcesByName = deleteSharedDataSourcesByName;
    return () => {
      delete w.__demoSeedHarnessTarget;
      delete w.__demoDeleteFeatureGroupsByName;
      delete w.__demoSeedFeatureGroup;
      delete w.__demoSelectEnvSvc;
      delete w.__demoSeedTestRun;
      delete w.__demoDeleteTestRuns;
      delete w.__demoHasTestRuns;
      delete w.__demoSeedSharedDataSources;
      delete w.__demoDeleteSharedDataSourcesByName;
    };
  }, [seedTarget, deleteFeatureGroupsByName, seedFeatureGroup, selectEnvSvc, seedDemoTestRun, deleteDemoTestRuns, hasDemoTestRuns, seedSharedDataSources, deleteSharedDataSourcesByName]);
}
