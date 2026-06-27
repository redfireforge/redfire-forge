import { useEffect, useRef } from 'react';
import type { AdvancedSettingsValues } from '../components/GraphqlAdvancedSettings';
import { purgeGqlDemoBatchDetectionFlags } from '../utils/gqlDemoBatchDetectionCleanup';

interface GqlBatchDetectionBridgeDeps {
  handleAdvSettingsChange: (patch: Partial<AdvancedSettingsValues>) => void;
  setBatchUnsupportedToast: (v: boolean) => void;
}

/**
 * Demo-player bridge:
 *   - `__demoResetGqlBatchDetection()` — clear live + persisted batch-unsupported state
 */
export function useDemoGqlBatchDetectionBridge({
  handleAdvSettingsChange,
  setBatchUnsupportedToast,
}: GqlBatchDetectionBridgeDeps): void {
  const changeRef = useRef(handleAdvSettingsChange);
  changeRef.current = handleAdvSettingsChange;
  const toastRef = useRef(setBatchUnsupportedToast);
  toastRef.current = setBatchUnsupportedToast;

  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;

    win.__demoResetGqlBatchDetection = (): boolean => {
      changeRef.current({ batchUnsupportedDetected: false });
      toastRef.current(false);
      void purgeGqlDemoBatchDetectionFlags();
      return true;
    };

    return () => {
      delete win.__demoResetGqlBatchDetection;
    };
  }, []);
}

export function resetGqlDemoBatchDetectionLive(): boolean {
  const fn = (window as unknown as Record<string, unknown>).__demoResetGqlBatchDetection as
    | (() => boolean)
    | undefined;
  return fn?.() ?? false;
}
