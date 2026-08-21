import { useState, useEffect, useMemo, useCallback } from 'react';
import JsonPreview, { buildJTree, type JNode } from '../requests/components/JsonTreePreview';
import type { ExecutionResult } from '../../shared/types/server-api';
import { formatTimestamp } from '../test-runner/utils/serverFormatters';
import { toErrorMessage } from '../../shared/utils/helpers';
import { CustomSelect } from '../../shared/components/CustomSelect';
import '../../styles/execution-history.css';

// ── Paused correlation type (from /api/correlations) ──

interface PausedCorrelation {
  correlationId: string;
  webhookPath: string;
  executionId: string;
  workflowId: string;
  pausedNodeId: string;
  pausedAt: number;
  timeoutAt: number;
  correlationSource: 'body' | 'header' | 'query';
}

/* ---------- per-result JSON body with search + expand/collapse ---------- */
function ExhResultBody({ body }: { body: string }) {
  const [search, setSearch] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // Sticky Expand all — overrides search-focus auto-collapse (see JsonPreview.forceExpandAll).
  const [expandAllActive, setExpandAllActive] = useState(false);

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
        <button className="jt-expand-collapse-btn" onClick={() => { setExpandAllActive(true); setCollapsed(new Set()); }}>Expand All</button>
        <button className="jt-expand-collapse-btn" onClick={() => { setExpandAllActive(false); setCollapsed(new Set(allPaths)); }}>Collapse All</button>
      </div>
      <JsonPreview
        body={body}
        search={search}
        currentMatchIdx={matchIdx}
        onMatchCountChange={setMatchCount}
        collapsedSet={collapsed}
        onToggle={handleToggle}
        prebuiltTree={tree}
        forceExpandAll={expandAllActive}
      />
    </div>
  );
}

