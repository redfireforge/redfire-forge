import type { LogDebugNodeData, LogLevel } from '../../types/workflow';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import MessageTemplateEditor from '../expression/MessageTemplateEditor';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

const LEVEL_OPTIONS: { value: LogLevel; label: string; desc: string }[] = [
  { value: 'info', label: 'Info', desc: 'General tracing during a run' },
  { value: 'warn', label: 'Warning', desc: 'Highlight an unexpected but non-fatal condition' },
  { value: 'error', label: 'Error', desc: 'Flag an important failure condition' },
  { value: 'debug', label: 'Debug', desc: 'Verbose detail for development' },
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
  const levelDesc = LEVEL_OPTIONS.find(o => o.value === data.logLevel)?.desc;

  return (
    <div className="wf-config-body wf-logdebug-config" data-testid="logdebug-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field--row">
        <label>Log Level</label>
        <CustomSelect
          value={data.logLevel}
          onChange={(v) => onChange({ ...data, logLevel: v as LogLevel })}
          options={LEVEL_OPTIONS.map(o => ({ value: o.value, label: o.label, detail: o.desc }))}
        />
        <span className="wf-config-hint">{levelDesc}</span>
      </div>

      <div className="wf-config-field--row wf-config-field--row-top">
        <label>Message Template</label>
        <div className="wf-config-row-stack" style={{ flex: 1, minWidth: 0 }}>
          <MessageTemplateEditor
            value={data.message}
            onChange={(v) => onChange({ ...data, message: v })}
            variableHints={variableHints}
            onRequestVariableInsert={onRequestVariableInsert}
          />
        </div>
      </div>

      <div className="wf-config-field--row wf-config-field--row-top">
        <label>Snapshot</label>
        <div className="wf-config-row-stack">
          <label className="wf-config-checkbox-label">
            <input
              type="checkbox"
              checked={data.snapshotVariables}
              onChange={(e) => onChange({ ...data, snapshotVariables: e.target.checked })}
            />
            Snapshot all variables
          </label>
          <span className="wf-config-hint-text--below">
            When enabled, captures a snapshot of all workflow variables at this point in execution —
            useful for debugging variable state between steps.
          </span>
        </div>
      </div>

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
