/**
 * Kafka demo lessons — workflow bridge re-exports until Kafka-specific adapters are needed.
 */
export {
  deleteWorkflowByName,
  insertWorkflow,
  getWorkflowByName,
} from './workflowDesignerAdapter';
