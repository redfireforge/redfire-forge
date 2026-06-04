import { useCallback } from 'react';
import { useListCrud } from '../../shared/hooks/useListCrud';
import KafkaSchemaConfigSection from '../workflow/components/configs/KafkaSchemaConfigSection';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';

interface KafkaPublishStudioProps {
  studio: UseKafkaMessageStudioReturn;
  /** The currently active cluster ID, forwarded into produce request. */
  clusterId: string;
}

export function KafkaPublishStudio({ studio }: KafkaPublishStudioProps) {
  const { publishDraft, setPublishDraft, publishLoading, publishResult, publishError } = studio;

  const { update: updateHeader, remove: removeHeader, move: moveHeader } =
    useListCrud(publishDraft.headers, (items) => setPublishDraft({ headers: items }));

  const addHeader = useCallback(() => {
    setPublishDraft({
      headers: [
        ...publishDraft.headers,
        { id: `h-${Date.now()}`, key: '', value: '', enabled: true },
      ],
    });
  }, [publishDraft.headers, setPublishDraft]);

  const canSend = publishDraft.topic.trim() !== '' && !publishLoading;

  const handleSend = useCallback(() => {
    void studio.sendOnce();
  }, [studio]);

  const handleFormatJson = useCallback(() => {
    studio.validateJsonBody();
  }, [studio]);

  return (
    <div className="kafka-ms-card">
      <div className="kafka-ms-card-header">
        <span className="kafka-ms-card-title">Publish</span>
        <span className="kafka-ms-card-subtitle">Send a message to a topic</span>
      </div>

      <div className="kafka-ms-body">
        {/* Topic + Acks */}
        <div className="kafka-ms-field-grid">
          <div className="kafka-ms-field">
            <label htmlFor="kms-pub-topic">Topic</label>
            <input
              id="kms-pub-topic"
              type="text"
              placeholder="e.g. orders.events"
              value={publishDraft.topic}
              onChange={(e) => setPublishDraft({ topic: e.target.value })}
            />
          </div>
          <div className="kafka-ms-field">
            <label htmlFor="kms-pub-acks">Acks</label>
            <select
              id="kms-pub-acks"
              value={String(publishDraft.acks)}
              onChange={(e) =>
                setPublishDraft({ acks: Number(e.target.value) as -1 | 0 | 1 })
              }
            >
              <option value="-1">all (–1)</option>
              <option value="1">leader (1)</option>
              <option value="0">none (0)</option>
            </select>
          </div>
        </div>

        {/* Key + Partition */}
        <div className="kafka-ms-field-grid">
          <div className="kafka-ms-field">
            <label htmlFor="kms-pub-key">Key</label>
            <input
              id="kms-pub-key"
              type="text"
              placeholder="(optional)"
              value={publishDraft.key}
              onChange={(e) => setPublishDraft({ key: e.target.value })}
            />
          </div>
          <div className="kafka-ms-field">
            <label htmlFor="kms-pub-partition">Partition</label>
            <input
              id="kms-pub-partition"
              type="text"
              placeholder="auto"
              value={publishDraft.partition}
              onChange={(e) => setPublishDraft({ partition: e.target.value })}
            />
          </div>
        </div>

        {/* Timeout */}
        <div className="kafka-ms-field">
          <label htmlFor="kms-pub-timeout">Timeout (ms)</label>
          <input
            id="kms-pub-timeout"
            type="text"
            placeholder="default"
            value={publishDraft.timeoutMs}
            onChange={(e) => setPublishDraft({ timeoutMs: e.target.value })}
          />
        </div>

        {/* Headers */}
        <div className="kafka-ms-section">
          <div className="kafka-ms-section-header">
            <span className="kafka-ms-section-title">Headers</span>
            <button
              className="kafka-ms-add-btn"
              onClick={addHeader}
              title="Add header"
            >
              + Add
            </button>
          </div>
          {publishDraft.headers.length === 0 ? (
            <p className="kafka-ms-empty-state">No headers</p>
          ) : (
            <div className="kafka-ms-kv-list">
              {publishDraft.headers.map((row, idx) => (
                <div key={row.id} className="kafka-ms-kv-row">
                  <input
                    type="checkbox"
                    aria-label="enabled"
                    checked={row.enabled}
                    onChange={(e) => updateHeader(idx, { ...row, enabled: e.target.checked })}
                  />
                  <input
                    type="text"
                    placeholder="key"
                    value={row.key}
                    onChange={(e) => updateHeader(idx, { ...row, key: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="value"
                    value={row.value}
                    onChange={(e) => updateHeader(idx, { ...row, value: e.target.value })}
                  />
                  <button
                    className="kafka-ms-remove-btn"
                    onClick={() => removeHeader(idx)}
                    aria-label="Remove header"
                  >
                    ×
                  </button>
                  {idx > 0 && (
                    <button
                      className="kafka-ms-move-btn"
                      onClick={() => moveHeader(idx, -1)}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="kafka-ms-field full">
          <label htmlFor="kms-pub-body">Message Body (JSON)</label>
          <textarea
            id="kms-pub-body"
            className="kafka-ms-textarea"
            placeholder='{"key": "value"}'
            value={publishDraft.body}
            onChange={(e) => setPublishDraft({ body: e.target.value })}
          />
        </div>

        {/* Schema Registry */}
        <KafkaSchemaConfigSection
          value={publishDraft.schemaConfig}
          onChange={(next) => setPublishDraft({ schemaConfig: next })}
          topic={publishDraft.topic}
        />

        {/* Action row */}
        <div className="kafka-ms-action-row">
          <button
            className="kafka-ms-primary-btn"
            disabled={!canSend}
            onClick={handleSend}
            data-testid="pub-send-btn"
          >
            {publishLoading ? 'Sending…' : 'Send Once'}
          </button>
          <button
            className="kafka-ms-secondary-btn"
            onClick={handleFormatJson}
            title="Validate and format JSON body"
          >
            Format JSON
          </button>
          {(publishResult || publishError) && (
            <button
              className="kafka-ms-ghost-btn"
              onClick={studio.clearPublishResult}
            >
              Clear
            </button>
          )}
        </div>

        {/* Error */}
        {publishError && (
          <div className="kafka-ms-inline-error" data-testid="pub-error">
            {publishError.message}
            {!publishError.retryable && (
              <span className="kafka-ms-error-tag"> (non-retryable)</span>
            )}
          </div>
        )}

        {/* Success result */}
        {publishResult && !publishError && (
          <div className="kafka-ms-result-success" data-testid="pub-result">
            <span className="kafka-ms-result-sent">
              ✓ Sent {publishResult.sentCount} message{publishResult.sentCount !== 1 ? 's' : ''} to{' '}
              <strong>{publishResult.topic}</strong>
            </span>
            {publishResult.records.map((r, i) => (
              <span key={i} className="kafka-ms-result-record">
                partition {r.partition}, offset {r.offset}
                {r.timestamp ? `, ts ${r.timestamp}` : ''}
              </span>
            ))}
            {publishResult.valueEncoding && (
              <span className="kafka-ms-result-encoding">
                Encoding: {publishResult.valueEncoding}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
