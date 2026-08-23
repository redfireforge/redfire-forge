/**
 * Phase 5 — Schema Registry Browser page.
 *
 * Two-column layout:
 *   Left:  Registry URL + auth → subject list with search filter
 *   Right: Subject detail with version dropdown, schema viewer, copy/export
 *
 * Does NOT require a Kafka broker connection — Schema Registry is an
 * independent HTTP service. Shows a URL prompt when no registry URL has been entered.
 */

import { useCallback, useRef } from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { UseKafkaStateReturn } from '@app/hooks/useKafkaState';

import {
  useSchemaRegistry,
  deriveSchemaFormat,
  type UseSchemaRegistryDeps,
} from './useSchemaRegistry';

interface KafkaSchemaRegistryPageProps {
  kafkaState: UseKafkaStateReturn;
  onNavigateToKafkaSettings: () => void;
  deps?: UseSchemaRegistryDeps;
}

export interface KafkaSchemaRegistryContentProps {
  kafkaState: UseKafkaStateReturn;
  deps?: UseSchemaRegistryDeps;
}

function formatBadgeLabel(fmt?: string): string {
  switch (fmt) {
    case 'avro': return 'Avro';
    case 'protobuf': return 'Protobuf';
    case 'json-schema': return 'JSON Schema';
    default: return '—';
  }
}

