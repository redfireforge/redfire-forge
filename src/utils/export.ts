import type { TestRun, RequestResult } from '../types';

export function exportJson(run: TestRun): void {
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `perf-test-${formatTimestamp(run.timestamp)}.json`);
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

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `perf-test-failures-${formatTimestamp(Date.now())}.csv`);
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
