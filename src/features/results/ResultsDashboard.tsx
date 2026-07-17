import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { TestRun, RequestResult } from '../../shared/types';
import ResponseDetailModal from '../requests/components/ResponseDetailModal';
import { AggregatedTimingTable } from '../test-runner/components/WaterfallBar';
import { loadTestRunsLite, loadTraceForRun, deleteTestRun } from '../../shared/utils/storage';
import { exportJson, exportCsv } from '../../shared/utils/export';
import { hasWorkflowData } from '../test-runner/utils/resultsGrouping';
import { RunComparisonPanel, TrendChart } from './components/RunComparisonPanel';
import { ResponseTimeHistogram } from './components/ResponseTimeHistogram';
import { WorkflowResultsSummary } from './components/WorkflowResultsSummary';
import { ResultsMetricsCards } from './components/ResultsMetricsCards';
import { generateReport, downloadReport } from './utils/reportGenerator';
import {
  loadBaselines, markAsBaseline, unmarkBaseline, isBaseline, renameBaseline,
  loadRegressionThresholds, saveRegressionThresholds,
  DEFAULT_THRESHOLDS,
  computeRunRegressionStatus,
  type BaselineMark, type RegressionThresholds, type RunRegressionStatus,
} from './utils/runBaselines';
import { BaselineListPanel } from './components/BaselineListPanel';
import { RegressionThresholdsPanel } from './components/RegressionThresholdsPanel';
import WorkflowResultsExplorerModal from './components/WorkflowResultsExplorerModal';
import { hasExecutionTrace, decompressTrace } from '../../shared/utils/traceCompression';
import { SlaCompactBar } from './components/SlaCompactBar';
import { SlaStatusAccordion } from './components/SlaStatusAccordion';
import { useImportHandlers } from './hooks/useImportHandlers';
import { useSlaManagement } from './hooks/useSlaManagement';
import { useResultsGrouping } from './hooks/useResultsGrouping';
import { ResultsRunSelect } from './components/ResultsRunSelect';
import { CompareActionModal } from './components/CompareActionModal';
import { ResultsRequestDetailsTab } from './components/ResultsRequestDetailsTab';
import { ResultsViewTabs } from './components/ResultsViewTabs';
import { ResultsRunTypeTabs } from './components/ResultsRunTypeTabs';
import { ResultsContextTags } from './components/ResultsContextTags';
import { ResultsComparisonTrendsToolbar } from './components/ResultsComparisonTrendsToolbar';
import { computeFilteredResults, computeRunCounts, filterVisibleRuns } from './utils/resultsFiltering';

interface Props {
  envName?: string;
  svcName?: string;
  onRerunFailed?: (run: TestRun, failedRowIds: string[]) => void;
  isRerunning?: boolean;
  /** Initial run type filter (can be set from post-run navigation) */
  initialRunTypeFilter?: 'all' | 'test' | 'workflow';
}

type RunTypeFilter = 'all' | 'test' | 'workflow';
type ResultsViewTab = 'overview' | 'requests' | 'sla' | 'analysis';

const RESULTS_TAB_IDS: Record<ResultsViewTab, { tab: string; panel: string }> = {
  overview: { tab: 'results-tab-overview', panel: 'results-panel-overview' },
  requests: { tab: 'results-tab-requests', panel: 'results-panel-requests' },
  sla: { tab: 'results-tab-sla', panel: 'results-panel-sla' },
  analysis: { tab: 'results-tab-analysis', panel: 'results-panel-analysis' },
};

