import { useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Microservice } from '../../shared/types';

interface Deps {
  setMicroservices: React.Dispatch<React.SetStateAction<Microservice[]>>;
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

    return () => {
      delete w.__demoEnsureSettingsSvc;
      delete w.__demoRemoveSettingsSvc;
    };
  }, []);
}
