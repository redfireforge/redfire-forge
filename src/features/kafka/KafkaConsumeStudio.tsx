import { useCallback } from 'react';
import KafkaSchemaConfigSection from '../workflow/components/configs/KafkaSchemaConfigSection';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';
import { exportResultSet, valuePreview } from './kafkaMessageStudioUtils';

interface KafkaConsumeStudioProps {
  studio: UseKafkaMessageStudioReturn;
  /** The currently active cluster ID, forwarded into consume request. */
  clusterId: string;
}

export function KafkaConsumeStudio({ studio }: KafkaConsumeStudioProps) {
  const {
    consumeDraft, setConsumeDraft,
    consumeLoading, consumeResult, consumeTimedOut, consumeError,
    selectedMessageIndex, selectedMessage,
    selectMessage, consumeOnce, clearConsumeResult, consumeMessageCount,
  } = studio;

  const canConsume = consumeDraft.topic.trim() !== '' && !consumeLoading;

  const handleConsume = useCallback(() => {
    void consumeOnce();
  }, [consumeOnce]);

  const handleExport = useCallback(() => {
    if (consumeResult) {
      void exportResultSet(consumeResult, consumeDraft.topic);
    }
  }, [consumeResult, consumeDraft.topic]);

  const handleCopyKey = useCallback(() => {
    if (selectedMessage?.key) void navigator.clipboard.writeText(selectedMessage.key);
  }, [selectedMessage]);

  const handleCopyPayload = useCallback(() => {
    if (selectedMessage) void navigator.clipboard.writeText(selectedMessage.value);
  }, [selectedMessage]);

  return (
    <div className="kafka-ms-card">
      <div className="kafka-ms-card-header">
        <span className="kafka-ms-card-title">Consume</span>
        <span className="kafka-ms-card-subtitle">Fetch messages from a topic</span>
      </div>

      <div className="kafka-ms-body">
        {/* Topic + Consumer Group */}
        <div className="kafka-ms-field-grid">
          <div className="kafka-ms-field">
            <label htmlFor="kms-con-topic">Topic</label>
            <input
              id="kms-con-topic"
              type="text"
              placeholder="e.g. orders.events"
              value={consumeDraft.topic}
              onChange={(e) => setConsumeDraft({ topic: e.target.value })}
            />
          </div>
          <div className="kafka-ms-field">
            <label htmlFor="kms-con-group">Consumer Group</label>
            <input
              id="kms-con-group"
              type="text"
              value={consumeDraft.groupId}
              onChange={(e) => setConsumeDraft({ groupId: e.target.value })}
            />
          </div>
        </div>

        {/* Start Position + Timeout */}
        <div className="kafka-ms-field-grid">
          <div className="kafka-ms-field">
            <label htmlFor="kms-con-pos">Start Position</label>
            <select
              id="kms-con-pos"
              value={consumeDraft.startPosition}
              onChange={(e) =>
                setConsumeDraft({ startPosition: e.target.value as 'latest' | 'earliest' })
              }
            >
              <option value="latest">Latest</option>
              <option value="earliest">Earliest</option>
            </select>
          </div>
          <div className="kafka-ms-field">
            <label htmlFor="kms-con-timeout">Timeout (ms)</label>
            <input
              id="kms-con-timeout"
              type="text"
              value={consumeDraft.timeoutMs}
              onChange={(e) => setConsumeDraft({ timeoutMs: e.target.value })}
            />
          </div>
        </div>

        {/* Max Messages */}
        <div className="kafka-ms-field-grid">
          <div className="kafka-ms-field">
            <label htmlFor="kms-con-max">Max Messages</label>
            <input
              id="kms-con-max"
              type="text"
              value={consumeDraft.maxMessages}
              onChange={(e) => setConsumeDraft({ maxMessages: e.target.value })}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="kafka-ms-section">
          <div className="kafka-ms-section-header">
            <span className="kafka-ms-section-title">Filters</span>
          </div>
          <div className="kafka-ms-field-grid">
            <div className="kafka-ms-field">
              <label htmlFor="kms-con-key">Key Equals</label>
              <input
                id="kms-con-key"
                type="text"
                placeholder="exact key match"
                value={consumeDraft.keyEquals}
                onChange={(e) => setConsumeDraft({ keyEquals: e.target.value })}
              />
            </div>
            <div className="kafka-ms-field">
              <label htmlFor="kms-con-header">Header Match</label>
              <input
                id="kms-con-header"
                type="text"
                placeholder="key=value"
                value={consumeDraft.headerMatch}
                onChange={(e) => setConsumeDraft({ headerMatch: e.target.value })}
              />
            </div>
          </div>
          <div className="kafka-ms-field-grid">
            <div className="kafka-ms-field">
              <label htmlFor="kms-con-jsonpath">JSONPath</label>
              <input
                id="kms-con-jsonpath"
                type="text"
                placeholder="$.status"
                value={consumeDraft.jsonPath}
                onChange={(e) => setConsumeDraft({ jsonPath: e.target.value })}
              />
            </div>
            <div className="kafka-ms-field">
              <label htmlFor="kms-con-jsonval">JSONPath Equals</label>
              <input
                id="kms-con-jsonval"
                type="text"
                placeholder="CREATED"
                value={consumeDraft.jsonPathEquals}
                onChange={(e) => setConsumeDraft({ jsonPathEquals: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Schema Registry */}
        <KafkaSchemaConfigSection
          value={consumeDraft.schemaConfig}
          onChange={(next) => setConsumeDraft({ schemaConfig: next })}
          topic={consumeDraft.topic}
        />

        {/* Action row */}
        <div className="kafka-ms-action-row">
          <button
            className="kafka-ms-primary-btn"
            disabled={!canConsume}
            onClick={handleConsume}
            data-testid="con-consume-btn"
          >
            {consumeLoading ? 'Consuming…' : 'Consume Once'}
          </button>
          {consumeResult !== null && (
            <>
              <button
                className="kafka-ms-secondary-btn"
                onClick={handleExport}
                disabled={consumeResult.length === 0}
                data-testid="con-export-btn"
              >
                Export Result Set
              </button>
              <button
                className="kafka-ms-ghost-btn"
                onClick={clearConsumeResult}
                data-testid="con-clear-btn"
              >
                Clear
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {consumeError && (
          <div className="kafka-ms-inline-error" data-testid="con-error">
            {consumeError.message}
          </div>
        )}

        {/* Zone A — Results table */}
        {consumeResult !== null && !consumeError && (
          <div className="kafka-ms-results-zone" data-testid="con-results-zone">
            <div className="kafka-ms-results-header">
              <span className="kafka-ms-results-count">
                {consumeMessageCount} message{consumeMessageCount !== 1 ? 's' : ''}
              </span>
              {consumeTimedOut && (
                <span className="kafka-ms-timed-out-badge" data-testid="con-timed-out">
                  timed out
                </span>
              )}
            </div>
            {consumeMessageCount === 0 ? (
              <p className="kafka-ms-empty-state">No messages received</p>
            ) : (
              <div className="kafka-ms-results-table-wrap">
                <table className="kafka-ms-results-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Offset</th>
                      <th>Partition</th>
                      <th>Key</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumeResult.map((row, idx) => (
                      <tr
                        key={`${row.partition}-${row.offset}`}
                        className={selectedMessageIndex === idx ? 'selected' : ''}
                        onClick={() => selectMessage(selectedMessageIndex === idx ? null : idx)}
                        style={{ cursor: 'pointer' }}
                        data-testid={`con-row-${idx}`}
                      >
                        <td>{idx + 1}</td>
                        <td>{row.offset}</td>
                        <td>{row.partition}</td>
                        <td>{row.key ?? '—'}</td>
                        <td>{valuePreview(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Zone B — Detail pane */}
        {selectedMessage && (
          <div className="kafka-ms-detail-pane" data-testid="con-detail-pane">
            <div className="kafka-ms-detail-actions">
              <button
                className="kafka-ms-ghost-btn"
                onClick={handleCopyKey}
                disabled={!selectedMessage.key}
                data-testid="con-copy-key-btn"
              >
                Copy Key
              </button>
              <button
                className="kafka-ms-ghost-btn"
                onClick={handleCopyPayload}
                data-testid="con-copy-payload-btn"
              >
                Copy Payload
              </button>
              <button
                className="kafka-ms-ghost-btn"
                onClick={() => selectMessage(null)}
                aria-label="Close detail"
              >
                ✕
              </button>
            </div>
            <pre className="kafka-ms-detail-body" data-testid="con-detail-body">
              {(() => {
                try { return JSON.stringify(JSON.parse(selectedMessage.value), null, 2); }
                catch { return selectedMessage.value; }
              })()}
            </pre>
            {selectedMessage.headers &&
              Object.keys(selectedMessage.headers).length > 0 && (
                <table className="kafka-ms-detail-headers">
                  <thead>
                    <tr><th>Header Key</th><th>Header Value</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedMessage.headers).map(([k, v]) => (
                      <tr key={k}><td>{k}</td><td>{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
