import { useEffect } from 'react';

/**
 * Exposes a `__wfDeleteByName` helper on `window` for demo lessons
 * that need to delete a workflow by name from React state.
 */
export function useDemoWorkflowBridge(
  workflows: Array<{ id: string; name: string }>,
  remove: (id: string) => void,
): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wfDeleteByName = (name: string) => {
      const wf = workflows.find((w) => w.name === name);
      if (wf) remove(wf.id);
    };
    return () => { delete (window as unknown as Record<string, unknown>).__wfDeleteByName; };
  }, [workflows, remove]);
}
