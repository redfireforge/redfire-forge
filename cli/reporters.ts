import type { RequestResult, TestSummary, TestConfig, TestRun, TimingBreakdown } from '../src/types';
import type { Workflow } from '../src/features/workflow/types/workflow';

// ── JSON report ─────────────────────────────────────────────

export interface DataRowSummaryReport {
  pattern: string;
  totalRows: number;
  passedRows: number;
  failedRows: number;
  failedRowDetails: { row: string; label: string; status: number; error: string }[];
}

export function buildDataRowSummary(results: RequestResult[]): DataRowSummaryReport[] {
  const dataRowResults = results.filter(r => r.dataRowId);
  if (dataRowResults.length === 0) return [];

  // Group by scenarioName
  const byScenario = new Map<string, RequestResult[]>();
  for (const r of dataRowResults) {
    const key = r.scenarioName;
    if (!byScenario.has(key)) byScenario.set(key, []);
    byScenario.get(key)!.push(r);
  }

  const summaries: DataRowSummaryReport[] = [];
  for (const [name, scResults] of byScenario) {
    const failed = scResults.filter(r => !r.passed);
    summaries.push({
      pattern: name,
      totalRows: scResults.length,
      passedRows: scResults.length - failed.length,
      failedRows: failed.length,
      failedRowDetails: failed.map(r => ({
        row: r.dataRowId ?? '?',
        label: r.dataRowLabel ?? '?',
        status: r.httpStatus,
        error: r.errorMessage
          || (r.failureDetails.length > 0
            ? r.failureDetails.map(f => `${f.path}: expected ${f.expected}, got ${f.actual}`).join('; ')
            : `HTTP ${r.httpStatus}`),
      })),
    });
  }
  return summaries;
}

export function buildJsonReport(
  results: RequestResult[],
  summary: TestSummary,
  config: TestConfig,
  meta: { name?: string; env?: string },
): TestRun {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    config,
    summary,
    results,
    envName: meta.env,
    projectName: meta.name,
  };
}

