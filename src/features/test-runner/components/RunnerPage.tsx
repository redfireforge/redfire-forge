import { useLayoutEffect, useRef } from 'react';
import type { FeatureGroup, GlobalAuthProfile, Scenario, SharedDataSource } from '../../../shared/types';
import { useRunnerOrchestration } from '../hooks/useRunnerOrchestration';
import { scrollRunnerMonitorIntoView } from '../utils/scrollRunnerMonitor';
import RunnerExecutionConfig from './RunnerExecutionConfig';
import HostSelector from './HostSelector';
import LiveProgressPanel from './LiveProgressPanel';
import ScenarioSelector from './ScenarioSelector';
import ExecutionPlanPreview from './ExecutionPlanPreview';
import RunnerSlaOverridePanel from './RunnerSlaOverridePanel';
import type { RunnerVariant } from './runnerVariants';

export interface RunnerPageProps {
  featureGroups: FeatureGroup[];
  onComplete: (runType?: 'test' | 'workflow') => void;
  envName?: string;
  svcName?: string;
  envId?: string;
  svcId?: string;
  isAdditionalEnv?: boolean;
  resolvedBaseUrl?: string;
  microservices?: import('../../../shared/types').Microservice[];
  globalAuthProfiles?: GlobalAuthProfile[];
  envFallbackAuth?: import('../../../shared/types').AuthConfig;
  sharedDataSources?: SharedDataSource[];
}

