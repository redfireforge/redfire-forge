import type { KafkaConnectionSnapshot } from '../../shared/kafka/kafkaConfig';

export type KafkaIndicatorStatus = 'disconnected' | 'connected' | 'connecting' | 'error' | 'hidden';

export interface KafkaConnectionIndicatorProps {
  connection: KafkaConnectionSnapshot;
  clusterName: string | null;
  hasClusters: boolean;
  onNavigateToSettings: () => void;
}

export function deriveIndicatorStatus(
  connection: KafkaConnectionSnapshot,
  hasClusters: boolean,
): KafkaIndicatorStatus {
  if (!hasClusters) return 'hidden';
  switch (connection.state) {
    case 'connected': return 'connected';
    case 'testing': return 'connecting';
    case 'error': return 'error';
    default: return 'disconnected';
  }
}
