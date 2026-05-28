import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { mapRustResult, RustExecutionResult } from './rustBridge';
import { isTauri } from '../../../shared/utils/platform';
import { Scenario } from '../../../shared/types';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

const mockIsTauri = vi.mocked(isTauri);

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    headers: [{ key: 'X-Custom', value: 'test' }],
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
  mockIsTauri.mockClear();
  mockIsTauri.mockReturnValue(false);
});

/* ── mapRustResult — JS fallback (passed === undefined) ───────────── */

describe('mapRustResult — JS fallback', () => {
  it('maps a successful result with no validation', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult();
    const result = mapRustResult(rustResult, scenario);

    expect(result.id).toBe('r-1');
    expect(result.scenarioId).toBe('sc-1');
    expect(result.httpStatus).toBe(200);
    expect(result.responseTimeMs).toBe(42.5);
    expect(result.passed).toBe(true);
    expect(result.validationMode).toBe('none');
    expect(result.failureDetails).toEqual([]);
    expect(result.timing).toEqual(rustResult.timing);
  });

  it('maps a failed HTTP result (status 500)', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: '{"error":"Internal Server Error"}',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.failureDetails.length).toBeGreaterThan(0);
    expect(result.failureDetails[0].path).toBe('(http)');
  });

  it('maps a network error (status 0)', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      httpStatus: 0,
      responseBody: '',
      errorMessage: 'Connection refused',
    });
    const result = mapRustResult(rustResult, scenario);

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('Connection refused');
  });

  it('applies JSON validation when scenario has full validation mode', () => {
    const scenario = makeScenario({
      validation: { mode: 'full', expectedJson: '{"ok":true}' },
    });
    const rustResult = makeRustResult({ responseBody: '{"ok":true}' });
    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(true);
    expect(result.validationMode).toBe('full');
  });

  it('detects validation failure when expected JSON does not match', () => {
    const scenario = makeScenario({
      validation: { mode: 'full', expectedJson: '{"ok":false}' },
    });
    const rustResult = makeRustResult({ responseBody: '{"ok":true}' });
    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(false);
    expect(result.validationMode).toBe('full');
    expect(result.failureDetails.length).toBeGreaterThan(0);
  });

  it('preserves timing breakdown', () => {
    const timing = { dnsLookup: 5, tcpConnect: 10, tlsHandshake: 15, ttfb: 50, download: 8, total: 88 };
    const rustResult = makeRustResult({ timing });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.timing).toEqual(timing);
  });

  it('preserves request log', () => {
    const requestLog = { headers: { 'X-Test': 'val' }, body: '{"req":1}' };
    const rustResult = makeRustResult({ requestLog });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.requestLog).toEqual({ headers: { 'X-Test': 'val' }, body: '{"req":1}' });
  });

  it('converts null requestLog.body to undefined', () => {
    const rustResult = makeRustResult({ requestLog: { headers: {}, body: null } });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.requestLog?.body).toBeUndefined();
  });

  it('converts null optional fields to undefined', () => {
    const rustResult = makeRustResult({
      featureGroupName: null,
      groupName: null,
      errorMessage: null,
      dataRowId: null,
      dataRowLabel: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.featureGroupName).toBeUndefined();
    expect(result.groupName).toBeUndefined();
    expect(result.dataRowId).toBeUndefined();
    expect(result.dataRowLabel).toBeUndefined();
  });

  it('preserves data row fields', () => {
    const rustResult = makeRustResult({ dataRowId: 'row-3', dataRowLabel: 'Row 3: VIN=123' });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.dataRowId).toBe('row-3');
    expect(result.dataRowLabel).toBe('Row 3: VIN=123');
  });

  it('copies scenarioTags from scenario to result', () => {
    const scenario = makeScenario({ scenarioTags: ['smoke', 'critical'] });
    const rustResult = makeRustResult();
    const result = mapRustResult(rustResult, scenario);
    expect(result.scenarioTags).toEqual(['smoke', 'critical']);
  });

  it('handles scenario without scenarioTags (undefined)', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult();
    const result = mapRustResult(rustResult, scenario);
    expect(result.scenarioTags).toBeUndefined();
  });

  it('appends retry count info to error message when retries > 0 and failed', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      httpStatus: 0,
      responseBody: '',
      errorMessage: 'timeout',
      retryCount: 2,
    });
    const result = mapRustResult(rustResult, scenario);
    expect(result.errorMessage).toContain('3 attempts');
  });

  it('does not append retry info when retries > 0 but result passed', () => {
    const scenario = makeScenario();
    const rustResult = makeRustResult({ retryCount: 1, httpStatus: 200 });
    const result = mapRustResult(rustResult, scenario);
    expect(result.errorMessage).toBeUndefined();
  });

  it('extracts error message from JSON response body for HTTP failures', () => {
    const rustResult = makeRustResult({
      httpStatus: 422,
      responseBody: '{"message":"Validation failed"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Validation failed');
  });

  it('extracts error from JSON "error" field', () => {
    const rustResult = makeRustResult({
      httpStatus: 400,
      responseBody: '{"error":"Bad request"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Bad request');
  });

  it('extracts error from JSON "detail" field', () => {
    const rustResult = makeRustResult({
      httpStatus: 404,
      responseBody: '{"detail":"Not found"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Not found');
  });

  it('extracts error from JSON "errorMessage" field', () => {
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: '{"errorMessage":"Internal error"}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Internal error');
  });

  it('stringifies non-string error field in JSON', () => {
    const rustResult = makeRustResult({
      httpStatus: 422,
      responseBody: '{"message":{"code":"INVALID","details":["field1"]}}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('code');
    expect(result.errorMessage).toContain('INVALID');
  });

  it('uses truncated body when JSON has no recognized error field', () => {
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: '{"status":"error","data":null}',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('status');
  });

  it('falls back to truncated body when no standard error field', () => {
    const rustResult = makeRustResult({
      httpStatus: 503,
      responseBody: 'Service Unavailable - please try again later',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Service Unavailable');
  });

  it('handles non-JSON response body for error extraction', () => {
    const rustResult = makeRustResult({
      httpStatus: 502,
      responseBody: '<html>Bad Gateway</html>',
      errorMessage: null,
    });
    const result = mapRustResult(rustResult, makeScenario());
    expect(result.errorMessage).toContain('Bad Gateway');
  });
});
