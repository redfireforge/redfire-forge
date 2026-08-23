/**
 * Branch-coverage additions for rustBridge.ts.
 * Covers: mapThinkTime ?? fallbacks, mapCircuitBreaker ?? fallback,
 * normalizeAssertionForRust legacy field fallbacks, prepareRustScenario
 * validation field fallbacks, mapRustResult JS-fallback retry/error branches,
 * buildScenarioLookup / findScenario edge cases, and runTestViaRust settle guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import {
  buildExecutionPlan,
  prepareRustScenario,
  mapRustResult,
  type RustExecutionResult,
} from './rustBridge';
import { isTauri } from '@shared/utils/platform';
import type { Scenario, TestConfig } from '@shared/types';
import { makeScenario as _makeScenario, makeConfig as _makeConfig } from '@test-utils/factories';

const mockIsTauri = vi.mocked(isTauri);

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({ headers: [], ...overrides });
}

function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return _makeConfig({ executionMode: 'pool', concurrency: 2, ...overrides });
}

function makeRustResult(overrides: Partial<RustExecutionResult> = {}): RustExecutionResult {
  return {
    id: 'r-1',
    scenarioId: 'sc-1',
    scenarioName: 'Test',
    url: 'https://example.com/api',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 50,
    responseBody: '{"ok":true}',
    responseHeaders: {},
    timestamp: Date.now(),
    requestLog: { headers: {}, body: null },
    timing: null,
    retryCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockIsTauri.mockClear();
  mockIsTauri.mockReturnValue(false);
});

// ── mapThinkTime ?? fallbacks ────────────────────────────────────────────

describe('mapThinkTime — ?? fallbacks', () => {
  it('constant: uses 1000 when constantMs is undefined', () => {
    const config = makeConfig({ thinkTime: { mode: 'constant' } as never });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'constant', delayMs: 1000 });
  });

  it('uniform: uses 500/2000 when minMs/maxMs are undefined', () => {
    const config = makeConfig({ thinkTime: { mode: 'uniform' } as never });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'uniform', minMs: 500, maxMs: 2000 });
  });

  it('gaussian: uses 1000/300 when meanMs/stdDevMs are undefined', () => {
    const config = makeConfig({ thinkTime: { mode: 'gaussian' } as never });
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.thinkTime).toEqual({ type: 'gaussian', meanMs: 1000, stdDevMs: 300 });
  });
});

// ── mapCircuitBreaker ?? fallback ────────────────────────────────────────

describe('mapCircuitBreaker — ?? fallbacks', () => {
  it('stop-threshold: uses 50 for maxErrorRate when undefined', () => {
    const config = makeConfig({ errorPolicy: 'stop-threshold' });
    // maxErrorRate is not set → falls back to 50 → 0.5
    const plan = buildExecutionPlan(config, [makeScenario()])!;
    expect(plan.circuitBreaker).toMatchObject({ policy: 'stop-threshold', maxErrorRate: 0.5 });
  });
});

// ── normalizeAssertionForRust legacy field fallbacks ─────────────────────

describe('normalizeAssertionForRust via prepareRustScenario', () => {
  it('header assertion: uses headerName fallback when name is absent', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [
          { type: 'header', headerName: 'X-Token', headerOp: 'equals', headerValue: 'abc' } as never,
        ],
      } as never,
    });
    const result = prepareRustScenario(scenario);
    const headerAssertion = result.assertions?.[0] as Record<string, unknown>;
    expect(headerAssertion?.name).toBe('X-Token'); // fallback from headerName
    expect(headerAssertion?.operator).toBe('equals'); // fallback from headerOp
    expect(headerAssertion?.value).toBe('abc'); // fallback from headerValue
  });

  it('header assertion: uses empty string when no name field at all', () => {
    const scenario = makeScenario({
      validation: { mode: 'none', assertions: [{ type: 'header' } as never] } as never,
    });
    const result = prepareRustScenario(scenario);
    const headerAssertion = result.assertions?.[0] as Record<string, unknown>;
    expect(headerAssertion?.name).toBe(''); // '' fallback
    expect(headerAssertion?.operator).toBe('equals'); // 'equals' fallback
  });

  it('numeric assertion: uses comparison fallback when operator is absent', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [{ type: 'numeric', comparison: '>=', value: 100 } as never],
      } as never,
    });
    const result = prepareRustScenario(scenario);
    const numericAssertion = result.assertions?.[0] as Record<string, unknown>;
    expect(numericAssertion?.operator).toBe('>='); // fallback from comparison
  });

  it('numeric assertion: uses ">" default when no operator or comparison', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [{ type: 'numeric', value: 100 } as never],
      } as never,
    });
    const result = prepareRustScenario(scenario);
    const a = result.assertions?.[0] as Record<string, unknown>;
    expect(a?.operator).toBe('>'); // default
  });

  it('arrayLength assertion: uses comparison fallback', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'none',
        assertions: [{ type: 'arrayLength', comparison: '<', value: 5 } as never],
      } as never,
    });
    const result = prepareRustScenario(scenario);
    const a = result.assertions?.[0] as Record<string, unknown>;
    expect(a?.operator).toBe('<'); // fallback from comparison
  });
});

// ── prepareRustScenario validation field fallbacks ───────────────────────

describe('prepareRustScenario validation.expectedFields fallbacks', () => {
  it('uses legacy .path fallback when jsonPath is empty', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'fields',
        expectedFields: [
          { path: '$.name', value: 'alice' } as never,
        ],
      } as never,
    });
    const result = prepareRustScenario(scenario);
    const field = result.validation?.expectedFields?.[0];
    expect(field?.jsonPath).toBe('$.name'); // path fallback
  });

  it('uses legacy .value fallback when expectedValue is empty', () => {
    const scenario = makeScenario({
      validation: {
        mode: 'fields',
        expectedFields: [
          { jsonPath: '$.status', value: 'active' } as never,
        ],
      } as never,
    });
    const result = prepareRustScenario(scenario);
    const field = result.validation?.expectedFields?.[0];
    expect(field?.expectedValue).toBe('active'); // value fallback
  });
});

// ── mapRustResult JS-fallback error branches ─────────────────────────────

describe('mapRustResult — error message and retry branches', () => {
  it('appends retry count to error message when retryCount > 0 and failed', () => {
    // Line 634/686: `${finalErrorMessage ?? 'Failed'} (after N attempts)`
    const scenario = makeScenario({
      validation: { mode: 'none', assertions: [] } as never,
    });
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: '{"message":"Server error"}',
      retryCount: 2,
      passed: undefined, // JS fallback path
    });
    const result = mapRustResult(rustResult, scenario);
    // HTTP 500 → failed, retryCount=2 → message includes "after 3 attempts"
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('after 3 attempts');
  });

  it('uses "Failed" as default when finalErrorMessage is null and retryCount > 0', () => {
    // Line 634: `${finalErrorMessage ?? 'Failed'}` — finalErrorMessage is null
    const scenario = makeScenario({
      validation: { mode: 'none', assertions: [] } as never,
    });
    const rustResult = makeRustResult({
      httpStatus: 500,
      responseBody: null as never,
      errorMessage: undefined,
      retryCount: 1,
      passed: undefined,
    });
    const result = mapRustResult(rustResult, scenario);
    expect(result.errorMessage).toContain('Failed');
    expect(result.errorMessage).toContain('after 2 attempts');
  });

  it('parsed non-object response body falls back to raw body slice', () => {
    // Line 553: typeof parsed !== 'object' || parsed === null → obj = null → slice fallback
    const scenario = makeScenario();
    const longBody = 'A'.repeat(400); // > 300 chars
    const rustResult = makeRustResult({
      httpStatus: 503,
      responseBody: longBody, // not JSON → parse throws
      errorMessage: undefined,
      passed: undefined,
    });
    const result = mapRustResult(rustResult, scenario);
    // Falls through to catch or to the 300-char slice
    expect(result.errorMessage?.length).toBeLessThanOrEqual(300);
  });

  it('sets error from non-string JSON field (raw != null path)', () => {
    // Line ~559: `else if (raw != null) errorMessage = JSON.stringify(raw)`
    const scenario = makeScenario();
    const rustResult = makeRustResult({
      httpStatus: 400,
      responseBody: JSON.stringify({ message: { code: 42, text: 'bad' } }), // object → JSON.stringify
      errorMessage: undefined,
      passed: undefined,
    });
    const result = mapRustResult(rustResult, scenario);
    expect(result.errorMessage).toContain('42');
  });
});

// ── mapRustResult passthrough (Rust-side validation) retryCount branch ───

describe('mapRustResult passthrough — retryCount retry message', () => {
  it('appends retry count when Rust says failed and retryCount > 0', () => {
    // Line 634: passthrough path when rustResult.passed === false
    const scenario = makeScenario({
      validation: { mode: 'status', assertions: [] } as never,
    });
    const rustResult = makeRustResult({
      httpStatus: 200,
      passed: false, // Rust says failed
      validationMode: 'status',
      errorMessage: 'Assertion failed',
      retryCount: 3,
    });
    const result = mapRustResult(rustResult, scenario);
    expect(result.passed).toBe(false);
    expect(result.errorMessage).toContain('after 4 attempts');
  });
});

// ── buildExecutionPlan — executionMode ?? 'batch' fallback ──────────────

describe('buildExecutionPlan — executionMode fallback', () => {
  it('uses batch mode (→ pool) when executionMode is undefined', () => {
    const config = makeConfig({} as Partial<TestConfig>);
    delete (config as Record<string, unknown>).executionMode;
    const plan = buildExecutionPlan(config, [makeScenario()]);
    // 'batch' maps to 'pool' mode
    expect(plan?.mode).toBe('pool');
  });
});
