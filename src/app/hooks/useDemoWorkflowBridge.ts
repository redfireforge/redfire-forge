import { useEffect } from 'react';
import type { Workflow } from '../../features/workflow/types/workflow';

/**
 * Exposes demo-player bridge helpers on `window`:
 *   - `__wfDeleteByName(name)` — remove a workflow by name from React state
 *   - `__wfInsertWorkflow(wf)` — add a workflow into React state (used by lessons to seed demo data)
 */
export function useDemoWorkflowBridge(
  workflows: Array<{ id: string; name: string }>,
  remove: (id: string) => void,
  insert?: (wf: Workflow) => void,
): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wfDeleteByName = (name: string) => {
      const wf = workflows.find((w) => w.name === name);
      if (wf) remove(wf.id);
    };
    if (insert) {
      (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insert;
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
      delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
    };
  }, [workflows, remove, insert]);
}
