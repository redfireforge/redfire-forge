import { describe, it, expect } from 'vitest';
import { summarizeRequestFailure, formatHttpNodeRunDetail, buildQuickTestFailureReport, filterQuickTestVariableSnapshot, isExecutableWorkflowNodeType } from './workflowRunErrors';
import { RequestResult } from '../../../shared/types';

function baseResult(over: Partial<RequestResult> = {}): RequestResult {
  return {
    id: '1', scenarioId: 's', scenarioName: 't', url: 'https://x',
    method: 'GET', httpStatus: 200, responseTimeMs: 42, responseBody: '',
    timestamp: 0, passed: false, validationMode: 'none', failureDetails: [],
    ...over,
  };
}

describe('summarizeRequestFailure', () => {
  it('prefers errorMessage', () => {
    expect(summarizeRequestFailure(baseResult({ errorMessage: 'Connection refused' }))).toBe('Connection refused');
  });

  it('trims whitespace from errorMessage', () => {
    expect(summarizeRequestFailure(baseResult({ errorMessage: '  timeout  ' }))).toBe('timeout');
  });

  it('uses first failure detail when no errorMessage', () => {
    const r = baseResult({
      failureDetails: [{ path: '$.a', expected: '"1"', actual: '"2"' }],
    });
    expect(summarizeRequestFailure(r)).toContain('$.a');
    expect(summarizeRequestFailure(r)).toContain('"2"');
    expect(summarizeRequestFailure(r)).toContain('expected "1"');
  });

  it('truncates long actual value in failure detail', () => {
    const longActual = 'x'.repeat(300);
    const r = baseResult({
      failureDetails: [{ path: '$.b', expected: '"y"', actual: longActual }],
    });
    const summary = summarizeRequestFailure(r);
    expect(summary.length).toBeLessThan(longActual.length);
  });

  it('handles failure detail without expected', () => {
    const r = baseResult({
      failureDetails: [{ path: '$.c', expected: '', actual: 'val' }],
    });
    expect(summarizeRequestFailure(r)).toContain('$.c');
    expect(summarizeRequestFailure(r)).toContain('val');
  });

  it('handles failure detail with null/undefined actual', () => {
    const r = baseResult({
      failureDetails: [{ path: '$.d', expected: '"1"', actual: undefined as unknown as string }],
    });
    const summary = summarizeRequestFailure(r);
    expect(summary).toContain('$.d');
  });

  it('handles formatHttpNodeRunDetail with null actual in failure details', () => {
    const detail = formatHttpNodeRunDetail(baseResult({
      failureDetails: [{ path: '$.e', expected: '"val"', actual: null as unknown as string }],
    }));
    expect(detail).toContain('$.e');
  });

  it('handles HTTP 4xx with empty failureDetails', () => {
    expect(summarizeRequestFailure(baseResult({ httpStatus: 404, failureDetails: [] }))).toBe('HTTP 404');
  });

  it('handles HTTP 5xx', () => {
    expect(summarizeRequestFailure(baseResult({ httpStatus: 500, failureDetails: [] }))).toBe('HTTP 500');
  });

  it('handles HTTP 0 (network error)', () => {
    expect(summarizeRequestFailure(baseResult({ httpStatus: 0, failureDetails: [] }))).toContain('could not reach');
  });

  it('returns generic message when nothing else matches', () => {
    expect(summarizeRequestFailure(baseResult({ httpStatus: 200, failureDetails: [] }))).toBe('Step failed');
  });

  it('uses second line for graphqlAssert multiline errors without got in first line', () => {
    const r = baseResult({
      transportType: 'graphqlAssert',
      errorMessage: 'Assertion failed\nExpected field user.name got "Bob" but wanted "Alice"',
    });
    expect(summarizeRequestFailure(r)).toContain('Expected field user.name');
  });
});

