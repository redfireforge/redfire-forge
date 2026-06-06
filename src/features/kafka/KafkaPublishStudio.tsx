import { useCallback, useEffect, useRef, useState } from 'react';
import { useListCrud } from '../../shared/hooks/useListCrud';
import KafkaSchemaConfigSection from '../workflow/components/configs/KafkaSchemaConfigSection';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';
import type { KafkaPublishTemplate } from '../../shared/kafka/kafkaStorage';

interface KafkaPublishStudioProps {
  studio: UseKafkaMessageStudioReturn;
  /** The currently active cluster ID, forwarded into produce request. */
  clusterId: string;
  // ── Template props (Phase 2) ──────────────────────────────────────────
  publishTemplates: KafkaPublishTemplate[];
  templatesLoading: boolean;
  onSaveTemplate: (name: string) => Promise<void>;
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => Promise<void>;
  // ── Workflow integration (Phase 3D) ────────────────────────────────────
  lastWorkflowOutput?: Record<string, string> | null;
}

export function KafkaPublishStudio({
  studio,
  publishTemplates,
  templatesLoading,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  lastWorkflowOutput,
}: KafkaPublishStudioProps) {
  const { publishDraft, setPublishDraft, publishLoading, publishResult, publishError } = studio;

  // ── Template dropdown state ──────────────────────────────────────────────
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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

  const handleSaveSubmit = useCallback(async () => {
    const name = saveName.trim();
    if (!name) return;
    await onSaveTemplate(name);
    setSaveName('');
    setShowSaveInput(false);
  }, [saveName, onSaveTemplate]);

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
      void onDeleteTemplate(id);
    },
    [onDeleteTemplate],
  );

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

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const topicEmpty = publishDraft.topic.trim() === '';
  const bodyEmpty = publishDraft.body.trim() === '';
  const canSend = !topicEmpty && !publishLoading;

  const handleSend = useCallback(() => {
    void studio.sendOnce();
  }, [studio]);

  const handleFormatJson = useCallback(() => {
    studio.validateJsonBody();
  }, [studio]);

  // ── Workflow variable dropdown (Phase 3D) ──────────────────────────────
  const [wfDropdownOpen, setWfDropdownOpen] = useState(false);
  const [wfSearch, setWfSearch] = useState('');
  const wfDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wfDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (wfDropdownRef.current && !wfDropdownRef.current.contains(e.target as Node)) {
        setWfDropdownOpen(false);
        setWfSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [wfDropdownOpen]);

  const workflowEntries = lastWorkflowOutput ? Object.entries(lastWorkflowOutput) : [];
  const filteredWfEntries = wfSearch
    ? workflowEntries.filter(([k]) => k.toLowerCase().includes(wfSearch.toLowerCase()))
    : workflowEntries;

  const handleSelectWfVariable = useCallback((value: string) => {
    let body: string;
    try {
      body = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      body = value;
    }
    setPublishDraft({ body });
    setWfDropdownOpen(false);
    setWfSearch('');
  }, [setPublishDraft]);

  return (
    <div className="kafka-ms-card">
      <div className="kafka-ms-card-header">
        <div className="kafka-ms-card-header-left">
          <span className="kafka-ms-card-title">Publish</span>
          <span className="kafka-ms-card-subtitle">Send a message to a topic</span>
        </div>
        <div className="kafka-ms-template-controls">
          {/* Load dropdown */}
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
                {publishTemplates.length === 0 ? (
                  <div className="kafka-ms-template-empty">No saved templates</div>
                ) : (
                  publishTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="kafka-ms-template-item"
                      onClick={() => { onLoadTemplate(t.id); setDropdownOpen(false); }}
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
          {/* Save / inline input */}
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
              onBlur={() => setTouched((p) => ({ ...p, topic: true }))}
            />
            {touched.topic && topicEmpty && (
              <span className="kafka-ms-field-hint" data-testid="pub-topic-hint">Topic is required</span>
            )}
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
                  <span className="kafka-ms-kv-actions">
                    {idx > 0 && (
                      <button
                        className="kafka-ms-move-btn"
                        onClick={() => moveHeader(idx, -1)}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                    )}
                    <button
                      className="kafka-ms-remove-btn"
                      onClick={() => removeHeader(idx)}
                      aria-label="Remove header"
                    >
                      ×
                    </button>
                  </span>
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
            onBlur={() => setTouched((p) => ({ ...p, body: true }))}
          />
          {touched.body && bodyEmpty && (
            <span className="kafka-ms-field-hint" data-testid="pub-body-hint">Message body is required</span>
          )}
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
            Validate &amp; Format JSON
          </button>
          <div className="kafka-ms-wf-dropdown-anchor" ref={wfDropdownRef}>
            <button
              className="kafka-ms-secondary-btn"
              onClick={() => setWfDropdownOpen((o) => !o)}
              disabled={!lastWorkflowOutput || workflowEntries.length === 0}
              title={workflowEntries.length === 0 ? 'Run a workflow first' : 'Map a workflow output variable into the message body'}
              data-testid="pub-map-workflow-btn"
            >
              Map from Workflow ▾
            </button>
            {wfDropdownOpen && workflowEntries.length > 0 && (
              <div className="kafka-ms-wf-dropdown" data-testid="pub-wf-dropdown">
                <input
                  className="kafka-ms-wf-search"
                  type="text"
                  placeholder="Search variables…"
                  value={wfSearch}
                  onChange={(e) => setWfSearch(e.target.value)}
                  autoFocus
                  data-testid="pub-wf-search"
                />
                <div className="kafka-ms-wf-list">
                  {filteredWfEntries.length === 0 ? (
                    <div className="kafka-ms-wf-empty">No matching variables</div>
                  ) : (
                    filteredWfEntries.map(([key, val]) => (
                      <div
                        key={key}
                        className="kafka-ms-wf-item"
                        onClick={() => handleSelectWfVariable(val)}
                        data-testid={`pub-wf-var-${key}`}
                      >
                        <span className="kafka-ms-wf-item-name">{key}</span>
                        <span className="kafka-ms-wf-item-preview">{val.length > 60 ? val.slice(0, 60) + '…' : val}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
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
