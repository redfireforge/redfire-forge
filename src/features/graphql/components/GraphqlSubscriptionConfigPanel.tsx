/**
 * GraphqlSubscriptionConfigPanel — workflow node config for `graphqlSubscription`.
 * 5-tab layout: Subscription | Stop | Headers & Auth | Extraction | Output
 *
 * Phase 4 — Step 3 (4C-3)
 */
import { useState } from 'react';
import type {
  GraphqlSubscriptionNodeData,
  GraphqlSubscriptionOutputBinding,
  NodeRunStatus,
} from '../../workflow/types/workflow';
import type { WorkflowVariableHint } from '../../workflow/utils/workflowVariableHints';
import { useListCrud } from '../../../shared/hooks/useListCrud';
import InsertVarField from '../../workflow/components/expression/InsertVarField';
import ExpressionInput from '../../workflow/components/expression/ExpressionInput';
import AvailableVariables from '../../workflow/components/expression/AvailableVariables';
import {
  GqlHeadersSection,
  GqlAuthSection,
  GqlExtractionSection,
  GqlOutputSection,
  type GqlOutputBinding,
} from './GraphqlQueryConfigPanel';
import { computeSubscriptionTabErrors, hasInvalidVariablesJson } from '../utils/graphqlPanelHelpers';

// ── Output field options ──────────────────────────────────────────────────────

