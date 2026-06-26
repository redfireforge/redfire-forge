import { useEffect, useRef, useState } from 'react';

export interface GqlModalLockState {
  envAllowed: boolean;
  profileAllowed: boolean;
}

const DEFAULT_LOCK: GqlModalLockState = { envAllowed: true, profileAllowed: true };

interface DemoGqlModalLockBridgeDeps {
  envModalOpen: boolean;
  profileModalOpen: boolean;
  setEnvModalOpen: (open: boolean) => void;
  setProfileModalOpen: (open: boolean) => void;
}

/**
 * Demo-player bridge for GraphQL Studio Env / Connection Profile modals.
 *
 * During live demos, only the step spotlight target may open its modal.
 * When a modal is locked, any open instance is closed automatically.
 */
export function useDemoGqlModalLockBridge(deps: DemoGqlModalLockBridgeDeps): GqlModalLockState {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [lock, setLock] = useState<GqlModalLockState>(DEFAULT_LOCK);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__demoSetGqlModalLock = (next: GqlModalLockState) => {
      setLock(next);
    };
    return () => {
      delete w.__demoSetGqlModalLock;
      setLock(DEFAULT_LOCK);
    };
  }, []);

  useEffect(() => {
    if (!lock.envAllowed && depsRef.current.envModalOpen) {
      depsRef.current.setEnvModalOpen(false);
    }
    if (!lock.profileAllowed && depsRef.current.profileModalOpen) {
      depsRef.current.setProfileModalOpen(false);
    }
  }, [lock]);

  return lock;
}
