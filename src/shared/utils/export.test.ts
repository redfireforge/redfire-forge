/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { escapeCsv, exportCsv, exportJson } from './export';
import type { TestRun, RequestResult } from '../types';
import * as fileSaver from './fileSaver';

vi.mock('./fileSaver', () => ({
  saveJsonFile: vi.fn(),
  saveCsvFile: vi.fn(),
  buildExportFilename: vi.fn(({ level, ext }: { level: string; ext?: string }) => `test-${level}.${ext ?? 'json'}`),
}));

describe('escapeCsv', () => {
  it('returns value as-is when no special characters', () => {
    expect(escapeCsv('hello')).toBe('hello');
  });

  it('wraps value with quotes when it contains a comma', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
  });

  it('wraps value with quotes when it contains a newline', () => {
    expect(escapeCsv('a\nb')).toBe('"a\nb"');
  });

  it('escapes internal double quotes', () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });

  it('handles combined special characters', () => {
    expect(escapeCsv('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it('returns empty string as-is', () => {
    expect(escapeCsv('')).toBe('');
  });

  it('handles null value', () => {
    expect(escapeCsv(null)).toBe('');
  });

  it('handles undefined value', () => {
    expect(escapeCsv(undefined)).toBe('');
  });
});

describe('exportJson', () => {
  it('calls saveJsonFile with correct filename', () => {
    const run = {
      id: '1', envName: 'dev', svcName: 'api', timestamp: Date.now(),
      results: [], totalRequests: 0, passedRequests: 0, failedRequests: 0,
      avgResponseTime: 0, scenarios: [], config: {} as TestRun['config'],
    };
    exportJson(run as TestRun);
    expect(fileSaver.saveJsonFile).toHaveBeenCalledWith(run, expect.stringContaining('test-'));
  });

  it('redacts gRPC harness secrets before JSON file export', () => {
    const secret = 'grpc-export-json-secret-token';
    const run = {
      id: '1',
      envName: 'dev',
      svcName: 'api',
      timestamp: Date.now(),
      results: [{
        id: 'r1',
        scenarioId: 'sc-1',
        scenarioName: 'Echo',
        url: 'grpc://localhost:50051/svc/m',
        method: 'UNARY',
        httpStatus: 200,
        responseTimeMs: 5,
        responseBody: '{}',
        responseHeaders: { authorization: `Bearer ${secret}` },
        timestamp: Date.now(),
        passed: false,
        validationMode: 'none',
        failureDetails: [],
        errorMessage: `got Bearer ${secret}`,
        transportType: 'grpcCall',
        grpcResultMeta: {
          service: 'svc',
          method: 'm',
          target: 'localhost:50051',
          harnessResult: {
            schemaVersion: '1.0',
            scenarioId: 'sc-1',
            callType: 'unary',
            status: 'failed',
            durationMs: 5,
            assertionResults: [],
            trailers: { authorization: `Bearer ${secret}` },
            errorDetail: `got Bearer ${secret}`,
          },
        },
      } satisfies RequestResult],
      summary: {
        tps: 1,
        avgResponseTime: 5,
        minResponseTime: 5,
        maxResponseTime: 5,
        p95ResponseTime: 5,
        p99ResponseTime: 5,
        errorRate: 100,
        errorsByStatus: {},
        totalRequests: 1,
        successfulRequests: 0,
        failedRequests: 1,
        failedValidations: 0,
        totalDurationMs: 5,
      },
      config: { concurrency: 1, iterations: 1, executionMode: 'batch', scenarioWeights: [] },
    } satisfies TestRun;
    exportJson(run);
    const saved = vi.mocked(fileSaver.saveJsonFile).mock.calls.at(-1)?.[0] as TestRun;
    expect(JSON.stringify(saved)).not.toContain(secret);
    expect(JSON.stringify(saved)).toContain('Bearer [REDACTED]');
  });

  it('builds a results filename even when env and service are absent', () => {
    const run = {
      id: '2', envName: undefined, svcName: undefined, timestamp: Date.now(),
      results: [], totalRequests: 0, passedRequests: 0, failedRequests: 0,
      avgResponseTime: 0, scenarios: [], config: {} as TestRun['config'],
    };
    exportJson(run as TestRun);
    expect(fileSaver.saveJsonFile).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('test-results'));
  });
});