const OUTPUT_FIELD_OPTIONS: GraphqlSubscriptionOutputBinding['field'][] = [
  'messages', 'messageCount', 'firstMessage', 'lastMessage', 'latencyMs',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHeaderId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type SubTab = 'subscription' | 'stop' | 'headers-auth' | 'extraction' | 'output';

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphqlSubscriptionConfigPanel({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
  nodeRunStatus,
}: {
  data: GraphqlSubscriptionNodeData;
  onChange: (d: GraphqlSubscriptionNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
  nodeRunStatus?: NodeRunStatus | null;
}) {
  const [activeTab, setActiveTab] = useState<SubTab>('subscription');

  const update = (patch: Partial<GraphqlSubscriptionNodeData>) => onChange({ ...data, ...patch });

  const headers = data.headers ?? [];
  const extractionRules = data.extractionRules ?? [];
  const outputBindings = data.outputBindings ?? [];

  const headerCrud = useListCrud(headers, (items) => update({ headers: items }));
  const extractionCrud = useListCrud(extractionRules, (items) => update({ extractionRules: items }));
  const outputCrud = useListCrud(outputBindings, (items) => update({ outputBindings: items }));

  const tabErrors = computeSubscriptionTabErrors({
    endpoint: data.endpoint,
    subscriptionQuery: data.subscriptionQuery,
    variables: data.variables,
    extractionRules,
    outputBindings,
  });

  const TABS: { id: SubTab; label: string; errorDot?: boolean; count?: number }[] = [
    { id: 'subscription', label: 'Subscription', errorDot: tabErrors.subscription },
    { id: 'stop', label: 'Stop' },
    { id: 'headers-auth', label: 'Headers & Auth', count: headers.filter((h) => h.key.trim()).length || undefined },
    { id: 'extraction', label: 'Extraction', errorDot: tabErrors.extraction, count: extractionRules.length > 0 ? extractionRules.length : undefined },
    { id: 'output', label: 'Output', errorDot: tabErrors.output, count: outputBindings.filter((b) => b.enabled).length > 0 ? outputBindings.filter((b) => b.enabled).length : undefined },
  ];

  return (
    <div className="wf-config-body" data-testid="gql-wf-subscription-panel">
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
        {/* ── Subscription tab ──────────────────────────────── */}
        {activeTab === 'subscription' && (
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
              {!data.endpoint?.trim() && <span className="wf-config-error">Endpoint is required</span>}
            </div>

            <div className="wf-config-field--row">
              <label>Transport</label>
              <select
                value={data.subscriptionTransport ?? 'auto'}
                onChange={(e) =>
                  update({ subscriptionTransport: e.target.value as GraphqlSubscriptionNodeData['subscriptionTransport'] })
                }
                data-testid="gql-wf-sub-transport-select"
              >
                <option value="auto">Auto (detect)</option>
                <option value="graphql-transport-ws">graphql-transport-ws</option>
                <option value="graphql-ws">graphql-ws (legacy)</option>
                <option value="sse">SSE</option>
              </select>
            </div>

            <div className="wf-config-field">
              <label>Subscription Query</label>
              <textarea
                className="wf-config-code-editor"
                value={data.subscriptionQuery ?? ''}
                onChange={(e) => update({ subscriptionQuery: e.target.value })}
                placeholder={'subscription {\n  \n}'}
                rows={7}
                spellCheck={false}
                data-testid="gql-wf-subscription-query-editor"
              />
              {!data.subscriptionQuery?.trim() && <span className="wf-config-error">Subscription query is required</span>}
            </div>

            <div className="wf-config-field">
              <label>Variables <span className="wf-config-hint-inline">(JSON; {'{{var}}'} supported)</span></label>
              <textarea
                className="wf-config-code-editor"
                value={data.variables ?? '{}'}
                onChange={(e) => update({ variables: e.target.value })}
                placeholder="{}"
                rows={4}
                spellCheck={false}
                data-testid="gql-wf-sub-variables-editor"
              />
              {tabErrors.subscription && hasInvalidVariablesJson(data.variables) && (
                <span className="wf-config-error">Variables must be valid JSON</span>
              )}
            </div>
            <AvailableVariables hints={variableHints} />
          </div>
        )}

        {/* ── Stop tab ──────────────────────────────────────── */}
        {activeTab === 'stop' && (
          <div>
            <div className="wf-config-hint" style={{ marginBottom: 12 }}>
              Define when this node stops collecting messages. All conditions are checked; the first met wins.
            </div>
            <div className="wf-config-field--row">
              <label>After N messages</label>
              <input
                type="number"
                min={0}
                step={1}
                value={data.stopAfterMessages ?? 0}
                onChange={(e) => update({ stopAfterMessages: Number(e.target.value) })}
                placeholder="0 = unlimited"
                data-testid="gql-wf-stop-messages-input"
              />
              <span className="wf-config-hint-inline">(0 = unlimited)</span>
            </div>
            <div className="wf-config-field--row">
              <label>After (seconds)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={data.stopAfterMs != null ? Math.round(data.stopAfterMs / 1000) : ''}
                onChange={(e) => {
                  const secs = Number(e.target.value);
                  update({ stopAfterMs: secs > 0 ? secs * 1000 : undefined });
                }}
                placeholder="no wall-time limit"
                data-testid="gql-wf-stop-secs-input"
              />
              <span className="wf-config-hint-inline">(blank = no limit)</span>
            </div>
            <div className="wf-config-field">
              <label>Stop condition (JSONPath on latest message)</label>
              <ExpressionInput
                value={data.stopCondition ?? ''}
                onChange={(value) => update({ stopCondition: value || undefined })}
                placeholder="$.status == 'done'"
                variableHints={variableHints}
              />
              <span className="wf-config-hint-inline">Stop when this JSONPath expression evaluates truthy</span>
            </div>
          </div>
        )}

        {/* ── Headers & Auth tab ────────────────────────────── */}
        {activeTab === 'headers-auth' && (
          <div>
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

        {/* ── Extraction tab ────────────────────────────────── */}
        {activeTab === 'extraction' && (
          <GqlExtractionSection
            rules={extractionRules}
            crud={extractionCrud}
            onAdd={() => update({ extractionRules: [...extractionRules, { variableName: '', jsonPath: '' }] })}
            nodeRunStatus={nodeRunStatus}
            extractionMode="subscription"
          />
        )}

        {/* ── Output tab ────────────────────────────────────── */}
        {activeTab === 'output' && (
          <GqlOutputSection
            bindings={outputBindings as GqlOutputBinding[]}
            fieldOptions={OUTPUT_FIELD_OPTIONS as string[]}
            crud={outputCrud as ReturnType<typeof useListCrud<GqlOutputBinding>>}
            onAdd={() =>
              update({
                outputBindings: [...outputBindings, { field: 'messages', variableName: '', enabled: true }],
              })
            }
          />
        )}
      </div>
    </div>
  );
}
