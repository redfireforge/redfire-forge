/**
 * GraphqlQueryConfigPanel — workflow node config for `graphqlQuery` and `graphqlMutation`.
 * 6-tab layout: Operation | Variables | Headers | Auth | Extraction | Output
 *
 * Phase 4 — Step 3 (4C-1, 4C-2)
 */
import { useState } from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type {
  GraphqlQueryNodeData,
  GraphqlExtractionRule,
  NodeRunStatus,
} from '../../workflow/types/workflow';
import type { WorkflowVariableHint } from '../../workflow/utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '../../workflow/components/expression/InsertVarField';
import ExpressionInput from '../../workflow/components/expression/ExpressionInput';
import AvailableVariables from '../../workflow/components/expression/AvailableVariables';
import GraphqlImportFromCollectionModal from './GraphqlImportFromCollectionModal';
import { isValidIdentifier, computeQueryTabErrors, countOperationTabConfigured, countVariablesTabConfigured } from '../utils/graphqlPanelHelpers';
import {
  getExtractionTestRoot,
  hasGraphqlRunData,
  parseGraphqlRunSnapshot,
  testGraphqlExtractionRules,
  type ExtractionTestResult,
} from '../utils/graphqlConfigTestHelpers';
import {
  GqlWfConfigBody,
  GqlWfSubTabs,
  GqlWfFormCard,
  GqlWfFormRow,
  GqlWfFieldError,
  GqlWfCodeField,
  GqlWfCheckboxRow,
  GqlWfTabStack,
  type GqlWfSubTab,
} from './GraphqlWfConfigLayout';
import {
  OUTPUT_FIELD_OPTIONS,
  makeHeaderId,
} from './GraphqlQueryConfigPanel.constants';
import { GqlHeadersSection, GqlAuthSection } from './GraphqlQueryConfigPanel.sections';

export { GqlHeadersSection, GqlAuthSection } from './GraphqlQueryConfigPanel.sections';

