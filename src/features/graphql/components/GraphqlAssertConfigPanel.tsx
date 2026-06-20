/**
 * GraphqlAssertConfigPanel — workflow node config for `graphqlAssert`.
 * 3-tab layout: Source | Assertions | Behavior
 *
 * Phase 4 — Step 3 (4C-5)
 */
import { useState } from 'react';
import type {
  GraphqlAssertNodeData,
  GraphqlWorkflowAssertion,
} from '../../workflow/types/workflow';
import type { FieldOperator } from '../../../shared/types';
import type { WorkflowVariableHint } from '../../workflow/utils/workflowVariableHints';
import { useListCrud } from '../../../shared/hooks/useListCrud';
import { FIELD_OP_OPTIONS } from '../../scenarios/components/testEditorValidationConstants';
import InsertVarField from '../../workflow/components/expression/InsertVarField';
import ExpressionInput from '../../workflow/components/expression/ExpressionInput';
import AvailableVariables from '../../workflow/components/expression/AvailableVariables';
import { computeAssertTabErrors } from '../utils/graphqlPanelHelpers';
import {
  resolveRuntimeVariableValue,
  testGraphqlAssertions,
  type AssertionTestResult,
} from '../utils/graphqlConfigTestHelpers';

// ── Operators that don't need an expectedValue input ─────────────────────────

const NO_VALUE_OPS = new Set<FieldOperator>([
  'exists', 'not_exists', 'is_true', 'is_false',
  'is_null', 'is_not_null', 'is_empty', 'is_not_empty',
]);

function makeAssertionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type AssertTab = 'source' | 'assertions' | 'behavior';

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphqlAssertConfigPanel({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
  runtimeVariables,
}: {
  data: GraphqlAssertNodeData;
  onChange: (d: GraphqlAssertNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
  /** Variable snapshot from the last workflow run — powers Run test. */
  runtimeVariables?: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<AssertTab>('assertions');
  const [assertTestResults, setAssertTestResults] = useState<AssertionTestResult[] | null>(null);
  const [assertTestMessage, setAssertTestMessage] = useState<string | null>(null);

  const update = (patch: Partial<GraphqlAssertNodeData>) => onChange({ ...data, ...patch });

  const assertions = data.assertions ?? [];
  const assertCrud = useListCrud(assertions, (items) => update({ assertions: items }));

  const tabErrors = computeAssertTabErrors({
    sourceVariable: data.sourceVariable,
    assertions,
  });

  const TABS: { id: AssertTab; label: string; errorDot?: boolean; count?: number }[] = [
    { id: 'source', label: 'Source', errorDot: tabErrors.source },
    { id: 'assertions', label: 'Assertions', errorDot: tabErrors.assertions, count: assertions.length > 0 ? assertions.length : undefined },
    { id: 'behavior', label: 'Behavior' },
  ];

  const handleRunAssertTest = () => {
    const resolved = resolveRuntimeVariableValue(data.sourceVariable, runtimeVariables);
    if (!resolved.ok) {
      setAssertTestResults(null);
      setAssertTestMessage(resolved.error);
      return;
    }
    if (assertions.length === 0) {
      setAssertTestResults([]);
      setAssertTestMessage('Add at least one assertion to test.');
      return;
    }
    const results = testGraphqlAssertions(assertions, resolved.value);
    setAssertTestResults(results);
    setAssertTestMessage(null);
  };

  const assertResultById = (id: string): AssertionTestResult | undefined =>
    assertTestResults?.find((r) => r.id === id);

  return (
    <div className="wf-config-body" data-testid="gql-wf-assert-panel">
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
        {/* ── Source tab ────────────────────────────────────── */}
        {activeTab === 'source' && (
          <div>
            <div className="wf-config-field">
              <label>Source Variable</label>
              <InsertVarField
                onRequestVariableInsert={onRequestVariableInsert}
                shortRef
                onInsert={(snippet) => update({ sourceVariable: `${data.sourceVariable ?? ''}${snippet}` })}
              >
                <ExpressionInput
                  value={data.sourceVariable ?? ''}
                  onChange={(value) => update({ sourceVariable: value })}
                  placeholder="{{queryResult}} or variableName"
                  variableHints={variableHints}
                  aria-label="Source variable name"
                />
              </InsertVarField>
              {tabErrors.source && <span className="wf-config-error">Source variable is required</span>}
              <div className="wf-config-hint">
                Reference the workflow variable containing the GraphQL response to assert on.
                Typically the output of a <code>graphqlQuery</code> node bound to its <code>data</code> field.
              </div>
            </div>
            <AvailableVariables hints={variableHints} />
          </div>
        )}

        {/* ── Assertions tab ────────────────────────────────── */}
        {activeTab === 'assertions' && (
          <div>
            <div className="wf-kafka-section-title">
              Assertions
              <button
                type="button"
                className="btn btn-xs"
                onClick={handleRunAssertTest}
                data-testid="gql-wf-assert-run-test-btn"
                title="Evaluate assertions against the last run output of the source variable"
              >
                Run test
              </button>
              <button
                type="button"
                className="wf-section-add-btn"
                onClick={() =>
                  update({
                    assertions: [
                      ...assertions,
                      {
                        id: makeAssertionId(),
                        jsonPath: '$',
                        operator: 'equals',
                        expectedValue: '',
                        description: '',
                      },
                    ],
                  })
                }
                data-testid="gql-wf-assert-add-btn"
              >
                + Add
              </button>
            </div>
            {assertTestMessage && (
              <p className="gql-wf-test-banner gql-wf-test-banner--warn" role="status" data-testid="gql-wf-assert-test-msg">
                {assertTestMessage}
              </p>
            )}
            {assertTestResults && assertTestResults.length > 0 && (
              <p
                className={`gql-wf-test-banner ${assertTestResults.every((r) => r.ok) ? 'gql-wf-test-banner--pass' : 'gql-wf-test-banner--fail'}`}
                role="status"
                data-testid="gql-wf-assert-test-summary"
              >
                {assertTestResults.every((r) => r.ok)
                  ? `All ${assertTestResults.length} assertion(s) passed.`
                  : `${assertTestResults.filter((r) => !r.ok).length} of ${assertTestResults.length} assertion(s) failed.`}
              </p>
            )}
            {assertions.length === 0 && (
              <div className="wf-config-empty-hint">No assertions yet — click + Add</div>
            )}
            {assertions.map((assertion, index) => (
              <AssertionRow
                key={assertion.id}
                assertion={assertion}
                index={index}
                crud={assertCrud}
                testResult={assertResultById(assertion.id)}
              />
            ))}
          </div>
        )}

        {/* ── Behavior tab ──────────────────────────────────── */}
        {activeTab === 'behavior' && (
          <div>
            <div className="wf-config-hint" style={{ marginBottom: 12 }}>
              What should happen when one or more assertions fail?
            </div>
            <div className="wf-config-radio-group">
              <label className="wf-config-radio-row">
                <input
                  type="radio"
                  name="failBehavior"
                  value="error"
                  checked={(data.failBehavior ?? 'error') === 'error'}
                  onChange={() => update({ failBehavior: 'error' })}
                  data-testid="gql-wf-assert-fail-error"
                />
                <span>
                  <strong>Halt workflow</strong> — assertion failure stops execution as an error
                </span>
              </label>
              <label className="wf-config-radio-row">
                <input
                  type="radio"
                  name="failBehavior"
                  value="warn"
                  checked={data.failBehavior === 'warn'}
                  onChange={() => update({ failBehavior: 'warn' })}
                  data-testid="gql-wf-assert-fail-warn"
                />
                <span>
                  <strong>Continue with warning</strong> — workflow proceeds; assertion result shown as warning badge
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Assertion Row sub-component ───────────────────────────────────────────────

function AssertionRow({
  assertion,
  index,
  crud,
  testResult,
}: {
  assertion: GraphqlWorkflowAssertion;
  index: number;
  crud: ReturnType<typeof useListCrud<GraphqlWorkflowAssertion>>;
  testResult?: AssertionTestResult;
}) {
  const noValue = NO_VALUE_OPS.has(assertion.operator);
  const jsonPathErr = !assertion.jsonPath?.trim();

  return (
    <div
      className="wf-config-assert-row"
      style={{ border: '1px solid var(--border-color, #333)', borderRadius: 4, padding: 8, marginBottom: 8 }}
      data-testid="gql-wf-assert-row"
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 2 }}>
          <input
            value={assertion.jsonPath}
            onChange={(e) => crud.update(index, { jsonPath: e.target.value })}
            placeholder="$.data.user.id"
            aria-label="JSONPath expression"
            className={jsonPathErr ? 'wf-input-error' : undefined}
            data-testid="gql-wf-assert-jsonpath"
          />
          {jsonPathErr && <span className="wf-config-error">JSONPath is required</span>}
        </div>

        <select
          value={assertion.operator}
          onChange={(e) => crud.update(index, { operator: e.target.value as FieldOperator })}
          aria-label="Operator"
          style={{ flex: '0 0 auto' }}
          data-testid="gql-wf-assert-operator"
        >
          {FIELD_OP_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {!noValue && (
          <input
            value={assertion.expectedValue ?? ''}
            onChange={(e) => crud.update(index, { expectedValue: e.target.value })}
            placeholder="expected value"
            aria-label="Expected value"
            style={{ flex: 2 }}
            data-testid="gql-wf-assert-expected"
          />
        )}

        <button
          type="button"
          className="wf-kv-del-btn"
          onClick={() => crud.remove(index)}
          aria-label={`Remove assertion ${index + 1}`}
        >
          ×
        </button>
      </div>

      <div>
        <input
          value={assertion.description ?? ''}
          onChange={(e) => crud.update(index, { description: e.target.value })}
          placeholder="Description (optional)"
          aria-label="Assertion description"
          style={{ width: '100%', fontSize: '0.85em' }}
          data-testid="gql-wf-assert-description"
        />
      </div>
      {testResult && (
        <p
          className={testResult.ok ? 'gql-wf-test-inline gql-wf-test-inline--pass' : 'gql-wf-test-inline gql-wf-test-inline--fail'}
          data-testid="gql-wf-assert-test-result"
        >
          {testResult.ok ? `✓ passed (actual: ${testResult.actual})` : `✗ ${testResult.message}`}
        </p>
      )}
    </div>
  );
}
