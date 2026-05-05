import type { TestRun, RequestResult } from '../types';
import { saveJsonFile, saveCsvFile, buildExportFilename } from './fileSaver';

export function exportJson(run: TestRun): void {
  const date = new Date(run.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = buildExportFilename({ env: run.envName, svc: run.svcName, level: 'results', date });
  saveJsonFile(run, filename);
}

export function exportCsv(results: RequestResult[], envName?: string, svcName?: string): void {
  const headers = [
    'Scenario',
    'Data Row ID',
    'Data Row Label',
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
        r.dataRowId ?? '',
        r.dataRowLabel ?? '',
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
      r.dataRowId ?? '',
      r.dataRowLabel ?? '',
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

  const filename = buildExportFilename({ env: envName, svc: svcName, level: 'failures', ext: 'csv' });
  saveCsvFile(csvContent, filename);
}

export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
