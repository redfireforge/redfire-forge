import type { KafkaConnectionIndicatorProps, KafkaIndicatorStatus } from './KafkaConnectionIndicator.utils';
import { deriveIndicatorStatus } from './KafkaConnectionIndicator.utils';

function statusLabel(status: KafkaIndicatorStatus, clusterName: string | null): string {
  const name = clusterName ?? 'Kafka';
  switch (status) {
    case 'connected': return `${name} — Connected`;
    case 'connecting': return `${name} — Connecting…`;
    case 'error': return `${name} — Error`;
    case 'disconnected': return `${name} — Disconnected`;
    default: return '';
  }
}

function statusDot(status: KafkaIndicatorStatus): string {
  switch (status) {
    case 'connected': return 'kafka-dot--connected';
    case 'connecting': return 'kafka-dot--connecting';
    case 'error': return 'kafka-dot--error';
    case 'disconnected': return 'kafka-dot--disconnected';
    default: return '';
  }
}

export default function KafkaConnectionIndicator({
  connection,
  clusterName,
  hasClusters,
  onNavigateToSettings,
}: KafkaConnectionIndicatorProps) {
  const status = deriveIndicatorStatus(connection, hasClusters);

  if (status === 'hidden') return null;

  const label = statusLabel(status, clusterName);

  return (
    <button
      className={`kafka-connection-indicator kafka-connection-indicator--${status}`}
      onClick={onNavigateToSettings}
      title={label}
      aria-label={`Kafka status: ${label}. Click to open Kafka settings.`}
      type="button"
    >
      <span className={`kafka-dot ${statusDot(status)}`} aria-hidden="true" />
      <span className="kafka-indicator-label">Kafka</span>
    </button>
  );
}