function prettyPrintSchema(raw: string, schemaType?: string): string {
  const fmt = deriveSchemaFormat(schemaType, raw);
  if (fmt === 'protobuf') return raw;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function KafkaSchemaRegistryContent({
  kafkaState,
  deps,
}: KafkaSchemaRegistryContentProps) {
  const reg = useSchemaRegistry(kafkaState, deps);
  const urlInputRef = useRef<HTMLInputElement>(null);
  void urlInputRef;

  const handleConnect = useCallback(() => {
    void reg.loadSubjects();
  }, [reg]);

  const handleCopySchema = useCallback(async () => {
    if (!reg.schemaDetail?.schema) return;
    try {
      await navigator.clipboard.writeText(reg.schemaDetail.schema);
    } catch {
      /* clipboard blocked in some environments */
    }
  }, [reg.schemaDetail]);

  const handleExportSchema = useCallback(() => {
    if (!reg.schemaDetail) return;
    const fmt = deriveSchemaFormat(reg.schemaDetail.schemaType, reg.schemaDetail.schema);
    const ext = fmt === 'protobuf' ? '.proto' : '.json';
    const filename = `${reg.schemaDetail.subject}-v${reg.schemaDetail.version}${ext}`;
    downloadFile(reg.schemaDetail.schema, filename);
  }, [reg.schemaDetail]);

  return (
    <div className="kafka-schema-layout" data-testid="schema-registry-page">
      {/* ── Left panel: Subject list ───────────────────────────────────── */}
      <div className="kafka-schema-list-card">
        <div className="kafka-explorer-list-header">
          <span className="kafka-ms-card-title">Schema Registry</span>
          {reg.subjects.length > 0 && (
            <span className="kafka-ms-card-subtitle">
              {reg.filteredSubjects.length} of {reg.subjects.length} subjects
            </span>
          )}
        </div>

        <div className="kafka-schema-registry-url">
          <div className="kafka-schema-url-row">
            <input
              ref={urlInputRef}
              type="text"
              className="kafka-schema-url-input"
              placeholder="http://localhost:8085"
              value={reg.registryConfig.registryUrl}
              onChange={(e) => reg.setRegistryConfig({ registryUrl: e.target.value })}
              data-testid="registry-url-input"
            />
            <button
              className="kafka-schema-connect-btn"
              onClick={handleConnect}
              disabled={!reg.registryConfig.registryUrl.trim() || reg.subjectsLoading}
              data-testid="registry-connect-btn"
            >
              {reg.subjectsLoading
                ? 'Loading…'
                : reg.hasLoadedOnce
                  ? 'Refresh Subjects'
                  : 'Connect to Registry'}
            </button>
          </div>
          <div className="kafka-schema-auth-row">
            <input
              type="text"
              className="kafka-schema-auth-input"
              placeholder="Username (optional)"
              value={reg.registryConfig.auth?.username ?? ''}
              onChange={(e) =>
                reg.setRegistryConfig({
                  auth: {
                    username: e.target.value,
                    password: reg.registryConfig.auth?.password ?? '',
                  },
                })
              }
              data-testid="registry-auth-user"
            />
            <input
              type="password"
              className="kafka-schema-auth-input"
              placeholder="Password (optional)"
              value={reg.registryConfig.auth?.password ?? ''}
              onChange={(e) =>
                reg.setRegistryConfig({
                  auth: {
                    username: reg.registryConfig.auth?.username ?? '',
                    password: e.target.value,
                  },
                })
              }
              data-testid="registry-auth-pass"
            />
          </div>
        </div>

        {reg.subjectsError && (
          <div className="kafka-schema-error-banner" data-testid="subjects-error">
            {reg.subjectsError.message}
          </div>
        )}

        {!reg.hasLoadedOnce && !reg.subjectsLoading && !reg.subjectsError && (
          <div className="kafka-schema-empty-prompt" data-testid="url-prompt">
            Enter a Schema Registry URL to begin browsing.
          </div>
        )}

        {reg.hasLoadedOnce && (
          <>
            <input
              type="text"
              className="kafka-explorer-search"
              placeholder="Filter subjects…"
              value={reg.filter}
              onChange={(e) => reg.setFilter(e.target.value)}
              data-testid="subject-filter"
            />
            <div className="kafka-explorer-table-wrap">
              <table className="kafka-schema-subject-table" data-testid="subject-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Format</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reg.filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="kafka-ms-empty-state">
                        {reg.subjects.length === 0
                          ? 'Connected, but no subjects are registered yet. Produce/register a schema, then refresh.'
                          : 'No subjects match the filter'}
                      </td>
                    </tr>
                  ) : (
                    reg.filteredSubjects.map((s) => (
                      <tr
                        key={s.name}
                        className={reg.selectedSubject === s.name ? 'selected' : ''}
                        onClick={() =>
                          reg.selectSubject(reg.selectedSubject === s.name ? null : s.name)
                        }
                        style={{ cursor: 'pointer' }}
                        data-testid={`subject-row-${s.name}`}
                      >
                        <td className="kafka-schema-subject-name">{s.name}</td>
                        <td>
                          <span
                            className={`kafka-schema-format-badge ${s.format ? `kafka-schema-format-${s.format}` : ''}`}
                          >
                            {formatBadgeLabel(s.format)}
                          </span>
                        </td>
                        <td className="kafka-schema-select-arrow">›</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Right panel: Subject detail ────────────────────────────────── */}
      {reg.selectedSubject && (
        <div className="kafka-schema-detail-card" data-testid="schema-detail-panel">
          <div className="kafka-schema-detail-header">
            <h3 className="kafka-schema-detail-title">{reg.selectedSubject}</h3>
            <div className="kafka-schema-detail-controls">
              {reg.versionsLoading ? (
                <span className="kafka-schema-loading-text">Loading versions…</span>
              ) : (
                <>
                  <CustomSelect
                    className="kafka-schema-version-select"
                    value={String(reg.selectedVersion ?? '')}
                    onChange={(v) => reg.selectVersion(Number(v))}
                    disabled={reg.versions.length === 0}
                    data-testid="version-select"
                    options={reg.versions.map((v, i) => ({
                      value: String(v),
                      label: `v${v}${i === reg.versions.length - 1 ? ' (latest)' : ''}`,
                    }))}
                    aria-label="Schema version"
                  />
                  {reg.schemaDetail && (
                    <span
                      className={`kafka-schema-format-badge kafka-schema-format-${deriveSchemaFormat(reg.schemaDetail.schemaType, reg.schemaDetail.schema) ?? 'unknown'}`}
                      data-testid="detail-format-badge"
                    >
                      {formatBadgeLabel(
                        deriveSchemaFormat(reg.schemaDetail.schemaType, reg.schemaDetail.schema),
                      )}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {reg.versionsError && (
            <div className="kafka-schema-error-banner" data-testid="versions-error">
              {reg.versionsError.message}
            </div>
          )}

          {reg.schemaError && (
            <div className="kafka-schema-error-banner" data-testid="schema-error">
              {reg.schemaError.message}
            </div>
          )}

          {reg.schemaLoading && (
            <div className="kafka-schema-skeleton" data-testid="schema-skeleton">
              <div className="kafka-schema-skeleton-line" style={{ width: '80%' }} />
              <div className="kafka-schema-skeleton-line" style={{ width: '60%' }} />
              <div className="kafka-schema-skeleton-line" style={{ width: '90%' }} />
              <div className="kafka-schema-skeleton-line" style={{ width: '70%' }} />
              <div className="kafka-schema-skeleton-line" style={{ width: '55%' }} />
            </div>
          )}

          {reg.schemaDetail && !reg.schemaLoading && (
            <>
              <pre
                className="kafka-schema-content"
                data-testid="schema-content"
              >
                {prettyPrintSchema(reg.schemaDetail.schema, reg.schemaDetail.schemaType)}
              </pre>
              <div className="kafka-schema-actions">
                <button
                  className="kafka-schema-action-btn"
                  onClick={handleCopySchema}
                  data-testid="copy-schema-btn"
                >
                  Copy Schema
                </button>
                <button
                  className="kafka-schema-action-btn"
                  onClick={handleExportSchema}
                  data-testid="export-schema-btn"
                >
                  Export
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function KafkaSchemaRegistryPage({
  kafkaState,
  onNavigateToKafkaSettings: _onNavigateToKafkaSettings,
  deps,
}: KafkaSchemaRegistryPageProps) {
  void _onNavigateToKafkaSettings;
  if (!kafkaState.loaded) {
    return <div className="kafka-message-studio-page"><p className="kafka-ms-loading">Loading Kafka settings…</p></div>;
  }

  // Schema Registry talks directly to the registry HTTP endpoint —
  // it does not require an active Kafka broker connection.
  return <KafkaSchemaRegistryContent kafkaState={kafkaState} deps={deps} />;
}
