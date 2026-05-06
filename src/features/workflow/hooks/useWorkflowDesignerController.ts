import type { WorkflowDesignerProps } from '../utils/workflowDesignerShellTypes';
import { useWorkflowDesignerControllerPartA } from './useWorkflowDesignerControllerPartA';
import { useWorkflowDesignerControllerPartB } from './useWorkflowDesignerControllerPartB';

export function useWorkflowDesignerController(props: WorkflowDesignerProps) {
  const partA = useWorkflowDesignerControllerPartA(props);
  const partB = useWorkflowDesignerControllerPartB(props, partA);
  return { ...partA, ...partB };
}

export type WorkflowDesignerViewModel = ReturnType<typeof useWorkflowDesignerController>;
