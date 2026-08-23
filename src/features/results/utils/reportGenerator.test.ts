/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateReport, downloadReport, type ReportOptions } from './reportGenerator';
import { TestRun, RequestResult } from '@shared/types';
import { makeResult as _makeResult } from '@test-utils/factories';

function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return _makeResult({
    id: '1',
    scenarioName: 'test-scenario',
    featureGroupName: 'Feature A',
    groupName: 'Group 1',
    url: 'http://example.com',
    ...overrides,
  });
}

function makeRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      concurrency: 5,
      iterations: 10,
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

function makeGrpcHarnessSecretRun(secret = 'grpc-report-secret-token-value'): TestRun {
  return makeRun({
    results: [
      makeResult({
        transportType: 'grpcCall',
        passed: false,
        errorMessage: `assertions[0]: got Bearer ${secret}`,
        responseHeaders: { authorization: `Bearer ${secret}` },
        grpcResultMeta: {
          service: 'echo.EchoService',
          method: 'Echo',
          target: 'localhost:50051',
          harnessResult: {
            schemaVersion: '1.0',
            scenarioId: 'sc-1',
            callType: 'unary',
            status: 'failed',
            durationMs: 5,
            assertionResults: [{
              name: 'grpcTrailer:authorization',
              passed: false,
              message: `assertions[0]: got Bearer ${secret}`,
            }],
            trailers: { authorization: `Bearer ${secret}` },
            errorCategory: 'assertion',
            errorDetail: `assertions[0]: got Bearer ${secret}`,
          },
        },
      }),
    ],
  });
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

    it('uses P50 dash and omits failed section when all requests pass', () => {
      const run = makeRun({
        results: [makeResult({ id: 'r1', passed: true })],
        summary: { ...makeRun().summary, failedRequests: 0, successfulRequests: 10, p50ResponseTime: undefined },
      });
      const html = generateReport(run, { format: 'html', includePassedRows: true });
      expect(html).toContain('>—ms</div>');
      expect(html).not.toContain('section-header fail');
      expect(html).toContain('section-header pass');
    });

    it('omits passed rows section when includePassedRows is false', () => {
      const run = makeRun({
        results: [makeResult({ passed: true }), makeResult({ id: 'r2', passed: true })],
      });
      const html = generateReport(run, { format: 'html', includePassedRows: false });
      expect(html).not.toContain('section-header pass');
    });

    it('omits passed section when includePassedRows is true but none passed', () => {
      const run = makeRun({
        results: [makeResult({ passed: false, errorMessage: 'x' })],
      });
      const html = generateReport(run, { format: 'html', includePassedRows: true });
      expect(html).toContain('section-header fail');
      expect(html).not.toContain('section-header pass');
    });

    it('uses default Test title and batch mode when project name and executionMode are absent', () => {
      const base = makeRun();
      const run = {
        ...base,
        projectName: undefined,
        config: { ...base.config, executionMode: undefined },
      } as TestRun;
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain('>Test Report</h1>');
      expect(html).toContain('Mode: batch');
    });

    it('uses custom HTML title and omits env meta when env and service are absent', () => {
      const run = makeRun({ envName: undefined, svcName: undefined });
      const html = generateReport(run, { format: 'html', title: 'Custom HTML Title' });
      expect(html).toContain('>Custom HTML Title</h1>');
      expect(html).not.toContain('Environment:');
    });

    it('shows only environment in meta when svcName is missing', () => {
      const run = makeRun({ envName: 'QA', svcName: undefined });
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain('Environment: QA');
      expect(html).not.toContain('QA / ');
    });

    it('shows leading service path in meta when only svcName is set', () => {
      const run = makeRun({ envName: undefined, svcName: 'api-only' });
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain(' / api-only');
      expect(html).not.toContain('Environment:');
    });

    it('does not show Parameterized line when no data rows exist', () => {
      const run = makeRun({
        results: [makeResult({ passed: true, dataRowId: undefined, dataRowLabel: undefined })],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).not.toContain('Parameterized');
    });

    it('uses scenarioName and ERR for failed row when label is absent and httpStatus is falsy', () => {
      const run = makeRun({
        results: [
          makeResult({
            passed: false,
            scenarioName: 'fallback-scenario',
            dataRowLabel: undefined,
            httpStatus: 0,
            errorMessage: undefined,
            failureDetails: [],
          }),
        ],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain('fallback-scenario');
      expect(html).toContain('>ERR</td>');
    });

    it('builds failed row error cell from failureDetails when errorMessage is absent', () => {
      const run = makeRun({
        results: [
          makeResult({
            passed: false,
            errorMessage: undefined,
            failureDetails: [{ path: '$.x', expected: 'a', actual: 'b' }],
          }),
        ],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain('$.x: expected a, got b');
    });

    it('uses switch default to produce HTML for an unknown format value at runtime', () => {
      const html = generateReport(makeRun(), { format: 'xml' } as unknown as Partial<ReportOptions>);
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('excludes cancelled results from stats and failed rows', () => {
      const run = makeRun({
        results: [
          makeResult({ id: 'r1', passed: true }),
          makeResult({ id: 'r2', passed: false, cancelled: true, errorMessage: 'Cancelled' }),
          makeResult({ id: 'r3', passed: false, httpStatus: 500, errorMessage: 'Server Error' }),
        ],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain('Server Error');
      expect(html).not.toContain('Cancelled');
    });

    it('excludes cancelled results from parameterized data row count', () => {
      const run = makeRun({
        results: [
          makeResult({ dataRowId: 'r1', dataRowLabel: 'Row 1', passed: true }),
          makeResult({ dataRowId: 'r2', dataRowLabel: 'Row 2', passed: false, cancelled: true }),
        ],
      });
      const html = generateReport(run, { format: 'html' });
      expect(html).toContain('1 data rows');
    });

    it('redacts gRPC harness secrets in HTML export', () => {
      const secret = 'grpc-html-report-secret-token';
      const html = generateReport(makeGrpcHarnessSecretRun(secret), { format: 'html' });
      expect(html).not.toContain(secret);
      expect(html).toContain('Bearer [REDACTED]');
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

    it('redacts gRPC harness secrets in JSON export', () => {
      const secret = 'grpc-report-secret-token-value';
      const json = generateReport(makeGrpcHarnessSecretRun(secret), {
        format: 'json',
        includeResponseBodies: true,
      });
      expect(json).not.toContain(secret);
      expect(json).toContain('Bearer [REDACTED]');
    });

    it('does not break HTTP-only reports when error text resembles a bearer token', () => {
      const secret = 'http-error-bearer-token-abcdef123456';
      const run = makeRun({
        results: [
          makeResult({
            passed: false,
            errorMessage: `Upstream rejected Bearer ${secret}`,
          }),
        ],
      });
      expect(() => generateReport(run, { format: 'json' })).not.toThrow();
      expect(generateReport(run, { format: 'json' })).toContain(secret);
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

    it('sets summary passRate to 0 when totalRequests is 0', () => {
      const run = makeRun({
        results: [],
        summary: { ...makeRun().summary, totalRequests: 0, successfulRequests: 0 },
      });
      const json = generateReport(run, { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.summary.passRate).toBe(0);
    });

    it('omits parameterized block when no data rows exist', () => {
      const run = makeRun({
        results: [makeResult({ dataRowId: undefined })],
      });
      const json = generateReport(run, { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.parameterized).toBeUndefined();
    });

    it('excludes cancelled results from JSON report', () => {
      const run = makeRun({
        results: [
          makeResult({ id: 'r1', passed: true }),
          makeResult({ id: 'r2', passed: false, cancelled: true, errorMessage: 'Cancelled' }),
        ],
      });
      const json = generateReport(run, { format: 'json' });
      const parsed = JSON.parse(json);
      expect(parsed.results).toHaveLength(1);
      expect(parsed.results[0].id).toBe('r1');
    });
  });

  describe('Markdown format', () => {
    it('generates markdown with summary table', () => {
      const md = generateReport(makeRun(), { format: 'markdown' });
      expect(md).toContain('# ');
      expect(md).toContain('| TPS | 10 |');
      expect(md).toContain('## Failed');
    });

    it('redacts gRPC harness secrets in markdown export', () => {
      const secret = 'grpc-md-report-secret-token';
      const md = generateReport(makeGrpcHarnessSecretRun(secret), { format: 'markdown' });
      expect(md).not.toContain(secret);
      expect(md).toContain('Bearer [REDACTED]');
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

    it('uses batch when executionMode is undefined', () => {
      const base = makeRun();
      const run = {
        ...base,
        config: { ...base.config, executionMode: undefined },
      } as TestRun;
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain('**Mode:** batch');
    });

    it('shows service path in meta when only svcName is set', () => {
      const run = makeRun({ envName: undefined, svcName: 'api-only' });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain(' / api-only');
    });

    it('computes zeroed row stats when results are empty', () => {
      const run = makeRun({
        results: [],
        summary: { ...makeRun().summary, totalRequests: 0 },
      });
      const md = generateReport(run, { format: 'markdown' });
      expect(md).toContain('| Pass Rate | 0% (0/0) |');
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

describe('Kafka results rendering', () => {
  it('HTML report shows PRODUCE label for Kafka produce failures', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'KAFKA',
          transportType: 'kafkaProduce',
          httpStatus: 0,
          errorMessage: 'Broker unreachable',
          kafkaResultMeta: { topic: 'orders', partition: 0, offset: 0 },
        }),
      ],
    });
    const html = generateReport(run, { format: 'html' });

    expect(html).toContain('PRODUCE');
    expect(html).not.toContain('<td>0</td>'); // status cell should not show raw httpStatus
  });

  it('HTML report shows CONSUME label for Kafka consume failures', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'KAFKA',
          transportType: 'kafkaConsume',
          httpStatus: 0,
          errorMessage: 'No messages received',
          kafkaResultMeta: { topic: 'events', partition: 0, offset: 0 },
        }),
      ],
    });
    const html = generateReport(run, { format: 'html' });

    expect(html).toContain('CONSUME');
    expect(html).not.toContain('<td>0</td>'); // status cell should not show raw httpStatus
  });

  it('Markdown report shows PRODUCE label for Kafka produce failures', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'KAFKA',
          transportType: 'kafkaProduce',
          httpStatus: 0,
          errorMessage: 'Broker unreachable',
          kafkaResultMeta: { topic: 'orders', partition: 0, offset: 0 },
        }),
      ],
    });
    const md = generateReport(run, { format: 'markdown' });

    expect(md).toContain('| PRODUCE |');
    expect(md).not.toContain('| 0 |');
  });

  it('Markdown report shows CONSUME label for Kafka consume failures', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'KAFKA',
          transportType: 'kafkaConsume',
          httpStatus: 0,
          errorMessage: 'No messages received',
          kafkaResultMeta: { topic: 'events', partition: 0, offset: 0 },
        }),
      ],
    });
    const md = generateReport(run, { format: 'markdown' });

    expect(md).toContain('| CONSUME |');
    expect(md).not.toContain('| 0 |');
  });

  it('HTML passed-rows section shows PRODUCE label for passed Kafka produce results', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: true,
          method: 'KAFKA',
          transportType: 'kafkaProduce',
          httpStatus: 200,
          kafkaResultMeta: { topic: 'orders', partition: 0, offset: 5 },
        }),
      ],
    });
    const html = generateReport(run, { format: 'html', includePassedRows: true });

    expect(html).toContain('PRODUCE');
    // Raw numeric status 200 must NOT appear in a status cell for Kafka
    expect(html).not.toContain('<td>200</td>');
  });
});

