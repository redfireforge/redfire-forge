/**
 * Shared test fixtures for useTrash test files.
 *
 * These are pure factories — no vi.mock side effects, because vi.mock must be
 * hoisted to the top of the consuming test file. Each test file declares its
 * own `vi.mock('../../../shared/utils/trashStorage', ...)` block.
 */
import { vi } from 'vitest';
import type {
  FeatureGroup,
  Scenario,
  SharedDataSource,
  TestScenario,
} from '../../../../shared/types';

export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 't-1',
    name: 'Test 1',
    url: '/api',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

export function makeTestScenario(
  overrides: Partial<TestScenario> = {},
): TestScenario {
  return {
    id: 'sc-1',
    name: 'Scenario 1',
    kind: 'standard',
    tests: [makeScenario()],
    ...overrides,
  };
}

export function makeFg(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1',
    name: 'Feature 1',
    microserviceId: 'svc-1',
    environmentId: 'env-1',
    scenarios: [makeTestScenario()],
    ...overrides,
  };
}

export function makeDs(
  overrides: Partial<SharedDataSource> = {},
): SharedDataSource {
  return {
    id: 'ds-1',
    name: 'DS 1',
    dataSource: { id: 'ds-data-1', columns: [], rows: [], source: { type: 'inline' } },
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Default params for `useTrash(...)`. We type `setFeatureGroups` /
 * `setSharedDataSources` as plain mocks so individual tests can introspect them
 * via `.mock.calls`.
 */
export function defaultParams() {
  const featureGroups = [makeFg()];
  const sharedDataSources = [makeDs()];
  return {
    featureGroups,
    setFeatureGroups: vi.fn(),
    sharedDataSources,
    setSharedDataSources: vi.fn(),
    environments: [{ id: 'env-1' }],
    microservices: [{ id: 'svc-1' }],
  };
}
