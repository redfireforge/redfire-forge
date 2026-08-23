import type { KafkaConnectionSnapshot } from '@shared/kafka/kafkaConfig';

interface KafkaStudioGuardProps {
  connection: KafkaConnectionSnapshot;
  hasClusters: boolean;
  onNavigateToSettings: () => void;
}

export function KafkaStudioGuard({
  connection,
  hasClusters,
  onNavigateToSettings,
}: KafkaStudioGuardProps) {
  let title: string;
  let subtitle: string | null = null;
  let btnLabel: string | null = null;

  if (!hasClusters) {
    title = 'No clusters configured';
    subtitle = 'Add a Kafka cluster in settings to get started.';
    btnLabel = '→ Add a cluster';
  } else if (connection.state === 'testing') {
    title = 'Connecting to cluster…';
    subtitle = null;
    btnLabel = null;
  } else if (connection.state === 'error') {
    title = 'Cluster connection error';
    subtitle = connection.lastError ?? 'Unknown error';
    btnLabel = '→ Open Kafka Settings';
  } else {
    // 'disconnected' (or any other non-connected state)
    title = 'Cluster is not connected';
    subtitle = 'Connect to a Kafka cluster to use the studio.';
    btnLabel = '→ Open Kafka Settings';
  }

  return (
    <div className="kafka-studio-guard">
      <div className="kafka-studio-guard-inner">
        {connection.state === 'testing' && (
          <div className="kafka-studio-guard-spinner" aria-label="Connecting" />
        )}
        <p className="kafka-studio-guard-title">{title}</p>
        {subtitle && (
          <p className="kafka-studio-guard-error" data-testid="guard-subtitle">
            {subtitle}
          </p>
        )}
        {btnLabel && (
          <button
            className="kafka-studio-guard-btn"
            onClick={onNavigateToSettings}
            data-testid="guard-action-btn"
          >
            {btnLabel}
          </button>
        )}
      </div>
    </div>
  );
}
