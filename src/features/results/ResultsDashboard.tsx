import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from 'react';
import type { TestRun, RequestResult } from '../../shared/types';
import ResponseDetailModal from '../requests/components/ResponseDetailModal';
import { AggregatedTimingTable } from '../test-runner/components/WaterfallBar';
import { loadTestRunsLite, loadTraceForRun, deleteTestRun } from '../../shared/utils/storage';
import { exportJson, exportCsv } from '../../shared/utils/export';
import { hasWorkflowData, type GroupNode, type GroupByLevel } from '../test-runner/utils/resultsGrouping';
import { thinkTimeLabel } from '../test-runner/utils/runnerProgressStorage';
import { RunComparisonPanel, TrendChart } from './components/RunComparisonPanel';
import { ResponseTimeHistogram } from './components/ResponseTimeHistogram';
import { DataRowSummaryTable } from './components/DataRowSummaryTable';
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

interface Props {
  envName?: string;
  svcName?: string;
  onRerunFailed?: (run: TestRun, failedRowIds: string[]) => void;
  isRerunning?: boolean;
  /** Initial run type filter (can be set from post-run navigation) */
  initialRunTypeFilter?: 'all' | 'test' | 'workflow';
}

type RunTypeFilter = 'all' | 'test' | 'workflow';

