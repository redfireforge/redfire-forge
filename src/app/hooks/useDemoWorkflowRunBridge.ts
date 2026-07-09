import { useEffect, useRef } from 'react';

/**
 * Demo-player bridge for workflow Quick Test run UI:
 *   - `__wfResetRunState()` — clear node pass/fail badges, run progress, and console logs
 *   - `__wfQuickTest()` — trigger the Workflow Designer Quick Test action
 */
export function useDemoWorkflowRunBridge(
  handleResetRunStatus: () => void,
  clearConsole: () => void,
  handleQuickTest: () => void,
): void {
  const resetRef = useRef(handleResetRunStatus);
  resetRef.current = handleResetRunStatus;
  const clearRef = useRef(clearConsole);
  clearRef.current = clearConsole;
  const quickTestRef = useRef(handleQuickTest);
  quickTestRef.current = handleQuickTest;

  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;

    win.__wfResetRunState = (): boolean => {
      resetRef.current();
      clearRef.current();
      return true;
    };

    win.__wfQuickTest = (): void => {
      quickTestRef.current();
    };

    return () => {
      delete win.__wfResetRunState;
      delete win.__wfQuickTest;
    };
  }, []);
}

export function resetDemoWorkflowRunState(): boolean {
  const fn = (window as unknown as Record<string, unknown>).__wfResetRunState as
    | (() => boolean)
    | undefined;
  return fn?.() ?? false;
}
