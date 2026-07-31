import { useCallback, useEffect, useRef, useState } from 'react';
import { CustomSelect } from '../../shared/components/CustomSelect';
import KafkaSchemaConfigSection from '../workflow/components/configs/KafkaSchemaConfigSection';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';
import type { UseKafkaStreamModeReturn } from '../../app/hooks/useKafkaStreamMode';
import { exportResultSet, valuePreview } from './kafkaMessageStudioUtils';
import type { KafkaConsumeResultRow } from './types';
import type { KafkaConsumeTemplate } from '../../shared/kafka/kafkaStorage';
import { KafkaTemplateControls } from './KafkaTemplateControls';
import { parseKafkaTimestamp, formatRelativeAge, formatTimestampTooltip } from './kafkaTimestamp';
import KafkaMessageDetailModal from './KafkaMessageDetailModal';

type ConsumeMode = 'once' | 'stream';

interface KafkaConsumeStudioProps {
  studio: UseKafkaMessageStudioReturn;
  clusterId: string;
  consumeTemplates: KafkaConsumeTemplate[];
  templatesLoading: boolean;
  onSaveConsumeTemplate: (name: string) => Promise<void>;
  onLoadConsumeTemplate: (id: string) => void;
  onDeleteConsumeTemplate: (id: string) => Promise<void>;
  streamMode: UseKafkaStreamModeReturn;
  onUseAsWorkflowInput?: (payload: string, meta: { topic: string; partition: number; offset: string }) => void;
  /** When false, the Consume/Stream buttons are disabled and a connection notice is shown.
   *  Templates are always accessible regardless of connection state. */
  connected?: boolean;
}

