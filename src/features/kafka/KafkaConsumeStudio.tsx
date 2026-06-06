import { useCallback, useEffect, useRef, useState } from 'react';
import KafkaSchemaConfigSection from '../workflow/components/configs/KafkaSchemaConfigSection';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';
import type { UseKafkaStreamModeReturn } from '../../app/hooks/useKafkaStreamMode';
import { exportResultSet, valuePreview } from './kafkaMessageStudioUtils';
import type { KafkaConsumeResultRow } from './types';
import type { KafkaConsumeTemplate } from '../../shared/kafka/kafkaStorage';

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
  const canConsume = !topicEmpty && !consumeLoading;

  // ── Template dropdown state ──────────────────────────────────────────────
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const streamListRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [dropdownOpen]);

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

  const handleSaveSubmit = useCallback(async () => {
    const name = saveName.trim();
    if (!name) return;
    await onSaveConsumeTemplate(name);
    setSaveName('');
    setShowSaveInput(false);
  }, [saveName, onSaveConsumeTemplate]);

  const handleSaveKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') void handleSaveSubmit();
      if (e.key === 'Escape') { setSaveName(''); setShowSaveInput(false); }
    },
    [handleSaveSubmit],
  );

  const handleDeleteTemplate = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      void onDeleteConsumeTemplate(id);
    },
    [onDeleteConsumeTemplate],
  );

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

  const handleCopyKey = useCallback(() => {
    const msg = mode === 'stream' ? selectedStreamMessage : selectedMessage;
    if (msg?.key) void navigator.clipboard.writeText(msg.key);
  }, [mode, selectedMessage, selectedStreamMessage]);

  const handleCopyPayload = useCallback(() => {
    const msg = mode === 'stream' ? selectedStreamMessage : selectedMessage;
    if (msg) void navigator.clipboard.writeText(msg.value);
  }, [mode, selectedMessage, selectedStreamMessage]);

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

  const renderDetailPane = (msg: KafkaConsumeResultRow) => (
    <div className="kafka-ms-detail-pane" data-testid="con-detail-pane">
      <div className="kafka-ms-detail-actions">
        <button
          className="kafka-ms-ghost-btn"
          onClick={handleCopyKey}
          disabled={!msg.key}
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
        {onUseAsWorkflowInput && (
          <button
            className="kafka-ms-secondary-btn kafka-ms-workflow-btn"
            onClick={handleUseAsWorkflowInput}
            data-testid="con-workflow-input-btn"
          >
            Use as Workflow Input
          </button>
        )}
        <button
          className="kafka-ms-ghost-btn"
          onClick={() => mode === 'stream' ? streamMode.selectStreamMessage(null) : selectMessage(null)}
          aria-label="Close detail"
        >
          ✕
        </button>
      </div>
      <pre className="kafka-ms-detail-body" data-testid="con-detail-body">
        {(() => {
          try { return JSON.stringify(JSON.parse(msg.value), null, 2); }
          catch { return msg.value; }
        })()}
      </pre>
      {msg.headers &&
        Object.keys(msg.headers).length > 0 && (
          <table className="kafka-ms-detail-headers">
            <thead>
              <tr><th>Header Key</th><th>Header Value</th></tr>
            </thead>
            <tbody>
              {Object.entries(msg.headers).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );

  return (
    <div className="kafka-ms-card">
      <div className="kafka-ms-card-header">
        <div className="kafka-ms-card-header-left">
          <span className="kafka-ms-card-title">Consume</span>
          <span className="kafka-ms-card-subtitle">Fetch messages from a topic</span>
        </div>
        <div className="kafka-ms-template-controls">
          <div className="kafka-ms-template-dropdown-anchor" ref={dropdownRef}>
            <button
              className="kafka-ms-template-btn"
              onClick={() => setDropdownOpen((o) => !o)}
              disabled={templatesLoading}
              title="Load a saved template"
            >
              Load ▾
            </button>
            {dropdownOpen && (
              <div className="kafka-ms-template-dropdown">
                {consumeTemplates.length === 0 ? (
                  <div className="kafka-ms-template-empty">No saved templates</div>
                ) : (
                  consumeTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="kafka-ms-template-item"
                      onClick={() => { onLoadConsumeTemplate(t.id); setDropdownOpen(false); }}
                    >
                      <span className="kafka-ms-template-item-name">{t.name}</span>
                      <button
                        className="kafka-ms-template-item-delete"
                        onClick={(e) => handleDeleteTemplate(e, t.id)}
                        title="Delete template"
                      >×</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {showSaveInput ? (
            <div className="kafka-ms-template-save-row">
              <input
                className="kafka-ms-template-save-input"
                type="text"
                placeholder="Template name"
                value={saveName}
                autoFocus
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={handleSaveKeyDown}
              />
              <button
                className="kafka-ms-template-btn"
                onClick={() => void handleSaveSubmit()}
                disabled={!saveName.trim()}
              >✓</button>
              <button
                className="kafka-ms-template-btn kafka-ms-template-btn-cancel"
                onClick={() => { setSaveName(''); setShowSaveInput(false); }}
              >✕</button>
            </div>
          ) : (
            <button
              className="kafka-ms-template-btn"
              onClick={() => setShowSaveInput(true)}
              title="Save current settings as a template"
            >
              Save
            </button>
          )}
        </div>
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
              onBlur={() => setTouched((p) => ({ ...p, topic: true }))}
            />
            {touched.topic && topicEmpty && (
              <span className="kafka-ms-field-hint" data-testid="con-topic-hint">Topic is required</span>
            )}
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

        {/* Max Messages + Sort Order */}
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
          <div className="kafka-ms-field">
            <label htmlFor="kms-con-sort">Sort Order</label>
            <select
              id="kms-con-sort"
              value={consumeDraft.sortOrder ?? 'asc'}
              onChange={(e) =>
                setConsumeDraft({ sortOrder: e.target.value as 'asc' | 'desc' })
              }
              data-testid="con-sort-order"
            >
              <option value="asc">Oldest First</option>
              <option value="desc">Newest First</option>
            </select>
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

            {selectedMessage && renderDetailPane(selectedMessage)}
          </>
        )}

        {/* ═════════ STREAM mode ═════════ */}
        {mode === 'stream' && (
          <>
            <div className="kafka-ms-action-row" data-testid="stream-action-row">
              {!streamMode.isStreaming ? (
                <button
                  className="kafka-ms-primary-btn"
                  disabled={topicEmpty}
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
                          <td>{row.key ?? '—'}</td>
                          <td>{valuePreview(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {streamMode.selectedStreamMessage && renderDetailPane(streamMode.selectedStreamMessage)}
          </>
        )}
      </div>
    </div>
  );
}
