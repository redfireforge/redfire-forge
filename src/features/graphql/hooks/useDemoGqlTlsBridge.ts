import { useEffect, useRef } from 'react';
import type { GqlTlsSettings } from '../../../shared/types/gqlTls';

interface GqlTlsBridgeDeps {
  applyTlsSettings: (patch: Partial<GqlTlsSettings>) => void;
}

/**
 * Demo-player bridge for GraphQL Studio TLS settings.
 *
 * Exposes `window.__demoApplyGqlTlsSettings(patch)` so lesson helpers can
 * atomically sync skip-cert + CA/mTLS PEM fields without fighting React
 * controlled inputs in the TLS modal.
 */
export function useDemoGqlTlsBridge(deps: GqlTlsBridgeDeps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__demoApplyGqlTlsSettings = (patch: Partial<GqlTlsSettings>) => {
      depsRef.current.applyTlsSettings(patch);
    };

    return () => {
      delete w.__demoApplyGqlTlsSettings;
    };
  }, []);
}
