import type { SubWorkflowNodeData } from '../../types/workflow';
import { parseClampedInteger } from './subWorkflowConfigUtils';
import { addMappingEntry, removeMappingEntry, updateMappingEntry } from '../workflowMappingUtils';
import ConfigSectionGroup from './ConfigSectionGroup';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

export interface WorkflowPickerItem {
  id: string;
  name: string;
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

  /* ── Input mapping helpers ── */

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

  /* ── Output mapping helpers ── */

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
    <div className="wf-config-body">
      {/* Label */}
      <div className="wf-config-field">
        <label>Label</label>
        <input
          value={data.label}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
        />
      </div>

      <ConfigSectionGroup title="Workflow Selection">
        <div className="wf-config-field">
          <label>
            Workflow
            <button
              type="button"
              className="wf-subworkflow-mode-toggle"
              onClick={() => onChange({ ...data, workflowId: isDynamic ? '' : '{{}}', workflowName: '' })}
              title={isDynamic ? 'Switch to static picker' : 'Switch to dynamic expression'}
            >
              {isDynamic ? '⇄ Static' : '⇄ Expression'}
            </button>
          </label>
          {isDynamic ? (
            <>
              <input
                value={data.workflowId}
                onChange={(e) => onChange({ ...data, workflowId: e.target.value, workflowName: '' })}
                placeholder="{{workflowId}}"
                className="wf-subworkflow-expression-input"
              />
              <span className="wf-config-hint">
                Use a <code>{'{{variable}}'}</code> expression. Resolved at runtime to a workflow ID.
              </span>
            </>
          ) : (
            <>
              <CustomSelect
                value={data.workflowId}
                onChange={(v) => handleWorkflowSelect(v)}
                placeholder="— Select workflow —"
                options={[
                  { value: '', label: '— Select workflow —' },
                  ...available.map((w) => ({ value: w.id, label: w.name })),
                ]}
              />
              {available.length === 0 && (
                <span className="wf-config-hint">No other workflows available. Create one first.</span>
              )}
            </>
          )}
        </div>
      </ConfigSectionGroup>