describe('WebSocket results rendering', () => {
  it('HTML report shows CONNECT label for WS connect failures', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'WEBSOCKET',
          transportType: 'wsConnect',
          httpStatus: 0,
          errorMessage: 'Connection timeout',
        }),
      ],
    });
    const html = generateReport(run, { format: 'html' });
    expect(html).toContain('CONNECT');
    expect(html).toContain('Connection timeout');
  });

  it('HTML report shows SEND label for WS send failures', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'WEBSOCKET',
          transportType: 'wsSend',
          httpStatus: 0,
          errorMessage: 'Send failed',
        }),
      ],
    });
    const html = generateReport(run, { format: 'html' });
    expect(html).toContain('SEND');
  });

  it('HTML report shows RECEIVE label for WS receive failures', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'WEBSOCKET',
          transportType: 'wsReceive',
          httpStatus: 0,
          errorMessage: 'Receive timeout',
        }),
      ],
    });
    const html = generateReport(run, { format: 'html' });
    expect(html).toContain('RECEIVE');
  });

  it('Markdown report shows WS labels', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'WEBSOCKET',
          transportType: 'wsConnect',
          httpStatus: 0,
          errorMessage: 'Refused',
        }),
      ],
    });
    const md = generateReport(run, { format: 'markdown' });
    expect(md).toContain('| CONNECT |');
    expect(md).not.toContain('| 0 |');
  });

  it('HTML passed-rows section shows CONNECT label for passed WS results', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: true,
          method: 'WEBSOCKET',
          transportType: 'wsConnect',
          httpStatus: 0,
        }),
      ],
    });
    const html = generateReport(run, { format: 'html', includePassedRows: true });
    expect(html).toContain('CONNECT');
  });
});

