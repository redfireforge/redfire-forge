/**
 * Shared test factories for commonly-used domain objects.
 *
 * Import from this module instead of re-defining `makeScenario`, `makeResult`,
 * `makeConfig`, etc. in every test file.
 */
import type { RequestResult, Scenario, TestConfig } from '../shared/types';

export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'sc-1',
    name: 'Test Scenario',
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

export function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: 'result-1',
    scenarioId: 'sc-1',
    scenarioName: 'Test Scenario',
    url: 'https://api.example.com/users',
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

export function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return {
    concurrency: 1,
    iterations: 10,
    scenarioWeights: [{ scenarioId: 'sc-1', weight: 1 }],
    executionMode: 'sequential',
    errorPolicy: 'continue',
    ...overrides,
  };
}

