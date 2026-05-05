import { useState, useMemo, useEffect, useRef } from 'react';
import type { FeatureGroup, GlobalAuthProfile, Scenario, TestConfig, ScenarioWeight, SharedDataSource } from '../../shared/types';
import { useTestExecution } from './hooks/useTestExecution';
import { useRunnerConfig } from './hooks/useRunnerConfig';
import type { RunnerConfig } from './hooks/useRunnerConfig';
import type { LoadProfileConfig } from '../../shared/types';
import { resolveAuth } from '../requests/utils/authResolver';
import { replaceHost } from '../../shared/utils/urlUtils';
import { resolveSharedDataSources } from '../../engine/dataSourceExpander';
import { LiveCharts } from './components/LiveCharts';
import RunnerExecutionConfig, { profileLabel } from './components/RunnerExecutionConfig';
import WorkflowVariablesInput from '../workflow/components/expression/WorkflowVariablesInput';
import { getExecutionModeMeta } from '../../shared/utils/executionMode';
import { type PersistedProgress, saveProgress, loadProgress, clearProgress, thinkTimeLabel } from './utils/runnerProgressStorage';
import { generateReport, downloadReport } from '../results/utils/reportGenerator';
import type { ReportOptions } from '../results/utils/reportGenerator';

interface Props {
  featureGroups: FeatureGroup[];
  onComplete: () => void;
  envName?: string;
  svcName?: string;
  envId?: string;
  svcId?: string;
  resolvedBaseUrl?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
  envFallbackAuth?: import('../../shared/types').AuthConfig;
  /** Top-level shared data sources for resolving sharedDataSourceId references */
  sharedDataSources?: SharedDataSource[];
}

// ---------------------------------------------------------------------------
// TestRunner Component
// ---------------------------------------------------------------------------

