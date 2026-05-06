import { useMemo } from 'react';
import type { Workflow } from '../types/workflow';
import type { WorkflowInspectActions } from '../components/panels/WorkflowInspectContext';

export function useWorkflowDesignerInspectActions(
  openStepDetail: WorkflowInspectActions['openStepDetail'],
  openVariableDetail: WorkflowInspectActions['openVariableDetail'],
  openNodeConfig: WorkflowInspectActions['openNodeConfig'],
  navigateToWorkflow: WorkflowInspectActions['navigateToWorkflow'],
  workflows: Workflow[],
): WorkflowInspectActions {
  return useMemo(
    () => ({
      openStepDetail,
      openVariableDetail,
      openNodeConfig,
      navigateToWorkflow,
      getWorkflowPreview: (workflowId: string) => {
        const wf = workflows.find((w) => w.id === workflowId);
        if (!wf) return undefined;
        return {
          nodeCount: wf.nodes.length,
          edgeCount: wf.edges.length,
        };
      },
    }),
    [openStepDetail, openVariableDetail, openNodeConfig, navigateToWorkflow, workflows],
  );
}
