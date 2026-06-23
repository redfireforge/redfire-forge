import { useEffect, useRef } from 'react';

interface GqlEnvBridgeDeps {
  upsertEnvironment: (name: string, vars: Array<{ key: string; value: string }>) => void;
  deleteEnvironmentByName: (name: string) => void;
}

/**
 * Demo-player bridge for the GraphQL tab environment.
 *
 * Exposes two functions on `window`:
 *   - `__demoUpsertGqlEnv(name, vars)` — atomically create-or-update a named env and set it active
 *   - `__demoDeleteGqlEnvByName(name)` — delete all envs with the given name
 */
export function useDemoGqlEnvBridge(deps: GqlEnvBridgeDeps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__demoUpsertGqlEnv = (
      name: string,
      vars: Array<{ key: string; value: string }>,
    ) => {
      depsRef.current.upsertEnvironment(name, vars);
    };

    w.__demoDeleteGqlEnvByName = (name: string) => {
      depsRef.current.deleteEnvironmentByName(name);
    };

    return () => {
      delete w.__demoUpsertGqlEnv;
      delete w.__demoDeleteGqlEnvByName;
    };
  
  }, []); // register once — depsRef always provides latest values
}
