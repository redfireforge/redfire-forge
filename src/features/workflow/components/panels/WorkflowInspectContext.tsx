import { createContext, useContext, type ReactNode } from 'react';

export interface WorkflowPreviewInfo {
  nodeCount: number;
  edgeCount: number;
  /** Last run status if available. */
  lastRunStatus?: 'pass' | 'fail' | 'idle';
}

export interface WorkflowInspectActions {
  openStepDetail: (nodeId: string) => void;
  openVariableDetail: (key: string, currentValue?: string, onApply?: (newValue: string) => void) => void;
  openNodeConfig: (nodeId: string) => void;
  navigateToWorkflow: (workflowId: string) => void;
  /** Returns preview metadata for a child workflow, or undefined if not found. */
  getWorkflowPreview?: (workflowId: string) => WorkflowPreviewInfo | undefined;
}

const WorkflowInspectContext = createContext<WorkflowInspectActions | null>(null);

export function WorkflowInspectProvider({
  value,
  children,
}: {
  value: WorkflowInspectActions;
  children: ReactNode;
}) {
  return <WorkflowInspectContext.Provider value={value}>{children}</WorkflowInspectContext.Provider>;
}

/** Safe no-ops when used outside the workflow designer shell. */
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflowInspect(): WorkflowInspectActions {
  const v = useContext(WorkflowInspectContext);
  if (!v) {
    return {
      openStepDetail: () => {},
      openVariableDetail: () => {},
      openNodeConfig: () => {},
      navigateToWorkflow: () => {},
    };
  }
  return v;
}
