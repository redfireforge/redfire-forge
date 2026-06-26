import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  getGqlModalLockSnapshot,
  subscribeGqlModalLock,
} from '../utils/gqlModalLockHost';

export type { GqlModalLockState } from '@redfireforge/demo-hub/adapters/gqlModalLockBridge';

interface DemoGqlModalLockBridgeDeps {
  envModalOpen: boolean;
  profileModalOpen: boolean;
  setEnvModalOpen: (open: boolean) => void;
  setProfileModalOpen: (open: boolean) => void;
}

/**
 * Demo-player bridge for GraphQL Studio Env / Connection Profile modals.
 *
 * Env and Profiles stay available at all times during live demos (see gqlModalLockHost).
 */
export function useDemoGqlModalLockBridge(deps: DemoGqlModalLockBridgeDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const lock = useSyncExternalStore(
    subscribeGqlModalLock,
    getGqlModalLockSnapshot,
    getGqlModalLockSnapshot,
  );

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__demoOpenGqlProfileModal = () => {
      depsRef.current.setProfileModalOpen(true);
      return true;
    };
    return () => {
      delete w.__demoOpenGqlProfileModal;
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

export { resetGqlModalLockHostForTests } from '../utils/gqlModalLockHost';