export function GqlExtractionSection({
  rules,
  crud,
  onAdd,
  nodeRunStatus,
  extractionMode = 'query',
}: {
  rules: GraphqlExtractionRule[];
  crud: ReturnType<typeof useListCrud<GraphqlExtractionRule>>;
  onAdd: () => void;
  nodeRunStatus?: NodeRunStatus | null;
  /** `subscription` tests against the last message's inner `data`. */
  extractionMode?: 'query' | 'subscription';
}) {
  const [testResults, setTestResults] = useState<ExtractionTestResult[] | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const handleTest = () => {
    if (!hasGraphqlRunData(nodeRunStatus)) {
      setTestResults(null);
      setTestMessage('No data — run the workflow first.');
      return;
    }
    const snapshot = parseGraphqlRunSnapshot(nodeRunStatus);
    const dataRoot = getExtractionTestRoot(snapshot, extractionMode);
    if (dataRoot === undefined) {
      setTestResults(null);
      setTestMessage('No response data available from the last run.');
      return;
    }
    if (rules.length === 0) {
      setTestResults([]);
      setTestMessage('Add at least one extraction rule to test.');
      return;
    }
    const results = testGraphqlExtractionRules(rules, dataRoot);
    setTestResults(results);
    setTestMessage(null);
  };

  const resultByIndex = (index: number): ExtractionTestResult | undefined =>
    testResults?.[index];

  const matchedCount = testResults?.filter((r) => r.ok).length ?? 0;
  const failedCount = testResults ? testResults.length - matchedCount : 0;

  return (
    <div className="gql-wf-extraction-rules" data-testid="gql-wf-extraction-table">
      <div className="gql-wf-section-toolbar">
        <div className="gql-wf-section-toolbar-text">
          <h4 className="gql-wf-section-title">Extraction Rules</h4>
          <p className="gql-wf-section-subtitle">
            Pull values from the response <code>data</code> object with JSONPath and store them as{' '}
            <code>{'{{variableName}}'}</code> for downstream nodes.
          </p>
        </div>
        <div className="gql-wf-section-toolbar-actions">
          <button
            type="button"
            className="btn btn-sm gql-wf-extraction-test-btn"
            onClick={handleTest}
            data-testid="gql-wf-extraction-test-btn"
            title="Test extraction rules against the last run response"
          >
            Test
          </button>
          <button
            type="button"
            className="btn btn-sm gql-wf-section-add-btn"
            onClick={onAdd}
            data-testid="gql-wf-extraction-add-btn"
          >
            + Add rule
          </button>
        </div>
      </div>

      {testMessage && (
        <p className="gql-wf-test-banner gql-wf-test-banner--warn" role="status" data-testid="gql-wf-extraction-test-msg">
          {testMessage}
        </p>
      )}
      {testResults && testResults.length > 0 && (
        <p
          className={`gql-wf-test-banner ${failedCount === 0 ? 'gql-wf-test-banner--pass' : 'gql-wf-test-banner--fail'}`}
          role="status"
          data-testid="gql-wf-extraction-test-summary"
        >
          {failedCount === 0
            ? `All ${testResults.length} extraction rule(s) matched.`
            : `${failedCount} of ${testResults.length} rule(s) failed.`}
        </p>
      )}

      {rules.length === 0 ? (
        <div className="gql-wf-extraction-empty">
          <span>No extraction rules yet.</span>
          <span>
            Click <strong>+ Add rule</strong> to map a JSONPath from <code>data</code> to a workflow variable.
          </span>
        </div>
      ) : (
        <div className="gql-wf-extraction-table">
          <div className="gql-wf-extraction-col-headers" aria-hidden="true">
            <span className="gql-wf-extraction-col gql-wf-extraction-col-path">JSONPath</span>
            <span className="gql-wf-extraction-col gql-wf-extraction-col-arrow" />
            <span className="gql-wf-extraction-col gql-wf-extraction-col-var">Workflow variable</span>
            <span className="gql-wf-extraction-col gql-wf-extraction-col-del" />
          </div>
          <div className="gql-wf-extraction-list">
            {rules.map((rule, index) => {
              const nameErr = rule.variableName.trim() !== '' && !isValidIdentifier(rule.variableName);
              const testResult = resultByIndex(index);
              return (
                <div
                  key={index}
                  className={`gql-wf-extraction-row${testResult && !testResult.ok ? ' gql-wf-extraction-row--fail' : ''}${testResult?.ok ? ' gql-wf-extraction-row--pass' : ''}`}
                >
                  <div className="gql-wf-extraction-col gql-wf-extraction-col-path">
                    <input
                      value={rule.jsonPath}
                      onChange={(e) => crud.update(index, { jsonPath: e.target.value })}
                      placeholder="$.user.id"
                      aria-label="JSONPath expression"
                      data-testid="gql-wf-extraction-jsonpath"
                      spellCheck={false}
                    />
                  </div>
                  <div className="gql-wf-extraction-col gql-wf-extraction-col-arrow" aria-hidden="true">
                    <span className="gql-wf-extraction-map-arrow" title="Maps to">→</span>
                  </div>
                  <div className="gql-wf-extraction-col gql-wf-extraction-col-var">
                    <input
                      value={rule.variableName}
                      onChange={(e) => crud.update(index, { variableName: e.target.value })}
                      placeholder="userId"
                      aria-label="Variable name"
                      data-testid="gql-wf-extraction-varname"
                      className={nameErr ? 'wf-input-error' : undefined}
                      spellCheck={false}
                    />
                    {nameErr && <span className="wf-config-error">Must be a valid identifier</span>}
                    {testResult && (
                      <span
                        className={testResult.ok ? 'gql-wf-test-inline gql-wf-test-inline--pass' : 'gql-wf-test-inline gql-wf-test-inline--fail'}
                        data-testid="gql-wf-extraction-test-result"
                      >
                        {testResult.ok ? `✓ ${testResult.value}` : `✗ ${testResult.error}`}
                      </span>
                    )}
                  </div>
                  <div className="gql-wf-extraction-col gql-wf-extraction-col-del">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => crud.remove(index)}
                      aria-label={`Remove extraction rule ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface GqlOutputBinding {
  field: string;
  variableName: string;
  enabled: boolean;
}

export function GqlOutputSection({
  bindings,
  fieldOptions,
  crud,
  onAdd,
}: {
  bindings: GqlOutputBinding[];
  fieldOptions: string[];
  crud: ReturnType<typeof useListCrud<GqlOutputBinding>>;
  onAdd: () => void;
}) {
  return (
    <div className="gql-wf-output-bindings" data-testid="gql-wf-output-table">
      <div className="gql-wf-section-toolbar">
        <div className="gql-wf-section-toolbar-text">
          <h4 className="gql-wf-section-title">Output Bindings</h4>
          <p className="gql-wf-section-subtitle">
            Map response fields to workflow variables — reference them downstream as{' '}
            <code>{'{{variableName}}'}</code>.
          </p>
        </div>
        <div className="gql-wf-section-toolbar-actions">
          <button
            type="button"
            className="btn btn-sm gql-wf-section-add-btn"
            onClick={onAdd}
            data-testid="gql-wf-output-add-btn"
          >
            + Add binding
          </button>
        </div>
      </div>

      {bindings.length === 0 ? (
        <div className="gql-wf-output-empty">
          <span>No output bindings yet.</span>
          <span>
            Click <strong>+ Add binding</strong> to map a response field to a workflow variable.
          </span>
        </div>
      ) : (
        <div className="gql-wf-output-table">
          <div className="gql-wf-output-col-headers" aria-hidden="true">
            <span className="gql-wf-output-col gql-wf-output-col-toggle">On</span>
            <span className="gql-wf-output-col gql-wf-output-col-field">Response field</span>
            <span className="gql-wf-output-col gql-wf-output-col-arrow" />
            <span className="gql-wf-output-col gql-wf-output-col-var">Workflow variable</span>
            <span className="gql-wf-output-col gql-wf-output-col-del" />
          </div>
          <div className="gql-wf-output-list">
            {bindings.map((binding, index) => {
              const nameErr = binding.variableName.trim() !== '' && !isValidIdentifier(binding.variableName);
              return (
                <div key={index} className="gql-wf-output-row">
                  <div className="gql-wf-output-col gql-wf-output-col-toggle">
                    <input
                      type="checkbox"
                      checked={binding.enabled}
                      onChange={(e) => crud.update(index, { enabled: e.target.checked })}
                      aria-label={`Enable binding ${binding.field}`}
                    />
                  </div>
                  <div className="gql-wf-output-col gql-wf-output-col-field">
                    <CustomSelect
                      className="gql-wf-output-field-select"
                      value={binding.field}
                      onChange={(v) => crud.update(index, { field: v })}
                      options={fieldOptions.map((f) => ({ value: f, label: f }))}
                      data-testid="gql-wf-output-field-select"
                      aria-label={`Response field for binding ${index + 1}`}
                      size="sm"
                    />
                  </div>
                  <div className="gql-wf-output-col gql-wf-output-col-arrow" aria-hidden="true">
                    <span className="gql-wf-output-map-arrow" title="Maps to">→</span>
                  </div>
                  <div className="gql-wf-output-col gql-wf-output-col-var">
                    <input
                      value={binding.variableName}
                      onChange={(e) => crud.update(index, { variableName: e.target.value })}
                      placeholder="variableName"
                      aria-label="Variable name"
                      data-testid="gql-wf-output-varname"
                      className={nameErr ? 'wf-input-error' : undefined}
                    />
                    {nameErr && <span className="wf-config-error">Must be a valid identifier</span>}
                  </div>
                  <div className="gql-wf-output-col gql-wf-output-col-del">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => crud.remove(index)}
                      aria-label={`Remove binding ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type QueryTab = 'operation' | 'variables' | 'headers' | 'auth' | 'extraction' | 'output';

export default function GraphqlQueryConfigPanel({
  data,
  nodeType = 'graphqlQuery',
  onChange,
  onRequestVariableInsert,
  variableHints = [],
  nodeRunStatus,
}: {
  data: GraphqlQueryNodeData;
  /** Distinguishes query (purple) from mutation (amber) panels. */
  nodeType?: 'graphqlQuery' | 'graphqlMutation';
  onChange: (d: GraphqlQueryNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
  /** Last run status for this node — powers extraction Test button. */
  nodeRunStatus?: NodeRunStatus | null;
}) {
  const [activeTab, setActiveTab] = useState<QueryTab>('operation');
  const [showImportPicker, setShowImportPicker] = useState(false);

  const update = (patch: Partial<GraphqlQueryNodeData>) => onChange({ ...data, ...patch });
  const isMutation = nodeType === 'graphqlMutation';

  const headers = data.headers ?? [];
  const extractionRules = data.extractionRules ?? [];
  const outputBindings = data.outputBindings ?? [];

  const headerCrud = useListCrud(headers, (items) => update({ headers: items }));
  const extractionCrud = useListCrud(extractionRules, (items) => update({ extractionRules: items }));
  const outputCrud = useListCrud(outputBindings, (items) => update({ outputBindings: items }));

  // Tab validation dots (4C-8)
  const tabErrors = computeQueryTabErrors({
    endpoint: data.endpoint,
    query: data.query,
    variables: data.variables,
    extractionRules,
    outputBindings,
  });

  const TABS: GqlWfSubTab[] = [
    {
      id: 'operation',
      label: 'Operation',
      errorDot: tabErrors.operation,
      count: countOperationTabConfigured(data) || undefined,
    },
    {
      id: 'variables',
      label: 'Variables',
      errorDot: tabErrors.variables,
      count: countVariablesTabConfigured(data.variables) || undefined,
    },
    { id: 'headers', label: 'Headers', count: headers.filter((h) => h.key.trim()).length || undefined },
    { id: 'auth', label: 'Auth' },
    { id: 'extraction', label: 'Extraction', errorDot: tabErrors.extraction, count: extractionRules.length > 0 ? extractionRules.length : undefined },
    { id: 'output', label: 'Output', errorDot: tabErrors.output, count: outputBindings.filter((b) => b.enabled).length > 0 ? outputBindings.filter((b) => b.enabled).length : undefined },
  ];

  const queryLabel = isMutation ? 'Mutation' : 'Query';

  return (
    <GqlWfConfigBody testId={isMutation ? 'gql-wf-mutation-panel' : 'gql-wf-query-panel'}>
      <GqlWfFormCard>
        <GqlWfFormRow label="Label" htmlFor="gql-wf-node-label" last>
          <input
            id="gql-wf-node-label"
            value={data.label}
            onChange={(e) => update({ label: e.target.value })}
          />
        </GqlWfFormRow>
      </GqlWfFormCard>

      <GqlWfSubTabs tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as QueryTab)} />

      <div className="wf-config-tab-content">
        {activeTab === 'operation' && (
          <GqlWfTabStack
            main={(
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

                <GqlWfCodeField
                  label={queryLabel}
                  value={data.query ?? ''}
                  onChange={(value) => update({ query: value })}
                  placeholder={isMutation ? 'mutation {\n  \n}' : 'query {\n  \n}'}
                  testId="gql-wf-query-editor"
                  rows={6}
                  toolbarHint="GraphQL operation"
                  toolbarAction={(
                    <button
                      type="button"
                      className="btn btn-xs"
                      title="Import from a saved GraphQL Studio collection"
                      data-testid="gql-wf-import-collections-btn"
                      onClick={() => setShowImportPicker(true)}
                    >
                      Import…
                    </button>
                  )}
                  error={!data.query?.trim() ? <GqlWfFieldError>{queryLabel} is required</GqlWfFieldError> : undefined}
                />

                <GqlWfFormRow label="Timeout (ms)">
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={data.timeoutMs ?? 30000}
                    onChange={(e) => update({ timeoutMs: Number(e.target.value) })}
                    data-testid="gql-wf-timeout-input"
                  />
                </GqlWfFormRow>

                <GqlWfCheckboxRow
                  checked={data.skipTlsVerify ?? false}
                  onChange={(skipTlsVerify) => update({ skipTlsVerify })}
                  label="Skip TLS verify"
                  hint="Allow self-signed certificates (dev only)"
                  testId="gql-wf-skip-tls-checkbox"
                  last
                />
              </GqlWfFormCard>
            )}
            footer={<AvailableVariables hints={variableHints} dock />}
          />
        )}

        {activeTab === 'variables' && (
          <GqlWfTabStack
            main={(
              <GqlWfFormCard>
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
                      rows={6}
                      spellCheck={false}
                      data-testid="gql-wf-variables-editor"
                    />
                  </div>
                  {tabErrors.variables && <GqlWfFieldError>Variables must be valid JSON</GqlWfFieldError>}
                </GqlWfFormRow>
              </GqlWfFormCard>
            )}
            footer={<AvailableVariables hints={variableHints} dock />}
          />
        )}

        {activeTab === 'headers' && (
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
          </GqlWfFormCard>
        )}

        {activeTab === 'auth' && (
          <GqlWfFormCard>
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
            extractionMode="query"
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
            onAdd={() => update({ outputBindings: [...outputBindings, { field: 'data', variableName: '', enabled: true }] })}
              />
            </div>
          </GqlWfFormCard>
        )}
      </div>

      {showImportPicker && (
        <GraphqlImportFromCollectionModal
          nodeType={nodeType}
          onImport={(patch) => {
            update(patch);
            setShowImportPicker(false);
          }}
          onCancel={() => setShowImportPicker(false)}
        />
      )}
    </GqlWfConfigBody>
  );
}
