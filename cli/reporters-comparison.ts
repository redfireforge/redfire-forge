import type { RunComparison } from '../src/features/results/utils/runBaselines';

const COL = 24;

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function sign(n: number): string {
  return n > 0 ? '+' : '';
}

function regressionUnit(metric: string): string {
  return metric === 'Error Rate' ? ' pp' : '%';
}

/**
 * Print a human-readable regression comparison summary to stdout.
 * If `quiet` is true the function is a no-op.
 */
export function printComparisonSummary(
  comparison: RunComparison,
  opts: { quiet?: boolean; baselineLabel?: string } = {},
): void {
  if (opts.quiet) return;

  const { metricDeltas, regressions } = comparison;
  const blLabel = opts.baselineLabel ?? new Date(comparison.baselineRun.timestamp).toLocaleString();
  const curLabel = new Date(comparison.currentRun.timestamp).toLocaleString();

  const sep = '─'.repeat(64);
  console.log(`\n  ${sep}`);
  console.log('  Performance Regression Report');
  console.log(`  Baseline : ${blLabel}`);
  console.log(`  Current  : ${curLabel}`);
  console.log(`  ${sep}`);

  console.log(
    `  ${pad('Metric', COL)}  ${pad('Baseline', 12)}  ${pad('Current', 12)}  ${pad('Δ', 10)}  Status`,
  );
  console.log(`  ${sep}`);

  for (const d of metricDeltas) {
    const isTime = d.metric !== 'TPS' && d.metric !== 'Error Rate';
    const valueUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? '%' : '';
    const deltaUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? ' pp' : '';
    const deltaStr = `${sign(d.delta)}${d.delta}${deltaUnit} (${sign(d.deltaPercent)}${d.deltaPercent}%)`;

    const alert = regressions.find((r) => r.metric === d.metric);
    const statusLabel = alert
      ? (alert.severity === 'critical' ? '🔴 CRITICAL' : '🟡 WARN')
      : d.improved
        ? '✓ better'
        : '— ok';

    console.log(
      `  ${pad(d.metric, COL)}  ${pad(`${d.baselineValue}${valueUnit}`, 12)}  ${pad(`${d.currentValue}${valueUnit}`, 12)}  ${pad(deltaStr, 20)}  ${statusLabel}`,
    );
  }

  console.log(`  ${sep}`);

  if (regressions.length === 0) {
    console.log('  ✅ No regressions detected\n');
  } else {
    const critCount = regressions.filter((r) => r.severity === 'critical').length;
    const warnCount = regressions.length - critCount;
    const parts: string[] = [];
    if (critCount > 0) parts.push(`${critCount} critical`);
    if (warnCount > 0) parts.push(`${warnCount} warning`);
    console.log(`  ⚠  Regressions: ${parts.join(', ')}\n`);
  }
}

/**
 * Build a Markdown comparison report for writing to a file (--comparison-report flag).
 * Reuses the same Markdown logic as the UI export.
 */
export function buildComparisonMarkdown(
  comparison: RunComparison,
  baselineLabel?: string,
): string {
  const { metricDeltas, regressions } = comparison;
  const blLabel = baselineLabel ?? new Date(comparison.baselineRun.timestamp).toLocaleString();
  const curLabel = new Date(comparison.currentRun.timestamp).toLocaleString();

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
    '',
    regressCount > 0
      ? `> ⚠ **${regressCount} regression${regressCount > 1 ? 's' : ''} detected**` + (criticalCount > 0 ? ` (${criticalCount} critical)` : '')
      : '> ✅ **No regressions detected**',
    '',
    '## Metric Deltas',
    '',
    '| Metric | Baseline | Current | Delta | Change | Status |',
    '|:---|---:|---:|---:|---:|:---|',
  ];

  for (const d of metricDeltas) {
    const isTime = d.metric !== 'TPS' && d.metric !== 'Error Rate';
    const valueUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? '%' : '';
    const deltaUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? ' pp' : '';
    const deltaSign = sign(d.delta);
    const pctSign = sign(d.deltaPercent);
    const alert = regressions.find((r) => r.metric === d.metric);
    const statusLabel = alert
      ? (alert.severity === 'critical' ? '🔴 Critical' : '🟡 Warning')
      : d.improved
        ? '✓ Improved'
        : '— No change';
    lines.push(
      `| ${d.metric} | ${d.baselineValue}${valueUnit} | ${d.currentValue}${valueUnit} | ${deltaSign}${d.delta}${deltaUnit} | ${pctSign}${d.deltaPercent}% | ${statusLabel} |`,
    );
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
      const actualSign = r.metric === 'TPS' ? '-' : '+';
      lines.push(
        `| ${r.metric} | ${r.severity === 'critical' ? '🔴 Critical' : '🟡 Warning'} | ${r.threshold}${unit} | ${actualSign}${r.actual}${unit} |`,
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}
