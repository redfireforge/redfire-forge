import { useState, useEffect } from 'react';
import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, LoadProfileType, ThinkTimeConfig, ThinkTimeMode } from '../../../shared/types';
import { ProfilePreview } from '../../requests/components/ProfilePreview';
import { profileDescriptions } from '../utils/runnerProgressStorage';
import { getExecutionModeMeta } from '../../../shared/utils/executionMode';

function NumericInput({ value, onChange, min = 0, max = Infinity, step, disabled, className }: {
  value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; disabled?: boolean; className?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return (
    <input
      type="number" min={min} max={max} step={step}
      className={className} disabled={disabled}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseInt(e.target.value);
        if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
      }}
      onBlur={() => {
        const v = parseInt(text);
        if (isNaN(v) || v < min) { onChange(min); setText(String(min)); }
        else if (v > max) { onChange(max); setText(String(max)); }
      }}
    />
  );
}

// Test Runner only shows these modes - 'workflow' mode is for the dedicated Workflow Runner
const testRunnerModes: ExecutionMode[] = ['sequential', 'batch', 'pool', 'load-profile'];

interface Props {
  executionMode: ExecutionMode;
  onExecutionModeChange: (mode: ExecutionMode) => void;
  concurrency: number;
  onConcurrencyChange: (n: number) => void;
  iterations: number;
  onIterationsChange: (n: number) => void;
  timeoutSec: number;
  onTimeoutSecChange: (n: number) => void;
  retryCount: number;
  onRetryCountChange: (n: number) => void;
  retryDelayMs: number;
  onRetryDelayMsChange: (n: number) => void;
  errorPolicy: ErrorPolicy;
  onErrorPolicyChange: (p: ErrorPolicy) => void;
  maxErrors: number;
  onMaxErrorsChange: (n: number) => void;
  maxErrorRate: number;
  onMaxErrorRateChange: (n: number) => void;
  loadProfile: LoadProfileConfig;
  onLoadProfileChange: (patch: Partial<LoadProfileConfig>) => void;
  thinkTime: ThinkTimeConfig;
  onThinkTimeChange: (patch: Partial<ThinkTimeConfig>) => void;
  activeTestCount: number;
  isRunning: boolean;
  /** When true, forces single-iteration mode (concurrency=1, iterations=1) and disables those controls */
  forceSingleIteration?: boolean;
  /**
   * Prefix for radio button `name` attributes to prevent browser-level group collisions
   * when multiple RunnerExecutionConfig instances are simultaneously in the DOM.
   * (e.g. TestRunner always stays mounted while WorkflowRunner may also be mounted)
   */
  namePrefix?: string;
}

