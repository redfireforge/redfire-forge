/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateReport, downloadReport } from './reportGenerator';
import type { TestRun, RequestResult } from '../../../shared/types';

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: '1',
    scenarioId: 's1',
    scenarioName: 'test-scenario',
    featureGroupName: 'Feature A',
    groupName: 'Group 1',
    url: 'http://example.com',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 100,
    responseBody: '{}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

function makeRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      concurrency: 5,
      totalTransactions: 10,
      executionMode: 'batch',
      scenarioWeights: [],
    },
    summary: {
      tps: 10,
      avgResponseTime: 100,
      minResponseTime: 50,
      maxResponseTime: 200,
      p50ResponseTime: 95,
      p95ResponseTime: 190,
      p99ResponseTime: 198,
      errorRate: 10,
      errorsByStatus: {},
      totalRequests: 10,
      successfulRequests: 9,
      failedRequests: 1,
      failedValidations: 0,
      totalDurationMs: 1000,
    },
    results: [
      makeResult({ id: 'r1', passed: true }),
      makeResult({ id: 'r2', passed: false, httpStatus: 500, errorMessage: 'Internal Server Error' }),
    ],
    ...overrides,
  };
}

describe('generateReport', () => {
  describe('HTML format', () => {
    it('generates valid HTML with summary stats', () => {
      const html = generateReport(makeRun(), { format: 'html' });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('RedfireForge');
      expect(html).toContain('10'); // TPS
      expect(html).toContain('Internal Server Error');
    });

    it('includes data row labels for parameterized results', () => {
      const run = makeRun({
        results: [
          makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1: VIN=ABC', passed: false, httpStatus: 404, errorMessage: 'Not Found' }),
          makeResult({ dataRowId: 'r2', dataRowLabel: 'Row 2: VIN=DEF', passed: true }),
        ],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain('Row 1: VIN=ABC');
      expect(html).toContain('Parameterized');
    });

    it('escapes HTML in scenario names', () => {
      const run = makeRun({
        results: [makeResult({ scenarioName: '<script>alert("xss")</script>', passed: false, errorMessage: 'err' })],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('JSON format', () => {
    it('generates valid JSON with summary', () => {
      const json = generateReport(makeRun(), { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.summary.tps).toBe(10);
      expect(parsed.results.length).toBe(2);
    });

    it('includes parameterized section for data row results', () => {
      const run = makeRun({
        results: [
          makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1', passed: false, errorMessage: 'err' }),
          makeResult({ dataRowId: 'r2', dataRowLabel: 'Row 2', passed: true }),
        ],
      });
      const json = generateReport(run, { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.parameterized.totalRows).toBe(2);
      expect(parsed.parameterized.failedRows).toBe(1);
      expect(parsed.parameterized.failedRowDetails[0].label).toBe('Row 1');
    });

    it('strips response bodies by default', () => {
      const json = generateReport(makeRun(), { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.results[0]).not.toHaveProperty('responseBody');
    });

    it('includes response bodies when requested', () => {
      const json = generateReport(makeRun(), { format: 'json', includeResponseBodies: true });
      const parsed = JSON.parse(json);
      expect(parsed.results[0].responseBody).toBe('{}');
    });

    it('builds failed row error string from failureDetails when errorMessage is absent', () => {
      const run = makeRun({
        results: [
          makeResult({
            dataRowId: 'r1',
            dataRowLabel: 'Row A',
            passed: false,
            httpStatus: 422,
            errorMessage: undefined,
            failureDetails: [{ path: '$.id', expected: '1', actual: '2' }],
          }),
        ],
      });
      const json = generateReport(run, { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.parameterized.failedRowDetails[0].error).toContain('$.id');
      expect(parsed.parameterized.failedRowDetails[0].error).toContain('expected 1');
    });
  });

  describe('Markdown format', () => {
    it('generates markdown with summary table', () => {
      const md = generateReport(makeRun(), { format: 'markdown' });
      expect(md).toContain('# ');
      expect(md).toContain('| TPS | 10 |');
      expect(md).toContain('## Failed');
    });

    it('shows no failed section when all pass', () => {
      const run = makeRun({
        results: [makeResult({ passed: true })],
        summary: { ...makeRun().summary, failedRequests: 0 },
      });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).not.toContain('## Failed');
    });

    it('uses failureDetails in markdown when errorMessage is missing', () => {
      const run = makeRun({
        results: [
          makeResult({
            passed: false,
            errorMessage: undefined,
            failureDetails: [{ path: 'a', expected: 'x', actual: 'y' }],
          }),
        ],
      });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain('a: expected x, got y');
    });

    it('includes environment and service name in markdown', () => {
      const run = makeRun({
        envName: 'Production',
        svcName: 'payment-api',
      });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain('**Environment:** Production / payment-api');
    });

    it('shows only environment when svcName is missing', () => {
      const run = makeRun({
        envName: 'Staging',
        svcName: undefined,
      });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain('**Environment:** Staging');
    });

    it('uses custom title when provided', () => {
      const run = makeRun();
      const md = generateReport(run, { format: 'markdown', title: 'My Custom Report' });
      expect(md).toContain('# My Custom Report');
    });

    it('uses project name in default title', () => {
      const run = makeRun({ projectName: 'Payment API' });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain('# Payment API Report');
    });

    it('shows P50 as dash when undefined', () => {
      const run = makeRun();
      run.summary.p50ResponseTime = undefined;
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain('| P50 | —ms |');
    });

    it('shows dataRowLabel for failed rows when present', () => {
      const run = makeRun({
        results: [
          makeResult({
            passed: false,
            httpStatus: 404,
            dataRowLabel: 'Row 5: VIN=12345',
            errorMessage: 'Not Found',
          }),
        ],
      });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain('Row 5: VIN=12345');
    });

    it('uses ERR for failed results with httpStatus 0', () => {
      const run = makeRun({
        results: [
          makeResult({
            passed: false,
            httpStatus: 0,
            errorMessage: 'Connection refused',
          }),
        ],
      });
      const md = generateReport(run, { format: 'markdown' });
      // httpStatus 0 shows as 'ERR' via: r.httpStatus || 'ERR'
      expect(md).toContain('| ERR |');
      expect(md).toContain('Connection refused');
    });
  });
});

describe('downloadReport', () => {
  const origCreate = document.createElement.bind(document);

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates blob URL, clicks anchor, and revokes URL', () => {
    let capturedAnchor: HTMLAnchorElement | null = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        capturedAnchor = origCreate('a') as HTMLAnchorElement;
        vi.spyOn(capturedAnchor, 'click').mockImplementation(() => {});
        return capturedAnchor;
      }
      return origCreate(tag);
    });

    downloadReport('body', 'report.html', 'text/html');

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(capturedAnchor!.download).toBe('report.html');
    expect(capturedAnchor!.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });
});
