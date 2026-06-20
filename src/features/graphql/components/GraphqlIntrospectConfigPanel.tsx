/**
 * GraphqlIntrospectConfigPanel — workflow node config for `graphqlIntrospect`.
 * 3-tab layout: Endpoint | Schema Validation | Output
 *
 * Phase 4 — Step 3 (4C-4)
 */
import { useState } from 'react';
import type {
  GraphqlIntrospectNodeData,
  GraphqlIntrospectOutputBinding,
} from '../../workflow/types/workflow';
import type { WorkflowVariableHint } from '../../workflow/utils/workflowVariableHints';
import { useListCrud } from '../../../shared/hooks/useListCrud';
import InsertVarField from '../../workflow/components/expression/InsertVarField';
import ExpressionInput from '../../workflow/components/expression/ExpressionInput';
import {
  GqlHeadersSection,
  GqlAuthSection,
  GqlOutputSection,
  type GqlOutputBinding,
} from './GraphqlQueryConfigPanel';
import { computeIntrospectTabErrors } from '../utils/graphqlPanelHelpers';

// ── Output field options ──────────────────────────────────────────────────────

const OUTPUT_FIELD_OPTIONS: GraphqlIntrospectOutputBinding['field'][] = [
  'sdl', 'typeCount', 'fieldCount', 'schemaHash', 'queryTypeName',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHeaderId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type IntrospectTab = 'endpoint' | 'validation' | 'output';

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphqlIntrospectConfigPanel({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: GraphqlIntrospectNodeData;
  onChange: (d: GraphqlIntrospectNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const [activeTab, setActiveTab] = useState<IntrospectTab>('endpoint');
  const [requiredTypesInput, setRequiredTypesInput] = useState(
    (data.requiredTypes ?? []).join(', '),
  );
  const [newFieldType, setNewFieldType] = useState('');
  const [newFieldName, setNewFieldName] = useState('');

  const update = (patch: Partial<GraphqlIntrospectNodeData>) => onChange({ ...data, ...patch });

  const headers = data.headers ?? [];
  const outputBindings = data.outputBindings ?? [];
  const requiredFields = data.requiredFields ?? [];

  const headerCrud = useListCrud(headers, (items) => update({ headers: items }));
  const outputCrud = useListCrud(outputBindings, (items) => update({ outputBindings: items }));

  const tabErrors = computeIntrospectTabErrors({
    endpoint: data.endpoint,
    outputBindings,
  });

  const TABS: { id: IntrospectTab; label: string; errorDot?: boolean; count?: number }[] = [
    { id: 'endpoint', label: 'Endpoint', errorDot: tabErrors.endpoint },
    { id: 'validation', label: 'Schema Validation' },
    { id: 'output', label: 'Output', errorDot: tabErrors.output, count: outputBindings.filter((b) => b.enabled).length > 0 ? outputBindings.filter((b) => b.enabled).length : undefined },
  ];

  return (
    <div className="wf-config-body" data-testid="gql-wf-introspect-panel">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => update({ label: e.target.value })} />
      </div>

      <div className="wf-config-tabs">
        {TABS.map(({ id, label, errorDot, count }) => (
          <button
            key={id}
            className={`wf-config-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            {label}
            {errorDot && (
              <span
                className="tab-badge-dot"
                style={{ background: 'var(--color-danger, #e53)' }}
                title="Validation error"
                data-testid="gql-wf-tab-error-dot"
              />
            )}
            {!errorDot && count != null && <span className="tab-badge">{count}</span>}
          </button>
        ))}
      </div>

      <div className="wf-config-tab-content">
        {/* ── Endpoint tab ──────────────────────────────────── */}
        {activeTab === 'endpoint' && (
          <div>
            <div className="wf-config-field--row">
              <label>Endpoint URL</label>
              <InsertVarField
                onRequestVariableInsert={onRequestVariableInsert}
                shortRef
                onInsert={(snippet) => update({ endpoint: `${data.endpoint ?? ''}${snippet}` })}
              >
                <ExpressionInput
                  value={data.endpoint ?? ''}
                  onChange={(value) => update({ endpoint: value })}
                  placeholder="https://api.example.com/graphql"
                  variableHints={variableHints}
                />
              </InsertVarField>
              {tabErrors.endpoint && <span className="wf-config-error">Endpoint is required</span>}
            </div>

            <div className="wf-config-field-pair">
              <div className="wf-config-field--row">
                <label>Timeout (ms)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={data.timeoutMs ?? 30000}
                  onChange={(e) => update({ timeoutMs: Number(e.target.value) })}
                  data-testid="gql-wf-introspect-timeout-input"
                />
              </div>
              <div className="wf-config-field--row">
                <label>
                  <input
                    type="checkbox"
                    checked={data.skipTlsVerify ?? false}
                    onChange={(e) => update({ skipTlsVerify: e.target.checked })}
                    data-testid="gql-wf-introspect-skip-tls"
                  />
                  {' '}Skip TLS verify
                </label>
              </div>
            </div>

            <GqlHeadersSection
              headers={headers}
              headerCrud={headerCrud}
              onAdd={() => update({ headers: [...headers, { id: makeHeaderId(), key: '', value: '', enabled: true }] })}
              variableHints={variableHints}
              onRequestVariableInsert={onRequestVariableInsert}
            />

            <div style={{ margin: '16px 0 8px', borderTop: '1px solid var(--border-color, #333)' }} />

            <GqlAuthSection
              auth={data.auth}
              onChange={(auth) => update({ auth })}
              variableHints={variableHints}
              onRequestVariableInsert={onRequestVariableInsert}
            />
          </div>
        )}

        {/* ── Schema Validation tab ─────────────────────────── */}
        {activeTab === 'validation' && (
          <div>
            <div className="wf-config-hint" style={{ marginBottom: 12 }}>
              Optional schema validation — errors halt the workflow node if enabled.
            </div>

            <div className="wf-config-field--row">
              <label>Min type count</label>
              <input
                type="number"
                min={0}
                step={1}
                value={data.minTypeCount ?? ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  update({ minTypeCount: e.target.value === '' ? undefined : val });
                }}
                placeholder="(none)"
                data-testid="gql-wf-introspect-min-type-count"
              />
              <span className="wf-config-hint-inline">Fail if type count is below this</span>
            </div>

            <div className="wf-config-field">
              <label>Required type names <span className="wf-config-hint-inline">(comma-separated)</span></label>
              <input
                value={requiredTypesInput}
                onChange={(e) => {
                  setRequiredTypesInput(e.target.value);
                  const types = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  update({ requiredTypes: types.length > 0 ? types : undefined });
                }}
                placeholder="User, Post, Comment"
                data-testid="gql-wf-introspect-required-types"
              />
            </div>

            <div className="wf-kafka-section-title" style={{ marginTop: 16 }}>
              Required fields
              <button
                type="button"
                className="wf-section-add-btn"
                onClick={() => {
                  if (!newFieldType.trim() || !newFieldName.trim()) return;
                  update({
                    requiredFields: [
                      ...requiredFields,
                      { typeName: newFieldType.trim(), fieldName: newFieldName.trim() },
                    ],
                  });
                  setNewFieldType('');
                  setNewFieldName('');
                }}
                data-testid="gql-wf-introspect-add-field-btn"
              >
                + Add
              </button>
            </div>
            <div className="wf-config-hint" style={{ marginBottom: 8 }}>
              Fail if any of these fields are missing from their type.
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value)}
                placeholder="TypeName"
                style={{ flex: 1 }}
                data-testid="gql-wf-introspect-new-type"
              />
              <span style={{ padding: '4px 2px' }}>.</span>
              <input
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="fieldName"
                style={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFieldType.trim() && newFieldName.trim()) {
                    update({
                      requiredFields: [
                        ...requiredFields,
                        { typeName: newFieldType.trim(), fieldName: newFieldName.trim() },
                      ],
                    });
                    setNewFieldType('');
                    setNewFieldName('');
                  }
                }}
                data-testid="gql-wf-introspect-new-field"
              />
            </div>
            {requiredFields.length === 0 && (
              <div className="wf-config-empty-hint">No required fields — click + Add</div>
            )}
            <div className="wf-config-kv-list">
              {requiredFields.map((rf, index) => (
                <div key={index} className="wf-config-kv-row" style={{ alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>
                    <code>{rf.typeName}.{rf.fieldName}</code>
                  </span>
                  <button
                    type="button"
                    className="wf-kv-del-btn"
                    onClick={() =>
                      update({ requiredFields: requiredFields.filter((_, i) => i !== index) })
                    }
                    aria-label={`Remove required field ${rf.typeName}.${rf.fieldName}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Output tab ────────────────────────────────────── */}
        {activeTab === 'output' && (
          <GqlOutputSection
            bindings={outputBindings as GqlOutputBinding[]}
            fieldOptions={OUTPUT_FIELD_OPTIONS as string[]}
            crud={outputCrud as ReturnType<typeof useListCrud<GqlOutputBinding>>}
            onAdd={() =>
              update({
                outputBindings: [...outputBindings, { field: 'sdl', variableName: '', enabled: true }],
              })
            }
          />
        )}
      </div>
    </div>
  );
}
