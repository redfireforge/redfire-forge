import { useState, useMemo, useEffect } from 'react';
import type { AuthConfig, ExecutionMode, ErrorPolicy, FeatureGroup, GlobalAuthProfile, Scenario, TestConfig, ScenarioWeight, LoadProfileConfig, LoadProfileType } from '../types';
import { useTestExecution } from '../hooks/useTestExecution';
import { saveRunnerConfig, loadRunnerConfig as loadRunnerConfigAsync } from '../utils/storage';
import { LiveCharts } from '../components/LiveCharts';
import { ProfilePreview } from '../components/ProfilePreview';
import { type PersistedProgress, profileDescriptions, saveProgress, loadProgress, clearProgress } from '../utils/runnerProgressStorage';

type HostMode = 'hardcoded' | 'settings' | 'custom';

const defaultLoadProfile: LoadProfileConfig = {
  type: 'sustained',
  durationSec: 60,
  maxConcurrency: 5,
  rampUpSec: 30,
  spikeConcurrency: 10,
  spikeStartSec: 20,
  spikeDurationSec: 10,
};

interface RunnerConfig {
  concurrency: number;
  totalTransactions: number;
  selectedScenarios: string[];
  weights: Record<string, number>;
  skipValidation: boolean;
  hostMode: HostMode;
  customBaseUrl: string;
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
  timeoutSec?: number;
  retryCount?: number;
  retryDelayMs?: number;
  errorPolicy?: ErrorPolicy;
  maxErrors?: number;
  maxErrorRate?: number;
}

const defaultConfig: RunnerConfig = {
  concurrency: 1, totalTransactions: 1, selectedScenarios: [], weights: {},
  skipValidation: false, hostMode: 'settings', customBaseUrl: '', executionMode: 'batch',
};

interface Props {
  featureGroups: FeatureGroup[];
  onComplete: () => void;
  envName?: string;
  svcName?: string;
  projectName?: string;
  projectId?: string;
  envId?: string;
  svcId?: string;
  resolvedBaseUrl?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}

function replaceHost(testUrl: string, baseUrl: string): string {
  if (!baseUrl) return testUrl;
  try {
    const original = new URL(testUrl);
    const base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    original.protocol = base.protocol;
    original.host = base.host;
    const basePath = base.pathname.replace(/\/+$/, '');
    if (basePath && !original.pathname.startsWith(basePath)) {
      original.pathname = basePath + original.pathname;
    }
    return original.toString();
  } catch {
    return testUrl;
  }
}

// ---------------------------------------------------------------------------
// TestRunner Component
// ---------------------------------------------------------------------------