describe('formatHttpNodeRunDetail', () => {
  it('includes request line and status', () => {
    const detail = formatHttpNodeRunDetail(baseResult());
    expect(detail).toContain('GET https://x');
    expect(detail).toContain('HTTP 200');
    expect(detail).toContain('42ms');
  });

  it('includes error message when present', () => {
    const detail = formatHttpNodeRunDetail(baseResult({ errorMessage: 'CORS blocked' }));
    expect(detail).toContain('CORS blocked');
  });

  it('includes validation failure details', () => {
    const detail = formatHttpNodeRunDetail(baseResult({
      failureDetails: [{ path: '$.name', expected: '"Alice"', actual: '"Bob"' }],
    }));
    expect(detail).toContain('$.name');
    expect(detail).toContain('"Alice"');
    expect(detail).toContain('"Bob"');
    expect(detail).toContain('Validation');
  });

  it('truncates very long actual values in failure details', () => {
    const longActual = 'z'.repeat(2000);
    const detail = formatHttpNodeRunDetail(baseResult({
      failureDetails: [{ path: '$.x', expected: '"y"', actual: longActual }],
    }));
    expect(detail.length).toBeLessThan(longActual.length + 500);
    expect(detail).toContain('…');
  });

  it('includes pretty-printed response body', () => {
    const detail = formatHttpNodeRunDetail(baseResult({
      responseBody: '{"key":"value"}',
    }));
    expect(detail).toContain('"key": "value"');
    expect(detail).toContain('Response body:');
  });

  it('includes raw response body when not valid JSON', () => {
    const detail = formatHttpNodeRunDetail(baseResult({
      responseBody: '<html>Error</html>',
    }));
    expect(detail).toContain('<html>Error</html>');
  });

  it('handles result with no body or errors', () => {
    const detail = formatHttpNodeRunDetail(baseResult({ responseBody: '' }));
    expect(detail).toContain('GET https://x');
    expect(detail).toContain('HTTP 200');
  });

  it('uses fullResponseBody override when provided', () => {
    const truncated = '{"key":"val'; // truncated → not valid JSON
    const full = '{"key":"value","extra":true}';
    const detail = formatHttpNodeRunDetail(
      baseResult({ responseBody: truncated }),
      { fullResponseBody: full },
    );
    expect(detail).toContain('"key": "value"'); // pretty-printed from full
    expect(detail).toContain('"extra": true');
  });

  it('falls back to result.responseBody when fullResponseBody is omitted', () => {
    const detail = formatHttpNodeRunDetail(baseResult({ responseBody: '{"a":1}' }));
    expect(detail).toContain('"a": 1');
  });

  it('falls back to result.responseBody when opts is undefined', () => {
    const detail = formatHttpNodeRunDetail(baseResult({ responseBody: '{"b":2}' }));
    expect(detail).toContain('"b": 2');
  });
});

describe('filterQuickTestVariableSnapshot', () => {
  it('drops unreferenced harness baseUrl but keeps runtime bindings', () => {
    const filtered = filterQuickTestVariableSnapshot(
      { baseUrl: 'https://sales.apps.example.com', gqlLatency: '793' },
      new Set<string>(),
      {},
    );
    expect(filtered).toEqual({ gqlLatency: '793' });
  });

  it('keeps baseUrl when referenced in workflow node config', () => {
    const filtered = filterQuickTestVariableSnapshot(
      { baseUrl: 'https://api.example.com', token: 'abc' },
      new Set(['baseUrl']),
      {},
    );
    expect(filtered?.baseUrl).toBe('https://api.example.com');
    expect(filtered?.token).toBe('abc');
  });

  it('drops baseUrl even when present in workflow.variables but not referenced', () => {
    const filtered = filterQuickTestVariableSnapshot(
      { baseUrl: 'http://localhost:4010', gqlLatency: '28' },
      new Set<string>(),
      { baseUrl: 'http://localhost:4010' },
    );
    expect(filtered).toEqual({ gqlLatency: '28' });
  });

  it('drops empty trimmed values and returns null when nothing remains', () => {
    expect(filterQuickTestVariableSnapshot({ baseUrl: '  ', token: '' }, new Set(), {})).toBeNull();
  });
});

