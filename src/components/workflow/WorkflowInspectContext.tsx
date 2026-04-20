import { createContext, useContext, type ReactNode } from 'react';

export interface WorkflowInspectActions {
  openStepDetail: (nodeId: string) => void;
  openVariableDetail: (key: string) => void;
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
export function useWorkflowInspect(): WorkflowInspectActions {
  const v = useContext(WorkflowInspectContext);
  if (!v) {
    return {
      openStepDetail: () => {},
      openVariableDetail: () => {},
    };
  }
  return v;
}
