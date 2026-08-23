import { describe, expect, it } from 'vitest';
import {
  buildScenarioLookup,
  findScenario,
  mapRustResult,
  mapRustResultWithoutValidation,
} from './rustBridgeResultMapping';
import type { RustExecutionResult } from './rustBridge';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import type { Scenario } from '@shared/types';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    ...overrides,
  });
}

function makeRustResult(overrides: Partial<RustExecutionResult> = {}): RustExecutionResult {
  return {
    id: 'rr-1',
    scenarioId: 'sc-1',
    scenarioName: 'Scenario',
    url: 'https://example.test',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 10,
    responseBody: '{"ok":true}',
    responseHeaders: { 'content-type': 'application/json' },
    timestamp: Date.now(),
    requestLog: { headers: {}, body: null },
    timing: { dnsLookup: 1, tcpConnect: 1, tlsHandshake: 1, ttfb: 5, download: 2, total: 10 },
    retryCount: 0,
    ...overrides,
  };
}

describe('rustBridgeResultMapping', () => {
  it('maps passthrough result and appends retry context when failed', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [{ type: 'custom', expression: 'false', message: 'custom fail' }] as never,
      },
    });

    const result = mapRustResult(
      makeRustResult({
        passed: false,
        failureDetails: [{ path: '(http)', expected: '2xx', actual: '500' }],
        retryCount: 2,
        httpStatus: 500,
        errorMessage: 'upstream failed',
      }),
      scenario,
    );

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('3 attempts');
    expect(result.failureDetails.length).toBeGreaterThanOrEqual(1);
  });

  it('maps fallback result when Rust does not emit passed', () => {
    const scenario = makeScenario({ validation: { mode: 'none' } });
    const result = mapRustResult(makeRustResult({ passed: undefined, responseBody: 'plain text' }), scenario);
    expect(result.validationMode).toBe('none');
    expect(result.passed).toBe(true);
  });

  it('extracts error message from JSON details for failed HTTP response', () => {
    const scenario = makeScenario({ validation: { mode: 'none' } });
    const result = mapRustResult(
      makeRustResult({
        httpStatus: 422,
        responseBody: '{"detail":{"code":"INVALID"}}',
        errorMessage: null,
        passed: undefined,
      }),
      scenario,
    );

    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('INVALID');
  });

  it('builds scenario lookup with composite data row keys and resolves by preference', () => {
    const base = makeScenario({ id: 'sc-1' });
    const expanded = makeScenario({ id: 'sc-1', dataRowId: 'row-1', dataRowLabel: 'Row 1' });

    const lookup = buildScenarioLookup([base], [expanded]);
    const resolvedComposite = findScenario(lookup, makeRustResult({ scenarioId: 'sc-1', dataRowId: 'row-1' }));
    const resolvedFallback = findScenario(lookup, makeRustResult({ scenarioId: 'sc-1', dataRowId: 'missing' }));

    expect(resolvedComposite?.dataRowId).toBe('row-1');
    expect(resolvedFallback?.id).toBe('sc-1');
  });

  it('adds expanded scenario id when it is not present in base scenarios', () => {
    const expandedOnly = makeScenario({ id: 'sc-expanded', dataRowId: 'row-2' });
    const lookup = buildScenarioLookup([], [expandedOnly]);

    const resolved = findScenario(lookup, makeRustResult({ scenarioId: 'sc-expanded' }));
    expect(resolved?.id).toBe('sc-expanded');
  });

  it('maps no-scenario fallback for HTTP failure and success', () => {
    const failed = mapRustResultWithoutValidation(makeRustResult({ httpStatus: 0, errorMessage: null }));
    const ok = mapRustResultWithoutValidation(makeRustResult({ httpStatus: 200 }));

    expect(failed.passed).toBe(false);
    expect(failed.failureDetails[0]?.actual).toContain('network error');
    expect(ok.passed).toBe(true);
    expect(ok.failureDetails).toEqual([]);
  });
});
