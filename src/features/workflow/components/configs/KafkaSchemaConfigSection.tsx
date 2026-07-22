/**
 * Phase 10C — Shared schema registry configuration section.
 *
 * Renders a collapsible section at the bottom of KafkaProduceConfig and
 * KafkaConsumeConfig that lets users opt-in to Avro/Protobuf/JSON-Schema
 * encoding/decoding via a Confluent-compatible schema registry.
 *
 * Design decisions:
 *   - Off by default (hidden unless the user explicitly enables it).
 *   - Subject and version dropdowns are loaded lazily (only when the
 *     registry URL is provided and the user focuses the field).
 *   - Credentials travel in POST request body only (OWASP A02).
 *   - "No schema" means `schemaConfig: undefined` in the node data —
 *     this keeps backward compatibility with non-schema workflows.
 */

import { useState, useCallback } from 'react';
import type { KafkaSchemaConfig } from '../../../../shared/kafka/kafkaClient';
import { dispatchKafkaOperation } from '../../../../shared/kafka/kafkaClient';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

const FORMAT_OPTIONS: { value: KafkaSchemaConfig['format']; label: string }[] = [
  { value: 'avro', label: 'Avro' },
  { value: 'protobuf', label: 'Protobuf' },
  { value: 'json-schema', label: 'JSON Schema' },
];

interface KafkaSchemaConfigSectionProps {
  /** Current schema config; `undefined` means schema is disabled. */
  value: KafkaSchemaConfig | undefined;
  onChange: (next: KafkaSchemaConfig | undefined) => void;
  /** Topic name — used to derive the default subject (`{topic}-value`). */
  topic: string;
}

/**
 * Collapsible schema registry config section for Kafka produce/consume panels.
 * Renders an "Enable Schema Registry" toggle and the relevant fields when enabled.
 */
