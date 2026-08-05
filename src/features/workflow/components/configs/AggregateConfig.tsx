import { v4 as uuid } from 'uuid';
import type { AggregateNodeData, AggregateStrategy } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { useListCrud } from '../../../../shared/hooks/useListCrud';
import InsertVarField from '../expression/InsertVarField';
import ExpressionInput from '../expression/ExpressionInput';
import AvailableVariables from '../expression/AvailableVariables';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';

const STRATEGY_OPTIONS: { value: AggregateStrategy; label: string; desc: string }[] = [
  { value: 'concat', label: 'Concat', desc: 'Join all values into a JSON array' },
  { value: 'first', label: 'First', desc: 'Keep only the first value' },
  { value: 'last', label: 'Last', desc: 'Keep only the last value' },
  { value: 'count', label: 'Count', desc: 'Count of collected values' },
  { value: 'sum', label: 'Sum', desc: 'Sum of numeric values' },
  { value: 'custom', label: 'Custom', desc: 'Custom JSONPath expression' },
];

export default function AggregateConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: AggregateNodeData;
  onChange: (d: AggregateNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  const mappings = data.mappings ?? [];
  const { update: updateMapping, remove: removeMapping, move: moveMapping } = useListCrud(
    mappings,
    (items) => onChange({ ...data, mappings: items }),
  );

  const addMapping = () => {
    const id = uuid().slice(0, 8);
    onChange({
      ...data,
      mappings: [
        ...mappings,
        { id, sourceExpression: '', targetVariable: '', strategy: 'concat' },
      ],
    });
  };

  return (
    <div className="wf-config-body wf-aggregate-config" data-testid="aggregate-config">
      <KafkaCard
        title="Aggregate"
        hint="Collect values across loop iterations into target variables."
      >
        <div className="wf-kafka-form wf-kafka-form--aggregate">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              aria-label="Aggregate label"
            />
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Mappings"
        hint="Map a source expression to a target variable with an aggregate strategy."
        action={<KafkaAddButton label="+ Add Mapping" onClick={addMapping} />}
      >
        {mappings.length === 0 ? (
          <KafkaEmptyState
            title="No mappings yet"
            text="Use + Add Mapping to define source → target aggregation."
          />
        ) : (
          <div className="wf-aggregate-mappings-list">
            {mappings.map((m, i) => (
              <div key={m.id} className="wf-aggregate-mapping-row">
                <div className="wf-aggregate-mapping-main">
                  <span className="wf-aggregate-mapping-idx" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="wf-aggregate-mapping-fields">
                    <InsertVarField
                      onRequestVariableInsert={onRequestVariableInsert}
                      shortRef
                      onInsert={(snippet) =>
                        updateMapping(i, { sourceExpression: m.sourceExpression + snippet })
                      }
                    >
                      <ExpressionInput
                        className="wf-kafka-form-input wf-kafka-form-input--mono wf-aggregate-mapping-source"
                        value={m.sourceExpression}
                        onChange={(val) => updateMapping(i, { sourceExpression: val })}
                        placeholder="Source {{variable}}"
                        variableHints={variableHints}
                        aria-label={`Mapping ${i + 1} source`}
                      />
                    </InsertVarField>
                    <span className="wf-aggregate-mapping-arrow" aria-hidden="true">
                      →
                    </span>
                    <input
                      className="wf-kafka-form-input wf-kafka-form-input--mono wf-aggregate-mapping-target"
                      value={m.targetVariable}
                      onChange={(e) => updateMapping(i, { targetVariable: e.target.value })}
                      placeholder="Target variable"
                      aria-label={`Mapping ${i + 1} target`}
                    />
                  </div>
                  <div className="wf-aggregate-mapping-actions">
                    <button
                      type="button"
                      className="wf-aggregate-mapping-btn"
                      disabled={i === 0}
                      onClick={() => moveMapping(i, -1)}
                      title="Move up"
                      aria-label={`Move mapping ${i + 1} up`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="wf-aggregate-mapping-btn"
                      disabled={i === mappings.length - 1}
                      onClick={() => moveMapping(i, 1)}
                      title="Move down"
                      aria-label={`Move mapping ${i + 1} down`}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      className="wf-aggregate-mapping-btn wf-aggregate-mapping-btn--del"
                      onClick={() => removeMapping(i)}
                      title="Remove"
                      aria-label={`Remove mapping ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="wf-aggregate-mapping-strategy-row">
                  <span className="wf-aggregate-strategy-label">Strategy</span>
                  <CustomSelect
                    className="wf-aggregate-mapping-strategy"
                    value={m.strategy}
                    onChange={(v) => updateMapping(i, { strategy: v as AggregateStrategy })}
                    options={STRATEGY_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                      detail: o.desc,
                    }))}
                    menuMinWidth={360}
                    aria-label={`Mapping ${i + 1} strategy`}
                  />
                  {m.strategy === 'custom' && (
                    <input
                      className="wf-kafka-form-input wf-kafka-form-input--mono wf-aggregate-mapping-custom"
                      value={m.customExpression ?? ''}
                      onChange={(e) => updateMapping(i, { customExpression: e.target.value })}
                      placeholder="Custom expression"
                      aria-label={`Mapping ${i + 1} custom expression`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </KafkaCard>

      <div className="wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <p className="wf-config-hint">
          Place Aggregate after a Loop. Each mapping collects the source value across iterations and
          writes the result to the target variable using the chosen strategy.
        </p>
      </div>

      <AvailableVariables hints={variableHints} />
    </div>
  );
}
