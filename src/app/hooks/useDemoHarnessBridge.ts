import { useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Environment, Microservice, FeatureGroup } from '../../shared/types';

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

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__demoSeedHarnessTarget = seedTarget;
    w.__demoDeleteFeatureGroupsByName = deleteFeatureGroupsByName;
    return () => {
      delete w.__demoSeedHarnessTarget;
      delete w.__demoDeleteFeatureGroupsByName;
    };
  }, [seedTarget, deleteFeatureGroupsByName]);
}
