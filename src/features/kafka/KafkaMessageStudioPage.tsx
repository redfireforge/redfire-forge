import { useCallback } from 'react';
import { useKafkaMessageStudio } from '../../app/hooks/useKafkaMessageStudio';
import { useKafkaTemplates } from '../../app/hooks/useKafkaTemplates';
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
  const templates = useKafkaTemplates();

  // ── Publish template handlers ────────────────────────────────────────────
  const handleSavePublishTemplate = useCallback(
    (name: string) => templates.savePublishTemplate(name, studio.publishDraft),
    [templates, studio.publishDraft],
  );

  const handleLoadPublishTemplate = useCallback(
    (id: string) => {
      const draft = templates.loadPublishTemplate(id);
      if (draft) studio.setPublishDraft(draft);
    },
    [templates, studio],
  );

  // ── Consume template handlers ────────────────────────────────────────────
  const handleSaveConsumeTemplate = useCallback(
    (name: string) => templates.saveConsumeTemplate(name, studio.consumeDraft),
    [templates, studio.consumeDraft],
  );

  const handleLoadConsumeTemplate = useCallback(
    (id: string) => {
      // groupId is stripped by the hook — the patch merge preserves the current session's groupId
      const draft = templates.loadConsumeTemplate(id);
      if (draft) studio.setConsumeDraft(draft);
    },
    [templates, studio],
  );

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
        <KafkaPublishStudio
          studio={studio}
          clusterId={clusterId}
          publishTemplates={templates.publishTemplates}
          templatesLoading={templates.templatesLoading}
          onSaveTemplate={handleSavePublishTemplate}
          onLoadTemplate={handleLoadPublishTemplate}
          onDeleteTemplate={templates.deletePublishTemplate}
        />
        <KafkaConsumeStudio
          studio={studio}
          clusterId={clusterId}
          consumeTemplates={templates.consumeTemplates}
          templatesLoading={templates.templatesLoading}
          onSaveConsumeTemplate={handleSaveConsumeTemplate}
          onLoadConsumeTemplate={handleLoadConsumeTemplate}
          onDeleteConsumeTemplate={templates.deleteConsumeTemplate}
        />
      </div>
    </div>
  );
}
