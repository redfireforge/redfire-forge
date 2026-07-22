import type { LogDebugNodeData, LogLevel } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import InsertVarField from '../expression/InsertVarField';
import AvailableVariables from '../expression/AvailableVariables';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

const LEVEL_OPTIONS: { value: LogLevel; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'debug', label: 'Debug' },
];

export default function LogDebugConfig({
  data,
  onChange,
  onRequestVariableInsert,
  variableHints = [],
}: {
  data: LogDebugNodeData;
  onChange: (d: LogDebugNodeData) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  variableHints?: WorkflowVariableHint[];
}) {
  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Log Level</label>
        <CustomSelect
          value={data.logLevel}
          onChange={(v) => onChange({ ...data, logLevel: v as LogLevel })}
          options={LEVEL_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
        />
      </div>

      <div className="wf-config-field">
        <label>Message Template</label>
        <InsertVarField
          onRequestVariableInsert={onRequestVariableInsert}
          onInsert={(snippet) => onChange({ ...data, message: data.message + snippet })}
        >
          <textarea
            className="wf-config-textarea"
            rows={4}
            value={data.message}
            onChange={(e) => onChange({ ...data, message: e.target.value })}
            placeholder="e.g. Status is {{status}}, user {{userId}} created"
          />
        </InsertVarField>
        <span className="wf-config-hint">
          Supports <code>{'{{variable}}'}</code> syntax. Variables are resolved at runtime.
        </span>
      </div>

      <div className="wf-config-field">
        <label className="wf-config-checkbox-label">
          <input
            type="checkbox"
            checked={data.snapshotVariables}
            onChange={(e) => onChange({ ...data, snapshotVariables: e.target.checked })}
          />
          Snapshot all variables
        </label>
        <span className="wf-config-hint">
          When enabled, captures a snapshot of all workflow variables at this point in execution.
          Useful for debugging variable state between steps.
        </span>
      </div>

      <AvailableVariables hints={variableHints} />

      <div className="wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <ul>
          <li>The message is resolved with current variable values and logged to the workflow console.</li>
          <li>Use <strong>Debug</strong> level for development, <strong>Info</strong> for general tracing, <strong>Warn/Error</strong> for important conditions.</li>
          <li>Variable snapshots appear as a collapsible table in the console output.</li>
          <li>This node always passes — it never fails the workflow.</li>
        </ul>
      </div>
    </div>
  );
}
