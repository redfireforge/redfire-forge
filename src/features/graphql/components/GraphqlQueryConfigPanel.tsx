/**
 * GraphqlQueryConfigPanel — workflow node config for `graphqlQuery` and `graphqlMutation`.
 * 6-tab layout: Operation | Variables | Headers | Auth | Extraction | Output
 *
 * Phase 4 — Step 3 (4C-1, 4C-2)
 */
import { useState } from 'react';
import type {
  GraphqlQueryNodeData,
  GraphqlNodeHeaderRow,
  GraphqlExtractionRule,
  GraphqlOutputBinding,
  NodeRunStatus,
} from '../../workflow/types/workflow';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import type { WorkflowVariableHint } from '../../workflow/utils/workflowVariableHints';
import { useListCrud } from '../../../shared/hooks/useListCrud';
import InsertVarField from '../../workflow/components/expression/InsertVarField';
import ExpressionInput from '../../workflow/components/expression/ExpressionInput';
import AvailableVariables from '../../workflow/components/expression/AvailableVariables';
import GraphqlImportFromCollectionModal from './GraphqlImportFromCollectionModal';
import { isValidIdentifier, computeQueryTabErrors } from '../utils/graphqlPanelHelpers';
import {
  getExtractionTestRoot,
  hasGraphqlRunData,
  parseGraphqlRunSnapshot,
  testGraphqlExtractionRules,
  type ExtractionTestResult,
} from '../utils/graphqlConfigTestHelpers';

// ── Output field options ──────────────────────────────────────────────────────

