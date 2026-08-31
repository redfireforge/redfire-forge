import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { Tab } from '../utils/appTabUtils';
import { getBlockedDesktopFeature } from '../utils/desktopFeatureGate';

/**
 * Wraps setActiveTab so hosted-web users hitting desktop-only features
 * (API Mock / gRPC / Kafka Studio) see a modal instead of navigating.
 */
export function useDesktopFeatureGate(setActiveTab: Dispatch<SetStateAction<Tab>>) {
  const [desktopRequiredFeature, setDesktopRequiredFeature] = useState<string | null>(null);

  const gatedSetActiveTab = useCallback<Dispatch<SetStateAction<Tab>>>((value) => {
    setActiveTab((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      const blocked = getBlockedDesktopFeature(next);
      if (blocked) {
        // Defer feature state so we never nest setState inside this updater
        queueMicrotask(() => setDesktopRequiredFeature(blocked));
        return prev;
      }
      return next;
    });
  }, [setActiveTab]);

  const dismissDesktopRequired = useCallback(() => {
    setDesktopRequiredFeature(null);
  }, []);

  return {
    gatedSetActiveTab,
    desktopRequiredFeature,
    dismissDesktopRequired,
  };
}
