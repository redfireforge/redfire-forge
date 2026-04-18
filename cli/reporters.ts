import type { RequestResult, TestSummary, TestConfig, TestRun } from '../src/types';

// ── JSON report ─────────────────────────────────────────────

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
    lines.push(`    <testcase classname="${escapeXml(className)}" name="${escapeXml(r.scenarioName)} [${r.method} ${escapeXml(r.url)}]" time="${time}">`);
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

// ── Markdown report ─────────────────────────────────────────

export function buildMarkdownReport(
  summary: TestSummary,
  config: TestConfig,
  meta: { name?: string; env?: string; file?: string },
): string {
  const lines: string[] = [];
  const title = meta.name || meta.file || 'RedfireForge Test Run';
  lines.push(`# ${title}`);
  lines.push('');
  if (meta.env) lines.push(`**Environment:** ${meta.env}  `);
  lines.push(`**Date:** ${new Date().toISOString()}  `);
  lines.push(`**Mode:** ${config.executionMode} | Concurrency: ${config.concurrency} | Transactions: ${config.totalTransactions}  `);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| **TPS** | ${summary.tps} |`);
  lines.push(`| **Avg Response** | ${summary.avgResponseTime} ms |`);
  lines.push(`| **Min / Max** | ${summary.minResponseTime} ms / ${summary.maxResponseTime} ms |`);
  lines.push(`| **P95** | ${summary.p95ResponseTime} ms |`);
  lines.push(`| **P99** | ${summary.p99ResponseTime} ms |`);
  lines.push(`| **Error Rate** | ${summary.errorRate}% |`);
  lines.push(`| **Total Requests** | ${summary.totalRequests} |`);
  lines.push(`| **Successful** | ${summary.successfulRequests} |`);
  lines.push(`| **Failed (HTTP)** | ${summary.failedRequests} |`);
  lines.push(`| **Failed (Validation)** | ${summary.failedValidations} |`);
  lines.push(`| **Duration** | ${(summary.totalDurationMs / 1000).toFixed(2)}s |`);
  lines.push('');

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

  return lines.join('\n');
}

// ── Console summary (printed to terminal) ───────────────────

export function printConsoleSummary(summary: TestSummary, config: TestConfig): void {
  const passed = summary.failedRequests === 0 && summary.failedValidations === 0;
  const bar = '─'.repeat(50);

  console.log('');
  console.log(bar);
  console.log('  RedfireForge — Test Run Summary');
  console.log(bar);
  console.log(`  Mode:         ${config.executionMode} (C:${config.concurrency} T:${config.totalTransactions})`);
  console.log(`  Duration:     ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`  TPS:          ${summary.tps}`);
  console.log(`  Avg Response: ${summary.avgResponseTime} ms`);
  console.log(`  P95:          ${summary.p95ResponseTime} ms`);
  console.log(`  P99:          ${summary.p99ResponseTime} ms`);
  console.log(`  Min / Max:    ${summary.minResponseTime} ms / ${summary.maxResponseTime} ms`);
  console.log(bar);
  console.log(`  Total:        ${summary.totalRequests}`);
  console.log(`  Passed:       ${summary.successfulRequests}`);
  console.log(`  Failed HTTP:  ${summary.failedRequests}`);
  console.log(`  Failed Valid: ${summary.failedValidations}`);
  console.log(`  Error Rate:   ${summary.errorRate}%`);
  console.log(bar);
  console.log(`  Result:       ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(bar);
  console.log('');
}
