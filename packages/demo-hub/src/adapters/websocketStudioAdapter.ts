/**
 * WebSocket demo lessons — workflow bridge re-exports until WS-specific adapters are needed.
 */
export {
  connectWorkflowNodes,
  deleteWorkflowByName,
  deselectAllWorkflowNodes,
  insertWorkflow,
  openWorkflowNodeConfig,
} from './workflowDesignerAdapter';
