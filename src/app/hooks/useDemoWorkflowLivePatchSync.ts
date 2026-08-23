import { useEffect, useRef } from 'react';
import type { Workflow, WorkflowNodeData } from '@workflow/types/workflow';
import type { WorkflowRFNode } from '@workflow/utils/workflowNodeFactory';

/**
 * Registers `__wfSyncLiveWorkflowFromPatch` so demo lessons can patch the workflow
 * store via `__wfPatchWorkflowByName` and keep the live canvas + Quick Test variables
 * in sync (canvas sync only runs on workflow selection change).
 */
export function useDemoWorkflowLivePatchSync(
  selectedName: string | undefined,
  nodes: WorkflowRFNode[],
  setWorkflowVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  workflowVariablesRef: React.MutableRefObject<Record<string, string>>,
  handleUpdateNode: (id: string, patch: Partial<WorkflowNodeData>) => void,
): void {
  const selectedNameRef = useRef(selectedName);
  selectedNameRef.current = selectedName;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const setWorkflowVariablesRef = useRef(setWorkflowVariables);
  setWorkflowVariablesRef.current = setWorkflowVariables;
  const workflowVariablesRefRef = useRef(workflowVariablesRef);
  workflowVariablesRefRef.current = workflowVariablesRef;
  const handleUpdateNodeRef = useRef(handleUpdateNode);
  handleUpdateNodeRef.current = handleUpdateNode;

  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;

    // Expose the currently-selected workflow name so demo lessons can detect when
    // a *different* lesson's workflow is still on screen and switch/re-seed their
    // own — otherwise lesson actions pile nodes onto the previous graph.
    win.__wfGetSelectedName = (): string | undefined => selectedNameRef.current;

    win.__wfSyncLiveWorkflowFromPatch = (
      workflowName: string,
      patch: Partial<Omit<Workflow, 'id' | 'createdAt'>>,
    ): boolean => {
      if (selectedNameRef.current !== workflowName) return false;

      let synced = false;

      if (patch.variables) {
        const next = { ...patch.variables };
        workflowVariablesRefRef.current.current = next;
        setWorkflowVariablesRef.current(next);
        synced = true;
      }

      if (patch.nodes) {
        const startFromPatch = patch.nodes.find((n) => n.type === 'start');
        const inputVariables = (startFromPatch?.data as { inputVariables?: Record<string, string> } | undefined)
          ?.inputVariables;
        if (inputVariables) {
          const liveStart = nodesRef.current.find((n) => n.type === 'start');
          if (liveStart) {
            handleUpdateNodeRef.current(liveStart.id, { inputVariables: { ...inputVariables } });
            synced = true;
          }
        }
      }

      return synced;
    };

    return () => {
      delete win.__wfSyncLiveWorkflowFromPatch;
      delete win.__wfGetSelectedName;
    };
  }, []);
}
