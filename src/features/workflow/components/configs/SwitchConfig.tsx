import { v4 as uuidv4 } from 'uuid';
import type { SwitchNodeData, SwitchCase } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';

export default function SwitchConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: SwitchNodeData;
  onChange: (d: SwitchNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const cases = data.cases ?? [];
  const { update: updateCaseByIdx, remove: removeCaseByIdx, move: moveCase } = useListCrud(
    cases,
    (items) => onChange({ ...data, cases: items }),
  );

  const addCase = () => {
    const newCase: SwitchCase = { id: uuidv4().slice(0, 8), value: '', label: '' };
    onChange({ ...data, cases: [...cases, newCase] });
  };

  return (
    <div className="wf-config-body wf-switch-config" data-testid="switch-config">
      <KafkaCard
        title="Switch"
        hint="Evaluate an expression and route to the first matching case."
      >
        <div className="wf-kafka-form wf-kafka-form--switch">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              aria-label="Switch label"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Expression" hint="Value compared to cases" compact>
            <InsertVarField
              onRequestVariableInsert={onRequestVariableInsert}
              shortRef
              onInsert={(snippet) => onChange({ ...data, expression: data.expression + snippet })}
            >
              <ExpressionInput
                value={data.expression}
                onChange={(val) => onChange({ ...data, expression: val })}
                placeholder="e.g. {{status}} or {{category}}"
                variableHints={variableHints}
                aria-label="Switch expression"
              />
            </InsertVarField>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Cases"
        hint="First match wins. Unmatched values take the Default path."
        action={<KafkaAddButton label="+ Add Case" onClick={addCase} />}
      >
        {cases.length === 0 ? (
          <KafkaEmptyState
            title="No cases yet"
            text="Use + Add Case to create an output handle. Until then, every run follows Default."
          />
        ) : (
          <div className="wf-switch-cases-panel">
            <div className="wf-switch-cases-header" aria-hidden="true">
              <span className="wf-switch-col-idx">#</span>
              <span className="wf-switch-col-value">Match value</span>
              <span className="wf-switch-col-label">Handle label</span>
              <span className="wf-switch-col-actions" />
            </div>
            <div className="wf-switch-cases-list">
              {cases.map((c, i) => (
                <div key={c.id} className="wf-switch-case-row">
                  <span className="wf-switch-case-idx" aria-hidden="true">{i + 1}</span>
                  <div className="wf-switch-col-value">
                    <input
                      className="wf-kafka-form-input wf-kafka-form-input--mono"
                      value={c.value}
                      onChange={(e) => updateCaseByIdx(i, { value: e.target.value })}
                      placeholder="Match value"
                      aria-label={`Case ${i + 1} match value`}
                    />
                  </div>
                  <div className="wf-switch-col-label">
                    <input
                      className="wf-kafka-form-input"
                      value={c.label ?? ''}
                      onChange={(e) => updateCaseByIdx(i, { label: e.target.value })}
                      placeholder="Optional"
                      aria-label={`Case ${i + 1} label`}
                    />
                  </div>
                  <div className="wf-switch-case-actions">
                    <button
                      type="button"
                      className="wf-switch-case-btn"
                      onClick={() => moveCase(i, -1)}
                      disabled={i === 0}
                      title="Move up"
                      aria-label={`Move case ${i + 1} up`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="wf-switch-case-btn"
                      onClick={() => moveCase(i, 1)}
                      disabled={i === cases.length - 1}
                      title="Move down"
                      aria-label={`Move case ${i + 1} down`}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      className="wf-switch-case-btn wf-switch-case-btn--del"
                      onClick={() => removeCaseByIdx(i)}
                      title="Remove case"
                      aria-label={`Remove case ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </KafkaCard>

      <div className="wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <p className="wf-config-hint">
          The <strong>Expression</strong> is evaluated at runtime and compared against each case value
          in order. The first match routes to that case&apos;s output handle.
          If no case matches, the <strong>Default</strong> path is taken.
        </p>
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