export default function ResultsDashboard({ envName, svcName, onRerunFailed, isRerunning, initialRunTypeFilter }: Props) {
  const [allRuns, setAllRuns] = useState<TestRun[]>([]);
  const [baselines, setBaselines] = useState<BaselineMark[]>([]);
  const [compareBaselineId, setCompareBaselineId] = useState<string>('');
  const [compareSelectionMode, setCompareSelectionMode] = useState<'auto' | 'manual'>('auto');
  const [showTrend, setShowTrend] = useState(false);
  const [thresholds, setThresholds] = useState<RegressionThresholds>(DEFAULT_THRESHOLDS);
  const [runTypeFilter, setRunTypeFilter] = useState<RunTypeFilter>(initialRunTypeFilter ?? 'all');

  // Update filter when initialRunTypeFilter changes (e.g., from post-run navigation)
  useEffect(() => {
    if (initialRunTypeFilter) {
      setRunTypeFilter(initialRunTypeFilter);
    }
  }, [initialRunTypeFilter]);

  const prevRerunning = useRef(false);

  useEffect(() => {
    loadTestRunsLite().then(setAllRuns);
    loadBaselines().then(setBaselines);
    loadRegressionThresholds().then(setThresholds);
  }, []);

  // Auto-refresh when a re-run completes
  useEffect(() => {
    if (prevRerunning.current && !isRerunning) {
      loadTestRunsLite().then(setAllRuns);
    }
    prevRerunning.current = !!isRerunning;
  }, [isRerunning]);

  const runs = useMemo(() => {
    return filterVisibleRuns(allRuns, envName, svcName, runTypeFilter);
  }, [allRuns, envName, svcName, runTypeFilter]);

  const runCounts = useMemo(() => {
    return computeRunCounts(allRuns, envName, svcName);
  }, [allRuns, envName, svcName]);

  const [selectedRunId, setSelectedRunId] = useState<string>(runs[0]?.id ?? '');
  const [resultsViewTab, setResultsViewTab] = useState<ResultsViewTab>('overview');
  const [filterPassed, setFilterPassed] = useState<string>('all');
  const [resultTagFilter, setResultTagFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [traceLoading, setTraceLoading] = useState(false);

  // Import handlers hook (import trace, import run, replay modal)
  const {
    importFileRef, importRunFileRef, importError, setImportError,
    importedFileName, showReplayModal, setShowReplayModal, replayTrace, setReplayTrace,
    handleImportTrace, handleImportRun, closeReplayModal,
  } = useImportHandlers(setAllRuns, setSelectedRunId);

  useEffect(() => {
    if (runs.length > 0 && !runs.find((r) => r.id === selectedRunId)) {
      setSelectedRunId(runs[0].id);
      setResultTagFilter(null);
    } else if (runs.length === 0) {
      setSelectedRunId('');
      setResultTagFilter(null);
    }
  }, [runs, selectedRunId]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;
  const summary = selectedRun?.summary ?? null;

  const resultTags = useMemo(() => {
    if (!selectedRun) return [];
    const tags = new Set<string>();
    for (const r of selectedRun.results) {
      for (const t of r.scenarioTags ?? []) tags.add(t);
    }
    return [...tags].sort();
  }, [selectedRun]);

  const handleOpenResultsExplorer = useCallback(async () => {
    if (!selectedRun) return;
    if (selectedRun.executionTrace) {
      setReplayTrace(selectedRun.executionTrace);
      setShowReplayModal(true);
      return;
    }
    if (selectedRun.compressedTrace) {
      setReplayTrace(decompressTrace(selectedRun.compressedTrace));
      setShowReplayModal(true);
      return;
    }
    if (selectedRun.hasTrace) {
      setTraceLoading(true);
      try {
        const compressed = await loadTraceForRun(selectedRun.id);
        if (compressed) {
          setReplayTrace(decompressTrace(compressed));
          setShowReplayModal(true);
        }
      } finally {
        setTraceLoading(false);
      }
    }
  }, [selectedRun, setReplayTrace, setShowReplayModal]);

  // SLA management hook
  const {
    slaTargets, slaScope, runSlaStatuses, handleSaveSlaTargets,
  } = useSlaManagement(selectedRun, selectedRunId, runs);

  const handleDelete = async (runId: string) => {
    await deleteTestRun(runId);
    const updated = allRuns.filter((r) => r.id !== runId);
    setAllRuns(updated);
    if (selectedRunId === runId) {
      const filteredUpdated = updated.filter((r) => {
        if (envName && r.envName && r.envName !== envName) return false;
        if (svcName && r.svcName && r.svcName !== svcName) return false;
        return true;
      });
      setSelectedRunId(filteredUpdated[0]?.id ?? '');
      setResultTagFilter(null);
    }
    // Clean up baseline mark and comparison state for the deleted run.
    if (isBaseline(baselines, runId)) {
      const nextBaselines = await unmarkBaseline(runId);
      setBaselines(nextBaselines);
    }
    setCompareBaselineId((prev) => (prev === runId ? '' : prev));
  };

  const refreshRuns = async () => {
    const fresh = await loadTestRunsLite();
    setAllRuns(fresh);
    const bl = await loadBaselines();
    setBaselines(bl);
  };

  const toggleBaseline = useCallback(async (runId: string) => {
    if (isBaseline(baselines, runId)) {
      const next = await unmarkBaseline(runId);
      setBaselines(next);
      // Clear comparison if the run being unmarked is the current compare target.
      // Use functional updater to avoid stale closure — no need to add compareBaselineId to deps.
      setCompareBaselineId((prev) => (prev === runId ? '' : prev));
    } else {
      const next = await markAsBaseline(runId);
      setBaselines(next);
    }
  }, [baselines]);

  const baselineRun = useMemo(() => {
    if (!compareBaselineId) return null;
    return runs.find((r) => r.id === compareBaselineId) ?? null;
  }, [runs, compareBaselineId]);

  const visibleBaselines = useMemo(() => {
    const visibleRunIds = new Set(runs.map((r) => r.id));
    return baselines.filter((b) => visibleRunIds.has(b.runId));
  }, [baselines, runs]);

  const visibleBaselineCount = visibleBaselines.length;

  const compareTargetIsBaseline = useMemo(
    () => !!compareBaselineId && baselines.some((b) => b.runId === compareBaselineId),
    [baselines, compareBaselineId],
  );

  const isManualCompare = compareSelectionMode === 'manual';
  const isBaselineMode = !isManualCompare && visibleBaselineCount > 0 && compareTargetIsBaseline;

  // Most-recent baseline (visible in current run filter) used as default
  // comparison anchor whenever no explicit compare target is selected.
  const defaultBaselineCompareId = useMemo(() => {
    const visibleRunIds = new Set(runs.map((r) => r.id));
    const candidate = [...baselines]
      .sort((a, b) => b.markedAt - a.markedAt)
      .find((b) => b.runId !== selectedRunId && visibleRunIds.has(b.runId));
    return candidate?.runId ?? '';
  }, [baselines, runs, selectedRunId]);

  useEffect(() => {
    setCompareBaselineId((prev) => {
      const prevStillValid = !!prev && prev !== selectedRunId && runs.some((r) => r.id === prev);
      if (prevStillValid) return prev;
      // Respect explicit user choice (clear or manual selection) and avoid
      // re-applying baseline auto-anchor after run/filter changes.
      if (compareSelectionMode === 'manual') return '';
      return defaultBaselineCompareId;
    });
  }, [selectedRunId, runs, defaultBaselineCompareId, compareSelectionMode]);

  // When no baselines exist, reset baseline-driven comparison so the UI clearly
  // switches to ad-hoc mode instead of retaining stale compare state.
  useEffect(() => {
    if (baselines.length === 0) {
      setCompareBaselineId('');
    }
  }, [baselines.length]);

  // Regression status for every visible run (against its nearest prior baseline).
  // Uses allRuns (not filtered `runs`) for baseline lookup so the baseline is found
  // even when the run-type filter is active. Keyed by run id.
  const runRegressionStatuses = useMemo<Map<string, RunRegressionStatus>>(() => {
    if (baselines.length === 0) return new Map();
    return new Map(runs.map((r) => [r.id, computeRunRegressionStatus(r, allRuns, baselines, thresholds)]));
  }, [runs, allRuns, baselines, thresholds]);

  const filteredResults: RequestResult[] = useMemo(() => {
    return computeFilteredResults(selectedRun, filterPassed, resultTagFilter, searchTerm);
  }, [selectedRun, filterPassed, resultTagFilter, searchTerm]);

  const isWorkflowRun = selectedRun?.config.executionMode === 'workflow' && hasWorkflowData(selectedRun.results);

  // Grouping hook
  const {
    groupBy, subGroupBy, setSubGroupBy, expanded, setExpanded, toggle, handleGroupByChange,
    groupTree, groupCount, isFlat, subGroupOptions,
  } = useResultsGrouping(filteredResults, isWorkflowRun);

  const [responseModal, setResponseModal] = useState<RequestResult | null>(null);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [compareActionRunId, setCompareActionRunId] = useState<string | null>(null);

  const compareActionRun = useMemo(
    () => runs.find((r) => r.id === compareActionRunId) ?? null,
    [compareActionRunId, runs],
  );

  const compareActionRunLabel = useMemo(() => {
    if (!compareActionRun) return '';
    return `${new Date(compareActionRun.timestamp).toLocaleString()} - ${compareActionRun.summary.tps} TPS`;
  }, [compareActionRun]);

  const selectedRunLabel = useMemo(() => {
    if (!selectedRun) return '';
    return `${new Date(selectedRun.timestamp).toLocaleString()} - ${selectedRun.summary.tps} TPS`;
  }, [selectedRun]);

  const handleGenerateReport = (format: 'html' | 'json' | 'markdown') => {
    if (!selectedRun) return;
    const content = generateReport(selectedRun, { format });
    const date = new Date(selectedRun.timestamp).toISOString().slice(0, 10);
    const base = [selectedRun.svcName, selectedRun.envName, date].filter(Boolean).join('_');
    const ext = format === 'markdown' ? 'md' : format;
    const mime = format === 'html' ? 'text/html' : format === 'json' ? 'application/json' : 'text/markdown';
    downloadReport(content, `${base}_report.${ext}`, mime);
    setReportMenuOpen(false);
  };

  const renderErrorSnippet = (r: RequestResult) => {
    const hasError = !r.passed && (r.errorMessage || r.responseBody);
    if (!hasError) return null;
    const responsePreview = typeof r.responseBody === 'string' ? r.responseBody.slice(0, 120) : r.responseBody;
    const raw = r.errorMessage || responsePreview || '';
    const snippet = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const display = snippet.length > 100 ? snippet.slice(0, 100) + '…' : snippet;
    return (
      <span className="error-snippet" onClick={(e) => { e.stopPropagation(); setResponseModal(r); }} title="Click to view full response">
        {display}
      </span>
    );
  };

  if (runs.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Results</h2>
          <div className="results-top-actions">
            <button className="btn" onClick={refreshRuns}>Refresh</button>
            <button className="btn" onClick={() => importFileRef.current?.click()} title="Import a workflow execution replay trace (.json)">
              📂 Import Workflow Replay
            </button>
            <input ref={importFileRef} type="file" accept=".json" onChange={handleImportTrace} style={{ display: 'none' }} data-testid="import-trace-input" />
            <button className="btn" onClick={() => importRunFileRef.current?.click()} title="Import test results from CLI output (.json)">
              📥 Import Test Results
            </button>
            <input ref={importRunFileRef} type="file" accept=".json" onChange={handleImportRun} style={{ display: 'none' }} data-testid="import-run-input" />
          </div>
        </div>
        {importError && <div className="results-import-error">{importError} <button className="btn-dismiss" onClick={() => setImportError(null)}>×</button></div>}
        <ResultsRunTypeTabs runTypeFilter={runTypeFilter} runCounts={runCounts} onChange={setRunTypeFilter} />
        <div className="empty-state">
          {runTypeFilter === 'workflow'
            ? 'No workflow runs yet. Run a workflow from the Workflow Runner tab.'
            : runTypeFilter === 'test'
            ? 'No test runs yet. Run a test first.'
            : 'No test runs yet. Run a test first.'}
        </div>
        {showReplayModal && replayTrace && (
          <WorkflowResultsExplorerModal
            trace={replayTrace}
            onClose={closeReplayModal}
            importedFileName={importedFileName ?? undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="results-top">
        <div className="results-top-row">
          <h2>Results</h2>
          {selectedRun && <ResultsContextTags selectedRun={selectedRun} />}
          {importError && <div className="results-import-error">{importError} <button className="btn-dismiss" onClick={() => setImportError(null)}>×</button></div>}
          <div className="results-top-actions">
            <button className="btn" onClick={refreshRuns}>Refresh</button>
            <button className="btn" onClick={() => importFileRef.current?.click()} title="Import a workflow execution replay trace (.json)">
              📂 Import Workflow Replay
            </button>
            <input ref={importFileRef} type="file" accept=".json" onChange={handleImportTrace} style={{ display: 'none' }} data-testid="import-trace-input" />
            <button className="btn" onClick={() => importRunFileRef.current?.click()} title="Import test results from CLI output (.json)">
              📥 Import Test Results
            </button>
            <input ref={importRunFileRef} type="file" accept=".json" onChange={handleImportRun} style={{ display: 'none' }} data-testid="import-run-input" />
            {selectedRun && (
              <>
                {/* Results Explorer button (workflow runs only) */}
                {hasExecutionTrace(selectedRun) && (
                  <button
                    className="btn btn-primary"
                    onClick={handleOpenResultsExplorer}
                    disabled={traceLoading}
                    title="Explore execution results"
                  >
                    {traceLoading ? '⏳ Loading trace…' : '📊 Results Explorer'}
                  </button>
                )}
                <button className="btn" onClick={() => exportJson(selectedRun)} data-testid="results-export-json-btn">Export JSON</button>
                <button className="btn" onClick={() => exportCsv(selectedRun.results, selectedRun.envName, selectedRun.svcName)}>Export CSV</button>
                <div className="report-menu-wrapper">
                  <button className="btn" onClick={() => setReportMenuOpen(!reportMenuOpen)}>Generate Report ▾</button>
                  {reportMenuOpen && (
                    <div className="report-menu-dropdown">
                      <button className="report-menu-item" onClick={() => handleGenerateReport('html')}>HTML Report</button>
                      <button className="report-menu-item" onClick={() => handleGenerateReport('json')}>JSON Report</button>
                      <button className="report-menu-item" onClick={() => handleGenerateReport('markdown')}>Markdown Report</button>
                    </div>
                  )}
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selectedRun.id)}>Delete</button>
              </>
            )}
          </div>
        </div>
        <ResultsRunTypeTabs runTypeFilter={runTypeFilter} runCounts={runCounts} onChange={setRunTypeFilter} />

        <div className="results-run-selection-row">
          <ResultsRunSelect
            runs={runs}
            value={selectedRunId}
            baselines={baselines}
            runSlaStatuses={runSlaStatuses}
            runRegressionStatuses={runRegressionStatuses}
            onChange={(value) => {
              setSelectedRunId(value);
              setResultTagFilter(null);
            }}
          />

          {/* Baseline quick action */}
          {selectedRun && (
            <div className="baseline-controls baseline-controls-top">
              <button
                className={`btn btn-sm baseline-toggle ${isBaseline(baselines, selectedRun.id) ? 'baseline-active' : ''}`}
                onClick={() => toggleBaseline(selectedRun.id)}
                title={isBaseline(baselines, selectedRun.id) ? 'Unmark baseline' : 'Mark as baseline'}
              >
                {isBaseline(baselines, selectedRun.id) ? '★ Baseline' : '☆ Set Baseline'}
              </button>
            </div>
          )}
        </div>

        <ResultsViewTabs
          resultsViewTab={resultsViewTab}
          visibleBaselineCount={visibleBaselineCount}
          onChange={setResultsViewTab}
          tabIds={RESULTS_TAB_IDS}
        />

      </div>

      {/* Overview tab */}
      {resultsViewTab === 'overview' && summary && selectedRun && (
        <div
          id={RESULTS_TAB_IDS.overview.panel}
          role="tabpanel"
          aria-labelledby={RESULTS_TAB_IDS.overview.tab}
        >
          <SlaCompactBar
            key={`${selectedRunId}-sla-bar`}
            summary={summary}
            targets={slaTargets}
            results={selectedRun.results}
            scope={slaScope}
            onSaveTargets={handleSaveSlaTargets}
          />

          <ResultsMetricsCards summary={summary} selectedRun={selectedRun} />

          {onRerunFailed && (() => {
            const failedDataRowResults = selectedRun.results.filter(r => !r.passed && r.dataRowId);
            const failedRowIds = [...new Set(failedDataRowResults.map(r => r.dataRowId!))];
            if (failedRowIds.length === 0) return null;
            return (
              <div className="rerun-failed-bar">
                <span className="rerun-failed-info">
                  {failedRowIds.length} data row{failedRowIds.length > 1 ? 's' : ''} failed
                </span>
                <button
                  className="btn btn-sm btn-warning"
                  disabled={isRerunning}
                  onClick={() => onRerunFailed(selectedRun, failedRowIds)}
                >
                  {isRerunning ? 'Re-running…' : `Re-run Failed (${failedRowIds.length})`}
                </button>
              </div>
            );
          })()}

          {Object.keys(summary.errorsByStatus).length > 0 && (
            <div className="section">
              <h3>Errors by Status</h3>
              <div className="error-breakdown">
                {Object.entries(summary.errorsByStatus).map(([status, count]) => (
                  <span key={status} className="tag error-tag">
                    {status === '0' ? 'Network Error' : `HTTP ${status}`}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedRun.config.executionMode === 'workflow' && hasWorkflowData(selectedRun.results) && (
            <WorkflowResultsSummary run={selectedRun} onResultClick={setResponseModal} />
          )}

          {selectedRun.results.length > 0 && (
            <ResponseTimeHistogram run={selectedRun} />
          )}

          <AggregatedTimingTable results={selectedRun.results} />
        </div>
      )}

      {/* Comparison & Trends tab */}
      {resultsViewTab === 'analysis' && selectedRun && (
        <div
          id={RESULTS_TAB_IDS.analysis.panel}
          role="tabpanel"
          aria-labelledby={RESULTS_TAB_IDS.analysis.tab}
        >
          <ResultsComparisonTrendsToolbar
            isBaselineMode={isBaselineMode}
            compareBaselineId={compareBaselineId}
            runs={runs}
            baselines={baselines}
            selectedRunId={selectedRunId}
            showTrend={showTrend}
            onCompareSelectionChange={(value) => {
              setCompareSelectionMode('manual');
              setCompareBaselineId(value);
            }}
            onClearComparison={() => {
              setCompareSelectionMode('manual');
              setCompareBaselineId('');
            }}
            onToggleTrend={() => setShowTrend(!showTrend)}
          />

          <div className="results-comparison-trends-layout">
            <div className="results-comparison-trends-main">

              {showTrend && runs.length >= 2 && (
                <TrendChart runs={runs} baselines={baselines} selectedRun={selectedRun} />
              )}

              {baselineRun && baselineRun.id !== selectedRun.id && (
                <RunComparisonPanel
                  baselineRun={baselineRun}
                  currentRun={selectedRun}
                  thresholds={thresholds}
                  baselineLabel={baselines.find((b) => b.runId === baselineRun.id)?.label}
                  comparedRunIsBaseline={baselines.some((b) => b.runId === baselineRun.id)}
                  onRenameBaseline={
                    baselines.some((b) => b.runId === baselineRun.id)
                      ? async (runId, label) => {
                          const next = await renameBaseline(runId, label);
                          setBaselines(next);
                        }
                      : undefined
                  }
                />
              )}

              {!baselineRun && !showTrend && (
                <div className="empty-state">
                  {visibleBaselineCount === 0
                    ? 'Ad-hoc mode: select a run to compare, or mark a baseline to enable anchored comparison.'
                    : 'Select a comparison run or enable Trend to start analysis.'}
                </div>
              )}
            </div>

            <aside className="results-comparison-trends-side">
              <div className="results-comparison-trends-card">
                {visibleBaselineCount === 0 && (
                  <p className="baselines-empty">No baselines marked yet. Click ☆ Set Baseline to mark the current run.</p>
                )}
                <BaselineListPanel
                  baselines={visibleBaselines}
                  runs={runs}
                  selectedRunId={selectedRunId}
                  compareBaselineId={compareBaselineId}
                  onCompare={(runId) => {
                    setCompareActionRunId(runId);
                  }}
                  onUnmark={async (runId) => {
                    const next = await unmarkBaseline(runId);
                    setBaselines(next);
                    if (compareBaselineId === runId) setCompareBaselineId('');
                  }}
                  onRename={async (runId, label) => {
                    const next = await renameBaseline(runId, label);
                    setBaselines(next);
                  }}
                />
              </div>

              <div className="results-comparison-trends-card">
                <RegressionThresholdsPanel
                  thresholds={thresholds}
                  onSave={async (t) => {
                    await saveRegressionThresholds(t);
                    setThresholds(t);
                  }}
                  onCancel={() => { /* draft reset is handled internally by the component */ }}
                />
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* SLA tab */}
      {resultsViewTab === 'sla' && summary && selectedRun && slaTargets.length > 0 && (
        <div
          id={RESULTS_TAB_IDS.sla.panel}
          role="tabpanel"
          aria-labelledby={RESULTS_TAB_IDS.sla.tab}
        >
          <SlaStatusAccordion
            key={`${selectedRunId}-sla-accordion`}
            targets={slaTargets}
            results={selectedRun.results}
            summary={summary}
          />
        </div>
      )}
      {resultsViewTab === 'sla' && slaTargets.length === 0 && (
        <div
          id={RESULTS_TAB_IDS.sla.panel}
          role="tabpanel"
          aria-labelledby={RESULTS_TAB_IDS.sla.tab}
          className="empty-state"
          style={{ marginTop: 12 }}
        >
          No SLA targets defined for this run.
        </div>
      )}

      {/* Request details tab */}
      {resultsViewTab === 'requests' && (
        <div id={RESULTS_TAB_IDS.requests.panel} role="tabpanel" aria-labelledby={RESULTS_TAB_IDS.requests.tab}>
          <ResultsRequestDetailsTab
            selectedRun={selectedRun}
            filteredResults={filteredResults}
            filterPassed={filterPassed}
            setFilterPassed={setFilterPassed}
            resultTags={resultTags}
            resultTagFilter={resultTagFilter}
            setResultTagFilter={setResultTagFilter}
            groupBy={groupBy}
            handleGroupByChange={handleGroupByChange}
            subGroupOptions={subGroupOptions}
            subGroupBy={subGroupBy}
            setSubGroupBy={setSubGroupBy}
            setExpanded={setExpanded}
            expanded={expanded}
            groupCount={groupCount}
            isFlat={isFlat}
            groupTree={groupTree}
            toggle={toggle}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            isWorkflowRun={!!isWorkflowRun}
            onResultClick={setResponseModal}
            renderErrorSnippet={renderErrorSnippet}
          />
        </div>
      )}

      <ResponseDetailModal result={responseModal} onClose={() => setResponseModal(null)} />

      {/* Results Explorer Modal */}
      {showReplayModal && replayTrace && (
        <WorkflowResultsExplorerModal
          trace={replayTrace}
          onClose={closeReplayModal}
          importedFileName={importedFileName ?? undefined}
        />
      )}

      {compareActionRun && (
        <CompareActionModal
          open
          compareActionRunLabel={compareActionRunLabel}
          selectedRunLabel={selectedRunLabel}
          onClose={() => setCompareActionRunId(null)}
          onUseAsCompared={() => {
            setCompareSelectionMode('manual');
            setCompareBaselineId(compareActionRun.id);
            setCompareActionRunId(null);
          }}
          onSwapDirection={() => {
            const prevSelectedId = selectedRunId;
            setCompareSelectionMode('manual');
            setSelectedRunId(compareActionRun.id);
            setCompareBaselineId(prevSelectedId && prevSelectedId !== compareActionRun.id ? prevSelectedId : '');
            setCompareActionRunId(null);
          }}
        />
      )}
    </div>
  );
}
