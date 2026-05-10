import type { FeatureGroup, GlobalAuthProfile, Scenario, SharedDataSource } from '../../shared/types';
import { useRunnerOrchestration } from './hooks/useRunnerOrchestration';
import RunnerExecutionConfig from './components/RunnerExecutionConfig';
import HostSelector from './components/HostSelector';
import LiveProgressPanel from './components/LiveProgressPanel';
import ScenarioSelector from './components/ScenarioSelector';
import ExecutionPlanPreview from './components/ExecutionPlanPreview';

interface Props {
  featureGroups: FeatureGroup[];
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

export default function ParameterizedRunner({
  featureGroups, onComplete, envName, svcName, envId, svcId,
  resolvedBaseUrl, globalAuthProfiles = [], envFallbackAuth, sharedDataSources = [],
}: Props) {
  const runner = useRunnerOrchestration({
    featureGroups, kind: 'parameterized', envId, svcId, envName, svcName,
    resolvedBaseUrl, globalAuthProfiles, envFallbackAuth, sharedDataSources,
  });

  const {
    config, execution, selectedTests, activeTestCount, allocation, isLoadProfile, isGalleryEnv,
    weightsExpanded, setWeightsExpanded, runnerTagFilter, setRunnerTagFilter,
    savedProgress, handleClearProgress, handleRun, updateProfile,
    showProgress, displaySummary, displayTimeSeries, displayCompleted, displayTotal,
    displayProfileMeta, displayExecMode, displayConc, displayLoadProfile, displayThinkTime, hostLabel,
  } = runner;

  const {
    concurrency, setConcurrency, iterations, setIterations,
    selectedScenarios, setSelectedScenarios, weights, setWeights,
    skipValidation, setSkipValidation, validationOverride, setValidationOverride,
    forceUnordered, setForceUnordered, hostMode, setHostMode,
    customBaseUrl, setCustomBaseUrl, executionMode, setExecutionMode,
    loadProfile, thinkTime, setThinkTime,
    timeoutSec, setTimeoutSec, retryCount, setRetryCount,
    retryDelayMs, setRetryDelayMs, errorPolicy, setErrorPolicy,
    maxErrors, setMaxErrors, maxErrorRate, setMaxErrorRate,
    autoReport, setAutoReport, autoReportFormat, setAutoReportFormat,
  } = config;

  const { isRunning, liveResults, error, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun } = execution;

  const hasAnyParamScenarios = featureGroups.some((fg) =>
    fg.scenarios.some((sc) => sc.kind === 'parameterized' && sc.tests.length > 0)
  );

  return (
    <div className="page">
      <div className="page-header">
        <h2>Parameterized Runner</h2>
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
        iterations={iterations}
        onIterationsChange={setIterations}
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
        namePrefix="param-runner"
      />

      {!hasAnyParamScenarios ? (
        <div className="empty-state">
          No parameterized scenarios defined. Go to Feature Groups tab and create a parameterized scenario with data sources.
        </div>
      ) : (
        <>
          <ScenarioSelector
            featureGroups={featureGroups}
            kind="parameterized"
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

              {!isLoadProfile && (
                <ExecutionPlanPreview allocation={allocation} concurrency={concurrency} />
              )}

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
                    ▶ Run Parameterized Test
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
