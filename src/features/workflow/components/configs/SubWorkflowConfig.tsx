import type { ReactNode } from 'react';
import type { SubWorkflowNodeData } from '../../types/workflow';
import { parseClampedInteger } from './subWorkflowConfigUtils';
import { addMappingEntry, removeMappingEntry, updateMappingEntry } from '../workflowMappingUtils';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { KafkaAddButton, KafkaCard, KafkaEmptyState, KafkaFormRow } from './KafkaConfigUi';

export interface WorkflowPickerItem {
  id: string;
  name: string;
}

/** Advanced row control: fixed field + reserved unit gutter for alignment. */
function SubWfAdvCtrl({ unit, children }: { unit?: string; children: ReactNode }) {
  return (
    <div className="wf-subworkflow-adv-ctrl">
      <div className="wf-subworkflow-adv-field">{children}</div>
      <span
        className={`wf-subworkflow-adv-unit${unit ? '' : ' wf-subworkflow-adv-unit--spacer'}`}
        aria-hidden={!unit || undefined}
      >
        {unit ?? 'ms'}
      </span>
    </div>
  );
}

export default function SubWorkflowConfig({
  data,
  onChange,
  workflows,
  currentWorkflowId,
}: {
  data: SubWorkflowNodeData;
  onChange: (d: SubWorkflowNodeData) => void;
  /** All saved workflows available for selection. */
  workflows: WorkflowPickerItem[];
  /** Current workflow ID — excluded from picker to prevent self-reference. */
  currentWorkflowId?: string;
}) {
  const available = workflows.filter((w) => w.id !== currentWorkflowId);
  const isDynamic = data.workflowId.includes('{{');

  const handleWorkflowSelect = (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    onChange({ ...data, workflowId: id, workflowName: wf?.name ?? '' });
  };

  const updateInputMapping = (
    idx: number,
    field: 'sourceExpression' | 'targetVariable',
    value: string,
  ) => {
    onChange({
      ...data,
      inputMappings: updateMappingEntry(data.inputMappings, idx, field, value),
    });
  };

  const addInputMapping = () =>
    onChange({
      ...data,
      inputMappings: addMappingEntry(data.inputMappings, { sourceExpression: '', targetVariable: '' }),
    });

  const removeInputMapping = (idx: number) =>
    onChange({ ...data, inputMappings: removeMappingEntry(data.inputMappings, idx) });

  const updateOutputMapping = (
    idx: number,
    field: 'sourceVariable' | 'targetVariable',
    value: string,
  ) => {
    onChange({
      ...data,
      outputMappings: updateMappingEntry(data.outputMappings, idx, field, value),
    });
  };

  const addOutputMapping = () =>
    onChange({
      ...data,
      outputMappings: addMappingEntry(data.outputMappings, { sourceVariable: '', targetVariable: '' }),
    });

  const removeOutputMapping = (idx: number) =>
    onChange({ ...data, outputMappings: removeMappingEntry(data.outputMappings, idx) });

  return (
    <div className="wf-config-body wf-subworkflow-config" data-testid="subworkflow-config">
      <KafkaCard
        title="Sub-Workflow"
        hint="Run another workflow as a single step."
      >
        <div className="wf-kafka-form wf-kafka-form--subworkflow">
          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
              aria-label="Sub-Workflow label"
            />
          </KafkaFormRow>

          <KafkaFormRow
            label="Workflow"
            hint={
              isDynamic
                ? 'Resolved at runtime to a workflow ID.'
                : available.length === 0
                  ? 'No other workflows available. Create one first.'
                  : 'Child workflow to execute.'
            }
            compact
          >
            <div className="wf-subworkflow-workflow-ctrl">
              {isDynamic ? (
                <input
                  value={data.workflowId}
                  onChange={(e) =>
                    onChange({ ...data, workflowId: e.target.value, workflowName: '' })
                  }
                  placeholder="{{workflowId}}"
                  className="wf-kafka-form-input wf-kafka-form-input--mono wf-subworkflow-expression-input"
                  aria-label="Workflow expression"
                />
              ) : (
                <CustomSelect
                  value={data.workflowId}
                  onChange={(v) => handleWorkflowSelect(v)}
                  placeholder="— Select workflow —"
                  options={[
                    { value: '', label: '— Select workflow —' },
                    ...available.map((w) => ({ value: w.id, label: w.name })),
                  ]}
                  menuMatchTriggerWidth
                  aria-label="Workflow"
                />
              )}
              <button
                type="button"
                className="wf-subworkflow-mode-toggle"
                onClick={() =>
                  onChange({
                    ...data,
                    workflowId: isDynamic ? '' : '{{}}',
                    workflowName: '',
                  })
                }
                title={isDynamic ? 'Switch to static picker' : 'Switch to dynamic expression'}
              >
                {isDynamic ? '⇄ Static' : '⇄ Expression'}
              </button>
            </div>
          </KafkaFormRow>
        </div>
      </KafkaCard>

      <KafkaCard
        title="Input Mappings"
        hint="Map parent variables/expressions to child workflow input variables."
        action={<KafkaAddButton label="+ Add input mapping" onClick={addInputMapping} />}
      >
        {data.inputMappings.length === 0 ? (
          <KafkaEmptyState
            title="No input mappings"
            text="Add a row to pass parent values into the child workflow."
          />
        ) : (
          <div className="wf-subworkflow-mappings-panel">
            <div className="wf-subworkflow-mappings-header" aria-hidden="true">
              <span>Source</span>
              <span />
              <span>Target</span>
              <span />
            </div>
            {data.inputMappings.map((m, i) => (
              <div key={i} className="wf-subworkflow-mapping-row">
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono"
                  placeholder="Source expression"
                  value={m.sourceExpression}
                  onChange={(e) => updateInputMapping(i, 'sourceExpression', e.target.value)}
                  aria-label={`Input mapping ${i + 1} source`}
                />
                <span className="wf-subworkflow-mapping-arrow" aria-hidden="true">
                  →
                </span>
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono"
                  placeholder="Target variable"
                  value={m.targetVariable}
                  onChange={(e) => updateInputMapping(i, 'targetVariable', e.target.value)}
                  aria-label={`Input mapping ${i + 1} target`}
                />
                <button
                  type="button"
                  className="wf-subworkflow-mapping-remove"
                  onClick={() => removeInputMapping(i)}
                  title="Remove mapping"
                  aria-label={`Remove input mapping ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </KafkaCard>

      <KafkaCard
        title="Output Mappings"
        hint="Map child workflow output variables back to parent variables."
        action={<KafkaAddButton label="+ Add output mapping" onClick={addOutputMapping} />}
      >
        {data.outputMappings.length === 0 ? (
          <KafkaEmptyState
            title="No output mappings"
            text="Add a row, or enable Propagate all outputs below."
          />
        ) : (
          <div className="wf-subworkflow-mappings-panel">
            <div className="wf-subworkflow-mappings-header" aria-hidden="true">
              <span>Source</span>
              <span />
              <span>Target</span>
              <span />
            </div>
            {data.outputMappings.map((m, i) => (
              <div key={i} className="wf-subworkflow-mapping-row">
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono"
                  placeholder="Source variable"
                  value={m.sourceVariable}
                  onChange={(e) => updateOutputMapping(i, 'sourceVariable', e.target.value)}
                  aria-label={`Output mapping ${i + 1} source`}
                />
                <span className="wf-subworkflow-mapping-arrow" aria-hidden="true">
                  →
                </span>
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono"
                  placeholder="Target variable"
                  value={m.targetVariable}
                  onChange={(e) => updateOutputMapping(i, 'targetVariable', e.target.value)}
                  aria-label={`Output mapping ${i + 1} target`}
                />
                <button
                  type="button"
                  className="wf-subworkflow-mapping-remove"
                  onClick={() => removeOutputMapping(i)}
                  title="Remove mapping"
                  aria-label={`Remove output mapping ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="wf-subworkflow-propagate">
          <label className="wf-subworkflow-checkbox">
            <input
              type="checkbox"
              checked={data.propagateAllOutputs ?? false}
              onChange={(e) => onChange({ ...data, propagateAllOutputs: e.target.checked })}
            />
            Propagate all outputs
          </label>
          <span className="wf-subworkflow-propagate-hint">
            Pass all child workflow final variables to the parent (ignores output mappings).
          </span>
        </div>
      </KafkaCard>

      <KafkaCard title="Advanced" hint="Depth, timeout, retries, and multi-instance options.">
        <div className="wf-kafka-form wf-kafka-form--subworkflow wf-kafka-form--subworkflow-adv">
          <div className="wf-config-field">
            <KafkaFormRow label="Max Depth" hint="Max nested sub-workflow depth (default 10)." compact>
              <SubWfAdvCtrl>
                <input
                  className="wf-kafka-form-input wf-subworkflow-adv-num"
                  type="number"
                  min={1}
                  max={100}
                  value={data.maxDepth ?? 10}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      maxDepth: parseClampedInteger(e.target.value, {
                        defaultValue: 10,
                        min: 1,
                        max: 100,
                      }),
                    })
                  }
                  aria-label="Max Depth"
                />
              </SubWfAdvCtrl>
            </KafkaFormRow>
          </div>

          <div className="wf-config-field">
            <span className="wf-subworkflow-sr-label">Timeout (ms)</span>
            <KafkaFormRow label="Timeout" hint="Abort child if longer than this (0 = unlimited)." compact>
              <SubWfAdvCtrl unit="ms">
                <input
                  className="wf-kafka-form-input wf-subworkflow-adv-num"
                  type="number"
                  min={0}
                  max={600000}
                  step={1000}
                  value={data.timeoutMs ?? 0}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      timeoutMs: parseClampedInteger(e.target.value, {
                        defaultValue: 0,
                        min: 0,
                        max: 600000,
                      }),
                    })
                  }
                  aria-label="Timeout (ms)"
                />
              </SubWfAdvCtrl>
            </KafkaFormRow>
          </div>

          <div className="wf-config-field">
            <span className="wf-subworkflow-sr-label">Retry Count</span>
            <KafkaFormRow label="Retries" hint="Retry attempts if the child fails (0 = none)." compact>
              <SubWfAdvCtrl>
                <input
                  className="wf-kafka-form-input wf-subworkflow-adv-num"
                  type="number"
                  min={0}
                  max={10}
                  value={data.retryCount ?? 0}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      retryCount: parseClampedInteger(e.target.value, {
                        defaultValue: 0,
                        min: 0,
                        max: 10,
                      }),
                    })
                  }
                  aria-label="Retry Count"
                />
              </SubWfAdvCtrl>
            </KafkaFormRow>
          </div>

          {(data.retryCount ?? 0) > 0 && (
            <div className="wf-config-field">
              <span className="wf-subworkflow-sr-label">Retry Delay (ms)</span>
              <KafkaFormRow label="Retry delay" hint="Wait between retry attempts." compact>
                <SubWfAdvCtrl unit="ms">
                  <input
                    className="wf-kafka-form-input wf-subworkflow-adv-num"
                    type="number"
                    min={0}
                    max={60000}
                    step={500}
                    value={data.retryDelayMs ?? 1000}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        retryDelayMs: parseClampedInteger(e.target.value, {
                          defaultValue: 0,
                          min: 0,
                          max: 60000,
                        }),
                      })
                    }
                    aria-label="Retry Delay (ms)"
                  />
                </SubWfAdvCtrl>
              </KafkaFormRow>
            </div>
          )}

          <KafkaFormRow
            label="On failure"
            hint="Continue sets __subWorkflowFailed to true."
            compact
          >
            <SubWfAdvCtrl>
              <div className="wf-subworkflow-select-ctrl">
                <CustomSelect
                  value={data.onChildFailure ?? 'fail'}
                  onChange={(v) => onChange({ ...data, onChildFailure: v as 'fail' | 'continue' })}
                  options={[
                    { value: 'fail', label: 'Fail parent node' },
                    {
                      value: 'continue',
                      label: 'Continue',
                      detail: 'set __subWorkflowFailed',
                    },
                  ]}
                  menuMinWidth={300}
                  menuMaxWidth={360}
                  aria-label="On Child Failure"
                />
              </div>
            </SubWfAdvCtrl>
          </KafkaFormRow>
        </div>

        <div className="wf-subworkflow-multi">
          <label className="wf-subworkflow-checkbox">
            <input
              type="checkbox"
              checked={!!data.multiInstance}
              onChange={(e) =>
                onChange({
                  ...data,
                  multiInstance: e.target.checked
                    ? { collection: '', elementVariable: 'item', mode: 'sequential' }
                    : undefined,
                })
              }
            />
            Multi-Instance (forEach)
          </label>
          <span className="wf-subworkflow-propagate-hint">
            Run the child workflow once per item in a collection variable.
          </span>

          {data.multiInstance && (
            <div className="wf-kafka-form wf-kafka-form--subworkflow wf-kafka-form--subworkflow-adv">
              <KafkaFormRow
                label="Collection"
                hint="Expression resolving to a JSON array."
                compact
              >
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono wf-subworkflow-expression-input"
                  value={data.multiInstance.collection}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      multiInstance: { ...data.multiInstance!, collection: e.target.value },
                    })
                  }
                  placeholder="{{users}}"
                  aria-label="Collection Expression"
                />
              </KafkaFormRow>

              <KafkaFormRow
                label="Element var"
                hint="Injected into each child run."
                compact
              >
                <input
                  className="wf-kafka-form-input wf-kafka-form-input--mono"
                  value={data.multiInstance.elementVariable}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      multiInstance: {
                        ...data.multiInstance!,
                        elementVariable: e.target.value,
                      },
                    })
                  }
                  placeholder="item"
                  aria-label="Element Variable"
                />
              </KafkaFormRow>

              <KafkaFormRow label="Mode" hint="Sequential or parallel execution." compact>
                <div className="wf-subworkflow-select-ctrl wf-subworkflow-select-ctrl--sm">
                  <CustomSelect
                    value={data.multiInstance.mode}
                    onChange={(v) =>
                      onChange({
                        ...data,
                        multiInstance: {
                          ...data.multiInstance!,
                          mode: v as 'sequential' | 'parallel',
                        },
                      })
                    }
                    options={[
                      { value: 'sequential', label: 'Sequential' },
                      { value: 'parallel', label: 'Parallel' },
                    ]}
                    aria-label="Execution Mode"
                  />
                </div>
              </KafkaFormRow>
            </div>
          )}
        </div>
      </KafkaCard>

      <div className="wf-config-section wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <p className="wf-config-hint">
          The sub-workflow node executes another workflow as a single step. <strong>Input mappings</strong> pass
          parent variables to the child workflow. After execution, <strong>output mappings</strong> bring
          child results back to the parent. Use <em>Propagate all outputs</em> to automatically pass
          all child variables without explicit mapping.
        </p>
      </div>
    </div>
  );
}
