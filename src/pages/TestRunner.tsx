import { useState, useMemo } from 'react';
import type { AuthConfig, FeatureGroup, Scenario, TestConfig, ScenarioWeight } from '../types';
import { useTestExecution } from '../hooks/useTestExecution';

interface Props {
  featureGroups: FeatureGroup[];
  onComplete: () => void;
}

export default function TestRunner({ featureGroups, onComplete }: Props) {
  const [concurrency, setConcurrency] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(1);

  // Track selected scenarios by id
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Record<string, number>>({});
  // Track expanded feature groups
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(() => new Set(featureGroups.map(fg => fg.id)));

  const { isRunning, completed, total, liveSummary, error, execute, abort, finalRun } = useTestExecution();

  // Collect all tests from selected scenarios, resolving auth priority:
  // 1. Test-level auth (highest) — only if test has a complete auth config
  // 2. Scenario-level auth (middle) — if scenario has auth configured
  // 3. Header-level auth (lowest) — manual Authorization header, handled by executor
  const selectedTests: Scenario[] = useMemo(() => {
    const isAuthComplete = (auth: AuthConfig): boolean => {
      switch (auth.type) {
        case 'none': return false;
        case 'basic': return !!auth.username;
        case 'oauth2': return !!auth.tokenUrl && !!auth.clientId && !!auth.clientSecret;
        default: return false;
      }
    };

    const tests: Scenario[] = [];
    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        if (selectedScenarios.has(sc.id)) {
          for (const test of sc.tests) {
            if (isAuthComplete(test.auth) || !sc.auth || !isAuthComplete(sc.auth)) {
              tests.push(test);
            } else {
              tests.push({ ...test, auth: sc.auth });
            }
          }
        }
      }
    }
    return tests;
  }, [featureGroups, selectedScenarios]);

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
    const config: TestConfig = { concurrency, totalTransactions: effectiveTransactions, scenarioWeights };
    execute(config, selectedTests);
  };

  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasAnyTests = featureGroups.some((fg) => fg.scenarios.some((sc) => sc.tests.length > 0));

  return (
    <div className="page">
      <div className="page-header">
        <h2>Test Runner</h2>
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
              <div className="form-row two-col">
                <div>
                  <label>Concurrency (parallel requests)</label>
                  <input type="number" min={1} max={100} value={concurrency} onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning} />
                </div>
                <div>
                  <label>Total Transactions</label>
                  <input type="number" min={1} max={100000} value={totalTransactions} onChange={(e) => setTotalTransactions(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning} />
                  {effectiveTransactions > totalTransactions && (
                    <span className="field-hint">Min {activeTestCount} to cover all tests (each runs at least once)</span>
                  )}
                </div>
              </div>

              <fieldset>
                <legend>Test Distribution (weights)</legend>
                {selectedTests.map((t) => (
                  <div key={t.id} className="form-row two-col">
                    <div className="weight-label">
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
                      style={{ width: 80 }}
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
