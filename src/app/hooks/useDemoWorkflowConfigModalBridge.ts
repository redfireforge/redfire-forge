import { useEffect } from 'react';

/**
 * Demo-player bridge for the workflow node config modal.
 *   - `__wfCloseConfigModal()` — dismiss open node config when demo advances steps
 */
export function useDemoWorkflowConfigModalBridge(closeConfigModal: () => void): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wfCloseConfigModal = closeConfigModal;

    return () => {
      delete (window as unknown as Record<string, unknown>).__wfCloseConfigModal;
    };
  }, [closeConfigModal]);
}

export function closeDemoWorkflowConfigModal(): void {
  const fn = (window as unknown as Record<string, unknown>).__wfCloseConfigModal as
    | (() => void)
    | undefined;
  fn?.();
}
