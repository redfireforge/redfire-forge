import { useEffect, useRef } from 'react';
import type { Workflow } from '../../features/workflow/types/workflow';

/**
 * Exposes demo-player bridge helpers on `window`:
 *   - `__wfDeleteByName(name)` — remove a workflow by name from React state
 *   - `__wfInsertWorkflow(wf)` — add a workflow into React state (used by lessons to seed demo data)
 *   - `__wfGetWorkflowByName(name)` — read live workflow snapshot (nodes/edges) for preAction guards
 *   - `__wfSelectByName(name)` — select workflow by display name
 *   - `__wfWorkflowsLoaded` — true after persisted workflows have hydrated
 *
 * Bridge callbacks read `workflowsRef` so lesson setup can query by name immediately after
 * `insert()` without waiting for this effect to re-run.
 */
export function useDemoWorkflowBridge(
  workflows: Workflow[],
  remove: (id: string) => void,
  insert?: (wf: Workflow) => void,
  select?: (id: string) => void,
  loaded = false,
): void {
  const workflowsRef = useRef(workflows);
  workflowsRef.current = workflows;
  const removeRef = useRef(remove);
  removeRef.current = remove;
  const insertRef = useRef(insert);
  insertRef.current = insert;
  const selectRef = useRef(select);
  selectRef.current = select;
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;

    win.__wfDeleteByName = (name: string) => {
      const wf = workflowsRef.current.find((w) => w.name === name);
      if (wf) removeRef.current(wf.id);
    };

    win.__wfGetWorkflowByName = (name: string) =>
      workflowsRef.current.find((w) => w.name === name) ?? null;

    win.__wfSelectByName = (name: string) => {
      const sel = selectRef.current;
      if (!sel) return false;
      const wf = workflowsRef.current.find((w) => w.name === name);
      if (!wf) return false;
      sel(wf.id);
      return true;
    };

    return () => {
      delete win.__wfDeleteByName;
      delete win.__wfGetWorkflowByName;
      delete win.__wfSelectByName;
      delete win.__wfInsertWorkflow;
      delete win.__wfWorkflowsLoaded;
    };
  }, []);

  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    if (insert) {
      win.__wfInsertWorkflow = (wf: Workflow) => {
        insertRef.current?.(wf);
      };
    } else {
      delete win.__wfInsertWorkflow;
    }
  }, [insert]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wfWorkflowsLoaded = loadedRef.current;
  }, [loaded, workflows]);
}
