import { useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Microservice } from '@shared/types';

interface Deps {
  setMicroservices: React.Dispatch<React.SetStateAction<Microservice[]>>;
}

export interface DemoResetSettingsSvcOptions {
  /** Drop every protocol tab (default true). */
  clearProtocols?: boolean;
  /** Clear microservice global / protocol vars (default true). */
  clearGlobalVars?: boolean;
}

/**
 * Demo-player bridge: exposes `__demoEnsureSettingsSvc(name, baseUrls)` on window so demo
 * lessons can guarantee a Settings microservice exists before interacting with collection
 * modals. Returns the svc ID (existing or newly created).
 */
export function useDemoSettingsSvcBridge(deps: Deps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__demoEnsureSettingsSvc = (name: string, baseUrls?: Record<string, string>): string => {
      let svcId = '';
      depsRef.current.setMicroservices((prev) => {
        const existing = prev.find(
          (s) => s.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          svcId = existing.id;
          if (baseUrls) {
            const merged = { ...existing.baseUrls, ...baseUrls };
            if (JSON.stringify(merged) !== JSON.stringify(existing.baseUrls)) {
              return prev.map((s) => s.id === existing.id ? { ...s, baseUrls: merged } : s);
            }
          }
          return prev;
        }
        svcId = uuidv4();
        return [...prev, { id: svcId, name, baseUrls: baseUrls ?? {} }];
      });
      return svcId;
    };

    w.__demoRemoveSettingsSvc = (name: string): void => {
      depsRef.current.setMicroservices((prev) =>
        prev.filter((s) => s.name.toLowerCase() !== name.toLowerCase()),
      );
    };

    /**
     * Quietly wipe protocol tabs / endpoints / vars on a named microservice so
     * lessons that teach "+ Add protocol" start from an empty panel — DOM ×
     * clicks are unreliable (remove control is display:none until hover/active).
     */
    w.__demoResetSettingsSvcProtocols = (
      name: string,
      options?: DemoResetSettingsSvcOptions,
    ): boolean => {
      const clearProtocols = options?.clearProtocols !== false;
      const clearGlobalVars = options?.clearGlobalVars !== false;
      let found = false;
      depsRef.current.setMicroservices((prev) => {
        const idx = prev.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
        if (idx < 0) return prev;
        found = true;
        const current = prev[idx]!;
        const next: Microservice = {
          ...current,
          ...(clearProtocols
            ? { enabledProtocols: [], protocolEndpoints: {} }
            : {}),
          ...(clearGlobalVars ? { globalVars: {} } : {}),
        };
        const copy = prev.slice();
        copy[idx] = next;
        return copy;
      });
      return found;
    };

    return () => {
      delete w.__demoEnsureSettingsSvc;
      delete w.__demoRemoveSettingsSvc;
      delete w.__demoResetSettingsSvcProtocols;
    };
  }, []);
}
