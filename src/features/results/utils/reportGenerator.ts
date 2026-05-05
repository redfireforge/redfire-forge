import type { TestRun, RequestResult } from '../../../shared/types';
// import { escapeCsv } from '../../../shared/utils/export';

export interface ReportOptions {
  format: 'html' | 'json' | 'markdown';
  includePassedRows: boolean;
  includeResponseBodies: boolean;
  title?: string;
}

const defaultOptions: ReportOptions = {
  format: 'html',
  includePassedRows: true,
  includeResponseBodies: false,
};

// ─── Shared stats ──────────────────────────────────────────

interface RowStats {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

function computeRowStats(results: RequestResult[]): RowStats {
  const times = results.map(r => r.responseTimeMs).sort((a, b) => a - b);
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  return {
    total,
    passed,
    failed: total - passed,
    passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    p50: times.length ? times[Math.floor(times.length * 0.5)] : 0,
    p95: times.length ? times[Math.floor(times.length * 0.95)] : 0,
    p99: times.length ? times[Math.floor(times.length * 0.99)] : 0,
  };
}

// ─── HTML Report ───────────────────────────────────────────

function generateHtmlReport(run: TestRun, opts: ReportOptions): string {
  const s = run.summary;
  const stats = computeRowStats(run.results);
  const failed = run.results.filter(r => !r.passed);
  const passed = run.results.filter(r => r.passed);
  const hasDataRows = run.results.some(r => r.dataRowId);
  const title = opts.title || `${run.projectName || 'Test'} Report`;

  const failedRowsHtml = failed.map(r => `
    <tr>
      <td>${esc(r.dataRowLabel || r.scenarioName)}</td>
      <td>${r.httpStatus || 'ERR'}</td>
      <td>${r.responseTimeMs}ms</td>
      <td>${esc(r.errorMessage || r.failureDetails.map(f => `${f.path}: expected ${f.expected}, got ${f.actual}`).join('; ') || '')}</td>
    </tr>`).join('');

  const passedRowsHtml = opts.includePassedRows ? passed.map(r => `
    <tr>
      <td>${esc(r.dataRowLabel || r.scenarioName)}</td>
      <td>${r.httpStatus}</td>
      <td>${r.responseTimeMs}ms</td>
      <td></td>
    </tr>`).join('') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1d23; color: #e0e4ea; padding: 24px; }
  .report { max-width: 960px; margin: 0 auto; }
  .header { background: #22262e; border: 1px solid #333a44; border-radius: 8px; padding: 20px 24px; margin-bottom: 16px; }
  .header h1 { font-size: 1.2rem; margin-bottom: 8px; }
  .meta { font-size: 0.82rem; color: #9ca3af; line-height: 1.8; }
  .summary-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .stat-card { background: #22262e; border: 1px solid #333a44; border-radius: 6px; padding: 12px 18px; min-width: 100px; text-align: center; }
  .stat-value { font-size: 1.3rem; font-weight: 700; }
  .stat-label { font-size: 0.72rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  .stat-pass .stat-value { color: #4ade80; }
  .stat-fail .stat-value { color: #f87171; }
  .section { background: #22262e; border: 1px solid #333a44; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
  .section-header { padding: 10px 16px; font-weight: 600; font-size: 0.88rem; border-bottom: 1px solid #333a44; }
  .section-header.fail { background: rgba(248,113,113,0.08); color: #f87171; }
  .section-header.pass { background: rgba(74,222,128,0.08); color: #4ade80; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { text-align: left; padding: 6px 12px; font-weight: 500; font-size: 0.73rem; text-transform: uppercase; letter-spacing: 0.04em; color: #9ca3af; border-bottom: 1px solid #333a44; }
  td { padding: 6px 12px; border-bottom: 1px solid rgba(51,58,68,0.5); }
  tr:hover td { background: rgba(91,156,246,0.05); }
  .footer { text-align: center; font-size: 0.72rem; color: #6b7280; margin-top: 16px; }
  @media print { body { background: #fff; color: #111; } .header, .section, .stat-card { border-color: #ddd; background: #fff; } }
</style>
</head>
<body>
<div class="report">
  <div class="header">
    <h1>${esc(title)}</h1>
    <div class="meta">
      Date: ${new Date(run.timestamp).toLocaleString()}<br>
      ${run.envName ? `Environment: ${esc(run.envName)}` : ''}${run.svcName ? ` / ${esc(run.svcName)}` : ''}<br>
      Duration: ${(s.totalDurationMs / 1000).toFixed(2)}s · Concurrency: ${run.config.concurrency} · Mode: ${run.config.executionMode || 'batch'}
      ${hasDataRows ? `<br>Parameterized: ${run.results.filter(r => r.dataRowId).length} data rows` : ''}
    </div>
  </div>

  <div class="summary-bar">
    <div class="stat-card"><div class="stat-value">${s.tps}</div><div class="stat-label">TPS</div></div>
    <div class="stat-card stat-pass"><div class="stat-value">${stats.passed}</div><div class="stat-label">Passed</div></div>
    <div class="stat-card stat-fail"><div class="stat-value">${stats.failed}</div><div class="stat-label">Failed</div></div>
    <div class="stat-card"><div class="stat-value">${stats.passRate}%</div><div class="stat-label">Pass Rate</div></div>
    <div class="stat-card"><div class="stat-value">${s.avgResponseTime}ms</div><div class="stat-label">Avg</div></div>
    <div class="stat-card"><div class="stat-value">${s.p50ResponseTime ?? '—'}ms</div><div class="stat-label">P50</div></div>
    <div class="stat-card"><div class="stat-value">${s.p95ResponseTime}ms</div><div class="stat-label">P95</div></div>
    <div class="stat-card"><div class="stat-value">${s.p99ResponseTime}ms</div><div class="stat-label">P99</div></div>
  </div>

  ${failed.length > 0 ? `
  <div class="section">
    <div class="section-header fail">✗ Failed (${failed.length})</div>
    <table>
      <thead><tr><th>Row / Test</th><th>Status</th><th>Time</th><th>Error</th></tr></thead>
      <tbody>${failedRowsHtml}</tbody>
    </table>
  </div>` : ''}

  ${opts.includePassedRows && passed.length > 0 ? `
  <div class="section">
    <div class="section-header pass">✓ Passed (${passed.length})</div>
    <table>
      <thead><tr><th>Row / Test</th><th>Status</th><th>Time</th><th>Error</th></tr></thead>
      <tbody>${passedRowsHtml}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">Generated by RedfireForge · ${new Date().toISOString()}</div>
</div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── JSON Report ───────────────────────────────────────────

function generateJsonReport(run: TestRun, opts: ReportOptions): string {
  const hasDataRows = run.results.some(r => r.dataRowId);
  const failed = run.results.filter(r => !r.passed);

  const report = {
    title: opts.title || `${run.projectName || 'Test'} Report`,
    timestamp: new Date(run.timestamp).toISOString(),
    environment: run.envName,
    service: run.svcName,
    config: {
      executionMode: run.config.executionMode,
      concurrency: run.config.concurrency,
      totalTransactions: run.config.totalTransactions,
    },
    summary: {
      ...run.summary,
      passRate: run.summary.totalRequests > 0
        ? Math.round((run.summary.successfulRequests / run.summary.totalRequests) * 100)
        : 0,
    },
    ...(hasDataRows ? {
      parameterized: {
        totalRows: run.results.filter(r => r.dataRowId).length,
        passedRows: run.results.filter(r => r.dataRowId && r.passed).length,
        failedRows: run.results.filter(r => r.dataRowId && !r.passed).length,
        failedRowDetails: failed.filter(r => r.dataRowId).map(r => ({
          rowId: r.dataRowId,
          label: r.dataRowLabel,
          httpStatus: r.httpStatus,
          error: r.errorMessage || r.failureDetails.map(f => `${f.path}: expected ${f.expected}, got ${f.actual}`).join('; '),
        })),
      },
    } : {}),
    results: opts.includeResponseBodies
      ? run.results
      : run.results.map(r => {
          const { responseBody, ...rest } = r;
          return rest;
        }),
  };
  return JSON.stringify(report, null, 2);
}

// ─── Markdown Report ───────────────────────────────────────

function generateMarkdownReport(run: TestRun, opts: ReportOptions): string {
  const s = run.summary;
  const stats = computeRowStats(run.results);
  const failed = run.results.filter(r => !r.passed);
  const title = opts.title || `${run.projectName || 'Test'} Report`;

  let md = `# ${title}\n\n`;
  md += `**Date:** ${new Date(run.timestamp).toLocaleString()}  \n`;
  if (run.envName) md += `**Environment:** ${run.envName}`;
  if (run.svcName) md += ` / ${run.svcName}`;
  md += `  \n`;
  md += `**Duration:** ${(s.totalDurationMs / 1000).toFixed(2)}s · **Concurrency:** ${run.config.concurrency} · **Mode:** ${run.config.executionMode || 'batch'}\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| TPS | ${s.tps} |\n`;
  md += `| Pass Rate | ${stats.passRate}% (${stats.passed}/${stats.total}) |\n`;
  md += `| Avg Response | ${s.avgResponseTime}ms |\n`;
  md += `| P50 | ${s.p50ResponseTime ?? '—'}ms |\n`;
  md += `| P95 | ${s.p95ResponseTime}ms |\n`;
  md += `| P99 | ${s.p99ResponseTime}ms |\n`;
  md += `| Error Rate | ${s.errorRate}% |\n\n`;

  if (failed.length > 0) {
    md += `## Failed (${failed.length})\n\n`;
    md += `| Row / Test | Status | Time | Error |\n|---|---|---|---|\n`;
    for (const r of failed) {
      const label = r.dataRowLabel || r.scenarioName;
      const err = r.errorMessage || r.failureDetails.map(f => `${f.path}: expected ${f.expected}, got ${f.actual}`).join('; ');
      md += `| ${label} | ${r.httpStatus || 'ERR'} | ${r.responseTimeMs}ms | ${err} |\n`;
    }
    md += '\n';
  }

  md += `---\n*Generated by RedfireForge · ${new Date().toISOString()}*\n`;
  return md;
}

// ─── Public API ────────────────────────────────────────────

export function generateReport(run: TestRun, options?: Partial<ReportOptions>): string {
  const opts = { ...defaultOptions, ...options };
  switch (opts.format) {
    case 'json': return generateJsonReport(run, opts);
    case 'markdown': return generateMarkdownReport(run, opts);
    case 'html':
    default: return generateHtmlReport(run, opts);
  }
}

export function downloadReport(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
