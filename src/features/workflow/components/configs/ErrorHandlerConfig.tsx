import { useMemo } from 'react';
import type { ErrorHandlerNodeData, ErrorFilter, RetryBackoffStrategy } from '../../types/workflow';
import ConfigSectionGroup from './ConfigSectionGroup';
import { CustomSelect } from '../../../../shared/components/CustomSelect';

const FILTER_OPTIONS: { value: ErrorFilter; label: string; desc: string }[] = [
  { value: 'all', label: 'All Errors', desc: 'HTTP errors, assertion failures, and network errors' },
  { value: 'http-error', label: 'HTTP Errors', desc: 'HTTP status >= 400' },
  { value: 'assertion-failure', label: 'Assertion Failures', desc: 'Assertion/validation failures only' },
  { value: 'network-error', label: 'Network Errors', desc: 'Network/timeout errors (status 0)' },
];

const BACKOFF_OPTIONS: { value: RetryBackoffStrategy; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'exponential', label: 'Exponential' },
];

function RetryPreview({ count, delayMs, backoff }: { count: number; delayMs: number; backoff: RetryBackoffStrategy }) {
  const steps = useMemo(() => {
    const result: string[] = [];
    for (let i = 0; i < Math.min(count, 5); i++) {
      const ms = backoff === 'exponential' ? delayMs * Math.pow(2, i) : delayMs;
      result.push(ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)}s` : `${ms}ms`);
    }
    return result;
  }, [count, delayMs, backoff]);

  if (count === 0) return null;

  return (
    <div className="errh-retry-preview">
      <div className="errh-retry-flow">
        <span className="errh-retry-badge errh-retry-badge--start">Request</span>
        {steps.map((s, i) => (
          <span key={i} className="errh-retry-step">
            <span className="errh-retry-arrow">→</span>
            <span className="errh-retry-delay">{s}</span>
            <span className="errh-retry-arrow">→</span>
            <span className="errh-retry-badge errh-retry-badge--retry">Retry {i + 1}</span>
          </span>
        ))}
        <span className="errh-retry-step">
          <span className="errh-retry-arrow">→</span>
          <span className="errh-retry-badge errh-retry-badge--catch">Catch</span>
        </span>
      </div>
    </div>
  );
}

export default function ErrorHandlerConfig({
  data,
  onChange,
}: {
  data: ErrorHandlerNodeData;
  onChange: (d: ErrorHandlerNodeData) => void;
}) {
  const filterDesc = FILTER_OPTIONS.find(o => o.value === data.errorFilter)?.desc ?? '';

  return (
    <div className="wf-config-body wf-errhandler-config" data-testid="errhandler-config">
      <div className="wf-config-field--row">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>

      <ConfigSectionGroup title="Error Handling">
        <div className="wf-config-field--row">
          <label>Error Filter</label>
          <div className="wf-config-inline-ctrls">
            <CustomSelect
              value={data.errorFilter}
              onChange={(v) => onChange({ ...data, errorFilter: v as ErrorFilter })}
              options={FILTER_OPTIONS.map(o => ({ value: o.value, label: o.label, detail: o.desc }))}
            />
          </div>
        </div>
        <span className="errh-filter-desc">{filterDesc}</span>
      </ConfigSectionGroup>

      <ConfigSectionGroup title="Retry Settings">
        <div className="errh-retry-fields">
          <div className="errh-field-inline">
            <label>Retries</label>
            <input
              type="number"
              className="errh-num"
              min={0}
              max={10}
              value={data.retryCount}
              onChange={(e) => onChange({ ...data, retryCount: Math.max(0, parseInt(e.target.value) || 0) })}
            />
          </div>

          {data.retryCount > 0 && (
            <>
              <div className="errh-field-inline">
                <label>Delay</label>
                <input
                  type="number"
                  className="errh-num errh-num--wide"
                  min={0}
                  max={60000}
                  step={100}
                  value={data.retryDelayMs}
                  onChange={(e) => onChange({ ...data, retryDelayMs: Math.max(0, parseInt(e.target.value) || 0) })}
                />
                <span className="errh-unit">ms</span>
              </div>

              <div className="errh-field-inline">
                <label>Backoff</label>
                <CustomSelect
                  value={data.retryBackoff}
                  onChange={(v) => onChange({ ...data, retryBackoff: v as RetryBackoffStrategy })}
                  options={BACKOFF_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                />
              </div>

              <div className="errh-field-inline">
                <label>Timeout</label>
                <input
                  type="number"
                  className="errh-num errh-num--wide"
                  min={0}
                  max={300000}
                  step={1000}
                  value={data.retryTimeoutMs}
                  onChange={(e) => onChange({ ...data, retryTimeoutMs: Math.max(0, parseInt(e.target.value) || 0) })}
                />
                <span className="errh-unit">{data.retryTimeoutMs === 0 ? 'ms (no limit)' : 'ms'}</span>
              </div>
            </>
          )}
        </div>

        <RetryPreview count={data.retryCount} delayMs={data.retryDelayMs} backoff={data.retryBackoff} />
      </ConfigSectionGroup>

      <ConfigSectionGroup title="Behavior">
        <div className="errh-behavior-section">
          <label className="errh-checkbox-label">
            <input
              type="checkbox"
              checked={data.continueOnError}
              onChange={(e) => onChange({ ...data, continueOnError: e.target.checked })}
            />
            <span className="errh-checkbox-text">Continue workflow after catch</span>
          </label>
          <span className="errh-behavior-hint">
            {data.continueOnError
              ? 'Workflow continues normally after the Catch path executes'
              : 'Workflow marks this handler as failed after Catch executes'}
          </span>
        </div>
      </ConfigSectionGroup>

      <div className="errh-handles-guide">
        <div className="errh-handles-title">Output Handles</div>
        <div className="errh-handles-list">
          <div className="errh-handle-item">
            <span className="errh-handle-dot errh-handle-dot--body" />
            <span className="errh-handle-name">Body</span>
            <span className="errh-handle-desc">Protected nodes (the &ldquo;try&rdquo; path)</span>
          </div>
          <div className="errh-handle-item">
            <span className="errh-handle-dot errh-handle-dot--catch" />
            <span className="errh-handle-name">Catch</span>
            <span className="errh-handle-desc">Fallback when all retries fail</span>
          </div>
          <div className="errh-handle-item">
            <span className="errh-handle-dot errh-handle-dot--done" />
            <span className="errh-handle-name">Done</span>
            <span className="errh-handle-desc">Runs after either path completes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
