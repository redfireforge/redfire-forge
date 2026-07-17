import type { RequestResult, TestSummary, TestConfig, TestRun, TimingBreakdown } from '../src/types';
import type { Workflow } from '../src/features/workflow/types/workflow';
import { formatFailureDetails } from '../src/shared/utils/helpers';
import { percentile } from '../src/shared/utils/percentiles';
import type { RunComparison } from '../src/features/results/utils/runBaselines';
import { redactGrpcHarnessRunnerArtifactsForExport } from '../src/shared/grpc/grpcHarnessExport';

// ── JSON report ─────────────────────────────────────────────

export interface DataRowSummaryReport {
  pattern: string;
  totalRows: number;
  passedRows: number;
  failedRows: number;
  failedRowDetails: { row: string; label: string; status: number | string; error: string }[];
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
        status: (r.transportType ?? 'http') === 'http' ? r.httpStatus : formatTransportLabel(r),
        error: r.errorMessage
          || (r.failureDetails.length > 0
            ? formatFailureDetails(r.failureDetails)
            : formatTransportErrorFallback(r)),
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
  const exportSafeResults = redactGrpcHarnessRunnerArtifactsForExport(results);
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    config,
    summary,
    results: exportSafeResults,
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
  const exportSafeResults = redactGrpcHarnessRunnerArtifactsForExport(results);
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<testsuites name="${escapeXml(suiteName)}" tests="${summary.totalRequests}" failures="${summary.failedRequests + summary.failedValidations}" time="${(summary.totalDurationMs / 1000).toFixed(3)}">`);
  lines.push(`  <testsuite name="${escapeXml(suiteName)}" tests="${summary.totalRequests}" failures="${summary.failedRequests + summary.failedValidations}" time="${(summary.totalDurationMs / 1000).toFixed(3)}">`);

  for (const r of exportSafeResults) {
    const className = r.featureGroupName || r.groupName || 'RedfireForge';
    const time = (r.responseTimeMs / 1000).toFixed(3);
    const rowSuffix = r.dataRowLabel ? ` [${escapeXml(r.dataRowLabel)}]` : '';
    const tagAttr = r.scenarioTags?.length
      ? ` tags="${escapeXml(r.scenarioTags.join(','))}"`
      : '';
    const tt = r.transportType ?? 'http';
    let testcaseLocation: string;
    if (tt === 'http') {
      testcaseLocation = r.url;
    } else if (tt === 'kafkaProduce' || tt === 'kafkaConsume') {
      testcaseLocation = r.kafkaResultMeta?.topic ?? (r.url || 'kafka');
    } else {
      testcaseLocation = r.wsResultMeta?.url ?? (r.url || 'ws');
    }
    lines.push(`    <testcase classname="${escapeXml(className)}" name="${escapeXml(r.scenarioName)} [${r.method} ${escapeXml(testcaseLocation)}]${rowSuffix}" time="${time}"${tagAttr}>`);
    if (!r.passed) {
      const msg = r.errorMessage ?? formatFailureDetails(r.failureDetails);
      let failureType: string;
      let failureBody: string;
      if (tt === 'http') {
        failureType = r.httpStatus >= 400 || r.httpStatus === 0 ? 'HttpError' : 'ValidationFailure';
        failureBody = `HTTP ${r.httpStatus} ${r.method} ${escapeXml(r.url)}`;
      } else if (tt === 'kafkaProduce' || tt === 'kafkaConsume') {
        failureType = 'KafkaError';
        failureBody = `KAFKA ${r.method} ${escapeXml(r.kafkaResultMeta?.topic ?? (r.url || 'kafka'))}`;
      } else {
        failureType = 'WebSocketError';
        failureBody = `${formatTransportLabel(r)} ${escapeXml(r.wsResultMeta?.url ?? (r.url || 'ws'))}`;
      }
      lines.push(`      <failure message="${escapeXml(msg)}" type="${failureType}">`);
      lines.push(failureBody);
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
  lines.push(`| **P99.9** | ${summary.p999ResponseTime ?? '—'} ms |`);
  lines.push(`| **Error Rate** | ${summary.errorRate}% |`);
  lines.push(`| **Total Requests** | ${summary.totalRequests} |`);
  lines.push(`| **Successful** | ${summary.successfulRequests} |`);
  lines.push(`| **Failed (HTTP)** | ${summary.failedRequests} |`);
  lines.push(`| **Failed (Validation)** | ${summary.failedValidations} |`);
  lines.push(`| **Duration** | ${(summary.totalDurationMs / 1000).toFixed(2)}s |`);
  if (results?.some(r => r.scenarioTags?.length)) {
    const allTags = [...new Set(results.flatMap(r => r.scenarioTags ?? []))].sort();
    lines.push(`| **Tags** | ${allTags.join(', ')} |`);
  }
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
  lines.push(passed ? '## Result: PASSED ✅' : '## Result: FAILED ❌');
  lines.push('');

  if (results) appendDataRowSummaryMd(lines, results);

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
  console.log(`  P99.9:        ${summary.p999ResponseTime ?? '—'} ms`);
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
  // Tags summary (if any results have scenario tags)
  if (results?.some(r => r.scenarioTags?.length)) {
    const allTags = [...new Set(results.flatMap(r => r.scenarioTags ?? []))].sort();
    console.log(`  Tags:         ${allTags.join(', ')}`);
  }

  console.log(bar);
  console.log(`  Result:       ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(bar);

