import { useEffect, useRef } from 'react';
import { getDemoBridgeWindow } from '@redfireforge/demo-hub/adapters';

/**
 * Exposes demo-player E2E helpers on `window` for Playwright specs.
 * Used by Phase 8 "rapid Next preAction recovery" tests — the live UI disables
 * Next during reading, so specs jump directly to the final step's reading phase.
 */
export function useDemoPlayerE2EBridge(
  goToStepReadingOnly: ((index: number) => Promise<void>) | undefined,
  finishCurrentStepAction: (() => Promise<void>) | undefined,
  enabled: boolean,
): void {
  const goToRef = useRef(goToStepReadingOnly);
  goToRef.current = goToStepReadingOnly;
  const finishRef = useRef(finishCurrentStepAction);
  finishRef.current = finishCurrentStepAction;

  useEffect(() => {
    if (!enabled) return;
    const win = getDemoBridgeWindow();
    win.__demoGoToStepReadingOnly = async (index: number) => {
      const fn = goToRef.current;
      if (!fn) throw new Error('goToStepReadingOnly unavailable — demo not in live mode');
      await fn(index);
    };
    win.__demoFinishStepFromReading = async () => {
      const fn = finishRef.current;
      if (!fn) throw new Error('finishCurrentStepAction unavailable — demo not in live mode');
      await fn();
    };
    return () => {
      delete win.__demoGoToStepReadingOnly;
      delete win.__demoFinishStepFromReading;
    };
  }, [enabled]);
}