const OUTPUT_FIELD_OPTIONS: GraphqlOutputBinding['field'][] = [
  'data', 'errors', 'latencyMs', 'httpStatus', 'operationName',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
// isValidIdentifier and isValidJson live in ../utils/graphqlPanelHelpers
// and are imported above. They are not re-exported here to satisfy
// react-refresh/only-export-components (non-component exports must be in separate files).

function makeHeaderId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Sub-sections (exported for reuse in other GraphQL config panels) ──────────

export interface GqlHeadersSectionProps {
  headers: GraphqlNodeHeaderRow[];
  headerCrud: ReturnType<typeof useListCrud<GraphqlNodeHeaderRow>>;
  onAdd: () => void;
  variableHints: WorkflowVariableHint[];
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
}

export function GqlHeadersSection({
  headers,
  headerCrud,
  onAdd,
  variableHints,
  onRequestVariableInsert,
}: GqlHeadersSectionProps) {
  return (
    <div data-testid="gql-wf-headers-section">
      <div className="wf-kafka-section-title">
        Headers
        <button type="button" className="wf-section-add-btn" onClick={onAdd} data-testid="gql-wf-headers-add-btn">
          + Add
        </button>
      </div>
      {headers.length > 0 && (
        <div className="wf-config-kv-col-headers">
          <span className="wf-kv-col-toggle">On</span>
          <span className="wf-kv-col-fill">Key</span>
          <span className="wf-kv-col-fill">Value</span>
          <span className="wf-kv-col-del" />
        </div>
      )}
      <div className="wf-config-kv-list">
        {headers.map((row, index) => (
          <div key={row.id} className="wf-config-kv-row">
            <div className="wf-kv-toggle">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => headerCrud.update(index, { enabled: e.target.checked })}
                aria-label={`Enable header ${row.key || index + 1}`}
              />
            </div>
            <input
              value={row.key}
              placeholder="Header name"
              onChange={(e) => headerCrud.update(index, { key: e.target.value })}
              data-testid="gql-wf-header-key"
            />
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => headerCrud.update(index, { value: `${row.value}${snippet}` })}
            >
              <ExpressionInput
                value={row.value}
                onChange={(value) => headerCrud.update(index, { value })}
                placeholder="value"
                variableHints={variableHints}
              />
            </InsertVarField>
            <button
              type="button"
              className="wf-kv-del-btn"
              onClick={() => headerCrud.remove(index)}
              aria-label={`Remove header ${row.key || index + 1}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {headers.length === 0 && (
        <div className="wf-config-empty-hint">No headers yet — click + Add</div>
      )}
    </div>
  );
}

export function GqlAuthSection({
  auth,
  onChange,
  variableHints,
  onRequestVariableInsert,
}: {
  auth?: GraphqlAuth;
  onChange: (auth: GraphqlAuth | undefined) => void;
  variableHints: WorkflowVariableHint[];
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
}) {
  const type = auth?.type ?? 'none';
  const update = (patch: Partial<GraphqlAuth>) =>
    onChange({ ...(auth ?? {}), type: type as GraphqlAuth['type'], ...patch } as GraphqlAuth);

  const setType = (newType: string) => {
    if (newType === 'none') { onChange(undefined); return; }
    onChange({ ...(auth ?? {}), type: newType as GraphqlAuth['type'] });
  };

  return (
    <div data-testid="gql-wf-auth-section">
      <div className="wf-config-field--row">
        <label>Auth type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} data-testid="gql-wf-auth-type-select">
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apiKey">API Key</option>
          <option value="custom">Custom Header</option>
          {/* oauth2 is defined in GraphqlAuth but not yet supported in the workflow panel */}
          {type === 'oauth2' && <option value="oauth2" disabled>OAuth 2.0 (not yet supported)</option>}
        </select>
      </div>

      {type === 'bearer' && (
        <div className="wf-config-field--row">
          <label>Token</label>
          <InsertVarField
            onRequestVariableInsert={onRequestVariableInsert}
            shortRef
            onInsert={(snippet) => update({ token: `${auth?.token ?? ''}${snippet}` })}
          >
            <ExpressionInput
              value={auth?.token ?? ''}
              onChange={(value) => update({ token: value })}
              placeholder="{{authToken}}"
              variableHints={variableHints}
            />
          </InsertVarField>
        </div>
      )}

      {type === 'basic' && (
        <>
          <div className="wf-config-field--row">
            <label>Username</label>
            <ExpressionInput
              value={auth?.username ?? ''}
              onChange={(value) => update({ username: value })}
              placeholder="user"
              variableHints={variableHints}
            />
          </div>
          <div className="wf-config-field--row">
            <label>Password</label>
            <input
              type="password"
              value={auth?.password ?? ''}
              onChange={(e) => update({ password: e.target.value })}
              placeholder="••••"
              data-testid="gql-wf-auth-password"
            />
          </div>
        </>
      )}

      {(type === 'apiKey' || type === 'custom') && (
        <>
          <div className="wf-config-field--row">
            <label>Header name</label>
            <input
              value={auth?.headerName ?? ''}
              onChange={(e) => update({ headerName: e.target.value })}
              placeholder={type === 'apiKey' ? 'X-API-Key' : 'X-Custom-Header'}
              data-testid="gql-wf-auth-header-name"
            />
          </div>
          <div className="wf-config-field--row">
            <label>Header value</label>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => update({ headerValue: `${auth?.headerValue ?? ''}${snippet}` })}
            >
              <ExpressionInput
                value={auth?.headerValue ?? ''}
                onChange={(value) => update({ headerValue: value })}
                placeholder="{{apiKey}}"
                variableHints={variableHints}
              />
            </InsertVarField>
          </div>
        </>
      )}
    </div>
  );
}

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

  return (
    <div data-testid="gql-wf-extraction-table">
      <div className="wf-kafka-section-title">
        Extraction Rules
        <button
          type="button"
          className="btn btn-xs"
          onClick={handleTest}
          data-testid="gql-wf-extraction-test-btn"
          title="Test extraction rules against the last run response"
        >
          Test
        </button>
        <button type="button" className="wf-section-add-btn" onClick={onAdd} data-testid="gql-wf-extraction-add-btn">
          + Add
        </button>
      </div>
      <div className="wf-config-hint">
        Each rule applies a JSONPath to the response <code>data</code> object and stores the result as a workflow variable.
      </div>
      {testMessage && (
        <p className="gql-wf-test-banner gql-wf-test-banner--warn" role="status" data-testid="gql-wf-extraction-test-msg">
          {testMessage}
        </p>
      )}
      {testResults && testResults.length > 0 && (
        <p
          className={`gql-wf-test-banner ${testResults.every((r) => r.ok) ? 'gql-wf-test-banner--pass' : 'gql-wf-test-banner--fail'}`}
          role="status"
          data-testid="gql-wf-extraction-test-summary"
        >
          {testResults.every((r) => r.ok)
            ? `All ${testResults.length} extraction rule(s) matched.`
            : `${testResults.filter((r) => !r.ok).length} of ${testResults.length} rule(s) failed.`}
        </p>
      )}
      {rules.length === 0 && (
        <div className="wf-config-empty-hint">No extraction rules yet — click + Add</div>
      )}
      {rules.map((rule, index) => {
        const nameErr = rule.variableName.trim() !== '' && !isValidIdentifier(rule.variableName);
        const testResult = resultByIndex(index);
        return (
          <div key={index} className="wf-config-kv-row" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <input
                value={rule.jsonPath}
                onChange={(e) => crud.update(index, { jsonPath: e.target.value })}
                placeholder="$.user.id"
                aria-label="JSONPath expression"
                data-testid="gql-wf-extraction-jsonpath"
              />
            </div>
            <span style={{ padding: '4px 6px', color: 'var(--text-muted, #888)' }}>→</span>
            <div style={{ flex: 1 }}>
              <input
                value={rule.variableName}
                onChange={(e) => crud.update(index, { variableName: e.target.value })}
                placeholder="userId"
                aria-label="Variable name"
                data-testid="gql-wf-extraction-varname"
                className={nameErr ? 'wf-input-error' : undefined}
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
            <button
              type="button"
              className="wf-kv-del-btn"
              onClick={() => crud.remove(index)}
              aria-label={`Remove extraction rule ${index + 1}`}
            >
              ×
            </button>
          </div>
        );
      })}
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
    <div data-testid="gql-wf-output-table">
      <div className="wf-kafka-section-title">
        Output Bindings
        <button type="button" className="wf-section-add-btn" onClick={onAdd} data-testid="gql-wf-output-add-btn">
          + Add
        </button>
      </div>
      <div className="wf-config-hint">
        Bind response fields to workflow variables for downstream nodes.
      </div>
      {bindings.length === 0 && (
        <div className="wf-config-empty-hint">No output bindings yet — click + Add</div>
      )}
      {bindings.map((binding, index) => {
        const nameErr = binding.variableName.trim() !== '' && !isValidIdentifier(binding.variableName);
        return (
          <div key={index} className="wf-config-kv-row" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
            <div className="wf-kv-toggle">
              <input
                type="checkbox"
                checked={binding.enabled}
                onChange={(e) => crud.update(index, { enabled: e.target.checked })}
                aria-label={`Enable binding ${binding.field}`}
              />
            </div>
            <select
              value={binding.field}
              onChange={(e) => crud.update(index, { field: e.target.value })}
              data-testid="gql-wf-output-field-select"
            >
              {fieldOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <span style={{ padding: '4px 6px', color: 'var(--text-muted, #888)' }}>→</span>
            <div style={{ flex: 1 }}>
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
            <button
              type="button"
              className="wf-kv-del-btn"
              onClick={() => crud.remove(index)}
              aria-label={`Remove binding ${index + 1}`}
            >
              ×
            </button>
          </div>
        );
      })}
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

  const TABS: { id: QueryTab; label: string; errorDot?: boolean; count?: number }[] = [
    { id: 'operation', label: 'Operation', errorDot: tabErrors.operation },
    { id: 'variables', label: 'Variables', errorDot: tabErrors.variables },
    { id: 'headers', label: 'Headers', count: headers.filter((h) => h.key.trim()).length || undefined },
    { id: 'auth', label: 'Auth' },
    { id: 'extraction', label: 'Extraction', errorDot: tabErrors.extraction, count: extractionRules.length > 0 ? extractionRules.length : undefined },
    { id: 'output', label: 'Output', errorDot: tabErrors.output, count: outputBindings.filter((b) => b.enabled).length > 0 ? outputBindings.filter((b) => b.enabled).length : undefined },
  ];

  return (
    <div
      className="wf-config-body"
      data-testid={isMutation ? 'gql-wf-mutation-panel' : 'gql-wf-query-panel'}
    >
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
        {activeTab === 'operation' && (
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

            <div className="wf-config-field">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <label style={{ margin: 0 }}>{isMutation ? 'Mutation' : 'Query'}</label>
                <button
                  type="button"
                  className="btn btn-xs"
                  title="Import from a saved GraphQL Studio collection"
                  data-testid="gql-wf-import-collections-btn"
                  onClick={() => setShowImportPicker(true)}
                >
                  Import…
                </button>
              </div>
              <textarea
                className="wf-config-code-editor"
                value={data.query ?? ''}
                onChange={(e) => update({ query: e.target.value })}
                placeholder={isMutation ? 'mutation {\n  \n}' : 'query {\n  \n}'}
                rows={8}
                spellCheck={false}
                data-testid="gql-wf-query-editor"
              />
              {!data.query?.trim() && <span className="wf-config-error">{isMutation ? 'Mutation' : 'Query'} is required</span>}
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
                  data-testid="gql-wf-timeout-input"
                />
              </div>
              <div className="wf-config-field--row">
                <label>
                  <input
                    type="checkbox"
                    checked={data.skipTlsVerify ?? false}
                    onChange={(e) => update({ skipTlsVerify: e.target.checked })}
                    data-testid="gql-wf-skip-tls-checkbox"
                  />
                  {' '}Skip TLS verify
                </label>
              </div>
            </div>
            <AvailableVariables hints={variableHints} />
          </div>
        )}

        {activeTab === 'variables' && (
          <div>
            <div className="wf-config-field">
              <label>Variables <span className="wf-config-hint-inline">(JSON; {'{{var}}'} supported)</span></label>
              <textarea
                className="wf-config-code-editor"
                value={data.variables ?? '{}'}
                onChange={(e) => update({ variables: e.target.value })}
                placeholder="{}"
                rows={6}
                spellCheck={false}
                data-testid="gql-wf-variables-editor"
              />
              {tabErrors.variables && <span className="wf-config-error">Variables must be valid JSON</span>}
            </div>
            <AvailableVariables hints={variableHints} />
          </div>
        )}

        {activeTab === 'headers' && (
          <GqlHeadersSection
            headers={headers}
            headerCrud={headerCrud}
            onAdd={() => update({ headers: [...headers, { id: makeHeaderId(), key: '', value: '', enabled: true }] })}
            variableHints={variableHints}
            onRequestVariableInsert={onRequestVariableInsert}
          />
        )}

        {activeTab === 'auth' && (
          <GqlAuthSection
            auth={data.auth}
            onChange={(auth) => update({ auth })}
            variableHints={variableHints}
            onRequestVariableInsert={onRequestVariableInsert}
          />
        )}

        {activeTab === 'extraction' && (
          <GqlExtractionSection
            rules={extractionRules}
            crud={extractionCrud}
            onAdd={() => update({ extractionRules: [...extractionRules, { variableName: '', jsonPath: '' }] })}
            nodeRunStatus={nodeRunStatus}
            extractionMode="query"
          />
        )}

        {activeTab === 'output' && (
          <GqlOutputSection
            bindings={outputBindings as GqlOutputBinding[]}
            fieldOptions={OUTPUT_FIELD_OPTIONS as string[]}
            crud={outputCrud as ReturnType<typeof useListCrud<GqlOutputBinding>>}
            onAdd={() => update({ outputBindings: [...outputBindings, { field: 'data', variableName: '', enabled: true }] })}
          />
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
    </div>
  );
}
