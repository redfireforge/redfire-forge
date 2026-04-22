import { describe, it, expect } from 'vitest';
import { summarizeRequestFailure, formatHttpNodeRunDetail } from './workflowRunErrors';
import type { RequestResult } from '../types';

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
    expect(summarizeRequestFailure(baseResult({ httpStatus: 0, failureDetails: [] }))).toContain('No response');
  });

  it('returns generic message when nothing else matches', () => {
    expect(summarizeRequestFailure(baseResult({ httpStatus: 200, failureDetails: [] }))).toBe('Step failed');
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
});
