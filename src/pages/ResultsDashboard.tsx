import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { TestRun, RequestResult } from '../types';
import { loadTestRuns, deleteTestRun } from '../utils/storage';
import { exportJson, exportCsv } from '../utils/export';

export default function ResultsDashboard() {
  const [runs, setRuns] = useState<TestRun[]>(() => loadTestRuns());
  const [selectedRunId, setSelectedRunId] = useState<string>(runs[0]?.id ?? '');
  const [filterScenario, setFilterScenario] = useState<string>('all');
  const [filterPassed, setFilterPassed] = useState<string>('all');

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;
  const summary = selectedRun?.summary ?? null;

  const handleDelete = (runId: string) => {
    deleteTestRun(runId);
    const updated = runs.filter((r) => r.id !== runId);
    setRuns(updated);
    if (selectedRunId === runId) {
      setSelectedRunId(updated[0]?.id ?? '');
    }
  };

  const refreshRuns = () => {
    const fresh = loadTestRuns();
    setRuns(fresh);
    if (fresh.length > 0 && !fresh.find((r) => r.id === selectedRunId)) {
      setSelectedRunId(fresh[0].id);
    }
  };

  // Distribution chart data — bucket response times into 10 bins
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

  // Filtered failure records
  const filteredResults: RequestResult[] = useMemo(() => {
    if (!selectedRun) return [];
    return selectedRun.results.filter((r) => {
      if (filterScenario !== 'all' && r.scenarioId !== filterScenario) return false;
      if (filterPassed === 'passed' && !r.passed) return false;
      if (filterPassed === 'failed' && r.passed) return false;
      return true;
    });
  }, [selectedRun, filterScenario, filterPassed]);

  const scenarioNames = useMemo(() => {
    if (!selectedRun) return [];
    const map = new Map<string, string>();
    selectedRun.results.forEach((r) => map.set(r.scenarioId, r.scenarioName));
    return Array.from(map.entries());
  }, [selectedRun]);

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
      <div className="page-header">
        <h2>Results</h2>
        <div className="header-actions">
          <select value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.timestamp).toLocaleString()} — {r.summary.totalRequests} req, {r.summary.tps} TPS
              </option>
            ))}
          </select>
          <button className="btn" onClick={refreshRuns}>Refresh</button>
          {selectedRun && (
            <>
              <button className="btn" onClick={() => exportJson(selectedRun)}>Export JSON</button>
              <button className="btn" onClick={() => exportCsv(selectedRun.results)}>Export CSV</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selectedRun.id)}>Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      {summary && (
        <div className="metrics-grid">
          <div className="metric-card accent">
            <div className="metric-value">{summary.tps}</div>
            <div className="metric-label">TPS</div>
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

      {/* Request Details Table */}
      <div className="section">
        <h3>Request Details</h3>
        <div className="filter-row">
          <select value={filterScenario} onChange={(e) => setFilterScenario(e.target.value)}>
            <option value="all">All Scenarios</option>
            {scenarioNames.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select value={filterPassed} onChange={(e) => setFilterPassed(e.target.value)}>
            <option value="all">All Results</option>
            <option value="passed">Passed Only</option>
            <option value="failed">Failed Only</option>
          </select>
          <span className="filter-count">{filteredResults.length} results</span>
        </div>
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
              {filteredResults.slice(0, 500).map((r) => (
                <tr key={r.id} className={r.passed ? '' : 'row-failed'}>
                  <td>{r.scenarioName}</td>
                  <td><span className={`method-badge method-${r.method.toLowerCase()}`}>{r.method}</span></td>
                  <td className="url-cell">{r.url}</td>
                  <td>{r.httpStatus || 'ERR'}</td>
                  <td>{r.responseTimeMs}</td>
                  <td><span className={`tag ${r.validationMode === 'none' ? 'tag-dim' : 'tag-info'}`}>{r.validationMode ?? 'none'}</span></td>
                  <td>{r.passed ? '✓' : '✗'}</td>
                  <td className="failure-cell">
                    {r.errorMessage && <div className="error-msg">{r.errorMessage}</div>}
                    {r.failureDetails.map((f, i) => (
                      <div key={i} className="failure-detail">
                        <strong>{f.path}</strong>: expected {f.expected}, got {f.actual}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredResults.length > 500 && (
            <div className="table-truncated">Showing first 500 of {filteredResults.length} results. Export for full data.</div>
          )}
        </div>
      </div>
    </div>
  );
}