export function KafkaConsumeStudio({
  studio,
  clusterId,
  consumeTemplates,
  templatesLoading,
  onSaveConsumeTemplate,
  onLoadConsumeTemplate,
  onDeleteConsumeTemplate,
  streamMode,
  onUseAsWorkflowInput,
  connected = true,
}: KafkaConsumeStudioProps) {
  const {
    consumeDraft, setConsumeDraft,
    consumeLoading, consumeResult, consumeTimedOut, consumeError,
    selectedMessageIndex, selectedMessage,
    selectMessage, consumeOnce, clearConsumeResult, consumeMessageCount,
    hasMore, loadMore, loadMoreLoading,
  } = studio;

  const [mode, setMode] = useState<ConsumeMode>('once');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const topicEmpty = consumeDraft.topic.trim() === '';
  const canConsume = !topicEmpty && !consumeLoading && connected;

  // E2E test bridge: __kafkaInjectConsumeResults(rows) injects mock rows directly
  // into the consume results without needing a real Kafka cluster.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__kafkaInjectConsumeResults = (rows: KafkaConsumeResultRow[]) => {
      studio.consumeOnce(); // ignored — we override via the studio mock approach
      // Use setConsumeResult if exposed, otherwise dispatch via consumeOnce mock
      const studioAny = studio as unknown as Record<string, unknown>;
      if (typeof studioAny.__setConsumeResult === 'function') {
        (studioAny.__setConsumeResult as (r: typeof rows) => void)(rows);
      }
    };
    return () => { delete w.__kafkaInjectConsumeResults; };
  }, [studio]);

  // Tick every 30 s so relative timestamps ("2m ago") stay up to date
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const streamListRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Auto-scroll stream list to bottom when new messages arrive
  useEffect(() => {
    const el = streamListRef.current;
    if (!el || userScrolledRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [streamMode.streamMessages.length]);

  const handleStreamScroll = useCallback(() => {
    const el = streamListRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledRef.current = !atBottom;
  }, []);

  // Reset auto-scroll when stream starts
  useEffect(() => {
    if (streamMode.isStreaming) {
      userScrolledRef.current = false;
    }
  }, [streamMode.isStreaming]);

  const handleConsume = useCallback(() => {
    void consumeOnce();
  }, [consumeOnce]);

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  const handleExport = useCallback(() => {
    if (consumeResult) {
      void exportResultSet(consumeResult, consumeDraft.topic);
    }
  }, [consumeResult, consumeDraft.topic]);

  const streamMessagesRef = useRef(streamMode.streamMessages);
  streamMessagesRef.current = streamMode.streamMessages;

  const { startStream, stopStream, selectedStreamMessage } = streamMode;

  const handleExportStream = useCallback(() => {
    if (streamMessagesRef.current.length > 0) {
      void exportResultSet(streamMessagesRef.current, consumeDraft.topic);
    }
  }, [consumeDraft.topic]);


  const handleStartStream = useCallback(() => {
    void startStream(consumeDraft, clusterId);
  }, [startStream, consumeDraft, clusterId]);

  const handleStopStream = useCallback(() => {
    void stopStream();
  }, [stopStream]);

  const handleUseAsWorkflowInput = useCallback(() => {
    const msg = mode === 'stream' ? selectedStreamMessage : selectedMessage;
    if (!msg || !onUseAsWorkflowInput) return;
    onUseAsWorkflowInput(msg.value, {
      topic: msg.topic,
      partition: msg.partition,
      offset: msg.offset,
    });
  }, [mode, selectedMessage, selectedStreamMessage, onUseAsWorkflowInput]);

  /** Renders a compact relative-age cell with a full datetime tooltip. */
  const renderTimestampCell = (ts: string | undefined) => {
    const date = parseKafkaTimestamp(ts);
    if (!date) return <td className="kafka-ts-cell kafka-ts-missing" data-testid="ts-cell-missing">—</td>;
    return (
      <td
        className="kafka-ts-cell"
        title={formatTimestampTooltip(date)}
        data-testid="ts-cell"
      >
        {formatRelativeAge(date)}
      </td>
    );
  };

  const activeDetailMessage = mode === 'stream' ? selectedStreamMessage : selectedMessage;
  const handleCloseDetail = useCallback(() => {
    if (mode === 'stream') streamMode.selectStreamMessage(null);
    else selectMessage(null);
  }, [mode, selectMessage, streamMode]);

  return (
    <div className="kafka-ms-card">
      <div className="kafka-ms-card-header">
        <div className="kafka-ms-card-header-left">
          <span className="kafka-ms-card-title">Consume</span>
          <span className="kafka-ms-card-subtitle">Fetch messages from a topic</span>
        </div>
        <KafkaTemplateControls
          templates={consumeTemplates}
          templatesLoading={templatesLoading}
          onLoad={onLoadConsumeTemplate}
          onSave={onSaveConsumeTemplate}
          onDelete={onDeleteConsumeTemplate}
          testIdPrefix="con"
        />
      </div>

      <div className="kafka-ms-body">
        {/* ── Main settings form ── */}
        <div className="kafka-ms-form">

          {/* Topic */}
          <div className="kafka-ms-form-row">
            <label className="kafka-ms-form-label" htmlFor="kms-con-topic">
              Topic<span className="kafka-ms-required-dot" aria-hidden="true">*</span>
            </label>
            <div className="kafka-ms-form-ctrl">
              <input
                id="kms-con-topic"
                data-testid="con-topic-input"
                className="kafka-ms-form-input"
                type="text"
                placeholder="e.g. orders.events"
                value={consumeDraft.topic}
                onChange={(e) => setConsumeDraft({ topic: e.target.value })}
                onBlur={() => setTouched((p) => ({ ...p, topic: true }))}
              />
              {touched.topic && topicEmpty && (
                <span className="kafka-ms-field-hint" data-testid="con-topic-hint">Topic is required</span>
              )}
            </div>
          </div>

          {/* Consumer Group */}
          <div className="kafka-ms-form-row kafka-ms-form-row--tall">
            <label className="kafka-ms-form-label" htmlFor="kms-con-group">Consumer Group</label>
            <div className="kafka-ms-form-ctrl">
              <input
                id="kms-con-group"
                className="kafka-ms-form-input"
                type="text"
                placeholder="auto-generated"
                value={consumeDraft.groupId}
                onChange={(e) => setConsumeDraft({ groupId: e.target.value })}
              />
              <span className="kafka-ms-form-hint-sub">Leave blank to auto-generate a unique group ID</span>
            </div>
          </div>

          {/* Start Position */}
          <div className="kafka-ms-form-row">
            <label className="kafka-ms-form-label" htmlFor="kms-con-pos">Start Position</label>
            <div className="kafka-ms-form-ctrl">
              <CustomSelect
                className="kafka-ms-form-select kafka-ms-form-select--acks"
                data-testid="con-position-select"
                value={consumeDraft.startPosition}
                onChange={(v) => setConsumeDraft({ startPosition: v as 'latest' | 'earliest' })}
                options={[
                  { value: 'latest', label: 'Latest', detail: 'Start from newest messages' },
                  { value: 'earliest', label: 'Earliest', detail: 'Replay from beginning' },
                ]}
                aria-label="Start Position"
              />
            </div>
          </div>

          {/* Max Messages */}
          <div className="kafka-ms-form-row">
            <label className="kafka-ms-form-label" htmlFor="kms-con-max">Max Messages</label>
            <div className="kafka-ms-form-ctrl kafka-ms-form-ctrl--inline">
              <input
                id="kms-con-max"
                className="kafka-ms-form-input kafka-ms-form-input--short"
                type="text"
                value={consumeDraft.maxMessages}
                onChange={(e) => setConsumeDraft({ maxMessages: e.target.value })}
              />
            </div>
          </div>

          {/* Timeout */}
          <div className="kafka-ms-form-row">
            <label className="kafka-ms-form-label" htmlFor="kms-con-timeout">Timeout (ms)</label>
            <div className="kafka-ms-form-ctrl kafka-ms-form-ctrl--inline">
              <input
                id="kms-con-timeout"
                className="kafka-ms-form-input kafka-ms-form-input--short"
                type="text"
                value={consumeDraft.timeoutMs}
                onChange={(e) => setConsumeDraft({ timeoutMs: e.target.value })}
              />
            </div>
          </div>

          {/* Sort Order */}
          <div className="kafka-ms-form-row">
            <label className="kafka-ms-form-label" htmlFor="kms-con-sort">Sort Order</label>
            <div className="kafka-ms-form-ctrl">
              <CustomSelect
                className="kafka-ms-form-select kafka-ms-form-select--acks"
                value={consumeDraft.sortOrder ?? 'asc'}
                onChange={(v) => setConsumeDraft({ sortOrder: v as 'asc' | 'desc' })}
                data-testid="con-sort-order"
                options={[
                  { value: 'asc', label: 'Oldest First', detail: 'Ascending chronological order' },
                  { value: 'desc', label: 'Newest First', detail: 'Descending chronological order' },
                ]}
                aria-label="Sort Order"
              />
            </div>
          </div>

        </div>

        {/* ── Filters ── */}
        <div className="kafka-ms-con-filters">
          <div className="kafka-ms-section-header kafka-ms-con-filters-header">
            <span className="kafka-ms-section-title">Filters</span>
            <span className="kafka-ms-form-hint">All filters are optional — leave blank to receive all messages</span>
          </div>
          <div className="kafka-ms-form">

            <div className="kafka-ms-form-row">
              <label className="kafka-ms-form-label" htmlFor="kms-con-key">Key Equals</label>
              <div className="kafka-ms-form-ctrl">
                <input
                  id="kms-con-key"
                  className="kafka-ms-form-input"
                  type="text"
                  placeholder="exact key match"
                  value={consumeDraft.keyEquals}
                  onChange={(e) => setConsumeDraft({ keyEquals: e.target.value })}
                />
              </div>
            </div>

            <div className="kafka-ms-form-row">
              <label className="kafka-ms-form-label" htmlFor="kms-con-header">Header Match</label>
              <div className="kafka-ms-form-ctrl">
                <input
                  id="kms-con-header"
                  className="kafka-ms-form-input"
                  type="text"
                  placeholder="key=value"
                  value={consumeDraft.headerMatch}
                  onChange={(e) => setConsumeDraft({ headerMatch: e.target.value })}
                />
              </div>
            </div>

            <div className="kafka-ms-form-row kafka-ms-form-row--tall">
              <label className="kafka-ms-form-label" htmlFor="kms-con-jsonpath">JSONPath Filter</label>
              <div className="kafka-ms-form-ctrl">
                <div className="kafka-ms-jsonpath-pair" data-testid="con-jsonpath-pair">
                  <input
                    id="kms-con-jsonpath"
                    className="kafka-ms-form-input kafka-ms-form-input--mono"
                    type="text"
                    placeholder="$.status"
                    value={consumeDraft.jsonPath}
                    onChange={(e) => setConsumeDraft({ jsonPath: e.target.value })}
                    data-testid="con-jsonpath-input"
                    aria-label="JSONPath expression"
                  />
                  <span className="kafka-ms-jsonpath-eq" aria-hidden="true">=</span>
                  <input
                    id="kms-con-jsonval"
                    className="kafka-ms-form-input kafka-ms-form-input--mono"
                    type="text"
                    placeholder="CREATED"
                    value={consumeDraft.jsonPathEquals}
                    onChange={(e) => setConsumeDraft({ jsonPathEquals: e.target.value })}
                    data-testid="con-jsonval-input"
                    aria-label="JSONPath expected value"
                  />
                </div>
                <span className="kafka-ms-form-hint-sub">Both fields must be filled — path and value are matched together</span>
              </div>
            </div>

            <div className="kafka-ms-form-row">
              <label className="kafka-ms-form-label" htmlFor="kms-con-body">Body Contains</label>
              <div className="kafka-ms-form-ctrl">
                <input
                  id="kms-con-body"
                  className="kafka-ms-form-input"
                  type="text"
                  placeholder="search text in body"
                  value={consumeDraft.bodyContains}
                  onChange={(e) => setConsumeDraft({ bodyContains: e.target.value })}
                  data-testid="con-body-contains-input"
                  aria-label="Body contains"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Schema Registry */}
        <KafkaSchemaConfigSection
          value={consumeDraft.schemaConfig}
          onChange={(next) => setConsumeDraft({ schemaConfig: next })}
          topic={consumeDraft.topic}
        />

        {/* ── Mode tab strip ── */}
        <div className="kafka-ms-mode-tabs" data-testid="con-mode-tabs">
          <button
            type="button"
            className={`kafka-ms-mode-tab ${mode === 'once' ? 'active' : ''}`}
            onClick={() => setMode('once')}
            data-testid="con-mode-once"
          >
            Consume Once
          </button>
          <button
            type="button"
            className={`kafka-ms-mode-tab ${mode === 'stream' ? 'active' : ''}`}
            onClick={() => setMode('stream')}
            data-testid="con-mode-stream"
          >
            Stream
          </button>
        </div>

        {/* ═════════ CONSUME ONCE mode ═════════ */}
        {mode === 'once' && (
          <>
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

            {consumeError && (
              <div className="kafka-ms-inline-error" data-testid="con-error">
                {consumeError.message}
                {!consumeError.retryable && (
                  <span className="kafka-ms-error-tag"> (non-retryable)</span>
                )}
              </div>
            )}

            {consumeResult !== null && !consumeError && (
              <div className="kafka-ms-results-zone" data-testid="con-results-zone">
                <div className="kafka-ms-results-header">
                  <span className="kafka-ms-results-count">
                    {consumeMessageCount} message{consumeMessageCount !== 1 ? 's' : ''}
                    {consumeMessageCount > 0 &&
                      consumeMessageCount === parseInt(consumeDraft.maxMessages, 10) && (
                      <span className="kafka-ms-max-reached" data-testid="con-max-reached"> (max reached)</span>
                    )}
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
                          <th className="kafka-ts-th">Timestamp</th>
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
                            {renderTimestampCell(row.timestamp)}
                            <td>{row.key ?? '—'}</td>
                            <td>{valuePreview(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {hasMore && (
                      <div className="kafka-ms-load-more-row" data-testid="con-load-more-row">
                        <button
                          className="kafka-ms-secondary-btn"
                          onClick={handleLoadMore}
                          disabled={loadMoreLoading}
                          data-testid="con-load-more-btn"
                        >
                          {loadMoreLoading ? 'Loading…' : 'Load More'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </>
        )}

        {/* ═════════ STREAM mode ═════════ */}
        {mode === 'stream' && (
          <>
            <div className="kafka-ms-action-row" data-testid="stream-action-row">
              {!streamMode.isStreaming ? (
                <button
                  className="kafka-ms-primary-btn"
                  disabled={topicEmpty || !connected}
                  onClick={handleStartStream}
                  data-testid="stream-start-btn"
                >
                  Start Stream
                </button>
              ) : (
                <button
                  className="kafka-ms-danger-btn"
                  onClick={handleStopStream}
                  data-testid="stream-stop-btn"
                >
                  Stop Stream
                </button>
              )}
              {streamMode.streamMessages.length > 0 && (
                <>
                  <button
                    className="kafka-ms-secondary-btn"
                    onClick={handleExportStream}
                    data-testid="stream-export-btn"
                  >
                    Export Stream
                  </button>
                  <button
                    className="kafka-ms-ghost-btn"
                    onClick={streamMode.clearStreamMessages}
                    data-testid="stream-clear-btn"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {streamMode.streamError && (
              <div className="kafka-ms-inline-error" data-testid="stream-error">
                {streamMode.streamError.message}
                {!streamMode.streamError.retryable && (
                  <span className="kafka-ms-error-tag"> (non-retryable)</span>
                )}
              </div>
            )}

            <div className="kafka-ms-results-zone" data-testid="stream-results-zone">
              <div className="kafka-ms-results-header">
                <span className="kafka-ms-results-count" data-testid="stream-count">
                  {streamMode.streamMessages.length} message{streamMode.streamMessages.length !== 1 ? 's' : ''}
                </span>
                {streamMode.isStreaming && (
                  <span className="kafka-ms-streaming-badge" data-testid="stream-live-badge">
                    LIVE
                  </span>
                )}
                {streamMode.cursorGap && (
                  <span className="kafka-ms-cursor-gap-badge" data-testid="stream-cursor-gap">
                    Buffer wrapped — some messages were not captured
                  </span>
                )}
              </div>
              {streamMode.streamMessages.length === 0 ? (
                <p className="kafka-ms-empty-state">
                  {streamMode.isStreaming ? 'Waiting for messages…' : 'No stream messages'}
                </p>
              ) : (
                <div
                  className="kafka-ms-results-table-wrap kafka-ms-stream-table-wrap"
                  ref={streamListRef}
                  onScroll={handleStreamScroll}
                >
                  <table className="kafka-ms-results-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Offset</th>
                        <th>Partition</th>
                        <th className="kafka-ts-th">Timestamp</th>
                        <th>Key</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streamMode.streamMessages.map((row, idx) => (
                        <tr
                          key={`s-${row.partition}-${row.offset}-${idx}`}
                          className={`${streamMode.selectedStreamIndex === idx ? 'selected' : ''} kafka-ms-stream-row`}
                          onClick={() => streamMode.selectStreamMessage(streamMode.selectedStreamIndex === idx ? null : idx)}
                          style={{ cursor: 'pointer' }}
                          data-testid={`stream-row-${idx}`}
                        >
                          <td>{idx + 1}</td>
                          <td>{row.offset}</td>
                          <td>{row.partition}</td>
                          {renderTimestampCell(row.timestamp)}
                          <td>{row.key ?? '—'}</td>
                          <td>{valuePreview(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </>
        )}

        {/* ── Message Detail Modal (shared for both modes) ── */}
        {activeDetailMessage && (
          <KafkaMessageDetailModal
            message={activeDetailMessage}
            onClose={handleCloseDetail}
            onUseAsWorkflowInput={onUseAsWorkflowInput ? handleUseAsWorkflowInput : undefined}
          />
        )}
      </div>
    </div>
  );
}
