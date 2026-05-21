/**
 * @vitest-environment jsdom
 *
 * Soft-delete (moveToTrash) tests for useScenarioMutations. Split out from
 * `useScenarioMutations.test.ts` to keep individual files under the 900-line
 * monolithic threshold.
 *
 * Shared factories live in `__test-utils__/useScenarioMutationsTestFixtures.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import type {
  FeatureGroup,
  Scenario,
  TestDefinitionVersion,
} from '../../../shared/types';

vi.mock('../utils/structureChangeLog', () => ({
  logScenarioAdded: vi.fn((fg: FeatureGroup) => fg),
  logScenarioRemoved: vi.fn((fg: FeatureGroup) => fg),
  logScenarioRenamed: vi.fn((fg: FeatureGroup) => fg),
  logTestAdded: vi.fn((fg: FeatureGroup) => fg),
  logTestRemoved: vi.fn((fg: FeatureGroup) => fg),
  logTestCopied: vi.fn((fg: FeatureGroup) => fg),
  logFgRenamed: vi.fn((fg: FeatureGroup) => fg),
  logTestRenamed: vi.fn((fg: FeatureGroup) => fg),
}));

vi.mock('../utils/testDefinitionVersioning', () => ({
  autoSaveVersion: vi.fn((t: Scenario) => t as unknown as TestDefinitionVersion[] | null),
}));

import {
  scenarioFixture,
  makeFg,
  setup,
  setupWithTrash,
} from './__test-utils__/useScenarioMutationsTestFixtures';

describe('useScenarioMutations — soft-delete (moveToTrash)', () => {
  it('removeFeatureGroup shows Move to Trash dialog', () => {
    const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [scenarioFixture()] }] });
    const { result } = setupWithTrash([fg]);
    act(() => { result.current.removeFeatureGroup('fg-1'); });
    expect(result.current.confirmDialog!.title).toBe('Move to Trash');
    expect(result.current.confirmDialog!.confirmLabel).toBe('Move to Trash');
    expect(result.current.confirmDialog!.message).toContain('restore it within 30 days');
  });

  it('removeFeatureGroup confirm calls moveToTrash with correct args', () => {
    const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [scenarioFixture()] }] });
    const { result, moveToTrash, getFeatureGroups } = setupWithTrash([fg]);
    act(() => { result.current.removeFeatureGroup('fg-1'); });
    act(() => { result.current.confirmDialog!.onConfirm(); });
    expect(moveToTrash).toHaveBeenCalledWith(
      'featureGroup', fg, 'Feature 1', '',
      { environmentId: 'env-1', microserviceId: 'svc-1' },
    );
    expect(getFeatureGroups()).toHaveLength(0);
  });

  it('removeFeatureGroup dialog message includes child counts', () => {
    const fg = makeFg({
      scenarios: [
        { id: 'sc-1', name: 'Sc', tests: [scenarioFixture(), scenarioFixture({ id: 't-2' })] },
      ],
    });
    const { result } = setupWithTrash([fg]);
    act(() => { result.current.removeFeatureGroup('fg-1'); });
    expect(result.current.confirmDialog!.message).toContain('1 scenario(s) and 2 test(s)');
  });

  it('removeScenario shows Move to Trash dialog', () => {
    const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Login Tests', tests: [scenarioFixture()] }] });
    const { result } = setupWithTrash([fg]);
    act(() => { result.current.removeScenario('fg-1', 'sc-1'); });
    expect(result.current.confirmDialog!.title).toBe('Move to Trash');
    expect(result.current.confirmDialog!.confirmLabel).toBe('Move to Trash');
    expect(result.current.confirmDialog!.message).toContain('restore it within 30 days');
  });

  it('removeScenario confirm calls moveToTrash with correct args', () => {
    const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Login Tests', tests: [scenarioFixture()] }] });
    const { result, moveToTrash, getFeatureGroups } = setupWithTrash([fg]);
    act(() => { result.current.removeScenario('fg-1', 'sc-1'); });
    act(() => { result.current.confirmDialog!.onConfirm(); });
    expect(moveToTrash).toHaveBeenCalledWith(
      'scenario',
      expect.objectContaining({ id: 'sc-1', name: 'Login Tests' }),
      'Login Tests',
      'Feature 1',
      { parentFeatureGroupId: 'fg-1', environmentId: 'env-1', microserviceId: 'svc-1' },
    );
    expect(getFeatureGroups()[0].scenarios).toHaveLength(0);
  });

  it('removeTest shows Move to Trash dialog', () => {
    const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'SC', tests: [scenarioFixture({ id: 't-1', name: 'GET /users' })] }] });
    const { result } = setupWithTrash([fg]);
    act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
    expect(result.current.confirmDialog!.title).toBe('Move to Trash');
    expect(result.current.confirmDialog!.confirmLabel).toBe('Move to Trash');
    expect(result.current.confirmDialog!.message).toContain('GET /users');
  });

  it('removeTest confirm calls moveToTrash with correct args', () => {
    const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'SC', tests: [scenarioFixture({ id: 't-1', name: 'GET /users' })] }] });
    const { result, moveToTrash, getFeatureGroups } = setupWithTrash([fg]);
    act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
    act(() => { result.current.confirmDialog!.onConfirm(); });
    expect(moveToTrash).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ id: 't-1', name: 'GET /users' }),
      'GET /users',
      'Feature 1 > SC',
      { parentFeatureGroupId: 'fg-1', parentScenarioId: 'sc-1', environmentId: 'env-1', microserviceId: 'svc-1' },
    );
    expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
  });

  it('removeTest clears confirmDialog after confirm', () => {
    const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'SC', tests: [scenarioFixture()] }] });
    const { result } = setupWithTrash([fg]);
    act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
    act(() => { result.current.confirmDialog!.onConfirm(); });
    expect(result.current.confirmDialog).toBeNull();
  });

  it('removeTest with trash: multi-FG keeps non-target FG untouched', () => {
    const fg1 = makeFg({
      id: 'fg-1', name: 'F1',
      scenarios: [{ id: 'sc-1', name: 'SC1', tests: [scenarioFixture({ id: 't-1', name: 'T1' })] }],
    });
    const fg2 = makeFg({
      id: 'fg-2', name: 'F2',
      scenarios: [{ id: 'sc-2', name: 'SC2', tests: [scenarioFixture({ id: 't-2', name: 'T2' })] }],
    });
    const { result, getFeatureGroups } = setupWithTrash([fg1, fg2]);
    act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
    act(() => { result.current.confirmDialog!.onConfirm(); });
    expect(getFeatureGroups()).toHaveLength(2);
    expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    expect(getFeatureGroups()[1].scenarios[0].tests).toHaveLength(1);
  });

  it('removeTest with trash: multi-SC keeps non-target SC untouched', () => {
    const fg = makeFg({
      scenarios: [
        { id: 'sc-1', name: 'SC1', tests: [scenarioFixture({ id: 't-1', name: 'T1' })] },
        { id: 'sc-2', name: 'SC2', tests: [scenarioFixture({ id: 't-2', name: 'T2' })] },
      ],
    });
    const { result, getFeatureGroups } = setupWithTrash([fg]);
    act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
    act(() => { result.current.confirmDialog!.onConfirm(); });
    expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    expect(getFeatureGroups()[0].scenarios[1].tests).toHaveLength(1);
  });

  it('removeTest without trash: multi-FG/SC keeps others untouched', () => {
    const fg1 = makeFg({
      id: 'fg-1', name: 'F1',
      scenarios: [
        { id: 'sc-1', name: 'SC1', tests: [scenarioFixture({ id: 't-1', name: 'T1' })] },
        { id: 'sc-x', name: 'SCx', tests: [scenarioFixture({ id: 't-x', name: 'Tx' })] },
      ],
    });
    const fg2 = makeFg({
      id: 'fg-2', name: 'F2',
      scenarios: [{ id: 'sc-2', name: 'SC2', tests: [scenarioFixture({ id: 't-2', name: 'T2' })] }],
    });
    const { result, getFeatureGroups } = setup([fg1, fg2]);
    act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
    act(() => { result.current.confirmDialog!.onConfirm(); });
    expect(getFeatureGroups()).toHaveLength(2);
    expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    expect(getFeatureGroups()[0].scenarios[1].tests).toHaveLength(1);
    expect(getFeatureGroups()[1].scenarios[0].tests).toHaveLength(1);
  });
});
