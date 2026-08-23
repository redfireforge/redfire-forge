/**
 * Shared test fixtures for useScenarioMutations test files.
 *
 * Factories + `renderHook` setup helpers. Vitest mock registrations remain in each
 * test file because they need to be hoisted there.
 */
import { vi } from 'vitest';
import type { SetStateAction } from 'react';
import { renderHook } from '@testing-library/react';
import type {
  FeatureGroup,
  Scenario,
  TestDefinitionSnapshot,
} from '@shared/types';
import { useScenarioMutations } from '../useScenarioMutations';

export function emptySnapshot(): TestDefinitionSnapshot {
  return {
    name: '',
    url: '',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
  };
}

export function scenarioFixture(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 't-1',
    name: 'Test',
    url: '/api',
    method: 'GET',
    headers: [],
    body: '',
    bodyType: 'none',
    bodyForm: [],
    auth: { type: 'none' },
    validation: { mode: 'none', expectedFields: [] },
    extractions: [],
    ...overrides,
  };
}

export function makeFg(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1',
    name: 'Feature 1',
    microserviceId: 'svc-1',
    environmentId: 'env-1',
    scenarios: [],
    ...overrides,
  };
}

export function setupWithoutEnv(initialFgs: FeatureGroup[] = []) {
  const clearAuthVerifyResult = vi.fn();
  let fgs = initialFgs;
  const setFeatureGroups = vi.fn((updater: SetStateAction<FeatureGroup[]>) => {
    fgs = typeof updater === 'function' ? updater(fgs) : updater;
  });
  const hookResult = renderHook(() =>
    useScenarioMutations({
      featureGroups: fgs,
      setFeatureGroups,
      unassociatedFeatureGroups: [],
      selectedSvcId: undefined,
      selectedEnvId: undefined,
      clearAuthVerifyResult,
    }),
  );
  return {
    ...hookResult,
    getFeatureGroups: () => fgs,
    setFeatureGroups,
    clearAuthVerifyResult,
  };
}

export function setup(
  initialFgs: FeatureGroup[] = [],
  unassociated: FeatureGroup[] = [],
) {
  const clearAuthVerifyResult = vi.fn();
  let fgs = initialFgs;
  const setFeatureGroups = vi.fn((updater: SetStateAction<FeatureGroup[]>) => {
    fgs = typeof updater === 'function' ? updater(fgs) : updater;
  });
  const hookResult = renderHook(() =>
    useScenarioMutations({
      featureGroups: fgs,
      setFeatureGroups,
      unassociatedFeatureGroups: unassociated,
      selectedSvcId: 'svc-1',
      selectedEnvId: 'env-1',
      clearAuthVerifyResult,
    }),
  );
  return {
    ...hookResult,
    getFeatureGroups: () => fgs,
    setFeatureGroups,
    clearAuthVerifyResult,
  };
}

export function setupWithTrash(initialFgs: FeatureGroup[] = []) {
  const moveToTrash = vi.fn();
  const clearAuthVerifyResult = vi.fn();
  let fgs = initialFgs;
  const setFeatureGroups = vi.fn((updater: SetStateAction<FeatureGroup[]>) => {
    fgs = typeof updater === 'function' ? updater(fgs) : updater;
  });
  const hookResult = renderHook(() =>
    useScenarioMutations({
      featureGroups: fgs,
      setFeatureGroups,
      unassociatedFeatureGroups: [],
      selectedSvcId: 'svc-1',
      selectedEnvId: 'env-1',
      clearAuthVerifyResult,
      moveToTrash,
    }),
  );
  return {
    ...hookResult,
    getFeatureGroups: () => fgs,
    setFeatureGroups,
    moveToTrash,
  };
}
