/**
 * Kafka demo lessons — workflow bridge re-exports until Kafka-specific adapters are needed.
 */
export {
  deleteWorkflowByName,
  insertWorkflow,
  getWorkflowByName,
} from './workflowDesignerAdapter';

import { getDemoBridgeWindow } from './bridgeWindow';

/** Delete a saved Kafka cluster by its ID (demo lesson cleanup). */
export function deleteKafkaClusterById(clusterId: string): void {
  getDemoBridgeWindow().__demoDeleteKafkaClusterById?.(clusterId);
}

/** Delete a saved Kafka cluster by its display name (demo lesson cleanup). */
export function deleteKafkaClusterByName(name: string): void {
  getDemoBridgeWindow().__demoDeleteKafkaClusterByName?.(name);
}
