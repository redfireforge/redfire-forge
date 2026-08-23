import { describe, it, expect } from 'vitest';
import { buildValidationResult } from './validationResult';

function makeInput(overrides: Partial<Parameters<typeof buildValidationResult>[0]> = {}) {
  return {
    httpStatus: 200,
    responseTimeMs: 42,
    responseHeaders: {},
    responseBody: '{"ok":true}',
    responseObj: { ok: true },
    validation: { mode: 'none' as const },
    assertions: [],
    ...overrides,
  };
}

describe('buildValidationResult', () => {
  it('passes when status is 2xx and no assertions', () => {
    const result = buildValidationResult(makeInput());
    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('fails on network error (status 0)', () => {
    const result = buildValidationResult(makeInput({ httpStatus: 0 }));
    expect(result.passed).toBe(false);
  });

  it('fails on HTTP 4xx with error message', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 404,
      errorMessage: 'Not Found',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(http)', expected: '2xx', actual: 'Not Found' }),
      ]),
    );
  });

  it('fails on HTTP 5xx with error message', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 500,
      errorMessage: 'Internal Server Error',
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails[0]).toMatchObject({ path: '(http)' });
  });

  it('fails on HTTP 4xx even when errorMessage is undefined (workflow engine path)', () => {
    // Reproduces the pre-fix bug: workflow engine does not pre-extract errorMessage
    // from response body the way the runner does. Without this guard, a 404 from
    // jsonplaceholder.typicode.com/posts/999999 (body "{}") was reported as PASS.
    const result = buildValidationResult(makeInput({
      httpStatus: 404,
      errorMessage: undefined,
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(http)', expected: '2xx', actual: 'HTTP 404' }),
      ]),
    );
  });

  it('fails on network error (status 0) even when errorMessage is undefined', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 0,
      errorMessage: undefined,
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(http)', expected: '2xx', actual: 'network error' }),
      ]),
    );
  });

  it('legacy assertion format ({path, operator, expected}) is silently ignored — node falls back to HTTP status', () => {
    // Documents existing engine behaviour: assertions without a `type` field are not
    // matched by evaluateAssertions and so do not contribute to pass/fail. Without the
    // HTTP guard above, the node would mistakenly pass.
    type LegacyAssertion = { path: string; operator: string; expected: string };
    const legacy = [{ path: '$.status', operator: 'equals', expected: '200' }] as unknown as LegacyAssertion[];
    const result = buildValidationResult(makeInput({
      httpStatus: 404,
      errorMessage: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assertions: legacy as any,
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails[0]).toMatchObject({ path: '(http)', actual: 'HTTP 404' });
  });

  it('passes when status assertion matches', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 201,
      assertions: [{ type: 'status', expected: '201' }],
    }));
    expect(result.passed).toBe(true);
  });

  it('fails when status assertion does not match', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 404,
      assertions: [{ type: 'status', expected: '200' }],
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '(status)' }),
      ]),
    );
  });

  it('runs JSON validation when mode is not none and HTTP is ok', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 200,
      responseObj: { foo: 'bar' },
      validation: {
        mode: 'full',
        expectedJson: '{"foo":"baz"}',
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThan(0);
  });

  it('skips JSON validation on HTTP failure', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 500,
      errorMessage: 'server error',
      responseObj: { wrong: 'data' },
      validation: {
        mode: 'full',
        expectedJson: '{"foo":"bar"}',
      },
    }));
    // Should only have (http) failure, not JSON validation failures
    expect(result.failureDetails.every(f => f.path === '(http)')).toBe(true);
  });

  it('passes with response time assertion within threshold', () => {
    const result = buildValidationResult(makeInput({
      responseTimeMs: 50,
      assertions: [{ type: 'responseTime', maxMs: 100 }],
    }));
    expect(result.passed).toBe(true);
  });

  it('fails with response time assertion above threshold', () => {
    const result = buildValidationResult(makeInput({
      responseTimeMs: 150,
      assertions: [{ type: 'responseTime', maxMs: 100 }],
    }));
    expect(result.passed).toBe(false);
  });

  it('preserves errorMessage in output', () => {
    const result = buildValidationResult(makeInput({
      httpStatus: 0,
      errorMessage: 'Connection refused',
    }));
    expect(result.errorMessage).toBe('Connection refused');
  });

  it('returns undefined errorMessage when none provided', () => {
    const result = buildValidationResult(makeInput());
    expect(result.errorMessage).toBeUndefined();
  });
});
