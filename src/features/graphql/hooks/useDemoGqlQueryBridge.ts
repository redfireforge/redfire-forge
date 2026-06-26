import { useEffect, useRef } from 'react';

interface GqlQueryBridgeDeps {
  setGqlQuery: (query: string) => void;
}

/**
 * Demo-player bridge for GraphQL Studio query editor state.
 *
 * Exposes `window.__demoSetGqlQuery(query)` so lesson helpers can sync Monaco
 * programmatic edits into React tab state before Execute runs.
 */
export function useDemoGqlQueryBridge(deps: GqlQueryBridgeDeps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__demoSetGqlQuery = (query: string) => {
      depsRef.current.setGqlQuery(query);
    };

    return () => {
      delete w.__demoSetGqlQuery;
    };
  }, []);
}
