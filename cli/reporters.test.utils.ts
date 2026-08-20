/**
 * Shared test utilities for reporter tests
 */
import { makeResult as _makeResult, makeSummary } from '../src/test-utils/factories';
import type { TestConfig } from '../src/shared/types';
import type { Workflow } from '../src/features/workflow/types/workflow';

export const makeResult = (overrides: Parameters<typeof _makeResult>[0] = {}) =>
  _makeResult({ scenarioName: 'Get Users', ...overrides });

export const makeConfig = (overrides: Partial<TestConfig> = {}): TestConfig => ({
  concurrency: 5,
  iterations: 10,
  executionMode: 'batch',
  scenarioWeights: [],
  timeoutSec: 30,
  retryCount: 0,
  retryDelayMs: 1000,
  errorPolicy: 'continue',
  maxErrors: 10,
  maxErrorRate: 50,
  ...overrides,
});

export const makeWorkflow = (overrides: Partial<Workflow> = {}): Workflow => ({
  id: 'wf-1',
  name: 'Test Workflow',
  nodes: [],
  edges: [],
  variables: {},
  ...overrides,
});

export { makeSummary };
