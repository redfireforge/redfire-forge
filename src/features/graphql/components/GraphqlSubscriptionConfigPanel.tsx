/**
 * GraphqlSubscriptionConfigPanel — workflow node config for `graphqlSubscription`.
 * 5-tab layout: Subscription | Stop | Headers & Auth | Extraction | Output
 *
 * Phase 4 — Step 3 (4C-3)
 */
import { useState } from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type {
  GraphqlSubscriptionNodeData,
  GraphqlSubscriptionOutputBinding,
  NodeRunStatus,
} from '@workflow/types/workflow';
import type { WorkflowVariableHint } from '@workflow/utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '@workflow/components/expression/InsertVarField';
import ExpressionInput from '@workflow/components/expression/ExpressionInput';
import AvailableVariables from '@workflow/components/expression/AvailableVariables';
import {
  GqlHeadersSection,
  GqlAuthSection,
  GqlExtractionSection,
  GqlOutputSection,
  type GqlOutputBinding,
} from './GraphqlQueryConfigPanel';
import { computeSubscriptionTabErrors, hasInvalidVariablesJson } from '../utils/graphqlPanelHelpers';
import {
  GqlWfConfigBody,
  GqlWfSubTabs,
  GqlWfFormCard,
  GqlWfFormRow,
  GqlWfFieldError,
  GqlWfCodeField,
  type GqlWfSubTab,
} from './GraphqlWfConfigLayout';

const OUTPUT_FIELD_OPTIONS: GraphqlSubscriptionOutputBinding['field'][] = [
  'messages', 'messageCount', 'firstMessage', 'lastMessage', 'latencyMs',
];

function makeHeaderId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function GqlStopSection({
  data,
  onChange,
  variableHints,
  onRequestVariableInsert,
}: {
  data: GraphqlSubscriptionNodeData;
  onChange: (patch: Partial<GraphqlSubscriptionNodeData>) => void;
  variableHints: WorkflowVariableHint[];
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
}) {
  const messageLimit = data.stopAfterMessages ?? 0;
  const timeSecs = data.stopAfterMs != null && data.stopAfterMs > 0
    ? Math.round(data.stopAfterMs / 1000)
    : '';
  const expression = data.stopCondition ?? '';
  const hasMessageLimit = messageLimit > 0;
  const hasTimeLimit = typeof timeSecs === 'number' && timeSecs > 0;
  const hasExpression = expression.trim().length > 0;
  const hasAnyRule = hasMessageLimit || hasTimeLimit || hasExpression;

  return (
    <div className="gql-wf-stop" data-testid="gql-wf-stop-section">
      <div className="gql-wf-section-toolbar">
        <div className="gql-wf-section-toolbar-text">
          <h4 className="gql-wf-section-title">Stop conditions</h4>
          <p className="gql-wf-section-subtitle">
            End collection when any rule is met — first match wins. Leave empty for unlimited.
          </p>
        </div>
      </div>

      <div
        className="gql-wf-stop-summary"
        role="status"
        aria-label="Active stop conditions"
      >
        {!hasAnyRule && (
          <span className="gql-wf-stop-chip gql-wf-stop-chip--idle">Runs until cancelled</span>
        )}
        {hasMessageLimit && (
          <span className="gql-wf-stop-chip gql-wf-stop-chip--active">
            {messageLimit} message{messageLimit === 1 ? '' : 's'}
          </span>
        )}
        {hasTimeLimit && (
          <span className="gql-wf-stop-chip gql-wf-stop-chip--active">
            {timeSecs}s wall time
          </span>
        )}
        {hasExpression && (
          <span className="gql-wf-stop-chip gql-wf-stop-chip--active">Expression</span>
        )}
      </div>

      <div className="gql-wf-form-card gql-wf-stop-card">
        <GqlWfFormRow label="Message limit" htmlFor="gql-wf-stop-messages">
          <div className="gql-wf-input-with-unit">
            <input
              id="gql-wf-stop-messages"
              type="number"
              min={0}
              step={1}
              value={messageLimit}
              onChange={(e) => onChange({ stopAfterMessages: Number(e.target.value) })}
              placeholder="0"
              data-testid="gql-wf-stop-messages-input"
              aria-describedby="gql-wf-stop-messages-hint"
            />
            <span className="gql-wf-input-unit">messages</span>
            <span id="gql-wf-stop-messages-hint" className="gql-wf-input-hint">
              0 = unlimited
            </span>
          </div>
        </GqlWfFormRow>

        <GqlWfFormRow label="Time limit" htmlFor="gql-wf-stop-secs">
          <div className="gql-wf-input-with-unit">
            <input
              id="gql-wf-stop-secs"
              type="number"
              min={0}
              step={1}
              value={timeSecs}
              onChange={(e) => {
                const secs = Number(e.target.value);
                onChange({ stopAfterMs: secs > 0 ? secs * 1000 : undefined });
              }}
              placeholder="—"
              data-testid="gql-wf-stop-secs-input"
              aria-describedby="gql-wf-stop-secs-hint"
            />
            <span className="gql-wf-input-unit">seconds</span>
            <span id="gql-wf-stop-secs-hint" className="gql-wf-input-hint">
              Blank = no limit
            </span>
          </div>
        </GqlWfFormRow>

        <GqlWfFormRow label="Expression" last>
          <div className="gql-wf-stop-expression">
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) =>
                onChange({ stopCondition: `${expression}${snippet}` || undefined })
              }
            >
              <ExpressionInput
                value={expression}
                onChange={(value) => onChange({ stopCondition: value || undefined })}
                placeholder="$.status == 'done'"
                variableHints={variableHints}
                aria-label="Stop expression"
              />
            </InsertVarField>
            <span className="gql-wf-input-hint">
              JSONPath on the latest message — stop when truthy
            </span>
          </div>
        </GqlWfFormRow>
      </div>
    </div>
  );
}

