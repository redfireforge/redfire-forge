import { useState, useMemo } from 'react';
import type { RequestResult, TestRun } from '../../../shared/types';
import {
  hasWorkflowData,
  computeWorkflowStepSummaries,
  computeWorkflowIterationSummaries,
  getIterationCount,
  type WorkflowStepSummary,
  type WorkflowIterationSummary,
} from '../../test-runner/utils/resultsGrouping';

interface Props {
  run: TestRun;
  onResultClick?: (result: RequestResult) => void;
}

export function WorkflowResultsSummary({ run, onResultClick }: Props) {
  const [iterationsExpanded, setIterationsExpanded] = useState(false);
  const [expandedIterations, setExpandedIterations] = useState<Set<number>>(new Set());

  const isWorkflowRun = run.config.executionMode === 'workflow' && hasWorkflowData(run.results);
  
  const stepSummaries = useMemo<WorkflowStepSummary[]>(() => {
    if (!isWorkflowRun) return [];
    return computeWorkflowStepSummaries(run.results);
  }, [run.results, isWorkflowRun]);

  const iterationSummaries = useMemo<WorkflowIterationSummary[]>(() => {
    if (!isWorkflowRun) return [];
    return computeWorkflowIterationSummaries(run.results);
  }, [run.results, isWorkflowRun]);

  const iterationCount = useMemo(() => getIterationCount(run.results), [run.results]);

  const toggleIteration = (idx: number) => {
    setExpandedIterations(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (!isWorkflowRun) return null;

  const overallPassRate = run.summary.totalRequests > 0 
    ? Math.round((run.summary.successfulRequests / run.summary.totalRequests) * 100) 
    : 0;

  return (
    <div className="workflow-results-summary">
      <div className="workflow-summary-header">
        <div className="workflow-summary-title">
          <span className="workflow-icon">⚡</span>
          <span>Workflow Execution Summary</span>
        </div>
        <div className="workflow-summary-meta">
          <span className="workflow-meta-item">
            <strong>{iterationCount}</strong> iteration{iterationCount !== 1 ? 's' : ''}
          </span>
          <span className="workflow-meta-item">
            <strong>{stepSummaries.length}</strong> step{stepSummaries.length !== 1 ? 's' : ''}
          </span>
          <span className="workflow-meta-item">
            <strong>{run.results.length}</strong> total request{run.results.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="workflow-summary-overall">
        <div className={`workflow-pass-rate ${overallPassRate === 100 ? 'pass-rate-success' : overallPassRate >= 90 ? 'pass-rate-warning' : 'pass-rate-danger'}`}>
          <span className="pass-rate-value">{overallPassRate}%</span>
          <span className="pass-rate-label">Pass Rate</span>
        </div>
        <div className="workflow-metric">
          <span className="metric-value">{run.summary.avgResponseTime}ms</span>
          <span className="metric-label">Avg</span>
        </div>
        <div className="workflow-metric">
          <span className="metric-value">{run.summary.p95ResponseTime}ms</span>
          <span className="metric-label">p95</span>
        </div>
        <div className="workflow-metric">
          <span className="metric-value">{run.summary.tps}</span>
          <span className="metric-label">TPS</span>
        </div>
      </div>

      <div className="workflow-steps-section">
        <h4>Per-Step Metrics</h4>
        <table className="workflow-steps-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Count</th>
              <th>Pass %</th>
              <th>Avg</th>
              <th>p50</th>
              <th>p95</th>
              <th>Min</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            {stepSummaries.map((step, idx) => (
              <tr key={idx} className={step.passRate < 100 ? 'step-row-failed' : ''}>
                <td className="step-name-cell">
                  <span className="step-number">{idx + 1}</span>
                  {step.stepName}
                </td>
                <td>{step.total}</td>
                <td className={step.passRate === 100 ? 'pass-cell' : 'fail-cell'}>
                  {step.passRate}%
                </td>
                <td>{step.avgTime}ms</td>
                <td>{step.p50Time}ms</td>
                <td>{step.p95Time}ms</td>
                <td>{step.minTime}ms</td>
                <td>{step.maxTime}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="workflow-iterations-section">
        <div 
          className="workflow-iterations-header"
          onClick={() => setIterationsExpanded(!iterationsExpanded)}
        >
          <span className={`collapse-arrow ${iterationsExpanded ? 'expanded' : ''}`}>▶</span>
          <h4>Per-Iteration Detail</h4>
          <span className="iteration-count-badge">{iterationCount} iterations</span>
        </div>
        
        {iterationsExpanded && (
          <div className="workflow-iterations-list">
            {iterationSummaries.map((iter) => (
              <div key={iter.iterationIndex} className="iteration-item">
                <div 
                  className={`iteration-header ${iter.allPassed ? 'iteration-passed' : 'iteration-failed'}`}
                  onClick={() => toggleIteration(iter.iterationIndex)}
                >
                  <span className={`collapse-arrow ${expandedIterations.has(iter.iterationIndex) ? 'expanded' : ''}`}>▶</span>
                  <span className="iteration-status">{iter.allPassed ? '✅' : '❌'}</span>
                  <span className="iteration-label">Iteration #{iter.iterationIndex}</span>
                  <span className="iteration-time">{iter.totalTime}ms</span>
                  <span className="iteration-pass-count">
                    ({iter.passed}/{iter.total} passed)
                  </span>
                </div>
                
                {expandedIterations.has(iter.iterationIndex) && (
                  <div className="iteration-details">
                    {iter.results.map((r) => (
                      <div 
                        key={r.id} 
                        className={`iteration-result ${r.passed ? '' : 'result-failed'}`}
                        onClick={() => onResultClick?.(r)}
                      >
                        <span className={`method-badge method-${r.method.toLowerCase()}`}>{r.method}</span>
                        <span className="result-name">{r.scenarioName}</span>
                        <span className="result-status">{r.httpStatus || 'ERR'}</span>
                        <span className="result-time">{r.responseTimeMs}ms</span>
                        <span className="result-passed">{r.passed ? '✓' : '✗'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
