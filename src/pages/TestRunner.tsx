import { useState, useMemo, useEffect } from 'react';
import type { AuthConfig, ExecutionMode, FeatureGroup, Scenario, TestConfig, ScenarioWeight } from '../types';
import { useTestExecution } from '../hooks/useTestExecution';

const STORAGE_KEY = 'perf-test-runner-config';

type HostMode = 'hardcoded' | 'settings' | 'custom';

function loadRunnerConfig(): { concurrency: number; totalTransactions: number; selectedScenarios: string[]; weights: Record<string, number>; skipValidation: boolean; hostMode: HostMode; customBaseUrl: string; executionMode: ExecutionMode } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { concurrency: 1, totalTransactions: 1, selectedScenarios: [], weights: {}, skipValidation: false, hostMode: 'settings', customBaseUrl: '', executionMode: 'batch' };
}

interface Props {
  featureGroups: FeatureGroup[];
  onComplete: () => void;
  envName?: string;
  svcName?: string;
  resolvedBaseUrl?: string;
}

function replaceHost(testUrl: string, baseUrl: string): string {
  if (!baseUrl) return testUrl;
  try {
    const original = new URL(testUrl);
    const base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    original.protocol = base.protocol;
    original.host = base.host;
    const basePath = base.pathname.replace(/\/+$/, '');
    if (basePath && !original.pathname.startsWith(basePath)) {
      original.pathname = basePath + original.pathname;
    }
    return original.toString();
  } catch {
    return testUrl;
  }
}

