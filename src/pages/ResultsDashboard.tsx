import { useState, useMemo, useEffect, Fragment } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { TestRun, RequestResult } from '../types';
import ResponseDetailModal from '../components/ResponseDetailModal';
import { loadTestRuns, deleteTestRun } from '../utils/storage';
import { exportJson, exportCsv } from '../utils/export';
import { buildGroups, type GroupByLevel, type GroupNode } from '../utils/resultsGrouping';

interface Props {
  envName?: string;
  svcName?: string;
  projectName?: string;
}

export default function ResultsDashboard({ envName, svcName, projectName }: Props) {
  const [allRuns, setAllRuns] = useState<TestRun[]>([]);

  useEffect(() => {
    loadTestRuns().then(setAllRuns);
  }, []);

  const runs = useMemo(() => {
    return allRuns.filter((r) => {
      if (envName && r.envName !== envName) return false;
      if (svcName && r.svcName !== svcName) return false;
      return true;
    });
  }, [allRuns, envName, svcName]);

  const [selectedRunId, setSelectedRunId] = useState<string>(runs[0]?.id ?? '');
  const [filterScenario] = useState<string>('all');
  const [filterPassed, setFilterPassed] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupByLevel>('feature');
  const [subGroupBy, setSubGroupBy] = useState<GroupByLevel>('group');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

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
  };

  const histogramData = useMemo(() => {
    if (!selectedRun) return [];
    const times = selectedRun.results.map((r) => r.responseTimeMs).sort((a, b) => a - b);
    if (times.length === 0) return [];
    const min = times[0];
    const max = times[times.length - 1];
    const bucketSize = Math.max((max - min) / 10, 1);
    const buckets: { range: string; count: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const lo = min + i * bucketSize;
      const hi = lo + bucketSize;
      const count = times.filter((t) => t >= lo && (i === 9 ? t <= hi : t < hi)).length;
      buckets.push({ range: `${Math.round(lo)}-${Math.round(hi)}ms`, count });
    }
    return buckets;
  }, [selectedRun]);

  const filteredResults: RequestResult[] = useMemo(() => {
    if (!selectedRun) return [];
    const q = searchTerm.toLowerCase().trim();
    return selectedRun.results.filter((r) => {
      if (filterScenario !== 'all' && r.scenarioId !== filterScenario) return false;
      if (filterPassed === 'passed' && !r.passed) return false;
      if (filterPassed === 'failed' && r.passed) return false;
      if (q && !(
        r.scenarioName.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        (r.featureGroupName?.toLowerCase().includes(q)) ||
        (r.groupName?.toLowerCase().includes(q)) ||
        (r.errorMessage?.toLowerCase().includes(q))
      )) return false;
      return true;
    });
  }, [selectedRun, filterScenario, filterPassed, searchTerm]);


  const groupLevels: GroupByLevel[] = useMemo(() => {
    if (groupBy === 'test') return ['test'];
    if (groupBy === 'group') return subGroupBy === 'test' ? ['group', 'test'] : ['group'];
    // feature
    if (subGroupBy === 'group') return ['feature', 'group'];
    return ['feature', 'test'];
  }, [groupBy, subGroupBy]);

  const isFlat = groupBy === 'test';

  const groupTree = useMemo(() => {
    if (isFlat) return [];
    return buildGroups(filteredResults, groupLevels);
  }, [filteredResults, groupLevels, isFlat]);

  const groupCount = useMemo(() => {
    if (isFlat) return 0;
    return groupTree.reduce((n, g) => n + 1 + g.children.length, 0);
  }, [groupTree, isFlat]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const subGroupOptions = useMemo((): { value: GroupByLevel; label: string }[] => {
    if (groupBy === 'feature') return [{ value: 'group', label: 'Then by Scenario' }, { value: 'test', label: 'Then by Test Name' }];
    if (groupBy === 'group') return [{ value: 'test', label: 'Then by Test Name' }];
    return [];
  }, [groupBy]);

  const handleGroupByChange = (val: GroupByLevel) => {
    setGroupBy(val);
    setExpanded(new Set());
    if (val === 'feature') setSubGroupBy('group');
    else if (val === 'group') setSubGroupBy('test');
  };

  const [responseModal, setResponseModal] = useState<RequestResult | null>(null);

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
    <tr key={r.id} className={`group-detail-row ${r.passed ? '' : 'row-failed'}`}>
      <td></td>
      <td className="group-detail-name">
        <span className={`method-badge method-${r.method.toLowerCase()}`}>{r.method}</span>
        {' '}{r.scenarioName}
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
              {projectName && <span className="context-tag project-tag">{projectName}</span>}
              {selectedRun.svcName && <span className="context-tag svc-tag">{selectedRun.svcName}</span>}
              {selectedRun.envName && <span className="context-tag env-tag">{selectedRun.envName}</span>}
              {selectedRun.baseUrl
                ? <span className="context-tag base-url-tag" title={selectedRun.baseUrl}>Host: {selectedRun.baseUrl}</span>
                : <span className="context-tag base-url-tag hardcoded">Host: hardcoded</span>
              }
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
                    {selectedRun.config.executionMode === 'pool' ? 'Pool' : selectedRun.config.executionMode === 'sequential' ? 'Sequential' : 'Batch'}
                    {' · '}C:{selectedRun.config.concurrency}{' · '}T:{selectedRun.config.totalTransactions}
                  </>
                )}
              </span>
            </div>
          )}
          <div className="results-top-actions">
            <button className="btn" onClick={refreshRuns}>Refresh</button>
            {selectedRun && (
              <>
                <button className="btn" onClick={() => exportJson(selectedRun)}>Export JSON</button>
                <button className="btn" onClick={() => exportCsv(selectedRun.results, selectedRun.envName, selectedRun.svcName)}>Export CSV</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selectedRun.id)}>Delete</button>
              </>
            )}
          </div>
        </div>
        <select className="results-run-select" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
          {runs.map((r) => {
            const label = [
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
      </div>

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
              <div className="metric-label">Avg Response</div>
            </div>
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
              <div className="metric-value">{summary.p95ResponseTime} ms</div>
              <div className="metric-label">P95</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.p99ResponseTime} ms</div>
              <div className="metric-label">P99</div>
            </div>
            <div className={`metric-card ${summary.errorRate > 0 ? 'error' : 'success'}`}>
              <div className="metric-value">{summary.errorRate}%</div>
              <div className="metric-label">Error Rate</div>
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
              <div className="metric-label">Validation Failures</div>
            </div>
          </div>
        </>
      )}

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

      {/* Response Time Distribution Chart */}
      {histogramData.length > 0 && (
        <div className="section">
          <h3>Response Time Distribution</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={histogramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" fontSize={11} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogramData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index < 7 ? '#3b82f6' : index < 9 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Request Details */}
      <div className="section">
        <h3>Request Details</h3>
        <div className="filter-row">
          <select value={filterPassed} onChange={(e) => { setFilterPassed(e.target.value); setPage(0); }}>
            <option value="all">All Results</option>
            <option value="passed">Passed Only</option>
            <option value="failed">Failed Only</option>
          </select>

          <div className="group-by-controls">
            <label className="group-by-label">Group by</label>
            <select value={groupBy} onChange={(e) => handleGroupByChange(e.target.value as GroupByLevel)}>
              <option value="feature">Feature</option>
              <option value="group">Scenario</option>
              <option value="test">Test Name (flat)</option>
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
                  <tr key={r.id} className={r.passed ? '' : 'row-failed'}>
                    <td>{r.scenarioName}</td>
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
    </div>
  );
}
