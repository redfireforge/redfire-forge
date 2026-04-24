import { useState, useEffect, useMemo, useCallback } from 'react';
import JsonPreview, { buildJTree, type JNode } from '../components/requests/JsonTreePreview';
import type { ExecutionResult } from '../types/server-api';
import { formatTimestamp, getErrorMessage } from '../utils/serverFormatters';
import '../styles/execution-history.css';

/* ---------- per-result JSON body with search + expand/collapse ---------- */
function ExhResultBody({ body }: { body: string }) {
  const [search, setSearch] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const tree = useMemo(() => {
    try { return buildJTree(JSON.parse(body), ''); } catch { return null; }
  }, [body]);

  const allPaths = useMemo(() => {
    if (!tree) return new Set<string>();
    const paths = new Set<string>();
    (function walk(node: JNode, p: string) {
      if (node.children?.length) { paths.add(p); node.children.forEach(c => walk(c, `${p}/${c.key}`)); }
    })(tree, '');
    return paths;
  }, [tree]);

  const handleToggle = useCallback((path: string) => {
    setCollapsed(prev => { const next = new Set(prev); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  }, []);

  if (!tree) return <pre className="exh-result-body">{body}</pre>;

  return (
    <div className="exh-result-body-rich">
      <div className="req-resp-search">
        <input
          className="req-resp-search-input"
          type="text"
          placeholder="Search response..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setMatchIdx(0); }}
        />
        {search && (
          <>
            <span className="req-resp-search-count">
              {matchCount > 0 ? `${matchIdx + 1}/${matchCount}` : 'No match'}
            </span>
            <button className="req-resp-search-nav" title="Previous" disabled={matchCount === 0}
              onClick={() => setMatchIdx(prev => prev > 0 ? prev - 1 : matchCount - 1)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" width="10" height="10"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
            </button>
            <button className="req-resp-search-nav" title="Next" disabled={matchCount === 0}
              onClick={() => setMatchIdx(prev => prev < matchCount - 1 ? prev + 1 : 0)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" width="10" height="10"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            <button className="req-resp-search-clear" onClick={() => { setSearch(''); setMatchIdx(0); setMatchCount(0); }}>×</button>
          </>
        )}
        <button className="jt-expand-collapse-btn" onClick={() => setCollapsed(new Set())}>Expand All</button>
        <button className="jt-expand-collapse-btn" onClick={() => setCollapsed(new Set(allPaths))}>Collapse All</button>
      </div>
      <JsonPreview
        body={body}
        search={search}
        currentMatchIdx={matchIdx}
        onMatchCountChange={setMatchCount}
        collapsedSet={collapsed}
        onToggle={handleToggle}
        prebuiltTree={tree}
      />
    </div>
  );
}

export default function WorkflowExecutionHistory() {
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'webhook' | 'schedule'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/executions?limit=100');
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      const list = data.executions || [];
      setExecutions(list);
      if (list.length > 0 && !selectedExecution) setSelectedExecution(list[0]);
      setError(null);
    } catch (err) {
      console.error('Failed to load executions:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const filteredExecutions = executions
    .filter(exec => filter === 'all' || exec.triggerType === filter)
    .sort((a, b) => {
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return sortOrder === 'desc' ? diff : -diff;
    });

  if (loading) {
    return <div className="exh-loading">Loading executions...</div>;
  }

  if (error) {
    return (
      <div className="exh-error-wrap">
        <div className="exh-error-card">
          <div className="exh-error-title">Error Loading Executions</div>
          <div className="exh-error-msg">{error}</div>
          <div className="exh-error-hint">
            Make sure the webhook server is running: <code>npm run server</code>
          </div>
          <button className="exh-btn exh-btn-primary" onClick={loadExecutions}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="exh-container">
      {/* Header */}
      <div className="exh-header">
        <div>
          <h1 className="exh-title">Workflow Execution History</h1>
          <p className="exh-subtitle">
            {filteredExecutions.length} execution{filteredExecutions.length !== 1 ? 's' : ''}
            {executions.length > 0 && filter !== 'all' && ` (${executions.length} total)`}
          </p>
        </div>
        <div className="exh-controls">
          <select
            className="exh-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'webhook' | 'schedule')}
          >
            <option value="all">All Types</option>
            <option value="webhook">Webhooks</option>
            <option value="schedule">Schedules</option>
          </select>
          <label className="exh-sort-label">
            Sort:
            <select
              className="exh-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </label>
          <button className="exh-btn exh-btn-primary" onClick={loadExecutions}>Refresh</button>
        </div>
      </div>

      {/* Empty state */}
      {filteredExecutions.length === 0 ? (
        <div className="exh-empty">
          <div className="exh-empty-icon">📊</div>
          <div className="exh-empty-title">No executions found</div>
          <div className="exh-empty-hint">Trigger a webhook or wait for a schedule to see executions here</div>
        </div>
      ) : (
        <div className={`exh-content ${selectedExecution ? 'exh-content-split' : ''}`}>
          {/* Execution list */}
          <div className="exh-list">
            {filteredExecutions.map((exec) => (
              <button
                key={exec.id}
                type="button"
                className={`exh-card ${selectedExecution?.id === exec.id ? 'exh-card-active' : ''}`}
                onClick={() => setSelectedExecution(exec)}
              >
                <div className="exh-card-header">
                  <span className="exh-trigger-icon">{exec.triggerType === 'webhook' ? '🪝' : '⏰'}</span>
                  <span className="exh-workflow-id">{exec.workflowId}</span>
                  <span className={`exh-badge exh-badge-${exec.status}`}>
                    {exec.status.toUpperCase()}
                  </span>
                </div>
                <div className="exh-card-meta">
                  <span className="exh-timestamp">{formatTimestamp(exec.timestamp)}</span>
                </div>
                <div className="exh-card-stats">
                  <span className="exh-stat exh-duration">{exec.duration}ms</span>
                  <span className="exh-stat">{exec.results.length} step{exec.results.length !== 1 ? 's' : ''}</span>
                  <span className="exh-stat">{Object.keys(exec.variables).length} var{Object.keys(exec.variables).length !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {selectedExecution && (
            <div className="exh-detail">
              <div className="exh-detail-header">
                <h2 className="exh-detail-title">Execution Details</h2>
                <button className="exh-btn exh-btn-ghost" onClick={() => setSelectedExecution(null)}>✕</button>
              </div>

              <div className="exh-detail-section">
                <h3 className="exh-section-title">Info</h3>
                <div className="exh-info-grid">
                  <span className="exh-info-label">ID</span>
                  <span className="exh-info-value exh-mono">{selectedExecution.id}</span>

                  <span className="exh-info-label">Workflow</span>
                  <span className="exh-info-value exh-mono">{selectedExecution.workflowId}</span>

                  <span className="exh-info-label">Trigger</span>
                  <span className="exh-info-value">
                    {selectedExecution.triggerType === 'webhook' ? '🪝 Webhook' : '⏰ Schedule'}
                  </span>

                  <span className="exh-info-label">Status</span>
                  <span className="exh-info-value">
                    <span className={`exh-badge exh-badge-${selectedExecution.status}`}>
                      {selectedExecution.status.toUpperCase()}
                    </span>
                  </span>

                  <span className="exh-info-label">Duration</span>
                  <span className="exh-info-value exh-duration">{selectedExecution.duration}ms</span>

                  <span className="exh-info-label">Time</span>
                  <span className="exh-info-value">{formatTimestamp(selectedExecution.timestamp)}</span>
                </div>
              </div>

              {Object.keys(selectedExecution.variables).length > 0 && (
                <div className="exh-detail-section">
                  <h3 className="exh-section-title">Variables</h3>
                  <pre className="exh-code-block">
                    {JSON.stringify(selectedExecution.variables, null, 2)}
                  </pre>
                </div>
              )}

              <div className="exh-detail-section">
                <h3 className="exh-section-title">Results ({selectedExecution.results.length})</h3>
                <div className="exh-results-list">
                  {selectedExecution.results.map((result, idx) => {
                    const isOk = result.statusCode >= 200 && result.statusCode < 300;
                    return (
                      <div key={idx} className={`exh-result-card ${isOk ? 'exh-result-ok' : 'exh-result-err'}`}>
                        <div className="exh-result-header">
                          <span className="exh-result-url">{result.url}</span>
                          <span className={`exh-result-code ${isOk ? 'ok' : 'err'}`}>{result.statusCode}</span>
                          <span className="exh-result-time">{result.responseTime.toFixed(2)}ms</span>
                        </div>
                        {result.body && (
                          <details className="exh-result-body-toggle">
                            <summary>Response Body</summary>
                            <ExhResultBody body={result.body} />
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedExecution.error && (
                <div className="exh-detail-section">
                  <h3 className="exh-section-title">Error</h3>
                  <div className="exh-error-block">
                    <code>{selectedExecution.error}</code>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
