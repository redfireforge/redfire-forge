/**
 * GraphqlSubscriptionAssertionPanel.tsx — Sprint 8 (2C-5)
 *
 * Assertion panel for subscription operations.
 *
 * Renders below the subscription query editor (in the left pane) when the
 * active operation type is 'subscription'. Users define JSONPath assertions that
 * are evaluated against every incoming subscription message in real time.
 *
 * Layout follows the Kafka / Auth two-tone form:
 *   one surface card, darker index column, single-border controls on --bg.
 */

import { useCallback, useState } from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { GraphqlSubscriptionAssertion } from '@shared/types/graphql';
import { ASSERTION_OPERATORS, isNoValueOperator } from '../utils/subscriptionAssertions';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GraphqlSubscriptionAssertionPanelProps {
  assertions: GraphqlSubscriptionAssertion[];
  onChange: (assertions: GraphqlSubscriptionAssertion[]) => void;
}

// ─── ID generator ────────────────────────────────────────────────────────────

let assertionSeq = 1;
function makeAssertionId(): string {
  return `gql-assert-${assertionSeq++}`;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

function makeBlankAssertion(): GraphqlSubscriptionAssertion {
  return {
    id:          makeAssertionId(),
    jsonPath:    '$',
    operator:    'is_not_null',
    expected:    '',
    description: '',
  };
}

// ─── Assertion Row ────────────────────────────────────────────────────────────

interface AssertionRowProps {
  assertion: GraphqlSubscriptionAssertion;
  index: number;
  onUpdate: (updated: GraphqlSubscriptionAssertion) => void;
  onDelete: () => void;
}

function AssertionRow({ assertion, index, onUpdate, onDelete }: AssertionRowProps) {
  const noValue = isNoValueOperator(assertion.operator);

  const handleField = useCallback(
    <K extends keyof GraphqlSubscriptionAssertion>(key: K, value: GraphqlSubscriptionAssertion[K]) => {
      onUpdate({ ...assertion, [key]: value });
    },
    [assertion, onUpdate],
  );

  return (
    <div className="gql-assert-row" data-testid="gql-assertion-row">
      <div className="gql-assert-index" aria-hidden="true">{index + 1}</div>

      <div className="gql-assert-controls">
        <input
          type="text"
          className="gql-assert-input gql-assert-jsonpath"
          value={assertion.jsonPath}
          onChange={(e) => handleField('jsonPath', e.target.value)}
          placeholder="$.field.path"
          aria-label={`Assertion ${index + 1} JSONPath`}
          spellCheck={false}
          data-testid="gql-assertion-jsonpath"
        />

        <CustomSelect
          className="gql-assert-select"
          value={assertion.operator}
          onChange={(v) => handleField('operator', v)}
          options={ASSERTION_OPERATORS.map((op) => ({ value: op.value, label: op.label }))}
          aria-label={`Assertion ${index + 1} operator`}
          data-testid="gql-assertion-operator"
        />

        {!noValue && (
          <input
            type="text"
            className="gql-assert-input gql-assert-expected"
            value={typeof assertion.expected === 'string' ? assertion.expected : String(assertion.expected ?? '')}
            onChange={(e) => handleField('expected', e.target.value)}
            placeholder="Expected value"
            aria-label={`Assertion ${index + 1} expected value`}
            data-testid="gql-assertion-expected"
          />
        )}

        <button
          type="button"
          className="gql-assert-delete"
          onClick={onDelete}
          aria-label={`Delete assertion ${index + 1}`}
          title="Delete assertion"
          data-testid="gql-assertion-delete"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GraphqlSubscriptionAssertionPanel({
  assertions,
  onChange,
}: GraphqlSubscriptionAssertionPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const handleAdd = useCallback(() => {
    onChange([...assertions, makeBlankAssertion()]);
    setExpanded(true);
  }, [assertions, onChange]);

  const handleUpdate = useCallback(
    (index: number, updated: GraphqlSubscriptionAssertion) => {
      const next = [...assertions];
      next[index] = updated;
      onChange(next);
    },
    [assertions, onChange],
  );

  const handleDelete = useCallback(
    (index: number) => {
      onChange(assertions.filter((_, i) => i !== index));
    },
    [assertions, onChange],
  );

  return (
    <div className="gql-assertion-panel" data-testid="gql-assertion-panel">
      <div className="gql-assertion-header">
        <button
          type="button"
          className="gql-assertion-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="gql-assertion-body"
          data-testid="gql-assertion-toggle"
        >
          <svg
            className={`gql-assertion-chevron${expanded ? '' : ' gql-assertion-chevron--collapsed'}`}
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="gql-assertion-header-label">Assertions</span>
          {assertions.length > 0 && (
            <span className="gql-assertion-count-badge" aria-label={`${assertions.length} assertion${assertions.length !== 1 ? 's' : ''}`}>
              {assertions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className="gql-assertion-add-btn"
          onClick={handleAdd}
          aria-label="Add assertion"
          title="Add assertion"
          data-testid="gql-assertion-add-btn"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </div>

      <div id="gql-assertion-body" className="gql-assertion-body" hidden={!expanded}>
        {assertions.length === 0 ? (
          <div className="gql-assertion-empty" data-testid="gql-assertion-empty">
            <p className="gql-assertion-empty-title">No assertions yet</p>
            <p className="gql-assertion-empty-text">
              Click <strong>Add</strong> to define a JSONPath rule evaluated against each incoming message.
            </p>
          </div>
        ) : (
          <>
            <div className="gql-assertion-fields">
              {assertions.map((a, i) => (
                <AssertionRow
                  key={a.id}
                  assertion={a}
                  index={i}
                  onUpdate={(updated) => handleUpdate(i, updated)}
                  onDelete={() => handleDelete(i)}
                />
              ))}
            </div>
            <p className="gql-assertion-hint">Evaluated on every subscription message</p>
          </>
        )}
      </div>
    </div>
  );
}
