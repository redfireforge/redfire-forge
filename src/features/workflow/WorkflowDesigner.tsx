import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { WorkflowDesignerProps } from './utils/workflowDesignerShellTypes';
import { useWorkflowDesignerController } from './hooks/useWorkflowDesignerController';
import WorkflowDesignerEmptyState from './components/WorkflowDesignerEmptyState';
import WorkflowDesignerMainLayout from './components/WorkflowDesignerMainLayout';

export default function WorkflowDesignerWrapper(props: WorkflowDesignerProps) {
  return (
    <ReactFlowProvider>
      <WorkflowDesignerInner {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowDesignerInner(props: WorkflowDesignerProps) {
  const vm = useWorkflowDesignerController(props);
  if (!vm.selected) {
    return <WorkflowDesignerEmptyState />;
  }
  return <WorkflowDesignerMainLayout {...vm} />;
}
