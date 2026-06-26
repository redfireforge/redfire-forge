import { useEffect, useRef } from 'react';

export type GqlStudioRightView = 'response' | 'schema';

interface GqlRightViewBridgeDeps {
  setRightView: (view: GqlStudioRightView) => void;
}

/**
 * Demo-player bridge for GraphQL Studio right-pane tab state.
 *
 * Exposes `window.__demoSetGqlRightView(view)` so lesson helpers can switch
 * Response ↔ Schema reliably on Tauri (React state) without fragile DOM clicks.
 */
export function useDemoGqlRightViewBridge(deps: GqlRightViewBridgeDeps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__demoSetGqlRightView = (view: GqlStudioRightView) => {
      depsRef.current.setRightView(view);
    };

    return () => {
      delete w.__demoSetGqlRightView;
    };
  }, []);
}
