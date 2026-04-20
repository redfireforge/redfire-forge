import { describe, it, expect } from 'vitest';
import { summarizeRequestFailure } from './workflowRunErrors';
import type { RequestResult } from '../types';

function baseResult(over: Partial<RequestResult>): RequestResult {
  return {
    id: '1',
    scenarioId: 's',
    scenarioName: 't',
    url: 'https://x',
    method: 'GET',
    httpStatus: 0,
    responseTimeMs: 1,
    responseBody: '',
    timestamp: 0,
    passed: false,
    validationMode: 'none',
    failureDetails: [],
    ...over,
  };
}

describe('summarizeRequestFailure', () => {
  it('prefers errorMessage', () => {
    expect(summarizeRequestFailure(baseResult({ errorMessage: 'Connection refused' }))).toBe('Connection refused');
  });

  it('uses first failure detail when no errorMessage', () => {
    expect(
      summarizeRequestFailure(
        baseResult({
          httpStatus: 200,
          failureDetails: [{ path: '$.a', expected: '"1"', actual: '"2"' }],
        }),
      ),
    ).toContain('$.a');
  });

  it('handles HTTP 4xx', () => {
    expect(summarizeRequestFailure(baseResult({ httpStatus: 404, failureDetails: [] }))).toBe('HTTP 404');
  });
});
