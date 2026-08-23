import { v4 as uuid } from 'uuid';
import type { SetVariableNodeData } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '@shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';

export default function SetVariableConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: SetVariableNodeData;
  onChange: (d: SetVariableNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const assignments = data.assignments ?? [];
  const { update: updateAssignment, remove: removeAssignment, move: moveAssignment } = useListCrud(
    assignments,
    (items) => onChange({ ...data, assignments: items }),
  );

  const addAssignment = () => {
    const id = uuid().slice(0, 8);
    onChange({ ...data, assignments: [...assignments, { id, name: '', expression: '' }] });
  };

  return (
    <div className="wf-config-body wf-setvar-config" data-testid="set-variable-config">
      <KafkaCard
        title="Set Variable"
        hint="Write workflow variables from literals or expressions."
      >
        <div className="wf-kafka-form wf-kafka-form--setvar">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              aria-label="Set Variable label"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Assignments"
        hint="Each row sets name = value for downstream steps."
        action={<KafkaAddButton label="+ Add Assignment" onClick={addAssignment} />}
      >
        {assignments.length === 0 ? (
          <KafkaEmptyState
            title="No assignments yet"
            text="Use + Add Assignment to define a variable name and value."
          />
        ) : (
          <div className="wf-setvar-assignments-panel">
            <div className="wf-setvar-assignments-header" aria-hidden="true">
              <span className="wf-setvar-col-idx">#</span>
              <span className="wf-setvar-col-name">Variable</span>
              <span className="wf-setvar-col-eq" />
              <span className="wf-setvar-col-expr">Value</span>
              <span className="wf-setvar-col-actions" />
            </div>
            <div className="wf-setvar-assignments-list">
              {assignments.map((a, i) => (
                <div key={a.id} className="wf-setvar-assignment-row">
                  <span className="wf-setvar-assignment-idx" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="wf-setvar-col-name">
                    <input
                      className="wf-kafka-form-input wf-kafka-form-input--mono"
                      value={a.name}
                      onChange={(e) => updateAssignment(i, { name: e.target.value })}
                      placeholder="Variable name"
                      aria-label={`Assignment ${i + 1} variable name`}
                    />
                  </div>
                  <span className="wf-setvar-assignment-eq" aria-hidden="true">
                    =
                  </span>
                  <div className="wf-setvar-col-expr">
                    <InsertVarField
                      onRequestVariableInsert={onRequestVariableInsert}
                      shortRef
                      onInsert={(snippet) =>
                        updateAssignment(i, { expression: a.expression + snippet })
                      }
                    >
                      <ExpressionInput
                        className="wf-kafka-form-input wf-kafka-form-input--mono"
                        value={a.expression}
                        onChange={(val) => updateAssignment(i, { expression: val })}
                        placeholder="Value / {{expression}}"
                        variableHints={variableHints}
                        aria-label={`Assignment ${i + 1} value`}
                      />
                    </InsertVarField>
                  </div>
                  <div className="wf-setvar-assignment-actions">
                    <button
                      type="button"
                      className="wf-setvar-assignment-btn"
                      disabled={i === 0}
                      onClick={() => moveAssignment(i, -1)}
                      title="Move up"
                      aria-label={`Move assignment ${i + 1} up`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="wf-setvar-assignment-btn"
                      disabled={i === assignments.length - 1}
                      onClick={() => moveAssignment(i, 1)}
                      title="Move down"
                      aria-label={`Move assignment ${i + 1} down`}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      className="wf-setvar-assignment-btn wf-setvar-assignment-btn--del"
                      onClick={() => removeAssignment(i)}
                      title="Remove"
                      aria-label={`Remove assignment ${i + 1}`}
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
          Assignments run top to bottom. Later rows can reference variables set above. Use{' '}
          <code>{'{{variable}}'}</code> or expression functions in the value field.
        </p>
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