describe('buildQuickTestFailureReport', () => {
  it('includes failed graphql steps and gqlLatency hint when variable missing', () => {
    const report = buildQuickTestFailureReport(
      undefined,
      [
        { nodeId: 'q', label: 'GraphQL Query', state: 'pass', responseTimeMs: 24 },
        {
          nodeId: 'a',
          label: 'GraphQL Assert',
          state: 'fail',
          error: 'Source variable "{{gqlLatency}}" is not set.',
        },
      ],
      {},
      120,
    );
    expect(report.failedSteps).toHaveLength(1);
    expect(report.passedSteps).toHaveLength(1);
    expect(report.hints.some((h) => h.includes('gqlLatency'))).toBe(true);
  });

  it('includes endpoint and network hints for common graphql workflow failures', () => {
    const endpointReport = buildQuickTestFailureReport(
      undefined,
      [{ nodeId: 'q', label: 'GraphQL Query', state: 'fail', error: 'Endpoint is required for this node.' }],
      {},
    );
    expect(endpointReport.hints.some((h) => h.includes('Operation tab'))).toBe(true);

    const networkReport = buildQuickTestFailureReport(
      undefined,
      [{ nodeId: 'q', label: 'GraphQL Query', state: 'fail', error: 'Network error — Proxy request failed' }],
      {},
    );
    expect(networkReport.hints.some((h) => h.includes('Docker stack'))).toBe(true);
  });

  it('includes default triage hint when no specific pattern matches', () => {
    const report = buildQuickTestFailureReport(
      undefined,
      [{ nodeId: 'x', label: 'HTTP', state: 'fail', error: 'Unexpected 418' }],
      null,
    );
    expect(report.hints.some((h) => h.includes('Console panel'))).toBe(true);
  });

  it('falls back to final default summary when no result and no step errors', () => {
    const report = buildQuickTestFailureReport(undefined, [], null);
    expect(report.summary).toBe('One or more workflow steps failed.');
    expect(report.hints.some((h) => h.includes('Console panel'))).toBe(true);
  });

  it('uses failedStep error last-line as summary when no failedResult', () => {
    const report = buildQuickTestFailureReport(
      undefined,
      [{ nodeId: 'n1', label: 'HTTP', state: 'fail', error: 'line1\nline2\nActual error here' }],
      null,
    );
    expect(report.summary).toBe('Actual error here');
  });

  it('adds gqlLatency hint when variableSnapshot has empty gqlLatency', () => {
    const report = buildQuickTestFailureReport(
      undefined,
      [{ nodeId: 'a', label: 'Assert', state: 'fail', error: 'Expected gqlLatency to be set' }],
      { gqlLatency: '   ' },
    );
    expect(report.hints.some((h) => h.includes('gqlLatency'))).toBe(true);
  });
});

describe('isExecutableWorkflowNodeType', () => {
  it('returns false for structural node types', () => {
    expect(isExecutableWorkflowNodeType('start')).toBe(false);
    expect(isExecutableWorkflowNodeType('end')).toBe(false);
    expect(isExecutableWorkflowNodeType('webhook')).toBe(false);
    expect(isExecutableWorkflowNodeType('schedule')).toBe(false);
  });

  it('returns true for executable node types', () => {
    expect(isExecutableWorkflowNodeType('http')).toBe(true);
    expect(isExecutableWorkflowNodeType('grpc')).toBe(true);
  });

  it('returns false for undefined or empty type', () => {
    expect(isExecutableWorkflowNodeType(undefined)).toBe(false);
    expect(isExecutableWorkflowNodeType('')).toBe(false);
  });
});

describe('filterQuickTestVariableSnapshot null handling', () => {
  it('returns null for null snapshot', () => {
    expect(filterQuickTestVariableSnapshot(null, new Set(), {})).toBeNull();
  });
});
