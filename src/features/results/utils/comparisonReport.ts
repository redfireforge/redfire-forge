/**
 * Export utilities for RunComparison — produces Markdown and JSON reports
 * suitable for download from the UI or embedding in CI artefacts.
 */

import type { TestRun } from '../../../shared/types';
import type { RunComparison } from './runBaselines';

// ── Lean export shape (no results / trace arrays) ────────────────────────────

export interface ComparisonExportRun {
  id: string;
  timestamp: number;
  label?: string;
  svcName?: string;
  envName?: string;
  projectName?: string;
  summary: TestRun['summary'];
}

export interface ComparisonExport {
  exportedAt: string;
  baseline: ComparisonExportRun;
  current: ComparisonExportRun;
  metricDeltas: RunComparison['metricDeltas'];
  scenarioDeltas: RunComparison['scenarioDeltas'];
  regressions: RunComparison['regressions'];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripRun(run: TestRun, label?: string): ComparisonExportRun {
  return {
    id: run.id,
    timestamp: run.timestamp,
    label,
    svcName: run.svcName,
    envName: run.envName,
    projectName: run.projectName,
    summary: run.summary,
  };
}

/** Format a regression threshold + actual for the Regressions section.
 *  Error Rate uses absolute percentage-point units; all other metrics use %. */
function regressionUnit(metric: string): string {
  return metric === 'Error Rate' ? ' pp' : '%';
}

// ── JSON export ───────────────────────────────────────────────────────────────

/**
 * Serialise a RunComparison to compact JSON, stripping the potentially huge
 * `results[]` and trace arrays from both run objects.
 */
export function generateComparisonJson(comparison: RunComparison, baselineLabel?: string): string {
  const exp: ComparisonExport = {
    exportedAt: new Date().toISOString(),
    baseline: stripRun(comparison.baselineRun, baselineLabel),
    current: stripRun(comparison.currentRun),
    metricDeltas: comparison.metricDeltas,
    scenarioDeltas: comparison.scenarioDeltas,
    regressions: comparison.regressions,
  };
  return JSON.stringify(exp, null, 2);
}

// ── Markdown export ───────────────────────────────────────────────────────────

/**
 * Produce a Markdown comparison report suitable for download or CI commentary.
 * Sections: header metadata, metric deltas table, per-scenario deltas table
 * (omitted when empty), regression list (omitted when none).
 */
export function generateComparisonMarkdown(comparison: RunComparison, baselineLabel?: string): string {
  const { metricDeltas, scenarioDeltas, regressions } = comparison;
  const blLabel = baselineLabel ?? new Date(comparison.baselineRun.timestamp).toLocaleString();
  const curLabel = new Date(comparison.currentRun.timestamp).toLocaleString();

  const svcName = comparison.currentRun.svcName;
  const envName = comparison.currentRun.envName;

  const regressCount = regressions.length;
  const criticalCount = regressions.filter((r) => r.severity === 'critical').length;

  const lines: string[] = [
    '# Performance Comparison Report',
    '',
    '| | |',
    '|:---|:---|',
    `| **Exported** | ${new Date().toLocaleString()} |`,
    `| **Baseline** | ${blLabel} |`,
    `| **Current** | ${curLabel} |`,
  ];

  if (svcName) lines.push(`| **Service** | ${svcName} |`);
  if (envName) lines.push(`| **Environment** | ${envName} |`);

  lines.push('');

  if (regressCount > 0) {
    lines.push(
      `> ⚠ **${regressCount} regression${regressCount > 1 ? 's' : ''} detected**` +
        (criticalCount > 0 ? ` (${criticalCount} critical)` : ''),
    );
  } else {
    lines.push('> ✅ **No regressions detected**');
  }

  lines.push(
    '',
    '## Metric Deltas',
    '',
    '| Metric | Baseline | Current | Delta | Change | Status |',
    '|:---|---:|---:|---:|---:|:---|',
  );

  for (const d of metricDeltas) {
    const isTime =
      d.metric !== 'TPS' && d.metric !== 'Error Rate';
    // valueUnit: unit shown next to baseline/current values
    const valueUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? '%' : '';
    // deltaUnit: Error Rate delta is an absolute pp change — using '%' would be misleading
    const deltaUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? ' pp' : '';
    const sign = d.delta > 0 ? '+' : '';
    const signPct = d.deltaPercent > 0 ? '+' : '';
    const alert = regressions.find((r) => r.metric === d.metric);
    const statusLabel = alert
      ? (alert.severity === 'critical' ? '🔴 Critical' : '🟡 Warning')
      : d.improved
        ? '✓ Improved'
        : '— No change';
    lines.push(
      `| ${d.metric} | ${d.baselineValue}${valueUnit} | ${d.currentValue}${valueUnit} | ${sign}${d.delta}${deltaUnit} | ${signPct}${d.deltaPercent}% | ${statusLabel} |`,
    );
  }

  if (scenarioDeltas.length > 0) {
    lines.push(
      '',
      '## Per-Scenario Deltas',
      '',
      '| Scenario | Baseline Avg | Current Avg | Delta | Status |',
      '|:---|---:|---:|---:|:---|',
    );
    for (const d of scenarioDeltas) {
      const name = d.featureGroupName
        ? `${d.featureGroupName} / ${d.scenarioName}`
        : d.scenarioName;
      const sign = d.timeDelta > 0 ? '+' : '';
      const status = d.regressed
        ? '⚠ Regressed'
        : d.timeDelta < 0
          ? '✓ Faster'
          : '— OK';
      lines.push(
        `| ${name} | ${d.baselineAvgTime} ms | ${d.currentAvgTime} ms | ${sign}${d.timeDelta} ms | ${status} |`,
      );
    }
  }

  if (regressions.length > 0) {
    lines.push(
      '',
      '## Regressions',
      '',
      '| Metric | Severity | Threshold | Actual |',
      '|:---|:---|---:|---:|',
    );
    for (const r of regressions) {
      const unit = regressionUnit(r.metric);
      const severityLabel = r.severity === 'critical' ? '🔴 Critical' : '🟡 Warning';
      // TPS regression = a drop — show '-actual%' so the sign matches the direction of change.
      // All other metrics regress upward, so '+actual' is correct.
      const actualSign = r.metric === 'TPS' ? '-' : '+';
      lines.push(
        `| ${r.metric} | ${severityLabel} | ${r.threshold}${unit} | ${actualSign}${r.actual}${unit} |`,
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}