export default function TestRunner({ featureGroups, onComplete, envName, svcName, resolvedBaseUrl }: Props) {
  const saved = useMemo(() => loadRunnerConfig(), []);
  const [concurrency, setConcurrency] = useState(saved.concurrency);
  const [totalTransactions, setTotalTransactions] = useState(saved.totalTransactions);

  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(() => new Set(saved.selectedScenarios));
  const [weights, setWeights] = useState<Record<string, number>>(saved.weights);
  const [skipValidation, setSkipValidation] = useState(saved.skipValidation);
  const [hostMode, setHostMode] = useState<HostMode>(saved.hostMode || 'settings');
  const [customBaseUrl, setCustomBaseUrl] = useState(saved.customBaseUrl || '');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(saved.executionMode || 'batch');
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(() => new Set(featureGroups.map(fg => fg.id)));

  const { isRunning, completed, total, liveSummary, error, execute, abort, finalRun } = useTestExecution();

  // Persist config to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      concurrency,
      totalTransactions,
      selectedScenarios: Array.from(selectedScenarios),
      weights,
      skipValidation,
      hostMode,
      customBaseUrl,
      executionMode,
    }));
  }, [concurrency, totalTransactions, selectedScenarios, weights, skipValidation, hostMode, customBaseUrl, executionMode]);

  // Collect all tests from selected scenarios, resolving auth:
  // 'inherit' = use scenario-level auth
  // 'none' = no auth
  // 'basic'/'oauth2' = test-level auth (highest priority)
  const selectedTests: Scenario[] = useMemo(() => {
    const tests: Scenario[] = [];
    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        if (selectedScenarios.has(sc.id)) {
          for (const test of sc.tests) {
            const effectiveBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || '') : hostMode === 'custom' ? customBaseUrl.trim() : '';
            const url = effectiveBaseUrl ? replaceHost(test.url, effectiveBaseUrl) : test.url;
            const validation = skipValidation ? { mode: 'none' as const } : test.validation;
            if (test.auth.type === 'inherit') {
              const scenarioAuth = sc.auth && sc.auth.type !== 'none' ? sc.auth : { type: 'none' as const };
              tests.push({ ...test, url, auth: scenarioAuth, validation });
            } else {
              tests.push({ ...test, url, validation });
            }
          }
        }
      }
    }
    return tests;
  }, [featureGroups, selectedScenarios, resolvedBaseUrl, skipValidation, hostMode, customBaseUrl]);

  // Sync weights when selection changes
  useMemo(() => {
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
      next.has(featureId) ? next.delete(featureId) : next.add(featureId);
      return next;
    });
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      next.has(scenarioId) ? next.delete(scenarioId) : next.add(scenarioId);
      return next;
    });
  };

  const toggleAllInFeature = (fg: FeatureGroup) => {
    const allSelected = fg.scenarios.every((sc) => selectedScenarios.has(sc.id));
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      fg.scenarios.forEach((sc) => {
        if (allSelected) next.delete(sc.id); else next.add(sc.id);
      });
      return next;
    });
  };

  const selectAll = () => {
    const allIds = featureGroups.flatMap((fg) => fg.scenarios.map((sc) => sc.id));
    setSelectedScenarios(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedScenarios(new Set());
  };

  const activeTestCount = selectedTests.filter((t) => (weights[t.id] ?? 1) > 0).length;
  const effectiveTransactions = Math.max(totalTransactions, activeTestCount);

  const handleRun = () => {
    const scenarioWeights: ScenarioWeight[] = selectedTests.map((t) => ({
      scenarioId: t.id,
      weight: weights[t.id] ?? 1,
    }));
    const config: TestConfig = { concurrency, totalTransactions: effectiveTransactions, scenarioWeights, executionMode };
    const usedBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || undefined) : hostMode === 'custom' ? (customBaseUrl.trim() || undefined) : undefined;
    execute(config, selectedTests, { envName, svcName, baseUrl: usedBaseUrl });
  };

  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasAnyTests = featureGroups.some((fg) => fg.scenarios.some((sc) => sc.tests.length > 0));

  return (
    <div className="page">
      <div className="page-header">
        <h2>Test Runner</h2>
        {(envName || svcName) && (
          <div className="context-tags">
            {envName && <span className="tag tag-info">Env: {envName}</span>}
            {svcName && <span className="tag tag-info">Svc: {svcName}</span>}
          </div>
        )}
      </div>
      <div className="runner-host-selector">
        <span className="runner-host-label">Host:</span>
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
        {hostMode === 'custom' && (
          <input
            className="runner-custom-url-input"
            type="text"
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            placeholder="https://my-host.example.com:8080"
            disabled={isRunning}
          />
        )}
      </div>

      <div className="runner-option-boxes">
        <div className="runner-option-box">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={skipValidation}
              onChange={(e) => setSkipValidation(e.target.checked)}
              disabled={isRunning}
            />
            Skip validation
          </label>
        </div>

        <div className="runner-option-box" style={{ flex: 1 }}>
          <span className="runner-exec-label">Execution Mode:</span>
          <label className="radio-label" title="Fires N requests, waits for ALL to finish, then fires the next N. Idle slots wait for the slowest request in the batch.">
            <input type="radio" name="execMode" checked={executionMode === 'batch'} onChange={() => setExecutionMode('batch')} disabled={isRunning} />
            Batch
          </label>
          <label className="radio-label" title="Maintains N concurrent requests at all times. When any single request completes, a new one starts immediately — no idle slots.">
            <input type="radio" name="execMode" checked={executionMode === 'pool'} onChange={() => setExecutionMode('pool')} disabled={isRunning} />
            Continuous Pool
          </label>
          <span className="exec-mode-hint">
            {executionMode === 'batch'
              ? 'Fires N requests, waits for all to complete, then fires next N'
              : 'Keeps N requests in-flight at all times — a new request starts as soon as one finishes'}
          </span>
        </div>
      </div>

      {!hasAnyTests ? (
        <div className="empty-state">No tests defined. Go to Feature Groups tab to add some first.</div>
      ) : (
        <>
          {/* Scenario selection */}
          <div className="config-form">
            <div className="selection-header">
              <h3>Select Scenarios to Test</h3>
              <div className="selection-actions">
                <button className="btn btn-sm" onClick={selectAll} disabled={isRunning}>Select All</button>
                <button className="btn btn-sm" onClick={deselectAll} disabled={isRunning}>Deselect All</button>
                <span className="filter-count">
                  {selectedScenarios.size} scenario{selectedScenarios.size !== 1 ? 's' : ''} selected
                  ({selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            <div className="selection-tree">
              {featureGroups.map((fg) => {
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
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Config */}
          {selectedTests.length > 0 && (
            <div className="config-form" style={{ marginTop: 16 }}>
              <div className="form-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label>Concurrency (parallel requests)</label>
                  <input type="number" min={1} max={100} value={concurrency} onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Total Transactions</label>
                  <input type="number" min={1} max={100000} value={totalTransactions} onChange={(e) => setTotalTransactions(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning} />
                  {effectiveTransactions > totalTransactions && (
                    <span className="field-hint">Min {activeTestCount} to cover all tests (each runs at least once)</span>
                  )}
                </div>
              </div>

              <fieldset>
                <legend>Test Distribution (weights)</legend>
                {selectedTests.map((t, idx) => (
                  <div key={t.id} className="weight-row">
                    <div className="weight-label">
                      <span className="test-number">{idx + 1}</span>
                      <span className={`method-badge method-${t.method.toLowerCase()}`}>{t.method}</span>
                      {t.name}
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
              </fieldset>

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

          {/* Live Progress */}
          {(isRunning || liveSummary) && (
            <div className="progress-section">
              <h3>Progress</h3>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${progressPct}%` }}></div>
                <span className="progress-text">{completed} / {total} ({progressPct}%)</span>
              </div>

              {liveSummary && (
                <div className="live-metrics">
                  <div className="metric-card">
                    <div className="metric-value">{liveSummary.tps}</div>
                    <div className="metric-label">TPS</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{liveSummary.avgResponseTime} ms</div>
                    <div className="metric-label">Avg Response</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{liveSummary.errorRate}%</div>
                    <div className="metric-label">Error Rate</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{liveSummary.failedValidations}</div>
                    <div className="metric-label">Validation Failures</div>
                  </div>
                </div>
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

          {error && <div className="error-banner">{error}</div>}
        </>
      )}
    </div>
  );
}
