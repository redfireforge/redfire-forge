import type { TestRun, RequestResult } from '../types';
import { saveJsonFile, saveCsvFile } from './fileSaver';

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function exportJson(run: TestRun): void {
  saveJsonFile(run, `perf-test-${formatTimestamp(run.timestamp)}.json`);
}

export function exportCsv(results: RequestResult[]): void {
  const headers = [
    'Scenario',
    'URL',
    'Method',
    'HTTP Status',
    'Response Time (ms)',
    'Validation',
    'Passed',
    'Failure Path',
    'Expected',
    'Actual',
    'Error Message',
    'Timestamp',
  ];

  const rows = results.flatMap((r) => {
    if (r.failureDetails.length === 0) {
      return [[
        r.scenarioName,
        r.url,
        r.method,
        String(r.httpStatus),
        String(r.responseTimeMs),
        r.validationMode ?? 'none',
        String(r.passed),
        '',
        '',
        '',
        r.errorMessage ?? '',
        new Date(r.timestamp).toISOString(),
      ]];
    }
    return r.failureDetails.map((f) => [
      r.scenarioName,
      r.url,
      r.method,
      String(r.httpStatus),
      String(r.responseTimeMs),
      r.validationMode ?? 'none',
      String(r.passed),
      f.path,
      f.expected,
      f.actual,
      r.errorMessage ?? '',
      new Date(r.timestamp).toISOString(),
    ]);
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');

  saveCsvFile(csvContent, `perf-test-failures-${formatTimestamp(Date.now())}.csv`);
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