      <ConfigSectionGroup title="Input Mappings" count={data.inputMappings.length}>
        <div className="wf-config-field">
          <span className="wf-config-hint">
            Map parent variables/expressions to child workflow input variables.
          </span>
          {data.inputMappings.map((m, i) => (
            <div key={i} className="wf-subworkflow-mapping-row">
              <input
                placeholder="Source expression"
                value={m.sourceExpression}
                onChange={(e) => updateInputMapping(i, 'sourceExpression', e.target.value)}
              />
              <span className="wf-subworkflow-mapping-arrow">→</span>
              <input
                placeholder="Target variable"
                value={m.targetVariable}
                onChange={(e) => updateInputMapping(i, 'targetVariable', e.target.value)}
              />
              <button
                type="button"
                className="wf-subworkflow-mapping-remove"
                onClick={() => removeInputMapping(i)}
                title="Remove mapping"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="wf-subworkflow-mapping-add" onClick={addInputMapping}>
            + Add input mapping
          </button>
        </div>
      </ConfigSectionGroup>

      <ConfigSectionGroup title="Output Mappings" count={data.outputMappings.length}>
        <div className="wf-config-field">
          <span className="wf-config-hint">
            Map child workflow output variables back to parent variables.
          </span>
          {data.outputMappings.map((m, i) => (
            <div key={i} className="wf-subworkflow-mapping-row">
              <input
                placeholder="Source variable"
                value={m.sourceVariable}
                onChange={(e) => updateOutputMapping(i, 'sourceVariable', e.target.value)}
              />
              <span className="wf-subworkflow-mapping-arrow">→</span>
              <input
                placeholder="Target variable"
                value={m.targetVariable}
                onChange={(e) => updateOutputMapping(i, 'targetVariable', e.target.value)}
              />
              <button
                type="button"
                className="wf-subworkflow-mapping-remove"
                onClick={() => removeOutputMapping(i)}
                title="Remove mapping"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="wf-subworkflow-mapping-add" onClick={addOutputMapping}>
            + Add output mapping
          </button>
        </div>

        <div className="wf-config-field">
          <label className="wf-config-checkbox-label">
            <input
              type="checkbox"
              checked={data.propagateAllOutputs ?? false}
              onChange={(e) => onChange({ ...data, propagateAllOutputs: e.target.checked })}
            />
            Propagate all outputs
          </label>
          <span className="wf-config-hint">
            Pass all child workflow final variables to the parent (ignores output mappings).
          </span>
        </div>
      </ConfigSectionGroup>

      <ConfigSectionGroup title="Advanced" defaultOpen={false}>
        <div className="wf-config-field">
          <label>Max Depth</label>
          <input
            type="number"
            min={1}
            max={100}
            value={data.maxDepth ?? 10}
            onChange={(e) =>
              onChange({
                ...data,
                maxDepth: parseClampedInteger(e.target.value, { defaultValue: 10, min: 1, max: 100 }),
              })
            }
          />
          <span className="wf-config-hint">Maximum recursion depth for nested sub-workflows (default 10).</span>
        </div>

        <div className="wf-config-field">
          <label>Timeout (ms)</label>
          <input
            type="number"
            min={0}
            max={600000}
            step={1000}
            value={data.timeoutMs ?? 0}
            onChange={(e) =>
              onChange({
                ...data,
                timeoutMs: parseClampedInteger(e.target.value, { defaultValue: 0, min: 0, max: 600000 }),
              })
            }
          />
          <span className="wf-config-hint">Abort child workflow if it takes longer than this (0 = unlimited).</span>
        </div>

        <div className="wf-config-field">
          <label>Retry Count</label>
          <input
            type="number"
            min={0}
            max={10}
            value={data.retryCount ?? 0}
            onChange={(e) =>
              onChange({
                ...data,
                retryCount: parseClampedInteger(e.target.value, { defaultValue: 0, min: 0, max: 10 }),
              })
            }
          />
          <span className="wf-config-hint">Number of retry attempts if the child workflow fails (0 = no retry).</span>
        </div>

        {(data.retryCount ?? 0) > 0 && (
          <div className="wf-config-field">
            <label>Retry Delay (ms)</label>
            <input
              type="number"
              min={0}
              max={60000}
              step={500}
              value={data.retryDelayMs ?? 1000}
              onChange={(e) =>
                onChange({
                  ...data,
                  retryDelayMs: parseClampedInteger(e.target.value, { defaultValue: 0, min: 0, max: 60000 }),
                })
              }
            />
            <span className="wf-config-hint">Delay between retry attempts in milliseconds.</span>
          </div>
        )}

        <div className="wf-config-field">
          <label>On Child Failure</label>
          <CustomSelect
            value={data.onChildFailure ?? 'fail'}
            onChange={(v) => onChange({ ...data, onChildFailure: v as 'fail' | 'continue' })}
            options={[
              { value: 'fail', label: 'Fail parent node' },
              { value: 'continue', label: 'Continue (set __subWorkflowFailed variable)' },
            ]}
          />
          <span className="wf-config-hint">
            How to handle child workflow failure. &quot;Continue&quot; marks the node as passed and sets a
            <code>__subWorkflowFailed</code> variable to &quot;true&quot;.
          </span>
        </div>

        <div className="wf-config-field">
          <label className="wf-config-checkbox-label">
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
          <span className="wf-config-hint">
            Run the child workflow once per item in a collection variable.
          </span>
        </div>
        {data.multiInstance && (
          <>
            <div className="wf-config-field">
              <label>Collection Expression</label>
              <input
                value={data.multiInstance.collection}
                onChange={(e) =>
                  onChange({ ...data, multiInstance: { ...data.multiInstance!, collection: e.target.value } })
                }
                placeholder="{{users}}"
                className="wf-subworkflow-expression-input"
              />
              <span className="wf-config-hint">
                Expression resolving to a JSON array (e.g. <code>{'{{users}}'}</code>).
              </span>
            </div>
            <div className="wf-config-field">
              <label>Element Variable</label>
              <input
                value={data.multiInstance.elementVariable}
                onChange={(e) =>
                  onChange({ ...data, multiInstance: { ...data.multiInstance!, elementVariable: e.target.value } })
                }
                placeholder="item"
              />
              <span className="wf-config-hint">
                Variable name injected into each child run with the current element value.
              </span>
            </div>
            <div className="wf-config-field">
              <label>Execution Mode</label>
              <CustomSelect
                value={data.multiInstance.mode}
                onChange={(v) =>
                  onChange({ ...data, multiInstance: { ...data.multiInstance!, mode: v as 'sequential' | 'parallel' } })
                }
                options={[
                  { value: 'sequential', label: 'Sequential' },
                  { value: 'parallel', label: 'Parallel' },
                ]}
              />
              <span className="wf-config-hint">
                Sequential runs items one-by-one; parallel runs all concurrently.
              </span>
            </div>
          </>
        )}
      </ConfigSectionGroup>

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
