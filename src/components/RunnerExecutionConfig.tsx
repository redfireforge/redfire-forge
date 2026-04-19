import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, LoadProfileType, ThinkTimeConfig, ThinkTimeMode } from '../types';
import { ProfilePreview } from './ProfilePreview';
import { profileDescriptions } from '../utils/runnerProgressStorage';

interface Props {
  executionMode: ExecutionMode;
  onExecutionModeChange: (mode: ExecutionMode) => void;
  concurrency: number;
  onConcurrencyChange: (n: number) => void;
  totalTransactions: number;
  onTotalTransactionsChange: (n: number) => void;
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
}

function profileLabel(type: LoadProfileType): string {
  switch (type) {
    case 'ramp-up': return 'Ramp-Up';
    case 'sustained': return 'Sustained';
    case 'spike': return 'Spike';
  }
}

export { profileLabel };

export default function RunnerExecutionConfig({
  executionMode, onExecutionModeChange,
  concurrency, onConcurrencyChange,
  totalTransactions, onTotalTransactionsChange,
  timeoutSec, onTimeoutSecChange,
  retryCount, onRetryCountChange,
  retryDelayMs, onRetryDelayMsChange,
  errorPolicy, onErrorPolicyChange,
  maxErrors, onMaxErrorsChange,
  maxErrorRate, onMaxErrorRateChange,
  loadProfile, onLoadProfileChange,
  thinkTime, onThinkTimeChange,
  activeTestCount, isRunning,
}: Props) {
  const isLoadProfile = executionMode === 'load-profile';

  return (
    <div className="execution-group">
      <div className="runner-option-boxes">
        <div className="runner-option-box" style={{ flex: 1 }}>
          <span className="runner-exec-label">Execution Mode:</span>
          <label className="radio-label" title="Executes requests one by one in sequence. No parallelism.">
            <input type="radio" name="execMode" checked={executionMode === 'sequential'} onChange={() => onExecutionModeChange('sequential')} disabled={isRunning} />
            Sequential
          </label>
          <label className="radio-label" title="Fires N requests, waits for ALL to finish, then fires the next N.">
            <input type="radio" name="execMode" checked={executionMode === 'batch'} onChange={() => onExecutionModeChange('batch')} disabled={isRunning} />
            Batch
          </label>
          <label className="radio-label" title="Maintains N concurrent requests at all times.">
            <input type="radio" name="execMode" checked={executionMode === 'pool'} onChange={() => onExecutionModeChange('pool')} disabled={isRunning} />
            Continuous Pool
          </label>
          <label className="radio-label" title="Time-based load profiles: ramp-up, sustained, spike, soak">
            <input type="radio" name="execMode" checked={executionMode === 'load-profile'} onChange={() => onExecutionModeChange('load-profile')} disabled={isRunning} />
            Load Profile
          </label>
          <label className="radio-label" title="Multi-step workflow with variable chaining between requests">
            <input type="radio" name="execMode" checked={executionMode === 'workflow'} onChange={() => onExecutionModeChange('workflow')} disabled={isRunning} />
            Workflow
          </label>
          <span className="exec-mode-hint">
            {executionMode === 'sequential'
              ? 'Executes one request at a time in order — no parallelism'
              : executionMode === 'batch'
                ? 'Fires N requests, waits for all to complete, then fires next N'
                : executionMode === 'pool'
                  ? 'Keeps N requests in-flight at all times — a new request starts as soon as one finishes'
                  : executionMode === 'workflow'
                    ? 'Multi-step chain: each request can extract values for the next step'
                    : 'Time-based execution with dynamic concurrency shaping'}
          </span>
        </div>
      </div>

      <div className="resilience-config">
        <div className="resilience-row">
          <div className="resilience-field resilience-field-sm">
            <label>Concurrency</label>
            <input type="number" min={1} max={100} value={executionMode === 'sequential' ? 1 : concurrency} onChange={(e) => onConcurrencyChange(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || executionMode === 'sequential' || isLoadProfile} />
            {executionMode === 'sequential' && <span className="field-hint">Fixed to 1</span>}
            {isLoadProfile && <span className="field-hint">Set in profile</span>}
          </div>
          <div className="resilience-field resilience-field-sm">
            <label>Transactions</label>
            <input type="number" min={1} max={100000} value={totalTransactions} onChange={(e) => onTotalTransactionsChange(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || isLoadProfile} />
            {!isLoadProfile && totalTransactions < activeTestCount && <span className="field-hint">{activeTestCount} active</span>}
            {isLoadProfile && <span className="field-hint">Time-based</span>}
          </div>
          <div className="resilience-divider" />
          <div className="resilience-field resilience-field-sm">
            <label>Timeout</label>
            <div className="input-with-unit">
              <input type="number" min={0} max={300} value={timeoutSec} onChange={(e) => onTimeoutSecChange(Math.max(0, parseInt(e.target.value) || 0))} disabled={isRunning} />
              <span className="unit">sec</span>
            </div>
            {timeoutSec === 0 && <span className="field-hint">No timeout</span>}
          </div>
          <div className="resilience-field resilience-field-sm">
            <label>Retry</label>
            <div className="input-with-unit">
              <input type="number" min={0} max={10} value={retryCount} onChange={(e) => onRetryCountChange(Math.max(0, parseInt(e.target.value) || 0))} disabled={isRunning} />
              <span className="unit">times</span>
            </div>
            {retryCount === 0 && <span className="field-hint">No retry</span>}
          </div>
          {retryCount > 0 && (
            <div className="resilience-field resilience-field-sm">
              <label>Retry Delay</label>
              <div className="input-with-unit">
                <input type="number" min={0} max={30000} step={100} value={retryDelayMs} onChange={(e) => onRetryDelayMsChange(Math.max(0, parseInt(e.target.value) || 0))} disabled={isRunning} />
                <span className="unit">ms</span>
              </div>
            </div>
          )}
          <div className="resilience-divider" />
          <div className="resilience-field" style={{ flex: '0 0 auto' }}>
            <label>On Error</label>
            <div className="error-policy-options">
              <label className="radio-label">
                <input type="radio" name="errorPolicy" checked={errorPolicy === 'continue'} onChange={() => onErrorPolicyChange('continue')} disabled={isRunning} />
                Continue
              </label>
              <label className="radio-label">
                <input type="radio" name="errorPolicy" checked={errorPolicy === 'stop-first'} onChange={() => onErrorPolicyChange('stop-first')} disabled={isRunning} />
                Stop 1st
              </label>
              <label className="radio-label">
                <input type="radio" name="errorPolicy" checked={errorPolicy === 'stop-threshold'} onChange={() => onErrorPolicyChange('stop-threshold')} disabled={isRunning} />
                Threshold
              </label>
            </div>
          </div>
          <div className="resilience-field resilience-field-xs">
            <label>Max Errors</label>
            <input type="number" min={1} max={10000} value={maxErrors} onChange={(e) => onMaxErrorsChange(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || errorPolicy !== 'stop-threshold'} />
          </div>
          <div className="resilience-field resilience-field-xs">
            <label>Error Rate</label>
            <div className="input-with-unit">
              <input type="number" min={1} max={100} value={maxErrorRate} onChange={(e) => onMaxErrorRateChange(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || errorPolicy !== 'stop-threshold'} />
              <span className="unit">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="think-time-section">
        <div className="resilience-row">
          <div className="resilience-field" style={{ flex: '0 0 auto' }}>
            <label>Think Time</label>
            <div className="error-policy-options">
              {(['none', 'constant', 'uniform', 'gaussian'] as ThinkTimeMode[]).map((m) => (
                <label key={m} className="radio-label">
                  <input
                    type="radio"
                    name="thinkTimeMode"
                    checked={thinkTime.mode === m}
                    onChange={() => onThinkTimeChange({ mode: m })}
                    disabled={isRunning}
                  />
                  {m === 'none' ? 'None' : m === 'constant' ? 'Constant' : m === 'uniform' ? 'Uniform' : 'Gaussian'}
                </label>
              ))}
            </div>
          </div>
          {thinkTime.mode === 'constant' && (
            <div className="resilience-field resilience-field-sm">
              <label>Delay</label>
              <div className="input-with-unit">
                <input
                  type="number" min={0} max={60000} step={100}
                  value={thinkTime.constantMs ?? 1000}
                  onChange={(e) => onThinkTimeChange({ constantMs: Math.max(0, parseInt(e.target.value) || 0) })}
                  disabled={isRunning}
                />
                <span className="unit">ms</span>
              </div>
            </div>
          )}
          {thinkTime.mode === 'uniform' && (
            <>
              <div className="resilience-field resilience-field-sm">
                <label>Min</label>
                <div className="input-with-unit">
                  <input
                    type="number" min={0} max={60000} step={100}
                    value={thinkTime.minMs ?? 500}
                    onChange={(e) => onThinkTimeChange({ minMs: Math.max(0, parseInt(e.target.value) || 0) })}
                    disabled={isRunning}
                  />
                  <span className="unit">ms</span>
                </div>
              </div>
              <div className="resilience-field resilience-field-sm">
                <label>Max</label>
                <div className="input-with-unit">
                  <input
                    type="number" min={0} max={60000} step={100}
                    value={thinkTime.maxMs ?? 2000}
                    onChange={(e) => onThinkTimeChange({ maxMs: Math.max(0, parseInt(e.target.value) || 0) })}
                    disabled={isRunning}
                  />
                  <span className="unit">ms</span>
                </div>
              </div>
            </>
          )}
          {thinkTime.mode === 'gaussian' && (
            <>
              <div className="resilience-field resilience-field-sm">
                <label>Mean</label>
                <div className="input-with-unit">
                  <input
                    type="number" min={0} max={60000} step={100}
                    value={thinkTime.meanMs ?? 1000}
                    onChange={(e) => onThinkTimeChange({ meanMs: Math.max(0, parseInt(e.target.value) || 0) })}
                    disabled={isRunning}
                  />
                  <span className="unit">ms</span>
                </div>
              </div>
              <div className="resilience-field resilience-field-sm">
                <label>Std Dev</label>
                <div className="input-with-unit">
                  <input
                    type="number" min={0} max={30000} step={50}
                    value={thinkTime.stdDevMs ?? 300}
                    onChange={(e) => onThinkTimeChange({ stdDevMs: Math.max(0, parseInt(e.target.value) || 0) })}
                    disabled={isRunning}
                  />
                  <span className="unit">ms</span>
                </div>
              </div>
            </>
          )}
        </div>
        {thinkTime.mode !== 'none' && (
          <span className="exec-mode-hint">
            {thinkTime.mode === 'constant'
              ? `Fixed ${thinkTime.constantMs ?? 1000}ms delay after each request`
              : thinkTime.mode === 'uniform'
                ? `Random delay between ${thinkTime.minMs ?? 500}ms – ${thinkTime.maxMs ?? 2000}ms`
                : `Normal distribution: mean ${thinkTime.meanMs ?? 1000}ms, σ ${thinkTime.stdDevMs ?? 300}ms`}
          </span>
        )}
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
                    <input
                      type="number" min={5} max={3600}
                      value={loadProfile.durationSec}
                      onChange={(e) => onLoadProfileChange({ durationSec: parseInt(e.target.value) || 0 })}
                      onBlur={() => onLoadProfileChange({ durationSec: Math.min(3600, Math.max(5, loadProfile.durationSec || 5)) })}
                      disabled={isRunning}
                    />
                  </div>
                  <div className="profile-field">
                    <label>{loadProfile.type === 'spike' ? 'Base Concurrency' : 'Max Concurrency'}</label>
                    <input
                      type="number" min={1} max={100}
                      value={loadProfile.maxConcurrency}
                      onChange={(e) => onLoadProfileChange({ maxConcurrency: parseInt(e.target.value) || 0 })}
                      onBlur={() => onLoadProfileChange({ maxConcurrency: Math.min(100, Math.max(1, loadProfile.maxConcurrency || 1)) })}
                      disabled={isRunning}
                    />
                  </div>
                  {loadProfile.type === 'ramp-up' && (
                    <div className="profile-field">
                      <label>Ramp (sec)</label>
                      <input
                        type="number" min={1} max={loadProfile.durationSec}
                        value={loadProfile.rampUpSec ?? 30}
                        onChange={(e) => onLoadProfileChange({ rampUpSec: parseInt(e.target.value) || 0 })}
                        onBlur={() => onLoadProfileChange({ rampUpSec: Math.min(loadProfile.durationSec, Math.max(1, loadProfile.rampUpSec || 1)) })}
                        disabled={isRunning}
                      />
                    </div>
                  )}
                  {loadProfile.type === 'spike' && (
                    <>
                      <div className="profile-field">
                        <label>Spike Concurrency</label>
                        <input
                          type="number" min={1} max={500}
                          value={loadProfile.spikeConcurrency ?? 30}
                          onChange={(e) => onLoadProfileChange({ spikeConcurrency: parseInt(e.target.value) || 0 })}
                          onBlur={() => onLoadProfileChange({ spikeConcurrency: Math.min(500, Math.max(1, loadProfile.spikeConcurrency || 1)) })}
                          disabled={isRunning}
                        />
                      </div>
                      <div className="profile-field">
                        <label>Spike Start (sec)</label>
                        <input
                          type="number" min={0} max={loadProfile.durationSec}
                          value={loadProfile.spikeStartSec ?? 20}
                          onChange={(e) => onLoadProfileChange({ spikeStartSec: parseInt(e.target.value) || 0 })}
                          onBlur={() => onLoadProfileChange({ spikeStartSec: Math.min(loadProfile.durationSec, Math.max(0, loadProfile.spikeStartSec || 0)) })}
                          disabled={isRunning}
                        />
                      </div>
                      <div className="profile-field">
                        <label>Spike Duration (sec)</label>
                        <input
                          type="number" min={1} max={loadProfile.durationSec}
                          value={loadProfile.spikeDurationSec ?? 10}
                          onChange={(e) => onLoadProfileChange({ spikeDurationSec: parseInt(e.target.value) || 0 })}
                          onBlur={() => onLoadProfileChange({ spikeDurationSec: Math.min(loadProfile.durationSec, Math.max(1, loadProfile.spikeDurationSec || 1)) })}
                          disabled={isRunning}
                        />
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
