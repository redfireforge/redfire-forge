import { useState, useMemo, useRef, useEffect } from 'react';
import type { RequestResult, TestRun } from '../../../shared/types';
import { percentile } from '../../../shared/utils/percentiles';
import {
  hasWorkflowData,
  computeWorkflowStepSummaries,
  computeWorkflowIterationSummaries,
  getIterationCount,
  type WorkflowStepSummary,
  type WorkflowIterationSummary,
} from '../../test-runner/utils/resultsGrouping';
import { formatTransportStatus, getTransportMethodLabel } from '../utils/transportStatus';

interface Props {
  run: TestRun;
  onResultClick?: (result: RequestResult) => void;
}

interface IterationChartProps {
  iterations: WorkflowIterationSummary[];
  maxHeight?: number;
}

export function WorkflowIterationChart({ iterations, maxHeight = 200 }: IterationChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const stats = useMemo(() => {
    if (iterations.length === 0) return { min: 0, max: 0, avg: 0, p95: 0 };
    const times = iterations.map(i => i.totalTime).sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const round1 = (v: number) => Math.round(v * 10) / 10;
    return {
      min: round1(times[0]),
      max: round1(times[times.length - 1]),
      avg: Math.round(sum / times.length),
      p95: round1(percentile(times, 0.95)),
    };
  }, [iterations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || iterations.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = maxHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxTime = Math.max(...iterations.map(i => i.totalTime)) * 1.1;
    const barWidth = Math.max(2, Math.min(20, (chartWidth / iterations.length) - 2));
    const barSpacing = (chartWidth - barWidth * iterations.length) / (iterations.length + 1);

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      const value = Math.round(maxTime - (maxTime / gridLines) * i);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${value}ms`, padding.left - 5, y + 3);
    }
    ctx.setLineDash([]);

    iterations.forEach((iter, idx) => {
      const x = padding.left + barSpacing + idx * (barWidth + barSpacing);
      const barHeight = (iter.totalTime / maxTime) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      if (iter.allPassed) {
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.9)');
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0.5)');
      } else {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.5)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
    });

    if (stats.avg > 0) {
      const avgY = padding.top + chartHeight - (stats.avg / maxTime) * chartHeight;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, avgY);
      ctx.lineTo(width - padding.right, avgY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = 'rgba(251, 191, 36, 1)';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`avg: ${Math.round(stats.avg)}ms`, width - padding.right - 80, avgY - 4);
    }

    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(iterations.length / 10));
    iterations.forEach((iter, idx) => {
      if (idx % labelStep === 0 || idx === iterations.length - 1) {
        const x = padding.left + barSpacing + idx * (barWidth + barSpacing) + barWidth / 2;
        ctx.fillText(`#${iter.iterationIndex + 1}`, x, height - padding.bottom + 15);
      }
    });
  }, [iterations, maxHeight, stats]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || iterations.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = container.clientWidth - padding.left - padding.right;
    const barWidth = Math.max(2, Math.min(20, (chartWidth / iterations.length) - 2));
    const barSpacing = (chartWidth - barWidth * iterations.length) / (iterations.length + 1);

    const relX = x - padding.left - barSpacing;
    const idx = Math.floor(relX / (barWidth + barSpacing));

    if (idx >= 0 && idx < iterations.length && x >= padding.left && x <= container.clientWidth - padding.right) {
      const iter = iterations[idx];
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 40,
        text: `Iteration #${iter.iterationIndex + 1}: ${Math.round(iter.totalTime * 10) / 10}ms (${iter.passed}/${iter.total} passed)`,
      });
    } else {
      setTooltip(null);
    }
  };

  if (iterations.length === 0) return null;

  return (
    <div className="workflow-iteration-chart" ref={containerRef}>
      <div className="chart-header">
        <h4>Iteration Performance</h4>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-color legend-pass"></span> Passed
          </span>
          <span className="legend-item">
            <span className="legend-color legend-fail"></span> Failed
          </span>
          <span className="legend-item">
            <span className="legend-line"></span> Avg ({stats.avg}ms)
          </span>
        </div>
      </div>
      <div className="chart-stats">
        <span className="chart-stat">Min: <strong>{stats.min}ms</strong></span>
        <span className="chart-stat">Avg: <strong>{stats.avg}ms</strong></span>
        <span className="chart-stat">p95: <strong>{stats.p95}ms</strong></span>
        <span className="chart-stat">Max: <strong>{stats.max}ms</strong></span>
      </div>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          style={{ cursor: 'crosshair' }}
        />
        {tooltip && (
          <div
            className="chart-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
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

      {iterationSummaries.length > 0 && (
        <WorkflowIterationChart iterations={iterationSummaries} />
      )}

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
                        <span className={`method-badge method-${r.method.toLowerCase()}`}>{getTransportMethodLabel(r)}</span>
                        <span className="result-name">{r.scenarioName}</span>
                        <span className="result-status">{formatTransportStatus(r)}</span>
                        <span className="result-time">{Math.round(r.responseTimeMs * 10) / 10}ms</span>
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