export default function ResultsDashboard({ envName, svcName, onRerunFailed, isRerunning, initialRunTypeFilter }: Props) {
  const [allRuns, setAllRuns] = useState<TestRun[]>([]);
  const [baselines, setBaselines] = useState<BaselineMark[]>([]);
  const [compareBaselineId, setCompareBaselineId] = useState<string>('');
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
    return allRuns.filter((r) => {
      // For workflow runs, don't filter by env/svc since workflows aren't microservice-specific
      const isWorkflowRun = r.config.executionMode === 'workflow';
      if (!isWorkflowRun) {
        // Runs with no svcName are unscoped (e.g. CLI imports) — show in all env/svc contexts
        const isUnscoped = !r.svcName;
        if (!isUnscoped) {
          if (envName && r.envName && r.envName !== envName) return false;
          if (svcName && r.svcName && r.svcName !== svcName) return false;
        }
      }
      // Filter by run type
      if (runTypeFilter === 'workflow' && !isWorkflowRun) return false;
      if (runTypeFilter === 'test' && isWorkflowRun) return false;
      return true;
    });
  }, [allRuns, envName, svcName, runTypeFilter]);

  const runCounts = useMemo(() => {
    // Test runs are filtered by env/svc, workflow runs are not
    const testRuns = allRuns.filter((r) => {
      if (r.config.executionMode === 'workflow') return false;
      const isUnscoped = !r.svcName;
      if (!isUnscoped) {
        if (envName && r.envName && r.envName !== envName) return false;
        if (svcName && r.svcName && r.svcName !== svcName) return false;
      }
      return true;
    });
    const workflowRuns = allRuns.filter(r => r.config.executionMode === 'workflow');
    return {
      all: testRuns.length + workflowRuns.length,
      test: testRuns.length,
      workflow: workflowRuns.length,
    };
  }, [allRuns, envName, svcName]);

  const [selectedRunId, setSelectedRunId] = useState<string>(runs[0]?.id ?? '');
  const [detailsTab, setDetailsTab] = useState<'requests' | 'sla' | 'baselines'>('requests');
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

  // Regression status for every visible run (against its nearest prior baseline).
  // Uses allRuns (not filtered `runs`) for baseline lookup so the baseline is found
  // even when the run-type filter is active. Keyed by run id.
  const runRegressionStatuses = useMemo<Map<string, RunRegressionStatus>>(() => {
    if (baselines.length === 0) return new Map();
    return new Map(runs.map((r) => [r.id, computeRunRegressionStatus(r, allRuns, baselines, thresholds)]));
  }, [runs, allRuns, baselines, thresholds]);

  const filteredResults: RequestResult[] = useMemo(() => {
    if (!selectedRun) return [];
    const q = searchTerm.toLowerCase().trim();
    return selectedRun.results.filter((r) => {
      const passed = !!r.passed;
      if (filterPassed === 'passed' && !passed) return false;
      if (filterPassed === 'failed' && passed) return false;
      if (filterPassed === 'failed-data-rows' && (passed || !r.dataRowId)) return false;
      if (resultTagFilter && !(r.scenarioTags ?? []).includes(resultTagFilter)) return false;
      if (q && !(
        r.scenarioName.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        (r.featureGroupName?.toLowerCase().includes(q)) ||
        (r.groupName?.toLowerCase().includes(q)) ||
        (r.errorMessage?.toLowerCase().includes(q)) ||
        (r.dataRowLabel?.toLowerCase().includes(q)) ||
        (r.scenarioTags ?? []).some(tag => tag.toLowerCase().includes(q))
      )) return false;
      return true;
    });
  }, [selectedRun, filterPassed, resultTagFilter, searchTerm]);

  const isWorkflowRun = selectedRun?.config.executionMode === 'workflow' && hasWorkflowData(selectedRun.results);

  // Grouping hook
  const {
    groupBy, subGroupBy, setSubGroupBy, expanded, setExpanded, toggle, handleGroupByChange,
    groupTree, groupCount, isFlat, subGroupOptions,
  } = useResultsGrouping(filteredResults, isWorkflowRun);

  const [responseModal, setResponseModal] = useState<RequestResult | null>(null);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);

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
    const raw = r.errorMessage || r.responseBody?.slice(0, 120) || '';
    const snippet = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const display = snippet.length > 100 ? snippet.slice(0, 100) + '…' : snippet;
    return (
      <span className="error-snippet" onClick={(e) => { e.stopPropagation(); setResponseModal(r); }} title="Click to view full response">
        {display}
      </span>
    );
  };

  /* ── Render helpers ── */

  const renderDetailRow = (r: RequestResult) => (
    <tr key={r.id} className={`group-detail-row ${r.passed ? '' : 'row-failed'} clickable-row`} onClick={() => setResponseModal(r)}>
      <td className="result-id-cell">{r.id.replace(/^\D+/, '')}</td>
      <td className="group-detail-name">
        <span className={`method-badge method-${r.method.toLowerCase()}`}>{r.method}</span>
        {' '}{r.scenarioName}
        {r.dataRowLabel && <span className="data-row-label">{r.dataRowLabel}</span>}
      </td>
      <td colSpan={2} className="url-cell">{r.url}</td>
      <td>{r.httpStatus || 'ERR'}</td>
      <td><span className={`tag ${r.validationMode === 'none' ? 'tag-dim' : 'tag-info'}`}>{r.validationMode ?? 'none'}</span></td>
      <td>{r.responseTimeMs}</td>
      <td>{r.passed ? '✓' : '✗'}</td>
      <td className="failure-cell">
        {renderErrorSnippet(r)}
        {r.passed === false && !r.errorMessage && r.failureDetails.length > 0 && (
          <span className="error-snippet validation-snippet" onClick={(e) => { e.stopPropagation(); setResponseModal(r); }} title="Click to view details">
            {r.failureDetails.length} validation failure{r.failureDetails.length > 1 ? 's' : ''}
          </span>
        )}
      </td>
    </tr>
  );

  const applyDetailFilter = useCallback((results: RequestResult[]): RequestResult[] => {
    if (filterPassed === 'all') return results;
    return results.filter((r) => {
      const passed = !!r.passed;
      if (filterPassed === 'passed' && !passed) return false;
      if (filterPassed === 'failed' && passed) return false;
      if (filterPassed === 'failed-data-rows' && (passed || !r.dataRowId)) return false;
      return true;
    });
  }, [filterPassed]);

  const renderGroupRow = (g: GroupNode, depth: number, parentKey: string) => {
    const nodeKey = parentKey ? `${parentKey}/${g.key}` : g.key;
    const isOpen = expanded.has(nodeKey);
    const allPassed = g.failed === 0 && g.validationFailed === 0;
    const hasChildren = g.children.length > 0;
    const indent = depth * 20;
    const visibleResults = applyDetailFilter(g.results);

    // When featureGroupName is absent the key is '' — skip the group header and
    // render children/results directly so no synthetic label appears in the UI.
    if (g.key === '' && depth === 0) {
      return (
        <Fragment key="__ungrouped__">
          {hasChildren && g.children.map((child) => renderGroupRow(child, depth, '__ungrouped__'))}
          {!hasChildren && visibleResults.length > 0 && (
            <>
              {visibleResults.some(r => r.dataRowId) && (
                <tr><td colSpan={9} className="data-row-summary-cell">
                  <DataRowSummaryTable results={visibleResults} scenarioName={g.key} onResultClick={setResponseModal} />
                </td></tr>
              )}
              {!visibleResults.some(r => r.dataRowId) && (
                <>
                  <tr className="detail-header-row">
                    <th>ID</th><th>Test Name</th><th colSpan={2}>URL</th>
                    <th>Status</th><th>Validation</th><th>Time (ms)</th>
                    <th>Passed</th><th>Error / Details</th>
                  </tr>
                  {visibleResults.map(renderDetailRow)}
                </>
              )}
            </>
          )}
        </Fragment>
      );
    }

    return (
      <Fragment key={nodeKey}>
        <tr
          className={`group-header-row depth-${depth} ${allPassed ? '' : 'group-has-failures'}`}
          onClick={() => toggle(nodeKey)}
        >
          <td className="group-chevron" style={{ paddingLeft: indent }}>{isOpen ? '▼' : '▶'}</td>
          <td className="group-key">{g.key}</td>
          <td>{g.total}</td>
          <td className="group-passed">{g.passed}</td>
          <td className={g.failed > 0 ? 'group-failed' : ''}>{g.failed}</td>
          <td className={g.validationFailed > 0 ? 'group-val-failed' : ''}>{g.validationFailed}</td>
          <td>{g.avgTime}</td>
          <td>{g.minTime}</td>
          <td>{g.maxTime}</td>
        </tr>
        {isOpen && hasChildren && g.children.map((child) => renderGroupRow(child, depth + 1, nodeKey))}
        {isOpen && !hasChildren && visibleResults.length > 0 && (
          <>
            {visibleResults.some(r => r.dataRowId) && (
              <tr><td colSpan={9} className="data-row-summary-cell">
                <DataRowSummaryTable results={visibleResults} scenarioName={g.key} onResultClick={setResponseModal} />
              </td></tr>
            )}
            {!visibleResults.some(r => r.dataRowId) && (
              <>
                <tr className="detail-header-row">
                  <th>ID</th>
                  <th>Test Name</th>
                  <th colSpan={2}>URL</th>
                  <th>Status</th>
                  <th>Validation</th>
                  <th>Time (ms)</th>
                  <th>Passed</th>
                  <th>Error / Details</th>
                </tr>
                {visibleResults.map(renderDetailRow)}
              </>
            )}
          </>
        )}
      </Fragment>
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
        {/* Show filter tabs even in empty state so user can switch back */}
        <div className="results-run-filter-tabs">
          <button
            className={`run-filter-tab ${runTypeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setRunTypeFilter('all')}
          >
            All Runs ({runCounts.all})
          </button>
          <button
            className={`run-filter-tab ${runTypeFilter === 'test' ? 'active' : ''}`}
            onClick={() => setRunTypeFilter('test')}
          >
            🧪 Test Runs ({runCounts.test})
          </button>
          <button
            className={`run-filter-tab ${runTypeFilter === 'workflow' ? 'active' : ''}`}
            onClick={() => setRunTypeFilter('workflow')}
          >
            ⚡ Workflow Runs ({runCounts.workflow})
          </button>
        </div>
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
          {selectedRun && (
            <div className="context-tags">
              {/* Hide svcName for workflow runs — microservice context doesn't apply */}
              {selectedRun.svcName && selectedRun.config.executionMode !== 'workflow' && (
                <span className="context-tag svc-tag">{selectedRun.svcName}</span>
              )}
              {selectedRun.envName && <span className="context-tag env-tag">{selectedRun.envName}</span>}
              {selectedRun.config.executionMode === 'workflow' && selectedRun.workflowName ? (
                <span className="context-tag workflow-name-tag" title={selectedRun.workflowName}>⚡ {selectedRun.workflowName}</span>
              ) : selectedRun.baseUrl ? (
                <span className="context-tag base-url-tag" title={selectedRun.baseUrl}>Host: {selectedRun.baseUrl}</span>
              ) : (
                <span className="context-tag base-url-tag hardcoded">Host: hardcoded</span>
              )}
              <span className="context-tag exec-mode-tag">
                {selectedRun.config.executionMode === 'constant-arrival' && selectedRun.config.arrivalRate ? (
                  <>
                    Arrival Rate
                    {' · '}{selectedRun.config.arrivalRate.targetRps} RPS
                    {' · '}{selectedRun.config.arrivalRate.durationSec}s
                    {selectedRun.config.arrivalRate.ramp && ` · ramp ${selectedRun.config.arrivalRate.ramp.startRps}→${selectedRun.config.arrivalRate.ramp.endRps}`}
                  </>
                ) : selectedRun.config.executionMode === 'load-profile' && selectedRun.config.loadProfile ? (
                  <>
                    {selectedRun.config.loadProfile.type === 'ramp-up' ? 'Ramp-Up' : selectedRun.config.loadProfile.type === 'spike' ? 'Spike' : 'Sustained'}
                    {' · '}Peak:{selectedRun.config.loadProfile.maxConcurrency}
                    {' · '}{selectedRun.config.loadProfile.durationSec}s
                    {selectedRun.config.loadProfile.type === 'spike' && ` · Spike:${selectedRun.config.loadProfile.spikeConcurrency}`}
                  </>
                ) : (
                  <>
                    {selectedRun.config.executionMode === 'pool' ? 'Pool' : selectedRun.config.executionMode === 'sequential' ? 'Sequential' : selectedRun.config.executionMode === 'workflow' ? 'Workflow' : 'Batch'}
                    {' · '}C:{selectedRun.config.concurrency}{' · '}I:{selectedRun.config.iterations}
                  </>
                )}
              </span>
              {thinkTimeLabel(selectedRun.config.thinkTime) && (
                <span className="context-tag think-time-tag">{thinkTimeLabel(selectedRun.config.thinkTime)}</span>
              )}
            </div>
          )}
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
                <button className="btn" onClick={() => exportJson(selectedRun)}>Export JSON</button>
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
        {/* Run Type Filter Tabs */}
        <div className="results-run-filter-tabs">
          <button
            className={`run-filter-tab ${runTypeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setRunTypeFilter('all')}
          >
            All Runs ({runCounts.all})
          </button>
          <button
            className={`run-filter-tab ${runTypeFilter === 'test' ? 'active' : ''}`}
            onClick={() => setRunTypeFilter('test')}
          >
            🧪 Test Runs ({runCounts.test})
          </button>
          <button
            className={`run-filter-tab ${runTypeFilter === 'workflow' ? 'active' : ''}`}
            onClick={() => setRunTypeFilter('workflow')}
          >
            ⚡ Workflow Runs ({runCounts.workflow})
          </button>
        </div>

        <select className="results-run-select" value={selectedRunId} onChange={(e) => { setSelectedRunId(e.target.value); setResultTagFilter(null); }}>
          {runs.map((r) => {
            const bl = isBaseline(baselines, r.id);
            const isWf = r.config.executionMode === 'workflow';
            const slaStatus = runSlaStatuses.has(r.id) ? runSlaStatuses.get(r.id) : undefined;
            const slaDot = slaStatus === 'pass' ? '🟢' : slaStatus === 'fail' ? '🔴' : slaStatus === 'warn' ? '🟡' : slaStatus === 'no-data' ? '⚪' : slaStatus === null ? '⚫' : '';
            const regStatus = runRegressionStatuses.get(r.id);
            const regDot = regStatus === 'critical' ? '🔴' : regStatus === 'warn' ? '🟡' : regStatus === 'pass' ? '🟢' : '';
            const label = [
              bl ? '★' : '',
              isWf ? '⚡' : '🧪',
              slaDot,
              regDot ? `R:${regDot}` : '',
              new Date(r.timestamp).toLocaleString(),
              r.projectName,
              r.svcName,
              r.envName,
              `${r.summary.totalRequests} req`,
              `${r.summary.tps} TPS`,
            ].filter(Boolean).join(' — ');
            return <option key={r.id} value={r.id}>{label}</option>;
          })}
        </select>

        {/* Baseline & Comparison Controls */}
        {selectedRun && (
          <div className="baseline-controls">
            <button
              className={`btn btn-sm baseline-toggle ${isBaseline(baselines, selectedRun.id) ? 'baseline-active' : ''}`}
              onClick={() => toggleBaseline(selectedRun.id)}
              title={isBaseline(baselines, selectedRun.id) ? 'Unmark baseline' : 'Mark as baseline'}
            >
              {isBaseline(baselines, selectedRun.id) ? '★ Baseline' : '☆ Set Baseline'}
            </button>

            <select
              className="baseline-compare-select"
              value={compareBaselineId}
              onChange={(e) => setCompareBaselineId(e.target.value)}
            >
              <option value="">Compare against run...</option>
              {/* Baseline runs first, starred */}
              {runs.filter((r) => isBaseline(baselines, r.id) && r.id !== selectedRunId).map((r) => {
                const bl = baselines.find((b) => b.runId === r.id);
                const label = bl?.label ?? new Date(r.timestamp).toLocaleString();
                return <option key={r.id} value={r.id}>★ {label} — {r.summary.tps} TPS</option>;
              })}
              {/* Separator only if there are both baseline and non-baseline runs */}
              {runs.some((r) => isBaseline(baselines, r.id) && r.id !== selectedRunId) &&
               runs.some((r) => !isBaseline(baselines, r.id) && r.id !== selectedRunId) && (
                <option disabled>──────────────</option>
              )}
              {/* Non-baseline runs */}
              {runs.filter((r) => !isBaseline(baselines, r.id) && r.id !== selectedRunId).map((r) => (
                <option key={r.id} value={r.id}>{new Date(r.timestamp).toLocaleString()} — {r.summary.tps} TPS</option>
              ))}
            </select>

            {compareBaselineId && (
              <span className="baseline-compare-chip">
                {(() => {
                  const bl = baselines.find((b) => b.runId === compareBaselineId);
                  const blRun = runs.find((r) => r.id === compareBaselineId);
                  const label = bl?.label ?? (blRun ? new Date(blRun.timestamp).toLocaleString() : compareBaselineId.slice(0, 12));
                  return `vs ${label}`;
                })()}
                <button
                  className="baseline-compare-chip-clear"
                  onClick={() => setCompareBaselineId('')}
                  title="Clear comparison"
                >✕</button>
              </span>
            )}

            <button
              className={`btn btn-sm ${showTrend ? 'btn-primary' : ''}`}
              onClick={() => setShowTrend(!showTrend)}
            >
              {showTrend ? 'Hide Trend' : 'Show Trend'}
            </button>
          </div>
        )}

      </div>

      {/* Trend Chart */}
      {showTrend && runs.length >= 2 && (
        <TrendChart runs={runs} baselines={baselines} selectedRun={selectedRun ?? undefined} />
      )}

      {/* Run Comparison */}
      {baselineRun && selectedRun && baselineRun.id !== selectedRun.id && (
        <RunComparisonPanel
          baselineRun={baselineRun}
          currentRun={selectedRun}
          thresholds={thresholds}
          baselineLabel={baselines.find((b) => b.runId === baselineRun.id)?.label}
          onRenameBaseline={
            // Only provide rename handler when the comparison run is actually a baseline.
            // For non-baseline comparison runs, renameBaseline() silently no-ops and the
            // rename input would appear to accept input but never persist the new label.
            baselines.some((b) => b.runId === baselineRun.id)
              ? async (runId, label) => {
                  const next = await renameBaseline(runId, label);
                  setBaselines(next);
                }
              : undefined
          }
        />
      )}

      {/* SLA Compact Bar (Phase C) */}
      {summary && selectedRun && (
        <SlaCompactBar
          key={`${selectedRunId}-sla-bar`}
          summary={summary}
          targets={slaTargets}
          results={selectedRun.results}
          scope={slaScope}
          onSaveTargets={handleSaveSlaTargets}
        />
      )}

      {/* Summary Metrics */}
      {summary && selectedRun && (
        <ResultsMetricsCards summary={summary} selectedRun={selectedRun} />
      )}

      {/* Re-run Failed Rows action bar */}
      {selectedRun && onRerunFailed && (() => {
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

      {/* Error breakdown */}
      {summary && Object.keys(summary.errorsByStatus).length > 0 && (
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

      {/* Workflow Results Summary */}
      {selectedRun && selectedRun.config.executionMode === 'workflow' && hasWorkflowData(selectedRun.results) && (
        <WorkflowResultsSummary run={selectedRun} onResultClick={setResponseModal} />
      )}

      {/* Response Time Distribution Chart */}
      {selectedRun && selectedRun.results.length > 0 && (
        <ResponseTimeHistogram run={selectedRun} />
      )}

      {/* Timing Breakdown */}
      {selectedRun && <AggregatedTimingTable results={selectedRun.results} />}

      {/* Details Tabs: Request Details / SLA Status / Baselines */}
      <div className="results-details-tabs-header">
        <div className="results-run-filter-tabs">
          <button
            className={`run-filter-tab ${detailsTab === 'requests' ? 'active' : ''}`}
            onClick={() => setDetailsTab('requests')}
          >
            Request Details
          </button>
          <button
            className={`run-filter-tab ${detailsTab === 'sla' ? 'active' : ''}`}
            onClick={() => setDetailsTab('sla')}
          >
            SLA Status
          </button>
          <button
            className={`run-filter-tab baselines-tab ${detailsTab === 'baselines' ? 'active' : ''}`}
            onClick={() => setDetailsTab('baselines')}
          >
            ★ Baselines{baselines.length > 0 ? ` (${baselines.length})` : ''}
          </button>
        </div>
      </div>

      {/* Tab: Baselines */}
      {detailsTab === 'baselines' && (
        <div className="baselines-tab-content">
          {baselines.length === 0 && (
            <p className="baselines-empty">No baselines marked yet. Click ☆ Set Baseline to mark the current run.</p>
          )}
          <BaselineListPanel
            baselines={baselines}
            runs={runs}
            selectedRunId={selectedRunId}
            onCompare={(runId) => {
              setCompareBaselineId(runId);
              setDetailsTab('requests');
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
          <RegressionThresholdsPanel
            thresholds={thresholds}
            onSave={async (t) => {
              await saveRegressionThresholds(t);
              setThresholds(t);
            }}
            onCancel={() => { /* draft reset is handled internally by the component */ }}
          />
        </div>
      )}

      {/* Tab: SLA Status */}
      {detailsTab === 'sla' && summary && selectedRun && slaTargets.length > 0 && (
        <SlaStatusAccordion
          key={`${selectedRunId}-sla-accordion`}
          targets={slaTargets}
          results={selectedRun.results}
          summary={summary}
        />
      )}
      {detailsTab === 'sla' && slaTargets.length === 0 && (
        <div className="empty-state" style={{ marginTop: 12 }}>No SLA targets defined for this run.</div>
      )}

      {/* Tab: Request Details */}
      {detailsTab === 'requests' && (
      <div className="section">
        <div className="filter-row">
          <select value={filterPassed} onChange={(e) => { setFilterPassed(e.target.value); setPage(0); }}>
            <option value="all">All Results</option>
            <option value="passed">Passed Only</option>
            <option value="failed">Failed Only</option>
            {selectedRun?.results.some(r => r.dataRowId) && (
              <option value="failed-data-rows">Failed Data Rows</option>
            )}
          </select>

          <div className="group-by-controls">
            <label className="group-by-label">Group by</label>
            <select value={groupBy} onChange={(e) => handleGroupByChange(e.target.value as GroupByLevel)}>
              <option value="feature">Feature</option>
              <option value="group">Scenario</option>
              <option value="test">Test Name (flat)</option>
              {isWorkflowRun && <option value="iteration">Iteration</option>}
              {isWorkflowRun && <option value="workflowStep">Workflow Step</option>}
            </select>
            {subGroupOptions.length > 0 && (
              <select value={subGroupBy} onChange={(e) => { setSubGroupBy(e.target.value as GroupByLevel); setExpanded(new Set()); }}>
                {subGroupOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>

          {resultTags.length > 0 && (
            <div className="results-tag-filter">
              <span className="results-tag-label">Tags:</span>
              <button
                className={`results-tag-chip ${!resultTagFilter ? 'active' : ''}`}
                onClick={() => { setResultTagFilter(null); setPage(0); }}
              >
                All
              </button>
              {resultTags.map(tag => (
                <button
                  key={tag}
                  className={`results-tag-chip ${resultTagFilter === tag ? 'active' : ''}`}
                  onClick={() => { setResultTagFilter(resultTagFilter === tag ? null : tag); setPage(0); }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <span className="filter-count">
            {isFlat
              ? `${filteredResults.length} results`
              : `${groupCount} groups · ${filteredResults.length} results`}
          </span>
          <input
            className="results-search"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          />
        </div>

        {!isFlat ? (
          /* ── Grouped / Multi-level View ── */
          <div className="table-container">
            <table className="grouped-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>{groupBy === 'feature' ? 'Feature' : 'Scenario'}</th>
                  <th>Total</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Val. Failed</th>
                  <th>Avg (ms)</th>
                  <th>Min (ms)</th>
                  <th>Max (ms)</th>
                </tr>
              </thead>
              <tbody>
                {groupTree.map((g) => renderGroupRow(g, 0, ''))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Flat View ── */
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Scenario</th>
                  <th>Method</th>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Time (ms)</th>
                  <th>Validation</th>
                  <th>Passed</th>
                  <th>Failure Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.slice(page * pageSize, (page + 1) * pageSize).map((r) => (
                  <tr key={r.id} className={`${r.passed ? '' : 'row-failed'} clickable-row`} onClick={() => setResponseModal(r)}>
                    <td className="result-id-cell">{r.id.replace(/^\D+/, '')}</td>
                    <td>{r.scenarioName}{r.dataRowLabel && <span className="data-row-label">{r.dataRowLabel}</span>}</td>
                    <td><span className={`method-badge method-${r.method.toLowerCase()}`}>{r.method}</span></td>
                    <td className="url-cell">{r.url}</td>
                    <td>{r.httpStatus || 'ERR'}</td>
                    <td>{r.responseTimeMs}</td>
                    <td><span className={`tag ${r.validationMode === 'none' ? 'tag-dim' : 'tag-info'}`}>{r.validationMode ?? 'none'}</span></td>
                    <td>{r.passed ? '✓' : '✗'}</td>
                    <td className="failure-cell">
                      {renderErrorSnippet(r)}
                      {r.passed === false && !r.errorMessage && r.failureDetails.length > 0 && (
                        <span className="error-snippet validation-snippet" onClick={(e) => { e.stopPropagation(); setResponseModal(r); }} title="Click to view details">
                          {r.failureDetails.length} validation failure{r.failureDetails.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredResults.length > pageSize && (
              <div className="pagination">
                <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(0)}>First</button>
                <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <span className="pagination-info">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredResults.length)} of {filteredResults.length}
                </span>
                <button className="btn btn-sm" disabled={(page + 1) * pageSize >= filteredResults.length} onClick={() => setPage((p) => p + 1)}>Next</button>
                <button className="btn btn-sm" disabled={(page + 1) * pageSize >= filteredResults.length} onClick={() => setPage(Math.ceil(filteredResults.length / pageSize) - 1)}>Last</button>
              </div>
            )}
          </div>
        )}
      </div>
      )} {/* end detailsTab === 'requests' */}

      <ResponseDetailModal result={responseModal} onClose={() => setResponseModal(null)} />

      {/* Results Explorer Modal */}
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
