import { useEffect } from 'react';
import type { Workflow } from '../../features/workflow/types/workflow';

/**
 * Exposes demo-player bridge helpers on `window`:
 *   - `__wfDeleteByName(name)` — remove a workflow by name from React state
 *   - `__wfInsertWorkflow(wf)` — add a workflow into React state (used by lessons to seed demo data)
 *   - `__wfGetWorkflowByName(name)` — read live workflow snapshot (nodes/edges) for preAction guards
 */
export function useDemoWorkflowBridge(
  workflows: Workflow[],
  remove: (id: string) => void,
  insert?: (wf: Workflow) => void,
  select?: (id: string) => void,
  loaded = false,
): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wfDeleteByName = (name: string) => {
      const wf = workflows.find((w) => w.name === name);
      if (wf) remove(wf.id);
    };
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      workflows.find((w) => w.name === name) ?? null;
    (window as unknown as Record<string, unknown>).__wfWorkflowsLoaded = loaded;
    if (select) {
      (window as unknown as Record<string, unknown>).__wfSelectByName = (name: string) => {
        const wf = workflows.find((w) => w.name === name);
        if (!wf) return false;
        select(wf.id);
        return true;
      };
    }
    if (insert) {
      (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insert;
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
      delete (window as unknown as Record<string, unknown>).__wfGetWorkflowByName;
      delete (window as unknown as Record<string, unknown>).__wfSelectByName;
      delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
      delete (window as unknown as Record<string, unknown>).__wfWorkflowsLoaded;
    };
  }, [workflows, remove, insert, select, loaded]);
}
