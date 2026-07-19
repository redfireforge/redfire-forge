import { useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Environment } from '../../shared/types';

interface Deps {
  setEnvironments: React.Dispatch<React.SetStateAction<Environment[]>>;
}

/**
 * Demo-player bridge: exposes `__demoEnsureSettingsEnv(name)` on window so demo lessons
 * can guarantee a Settings environment exists before interacting with collection modals.
 * Returns the env ID (existing or newly created).
 */
export function useDemoSettingsEnvBridge(deps: Deps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__demoEnsureSettingsEnv = (name: string): string => {
      let envId = '';
      depsRef.current.setEnvironments((prev) => {
        const existing = prev.find(
          (e) => e.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          envId = existing.id;
          return prev;
        }
        envId = uuidv4();
        return [...prev, { id: envId, name, baseUrls: {} }];
      });
      return envId;
    };

    w.__demoRemoveSettingsEnv = (name: string): void => {
      depsRef.current.setEnvironments((prev) =>
        prev.filter((e) => e.name.toLowerCase() !== name.toLowerCase()),
      );
    };

    return () => {
      delete w.__demoEnsureSettingsEnv;
      delete w.__demoRemoveSettingsEnv;
    };
  }, []);
}