function profileLabel(type: LoadProfileType): string {
  switch (type) {
    case 'ramp-up': return 'Ramp-Up';
    case 'sustained': return 'Sustained';
    case 'spike': return 'Spike';
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export { profileLabel };

export default function RunnerExecutionConfig({
  executionMode, onExecutionModeChange,
  concurrency, onConcurrencyChange,
  iterations, onIterationsChange,
  timeoutSec, onTimeoutSecChange,
  retryCount, onRetryCountChange,
  retryDelayMs, onRetryDelayMsChange,
  errorPolicy, onErrorPolicyChange,
  maxErrors, onMaxErrorsChange,
  maxErrorRate, onMaxErrorRateChange,
  loadProfile, onLoadProfileChange,
  thinkTime, onThinkTimeChange,
  activeTestCount, isRunning,
  forceSingleIteration = false,
  namePrefix = 'runner',
}: Props) {
  const n = (base: string) => `${namePrefix}-${base}`;
  const isLoadProfile = executionMode === 'load-profile';
  const modeMeta = getExecutionModeMeta(executionMode);
  
  // When forceSingleIteration is true, override concurrency and iterations
  const effectiveConcurrency = forceSingleIteration ? 1 : concurrency;
  const effectiveIterations = forceSingleIteration ? 1 : iterations;

  return (
    <div className="execution-group">
      <div className="runner-option-boxes">
        <div className="runner-option-box" style={{ flex: 1 }}>
          <span className="runner-exec-label">Execution Mode:</span>
          {testRunnerModes.map((mode) => {
            const meta = getExecutionModeMeta(mode);
            // When forceSingleIteration, only Sequential is available
            const isForceDisabled = forceSingleIteration && mode !== 'sequential';
            return (
              <label key={mode} className="radio-label" title={isForceDisabled ? 'Only Sequential allowed for Wait for Real Webhook mode' : meta.title}>
                <input type="radio" name={n('execMode')} checked={forceSingleIteration ? mode === 'sequential' : executionMode === mode} onChange={() => onExecutionModeChange(mode)} disabled={isRunning || isForceDisabled} />
                {meta.label}
              </label>
            );
          })}
          <span className="exec-mode-hint">{forceSingleIteration ? 'Single iteration for real webhook testing' : modeMeta.hint}</span>
        </div>
      </div>

      <div className="resilience-config">
        <div className="resilience-row">
          <div className="resilience-field resilience-field-sm">
            <label>Concurrency</label>
            <NumericInput min={1} max={100} value={forceSingleIteration ? 1 : (executionMode === 'sequential' ? 1 : effectiveConcurrency)} onChange={onConcurrencyChange} disabled={isRunning || executionMode === 'sequential' || isLoadProfile || forceSingleIteration} />
            {forceSingleIteration && <span className="field-hint">Fixed to 1</span>}
            {!forceSingleIteration && executionMode === 'sequential' && <span className="field-hint">Fixed to 1</span>}
            {!forceSingleIteration && isLoadProfile && <span className="field-hint">Set in profile</span>}
          </div>
          <div className="resilience-field resilience-field-sm">
            <label>Iterations</label>
            <NumericInput min={1} max={100000} value={forceSingleIteration ? 1 : effectiveIterations} onChange={onIterationsChange} disabled={isRunning || isLoadProfile || forceSingleIteration} />
            {forceSingleIteration && <span className="field-hint">Fixed to 1</span>}
            {!forceSingleIteration && !isLoadProfile && iterations < activeTestCount && <span className="field-hint">{activeTestCount} active</span>}
            {!forceSingleIteration && isLoadProfile && <span className="field-hint">Time-based</span>}
          </div>
          <div className="resilience-divider" />
          <div className="resilience-field resilience-field-sm">
            <label>Timeout</label>
            <div className="input-with-unit">
              <NumericInput min={0} max={300} value={timeoutSec} onChange={onTimeoutSecChange} disabled={isRunning} />
              <span className="unit">sec</span>
            </div>
            {timeoutSec === 0 && <span className="field-hint">No timeout</span>}
          </div>
          <div className="resilience-field resilience-field-sm">
            <label>Retry</label>
            <div className="input-with-unit">
              <NumericInput min={0} max={10} value={retryCount} onChange={onRetryCountChange} disabled={isRunning} />
              <span className="unit">times</span>
            </div>
            {retryCount === 0 && <span className="field-hint">No retry</span>}
          </div>
          {retryCount > 0 && (
            <div className="resilience-field resilience-field-sm">
              <label>Retry Delay</label>
              <div className="input-with-unit">
                <NumericInput min={0} max={30000} step={100} value={retryDelayMs} onChange={onRetryDelayMsChange} disabled={isRunning} />
                <span className="unit">ms</span>
              </div>
            </div>
          )}
          <div className="resilience-divider" />
          <div className="resilience-field" style={{ flex: '0 0 auto' }}>
            <label>On Error</label>
            <div className="error-policy-options">
              <label className="radio-label">
                <input type="radio" name={n('errorPolicy')} checked={errorPolicy === 'continue'} onChange={() => onErrorPolicyChange('continue')} disabled={isRunning} />
                Continue
              </label>
              <label className="radio-label">
                <input type="radio" name={n('errorPolicy')} checked={errorPolicy === 'stop-first'} onChange={() => onErrorPolicyChange('stop-first')} disabled={isRunning} />
                Stop 1st
              </label>
              <label className="radio-label">
                <input type="radio" name={n('errorPolicy')} checked={errorPolicy === 'stop-threshold'} onChange={() => onErrorPolicyChange('stop-threshold')} disabled={isRunning} />
                Threshold
              </label>
            </div>
          </div>
          <div className="resilience-field resilience-field-xs">
            <label>Max Errors</label>
            <NumericInput min={1} max={10000} value={maxErrors} onChange={onMaxErrorsChange} disabled={isRunning || errorPolicy !== 'stop-threshold'} />
          </div>
          <div className="resilience-field resilience-field-xs">
            <label>Error Rate</label>
            <div className="input-with-unit">
              <NumericInput min={1} max={100} value={maxErrorRate} onChange={onMaxErrorRateChange} disabled={isRunning || errorPolicy !== 'stop-threshold'} />
              <span className="unit">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="think-time-section">
        <div className="runner-option-box" style={{ flex: 1 }}>
          <span className="runner-exec-label">Think Time:</span>
          {(['none', 'constant', 'uniform', 'gaussian'] as ThinkTimeMode[]).map((m) => (
            <label key={m} className="radio-label">
              <input
                type="radio"
                name={n('thinkTimeMode')}
                checked={thinkTime.mode === m}
                onChange={() => onThinkTimeChange({ mode: m })}
                disabled={isRunning}
              />
              {m === 'none' ? 'None' : m === 'constant' ? 'Constant' : m === 'uniform' ? 'Uniform' : 'Gaussian'}
            </label>
          ))}
          {thinkTime.mode === 'constant' && (
            <span className="think-time-inline-params">
              <NumericInput
                min={0} max={60000} step={100}
                value={thinkTime.constantMs ?? 1000}
                onChange={(v) => onThinkTimeChange({ constantMs: v })}
                disabled={isRunning}
                className="think-time-inline-input"
              />
              <span className="unit">ms</span>
            </span>
          )}
          {thinkTime.mode === 'uniform' && (
            <span className="think-time-inline-params">
              <NumericInput
                min={0} max={60000} step={100}
                value={thinkTime.minMs ?? 500}
                onChange={(v) => onThinkTimeChange({ minMs: v })}
                disabled={isRunning}
                className="think-time-inline-input"
              />
              <span className="unit">–</span>
              <NumericInput
                min={0} max={60000} step={100}
                value={thinkTime.maxMs ?? 2000}
                onChange={(v) => onThinkTimeChange({ maxMs: v })}
                disabled={isRunning}
                className="think-time-inline-input"
              />
              <span className="unit">ms</span>
            </span>
          )}
          {thinkTime.mode === 'gaussian' && (
            <span className="think-time-inline-params">
              <span className="unit">μ</span>
              <NumericInput
                min={0} max={60000} step={100}
                value={thinkTime.meanMs ?? 1000}
                onChange={(v) => onThinkTimeChange({ meanMs: v })}
                disabled={isRunning}
                className="think-time-inline-input"
              />
              <span className="unit">σ</span>
              <NumericInput
                min={0} max={30000} step={50}
                value={thinkTime.stdDevMs ?? 300}
                onChange={(v) => onThinkTimeChange({ stdDevMs: v })}
                disabled={isRunning}
                className="think-time-inline-input"
              />
              <span className="unit">ms</span>
            </span>
          )}
          {thinkTime.mode !== 'none' && (
            <span className="exec-mode-hint">
              {thinkTime.mode === 'constant'
                ? `Fixed ${thinkTime.constantMs ?? 1000}ms delay`
                : thinkTime.mode === 'uniform'
                  ? `Random ${thinkTime.minMs ?? 500}–${thinkTime.maxMs ?? 2000}ms`
                  : `μ=${thinkTime.meanMs ?? 1000}ms σ=${thinkTime.stdDevMs ?? 300}ms`}
            </span>
          )}
        </div>
      </div>

      {isLoadProfile && (
        <div className="load-profile-section">
          <div className="load-profile-body">
            <div className="load-profile-controls">
              <div className="profile-type-selector">
                {(['ramp-up', 'sustained', 'spike'] as LoadProfileType[]).map((pt) => (
                  <button
                    key={pt}
                    className={`profile-type-btn ${loadProfile.type === pt ? 'active' : ''}`}
                    onClick={() => onLoadProfileChange({ type: pt })}
                    disabled={isRunning}
                  >
                    {profileLabel(pt)}
                  </button>
                ))}
              </div>
              <div className="profile-type-desc">{profileDescriptions[loadProfile.type]}</div>

              <div className="profile-fields">
                <div className="profile-field-row">
                  <div className="profile-field">
                    <label>Duration (sec)</label>
                    <NumericInput min={5} max={3600} value={loadProfile.durationSec} onChange={(v) => onLoadProfileChange({ durationSec: v })} disabled={isRunning} />
                  </div>
                  <div className="profile-field">
                    <label>{loadProfile.type === 'spike' ? 'Base Concurrency' : 'Max Concurrency'}</label>
                    <NumericInput min={1} max={100} value={loadProfile.maxConcurrency} onChange={(v) => onLoadProfileChange({ maxConcurrency: v })} disabled={isRunning} />
                  </div>
                  {loadProfile.type === 'ramp-up' && (
                    <div className="profile-field">
                      <label>Ramp (sec)</label>
                      <NumericInput min={1} max={loadProfile.durationSec} value={loadProfile.rampUpSec ?? 30} onChange={(v) => onLoadProfileChange({ rampUpSec: v })} disabled={isRunning} />
                    </div>
                  )}
                  {loadProfile.type === 'spike' && (
                    <>
                      <div className="profile-field">
                        <label>Spike Concurrency</label>
                        <NumericInput min={1} max={500} value={loadProfile.spikeConcurrency ?? 30} onChange={(v) => onLoadProfileChange({ spikeConcurrency: v })} disabled={isRunning} />
                      </div>
                      <div className="profile-field">
                        <label>Spike Start (sec)</label>
                        <NumericInput min={0} max={loadProfile.durationSec} value={loadProfile.spikeStartSec ?? 20} onChange={(v) => onLoadProfileChange({ spikeStartSec: v })} disabled={isRunning} />
                      </div>
                      <div className="profile-field">
                        <label>Spike Duration (sec)</label>
                        <NumericInput min={1} max={loadProfile.durationSec} value={loadProfile.spikeDurationSec ?? 10} onChange={(v) => onLoadProfileChange({ spikeDurationSec: v })} disabled={isRunning} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="profile-preview-container">
              <ProfilePreview profile={loadProfile} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