  if (results) printDataRowConsole(results, bar);

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
    const first = nodeResults[0];
    const label = (first && first.scenarioName) ? first.scenarioName : nodeId;
    stats.push({
      nodeId,
      label,
      count: nodeResults.length,
      passed,
      failed: nodeResults.length - passed,
      avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      minMs: times[0],
      maxMs: times[times.length - 1],
      p95Ms: percentile(times, 0.95),
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

function formatRowLabel(r: RequestResult): string {
  return r.dataRowLabel || r.dataRowId || '?';
}

function formatTransportLabel(r: RequestResult): string {
  const tt = r.transportType ?? 'http';
  switch (tt) {
    case 'http': return `HTTP ${r.httpStatus}`;
    case 'kafkaProduce': return 'PRODUCE';
    case 'kafkaConsume': return 'CONSUME';
    case 'wsConnect': return 'WS_CONNECT';
    case 'wsSend': return 'WS_SEND';
    case 'wsReceive': return 'WS_RECEIVE';
    case 'wsTrigger': return 'WS_TRIGGER';
    default: return String(tt).toUpperCase();
  }
}

function formatTransportErrorFallback(r: RequestResult): string {
  const tt = r.transportType ?? 'http';
  if (tt === 'http') return `HTTP ${r.httpStatus}`;
  return formatTransportLabel(r);
}

function formatRowError(r: RequestResult): string {
  if (r.errorMessage) return r.errorMessage;
  if (r.failureDetails.length > 0) return `${r.failureDetails.length} validation failure(s)`;
  return formatTransportErrorFallback(r);
}

function printDataRowConsole(results: RequestResult[], bar: string): void {
  const dataRowResults = results.filter(r => r.dataRowId);
  if (dataRowResults.length === 0) return;
  const failedRows = dataRowResults.filter(r => !r.passed);
  const passedRows = dataRowResults.filter(r => r.passed);
  console.log(`  Data Rows:    ${dataRowResults.length} total, ${passedRows.length} passed, ${failedRows.length} failed`);
  if (failedRows.length > 0) {
    console.log('');
    console.log('  Failed Data Rows:');
    for (const r of failedRows) {
      console.log(`    ✗ ${formatRowLabel(r)} — ${formatRowError(r)}`);
    }
  }
  console.log(bar);
}

function printStepMetricsConsole(stepStats: PerStepStats[], bar: string): void {
  console.log(bar);
  console.log('  Per-Step Metrics:');
  for (const s of stepStats) {
    const passRate = ((s.passed / s.count) * 100).toFixed(0);
    console.log(`    ${s.label}: avg=${s.avgMs}ms p95=${s.p95Ms}ms (${passRate}% pass)`);
  }
}

function printFailedItersConsole(failedIters: PerIterationStats[], iterations: number, bar: string): void {
  console.log(bar);
  console.log(`  Failed Iterations: ${failedIters.length}/${iterations}`);
  for (const i of failedIters.slice(0, 5)) {
    console.log(`    ✗ Iteration ${i.index + 1}: ${i.durationMs}ms, ${i.stepCount} steps`);
  }
  if (failedIters.length > 5) {
    console.log(`    ... and ${failedIters.length - 5} more`);
  }
}

function appendDataRowSummaryMd(lines: string[], results: RequestResult[]): void {
  const dataRowResults = results.filter(r => r.dataRowId);
  if (dataRowResults.length === 0) return;
  const failedRows = dataRowResults.filter(r => !r.passed);
  const passedCount = dataRowResults.length - failedRows.length;
  lines.push('## Data Row Summary');
  lines.push('');
  lines.push(`**${dataRowResults.length}** total rows — **${passedCount}** passed, **${failedRows.length}** failed`);
  lines.push('');
  if (failedRows.length === 0) return;
  lines.push('### Failed Rows');
  lines.push('');
  lines.push('| Row | Status | Error |');
  lines.push('|---|---|---|');
  for (const r of failedRows) {
    lines.push(`| ${formatRowLabel(r)} | ${(r.transportType ?? 'http') === 'http' ? r.httpStatus : formatTransportLabel(r)} | ${formatRowError(r)} |`);
  }
  lines.push('');
}

function appendStepMetricsMd(lines: string[], stepStats: PerStepStats[]): void {
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

function appendFailedItersMd(lines: string[], results: RequestResult[], iterations: number): void {
  const iterStats = computePerIterationStats(results, iterations);
  const failedIters = iterStats.filter(i => !i.passed);
  if (failedIters.length === 0) return;
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
  const p999 = summary.p999ResponseTime != null ? summary.p999ResponseTime : '—';
  console.log(`  P99.9:        ${p999} ms`);

  console.log(bar);
  console.log(`  Total Steps:  ${summary.totalRequests}`);
  console.log(`  Passed:       ${summary.successfulRequests}`);
  console.log(`  Failed:       ${summary.failedRequests + summary.failedValidations}`);
  console.log(`  Error Rate:   ${summary.errorRate}%`);

  if (results && results.length > 0) {
    printStepMetricsConsole(computePerStepStats(results), bar);

    const failedIters = computePerIterationStats(results, iterations).filter(i => !i.passed);
    if (failedIters.length > 0) printFailedItersConsole(failedIters, iterations, bar);
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
      const msg = failedSteps.map(r => {
        return `${r.scenarioName}: ${r.errorMessage || formatTransportErrorFallback(r)}`;
      }).join('; ');
      lines.push(`      <failure message="${escapeXml(msg)}" type="WorkflowIterationFailure">`);
      for (const r of failedSteps) {
        const tt = r.transportType ?? 'http';
        let stepDetail: string;
        if (tt === 'http') {
          stepDetail = `HTTP ${r.httpStatus} ${r.method} ${escapeXml(r.url)}`;
        } else if (tt === 'kafkaProduce' || tt === 'kafkaConsume') {
          stepDetail = `KAFKA ${r.method} ${escapeXml(r.kafkaResultMeta?.topic ?? (r.url || 'kafka'))}`;
        } else {
          stepDetail = `${formatTransportLabel(r)} ${escapeXml(r.wsResultMeta?.url ?? (r.url || 'ws'))}`;
        }
        lines.push(`  ${r.scenarioName}: ${stepDetail}`);
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
  const mdP999 = summary.p999ResponseTime != null ? summary.p999ResponseTime : '—';
  lines.push(`| **P99.9** | ${mdP999} ms |`);
  lines.push(`| **Error Rate** | ${summary.errorRate}% |`);
  lines.push(`| **Total Steps** | ${summary.totalRequests} |`);
  lines.push(`| **Duration** | ${(summary.totalDurationMs / 1000).toFixed(2)}s |`);
  lines.push('');

  if (results && results.length > 0) {
    appendStepMetricsMd(lines, computePerStepStats(results));
    appendFailedItersMd(lines, results, iterations);
  }

  const passed = summary.failedRequests === 0 && summary.failedValidations === 0;
  lines.push(`## Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  lines.push('');

  return lines.join('\n');
}

// ── Comparison / regression reporters ────────────────────────────────────────

const COL = 24; // left column width for console table

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

  // Header row
  console.log(
    `  ${pad('Metric', COL)}  ${pad('Baseline', 12)}  ${pad('Current', 12)}  ${pad('Δ', 10)}  Status`,
  );
  console.log(`  ${sep}`);

  for (const d of metricDeltas) {
    const isTime = d.metric !== 'TPS' && d.metric !== 'Error Rate';
    // valueUnit: unit for baseline/current display ('%' for Error Rate)
    const valueUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? '%' : '';
    // deltaUnit: Error Rate delta is absolute pp, not relative '%'
    const deltaUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? ' pp' : '';
    const deltaStr = `${sign(d.delta)}${d.delta}${deltaUnit} (${sign(d.deltaPercent)}${d.deltaPercent}%)`;

    // Attach severity from regressions list if available
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
      ? `> ⚠ **${regressCount} regression${regressCount > 1 ? 's' : ''} detected**` +
          (criticalCount > 0 ? ` (${criticalCount} critical)` : '')
      : '> ✅ **No regressions detected**',
    '',
    '## Metric Deltas',
    '',
    '| Metric | Baseline | Current | Delta | Change | Status |',
    '|:---|---:|---:|---:|---:|:---|',
  ];

  for (const d of metricDeltas) {
    const isTime = d.metric !== 'TPS' && d.metric !== 'Error Rate';
    // valueUnit: unit for baseline/current columns ('%' for Error Rate)
    const valueUnit = isTime ? ' ms' : d.metric === 'Error Rate' ? '%' : '';
    // deltaUnit: Error Rate delta is absolute pp — '%' would be misleading
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
      // TPS regression = a drop — show '-actual%' so the sign matches the direction of change.
      // All other metrics regress upward, so '+actual' is correct.
      const actualSign = r.metric === 'TPS' ? '-' : '+';
      lines.push(
        `| ${r.metric} | ${r.severity === 'critical' ? '🔴 Critical' : '🟡 Warning'} | ${r.threshold}${unit} | ${actualSign}${r.actual}${unit} |`,
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}
