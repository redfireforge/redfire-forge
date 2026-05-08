import { useState, useMemo, useEffect, useRef } from 'react';
import type { FeatureGroup, GlobalAuthProfile, Scenario, TestConfig, ScenarioWeight, SharedDataSource } from '../../shared/types';
import type { LoadProfileConfig } from '../../shared/types';
import { useTestExecution } from './hooks/useTestExecution';
import { useRunnerConfig } from './hooks/useRunnerConfig';
import { resolveSharedDataSources } from '../../engine/dataSourceExpander';
import RunnerExecutionConfig from './components/RunnerExecutionConfig';
import HostSelector from './components/HostSelector';
import LiveProgressPanel from './components/LiveProgressPanel';
import ScenarioSelector from './components/ScenarioSelector';
import { buildSelectedTests } from './utils/buildSelectedTests';
import { type PersistedProgress, saveProgress, loadProgress, clearProgress } from './utils/runnerProgressStorage';
import { generateReport, downloadReport } from '../results/utils/reportGenerator';

interface Props {
  featureGroups: FeatureGroup[];
  /** Called when run completes. Pass 'test' to pre-filter results to test runs. */
  onComplete: (runType?: 'test' | 'workflow') => void;
  envName?: string;
  svcName?: string;
  envId?: string;
  svcId?: string;
  resolvedBaseUrl?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
  envFallbackAuth?: import('../../shared/types').AuthConfig;
  sharedDataSources?: SharedDataSource[];
}

