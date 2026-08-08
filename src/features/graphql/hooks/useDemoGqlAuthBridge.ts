import { useEffect, useRef } from 'react';

interface GqlAuthBridgeDeps {
  clearActiveTabAuth: () => void;
}

/**
 * Demo-player bridge for GraphQL Studio tab auth override state.
 *
 * Exposes `window.__demoClearActiveTabAuth()` so lesson setup can clear a
 * per-tab auth override without opening/closing the Auth bottom panel
 * (avoids Preparing-phase UI flash before step 1).
 */
export function useDemoGqlAuthBridge(deps: GqlAuthBridgeDeps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__demoClearActiveTabAuth = () => {
      depsRef.current.clearActiveTabAuth();
      return true;
    };

    return () => {
      delete w.__demoClearActiveTabAuth;
    };
  }, []);
}