// ── JUnit XML report ────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function buildJunitXml(
  results: RequestResult[],
  summary: TestSummary,
  suiteName: string,
): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<testsuites name="${escapeXml(suiteName)}" tests="${summary.totalRequests}" failures="${summary.failedRequests + summary.failedValidations}" time="${(summary.totalDurationMs / 1000).toFixed(3)}">`);
  lines.push(`  <testsuite name="${escapeXml(suiteName)}" tests="${summary.totalRequests}" failures="${summary.failedRequests + summary.failedValidations}" time="${(summary.totalDurationMs / 1000).toFixed(3)}">`);

  for (const r of results) {
    const className = r.featureGroupName || r.groupName || 'RedfireForge';
    const time = (r.responseTimeMs / 1000).toFixed(3);
    const rowSuffix = r.dataRowLabel ? ` [${escapeXml(r.dataRowLabel)}]` : '';
    lines.push(`    <testcase classname="${escapeXml(className)}" name="${escapeXml(r.scenarioName)} [${r.method} ${escapeXml(r.url)}]${rowSuffix}" time="${time}">`);
    if (!r.passed) {
      const msg = r.errorMessage ?? r.failureDetails.map(f => `${f.path}: expected ${f.expected}, got ${f.actual}`).join('; ');
      lines.push(`      <failure message="${escapeXml(msg)}" type="${r.httpStatus >= 400 || r.httpStatus === 0 ? 'HttpError' : 'ValidationFailure'}">`);
      lines.push(`HTTP ${r.httpStatus} ${r.method} ${escapeXml(r.url)}`);
      for (const f of r.failureDetails) {
        lines.push(`  ${f.path}: expected=${f.expected} actual=${f.actual}`);
      }
      lines.push(`      </failure>`);
    }
    lines.push(`    </testcase>`);
  }

  lines.push(`  </testsuite>`);
  lines.push(`</testsuites>`);
  return lines.join('\n');
}

// ── Timing aggregation helper ────────────────────────────────

function aggregateTiming(results: RequestResult[]): Record<keyof TimingBreakdown, number> | null {
  const withTiming = results.filter((r): r is RequestResult & { timing: TimingBreakdown } => !!r.timing);
  if (withTiming.length === 0) return null;
  const keys: (keyof TimingBreakdown)[] = ['dnsLookup', 'tcpConnect', 'tlsHandshake', 'ttfb', 'download', 'total'];
  const avg = {} as Record<keyof TimingBreakdown, number>;
  for (const k of keys) {
    avg[k] = Math.round(withTiming.reduce((s, r) => s + r.timing[k], 0) / withTiming.length * 100) / 100;
  }
  return avg;
}

// ── Markdown report ─────────────────────────────────────────

export function buildMarkdownReport(
  summary: TestSummary,
  config: TestConfig,
  meta: { name?: string; env?: string; file?: string },
  results?: RequestResult[],
): string {
  const lines: string[] = [];
  const title = meta.name || meta.file || 'RedfireForge Test Run';
  lines.push(`# ${title}`);
  lines.push('');
  if (meta.env) lines.push(`**Environment:** ${meta.env}  `);
  lines.push(`**Date:** ${new Date().toISOString()}  `);
  lines.push(`**Mode:** ${config.executionMode} | Concurrency: ${config.concurrency} | Iterations: ${config.iterations}  `);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| **TPS** | ${summary.tps} |`);
  lines.push(`| **Avg Response** | ${summary.avgResponseTime} ms |`);
  lines.push(`| **Min / Max** | ${summary.minResponseTime} ms / ${summary.maxResponseTime} ms |`);
  lines.push(`| **P50** | ${summary.p50ResponseTime} ms |`);
  lines.push(`| **P95** | ${summary.p95ResponseTime} ms |`);
  lines.push(`| **P99** | ${summary.p99ResponseTime} ms |`);
  lines.push(`| **Error Rate** | ${summary.errorRate}% |`);
  lines.push(`| **Total Requests** | ${summary.totalRequests} |`);
  lines.push(`| **Successful** | ${summary.successfulRequests} |`);
  lines.push(`| **Failed (HTTP)** | ${summary.failedRequests} |`);
  lines.push(`| **Failed (Validation)** | ${summary.failedValidations} |`);
  lines.push(`| **Duration** | ${(summary.totalDurationMs / 1000).toFixed(2)}s |`);
  lines.push('');

  if (results) {
    const avg = aggregateTiming(results);
    if (avg) {
      lines.push('## Timing Breakdown (avg)');
      lines.push('');
      lines.push('| Phase | Avg (ms) |');
      lines.push('|---|---|');
      lines.push(`| **DNS Lookup** | ${avg.dnsLookup} |`);
      lines.push(`| **TCP Connect** | ${avg.tcpConnect} |`);
      lines.push(`| **TLS Handshake** | ${avg.tlsHandshake} |`);
      lines.push(`| **TTFB** | ${avg.ttfb} |`);
      lines.push(`| **Download** | ${avg.download} |`);
      lines.push(`| **Total** | ${avg.total} |`);
      lines.push('');
    }
  }

  if (summary.failedRequests > 0 || summary.failedValidations > 0) {
    lines.push('## Errors');
    lines.push('');
    if (Object.keys(summary.errorsByStatus).length > 0) {
      lines.push('| Status | Count |');
      lines.push('|---|---|');
      for (const [status, count] of Object.entries(summary.errorsByStatus)) {
        lines.push(`| ${status} | ${count} |`);
      }
      lines.push('');
    }
  }

  const passed = summary.failedRequests === 0 && summary.failedValidations === 0;
  lines.push(`## Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  lines.push('');

  // Data row breakdown
  if (results) {
    const dataRowResults = results.filter(r => r.dataRowId);
    if (dataRowResults.length > 0) {
      const failedRows = dataRowResults.filter(r => !r.passed);
      const passedCount = dataRowResults.length - failedRows.length;
      lines.push('## Data Row Summary');
      lines.push('');
      lines.push(`**${dataRowResults.length}** total rows — **${passedCount}** passed, **${failedRows.length}** failed`);
      lines.push('');
      if (failedRows.length > 0) {
        lines.push('### Failed Rows');
        lines.push('');
        lines.push('| Row | Status | Error |');
        lines.push('|---|---|---|');
        for (const r of failedRows) {
          const label = r.dataRowLabel || r.dataRowId || '?';
          const err = r.errorMessage
            || (r.failureDetails.length > 0 ? `${r.failureDetails.length} validation failure(s)` : `HTTP ${r.httpStatus}`);
          lines.push(`| ${label} | ${r.httpStatus} | ${err} |`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ── Console summary (printed to terminal) ───────────────────

export function printConsoleSummary(summary: TestSummary, config: TestConfig, results?: RequestResult[]): void {
  const passed = summary.failedRequests === 0 && summary.failedValidations === 0;
  const bar = '─'.repeat(50);

  console.log('');
  console.log(bar);
  console.log('  RedfireForge — Test Run Summary');
  console.log(bar);
  console.log(`  Mode:         ${config.executionMode} (C:${config.concurrency} I:${config.iterations})`);
  console.log(`  Duration:     ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`  TPS:          ${summary.tps}`);
  console.log(`  Avg Response: ${summary.avgResponseTime} ms`);
  console.log(`  P50:          ${summary.p50ResponseTime} ms`);
  console.log(`  P95:          ${summary.p95ResponseTime} ms`);
  console.log(`  P99:          ${summary.p99ResponseTime} ms`);
  console.log(`  Min / Max:    ${summary.minResponseTime} ms / ${summary.maxResponseTime} ms`);

  if (results) {
    const avg = aggregateTiming(results);
    if (avg) {
      console.log(bar);
      console.log('  Timing Breakdown (avg)');
      console.log(`  DNS Lookup:   ${avg.dnsLookup} ms`);
      console.log(`  TCP Connect:  ${avg.tcpConnect} ms`);
      console.log(`  TLS Handshake:${avg.tlsHandshake} ms`);
      console.log(`  TTFB:         ${avg.ttfb} ms`);
      console.log(`  Download:     ${avg.download} ms`);
    }
  }

  console.log(bar);
  console.log(`  Total:        ${summary.totalRequests}`);
  console.log(`  Passed:       ${summary.successfulRequests}`);
  console.log(`  Failed HTTP:  ${summary.failedRequests}`);
  console.log(`  Failed Valid: ${summary.failedValidations}`);
  console.log(`  Error Rate:   ${summary.errorRate}%`);
  console.log(bar);
  console.log(`  Result:       ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(bar);

  // Data row breakdown (if parameterized results exist)
  if (results) {
    const dataRowResults = results.filter(r => r.dataRowId);
    if (dataRowResults.length > 0) {
      const failedRows = dataRowResults.filter(r => !r.passed);
      const passedRows = dataRowResults.filter(r => r.passed);
      console.log(`  Data Rows:    ${dataRowResults.length} total, ${passedRows.length} passed, ${failedRows.length} failed`);
      if (failedRows.length > 0) {
        console.log('');
        console.log('  Failed Data Rows:');
        for (const r of failedRows) {
          const label = r.dataRowLabel || r.dataRowId || '?';
          const err = r.errorMessage
            || (r.failureDetails.length > 0 ? `${r.failureDetails.length} validation failure(s)` : `HTTP ${r.httpStatus}`);
          console.log(`    ✗ ${label} — ${err}`);
        }
      }
      console.log(bar);
    }
  }

  console.log('');
}

// ── Workflow-specific reporters ──────────────────────────────

interface PerStepStats {
  nodeId: string;
  label: string;
  count: number;
  passed: number;
  failed: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

function computePerStepStats(results: RequestResult[]): PerStepStats[] {
  const byNode = new Map<string, RequestResult[]>();
  for (const r of results) {
    const nodeId = r.workflowNodeId || r.scenarioId;
    if (!byNode.has(nodeId)) byNode.set(nodeId, []);
    byNode.get(nodeId)!.push(r);
  }

  const stats: PerStepStats[] = [];
  for (const [nodeId, nodeResults] of byNode) {
    const times = nodeResults.map(r => r.responseTimeMs).sort((a, b) => a - b);
    const passed = nodeResults.filter(r => r.passed).length;
    stats.push({
      nodeId,
      label: nodeResults[0]?.scenarioName || nodeId,
      count: nodeResults.length,
      passed,
      failed: nodeResults.length - passed,
      avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      minMs: times[0] ?? 0,
      maxMs: times[times.length - 1] ?? 0,
      p95Ms: times[Math.floor(times.length * 0.95)] ?? 0,
    });
  }

  return stats;
}

interface PerIterationStats {
  index: number;
  passed: boolean;
  durationMs: number;
  stepCount: number;
}

function computePerIterationStats(results: RequestResult[], iterations: number): PerIterationStats[] {
  const byIteration = new Map<number, RequestResult[]>();
  for (const r of results) {
    const idx = r.iterationIndex ?? 0;
    if (!byIteration.has(idx)) byIteration.set(idx, []);
    byIteration.get(idx)!.push(r);
  }

  const stats: PerIterationStats[] = [];
  for (let i = 0; i < iterations; i++) {
    const iterResults = byIteration.get(i) || [];
    const allPassed = iterResults.every(r => r.passed);
    const totalDuration = iterResults.reduce((sum, r) => sum + r.responseTimeMs, 0);
    stats.push({
      index: i,
      passed: allPassed,
      durationMs: totalDuration,
      stepCount: iterResults.length,
    });
  }

  return stats;
}

/**
 * Print workflow-specific console summary with per-step and per-iteration metrics.
 */
export function printWorkflowConsoleSummary(
  summary: TestSummary,
  workflow: Workflow,
  iterations: number,
  concurrency: number,
  results?: RequestResult[],
): void {
  const passed = summary.failedRequests === 0 && summary.failedValidations === 0;
  const bar = '─'.repeat(50);

  console.log('');
  console.log(bar);
  console.log('  RedfireForge — Workflow Test Run Summary');
  console.log(bar);
  console.log(`  Workflow:     ${workflow.name}`);
  console.log(`  Mode:         workflow (I:${iterations} C:${concurrency})`);
  console.log(`  Duration:     ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`  Iterations/s: ${(iterations / (summary.totalDurationMs / 1000)).toFixed(2)}`);
  console.log(`  Avg Response: ${summary.avgResponseTime} ms`);
  console.log(`  P50:          ${summary.p50ResponseTime} ms`);
  console.log(`  P95:          ${summary.p95ResponseTime} ms`);
  console.log(`  P99:          ${summary.p99ResponseTime} ms`);

  console.log(bar);
  console.log(`  Total Steps:  ${summary.totalRequests}`);
  console.log(`  Passed:       ${summary.successfulRequests}`);
  console.log(`  Failed:       ${summary.failedRequests + summary.failedValidations}`);
  console.log(`  Error Rate:   ${summary.errorRate}%`);

  if (results && results.length > 0) {
    const stepStats = computePerStepStats(results);
    if (stepStats.length > 0) {
      console.log(bar);
      console.log('  Per-Step Metrics:');
      for (const s of stepStats) {
        const passRate = ((s.passed / s.count) * 100).toFixed(0);
        console.log(`    ${s.label}: avg=${s.avgMs}ms p95=${s.p95Ms}ms (${passRate}% pass)`);
      }
    }

    const iterStats = computePerIterationStats(results, iterations);
    const failedIters = iterStats.filter(i => !i.passed);
    if (failedIters.length > 0) {
      console.log(bar);
      console.log(`  Failed Iterations: ${failedIters.length}/${iterations}`);
      for (const i of failedIters.slice(0, 5)) {
        console.log(`    ✗ Iteration ${i.index + 1}: ${i.durationMs}ms, ${i.stepCount} steps`);
      }
      if (failedIters.length > 5) {
        console.log(`    ... and ${failedIters.length - 5} more`);
      }
    }
  }

  console.log(bar);
  console.log(`  Result:       ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(bar);
  console.log('');
}

/**
 * Build JUnit XML for workflow results.
 * Each iteration becomes a test case.
 */
export function buildWorkflowJunitXml(
  results: RequestResult[],
  summary: TestSummary,
  workflowName: string,
  iterations: number,
): string {
  const iterStats = computePerIterationStats(results, iterations);
  const failedCount = iterStats.filter(i => !i.passed).length;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<testsuites name="${escapeXml(workflowName)}" tests="${iterations}" failures="${failedCount}" time="${(summary.totalDurationMs / 1000).toFixed(3)}">`);
  lines.push(`  <testsuite name="${escapeXml(workflowName)}" tests="${iterations}" failures="${failedCount}" time="${(summary.totalDurationMs / 1000).toFixed(3)}">`);

  for (const iter of iterStats) {
    const time = (iter.durationMs / 1000).toFixed(3);
    lines.push(`    <testcase classname="${escapeXml(workflowName)}" name="Iteration ${iter.index + 1}" time="${time}">`);
    if (!iter.passed) {
      const iterResults = results.filter(r => r.iterationIndex === iter.index);
      const failedSteps = iterResults.filter(r => !r.passed);
      const msg = failedSteps.map(r => `${r.scenarioName}: ${r.errorMessage || `HTTP ${r.httpStatus}`}`).join('; ');
      lines.push(`      <failure message="${escapeXml(msg)}" type="WorkflowIterationFailure">`);
      for (const r of failedSteps) {
        lines.push(`  ${r.scenarioName}: HTTP ${r.httpStatus} ${r.method} ${escapeXml(r.url)}`);
      }
      lines.push(`      </failure>`);
    }
    lines.push(`    </testcase>`);
  }

  lines.push(`  </testsuite>`);
  lines.push(`</testsuites>`);
  return lines.join('\n');
}

/**
 * Build Markdown report for workflow results.
 */
export function buildWorkflowMarkdownReport(
  summary: TestSummary,
  workflow: Workflow,
  iterations: number,
  concurrency: number,
  results?: RequestResult[],
): string {
  const lines: string[] = [];
  lines.push(`# Workflow Test: ${workflow.name}`);
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString()}  `);
  lines.push(`**Mode:** workflow | Iterations: ${iterations} | Concurrency: ${concurrency}  `);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| **Iterations/s** | ${(iterations / (summary.totalDurationMs / 1000)).toFixed(2)} |`);
  lines.push(`| **Avg Response** | ${summary.avgResponseTime} ms |`);
  lines.push(`| **P50** | ${summary.p50ResponseTime} ms |`);
  lines.push(`| **P95** | ${summary.p95ResponseTime} ms |`);
  lines.push(`| **P99** | ${summary.p99ResponseTime} ms |`);
  lines.push(`| **Error Rate** | ${summary.errorRate}% |`);
  lines.push(`| **Total Steps** | ${summary.totalRequests} |`);
  lines.push(`| **Duration** | ${(summary.totalDurationMs / 1000).toFixed(2)}s |`);
  lines.push('');

  if (results && results.length > 0) {
    const stepStats = computePerStepStats(results);
    if (stepStats.length > 0) {
      lines.push('## Per-Step Metrics');
      lines.push('');
      lines.push('| Step | Count | Avg (ms) | P95 (ms) | Pass Rate |');
      lines.push('|---|---|---|---|---|');
      for (const s of stepStats) {
        const passRate = ((s.passed / s.count) * 100).toFixed(0);
        lines.push(`| ${s.label} | ${s.count} | ${s.avgMs} | ${s.p95Ms} | ${passRate}% |`);
      }
      lines.push('');
    }

    const iterStats = computePerIterationStats(results, iterations);
    const failedIters = iterStats.filter(i => !i.passed);
    if (failedIters.length > 0) {
      lines.push('## Failed Iterations');
      lines.push('');
      lines.push(`**${failedIters.length}** of **${iterations}** iterations failed.`);
      lines.push('');
      lines.push('| Iteration | Duration | Steps | Failed Steps |');
      lines.push('|---|---|---|---|');
      for (const iter of failedIters.slice(0, 20)) {
        const iterResults = results.filter(r => r.iterationIndex === iter.index);
        const failedSteps = iterResults.filter(r => !r.passed).map(r => r.scenarioName).join(', ');
        lines.push(`| ${iter.index + 1} | ${iter.durationMs}ms | ${iter.stepCount} | ${failedSteps} |`);
      }
      if (failedIters.length > 20) {
        lines.push(`| ... | ... | ... | ${failedIters.length - 20} more iterations |`);
      }
      lines.push('');
    }
  }

  const passed = summary.failedRequests === 0 && summary.failedValidations === 0;
  lines.push(`## Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  lines.push('');

  return lines.join('\n');
}
