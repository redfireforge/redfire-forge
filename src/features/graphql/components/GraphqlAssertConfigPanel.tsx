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
import {
  GqlWfConfigBody,
  GqlWfSubTabs,
  GqlWfFormCard,
  GqlWfFormRow,
  GqlWfFieldError,
  GqlWfSectionToolbar,
  type GqlWfSubTab,
} from './GraphqlWfConfigLayout';

// ── Operators that don't need an expectedValue input ─────────────────────────

const NO_VALUE_OPS = new Set<FieldOperator>([
  'exists', 'not_exists', 'is_true', 'is_false',
  'is_null', 'is_not_null', 'is_empty', 'is_not_empty',
]);

function makeAssertionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

type AssertTab = 'source' | 'assertions' | 'behavior';

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

  const TABS: GqlWfSubTab[] = [
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
    <GqlWfConfigBody testId="gql-wf-assert-panel">
      <GqlWfFormCard>
        <GqlWfFormRow label="Label" htmlFor="gql-wf-assert-label" last>
          <input
            id="gql-wf-assert-label"
            value={data.label}
            onChange={(e) => update({ label: e.target.value })}
          />
        </GqlWfFormRow>
      </GqlWfFormCard>

      <GqlWfSubTabs tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as AssertTab)} />

      <div className="wf-config-tab-content">
        {activeTab === 'source' && (
          <>
            <GqlWfFormCard>
              <GqlWfFormRow label="Source variable" stack last>
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
                    data-testid="gql-wf-assert-source-var"
                  />
                </InsertVarField>
                {tabErrors.source && <GqlWfFieldError>Source variable is required</GqlWfFieldError>}
                <p className="gql-wf-section-subtitle gql-wf-section-subtitle--inset">
                  Reference the workflow variable containing the GraphQL response to assert on.
                  Typically the output of a <code>graphqlQuery</code> node bound to its <code>data</code> field.
                </p>
              </GqlWfFormRow>
            </GqlWfFormCard>
            <AvailableVariables hints={variableHints} />
          </>
        )}

        {activeTab === 'assertions' && (
          <GqlWfFormCard>
            <div className="gql-wf-section-body gql-wf-section-body--flush-top">
              <GqlWfSectionToolbar
                title="Assertions"
                subtitle="Evaluate JSON fields from the source variable"
                actions={(
                  <>
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
                      className="btn btn-xs btn-ghost gql-wf-section-add-btn"
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
                  </>
                )}
              />

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

              {assertions.length === 0 ? (
                <div className="wf-config-empty-hint">No assertions yet — click + Add</div>
              ) : (
                <div className="gql-wf-assert-list">
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
            </div>
          </GqlWfFormCard>
        )}

        {activeTab === 'behavior' && (
          <GqlWfFormCard>
            <div className="gql-wf-section-body">
              <p className="gql-wf-section-intro">What should happen when one or more assertions fail?</p>
              <div className="gql-wf-behavior-options">
                <label className="gql-wf-behavior-option">
                  <input
                    type="radio"
                    name="failBehavior"
                    value="error"
                    checked={(data.failBehavior ?? 'error') === 'error'}
                    onChange={() => update({ failBehavior: 'error' })}
                    data-testid="gql-wf-assert-fail-error"
                  />
                  <span className="gql-wf-behavior-option-body">
                    <strong>Halt workflow</strong>
                    <span>Assertion failure stops execution as an error</span>
                  </span>
                </label>
                <label className="gql-wf-behavior-option">
                  <input
                    type="radio"
                    name="failBehavior"
                    value="warn"
                    checked={data.failBehavior === 'warn'}
                    onChange={() => update({ failBehavior: 'warn' })}
                    data-testid="gql-wf-assert-fail-warn"
                  />
                  <span className="gql-wf-behavior-option-body">
                    <strong>Continue with warning</strong>
                    <span>Workflow proceeds; assertion result shown as a warning badge</span>
                  </span>
                </label>
              </div>
            </div>
          </GqlWfFormCard>
        )}
      </div>
    </GqlWfConfigBody>
  );
}

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
    <article className="gql-wf-assert-card" data-testid="gql-wf-assert-row">
      <div className="gql-wf-assert-card-head">
        <span className="gql-wf-assert-card-index">Rule {index + 1}</span>
        <button
          type="button"
          className="gql-wf-assert-remove-btn"
          onClick={() => crud.remove(index)}
          aria-label={`Remove assertion ${index + 1}`}
        >
          Remove
        </button>
      </div>

      <div className={`gql-wf-assert-card-grid${noValue ? ' gql-wf-assert-card-grid--no-value' : ''}`}>
        <label className="gql-wf-assert-field">
          <span className="gql-wf-assert-field-label">JSONPath</span>
          <input
            value={assertion.jsonPath}
            onChange={(e) => crud.update(index, { jsonPath: e.target.value })}
            placeholder="$.data.user.id"
            aria-label="JSONPath expression"
            className={jsonPathErr ? 'wf-input-error' : undefined}
            data-testid="gql-wf-assert-jsonpath"
          />
          {jsonPathErr && <GqlWfFieldError>JSONPath is required</GqlWfFieldError>}
        </label>

        <label className="gql-wf-assert-field gql-wf-assert-field--operator">
          <span className="gql-wf-assert-field-label">Operator</span>
          <select
            value={assertion.operator}
            onChange={(e) => crud.update(index, { operator: e.target.value as FieldOperator })}
            aria-label="Operator"
            data-testid="gql-wf-assert-operator"
          >
            {FIELD_OP_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {!noValue && (
          <label className="gql-wf-assert-field">
            <span className="gql-wf-assert-field-label">Expected value</span>
            <input
              value={assertion.expectedValue ?? ''}
              onChange={(e) => crud.update(index, { expectedValue: e.target.value })}
              placeholder="expected value"
              aria-label="Expected value"
              data-testid="gql-wf-assert-expected"
            />
          </label>
        )}
      </div>

      <label className="gql-wf-assert-field gql-wf-assert-field--full">
        <span className="gql-wf-assert-field-label">Description</span>
        <input
          value={assertion.description ?? ''}
          onChange={(e) => crud.update(index, { description: e.target.value })}
          placeholder="Optional — shown in run history"
          aria-label="Assertion description"
          data-testid="gql-wf-assert-description"
        />
      </label>

      {testResult && (
        <p
          className={testResult.ok ? 'gql-wf-test-inline gql-wf-test-inline--pass' : 'gql-wf-test-inline gql-wf-test-inline--fail'}
          data-testid="gql-wf-assert-test-result"
        >
          {testResult.ok ? `✓ passed (actual: ${testResult.actual})` : `✗ ${testResult.message}`}
        </p>
      )}
    </article>
  );
}
