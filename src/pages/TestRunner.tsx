import { useState, useMemo, useEffect } from 'react';
import type { ExecutionMode, ErrorPolicy, FeatureGroup, GlobalAuthProfile, Scenario, TestConfig, ScenarioWeight, LoadProfileConfig, ThinkTimeConfig } from '../types';
import { useTestExecution } from '../hooks/useTestExecution';
import { saveRunnerConfig, loadRunnerConfig as loadRunnerConfigAsync } from '../utils/storage';
import { resolveAuth } from '../utils/authResolver';
import { LiveCharts } from '../components/LiveCharts';
import RunnerExecutionConfig, { profileLabel } from '../components/RunnerExecutionConfig';
import { type PersistedProgress, saveProgress, loadProgress, clearProgress, thinkTimeLabel } from '../utils/runnerProgressStorage';

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

const defaultThinkTime: ThinkTimeConfig = { mode: 'none' };

interface RunnerConfig {
  concurrency: number;
  totalTransactions: number;
  selectedScenarios: string[];
  weights: Record<string, number>;
  skipValidation: boolean;
  forceUnordered: boolean;
  hostMode: HostMode;
  customBaseUrl: string;
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
  thinkTime?: ThinkTimeConfig;
  timeoutSec?: number;
  retryCount?: number;
  retryDelayMs?: number;
  errorPolicy?: ErrorPolicy;
  maxErrors?: number;
  maxErrorRate?: number;
}

const defaultConfig: RunnerConfig = {
  concurrency: 1, totalTransactions: 1, selectedScenarios: [], weights: {},
  skipValidation: false, forceUnordered: false, hostMode: 'settings', customBaseUrl: '', executionMode: 'batch',
};

