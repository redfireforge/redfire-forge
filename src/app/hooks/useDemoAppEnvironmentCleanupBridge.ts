import { useEffect, useRef } from 'react';
import type { Environment, Microservice } from '@shared/types';
import {
  GQL_DEMO_ENV_NAME,
  GQL_DEMO_SVC_NAME,
  GQL_STUDIO_DEMO_ENV_NAME,
} from '@redfireforge/demo-hub/lessons/env-manager-lesson-helpers';

interface DemoAppEnvironmentCleanupBridgeDeps {
  selectedEnvId: string;
  selectedSvcId: string;
  setEnvironments: React.Dispatch<React.SetStateAction<Environment[]>>;
  setMicroservices: React.Dispatch<React.SetStateAction<Microservice[]>>;
  setSelectedEnvId: (id: string) => void;
  setSelectedSvcId: (id: string) => void;
}

/**
 * Demo-player bridge: purge GraphQL lesson demo environments from storage and
 * sync App + GraphQL Studio React state. Always mounted while the app runs.
 */
export function useDemoAppEnvironmentCleanupBridge(
  deps: DemoAppEnvironmentCleanupBridgeDeps,
): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__demoPurgeGqlLessonEnvironments = async () => {
      const { purgeGqlDemoLessonEnvironmentsFromStorage } = await import(
        '@redfireforge/demo-hub/lessons/gql-demo-app-environment-cleanup'
      );
      const result = await purgeGqlDemoLessonEnvironmentsFromStorage();
      const {
        selectedEnvId,
        selectedSvcId,
        setEnvironments,
        setMicroservices,
        setSelectedEnvId,
        setSelectedSvcId,
      } = depsRef.current;

      setEnvironments((prev) => {
        const next = prev.filter((e) => e.name !== GQL_DEMO_ENV_NAME);
        if (result.removedEmEnvId && selectedEnvId === result.removedEmEnvId) {
          setSelectedEnvId(next[0]?.id ?? '');
        }
        return next;
      });
      setMicroservices((prev) => {
        const next = prev.filter((s) => s.name !== GQL_DEMO_SVC_NAME);
        if (result.removedEmSvcId && selectedSvcId === result.removedEmSvcId) {
          setSelectedSvcId(next[0]?.id ?? '');
        }
        return next;
      });

      const deleteStudioEnv = w.__demoDeleteGqlEnvByName as ((name: string) => void) | undefined;
      if (result.removedStudioEnv) {
        deleteStudioEnv?.(GQL_STUDIO_DEMO_ENV_NAME);
      }
    };

    return () => {
      delete w.__demoPurgeGqlLessonEnvironments;
    };
  }, []);
}