export default function KafkaSchemaConfigSection({
  value,
  onChange,
  topic,
}: KafkaSchemaConfigSectionProps) {
  const enabled = value != null;

  const [subjects, setSubjects] = useState<string[]>([]);
  const [versions, setVersions] = useState<number[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  // ── Enable / disable ────────────────────────────────────────────────────────

  function handleToggle(checked: boolean) {
    if (checked) {
      onChange({ registryUrl: '', format: 'avro' });
    } else {
      onChange(undefined);
      setSubjects([]);
      setVersions([]);
      setSubjectsError(null);
      setVersionsError(null);
    }
  }

  // ── Field helpers ───────────────────────────────────────────────────────────

  function patch(updates: Partial<KafkaSchemaConfig>) {
    if (!value) return;
    onChange({ ...value, ...updates });
  }

  function patchAuth(updates: Partial<{ username: string; password: string }>) {
    if (!value) return;
    const auth = { username: value.auth?.username ?? '', password: value.auth?.password ?? '', ...updates };
    // Clear auth entirely when both fields are empty
    onChange({ ...value, auth: auth.username || auth.password ? auth : undefined });
  }

  // ── Lazy subject loader ─────────────────────────────────────────────────────

  const loadSubjects = useCallback(async () => {
    if (!value?.registryUrl?.trim()) return;
    setLoadingSubjects(true);
    setSubjectsError(null);
    try {
      const envelope = await dispatchKafkaOperation<{ subjects: string[] }>('schema-subjects', {
        schemaConfig: value,
      });
      setSubjects(envelope.data?.subjects ?? []);
    } catch (err) {
      setSubjectsError(err instanceof Error ? err.message : 'Failed to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }, [value]);

  // ── Lazy version loader ─────────────────────────────────────────────────────

  const loadVersions = useCallback(async () => {
    if (!value?.registryUrl?.trim()) return;
    const subject = value.subject?.trim() || (topic ? `${topic}-value` : '');
    if (!subject) return;
    setLoadingVersions(true);
    setVersionsError(null);
    try {
      const envelope = await dispatchKafkaOperation<{ versions: number[] }>('schema-versions', {
        schemaConfig: value,
        subject,
      });
      setVersions(envelope.data?.versions ?? []);
    } catch (err) {
      setVersionsError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoadingVersions(false);
    }
  }, [value, topic]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="wf-kafka-section">
      <div className="wf-kafka-section-title">
        <label className="wf-config-checkbox-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          Enable Schema Registry
        </label>
      </div>

      {enabled && value && (
        <div className="wf-schema-config">
          <div className="wf-config-field--row">
            <label>Registry URL</label>
            <input
              value={value.registryUrl}
              onChange={(e) => patch({ registryUrl: e.target.value })}
              placeholder="http://schema-registry:8081"
            />
          </div>

          <div className="wf-config-field--row">
            <label>Format</label>
            <CustomSelect
              data-testid="schema-format-select"
              value={value.format}
              onChange={(v) => patch({ format: v as KafkaSchemaConfig['format'] })}
              options={FORMAT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          </div>

          <div className="wf-config-field-pair">
            <div className="wf-config-field--row">
              <label>Username</label>
              <input
                value={value.auth?.username ?? ''}
                onChange={(e) => patchAuth({ username: e.target.value })}
                placeholder="Optional"
                autoComplete="off"
                data-testid="schema-username"
              />
            </div>
            <div className="wf-config-field--row">
              <label>Password</label>
              <input
                type="password"
                value={value.auth?.password ?? ''}
                onChange={(e) => patchAuth({ password: e.target.value })}
                placeholder="Optional"
                autoComplete="new-password"
                data-testid="schema-password"
              />
            </div>
          </div>

          <div className="wf-config-field-pair">
            <div className="wf-config-field--row">
              <label>Subject</label>
              <div className="wf-config-field-with-insert" style={{ flex: 1, minWidth: 0 }}>
                <input
                  data-testid="schema-subject-input"
                  value={value.subject ?? ''}
                  onChange={(e) => patch({ subject: e.target.value || undefined })}
                  placeholder={topic ? `${topic}-value` : 'topic-value'}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => subjects.length > 0 ? setSubjects([]) : loadSubjects()}
                  disabled={loadingSubjects || !value.registryUrl?.trim()}
                  title={subjects.length > 0 ? 'Hide subject list' : 'Load subjects from registry'}
                >
                  {loadingSubjects ? '…' : '↓'}
                </button>
              </div>
            </div>
            <div className="wf-config-field--row">
              <label>Version</label>
              <div className="wf-config-field-with-insert" style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="number"
                  value={value.version ?? ''}
                  onChange={(e) => patch({ version: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="latest"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => versions.length > 0 ? setVersions([]) : loadVersions()}
                  disabled={loadingVersions || !value.registryUrl?.trim()}
                  title={versions.length > 0 ? 'Hide version list' : 'Load versions from registry'}
                >
                  {loadingVersions ? '…' : '↓'}
                </button>
              </div>
            </div>
          </div>
          {subjectsError && <span className="wf-config-error">{subjectsError}</span>}
          {subjects.length > 0 && (
            <CustomSelect
              data-testid="schema-subjects-dropdown"
              className="wf-schema-subjects-dropdown"
              value={value.subject ?? ''}
              onChange={(v) => {
                patch({ subject: v || undefined });
                setSubjects([]);
              }}
              placeholder={topic ? `(default — ${topic}-value)` : '(default — topic-value)'}
              options={[
                { value: '', label: topic ? `(default — ${topic}-value)` : '(default — topic-value)' },
                ...subjects.map((s) => ({ value: s, label: s })),
              ]}
            />
          )}
          {versionsError && <span className="wf-config-error">{versionsError}</span>}
          {versions.length > 0 && (
            <CustomSelect
              data-testid="schema-versions-dropdown"
              className="wf-schema-versions-dropdown"
              value={value.version != null ? String(value.version) : ''}
              onChange={(v) => {
                patch({ version: v === '' ? undefined : Number(v) });
                setVersions([]);
              }}
              placeholder="(latest)"
              options={[
                { value: '', label: '(latest)' },
                ...versions.map((v) => ({ value: String(v), label: String(v) })),
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}