interface Props {
  featureGroups: FeatureGroup[];
  onComplete: () => void;
  envName?: string;
  svcName?: string;
  envId?: string;
  svcId?: string;
  resolvedBaseUrl?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
  envFallbackAuth?: import('../types').AuthConfig;
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

export default function TestRunner({ featureGroups, onComplete, envName, svcName, envId, svcId, resolvedBaseUrl, globalAuthProfiles = [], envFallbackAuth }: Props) {
  const configContextKey = [envId, svcId].filter(Boolean).join(':') || undefined;
  const progressKey = configContextKey || '_default';

  const [concurrency, setConcurrency] = useState(defaultConfig.concurrency);
  const [totalTransactions, setTotalTransactions] = useState(defaultConfig.totalTransactions);
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [skipValidation, setSkipValidation] = useState(false);
  const [forceUnordered, setForceUnordered] = useState(false);
  const [hostMode, setHostMode] = useState<HostMode>('settings');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('batch');
  const [loadProfile, setLoadProfile] = useState<LoadProfileConfig>({ ...defaultLoadProfile });
  const [thinkTime, setThinkTime] = useState<ThinkTimeConfig>({ ...defaultThinkTime });
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
        thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
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
        setForceUnordered(saved.forceUnordered ?? false);
        setHostMode(saved.hostMode ?? 'settings');
        setCustomBaseUrl(saved.customBaseUrl ?? '');
        setExecutionMode(saved.executionMode ?? 'batch');
        if (saved.loadProfile) setLoadProfile(saved.loadProfile);
        if (saved.thinkTime) setThinkTime(saved.thinkTime);
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
        setForceUnordered(defaultConfig.forceUnordered);
        setHostMode(defaultConfig.hostMode);
        setCustomBaseUrl(defaultConfig.customBaseUrl);
        setExecutionMode(defaultConfig.executionMode);
        setLoadProfile({ ...defaultLoadProfile });
        setThinkTime({ ...defaultThinkTime });
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
      forceUnordered,
      hostMode,
      customBaseUrl,
      executionMode,
      loadProfile,
      thinkTime,
      timeoutSec,
      retryCount,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
    }, configContextKey);
  }, [configLoaded, configContextKey, concurrency, totalTransactions, selectedScenarios, weights, skipValidation, forceUnordered, hostMode, customBaseUrl, executionMode, loadProfile, thinkTime, timeoutSec, retryCount, retryDelayMs, errorPolicy, maxErrors, maxErrorRate]);

  const selectedTests: Scenario[] = useMemo(() => {
    const tests: Scenario[] = [];
    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        if (selectedScenarios.has(sc.id)) {
          for (const test of sc.tests) {
            const effectiveBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || '') : hostMode === 'custom' ? customBaseUrl.trim() : '';
            const url = effectiveBaseUrl ? replaceHost(test.url, effectiveBaseUrl) : test.url;
            let validation = skipValidation ? { mode: 'none' as const } : test.validation;
            if (forceUnordered && !skipValidation && validation.mode === 'selective') {
              validation = { ...validation, unorderedArrays: true };
            }
            const auth = resolveAuth(test, sc, fg, globalAuthProfiles, envFallbackAuth);
            tests.push({ ...test, url, auth, validation, featureGroupName: fg.name, groupName: sc.name });
          }
        }
      }
    }
    return tests;
  }, [featureGroups, selectedScenarios, resolvedBaseUrl, skipValidation, forceUnordered, hostMode, customBaseUrl, globalAuthProfiles, envFallbackAuth]);

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
      thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
      timeoutSec: timeoutSec > 0 ? timeoutSec : undefined,
      retryCount: retryCount > 0 ? retryCount : 0,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
    };
    const usedBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || undefined) : hostMode === 'custom' ? (customBaseUrl.trim() || undefined) : undefined;
    execute(config, selectedTests, { envName, svcName, baseUrl: usedBaseUrl });
  };

  const isTimeBased = isLoadProfile || (isRunning && total === -1);

  const hasLiveProgress = isRunning || liveSummary;
  const showProgress = hasLiveProgress || (!isRunning && savedProgress);

  const displaySummary = liveSummary ?? savedProgress?.summary ?? null;
  const displayTimeSeries = isRunning ? timeSeries : (timeSeries.length > 0 ? timeSeries : savedProgress?.timeSeries ?? []);
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
  const displayThinkTime = hasLiveProgress ? thinkTime : savedProgress?.thinkTime ?? thinkTime;
  const displayThinkLabel = thinkTimeLabel(displayThinkTime);
  const hasAnyTests = featureGroups.some((fg) => fg.scenarios.some((sc) => sc.tests.length > 0));

  const updateProfile = (patch: Partial<LoadProfileConfig>) => {
    setLoadProfile((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Test Runner</h2>
        <div className="context-tags">
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

      <RunnerExecutionConfig
        executionMode={executionMode}
        onExecutionModeChange={setExecutionMode}
        concurrency={concurrency}
        onConcurrencyChange={setConcurrency}
        totalTransactions={totalTransactions}
        onTotalTransactionsChange={setTotalTransactions}
        timeoutSec={timeoutSec}
        onTimeoutSecChange={setTimeoutSec}
        retryCount={retryCount}
        onRetryCountChange={setRetryCount}
        retryDelayMs={retryDelayMs}
        onRetryDelayMsChange={setRetryDelayMs}
        errorPolicy={errorPolicy}
        onErrorPolicyChange={setErrorPolicy}
        maxErrors={maxErrors}
        onMaxErrorsChange={setMaxErrors}
        maxErrorRate={maxErrorRate}
        onMaxErrorRateChange={setMaxErrorRate}
        loadProfile={loadProfile}
        onLoadProfileChange={updateProfile}
        thinkTime={thinkTime}
        onThinkTimeChange={(patch) => setThinkTime((prev) => ({ ...prev, ...patch }))}
        activeTestCount={activeTestCount}
        isRunning={isRunning}
      />

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
                <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem' }} title="Match array items by content regardless of order — useful when APIs return arrays in non-deterministic order">
                  <input
                    type="checkbox"
                    checked={forceUnordered}
                    onChange={(e) => setForceUnordered(e.target.checked)}
                    disabled={isRunning || skipValidation}
                  />
                  Unordered arrays
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
                {displayThinkLabel && (
                  <span className="progress-mode-tag think-time-tag">{displayThinkLabel}</span>
                )}
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
