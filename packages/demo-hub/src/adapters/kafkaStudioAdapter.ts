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

/** Clear every saved Kafka cluster and reset connection (quiet demo prep). */
export function clearAllKafkaClusters(): void {
  getDemoBridgeWindow().__demoClearAllKafkaClusters?.();
}

/** Ensure the plaintext Demo Cluster profile exists and is selected (no Settings UI). */
export function ensurePlaintextKafkaCluster(): void {
  getDemoBridgeWindow().__demoEnsurePlaintextKafkaCluster?.();
}

/** Mark React Kafka state connected for `clusterId` after a quiet API connect. */
export function markKafkaConnected(clusterId: string): void {
  getDemoBridgeWindow().__demoMarkKafkaConnected?.(clusterId);
}