describe('exportCsv', () => {
  it('generates CSV with headers for empty results', () => {
    exportCsv([], 'dev', 'svc');
    expect(fileSaver.saveCsvFile).toHaveBeenCalledWith(
      expect.stringContaining('Scenario,Data Row ID,Data Row Label,URL,Method'),
      expect.any(String),
    );
  });

  it('creates row for result with no failures', () => {
    const result = {
      scenarioName: 'test', url: 'http://a.com', method: 'GET',
      httpStatus: 200, responseTimeMs: 50, validationMode: 'status',
      passed: true, failureDetails: [], errorMessage: null,
      timestamp: Date.now(),
    };
    exportCsv([result as RequestResult]);
    const call = vi.mocked(fileSaver.saveCsvFile).mock.calls.at(-1);
    expect(call[0]).toContain('test');
    expect(call[0]).toContain('200');
    expect(call[0]).toContain('true');
  });

  it('uses validation mode none when validationMode is missing on success row', () => {
    const result = {
      scenarioName: 'no-mode', url: 'http://a.com', method: 'GET',
      httpStatus: 204, responseTimeMs: 10,
      passed: true, failureDetails: [], errorMessage: undefined,
      timestamp: Date.now(),
    };
    exportCsv([result as RequestResult]);
    const csv: string = vi.mocked(fileSaver.saveCsvFile).mock.calls.at(-1)[0];
    const dataLine = csv.split('\n')[1] ?? '';
    expect(dataLine).toMatch(/(^|,)none(,|$)/);
  });

  it('creates rows for each failure detail', () => {
    const result = {
      scenarioName: 'test', url: 'http://a.com', method: 'POST',
      httpStatus: 500, responseTimeMs: 100, validationMode: 'json',
      passed: false, timestamp: Date.now(), errorMessage: 'oops',
      failureDetails: [
        { path: '$.a', expected: '1', actual: '2' },
        { path: '$.b', expected: 'x', actual: 'y' },
      ],
    };
    exportCsv([result as RequestResult]);
    const csv: string = vi.mocked(fileSaver.saveCsvFile).mock.calls.at(-1)[0];
    const lines = csv.split('\n');
    expect(lines.length).toBe(3); // header + 2 failure rows
  });

  it('maps failure path, expected, and actual into CSV columns', () => {
    const result = {
      scenarioName: 'f1', url: 'http://x', method: 'GET',
      httpStatus: 422, responseTimeMs: 5,
      passed: false, timestamp: Date.now(), errorMessage: 'bad',
      failureDetails: [{ path: '$.code', expected: '0', actual: '9' }],
    };
    exportCsv([result as RequestResult]);
    const csv: string = vi.mocked(fileSaver.saveCsvFile).mock.calls.at(-1)[0];
    expect(csv).toContain('$.code');
    expect(csv).toContain(',0,');
    expect(csv).toContain(',9,');
  });

  it('defaults validation mode to none on failure rows when absent', () => {
    const result = {
      scenarioName: 'f2', url: 'http://y', method: 'PUT',
      httpStatus: 400, responseTimeMs: 3,
      passed: false, timestamp: Date.now(),
      failureDetails: [{ path: 'p', expected: 'e', actual: 'a' }],
    };
    exportCsv([result as RequestResult]);
    const csv: string = vi.mocked(fileSaver.saveCsvFile).mock.calls.at(-1)[0];
    const cols = (csv.split('\n')[1] ?? '').split(',');
    const validationCol = cols[7]; // shifted by 2: Data Row ID + Data Row Label
    expect(validationCol).toBe('none');
  });

  it('exports empty optional failure fields as blank CSV columns', () => {
    const result = {
      scenarioName: 'blank-optional', url: 'http://x', method: 'GET',
      httpStatus: 400, responseTimeMs: 1,
      passed: false, timestamp: Date.now(), errorMessage: undefined,
      failureDetails: [{ path: undefined, expected: undefined, actual: undefined }],
    };
    exportCsv([result as RequestResult]);
    const csv: string = vi.mocked(fileSaver.saveCsvFile).mock.calls.at(-1)![0];
    expect(csv).toContain('blank-optional');
  });

  it('redacts gRPC harness secrets in CSV export', () => {
    const secret = 'grpc-export-csv-secret-token';
    const result = {
      scenarioName: 'grpc-echo',
      url: 'grpc://localhost:50051/svc/m',
      method: 'UNARY',
      httpStatus: 200,
      responseTimeMs: 5,
      passed: false,
      timestamp: Date.now(),
      errorMessage: `assertions[0]: got Bearer ${secret}`,
      failureDetails: [{ path: '(grpcAssertion)', expected: 'ok', actual: `Bearer ${secret}` }],
      transportType: 'grpcCall',
      grpcResultMeta: {
        service: 'svc',
        method: 'm',
        target: 'localhost:50051',
      },
    } satisfies RequestResult;
    exportCsv([result]);
    const csv: string = vi.mocked(fileSaver.saveCsvFile).mock.calls.at(-1)[0];
    expect(csv).not.toContain(secret);
    expect(csv).toContain('Bearer [REDACTED]');
  });
});