type SubTab = 'subscription' | 'stop' | 'headers-auth' | 'extraction' | 'output';

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

  const TABS: GqlWfSubTab[] = [
    { id: 'subscription', label: 'Subscription', errorDot: tabErrors.subscription },
    { id: 'stop', label: 'Stop' },
    { id: 'headers-auth', label: 'Headers & Auth', count: headers.filter((h) => h.key.trim()).length || undefined },
    { id: 'extraction', label: 'Extraction', errorDot: tabErrors.extraction, count: extractionRules.length > 0 ? extractionRules.length : undefined },
    { id: 'output', label: 'Output', errorDot: tabErrors.output, count: outputBindings.filter((b) => b.enabled).length > 0 ? outputBindings.filter((b) => b.enabled).length : undefined },
  ];

  return (
    <GqlWfConfigBody testId="gql-wf-subscription-panel">
      <GqlWfFormCard>
        <GqlWfFormRow label="Label" htmlFor="gql-wf-sub-label" last>
          <input
            id="gql-wf-sub-label"
            value={data.label}
            onChange={(e) => update({ label: e.target.value })}
          />
        </GqlWfFormRow>
      </GqlWfFormCard>

      <GqlWfSubTabs tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as SubTab)} />

      <div className="wf-config-tab-content">
        {activeTab === 'subscription' && (
          <>
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
                {!data.endpoint?.trim() && <GqlWfFieldError>Endpoint is required</GqlWfFieldError>}
              </GqlWfFormRow>

              <GqlWfFormRow label="Transport">
                <CustomSelect
                  value={data.subscriptionTransport ?? 'auto'}
                  onChange={(v) =>
                    update({ subscriptionTransport: v as GraphqlSubscriptionNodeData['subscriptionTransport'] })
                  }
                  options={[
                    { value: 'auto', label: 'Auto (detect)' },
                    { value: 'graphql-transport-ws', label: 'graphql-transport-ws' },
                    { value: 'graphql-ws', label: 'graphql-ws (legacy)' },
                    { value: 'sse', label: 'SSE' },
                  ]}
                  data-testid="gql-wf-sub-transport-select"
                />
              </GqlWfFormRow>

              <GqlWfCodeField
                label="Subscription query"
                value={data.subscriptionQuery ?? ''}
                onChange={(value) => update({ subscriptionQuery: value })}
                placeholder={'subscription {\n  \n}'}
                rows={7}
                testId="gql-wf-subscription-query-editor"
                toolbarHint="GraphQL subscription operation"
                error={!data.subscriptionQuery?.trim() ? <GqlWfFieldError>Subscription query is required</GqlWfFieldError> : undefined}
              />

              <GqlWfFormRow label="Variables" stack last>
                <div className="gql-wf-code-block">
                  <div className="gql-wf-code-toolbar">
                    <span className="gql-wf-code-toolbar-hint">JSON — {'{{var}}'} supported</span>
                  </div>
                  <textarea
                    className="gql-wf-code-editor"
                    value={data.variables ?? '{}'}
                    onChange={(e) => update({ variables: e.target.value })}
                    placeholder="{}"
                    rows={4}
                    spellCheck={false}
                    data-testid="gql-wf-sub-variables-editor"
                  />
                </div>
                {tabErrors.subscription && hasInvalidVariablesJson(data.variables) && (
                  <GqlWfFieldError>Variables must be valid JSON</GqlWfFieldError>
                )}
              </GqlWfFormRow>
            </GqlWfFormCard>
            <AvailableVariables hints={variableHints} dock />
          </>
        )}

        {activeTab === 'stop' && (
          <div className="gql-wf-section-body">
            <GqlStopSection
              data={data}
              onChange={update}
              variableHints={variableHints}
              onRequestVariableInsert={onRequestVariableInsert}
            />
          </div>
        )}

        {activeTab === 'headers-auth' && (
          <GqlWfFormCard>
            <div className="gql-wf-section-body">
              <GqlHeadersSection
                headers={headers}
                headerCrud={headerCrud}
                onAdd={() => update({ headers: [...headers, { id: makeHeaderId(), key: '', value: '', enabled: true }] })}
                variableHints={variableHints}
                onRequestVariableInsert={onRequestVariableInsert}
              />
            </div>
            <div className="gql-wf-section-divider gql-wf-section-divider--flush" />
            <GqlAuthSection
              auth={data.auth}
              onChange={(auth) => update({ auth })}
              variableHints={variableHints}
              onRequestVariableInsert={onRequestVariableInsert}
            />
          </GqlWfFormCard>
        )}

        {activeTab === 'extraction' && (
          <GqlWfFormCard>
            <div className="gql-wf-section-body">
              <GqlExtractionSection
                rules={extractionRules}
                crud={extractionCrud}
                onAdd={() => update({ extractionRules: [...extractionRules, { variableName: '', jsonPath: '' }] })}
                nodeRunStatus={nodeRunStatus}
                extractionMode="subscription"
              />
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
                    outputBindings: [...outputBindings, { field: 'messages', variableName: '', enabled: true }],
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
