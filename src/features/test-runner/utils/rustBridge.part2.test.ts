import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { resetAvailabilityCache, mapRustResult } from './rustBridge';
import { RustExecutionResult } from './rustBridge';
import { isTauri } from '@shared/utils/platform';
import { Scenario, TestConfig } from '@shared/types';
import { makeScenario as _makeScenario, makeConfig as _makeConfig } from '@test-utils/factories';

const mockIsTauri = vi.mocked(isTauri);

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    headers: [{ key: 'X-Custom', value: 'test' }],
    ...overrides,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return _makeConfig({
    concurrency: 4,
    executionMode: 'pool',
    ...overrides,
  });
}

function makeRustResult(overrides: Partial<RustExecutionResult> = {}): RustExecutionResult {
  return {
    id: 'r-1',
    scenarioId: 'sc-1',
    scenarioName: 'Test Scenario',
    url: 'https://api.example.com/users',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 42.5,
    responseBody: '{"ok":true}',
    responseHeaders: { 'content-type': 'application/json' },
    timestamp: Date.now(),
    requestLog: { headers: { 'X-Custom': 'test' }, body: null },
    timing: { dnsLookup: 1, tcpConnect: 2, tlsHandshake: 3, ttfb: 30, download: 5, total: 41 },
    retryCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  resetAvailabilityCache();
  mockIsTauri.mockClear();
  mockIsTauri.mockReturnValue(false);
});

/* ── isRustExecutorAvailable ─────────────────────────────────────── */

describe('mapRustResult — Rust passthrough', () => {
  it('passes through Rust passed=true with no failures', () => {
    const scenario = makeScenario({ validation: { mode: 'selective' } });
    const rustResult = makeRustResult({ passed: true, failureDetails: [], validationMode: 'selective' });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
    expect(result.validationMode).toBe('selective');
  });

  it('passes through Rust passed=false with failureDetails', () => {
    const failures = [{ path: 'name', expected: '"Alice"', actual: '"Bob"' }];
    const scenario = makeScenario({ validation: { mode: 'selective' } });
    const rustResult = makeRustResult({
      passed: false,
      failureDetails: failures,
      validationMode: 'selective',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.failureDetails).toEqual(failures);
  });

  it('falls back to JS validation when passed is undefined', () => {
    const scenario = makeScenario({ validation: { mode: 'full', expectedJson: '{"ok":true}' } });
    const rustResult = makeRustResult({ responseBody: '{"ok":true}' });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(true);
    expect(result.validationMode).toBe('full');
  });

  it('evaluates custom assertions JS-side and merges with Rust failures', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'status', expected: '200', negate: false },
          { type: 'custom', expression: 'false', negate: false },
        ],
      },
    });
    const rustResult = makeRustResult({
      passed: true,
      failureDetails: [],
      validationMode: 'none',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThan(0);
  });

  it('does not run custom assertions when no custom assertions exist', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [{ type: 'status', expected: '200', negate: false }],
      },
    });
    const rustResult = makeRustResult({
      passed: true,
      failureDetails: [],
      validationMode: 'none',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('combines Rust failures and custom assertion failures', () => {
    const rustFailures = [{ path: '(status)', expected: '200', actual: '500' }];
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'status', expected: '200', negate: false },
          { type: 'custom', expression: 'false', negate: false },
        ],
      },
    });
    const rustResult = makeRustResult({
      passed: false,
      failureDetails: rustFailures,
      validationMode: 'none',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThanOrEqual(rustFailures.length);
    expect(result.failureDetails[0]).toEqual(rustFailures[0]);
  });

  it('uses Rust validationMode when available', () => {
    const scenario = makeScenario({ validation: { mode: 'full' } });
    const rustResult = makeRustResult({ passed: true, validationMode: 'full' });
    const result = mapRustResult(rustResult, scenario);

    expect(result.validationMode).toBe('full');
  });

  it('falls back to scenario mode when Rust validationMode is missing', () => {
    const scenario = makeScenario({ validation: { mode: 'selective' } });
    const rustResult = makeRustResult({ passed: true });
    const result = mapRustResult(rustResult, scenario);

    expect(result.validationMode).toBe('selective');
  });

  it('appends retry info on passthrough when retries > 0 and failed', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      passed: false,
      failureDetails: [{ path: '(http)', expected: '2xx', actual: 'HTTP 500' }],
      retryCount: 2,
      httpStatus: 500,
      responseBody: '{"error":"fail"}',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.errorMessage).toContain('3 attempts');
  });

  it('extracts error message from body on passthrough path too', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      passed: false,
      failureDetails: [{ path: '(http)', expected: '2xx', actual: 'HTTP 422' }],
      httpStatus: 422,
      responseBody: '{"message":"Invalid input"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.errorMessage).toBe('Invalid input');
  });

  it('handles passed=false with empty failureDetails array', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({ passed: false, failureDetails: [] });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
  });

  it('does not append retry info when retries > 0 but passthrough passed=true', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({ passed: true, retryCount: 2 });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('handles network error (status 0) on passthrough path', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      passed: false,
      httpStatus: 0,
      responseBody: '',
      errorMessage: 'Connection refused',
      failureDetails: [{ path: '(http)', expected: '2xx', actual: 'Connection refused' }],
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toBe('Connection refused');
    expect(result.failureDetails).toEqual([
      { path: '(http)', expected: '2xx', actual: 'Connection refused' },
    ]);
  });

  it('evaluates custom assertion that always fails on passthrough with non-JSON body', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'custom', expression: 'false' },
        ],
      },
    });
    const rustResult = makeRustResult({
      passed: true,
      responseBody: 'not valid json',
      validationMode: 'none',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThan(0);
    expect(result.failureDetails[0].path).toBe('(custom)');
  });

  it('passes through Rust failures for HTTP 4xx with status assertion accepted', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [{ type: 'status', expected: '4xx', negate: false }],
      },
    });
    const rustResult = makeRustResult({
      passed: true,
      httpStatus: 404,
      failureDetails: [],
      validationMode: 'none',
      responseBody: '{"error":"Not found"}',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(true);
    expect(result.failureDetails).toEqual([]);
  });

  it('handles Rust passed=false with both Rust and custom failures when httpFailed', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'status', expected: '200', negate: false },
          { type: 'custom', expression: 'false' },
        ],
      },
    });
    const rustResult = makeRustResult({
      passed: false,
      httpStatus: 500,
      failureDetails: [{ path: '(status)', expected: '200', actual: '500' }],
      validationMode: 'none',
      responseBody: '{"message":"Internal error"}',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThanOrEqual(2);
    expect(result.failureDetails[0]).toEqual({ path: '(status)', expected: '200', actual: '500' });
  });
});