export default function WorkflowExecutionHistory() {
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'webhook' | 'schedule' | 'paused'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // ── Paused correlations ──
  const [pausedCorrelations, setPausedCorrelations] = useState<PausedCorrelation[]>([]);
  const [pausedLoading, setPausedLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [resumeResult, setResumeResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);
  // Live timer tick for paused durations
  const [, setTick] = useState(0);

  useEffect(() => {
    loadExecutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh paused correlations when filter changes to 'paused'
  useEffect(() => {
    if (filter === 'paused') loadPausedCorrelations();
  }, [filter]);  

  // Live timer for paused durations (update every second when viewing paused tab)
  useEffect(() => {
    if (filter !== 'paused' || pausedCorrelations.length === 0) return;
    const iv = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(iv);
  }, [filter, pausedCorrelations.length]);

  const loadPausedCorrelations = async () => {
    try {
      setPausedLoading(true);
      const response = await fetch('/api/correlations');
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      setPausedCorrelations(data.correlations || []);
    } catch (err) {
      console.error('Failed to load paused correlations:', err);
    } finally {
      setPausedLoading(false);
    }
  };

  const handleManualResume = async (correlationId: string) => {
    setResumingId(correlationId);
    setResumeResult(null);
    try {
      const response = await fetch('/api/correlations/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationId,
          webhookData: { _manualResume: true, resumedAt: new Date().toISOString() },
        }),
      });
      const data = await response.json();
      if (data.resumed) {
        setResumeResult({ id: correlationId, ok: true, message: 'Workflow resumed successfully' });
        // Refresh paused list
        await loadPausedCorrelations();
      } else {
        setResumeResult({ id: correlationId, ok: false, message: 'No matching paused workflow found' });
      }
    } catch (err) {
      setResumeResult({ id: correlationId, ok: false, message: toErrorMessage(err) });
    } finally {
      setResumingId(null);
    }
  };

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
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const filteredExecutions = executions
    .filter(exec => filter === 'all' || filter === 'paused' || exec.triggerType === filter)
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
            {filteredExecutions.length > 1 && (
              <button
                type="button"
                className="sort-toggle-badge"
                onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                title={sortOrder === 'desc' ? 'Newest first — click to reverse' : 'Oldest first — click to reverse'}
              >
                {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
              </button>
            )}
          </p>
        </div>
        <div className="exh-controls">
          <CustomSelect
            className="exh-select"
            value={filter}
            onChange={(v) => setFilter(v as 'all' | 'webhook' | 'schedule' | 'paused')}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'webhook', label: 'Webhooks' },
              { value: 'schedule', label: 'Schedules' },
              { value: 'paused', label: `⏸ Paused (${pausedCorrelations.length})` },
            ]}
          />
          <button className="exh-btn exh-btn-primary" onClick={loadExecutions}>Refresh</button>
        </div>
      </div>

      {/* Paused correlations view */}
      {filter === 'paused' ? (
        <div className="exh-paused-section" data-testid="exh-paused-section">
          {pausedLoading ? (
            <div className="exh-loading">Loading paused workflows...</div>
          ) : pausedCorrelations.length === 0 ? (
            <div className="exh-empty">
              <div className="exh-empty-icon">⏸</div>
              <div className="exh-empty-title">No paused workflows</div>
              <div className="exh-empty-hint">Workflows paused by Correlation Wait nodes will appear here</div>
            </div>
          ) : (
            <div className="exh-paused-list">
              {pausedCorrelations.map((pc) => {
                const elapsed = Date.now() - pc.pausedAt;
                const elapsedStr = elapsed < 60000
                  ? `${Math.floor(elapsed / 1000)}s ago`
                  : elapsed < 3600000
                    ? `${Math.floor(elapsed / 60000)}m ago`
                    : `${Math.floor(elapsed / 3600000)}h ago`;
                const remaining = pc.timeoutAt > 0
                  ? Math.max(0, pc.timeoutAt - Date.now())
                  : -1;
                const remainingStr = remaining < 0
                  ? 'No timeout'
                  : remaining === 0
                    ? 'Expired'
                    : remaining < 60000
                      ? `${Math.ceil(remaining / 1000)}s`
                      : `${Math.ceil(remaining / 60000)}m`;

                return (
                  <div
                    key={pc.correlationId}
                    className={`exh-paused-card ${remaining === 0 ? 'exh-paused-expired' : ''}`}
                    data-testid="exh-paused-card"
                  >
                    <div className="exh-paused-header">
                      <span className="exh-badge exh-badge-paused">⏸ PAUSED</span>
                      <span className="exh-paused-elapsed">{elapsedStr}</span>
                    </div>
                    <div className="exh-paused-details">
                      <div className="exh-paused-row">
                        <span className="exh-paused-label">Correlation ID</span>
                        <span className="exh-paused-value exh-mono">{pc.correlationId}</span>
                      </div>
                      <div className="exh-paused-row">
                        <span className="exh-paused-label">Webhook Path</span>
                        <span className="exh-paused-value exh-mono">{pc.webhookPath}</span>
                      </div>
                      <div className="exh-paused-row">
                        <span className="exh-paused-label">Workflow</span>
                        <span className="exh-paused-value exh-mono">{pc.workflowId}</span>
                      </div>
                      <div className="exh-paused-row">
                        <span className="exh-paused-label">Execution</span>
                        <span className="exh-paused-value exh-mono">{pc.executionId}</span>
                      </div>
                      <div className="exh-paused-row">
                        <span className="exh-paused-label">Time Until Timeout</span>
                        <span className={`exh-paused-value ${remaining === 0 ? 'exh-paused-expired-text' : remaining > 0 && remaining < 30000 ? 'exh-paused-warning-text' : ''}`}>
                          {remainingStr}
                        </span>
                      </div>
                    </div>
                    <div className="exh-paused-actions">
                      <button
                        className="exh-btn exh-btn-primary exh-btn-sm"
                        disabled={resumingId === pc.correlationId}
                        onClick={() => handleManualResume(pc.correlationId)}
                        data-testid="exh-resume-btn"
                      >
                        {resumingId === pc.correlationId ? 'Resuming...' : '▶ Resume Manually'}
                      </button>
                      {resumeResult?.id === pc.correlationId && (
                        <span className={`exh-paused-result ${resumeResult.ok ? 'exh-paused-result-ok' : 'exh-paused-result-err'}`}>
                          {resumeResult.message}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : /* Normal execution history */ filteredExecutions.length === 0 ? (
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
