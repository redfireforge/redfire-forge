import { useKafkaMessageStudio } from '../../app/hooks/useKafkaMessageStudio';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';
import { KafkaStudioGuard } from './KafkaStudioGuard';
import { KafkaPublishStudio } from './KafkaPublishStudio';
import { KafkaConsumeStudio } from './KafkaConsumeStudio';

interface KafkaMessageStudioPageProps {
  kafkaState: UseKafkaStateReturn;
  onNavigateToKafkaSettings: () => void;
}

export function KafkaMessageStudioPage({
  kafkaState,
  onNavigateToKafkaSettings,
}: KafkaMessageStudioPageProps) {
  const studio = useKafkaMessageStudio(kafkaState);

  if (!kafkaState.loaded) {
    return (
      <div className="kafka-message-studio-page">
        <p className="kafka-ms-loading">Loading Kafka settings…</p>
      </div>
    );
  }

  if (kafkaState.connection.state !== 'connected') {
    return (
      <div className="kafka-message-studio-page">
        <KafkaStudioGuard
          connection={kafkaState.connection}
          hasClusters={kafkaState.clusters.length > 0}
          onNavigateToSettings={onNavigateToKafkaSettings}
        />
      </div>
    );
  }

  const clusterId = kafkaState.selectedClusterId ?? '';

  return (
    <div className="kafka-message-studio-page">
      <div className="kafka-ms-panels">
        <KafkaPublishStudio studio={studio} clusterId={clusterId} />
        <KafkaConsumeStudio studio={studio} clusterId={clusterId} />
      </div>
    </div>
  );
}
