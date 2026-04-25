import type { WaitForConditionNodeData } from '../../types/workflow';

export default function WaitForConditionConfig({
  data,
  onChange,
}: {
  data: WaitForConditionNodeData;
  onChange: (d: WaitForConditionNodeData) => void;
}) {
  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <div className="wf-config-field">
        <label>Condition Expression</label>
        <input
          value={data.conditionExpression}
          onChange={(e) => onChange({ ...data, conditionExpression: e.target.value })}
          placeholder="e.g. {{status}} == done"
        />
        <span className="wf-config-hint">
          Evaluated after each poll. Supports <code>==</code>, <code>!=</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>, <code>contains</code>, <code>!contains</code>.
          Uses <code>{'{{variable}}'}</code> syntax.
        </span>
      </div>

      <div className="wf-config-field">
        <label>Polling Interval (ms)</label>
        <input
          type="number"
          min={100}
          step={100}
          value={data.pollIntervalMs}
          onChange={(e) => onChange({ ...data, pollIntervalMs: Math.max(100, parseInt(e.target.value) || 1000) })}
        />
        <span className="wf-config-hint">How long to wait between each poll attempt.</span>
      </div>

      <div className="wf-config-field">
        <label>Timeout (ms)</label>
        <input
          type="number"
          min={0}
          step={1000}
          value={data.timeoutMs}
          onChange={(e) => onChange({ ...data, timeoutMs: Math.max(0, parseInt(e.target.value) || 0) })}
        />
        <span className="wf-config-hint">Maximum total wait time. 0 = no timeout (use Max Attempts instead).</span>
      </div>

      <div className="wf-config-field">
        <label>Max Attempts</label>
        <input
          type="number"
          min={0}
          max={1000}
          value={data.maxAttempts}
          onChange={(e) => onChange({ ...data, maxAttempts: Math.max(0, Math.min(1000, parseInt(e.target.value) || 0)) })}
        />
        <span className="wf-config-hint">Maximum polling attempts. 0 = unlimited (bounded by timeout).</span>
      </div>

      <div className="wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <ul>
          <li><strong>Poll</strong> handle: connect to the HTTP step(s) that will be re-executed each poll cycle.</li>
          <li><strong>Done</strong> handle: continues the workflow after the condition is met or polling exhausted.</li>
          <li>Each poll cycle re-runs the body subgraph, then evaluates the condition against updated variables.</li>
          <li>Sets <code>{'{{wait.attempts}}'}</code> and <code>{'{{wait.elapsed}}'}</code> variables on completion.</li>
          <li>If the condition is never met, the node marks as <strong>fail</strong> (unless timeout/maxAttempts = 0, which polls forever until aborted).</li>
        </ul>
      </div>
    </div>
  );
}
