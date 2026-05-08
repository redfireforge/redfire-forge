import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from 'react';
import type { TestRun, RequestResult } from '../../shared/types';
import ResponseDetailModal from '../requests/components/ResponseDetailModal';
import { AggregatedTimingTable } from '../test-runner/components/WaterfallBar';
import { loadTestRuns, deleteTestRun } from '../../shared/utils/storage';
import { exportJson, exportCsv } from '../../shared/utils/export';
import { buildGroups, hasWorkflowData, type GroupByLevel, type GroupNode } from '../test-runner/utils/resultsGrouping';
import { thinkTimeLabel } from '../test-runner/utils/runnerProgressStorage';
import { RunComparisonPanel, TrendChart } from './components/RunComparisonPanel';
import { ResponseTimeHistogram } from './components/ResponseTimeHistogram';
import { DataRowSummaryTable } from './components/DataRowSummaryTable';
import { WorkflowResultsSummary } from './components/WorkflowResultsSummary';
import { generateReport, downloadReport } from './utils/reportGenerator';
import { loadBaselines, markAsBaseline, unmarkBaseline, isBaseline, type BaselineMark } from './utils/runBaselines';
import WorkflowResultsExplorerModal from './components/WorkflowResultsExplorerModal';
import { hasExecutionTrace, getExecutionTrace } from '../../shared/utils/traceCompression';

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
  const [runTypeFilter, setRunTypeFilter] = useState<RunTypeFilter>(initialRunTypeFilter ?? 'all');

  // Update filter when initialRunTypeFilter changes (e.g., from post-run navigation)
  useEffect(() => {
    if (initialRunTypeFilter) {
      setRunTypeFilter(initialRunTypeFilter);
    }
  }, [initialRunTypeFilter]);

  const prevRerunning = useRef(false);

  useEffect(() => {
    loadTestRuns().then(setAllRuns);
    loadBaselines().then(setBaselines);
  }, []);

  // Auto-refresh when a re-run completes
  useEffect(() => {
    if (prevRerunning.current && !isRerunning) {
      loadTestRuns().then(setAllRuns);
    }
    prevRerunning.current = !!isRerunning;
  }, [isRerunning]);

  const runs = useMemo(() => {
    return allRuns.filter((r) => {
      // For workflow runs, don't filter by env/svc since workflows aren't microservice-specific
      const isWorkflowRun = r.config.executionMode === 'workflow';
      if (!isWorkflowRun) {
        if (envName && r.envName !== envName) return false;
        if (svcName && r.svcName !== svcName) return false;
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
      if (envName && r.envName !== envName) return false;
      if (svcName && r.svcName !== svcName) return false;
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
  const [filterPassed, setFilterPassed] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupByLevel>('feature');
  const [subGroupBy, setSubGroupBy] = useState<GroupByLevel>('group');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [showReplayModal, setShowReplayModal] = useState(false);

  useEffect(() => {
    if (runs.length > 0 && !runs.find((r) => r.id === selectedRunId)) {
      setSelectedRunId(runs[0].id);
    } else if (runs.length === 0) {
      setSelectedRunId('');
    }
  }, [runs, selectedRunId]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;
  const summary = selectedRun?.summary ?? null;

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
    }
  };

  const refreshRuns = async () => {
    const fresh = await loadTestRuns();
    setAllRuns(fresh);
    const bl = await loadBaselines();
    setBaselines(bl);
  };

  const toggleBaseline = useCallback(async (runId: string) => {
    if (isBaseline(baselines, runId)) {
      const next = await unmarkBaseline(runId);
      setBaselines(next);
    } else {
      const next = await markAsBaseline(runId);
      setBaselines(next);
    }
  }, [baselines]);

  const baselineRun = useMemo(() => {
    if (!compareBaselineId) return null;
    return runs.find((r) => r.id === compareBaselineId) ?? null;
  }, [runs, compareBaselineId]);

  const filteredResults: RequestResult[] = useMemo(() => {
    if (!selectedRun) return [];
    const q = searchTerm.toLowerCase().trim();
    return selectedRun.results.filter((r) => {
      if (filterPassed === 'passed' && !r.passed) return false;
      if (filterPassed === 'failed' && r.passed) return false;
      if (filterPassed === 'failed-data-rows' && (r.passed || !r.dataRowId)) return false;
      if (q && !(
        r.scenarioName.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        (r.featureGroupName?.toLowerCase().includes(q)) ||
        (r.groupName?.toLowerCase().includes(q)) ||
        (r.errorMessage?.toLowerCase().includes(q)) ||
        (r.dataRowLabel?.toLowerCase().includes(q))
      )) return false;
      return true;
    });
  }, [selectedRun, filterPassed, searchTerm]);


  const groupLevels: GroupByLevel[] = useMemo(() => {
    if (groupBy === 'test' && subGroupBy === 'dataRow') return ['test', 'dataRow'];
    if (groupBy === 'test') return ['test'];
    if (groupBy === 'group') return subGroupBy === 'test' ? ['group', 'test'] : ['group'];
    // Workflow grouping options
    if (groupBy === 'iteration') return subGroupBy === 'workflowStep' ? ['iteration', 'workflowStep'] : ['iteration'];
    if (groupBy === 'workflowStep') return subGroupBy === 'iteration' ? ['workflowStep', 'iteration'] : ['workflowStep'];
    // feature
    if (subGroupBy === 'group') return ['feature', 'group'];
    return ['feature', 'test'];
  }, [groupBy, subGroupBy]);

  const isFlat = groupBy === 'test' && subGroupBy !== 'dataRow';

  const groupTree = useMemo(() => {
    if (isFlat) return [];
    return buildGroups(filteredResults, groupLevels);
  }, [filteredResults, groupLevels, isFlat]);

  const groupCount = useMemo(() => {
    if (isFlat) return 0;
    return groupTree.reduce((n, g) => n + 1 + g.children.length, 0);
  }, [groupTree, isFlat]);

  useEffect(() => {
    if (groupTree.length > 0) {
      const allKeys: string[] = [];
      const collect = (nodes: GroupNode[], parentKey: string) => {
        for (const g of nodes) {
          const nodeKey = parentKey ? `${parentKey}/${g.key}` : g.key;
          allKeys.push(nodeKey);
          if (g.children.length > 0) collect(g.children, nodeKey);
        }
      };
      collect(groupTree, '');
      setExpanded(new Set(allKeys));
    }
  }, [groupTree]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isWorkflowRun = selectedRun?.config.executionMode === 'workflow' && hasWorkflowData(selectedRun.results);

  const subGroupOptions = useMemo((): { value: GroupByLevel; label: string }[] => {
    if (groupBy === 'feature') return [{ value: 'group', label: 'Then by Scenario' }, { value: 'test', label: 'Then by Test Name' }];
    if (groupBy === 'group') return [{ value: 'test', label: 'Then by Test Name' }];
    if (groupBy === 'test') {
      const hasDataRows = filteredResults.some(r => r.dataRowId);
      if (hasDataRows) return [{ value: 'dataRow', label: 'Then by Data Row' }];
    }
    if (groupBy === 'iteration') return [{ value: 'workflowStep', label: 'Then by Step' }];
    if (groupBy === 'workflowStep') return [{ value: 'iteration', label: 'Then by Iteration' }];
    return [];
  }, [groupBy, filteredResults]);

  const handleGroupByChange = (val: GroupByLevel) => {
    setGroupBy(val);
    setExpanded(new Set());
    if (val === 'feature') setSubGroupBy('group');
    else if (val === 'group') setSubGroupBy('test');
    else if (val === 'test') setSubGroupBy('test'); // reset; user can pick dataRow from sub-group
    else if (val === 'iteration') setSubGroupBy('workflowStep');
    else if (val === 'workflowStep') setSubGroupBy('iteration');
  };

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
      <td></td>
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

  const renderGroupRow = (g: GroupNode, depth: number, parentKey: string) => {
    const nodeKey = parentKey ? `${parentKey}/${g.key}` : g.key;
    const isOpen = expanded.has(nodeKey);
    const allPassed = g.failed === 0 && g.validationFailed === 0;
    const hasChildren = g.children.length > 0;
    const indent = depth * 20;

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
        {isOpen && !hasChildren && (
          <>
            {g.results.some(r => r.dataRowId) && (
              <tr><td colSpan={9} className="data-row-summary-cell">
                <DataRowSummaryTable results={g.results} scenarioName={g.key} onResultClick={setResponseModal} />
              </td></tr>
            )}
            {!g.results.some(r => r.dataRowId) && (
              <>
                <tr className="detail-header-row">
                  <th></th>
                  <th>Test Name</th>
                  <th colSpan={2}>URL</th>
                  <th>Status</th>
                  <th>Validation</th>
                  <th>Time (ms)</th>
                  <th>Passed</th>
                  <th>Error / Details</th>
                </tr>
                {g.results.map(renderDetailRow)}
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
          <button className="btn" onClick={refreshRuns}>Refresh</button>
        </div>
        <div className="empty-state">No test runs yet. Run a test first.</div>
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
                {selectedRun.config.executionMode === 'load-profile' && selectedRun.config.loadProfile ? (
                  <>
                    {selectedRun.config.loadProfile.type === 'ramp-up' ? 'Ramp-Up' : selectedRun.config.loadProfile.type === 'spike' ? 'Spike' : 'Sustained'}
                    {' · '}Peak:{selectedRun.config.loadProfile.maxConcurrency}
                    {' · '}{selectedRun.config.loadProfile.durationSec}s
                    {selectedRun.config.loadProfile.type === 'spike' && ` · Spike:${selectedRun.config.loadProfile.spikeConcurrency}`}
                  </>
                ) : (
                  <>
                    {selectedRun.config.executionMode === 'pool' ? 'Pool' : selectedRun.config.executionMode === 'sequential' ? 'Sequential' : selectedRun.config.executionMode === 'workflow' ? 'Workflow' : 'Batch'}
                    {' · '}C:{selectedRun.config.concurrency}{' · '}T:{selectedRun.config.totalTransactions}
                  </>
                )}
              </span>
              {thinkTimeLabel(selectedRun.config.thinkTime) && (
                <span className="context-tag think-time-tag">{thinkTimeLabel(selectedRun.config.thinkTime)}</span>
              )}
            </div>
          )}
          <div className="results-top-actions">
            <button className="btn" onClick={refreshRuns}>Refresh</button>
            {selectedRun && (
              <>
                {/* Results Explorer button (workflow runs only) */}
                {hasExecutionTrace(selectedRun) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowReplayModal(true)}
                    title="Explore execution results"
                  >
                    📊 Results Explorer
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

        <select className="results-run-select" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
          {runs.map((r) => {
            const bl = isBaseline(baselines, r.id);
            const isWf = r.config.executionMode === 'workflow';
            const label = [
              bl ? '★' : '',
              isWf ? '⚡' : '🧪',
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
              <option value="">Compare against baseline...</option>
              {runs.filter((r) => isBaseline(baselines, r.id) && r.id !== selectedRunId).map((r) => {
                const bl = baselines.find((b) => b.runId === r.id);
                const label = bl?.label ?? new Date(r.timestamp).toLocaleString();
                return <option key={r.id} value={r.id}>★ {label} — {r.summary.tps} TPS</option>;
              })}
            </select>

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
        <TrendChart runs={runs} baselines={baselines} />
      )}

      {/* Run Comparison */}
      {baselineRun && selectedRun && baselineRun.id !== selectedRun.id && (
        <RunComparisonPanel baselineRun={baselineRun} currentRun={selectedRun} />
      )}

      {/* Summary Metrics */}
      {summary && (
        <>
          <div className="metrics-row">
            <div className="metric-card accent throughput-card">
              <div className="throughput-grid">
                <div className="throughput-item">
                  <div className="metric-value">{summary.tps}</div>
                  <div className="metric-label">TPS</div>
                </div>
                <div className="throughput-item">
                  <div className="metric-value">{(summary.tps * 60).toFixed(1)}</div>
                  <div className="metric-label">TPM</div>
                </div>
                <div className="throughput-item">
                  <div className="metric-value">{(summary.tps * 3600).toFixed(0)}</div>
                  <div className="metric-label">TPH</div>
                </div>
                <div className="throughput-item">
                  <div className="metric-value">{(summary.tps * 86400).toFixed(0)}</div>
                  <div className="metric-label">TPD</div>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.avgResponseTime} ms</div>
              <div className="metric-label">
                Avg Response
                {summary.avgIterationTime !== undefined && (
                  <span className="metric-info" data-tooltip="Average HTTP request duration">ⓘ</span>
                )}
              </div>
            </div>
            {summary.avgIterationTime !== undefined && (
              <div className="metric-card highlight">
                <div className="metric-value">{summary.avgIterationTime} ms</div>
                <div className="metric-label">
                  Avg Iteration
                  <span className="metric-info" data-tooltip="Average workflow iteration duration (all nodes)">ⓘ</span>
                </div>
              </div>
            )}
            <div className="metric-card">
              <div className="metric-value">{summary.minResponseTime} ms</div>
              <div className="metric-label">Min</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.maxResponseTime} ms</div>
              <div className="metric-label">Max</div>
            </div>
          </div>
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-value">{summary.p50ResponseTime ?? '—'} ms</div>
              <div className="metric-label">P50</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.p95ResponseTime} ms</div>
              <div className="metric-label">P95</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.p99ResponseTime} ms</div>
              <div className="metric-label">P99</div>
            </div>
            <div className={`metric-card ${summary.errorRate > 0 ? 'error' : 'success'}`}>
              <div className="metric-value">{summary.errorRate}%</div>
              <div className="metric-label">Error Rate <span className="metric-info" data-tooltip="Percentage of requests that received a non-2xx HTTP status (e.g. 400, 404, 500). Includes intentional negative tests that expect error responses.">ⓘ</span></div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{(summary.totalDurationMs / 1000).toFixed(2)}s</div>
              <div className="metric-label">Total Duration</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.totalRequests}</div>
              <div className="metric-label">Total Requests</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.failedValidations}</div>
              <div className="metric-label">Validation Failures <span className="metric-info" data-tooltip="Requests whose actual response did not match expected assertions. 0 means every test got the response it expected — even negative tests that assert error codes.">ⓘ</span></div>
            </div>
          </div>
        </>
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

      {/* Request Details */}
      <div className="section">
        <h3>Request Details</h3>
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

      <ResponseDetailModal result={responseModal} onClose={() => setResponseModal(null)} />

      {/* Results Explorer Modal */}
      {showReplayModal && selectedRun && hasExecutionTrace(selectedRun) && (
        <WorkflowResultsExplorerModal
          trace={getExecutionTrace(selectedRun)!}
          onClose={() => setShowReplayModal(false)}
        />
      )}
    </div>
  );
}