export default function TestRunner({ featureGroups, onComplete, envName, svcName, projectName, projectId, envId, svcId, resolvedBaseUrl, globalAuthProfiles = [] }: Props) {
  const configContextKey = [projectId, envId, svcId].filter(Boolean).join(':') || undefined;
  const progressKey = configContextKey || '_default';

  const [concurrency, setConcurrency] = useState(defaultConfig.concurrency);
  const [totalTransactions, setTotalTransactions] = useState(defaultConfig.totalTransactions);
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [skipValidation, setSkipValidation] = useState(false);
  const [hostMode, setHostMode] = useState<HostMode>('settings');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('batch');
  const [loadProfile, setLoadProfile] = useState<LoadProfileConfig>({ ...defaultLoadProfile });
  const [timeoutSec, setTimeoutSec] = useState(10);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelayMs, setRetryDelayMs] = useState(1000);
  const [errorPolicy, setErrorPolicy] = useState<ErrorPolicy>('continue');
  const [maxErrors, setMaxErrors] = useState(10);
  const [maxErrorRate, setMaxErrorRate] = useState(50);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(() => new Set(featureGroups.map(fg => fg.id)));
  const [configLoaded, setConfigLoaded] = useState(false);
  const [weightsExpanded, setWeightsExpanded] = useState(true);
  const [savedProgress, setSavedProgress] = useState<PersistedProgress | null>(null);

  const { isRunning, completed, total, liveSummary, profileMeta, timeSeries, error, execute, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun } = useTestExecution();

  useEffect(() => {
    setSavedProgress(loadProgress(progressKey));
  }, [progressKey]);

  useEffect(() => {
    if (finalRun && liveSummary && !isRunning) {
      const data: PersistedProgress = {
        summary: liveSummary,
        timeSeries,
        completed,
        total,
        profileMeta,
        isTimeBased: executionMode === 'load-profile',
        executionMode,
        concurrency,
        loadProfile,
        resultCount: finalRun.results.length,
        durationMs: finalRun.summary.totalDurationMs,
      };
      saveProgress(progressKey, data);
      setSavedProgress(data);
    }
  }, [finalRun, isRunning]);

  const handleClearProgress = () => {
    clearProgress(progressKey);
    setSavedProgress(null);
  };

  useEffect(() => {
    setConfigLoaded(false);
    loadRunnerConfigAsync(configContextKey).then((raw) => {
      if (raw) {
        const saved = raw as RunnerConfig;
        setConcurrency(saved.concurrency ?? defaultConfig.concurrency);
        setTotalTransactions(saved.totalTransactions ?? defaultConfig.totalTransactions);
        setSelectedScenarios(new Set(saved.selectedScenarios ?? []));
        setWeights(saved.weights ?? {});
        setSkipValidation(saved.skipValidation ?? false);
        setHostMode(saved.hostMode ?? 'settings');
        setCustomBaseUrl(saved.customBaseUrl ?? '');
        setExecutionMode(saved.executionMode ?? 'batch');
        if (saved.loadProfile) setLoadProfile(saved.loadProfile);
        setTimeoutSec(saved.timeoutSec ?? 10);
        setRetryCount(saved.retryCount ?? 0);
        setRetryDelayMs(saved.retryDelayMs ?? 1000);
        setErrorPolicy(saved.errorPolicy ?? 'continue');
        setMaxErrors(saved.maxErrors ?? 10);
        setMaxErrorRate(saved.maxErrorRate ?? 50);
      } else {
        setConcurrency(defaultConfig.concurrency);
        setTotalTransactions(defaultConfig.totalTransactions);
        setSelectedScenarios(new Set());
        setWeights({});
        setSkipValidation(defaultConfig.skipValidation);
        setHostMode(defaultConfig.hostMode);
        setCustomBaseUrl(defaultConfig.customBaseUrl);
        setExecutionMode(defaultConfig.executionMode);
        setLoadProfile({ ...defaultLoadProfile });
        setTimeoutSec(10);
        setRetryCount(0);
        setRetryDelayMs(1000);
        setErrorPolicy('continue');
        setMaxErrors(10);
        setMaxErrorRate(50);
      }
      setConfigLoaded(true);
    });
  }, [configContextKey]);

  useEffect(() => {
    if (!configLoaded) return;
    void saveRunnerConfig({
      concurrency,
      totalTransactions,
      selectedScenarios: Array.from(selectedScenarios),
      weights,
      skipValidation,
      hostMode,
      customBaseUrl,
      executionMode,
      loadProfile,
      timeoutSec,
      retryCount,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
    }, configContextKey);
  }, [configLoaded, configContextKey, concurrency, totalTransactions, selectedScenarios, weights, skipValidation, hostMode, customBaseUrl, executionMode, loadProfile, timeoutSec, retryCount, retryDelayMs, errorPolicy, maxErrors, maxErrorRate]);

  const selectedTests: Scenario[] = useMemo(() => {
    const resolveAuth = (test: Scenario, sc: { auth?: AuthConfig }, fg: FeatureGroup): AuthConfig => {
      if (test.auth.type !== 'inherit' && test.auth.type !== 'none') return test.auth;
      const scAuth = sc.auth;
      if (scAuth && scAuth.type !== 'none' && scAuth.type !== 'inherit') return scAuth as AuthConfig;
      const fgAuth = fg.auth;
      if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') return fgAuth as AuthConfig;
      if (fg.globalAuthProfileId) {
        const profile = globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
        if (profile && profile.auth.type !== 'none') return profile.auth;
      }
      return { type: 'none' };
    };
    const tests: Scenario[] = [];
    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        if (selectedScenarios.has(sc.id)) {
          for (const test of sc.tests) {
            const effectiveBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || '') : hostMode === 'custom' ? customBaseUrl.trim() : '';
            const url = effectiveBaseUrl ? replaceHost(test.url, effectiveBaseUrl) : test.url;
            const validation = skipValidation ? { mode: 'none' as const } : test.validation;
            const auth = resolveAuth(test, sc, fg);
            tests.push({ ...test, url, auth, validation, featureGroupName: fg.name, groupName: sc.name });
          }
        }
      }
    }
    return tests;
  }, [featureGroups, selectedScenarios, resolvedBaseUrl, skipValidation, hostMode, customBaseUrl, globalAuthProfiles]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    const w: Record<string, number> = {};
    selectedTests.forEach((t) => (w[t.id] = weights[t.id] ?? 1));
    if (JSON.stringify(w) !== JSON.stringify(weights)) {
      setWeights(w);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTests]);

  const toggleFeature = (featureId: string) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      next.has(featureId) ? next.delete(featureId) : next.add(featureId);
      return next;
    });
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      next.has(scenarioId) ? next.delete(scenarioId) : next.add(scenarioId);
      return next;
    });
  };

  const toggleAllInFeature = (fg: FeatureGroup) => {
    const allSelected = fg.scenarios.every((sc) => selectedScenarios.has(sc.id));
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      fg.scenarios.forEach((sc) => {
        if (allSelected) next.delete(sc.id); else next.add(sc.id);
      });
      return next;
    });
  };

  const selectAll = () => {
    const allIds = featureGroups.flatMap((fg) => fg.scenarios.map((sc) => sc.id));
    setSelectedScenarios(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedScenarios(new Set());
  };

  const activeTestCount = selectedTests.filter((t) => (weights[t.id] ?? 1) > 0).length;
  const isLoadProfile = executionMode === 'load-profile';

  const handleRun = () => {
    const scenarioWeights: ScenarioWeight[] = selectedTests.map((t) => ({
      scenarioId: t.id,
      weight: weights[t.id] ?? 1,
    }));
    const config: TestConfig = {
      concurrency: isLoadProfile ? loadProfile.maxConcurrency : concurrency,
      totalTransactions: isLoadProfile ? 0 : totalTransactions,
      scenarioWeights,
      executionMode,
      ...(isLoadProfile ? { loadProfile } : {}),
      timeoutSec: timeoutSec > 0 ? timeoutSec : undefined,
      retryCount: retryCount > 0 ? retryCount : 0,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
    };
    const usedBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || undefined) : hostMode === 'custom' ? (customBaseUrl.trim() || undefined) : undefined;
    execute(config, selectedTests, { projectName, envName, svcName, baseUrl: usedBaseUrl });
  };

  const isTimeBased = isLoadProfile || (isRunning && total === -1);

  const hasLiveProgress = isRunning || liveSummary;
  const showProgress = hasLiveProgress || (!isRunning && savedProgress);

  const displaySummary = liveSummary ?? savedProgress?.summary ?? null;
  const displayTimeSeries = timeSeries.length > 0 ? timeSeries : savedProgress?.timeSeries ?? [];
  const displayCompleted = hasLiveProgress ? completed : savedProgress?.completed ?? 0;
  const displayTotal = hasLiveProgress ? total : savedProgress?.total ?? 0;
  const displayProfileMeta = profileMeta ?? savedProgress?.profileMeta ?? null;
  const displayIsTimeBased = hasLiveProgress ? isTimeBased : savedProgress?.isTimeBased ?? false;
  const displayProgressPct = displayIsTimeBased
    ? (displayProfileMeta ? Math.min(100, Math.round((displayProfileMeta.elapsedMs / displayProfileMeta.durationMs) * 100)) : 0)
    : (displayTotal > 0 ? Math.round((displayCompleted / displayTotal) * 100) : 0);

  const displayExecMode = hasLiveProgress ? executionMode : savedProgress?.executionMode ?? executionMode;
  const displayConc = hasLiveProgress ? concurrency : savedProgress?.concurrency ?? concurrency;
  const displayLoadProfile = hasLiveProgress ? loadProfile : savedProgress?.loadProfile ?? loadProfile;
  const hasAnyTests = featureGroups.some((fg) => fg.scenarios.some((sc) => sc.tests.length > 0));

  const updateProfile = (patch: Partial<LoadProfileConfig>) => {
    setLoadProfile((prev) => ({ ...prev, ...patch }));
  };

  const profileLabel = (type: LoadProfileType): string => {
    switch (type) {
      case 'ramp-up': return 'Ramp-Up';
      case 'sustained': return 'Sustained';
      case 'spike': return 'Spike';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Test Runner</h2>
        <div className="context-tags">
          {projectName && <span className="context-tag project-tag">{projectName}</span>}
          {svcName && <span className="context-tag svc-tag">{svcName}</span>}
          {envName && <span className="context-tag env-tag">{envName}</span>}
        </div>
      </div>
      <div className="runner-host-selector">
        <span className="runner-host-label">Host:</span>
        <label className="radio-label">
          <input type="radio" name="hostMode" checked={hostMode === 'hardcoded'} onChange={() => setHostMode('hardcoded')} disabled={isRunning} />
          Original
        </label>
        <label className={`radio-label ${!resolvedBaseUrl ? 'disabled' : ''}`}>
          <input type="radio" name="hostMode" checked={hostMode === 'settings'} onChange={() => setHostMode('settings')} disabled={isRunning || !resolvedBaseUrl} />
          Settings
          {resolvedBaseUrl
            ? <code className="runner-host-url">{resolvedBaseUrl}</code>
            : <span className="option-hint"> — configure base URL in Settings first</span>
          }
        </label>
        <label className="radio-label">
          <input type="radio" name="hostMode" checked={hostMode === 'custom'} onChange={() => setHostMode('custom')} disabled={isRunning} />
          Custom
        </label>
        {(
          <input
            className="runner-custom-url-input"
            type="text"
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            placeholder="https://my-host.example.com:8080"
            disabled={isRunning || hostMode !== 'custom'}
          />
        )}
      </div>

      <div className="execution-group">
      <div className="runner-option-boxes">
        <div className="runner-option-box" style={{ flex: 1 }}>
          <span className="runner-exec-label">Execution Mode:</span>
          <label className="radio-label" title="Executes requests one by one in sequence. No parallelism.">
            <input type="radio" name="execMode" checked={executionMode === 'sequential'} onChange={() => setExecutionMode('sequential')} disabled={isRunning} />
            Sequential
          </label>
          <label className="radio-label" title="Fires N requests, waits for ALL to finish, then fires the next N.">
            <input type="radio" name="execMode" checked={executionMode === 'batch'} onChange={() => setExecutionMode('batch')} disabled={isRunning} />
            Batch
          </label>
          <label className="radio-label" title="Maintains N concurrent requests at all times.">
            <input type="radio" name="execMode" checked={executionMode === 'pool'} onChange={() => setExecutionMode('pool')} disabled={isRunning} />
            Continuous Pool
          </label>
          <label className="radio-label" title="Time-based load profiles: ramp-up, sustained, spike, soak">
            <input type="radio" name="execMode" checked={executionMode === 'load-profile'} onChange={() => setExecutionMode('load-profile')} disabled={isRunning} />
            Load Profile
          </label>
          <span className="exec-mode-hint">
            {executionMode === 'sequential'
              ? 'Executes one request at a time in order — no parallelism'
              : executionMode === 'batch'
                ? 'Fires N requests, waits for all to complete, then fires next N'
                : executionMode === 'pool'
                  ? 'Keeps N requests in-flight at all times — a new request starts as soon as one finishes'
                  : 'Time-based execution with dynamic concurrency shaping'}
          </span>
        </div>
      </div>

      {/* Concurrency, Transactions, Timeout, Retry, Error Policy */}
      <div className="resilience-config">
        <div className="resilience-row">
          <div className="resilience-field resilience-field-sm">
            <label>Concurrency</label>
            <input type="number" min={1} max={100} value={executionMode === 'sequential' ? 1 : concurrency} onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || executionMode === 'sequential' || isLoadProfile} />
            {executionMode === 'sequential' && <span className="field-hint">Fixed to 1</span>}
            {isLoadProfile && <span className="field-hint">Set in profile</span>}
          </div>
          <div className="resilience-field resilience-field-sm">
            <label>Transactions</label>
            <input type="number" min={1} max={100000} value={totalTransactions} onChange={(e) => setTotalTransactions(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || isLoadProfile} />
            {!isLoadProfile && totalTransactions < activeTestCount && <span className="field-hint">{activeTestCount} active</span>}
            {isLoadProfile && <span className="field-hint">Time-based</span>}
          </div>
          <div className="resilience-divider" />
          <div className="resilience-field resilience-field-sm">
            <label>Timeout</label>
            <div className="input-with-unit">
              <input type="number" min={0} max={300} value={timeoutSec} onChange={(e) => setTimeoutSec(Math.max(0, parseInt(e.target.value) || 0))} disabled={isRunning} />
              <span className="unit">sec</span>
            </div>
            {timeoutSec === 0 && <span className="field-hint">No timeout</span>}
          </div>
          <div className="resilience-field resilience-field-sm">
            <label>Retry</label>
            <div className="input-with-unit">
              <input type="number" min={0} max={10} value={retryCount} onChange={(e) => setRetryCount(Math.max(0, parseInt(e.target.value) || 0))} disabled={isRunning} />
              <span className="unit">times</span>
            </div>
            {retryCount === 0 && <span className="field-hint">No retry</span>}
          </div>
          {retryCount > 0 && (
            <div className="resilience-field resilience-field-sm">
              <label>Retry Delay</label>
              <div className="input-with-unit">
                <input type="number" min={0} max={30000} step={100} value={retryDelayMs} onChange={(e) => setRetryDelayMs(Math.max(0, parseInt(e.target.value) || 0))} disabled={isRunning} />
                <span className="unit">ms</span>
              </div>
            </div>
          )}
          <div className="resilience-divider" />
          <div className="resilience-field" style={{ flex: '0 0 auto' }}>
            <label>On Error</label>
            <div className="error-policy-options">
              <label className="radio-label">
                <input type="radio" name="errorPolicy" checked={errorPolicy === 'continue'} onChange={() => setErrorPolicy('continue')} disabled={isRunning} />
                Continue
              </label>
              <label className="radio-label">
                <input type="radio" name="errorPolicy" checked={errorPolicy === 'stop-first'} onChange={() => setErrorPolicy('stop-first')} disabled={isRunning} />
                Stop 1st
              </label>
              <label className="radio-label">
                <input type="radio" name="errorPolicy" checked={errorPolicy === 'stop-threshold'} onChange={() => setErrorPolicy('stop-threshold')} disabled={isRunning} />
                Threshold
              </label>
            </div>
          </div>
          <div className="resilience-field resilience-field-xs">
            <label>Max Errors</label>
            <input type="number" min={1} max={10000} value={maxErrors} onChange={(e) => setMaxErrors(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || errorPolicy !== 'stop-threshold'} />
          </div>
          <div className="resilience-field resilience-field-xs">
            <label>Error Rate</label>
            <div className="input-with-unit">
              <input type="number" min={1} max={100} value={maxErrorRate} onChange={(e) => setMaxErrorRate(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || errorPolicy !== 'stop-threshold'} />
              <span className="unit">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Load Profile config */}
      {isLoadProfile && (
        <div className="load-profile-section">
          <div className="load-profile-body">
            <div className="load-profile-controls">
              <div className="profile-type-selector">
                {(['ramp-up', 'sustained', 'spike'] as LoadProfileType[]).map((pt) => (
                  <button
                    key={pt}
                    className={`profile-type-btn ${loadProfile.type === pt ? 'active' : ''}`}
                    onClick={() => updateProfile({ type: pt })}
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
                      onChange={(e) => updateProfile({ durationSec: parseInt(e.target.value) || 0 })}
                      onBlur={() => updateProfile({ durationSec: Math.min(3600, Math.max(5, loadProfile.durationSec || 5)) })}
                      disabled={isRunning}
                    />
                  </div>
                  <div className="profile-field">
                    <label>{loadProfile.type === 'spike' ? 'Base Concurrency' : 'Max Concurrency'}</label>
                    <input
                      type="number" min={1} max={100}
                      value={loadProfile.maxConcurrency}
                      onChange={(e) => updateProfile({ maxConcurrency: parseInt(e.target.value) || 0 })}
                      onBlur={() => updateProfile({ maxConcurrency: Math.min(100, Math.max(1, loadProfile.maxConcurrency || 1)) })}
                      disabled={isRunning}
                    />
                  </div>
                  {loadProfile.type === 'ramp-up' && (
                    <div className="profile-field">
                      <label>Ramp (sec)</label>
                      <input
                        type="number" min={1} max={loadProfile.durationSec}
                        value={loadProfile.rampUpSec ?? 30}
                        onChange={(e) => updateProfile({ rampUpSec: parseInt(e.target.value) || 0 })}
                        onBlur={() => updateProfile({ rampUpSec: Math.min(loadProfile.durationSec, Math.max(1, loadProfile.rampUpSec || 1)) })}
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
                          onChange={(e) => updateProfile({ spikeConcurrency: parseInt(e.target.value) || 0 })}
                          onBlur={() => updateProfile({ spikeConcurrency: Math.min(500, Math.max(1, loadProfile.spikeConcurrency || 1)) })}
                          disabled={isRunning}
                        />
                      </div>
                      <div className="profile-field">
                        <label>Spike Start (sec)</label>
                        <input
                          type="number" min={0} max={loadProfile.durationSec}
                          value={loadProfile.spikeStartSec ?? 20}
                          onChange={(e) => updateProfile({ spikeStartSec: parseInt(e.target.value) || 0 })}
                          onBlur={() => updateProfile({ spikeStartSec: Math.min(loadProfile.durationSec, Math.max(0, loadProfile.spikeStartSec || 0)) })}
                          disabled={isRunning}
                        />
                      </div>
                      <div className="profile-field">
                        <label>Spike Duration (sec)</label>
                        <input
                          type="number" min={1} max={loadProfile.durationSec}
                          value={loadProfile.spikeDurationSec ?? 10}
                          onChange={(e) => updateProfile({ spikeDurationSec: parseInt(e.target.value) || 0 })}
                          onBlur={() => updateProfile({ spikeDurationSec: Math.min(loadProfile.durationSec, Math.max(1, loadProfile.spikeDurationSec || 1)) })}
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

      {!hasAnyTests ? (
        <div className="empty-state">No tests defined. Go to Feature Groups tab to add some first.</div>
      ) : (
        <>
          {/* Scenario selection */}
          <div className="config-form">
            <div className="selection-header">
              <h3>Select Scenarios to Test</h3>
              <div className="selection-actions">
                <button className="btn btn-sm" onClick={selectAll} disabled={isRunning}>Select All</button>
                <button className="btn btn-sm" onClick={deselectAll} disabled={isRunning}>Deselect All</button>
                <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={skipValidation}
                    onChange={(e) => setSkipValidation(e.target.checked)}
                    disabled={isRunning}
                  />
                  Skip validation
                </label>
                <span className="filter-count">
                  {selectedScenarios.size} scenario{selectedScenarios.size !== 1 ? 's' : ''} selected
                  ({selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            <div className="selection-tree">
              {featureGroups.map((fg) => {
                if (fg.scenarios.length === 0) return null;
                const allSelected = fg.scenarios.length > 0 && fg.scenarios.every((sc) => selectedScenarios.has(sc.id));
                const someSelected = fg.scenarios.some((sc) => selectedScenarios.has(sc.id));
                return (
                  <div key={fg.id} className="selection-feature">
                    <div className="selection-feature-header">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={() => toggleAllInFeature(fg)}
                          disabled={isRunning}
                        />
                        <strong>{fg.name}</strong>
                      </label>
                      <span className="expand-toggle" onClick={() => toggleFeature(fg.id)}>
                        {expandedFeatures.has(fg.id) ? '−' : '+'}
                      </span>
                    </div>
                    {expandedFeatures.has(fg.id) && (
                      <div className="selection-scenarios">
                        {fg.scenarios.map((sc) => {
                          if (sc.tests.length === 0) return null;
                          return (
                            <div key={sc.id} className="selection-scenario">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={selectedScenarios.has(sc.id)}
                                  onChange={() => toggleScenario(sc.id)}
                                  disabled={isRunning}
                                />
                                <span>{sc.name}</span>
                                <span className="count-badge">{sc.tests.length} test{sc.tests.length !== 1 ? 's' : ''}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Config */}
          {selectedTests.length > 0 && (
            <div className="config-form" style={{ marginTop: 16 }}>

              <fieldset>
                <legend
                  className="collapsible-legend"
                  onClick={() => setWeightsExpanded((v) => !v)}
                >
                  <span className={`collapse-arrow ${weightsExpanded ? 'expanded' : ''}`}>▶</span>
                  Test Distribution (weights)
                  <span className="collapse-count">{selectedTests.length} tests</span>
                </legend>
                {weightsExpanded && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button className="btn btn-xs" disabled={isRunning} onClick={() => { const w: Record<string, number> = {}; selectedTests.forEach((t) => w[t.id] = 1); setWeights(w); }}>Reset All to 1</button>
                      <button className="btn btn-xs" disabled={isRunning} onClick={() => { const w: Record<string, number> = {}; selectedTests.forEach((t) => w[t.id] = 0); setWeights(w); }}>Reset All to 0</button>
                    </div>
                    {selectedTests.map((t, idx) => (
                      <div key={t.id} className="weight-row">
                        <div className="weight-label">
                          <span className="test-number">{idx + 1}</span>
                          <span className={`method-badge method-${t.method.toLowerCase()}`}>{t.method}</span>
                          {t.name}
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={weights[t.id] ?? 1}
                          onChange={(e) => setWeights({ ...weights, [t.id]: Math.max(0, parseInt(e.target.value) || 0) })}
                          disabled={isRunning}
                          className="weight-input"
                        />
                      </div>
                    ))}
                  </>
                )}
              </fieldset>

              <div className="form-actions">
                {!isRunning ? (
                  <button className="btn btn-primary btn-lg" onClick={handleRun} disabled={selectedTests.length === 0}>
                    ▶ Run Test
                  </button>
                ) : (
                  <button className="btn btn-danger btn-lg" onClick={abort}>
                    ■ Stop
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {showProgress && (
            <div className="progress-section">
              <div className="progress-header-row">
                <h3>Progress <span className="progress-mode-tag">
                  {displayIsTimeBased ? (
                    <>
                      {profileLabel(displayLoadProfile.type)}
                      {' · '}Peak:{displayLoadProfile.maxConcurrency}
                      {' · '}{displayLoadProfile.durationSec}s
                      {displayLoadProfile.type === 'ramp-up' && ` · ramp ${displayLoadProfile.rampUpSec ?? displayLoadProfile.durationSec}s`}
                      {displayLoadProfile.type === 'spike' && ` · spike to ${displayLoadProfile.spikeConcurrency ?? displayLoadProfile.maxConcurrency * 3}`}
                    </>
                  ) : (
                    <>
                      {displayExecMode === 'pool' ? 'Continuous Pool' : displayExecMode === 'sequential' ? 'Sequential' : 'Batch'}
                      {' · '}C:{displayExecMode === 'sequential' ? 1 : displayConc}
                      {' · '}T:{displayTotal}
                    </>
                  )}
                </span>
                <span className="progress-host-tag">
                  {hostMode === 'settings' && resolvedBaseUrl ? resolvedBaseUrl : hostMode === 'custom' && customBaseUrl.trim() ? customBaseUrl.trim() : 'Original'}
                </span>
                </h3>
                {!isRunning && savedProgress && (
                  <button className="btn btn-xs btn-ghost" onClick={handleClearProgress} title="Clear progress">✕ Clear</button>
                )}
              </div>

              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${displayProgressPct}%` }}></div>
                <span className="progress-text">
                  {displayIsTimeBased ? (
                    <>
                      {displayProfileMeta ? `${(displayProfileMeta.elapsedMs / 1000).toFixed(1)}s` : '0s'} / {displayProfileMeta ? (displayProfileMeta.durationMs / 1000).toFixed(0) : displayLoadProfile.durationSec}s
                      {' '}({displayCompleted} requests)
                    </>
                  ) : (
                    <>{displayCompleted} / {displayTotal} ({displayProgressPct}%)</>
                  )}
                </span>
              </div>

              {displaySummary && (
                <div className="live-metrics">
                  <div className="metric-card">
                    <div className="metric-value">{displaySummary.tps}</div>
                    <div className="metric-label">TPS</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{displaySummary.avgResponseTime} ms</div>
                    <div className="metric-label">Avg Response</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{displaySummary.errorRate}%</div>
                    <div className="metric-label">Error Rate</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{displaySummary.failedValidations}</div>
                    <div className="metric-label">Validation Failures</div>
                  </div>
                  {displayIsTimeBased && displayProfileMeta && (
                    <div className="metric-card">
                      <div className="metric-value">{displayProfileMeta.currentInFlight} / {displayProfileMeta.targetConcurrency}</div>
                      <div className="metric-label">Concurrency</div>
                    </div>
                  )}
                </div>
              )}

              {/* Charts */}
              {displayTimeSeries.length >= 2 && (
                <LiveCharts data={displayTimeSeries} isTimeBased={displayIsTimeBased} />
              )}
            </div>
          )}

          {/* Completion */}
          {finalRun && !isRunning && (
            <div className="completion-section">
              <div className="completion-banner">
                Test completed — {finalRun.results.length} requests in {(finalRun.summary.totalDurationMs / 1000).toFixed(2)}s
              </div>
              <button className="btn btn-primary" onClick={onComplete}>
                View Full Results →
              </button>
            </div>
          )}
          {!isRunning && !finalRun && savedProgress && (
            <div className="completion-section">
              <div className="completion-banner">
                Last run — {savedProgress.resultCount} requests in {(savedProgress.durationMs / 1000).toFixed(2)}s
              </div>
              <button className="btn btn-primary" onClick={onComplete}>
                View Full Results →
              </button>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}

          {pendingRun && (
            <div className="storage-quota-banner">
              <div className="storage-quota-msg">
                <strong>Storage full</strong> — the test completed successfully but could not be saved due to a storage error.
                Would you like to remove old runs and retry?
              </div>
              <div className="storage-quota-actions">
                <button className="btn btn-primary btn-sm" onClick={confirmSavePendingRun}>Yes, remove old runs &amp; save</button>
                <button className="btn btn-sm" onClick={dismissPendingRun}>Discard this run</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