export default function TestRunner({ featureGroups, onComplete, envName, svcName, envId, svcId, resolvedBaseUrl, globalAuthProfiles = [], envFallbackAuth, sharedDataSources = [] }: Props) {
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
    configLoaded: _configLoaded,
  } = useRunnerConfig(configContextKey);

  const [workflowVariables, setWorkflowVariables] = useState<Record<string, string>>({});
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(() => new Set(featureGroups.map(fg => fg.id)));
  const [weightsExpanded, setWeightsExpanded] = useState(true);
  const [savedProgress, setSavedProgress] = useState<PersistedProgress | null>(null);
  const [runnerTagFilter, setRunnerTagFilter] = useState('');
  const autoReportFiredRef = useRef<string | null>(null);

  const { isRunning, completed, total, liveSummary, liveResults, profileMeta, timeSeries, error, execute, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun } = useTestExecution();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalRun, isRunning]);

  // Auto-report: download report when test finishes
  useEffect(() => {
    if (!autoReport || !finalRun || isRunning) return;
    // Prevent duplicate downloads for the same run
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

  const selectedTests: Scenario[] = useMemo(() => {
    const tests: Scenario[] = [];
    // Resolve effective validation mode: runner override > legacy skipValidation > data-source default
    const runtimeMode = validationOverride !== 'default'
      ? validationOverride
      : (skipValidation ? 'none' as const : null);

    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        if (selectedScenarios.has(sc.id)) {
          for (const test of sc.tests) {
            // Skip base URL replacement for gallery-imported tests — they use absolute URLs.
            const isGallery = fg.source === 'gallery';
            const effectiveBaseUrl = isGallery
              ? ''
              : (hostMode === 'settings' ? (resolvedBaseUrl || '') : hostMode === 'custom' ? customBaseUrl.trim() : '');
            const url = effectiveBaseUrl ? replaceHost(test.url, effectiveBaseUrl) : test.url;

            // For parameterized tests: stamp validationMode on the DataSource
            // so the expander enforces it per-row (isSample filtering)
            let dataSource = test.dataSource;
            if (dataSource && runtimeMode) {
              dataSource = { ...dataSource, validationMode: runtimeMode };
            }

            // For non-parameterized tests: apply override to validation config directly
            let validation = test.validation;
            if (!dataSource && runtimeMode === 'none') {
              validation = { mode: 'none' as const };
            }

            if (forceUnordered && validation.mode === 'selective') {
              validation = { ...validation, unorderedArrays: true };
            }
            const auth = resolveAuth(test, sc, fg, globalAuthProfiles, envFallbackAuth);
            tests.push({ ...test, url, auth, validation, dataSource, featureGroupName: fg.name, groupName: sc.name });
          }
        }
      }
    }
    return tests;
  }, [featureGroups, selectedScenarios, resolvedBaseUrl, skipValidation, validationOverride, forceUnordered, hostMode, customBaseUrl, globalAuthProfiles, envFallbackAuth]);

   
  useEffect(() => {
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
      if (next.has(featureId)) next.delete(featureId); else next.add(featureId);
      return next;
    });
  };

  // Helpers for mutual exclusion between gallery and user tests
  const userGroups = featureGroups.filter(fg => fg.source !== 'gallery');
  const galleryGroups = featureGroups.filter(fg => fg.source === 'gallery');

  const scenarioSourceOf = (scenarioId: string): 'gallery' | 'user' => {
    for (const fg of galleryGroups) {
      if (fg.scenarios.some(sc => sc.id === scenarioId)) return 'gallery';
    }
    return 'user';
  };

  const idsForSource = (source: 'gallery' | 'user') => {
    const groups = source === 'gallery' ? galleryGroups : userGroups;
    return new Set(groups.flatMap(fg => fg.scenarios.map(sc => sc.id)));
  };

  /** Remove all scenarios from the opposite source when adding from one source. */
  const withExclusion = (next: Set<string>, addingSource: 'gallery' | 'user') => {
    const oppositeIds = idsForSource(addingSource === 'gallery' ? 'user' : 'gallery');
    oppositeIds.forEach(id => next.delete(id));
    return next;
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) {
        next.delete(scenarioId);
      } else {
        next.add(scenarioId);
        withExclusion(next, scenarioSourceOf(scenarioId));
      }
      return next;
    });
  };

  const toggleAllInFeature = (fg: FeatureGroup) => {
    const allSelected = fg.scenarios.every((sc) => selectedScenarios.has(sc.id));
    const source = fg.source === 'gallery' ? 'gallery' as const : 'user' as const;
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      fg.scenarios.forEach((sc) => {
        if (allSelected) next.delete(sc.id); else next.add(sc.id);
      });
      if (!allSelected) withExclusion(next, source);
      return next;
    });
  };

  const selectAllUser = () => {
    setSelectedScenarios(new Set(userGroups.flatMap(fg => fg.scenarios.map(sc => sc.id))));
  };

  const selectAllGallery = () => {
    setSelectedScenarios(new Set(galleryGroups.flatMap(fg => fg.scenarios.map(sc => sc.id))));
  };

  const deselectAll = () => {
    setSelectedScenarios(new Set());
  };

  const activeTestCount = selectedTests.filter((t) => (weights[t.id] ?? 1) > 0).length;
  const isLoadProfile = executionMode === 'load-profile';

  const renderFeatureGroup = (fg: FeatureGroup) => {
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
                    {(() => {
                      const totalRows = sc.tests.reduce((sum, t) => sum + (t.dataSource?.rows.filter(r => r.enabled).length ?? 0), 0);
                      return totalRows > 0 ? <span className="count-badge count-badge-data">📊 {totalRows} rows</span> : null;
                    })()}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const handleRun = () => {
    // Phase 12: Apply tag filter to data rows
    let testsToRun = selectedTests;
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
        // Exclude parameterized tests with 0 matching rows — they'd run with unresolved {{placeholders}}
        if (t.dataSource && t.dataSource.columns.length > 0 && t.dataSource.rows.length === 0) return false;
        return true;
      });
    }

    const scenarioWeights: ScenarioWeight[] = testsToRun.map((t) => ({
      scenarioId: t.id,
      weight: weights[t.id] ?? 1,
    }));
    const isWorkflow = executionMode === 'workflow';
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
      ...(isWorkflow && Object.keys(workflowVariables).length > 0 ? { workflowVariables } : {}),
    };
    const usedBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || undefined) : hostMode === 'custom' ? (customBaseUrl.trim() || undefined) : undefined;
    // Resolve shared data sources before execution (use top-level sharedDataSources)
    const resolvedTests = resolveSharedDataSources(testsToRun, sharedDataSources);
    execute(config, resolvedTests, { envName, svcName, baseUrl: usedBaseUrl });
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
  const displayExecutionModeMeta = getExecutionModeMeta(displayExecMode);
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
        {isGalleryEnv ? (
          <span className="runner-host-gallery-hint">🏪 Gallery samples use their own hardcoded URLs — no host override needed</span>
        ) : (
        <>
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
        </>
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

      {executionMode === 'workflow' && (
        <WorkflowVariablesInput
          variables={workflowVariables}
          onChange={setWorkflowVariables}
          disabled={isRunning}
        />
      )}

      {!hasAnyTests ? (
        <div className="empty-state">No tests defined. Go to Feature Groups tab to add some first.</div>
      ) : (
        <>
          {/* Scenario selection */}
          <div className="config-form">
            <div className="selection-header">
              <h3>Select Scenarios to Test</h3>
              <div className="selection-actions">
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
                <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem' }} title="Runtime validation override — Default uses each test's configured mode">
                  <select
                    value={validationOverride}
                    onChange={(e) => setValidationOverride(e.target.value as RunnerConfig['validationOverride'])}
                    disabled={isRunning}
                    style={{ fontSize: '0.78rem', marginLeft: 4 }}
                  >
                    <option value="default">Validation: Default</option>
                    <option value="none">Validate: No Rows</option>
                    <option value="selective">Validate: Sample Rows Only</option>
                    <option value="full">Validate: All Rows</option>
                  </select>
                </label>
                <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem' }} title="Match array items by content regardless of order — useful when APIs return arrays in non-deterministic order">
                  <input
                    type="checkbox"
                    checked={forceUnordered}
                    onChange={(e) => setForceUnordered(e.target.checked)}
                    disabled={isRunning || validationOverride === 'none' || skipValidation}
                  />
                  Unordered arrays
                </label>
                <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem', whiteSpace: 'nowrap' }} title="Automatically download a report when the test finishes">
                  <input
                    type="checkbox"
                    checked={autoReport}
                    onChange={(e) => setAutoReport(e.target.checked)}
                    disabled={isRunning}
                  />
                  Auto-report
                  {autoReport && (
                    <select
                      value={autoReportFormat}
                      onChange={(e) => setAutoReportFormat(e.target.value as ReportOptions['format'])}
                      disabled={isRunning}
                      style={{ fontSize: '0.78rem', marginLeft: 4 }}
                    >
                      <option value="html">HTML</option>
                      <option value="json">JSON</option>
                      <option value="markdown">Markdown</option>
                    </select>
                  )}
                </label>
                <span className="filter-count">
                  {selectedScenarios.size} scenario{selectedScenarios.size !== 1 ? 's' : ''} selected
                  ({selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            {userGroups.length > 0 && (
              <>
                <div className="selection-section-header">
                  <span className="selection-section-label">Your Tests</span>
                  <button className="btn btn-sm" onClick={selectAllUser} disabled={isRunning}>Select All</button>
                </div>
                <div className="selection-tree">
                  {userGroups.map((fg) => renderFeatureGroup(fg))}
                </div>
              </>
            )}

            {galleryGroups.length > 0 && (
              <>
                <div className="selection-section-header selection-section-gallery">
                  <span className="selection-section-label">🏪 Gallery Samples</span>
                  <button className="btn btn-sm" onClick={selectAllGallery} disabled={isRunning}>Select All</button>
                  {userGroups.length > 0 && (
                    <span className="selection-section-hint">Selecting gallery tests will deselect your tests and vice versa</span>
                  )}
                </div>
                <div className="selection-tree">
                  {galleryGroups.map((fg) => renderFeatureGroup(fg))}
                </div>
              </>
            )}
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

              {/* 4.2: Execution summary — show expanded request count for parameterized tests */}
              {(() => {
                const hasParam = selectedTests.some(t => t.dataSource && t.dataSource.rows.filter(r => r.enabled).length > 0);
                if (!hasParam) return null;
                const activeTests = selectedTests.filter(t => (weights[t.id] ?? 1) > 0);
                const totalWeight = activeTests.reduce((s, t) => s + (weights[t.id] ?? 1), 0);

                // Phase 12: Parse tag filter for row counting
                const filterTags = runnerTagFilter ? runnerTagFilter.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

                const breakdown: { name: string; slots: number; rows: number; filteredRows: number; expanded: number; hasMatchingTags: boolean }[] = [];
                let uncappedTotal = 0;
                for (const t of activeTests) {
                  const w = weights[t.id] ?? 1;
                  const slots = totalWeight > 0 ? Math.round((w / totalWeight) * totalTransactions) : 0;
                  const enabledRows = t.dataSource?.rows.filter(r => r.enabled) ?? [];
                  const rows = enabledRows.length;
                  // Count rows that match the tag filter
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

              {/* Phase 12: Runner tag filter */}
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
                      {displayExecutionModeMeta.progressLabel}
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

              {/* 4.3: Per-test progress breakdown */}
              {isRunning && liveResults.length > 0 && selectedTests.some(t => t.dataSource) && (
                <div className="runner-per-test-progress">
                  {selectedTests.filter(t => (weights[t.id] ?? 1) > 0).map(t => {
                    const results = liveResults.filter(r => r.scenarioId === t.id);
                    const passed = results.filter(r => r.passed).length;
                    const failed = results.length - passed;
                    const expectedRows = t.dataSource?.rows.filter(r => r.enabled).length ?? 1;
                    return (
                      <div key={t.id} className="runner-per-test-row">
                        <span className="runner-per-test-name">{t.name}:</span>
                        <span className="runner-per-test-counts">
                          {results.length}/{expectedRows}
                          {passed > 0 && <span className="runner-per-test-pass"> ✓{passed}</span>}
                          {failed > 0 && <span className="runner-per-test-fail"> ✗{failed}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

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
                    <div className="metric-label">Error Rate <span className="metric-info" data-tooltip="Percentage of requests that received a non-2xx HTTP status (e.g. 400, 404, 500). Includes intentional negative tests that expect error responses.">ⓘ</span></div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{displaySummary.failedValidations}</div>
                    <div className="metric-label">Validation Failures <span className="metric-info" data-tooltip="Requests whose actual response did not match expected assertions. 0 means every test got the response it expected — even negative tests that assert error codes.">ⓘ</span></div>
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