describe('JSON report transport fields', () => {
  it('includes transportType and transportStatus in failedRowDetails', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'WEBSOCKET',
          transportType: 'wsConnect',
          httpStatus: 0,
          dataRowId: 'row-1',
          dataRowLabel: 'Row 1',
          errorMessage: 'Connection refused',
        }),
      ],
    });
    const json = generateReport(run, { format: 'json' });
    const report = JSON.parse(json);
    const detail = report.parameterized.failedRowDetails[0];
    expect(detail.transportType).toBe('wsConnect');
    expect(detail.transportStatus).toBe('CONNECT');
    expect(detail.httpStatus).toBe(0);
  });

  it('includes transportType for Kafka in failedRowDetails', () => {
    const run = makeRun({
      results: [
        makeResult({
          passed: false,
          method: 'KAFKA',
          transportType: 'kafkaProduce',
          httpStatus: 0,
          dataRowId: 'row-2',
          dataRowLabel: 'Row 2',
          errorMessage: 'Produce failed',
        }),
      ],
    });
    const json = generateReport(run, { format: 'json' });
    const report = JSON.parse(json);
    const detail = report.parameterized.failedRowDetails[0];
    expect(detail.transportType).toBe('kafkaProduce');
    expect(detail.transportStatus).toBe('PRODUCE');
  });
});