export default function RunnerPage({
  variant,
  featureGroups, onComplete, envName, svcName, envId, svcId, isAdditionalEnv,
  resolvedBaseUrl, microservices, globalAuthProfiles = [], envFallbackAuth, sharedDataSources = [],
}: RunnerPageProps & { variant: RunnerVariant }) {
  const runner = useRunnerOrchestration({
    featureGroups, kind: variant.kind, envId, svcId, envName, svcName,
    resolvedBaseUrl, microservices, globalAuthProfiles, envFallbackAuth, sharedDataSources,
  });

  const {
    config, execution, selectedTests, activeTestCount, allocation, isLoadProfile, isConstantArrival, isGalleryEnv,
    weightsExpanded, setWeightsExpanded, runnerTagFilter, setRunnerTagFilter,
    scenarioTagFilter, setScenarioTagFilter, allScenarioTags, scenarioTagCounts,
    savedProgress, handleClearProgress, handleRun, updateProfile, updateArrivalRate,
    showProgress, displaySummary, displayTimeSeries, displayCompleted, displayTotal,
    displayProfileMeta, displayExecMode, displayConc, displayLoadProfile, displayArrivalRate, displayThinkTime, hostLabel,
    runnerSlaTargets, setRunnerSlaTargets, selectedSlaScenarioNames, selectedSlaTestNames,
    definitionSlaTargetCount, definitionSlaTargets,
  } = runner;

  const {
    concurrency, setConcurrency, iterations, setIterations,
    selectedScenarios, setSelectedScenarios, weights, setWeights,
    skipValidation, setSkipValidation, skipAssertions, setSkipAssertions,
    validationOverride, setValidationOverride,
    forceUnordered, setForceUnordered, hostMode, setHostMode,
    customBaseUrl, setCustomBaseUrl, executionMode, setExecutionMode,
    loadProfile, arrivalRate, thinkTime, setThinkTime,
    timeoutSec, setTimeoutSec, retryCount, setRetryCount,
    retryDelayMs, setRetryDelayMs, errorPolicy, setErrorPolicy,
    maxErrors, setMaxErrors, maxErrorRate, setMaxErrorRate,
    autoReport, setAutoReport, autoReportFormat, setAutoReportFormat,
  } = config;

  const { isRunning, liveResults, error, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun } = execution;

  const hasContent = variant.hasContent(featureGroups);
  const monitorRef = useRef<HTMLDivElement>(null);
  const showCompletion = !!(finalRun && !isRunning) || !!(!isRunning && !finalRun && savedProgress);

  // Keep the Progress monitor (bar + metrics + charts + completion) in view as
  // the run starts and as the panel grows — content mounts below the Run button.
  useLayoutEffect(() => {
    if (!isRunning && !showCompletion) return;
    const monitor = monitorRef.current;
    if (!monitor) return;
    const completion = monitor.querySelector<HTMLElement>('[data-testid="har-completion"]');
    const metrics = monitor.querySelector<HTMLElement>('.live-metrics');
    const bottom = completion ?? metrics ?? monitor;
    scrollRunnerMonitorIntoView(monitor, bottom, isRunning ? 'smooth' : 'smooth');
  }, [isRunning, showCompletion, displaySummary, displayCompleted, showProgress]);

  return (
    <div className={`page ${variant.namePrefix}-page`}>
      <div className="page-header">
        <h2>{variant.title}</h2>
        <div className="context-tags">
          {svcName && <span className="context-tag svc-tag">{svcName}</span>}
          {envName && <span className={`context-tag env-tag${isAdditionalEnv ? ' env-tag-additional' : ''}`}>{envName}{isAdditionalEnv && <span className="additional-env-indicator" title="Additional environment (microservice-specific)">+</span>}</span>}
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
        namePrefix={variant.namePrefix}
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
        arrivalRate={arrivalRate}
        onArrivalRateChange={updateArrivalRate}
        thinkTime={thinkTime}
        onThinkTimeChange={(patch) => setThinkTime((prev) => ({ ...prev, ...patch }))}
        activeTestCount={activeTestCount}
        isRunning={isRunning}
        namePrefix={variant.namePrefix}
      />

      {!hasContent ? (
        <div className="empty-state">{variant.emptyMessage}</div>
      ) : (
        <>
          <ScenarioSelector
            featureGroups={featureGroups}
            kind={variant.kind}
            selectedScenarios={selectedScenarios}
            onSelectedScenariosChange={setSelectedScenarios}
            weights={weights}
            onWeightsChange={setWeights}
            skipValidation={skipValidation}
            onSkipValidationChange={setSkipValidation}
            skipAssertions={skipAssertions}
            onSkipAssertionsChange={setSkipAssertions}
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
            scenarioTagFilter={scenarioTagFilter}
            onScenarioTagFilterChange={setScenarioTagFilter}
            allScenarioTags={allScenarioTags}
            scenarioTagCounts={scenarioTagCounts}
          />

          {selectedTests.length > 0 && (
            <div className="config-form" style={{ marginTop: 16 }}>
              <fieldset data-testid="har-weights-section">
                <legend className="collapsible-legend" onClick={() => setWeightsExpanded((v) => !v)}>
                  <span className={`collapse-arrow ${weightsExpanded ? 'expanded' : ''}`}>▶</span>
                  Test Distribution (weights)
                  <span className="collapse-count">{selectedTests.length} tests</span>
                </legend>
                {weightsExpanded && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button type="button" className="btn btn-xs" data-testid="har-weights-reset-1" disabled={isRunning} onClick={() => { const w: Record<string, number> = {}; selectedTests.forEach((t) => w[t.id] = 1); setWeights(w); }}>Reset All to 1</button>
                      <button type="button" className="btn btn-xs" data-testid="har-weights-reset-0" disabled={isRunning} onClick={() => { const w: Record<string, number> = {}; selectedTests.forEach((t) => w[t.id] = 0); setWeights(w); }}>Reset All to 0</button>
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
                          {t.slaTargets && t.slaTargets.length > 0 && (
                            <span className="count-badge count-badge-sla">🎯 {t.slaTargets.length} SLA</span>
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

              {!isLoadProfile && !isConstantArrival && (
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

              <RunnerSlaOverridePanel
                initialTargets={runnerSlaTargets}
                onSave={setRunnerSlaTargets}
                definitionTargetCount={definitionSlaTargetCount}
                definitionTargets={definitionSlaTargets}
                scenarioNames={selectedSlaScenarioNames}
                testNames={selectedSlaTestNames}
                disabled={isRunning}
              />

              <div className="form-actions">
                {!isRunning ? (
                  <button className="btn btn-primary btn-lg" data-testid="har-run-btn" onClick={handleRun} disabled={selectedTests.length === 0}>
                    {variant.runButtonLabel}
                  </button>
                ) : (
                  <button className="btn btn-danger btn-lg" data-testid="har-stop-btn" onClick={abort}>
                    ■ Stop
                  </button>
                )}
              </div>
            </div>
          )}

          {(showProgress || showCompletion) && (
            <div ref={monitorRef} data-testid="har-runner-monitor">
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
                  arrivalRate={displayArrivalRate}
                  thinkTime={displayThinkTime}
                  hostLabel={hostLabel}
                  liveResults={liveResults}
                  selectedTests={selectedTests as Scenario[]}
                  weights={weights}
                  onClear={!isRunning && savedProgress ? handleClearProgress : undefined}
                />
              )}

              {finalRun && !isRunning && (
                <div className="completion-section" data-testid="har-completion">
                  <div className="completion-banner">
                    Test completed — {finalRun.results.length} requests in {(finalRun.summary.totalDurationMs / 1000).toFixed(2)}s
                  </div>
                  <button className="btn btn-primary" data-testid="har-view-results" onClick={() => onComplete('test')}>
                    View Full Results →
                  </button>
                </div>
              )}
              {!isRunning && !finalRun && savedProgress && (
                <div className="completion-section" data-testid="har-completion">
                  <div className="completion-banner">
                    Last run — {savedProgress.resultCount} requests in {(savedProgress.durationMs / 1000).toFixed(2)}s
                  </div>
                  <button className="btn btn-primary" data-testid="har-view-results" onClick={() => onComplete('test')}>
                    View Full Results →
                  </button>
                </div>
              )}
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