export default function TestRunner({
  featureGroups,
  onComplete,
  envName,
  svcName,
  envId,
  svcId,
  resolvedBaseUrl,
  globalAuthProfiles = [],
  envFallbackAuth,
  sharedDataSources = [],
}: Props) {
  const configContextKey = [envId, svcId].filter(Boolean).join(':') || undefined;
  const progressKey = configContextKey || '_default';
  const isGalleryEnv = svcName === 'Gallery Samples';

  const {
    concurrency, setConcurrency,
    totalTransactions, setTotalTransactions,
    selectedScenarios, setSelectedScenarios,
    weights, setWeights,
    skipValidation, setSkipValidation,
    validationOverride, setValidationOverride,
    forceUnordered, setForceUnordered,
    hostMode, setHostMode,
    customBaseUrl, setCustomBaseUrl,
    executionMode, setExecutionMode,
    loadProfile, setLoadProfile,
    thinkTime, setThinkTime,
    timeoutSec, setTimeoutSec,
    retryCount, setRetryCount,
    retryDelayMs, setRetryDelayMs,
    errorPolicy, setErrorPolicy,
    maxErrors, setMaxErrors,
    maxErrorRate, setMaxErrorRate,
    autoReport, setAutoReport,
    autoReportFormat, setAutoReportFormat,
  } = useRunnerConfig(configContextKey);

  const [weightsExpanded, setWeightsExpanded] = useState(true);
  const [savedProgress, setSavedProgress] = useState<PersistedProgress | null>(null);
  const [runnerTagFilter, setRunnerTagFilter] = useState('');
  const autoReportFiredRef = useRef<string | null>(null);

  const { isRunning, completed, total, liveSummary, liveResults, profileMeta, timeSeries, error, execute, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun } = useTestExecution();

  // Build selected tests using shared utility
  const selectedTests = useMemo(
    () => buildSelectedTests(
      featureGroups,
      selectedScenarios,
      hostMode,
      customBaseUrl,
      resolvedBaseUrl,
      skipValidation,
      validationOverride,
      forceUnordered,
      globalAuthProfiles,
      envFallbackAuth,
    ),
    [featureGroups, selectedScenarios, hostMode, customBaseUrl, resolvedBaseUrl, skipValidation, validationOverride, forceUnordered, globalAuthProfiles, envFallbackAuth]
  );

  // Sync weights with selected tests
  useEffect(() => {
    const w: Record<string, number> = {};
    selectedTests.forEach((t) => (w[t.id] = weights[t.id] ?? 1));
    if (JSON.stringify(w) !== JSON.stringify(weights)) {
      setWeights(w);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTests]);

  // Load saved progress
  useEffect(() => {
    setSavedProgress(loadProgress(progressKey));
  }, [progressKey]);

  // Save progress when run completes
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalRun, isRunning]);

  // Auto-report: download report when test finishes
  useEffect(() => {
    if (!autoReport || !finalRun || isRunning) return;
    if (autoReportFiredRef.current === finalRun.id) return;
    autoReportFiredRef.current = finalRun.id;
    const content = generateReport(finalRun, { format: autoReportFormat });
    const date = new Date(finalRun.timestamp).toISOString().slice(0, 10);
    const base = [finalRun.svcName, finalRun.envName, date].filter(Boolean).join('_');
    const ext = autoReportFormat === 'markdown' ? 'md' : autoReportFormat;
    const mime = autoReportFormat === 'html' ? 'text/html' : autoReportFormat === 'json' ? 'application/json' : 'text/markdown';
    downloadReport(content, `${base}_report.${ext}`, mime);
  }, [finalRun, isRunning, autoReport, autoReportFormat]);

  const handleClearProgress = () => {
    clearProgress(progressKey);
    setSavedProgress(null);
  };

  const activeTestCount = selectedTests.filter((t) => (weights[t.id] ?? 1) > 0).length;
  const isLoadProfile = executionMode === 'load-profile';

  const handleRun = () => {
    let testsToRun = selectedTests as Scenario[];
    if (runnerTagFilter) {
      const tags = runnerTagFilter.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      testsToRun = selectedTests.map(t => {
        if (!t.dataSource || t.dataSource.rows.length === 0) return t;
        const filteredRows = t.dataSource.rows.filter(row => {
          const rowTags = row.tags ?? [];
          return rowTags.length > 0 && tags.some(ft => rowTags.includes(ft));
        });
        return { ...t, dataSource: { ...t.dataSource, rows: filteredRows } };
      }).filter(t => {
        if (t.dataSource && t.dataSource.columns.length > 0 && t.dataSource.rows.length === 0) return false;
        return true;
      });
    }

    const scenarioWeights: ScenarioWeight[] = testsToRun.map((t) => ({
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
    const resolvedTests = resolveSharedDataSources(testsToRun, sharedDataSources);
    execute(config, resolvedTests, { envName, svcName, baseUrl: usedBaseUrl });
  };

  const updateProfile = (patch: Partial<LoadProfileConfig>) => {
    setLoadProfile((prev) => ({ ...prev, ...patch }));
  };

  const hasLiveProgress = isRunning || liveSummary;
  const showProgress = hasLiveProgress || (!isRunning && savedProgress);

  const displaySummary = liveSummary ?? savedProgress?.summary ?? null;
  const displayTimeSeries = isRunning ? timeSeries : (timeSeries.length > 0 ? timeSeries : savedProgress?.timeSeries ?? []);
  const displayCompleted = hasLiveProgress ? completed : savedProgress?.completed ?? 0;
  const displayTotal = hasLiveProgress ? total : savedProgress?.total ?? 0;
  const displayProfileMeta = profileMeta ?? savedProgress?.profileMeta ?? null;
  const _displayIsTimeBased = hasLiveProgress ? (isLoadProfile || total === -1) : savedProgress?.isTimeBased ?? false;
  const displayExecMode = hasLiveProgress ? executionMode : savedProgress?.executionMode ?? executionMode;
  const displayConc = hasLiveProgress ? concurrency : savedProgress?.concurrency ?? concurrency;
  const displayLoadProfile = hasLiveProgress ? loadProfile : savedProgress?.loadProfile ?? loadProfile;
  const displayThinkTime = hasLiveProgress ? thinkTime : savedProgress?.thinkTime ?? thinkTime;
  const hostLabel = hostMode === 'settings' && resolvedBaseUrl ? resolvedBaseUrl : hostMode === 'custom' && customBaseUrl.trim() ? customBaseUrl.trim() : 'Original';

  const hasAnyTests = featureGroups.some((fg) => fg.scenarios.some((sc) => sc.tests.length > 0));

  return (
    <div className="page">
      <div className="page-header">
        <h2>Test Runner</h2>
        <div className="context-tags">
          {svcName && <span className="context-tag svc-tag">{svcName}</span>}
          {envName && <span className="context-tag env-tag">{envName}</span>}
        </div>
      </div>

      <HostSelector
        hostMode={hostMode}
        onHostModeChange={setHostMode}
        customBaseUrl={customBaseUrl}
        onCustomBaseUrlChange={setCustomBaseUrl}
        resolvedBaseUrl={resolvedBaseUrl}
        disabled={isRunning}
        isGalleryEnv={isGalleryEnv}
      />

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
        namePrefix="test-runner"
      />

      {!hasAnyTests ? (
        <div className="empty-state">No tests defined. Go to Feature Groups tab to add some first.</div>
      ) : (
        <>
          <ScenarioSelector
            featureGroups={featureGroups}
            selectedScenarios={selectedScenarios}
            onSelectedScenariosChange={setSelectedScenarios}
            weights={weights}
            onWeightsChange={setWeights}
            skipValidation={skipValidation}
            onSkipValidationChange={setSkipValidation}
            validationOverride={validationOverride}
            onValidationOverrideChange={setValidationOverride}
            forceUnordered={forceUnordered}
            onForceUnorderedChange={setForceUnordered}
            autoReport={autoReport}
            onAutoReportChange={setAutoReport}
            autoReportFormat={autoReportFormat}
            onAutoReportFormatChange={setAutoReportFormat}
            hostMode={hostMode}
            customBaseUrl={customBaseUrl}
            resolvedBaseUrl={resolvedBaseUrl}
            globalAuthProfiles={globalAuthProfiles}
            envFallbackAuth={envFallbackAuth}
            disabled={isRunning}
          />

          {selectedTests.length > 0 && (
            <div className="config-form" style={{ marginTop: 16 }}>
              <fieldset>
                <legend className="collapsible-legend" onClick={() => setWeightsExpanded((v) => !v)}>
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
                          {t.dataSource && t.dataSource.rows.filter(r => r.enabled).length > 0 && (
                            <span className="count-badge count-badge-data">📊 {t.dataSource.rows.filter(r => r.enabled).length} rows</span>
                          )}
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

              {/* Expansion Summary */}
              {(() => {
                const hasParam = selectedTests.some(t => t.dataSource && t.dataSource.rows.filter(r => r.enabled).length > 0);
                if (!hasParam) return null;
                const activeTests = selectedTests.filter(t => (weights[t.id] ?? 1) > 0);
                const totalWeight = activeTests.reduce((s, t) => s + (weights[t.id] ?? 1), 0);
                const filterTags = runnerTagFilter ? runnerTagFilter.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

                const breakdown: { name: string; slots: number; rows: number; filteredRows: number; expanded: number; hasMatchingTags: boolean }[] = [];
                let uncappedTotal = 0;
                for (const t of activeTests) {
                  const w = weights[t.id] ?? 1;
                  const slots = totalWeight > 0 ? Math.round((w / totalWeight) * totalTransactions) : 0;
                  const enabledRows = t.dataSource?.rows.filter(r => r.enabled) ?? [];
                  const rows = enabledRows.length;
                  const matchingRows = filterTags.length > 0
                    ? enabledRows.filter(r => {
                        const rowTags = r.tags ?? [];
                        return rowTags.length > 0 && filterTags.some(ft => rowTags.includes(ft));
                      })
                    : enabledRows;
                  const effectiveRows = matchingRows.length;
                  const hasMatchingTags = filterTags.length > 0 && enabledRows.some(r => (r.tags ?? []).some(rt => filterTags.includes(rt)));
                  const expanded = slots * (effectiveRows > 0 ? effectiveRows : 1);
                  uncappedTotal += expanded;
                  breakdown.push({ name: t.name, slots, rows, filteredRows: effectiveRows, expanded, hasMatchingTags });
                }
                const capped = Math.min(uncappedTotal, totalTransactions);
                return (
                  <div className="runner-expansion-summary">
                    <div className="runner-expansion-title">Expansion Summary</div>
                    {breakdown.map((b, i) => (
                      <div key={i} className={`runner-expansion-row ${filterTags.length > 0 && !b.hasMatchingTags && b.rows > 0 ? 'runner-expansion-row-skipped' : ''}`}>
                        <span>
                          {b.name}
                          {filterTags.length > 0 && b.rows > 0 && (
                            b.hasMatchingTags
                              ? <span className="runner-tag-match-badge" title="Has rows matching tag filter"> 🏷</span>
                              : <span className="runner-tag-miss-badge" title="No rows match — will be skipped"> ⊘ skipped</span>
                          )}
                        </span>
                        <span className="runner-expansion-calc">
                          {filterTags.length > 0 && b.rows > 0 && !b.hasMatchingTags
                            ? '—'
                            : filterTags.length > 0 && b.rows > 0
                              ? `${b.slots} × ${b.filteredRows}/${b.rows} rows = ${b.expanded}`
                              : b.rows > 0
                                ? `${b.slots} × ${b.rows} rows = ${b.expanded}`
                                : `${b.slots} × 1 = ${b.expanded}`
                          }
                        </span>
                      </div>
                    ))}
                    <div className="runner-expansion-total">
                      {uncappedTotal > totalTransactions
                        ? `Expanded ${uncappedTotal} → capped to ${capped} requests`
                        : `Total: ${capped} requests`
                      }
                    </div>
                  </div>
                );
              })()}

              {/* Tag Filter */}
              {selectedTests.some(t => t.dataSource && t.dataSource.rows.some(r => r.tags && r.tags.length > 0)) && (
                <fieldset className="runner-fieldset">
                  <legend>Tag Filter (comma-separated)</legend>
                  <input
                    type="text"
                    className="runner-tag-filter-input"
                    placeholder="e.g. happy-path, smoke"
                    value={runnerTagFilter}
                    onChange={(e) => setRunnerTagFilter(e.target.value)}
                    disabled={isRunning}
                  />
                  {runnerTagFilter && (
                    <span className="runner-tag-filter-hint">
                      Only rows matching these tags will run
                    </span>
                  )}
                </fieldset>
              )}

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

          {showProgress && (
            <LiveProgressPanel
              isRunning={isRunning}
              completed={displayCompleted}
              total={displayTotal}
              summary={displaySummary}
              timeSeries={displayTimeSeries}
              profileMeta={displayProfileMeta}
              executionMode={displayExecMode}
              concurrency={displayConc}
              loadProfile={displayLoadProfile}
              thinkTime={displayThinkTime}
              hostLabel={hostLabel}
              liveResults={liveResults}
              selectedTests={selectedTests as Scenario[]}
              weights={weights}
              onClear={!isRunning && savedProgress ? handleClearProgress : undefined}
            />
          )}

          {finalRun && !isRunning && (
            <div className="completion-section">
              <div className="completion-banner">
                Test completed — {finalRun.results.length} requests in {(finalRun.summary.totalDurationMs / 1000).toFixed(2)}s
              </div>
              <button className="btn btn-primary" onClick={() => onComplete('test')}>
                View Full Results →
              </button>
            </div>
          )}
          {!isRunning && !finalRun && savedProgress && (
            <div className="completion-section">
              <div className="completion-banner">
                Last run — {savedProgress.resultCount} requests in {(savedProgress.durationMs / 1000).toFixed(2)}s
              </div>
              <button className="btn btn-primary" onClick={() => onComplete('test')}>
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
