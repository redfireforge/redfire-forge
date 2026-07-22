import type { ErrorHandlerNodeData, ErrorFilter, RetryBackoffStrategy } from '../../types/workflow';
import ConfigSectionGroup from './ConfigSectionGroup';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

const FILTER_OPTIONS: { value: ErrorFilter; label: string; desc: string }[] = [
  { value: 'all', label: 'All Errors', desc: 'Catch HTTP errors, assertion failures, and network errors' },
  { value: 'http-error', label: 'HTTP Errors', desc: 'Catch HTTP status >= 400' },
  { value: 'assertion-failure', label: 'Assertion Failures', desc: 'Catch assertion/validation failures only' },
  { value: 'network-error', label: 'Network Errors', desc: 'Catch network/timeout errors (status 0)' },
];

const BACKOFF_OPTIONS: { value: RetryBackoffStrategy; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'exponential', label: 'Exponential' },
];

export default function ErrorHandlerConfig({
  data,
  onChange,
}: {
  data: ErrorHandlerNodeData;
  onChange: (d: ErrorHandlerNodeData) => void;
}) {
  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <ConfigSectionGroup title="Error Handling">
      <div className="wf-config-field">
        <label>Error Filter</label>
        <CustomSelect
          value={data.errorFilter}
          onChange={(v) => onChange({ ...data, errorFilter: v as ErrorFilter })}
          options={FILTER_OPTIONS.map(o => ({ value: o.value, label: o.label, detail: o.desc }))}
        />
        <span className="wf-config-hint">{FILTER_OPTIONS.find(o => o.value === data.errorFilter)?.desc}</span>
      </div>

      </ConfigSectionGroup>
      <ConfigSectionGroup title="Retry Settings">
      <div className="wf-config-field">
        <label>Retry Count</label>
        <input
          type="number"
          min={0}
          max={10}
          value={data.retryCount}
          onChange={(e) => onChange({ ...data, retryCount: Math.max(0, parseInt(e.target.value) || 0) })}
        />
        <span className="wf-config-hint">Number of retry attempts before executing the Catch path (0 = no retry)</span>
      </div>

      {data.retryCount > 0 && (
        <>
          <div className="wf-config-field">
            <label>Retry Delay (ms)</label>
            <input
              type="number"
              min={0}
              max={60000}
              step={100}
              value={data.retryDelayMs}
              onChange={(e) => onChange({ ...data, retryDelayMs: Math.max(0, parseInt(e.target.value) || 0) })}
            />
          </div>

          <div className="wf-config-field">
            <label>Backoff Strategy</label>
            <CustomSelect
              value={data.retryBackoff}
              onChange={(v) => onChange({ ...data, retryBackoff: v as RetryBackoffStrategy })}
              options={BACKOFF_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            />
            <span className="wf-config-hint">
              {data.retryBackoff === 'fixed'
                ? `Wait ${data.retryDelayMs}ms between each retry`
                : `Wait ${data.retryDelayMs}ms, ${data.retryDelayMs * 2}ms, ${data.retryDelayMs * 4}ms…`}
            </span>
          </div>

          <div className="wf-config-field">
            <label>Retry Timeout (ms)</label>
            <input
              type="number"
              min={0}
              max={300000}
              step={1000}
              value={data.retryTimeoutMs}
              onChange={(e) => onChange({ ...data, retryTimeoutMs: Math.max(0, parseInt(e.target.value) || 0) })}
            />
            <span className="wf-config-hint">Max total time for all retries combined (0 = unlimited)</span>
          </div>
        </>
      )}

      </ConfigSectionGroup>
      <ConfigSectionGroup title="Behavior">
      <div className="wf-config-field">
        <label className="wf-config-checkbox-label">
          <input
            type="checkbox"
            checked={data.continueOnError}
            onChange={(e) => onChange({ ...data, continueOnError: e.target.checked })}
          />
          Continue workflow after catch
        </label>
        <span className="wf-config-hint">
          {data.continueOnError
            ? 'Workflow continues normally after the Catch path executes'
            : 'Workflow marks this handler as failed after the Catch path executes'}
        </span>
      </div>

      </ConfigSectionGroup>
      <div className="wf-config-section wf-config-section-info">
        <div className="wf-config-info-title">How it works</div>
        <p className="wf-config-hint">
          Connect nodes to the <strong>Body</strong> handle — they are protected by this handler.
          If any Body node fails (after retries), the <strong>Catch</strong> path executes with error
          variables (<code>{'{{error.message}}'}</code>, <code>{'{{error.statusCode}}'}</code>, etc.).
          The <strong>Done</strong> handle continues after either path completes.
        </p>
      </div>
    </div>
  );
}
