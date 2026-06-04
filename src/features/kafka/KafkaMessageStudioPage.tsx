import { useCallback, useState } from 'react';
import { useKafkaMessageStudio } from '../../app/hooks/useKafkaMessageStudio';
import { useKafkaTemplates } from '../../app/hooks/useKafkaTemplates';
import { useKafkaStreamMode } from '../../app/hooks/useKafkaStreamMode';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';
import { KafkaStudioGuard } from './KafkaStudioGuard';
import { KafkaPublishStudio } from './KafkaPublishStudio';
import { KafkaConsumeStudio } from './KafkaConsumeStudio';

interface KafkaMessageStudioPageProps {
  kafkaState: UseKafkaStateReturn;
  onNavigateToKafkaSettings: () => void;
  onUseAsWorkflowInput?: (payload: string, meta: { topic: string; partition: number; offset: string }) => void;
  lastWorkflowOutput?: Record<string, string> | null;
}

export function KafkaMessageStudioPage({
  kafkaState,
  onNavigateToKafkaSettings,
  onUseAsWorkflowInput,
  lastWorkflowOutput,
}: KafkaMessageStudioPageProps) {
  const [activeTab, setActiveTab] = useState<'publish' | 'consume'>('publish');
  const studio = useKafkaMessageStudio(kafkaState);
  const templates = useKafkaTemplates();
  const streamMode = useKafkaStreamMode(kafkaState);

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
      <div className="builder-tabs kafka-ms-studio-tabs">
        <button
          type="button"
          className={`builder-tab ${activeTab === 'publish' ? 'active' : ''}`}
          onClick={() => setActiveTab('publish')}
        >
          Publish Studio
        </button>
        <button
          type="button"
          className={`builder-tab ${activeTab === 'consume' ? 'active' : ''}`}
          onClick={() => setActiveTab('consume')}
        >
          Consume Studio
        </button>
      </div>
      {templates.templateError && (
        <div className="kafka-ms-template-error" data-testid="template-error">
          Template error: {templates.templateError}
        </div>
      )}
      <div className="kafka-ms-tab-content">
        {activeTab === 'publish' && (
          <KafkaPublishStudio
            studio={studio}
            clusterId={clusterId}
            publishTemplates={templates.publishTemplates}
            templatesLoading={templates.templatesLoading}
            onSaveTemplate={handleSavePublishTemplate}
            onLoadTemplate={handleLoadPublishTemplate}
            onDeleteTemplate={templates.deletePublishTemplate}
            lastWorkflowOutput={lastWorkflowOutput}
          />
        )}
        {activeTab === 'consume' && (
          <KafkaConsumeStudio
            studio={studio}
            clusterId={clusterId}
            consumeTemplates={templates.consumeTemplates}
            templatesLoading={templates.templatesLoading}
            onSaveConsumeTemplate={handleSaveConsumeTemplate}
            onLoadConsumeTemplate={handleLoadConsumeTemplate}
            onDeleteConsumeTemplate={templates.deleteConsumeTemplate}
            streamMode={streamMode}
            onUseAsWorkflowInput={onUseAsWorkflowInput}
          />
        )}
      </div>
    </div>
  );
}
