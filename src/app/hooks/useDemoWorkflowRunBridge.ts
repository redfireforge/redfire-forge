import { useEffect, useRef } from 'react';

/**
 * Demo-player bridge for workflow Quick Test run UI:
 *   - `__wfResetRunState()` — clear node pass/fail badges, run progress, and console logs
 */
export function useDemoWorkflowRunBridge(
  handleResetRunStatus: () => void,
  clearConsole: () => void,
): void {
  const resetRef = useRef(handleResetRunStatus);
  resetRef.current = handleResetRunStatus;
  const clearRef = useRef(clearConsole);
  clearRef.current = clearConsole;

  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;

    win.__wfResetRunState = (): boolean => {
      resetRef.current();
      clearRef.current();
      return true;
    };

    return () => {
      delete win.__wfResetRunState;
    };
  }, []);
}

export function resetDemoWorkflowRunState(): boolean {
  const fn = (window as unknown as Record<string, unknown>).__wfResetRunState as
    | (() => boolean)
    | undefined;
  return fn?.() ?? false;
}
