import { useCallback, useRef, useState } from 'react';
import type { GqlTabExecutionHandle } from '../types/gqlTabExecution';

export interface UseGqlTabExecutionRegistryResult {
  /** Bumps when any registered tab's execution state changes (Phase 6E). */
  version: number;
  register: (tabId: string, handle: GqlTabExecutionHandle) => void;
  unregister: (tabId: string) => void;
  getHandle: (tabId: string) => GqlTabExecutionHandle | null;
  notifyStateChange: () => void;
}

/** Registry of per-tab execution handles for keyboard shortcuts and tab-close cancel (Phase 6E). */
export function useGqlTabExecutionRegistry(): UseGqlTabExecutionRegistryResult {
  const handlesRef = useRef<Map<string, GqlTabExecutionHandle>>(new Map());
  const [version, setVersion] = useState(0);

  const notifyStateChange = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const register = useCallback((tabId: string, handle: GqlTabExecutionHandle) => {
    const prev = handlesRef.current.get(tabId);
    handlesRef.current.set(tabId, handle);
    if (prev !== handle) {
      notifyStateChange();
    }
  }, [notifyStateChange]);

  const unregister = useCallback((tabId: string) => {
    if (!handlesRef.current.has(tabId)) return;
    handlesRef.current.delete(tabId);
    notifyStateChange();
  }, [notifyStateChange]);

  const getHandle = useCallback(
    (tabId: string) => handlesRef.current.get(tabId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the intentional invalidation signal
    [version],
  );

  return { version, register, unregister, getHandle, notifyStateChange };
}
