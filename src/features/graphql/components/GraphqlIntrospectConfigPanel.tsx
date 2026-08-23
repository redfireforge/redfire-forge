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
} from '@workflow/types/workflow';
import type { WorkflowVariableHint } from '@workflow/utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '@workflow/components/expression/InsertVarField';
import ExpressionInput from '@workflow/components/expression/ExpressionInput';
import {
  GqlHeadersSection,
  GqlAuthSection,
  GqlOutputSection,
  type GqlOutputBinding,
} from './GraphqlQueryConfigPanel';
import { computeIntrospectTabErrors } from '../utils/graphqlPanelHelpers';
import {
  GqlWfConfigBody,
  GqlWfSubTabs,
  GqlWfFormCard,
  GqlWfFormRow,
  GqlWfFieldError,
  GqlWfSectionToolbar,
  GqlWfCheckboxRow,
  type GqlWfSubTab,
} from './GraphqlWfConfigLayout';

const OUTPUT_FIELD_OPTIONS: GraphqlIntrospectOutputBinding['field'][] = [
  'sdl', 'typeCount', 'fieldCount', 'schemaHash', 'queryTypeName',
];

function makeHeaderId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type IntrospectTab = 'endpoint' | 'validation' | 'output';

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

  const TABS: GqlWfSubTab[] = [
    { id: 'endpoint', label: 'Endpoint', errorDot: tabErrors.endpoint },
    { id: 'validation', label: 'Schema validation' },
    { id: 'output', label: 'Output', errorDot: tabErrors.output, count: outputBindings.filter((b) => b.enabled).length > 0 ? outputBindings.filter((b) => b.enabled).length : undefined },
  ];

  const addRequiredField = () => {
    if (!newFieldType.trim() || !newFieldName.trim()) return;
    update({
      requiredFields: [
        ...requiredFields,
        { typeName: newFieldType.trim(), fieldName: newFieldName.trim() },
      ],
    });
    setNewFieldType('');
    setNewFieldName('');
  };

  return (
    <GqlWfConfigBody testId="gql-wf-introspect-panel">
      <GqlWfFormCard>
        <GqlWfFormRow label="Label" htmlFor="gql-wf-introspect-label" last>
          <input
            id="gql-wf-introspect-label"
            value={data.label}
            onChange={(e) => update({ label: e.target.value })}
          />
        </GqlWfFormRow>
      </GqlWfFormCard>

      <GqlWfSubTabs tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as IntrospectTab)} />

      <div className="wf-config-tab-content">
        {activeTab === 'endpoint' && (
          <GqlWfFormCard>
            <GqlWfFormRow label="Endpoint URL">
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
                  data-testid="gql-wf-endpoint-input"
                />
              </InsertVarField>
              {tabErrors.endpoint && <GqlWfFieldError>Endpoint is required</GqlWfFieldError>}
            </GqlWfFormRow>

            <GqlWfFormRow label="Timeout (ms)">
              <input
                type="number"
                min={1000}
                step={1000}
                value={data.timeoutMs ?? 30000}
                onChange={(e) => update({ timeoutMs: Number(e.target.value) })}
                data-testid="gql-wf-introspect-timeout-input"
              />
            </GqlWfFormRow>

            <GqlWfCheckboxRow
              checked={data.skipTlsVerify ?? false}
              onChange={(skipTlsVerify) => update({ skipTlsVerify })}
              label="Skip TLS verify"
              hint="Allow self-signed certificates (dev only)"
              testId="gql-wf-introspect-skip-tls"
            />

            <div className="gql-wf-section-divider gql-wf-section-divider--inset" />

            <div className="gql-wf-section-body gql-wf-section-body--flush-top">
              <GqlHeadersSection
                headers={headers}
                headerCrud={headerCrud}
                onAdd={() => update({ headers: [...headers, { id: makeHeaderId(), key: '', value: '', enabled: true }] })}
                variableHints={variableHints}
                onRequestVariableInsert={onRequestVariableInsert}
              />
              <div className="gql-wf-section-divider" />
              <GqlAuthSection
                auth={data.auth}
                onChange={(auth) => update({ auth })}
                variableHints={variableHints}
                onRequestVariableInsert={onRequestVariableInsert}
              />
            </div>
          </GqlWfFormCard>
        )}

        {activeTab === 'validation' && (
          <GqlWfFormCard>
            <p className="gql-wf-section-intro gql-wf-section-intro--card">
              Optional schema validation — errors halt the workflow node when enabled.
            </p>

            <GqlWfFormRow label="Min type count" stack>
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
              <span className="gql-wf-inline-hint">Fail if type count is below this</span>
            </GqlWfFormRow>

            <GqlWfFormRow label="Required types" stack>
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
              <span className="gql-wf-inline-hint">Comma-separated type names</span>
            </GqlWfFormRow>

            <div className="gql-wf-section-body gql-wf-section-body--flush-top">
              <GqlWfSectionToolbar
                title="Required fields"
                subtitle="Fail if any of these fields are missing from their type"
                actions={(
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost gql-wf-section-add-btn"
                    onClick={addRequiredField}
                    data-testid="gql-wf-introspect-add-field-btn"
                  >
                    + Add
                  </button>
                )}
              />

              <div className="gql-wf-required-field-compose">
                <input
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  placeholder="TypeName"
                  data-testid="gql-wf-introspect-new-type"
                />
                <span className="gql-wf-required-field-sep">.</span>
                <input
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="fieldName"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addRequiredField();
                  }}
                  data-testid="gql-wf-introspect-new-field"
                />
              </div>

              {requiredFields.length === 0 ? (
                <div className="wf-config-empty-hint">No required fields — click + Add</div>
              ) : (
                <div className="gql-wf-required-field-list">
                  {requiredFields.map((rf, index) => (
                    <div key={index} className="gql-wf-required-field-row">
                      <code>{rf.typeName}.{rf.fieldName}</code>
                      <button
                        type="button"
                        className="gql-wf-assert-remove-btn"
                        onClick={() =>
                          update({ requiredFields: requiredFields.filter((_, i) => i !== index) })
                        }
                        aria-label={`Remove required field ${rf.typeName}.${rf.fieldName}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GqlWfFormCard>
        )}

        {activeTab === 'output' && (
          <GqlWfFormCard>
            <div className="gql-wf-section-body">
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
            </div>
          </GqlWfFormCard>
        )}
      </div>
    </GqlWfConfigBody>
  );
}
