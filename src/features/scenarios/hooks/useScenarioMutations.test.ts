/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import type { SetStateAction } from 'react';
import { renderHook, act } from '@testing-library/react';
import type { FeatureGroup, Scenario, TestDefinitionVersion, TestDefinitionSnapshot, ExpectedField, TestScenario } from '../../../shared/types';

vi.mock('../utils/structureChangeLog', () => ({
  logScenarioAdded: vi.fn((fg: FeatureGroup, _scenarioName: string) => fg),
  logScenarioRemoved: vi.fn((fg: FeatureGroup, _scenarioName: string) => fg),
  logScenarioRenamed: vi.fn((fg: FeatureGroup, _oldName: string, _newName: string) => fg),
  logTestAdded: vi.fn((fg: FeatureGroup, _testName: string, _scenarioName: string) => fg),
  logTestRemoved: vi.fn((fg: FeatureGroup, _testName: string, _scenarioName: string) => fg),
  logTestCopied: vi.fn((fg: FeatureGroup, _testName: string, _scenarioName: string) => fg),
  logFgRenamed: vi.fn((fg: FeatureGroup, _oldName: string, _newName: string) => fg),
  logTestRenamed: vi.fn((fg: FeatureGroup, _oldName: string, _newName: string, _scenarioName: string) => fg),
}));

vi.mock('../utils/testDefinitionVersioning', () => ({
  autoSaveVersion: vi.fn((t: Scenario) => t as unknown as TestDefinitionVersion[] | null),
}));

import { useScenarioMutations } from './useScenarioMutations';
import { autoSaveVersion } from '../utils/testDefinitionVersioning';
import { logFgRenamed, logScenarioRenamed, logTestAdded, logTestRenamed } from '../utils/structureChangeLog';

function emptySnapshot(): TestDefinitionSnapshot {
  return {
    name: '',
    url: '',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
  };
}

function scenarioFixture(overrides: Partial<Scenario> = {}): Scenario {
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

function makeFg(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1',
    name: 'Feature 1',
    microserviceId: 'svc-1',
    environmentId: 'env-1',
    scenarios: [],
    ...overrides,
  };
}

function setupWithoutEnv(initialFgs: FeatureGroup[] = []) {
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
  return { ...hookResult, getFeatureGroups: () => fgs, setFeatureGroups, clearAuthVerifyResult };
}

function setup(initialFgs: FeatureGroup[] = [], unassociated: FeatureGroup[] = []) {
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
  return { ...hookResult, getFeatureGroups: () => fgs, setFeatureGroups, clearAuthVerifyResult };
}

function setupSelectable(
  initialFgs: FeatureGroup[],
  opts: { selectedSvcId?: string; selectedEnvId?: string; omitClearAuth?: boolean; unassociated?: FeatureGroup[] },
) {
  const clearAuthVerifyResult = opts.omitClearAuth ? undefined : vi.fn();
  let fgs = initialFgs;
  const setFeatureGroups = vi.fn((updater: SetStateAction<FeatureGroup[]>) => {
    fgs = typeof updater === 'function' ? updater(fgs) : updater;
  });
  const hookResult = renderHook(() =>
    useScenarioMutations({
      featureGroups: fgs,
      setFeatureGroups,
      unassociatedFeatureGroups: opts.unassociated ?? [],
      selectedSvcId: opts.selectedSvcId,
      selectedEnvId: opts.selectedEnvId,
      clearAuthVerifyResult,
    }),
  );
  return { ...hookResult, getFeatureGroups: () => fgs, setFeatureGroups, clearAuthVerifyResult };
}

describe('useScenarioMutations', () => {

  describe('feature group CRUD', () => {
    it('addFeatureGroup creates a new feature group', () => {
      const { result, getFeatureGroups } = setup();
      act(() => { result.current.setNewName('My Feature'); });
      // Re-render to pick up newName
      act(() => { result.current.setNamingFeature(true); });
      act(() => { result.current.addFeatureGroup(); });
      const fgs = getFeatureGroups();
      expect(fgs.length).toBe(1);
      expect(fgs[0].name).toBe('My Feature');
      expect(fgs[0].microserviceId).toBe('svc-1');
    });

    it('addFeatureGroup does nothing without name', () => {
      const { result, getFeatureGroups } = setup();
      act(() => { result.current.addFeatureGroup(); });
      expect(getFeatureGroups().length).toBe(0);
    });

    it('addFeatureGroup does nothing without selected service or env', () => {
      const { result, getFeatureGroups } = setupWithoutEnv();
      act(() => { result.current.setNewName('Orphan FG'); });
      act(() => { result.current.addFeatureGroup(); });
      expect(getFeatureGroups().length).toBe(0);
    });

    it('removeFeatureGroup message includes counts when scenarios have tests', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1',
          name: 'Sc',
          tests: [scenarioFixture({ id: 't-1', name: 'T', url: '/' })],
        }],
      });
      const { result } = setup([fg]);
      act(() => { result.current.removeFeatureGroup('fg-1'); });
      expect(result.current.confirmDialog?.message).toContain('test(s)');
      expect(result.current.confirmDialog?.message).toContain('scenario(s)');
    });

    it('assignFeatureGroup updates svc and env', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.assignFeatureGroup('fg-1', 'svc-2', 'env-2'); });
      expect(getFeatureGroups()[0].microserviceId).toBe('svc-2');
      expect(getFeatureGroups()[0].environmentId).toBe('env-2');
    });

    it('removeFeatureGroup sets confirm dialog', () => {
      const fg = makeFg();
      const { result } = setup([fg]);
      act(() => { result.current.removeFeatureGroup('fg-1'); });
      expect(result.current.confirmDialog).not.toBeNull();
      expect(result.current.confirmDialog!.title).toBe('Delete Feature Group');
    });

    it('renameFeatureGroup updates name', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => {
        result.current.setEditName('Renamed');
        result.current.setEditingFeatureName('fg-1');
      });
      act(() => { result.current.renameFeatureGroup('fg-1'); });
      expect(getFeatureGroups()[0].name).toBe('Renamed');
    });
  });

  describe('scenario CRUD', () => {
    it('addScenario adds scenario to feature group', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setNewName('Scenario A'); });
      act(() => { result.current.addScenario('fg-1'); });
      expect(getFeatureGroups()[0].scenarios.length).toBe(1);
      expect(getFeatureGroups()[0].scenarios[0].name).toBe('Scenario A');
    });

    it('removeScenario sets confirm dialog', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result } = setup([fg]);
      act(() => { result.current.removeScenario('fg-1', 'sc-1'); });
      expect(result.current.confirmDialog!.title).toBe('Delete Scenario');
    });

    it('renameScenario updates name', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Old', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setEditName('New Name'); });
      act(() => { result.current.renameScenario('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].name).toBe('New Name');
    });
  });

  describe('test CRUD', () => {
    it('startNewTest sets editing state', () => {
      const { result, clearAuthVerifyResult } = setup();
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      expect(result.current.editingTest).toEqual({ featureId: 'fg-1', scenarioId: 'sc-1', testId: 'new' });
      expect(result.current.inputMode).toBe('builder');
      expect(clearAuthVerifyResult).toHaveBeenCalled();
    });

    it('startEditTest populates draft', () => {
      const test = scenarioFixture({
        id: 't-1',
        name: 'Test',
        url: '/api',
        validation: { mode: 'none', expectedFields: [] },
      });
      const { result } = setup();
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      expect(result.current.editingTest?.testId).toBe('t-1');
      expect(result.current.draft.name).toBe('Test');
    });

    it('saveTest does nothing if no editing or missing name', () => {
      const { result } = setup();
      act(() => { result.current.saveTest(); });
      expect(result.current.editingTest).toBeNull();
    });

    it('removeTest sets confirm dialog', () => {
      const fg = makeFg({
        scenarios: [{ id: 'sc-1', name: 'Sc', tests: [scenarioFixture({ id: 't-1', name: 'T', url: '/a' })] }],
      });
      const { result } = setup([fg]);
      act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
      expect(result.current.confirmDialog!.title).toBe('Delete Test');
    });
  });

  describe('auth', () => {
    it('toggleFeatureAuth calls clearAuthVerifyResult', () => {
      const fg = makeFg();
      const { result, clearAuthVerifyResult } = setup([fg]);
      act(() => { result.current.toggleFeatureAuth('fg-1'); });
      expect(clearAuthVerifyResult).toHaveBeenCalled();
      expect(result.current.editingFeatureAuth).toBe('fg-1');
    });

    it('toggleScenarioAuth calls clearAuthVerifyResult', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, clearAuthVerifyResult } = setup([fg]);
      act(() => { result.current.toggleScenarioAuth('fg-1', 'sc-1'); });
      expect(clearAuthVerifyResult).toHaveBeenCalled();
      expect(result.current.editingScenarioAuth).toBe('sc-1');
    });

    it('updateFeatureAuth sets auth config', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.updateFeatureAuth('fg-1', { type: 'bearer', token: 'abc' }); });
      expect(getFeatureGroups()[0].auth).toEqual({ type: 'bearer', token: 'abc' });
    });
  });

  describe('toggle helpers', () => {
    it('toggleFeature expands/collapses', () => {
      const { result } = setup();
      act(() => { result.current.toggleFeature('fg-1'); });
      expect(result.current.expandedFeatures.has('fg-1')).toBe(true);
      act(() => { result.current.toggleFeature('fg-1'); });
      expect(result.current.expandedFeatures.has('fg-1')).toBe(false);
    });

    it('toggleScenario expands/collapses', () => {
      const { result } = setup();
      act(() => { result.current.toggleScenario('sc-1'); });
      expect(result.current.expandedScenarios.has('sc-1')).toBe(true);
      act(() => { result.current.toggleScenario('sc-1'); });
      expect(result.current.expandedScenarios.has('sc-1')).toBe(false);
    });
  });

  describe('version handlers', () => {
    it('handleVersionDelete removes version from draft', () => {
      const { result } = setup();
      act(() => {
        result.current.setDraft({
          ...result.current.draft,
          definitionVersions: [{ id: 'v1', label: 'V1', timestamp: 0, snapshot: emptySnapshot() }],
        });
      });
      act(() => { result.current.handleVersionDelete('v1'); });
      expect(result.current.draft.definitionVersions).toEqual([]);
    });

    it('handleVersionDelete produces empty array when definitionVersions missing', () => {
      const { result } = setup();
      expect(result.current.draft.definitionVersions).toBeUndefined();
      act(() => { result.current.handleVersionDelete('v-any'); });
      expect(result.current.draft.definitionVersions).toEqual([]);
    });

    it('handleVersionRename updates label', () => {
      const { result } = setup();
      act(() => {
        result.current.setDraft({
          ...result.current.draft,
          definitionVersions: [{ id: 'v1', label: 'Old', timestamp: 0, snapshot: emptySnapshot() }],
        });
      });
      act(() => { result.current.handleVersionRename('v1', 'New Label'); });
      expect(result.current.draft.definitionVersions![0].label).toBe('New Label');
    });

    it('handleVersionRename is a no-op for unknown version id', () => {
      const { result } = setup();
      act(() => {
        result.current.setDraft({
          ...result.current.draft,
          definitionVersions: [{ id: 'v1', label: 'A', timestamp: 0, snapshot: emptySnapshot() }],
        });
      });
      act(() => { result.current.handleVersionRename('missing', 'B'); });
      expect(result.current.draft.definitionVersions!.map(v => v.label)).toEqual(['A']);
    });
  });

  describe('copy test', () => {
    it('startCopyTest and confirmCopyTest', () => {
      const test = scenarioFixture({
        id: 't-1',
        name: 'Test',
        url: '/api',
        headers: [{ key: 'k', value: 'v' }],
        validation: { mode: 'none', expectedFields: [] },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      expect(result.current.copyingTest).not.toBeNull();
      act(() => { result.current.confirmCopyTest('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].tests.length).toBe(1);
      expect(getFeatureGroups()[0].scenarios[0].tests[0].name).toBe('Test (copy)');
    });

    it('confirmCopyTest copies scenario without validation.expectedFields array', () => {
      const test = scenarioFixture({
        id: 't-1',
        name: 'Bare',
        url: '/api',
        validation: { mode: 'none' },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      act(() => { result.current.confirmCopyTest('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].validation.expectedFields).toBeUndefined();
    });

    it('confirmCopyTest clones validation.expectedFields when present', () => {
      const test = scenarioFixture({
        id: 't-1',
        name: 'V',
        url: '/api',
        validation: {
          mode: 'none',
          expectedFields: [{ path: '$.id', expected: '1' } as unknown as ExpectedField],
        },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      act(() => { result.current.confirmCopyTest('fg-1', 'sc-1'); });
      const copy = getFeatureGroups()[0].scenarios[0].tests[0];
      expect(copy.validation.expectedFields).toEqual([{ path: '$.id', expected: '1' }]);
      expect(copy.validation.expectedFields).not.toBe(test.validation.expectedFields);
    });

    it('confirmCopyTest does nothing when target scenario cannot be found', () => {
      const test = scenarioFixture({
        id: 't-1',
        name: 'Orphan',
        url: '/api',
        validation: { mode: 'none' },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      act(() => { result.current.confirmCopyTest('fg-1', 'missing-scenario'); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    });

    it('confirmCopyTest does nothing when target feature group id is unknown', () => {
      const test = scenarioFixture({
        id: 't-2',
        name: 'Misroute',
        url: '/api',
        validation: { mode: 'none' },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      act(() => { result.current.confirmCopyTest('ghost-fg', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    });

    it('confirmCopyTest does nothing without copyingTest', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.confirmCopyTest('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].tests.length).toBe(0);
    });
  });

  describe('version restore', () => {
    it('handleVersionRestore replaces draft fields from snapshot', () => {
      const test = scenarioFixture({
        id: 't-1',
        name: 'Old',
        url: '/old',
        definitionVersions: [],
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      const version: TestDefinitionVersion = {
        id: 'v1',
        label: 'v1',
        timestamp: 0,
        snapshot: {
          name: 'New',
          url: '/new',
          method: 'POST',
          headers: [{ key: 'h', value: 'v' }],
          body: '{}',
          bodyType: 'json',
          bodyForm: [],
          auth: { type: 'bearer', token: 't' },
          extractions: [],
        },
      };
      act(() => { result.current.handleVersionRestore(version); });
      expect(result.current.draft.name).toBe('New');
      expect(result.current.draft.url).toBe('/new');
      expect(result.current.draft.method).toBe('POST');
    });
  });

  describe('removeTest', () => {
    it('removeTest sets confirm dialog and onConfirm deletes test', () => {
      const test = scenarioFixture({ id: 't-1', name: 'Test', url: '/api', validation: { mode: 'none' } });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
      expect(result.current.confirmDialog).not.toBeNull();
      expect(result.current.confirmDialog!.title).toBe('Delete Test');
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios[0].tests.length).toBe(0);
    });

    it('removeTest confirm leaves tests unchanged when deleting an unknown id in the scenario', () => {
      const test = scenarioFixture({
        id: 't-kept',
        name: 'Keep',
        url: '/api',
        validation: { mode: 'none' },
      });
      const fg = makeFg({
        scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeTest('fg-1', 'sc-1', 'missing-test'); });
      expect(result.current.confirmDialog?.title).toBe('Delete Test');
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(1);
      expect(getFeatureGroups()[0].scenarios[0].tests[0].id).toBe('t-kept');
    });

    it('removeTest confirm is a global no-op when feature id is unknown', () => {
      const test = scenarioFixture({ id: 't-1', name: 'Lonely', url: '/api', validation: { mode: 'none' } });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeTest('wrong-fg', 'sc-1', 't-1'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(1);
    });
  });

  describe('saveTest', () => {
    it('saveTest updates existing test in featureGroups', () => {
      const test = scenarioFixture({
        id: 't-1',
        name: 'Test',
        url: '/api',
        definitionVersions: [],
        validation: { mode: 'none' },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({ ...prev, name: 'Updated', url: '/updated' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].name).toBe('Updated');
      expect(getFeatureGroups()[0].scenarios[0].tests[0].url).toBe('/updated');
    });

    it('saveTest adds new test to scenario', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({ ...prev, name: 'New Test', url: '/new' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests.length).toBe(1);
      expect(getFeatureGroups()[0].scenarios[0].tests[0].name).toBe('New Test');
    });

    it('saveTest skips versioning when autoSaveVersion returns null', () => {
      vi.mocked(autoSaveVersion).mockReturnValueOnce(null);
      const test = scenarioFixture({
        id: 't-1',
        name: 'Test',
        url: '/api',
        definitionVersions: [],
        validation: { mode: 'none' },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({ ...prev, name: 'Test', url: '/api-updated' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].url).toBe('/api-updated');
    });

    it('saveTest merges definition versions returned by autoSaveVersion', () => {
      vi.mocked(autoSaveVersion).mockReturnValueOnce([{ id: 'v-auto', label: 'auto', timestamp: 0, snapshot: emptySnapshot() }]);
      const test = scenarioFixture({
        id: 't-1',
        name: 'Test',
        url: '/api',
        validation: { mode: 'none' },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({ ...prev, name: 'Test', url: '/v2' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].definitionVersions).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'v-auto', label: 'auto' })]),
      );
    });

    it('saveTest logs rename when updating existing test title', () => {
      vi.mocked(logTestRenamed).mockClear();
      const test = scenarioFixture({ id: 't-1', name: 'Old', url: '/a', validation: { mode: 'none' } });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({ ...prev, name: 'New Title', url: '/a' }));
      });
      act(() => { result.current.saveTest(); });
      expect(vi.mocked(logTestRenamed)).toHaveBeenCalled();
    });

    it('saveTest skips rename log when saving same test name', () => {
      vi.mocked(logTestRenamed).mockClear();
      const test = scenarioFixture({ id: 't-1', name: 'Same', url: '/a', validation: { mode: 'none' } });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({ ...prev, name: 'Same', url: '/b' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].url).toBe('/b');
      expect(vi.mocked(logTestRenamed)).not.toHaveBeenCalled();
    });

    it('saveTest downgrades full validation when no expected JSON', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({
          ...prev,
          name: 'Validation Test',
          url: '/v',
          validation: { mode: 'full', expectedJson: '' },
        }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].validation.mode).toBe('none');
    });
  });

  describe('createParameterizedCopy', () => {
    it('creates a copy with parameterized flag', () => {
      const source = scenarioFixture({
        id: 't-1',
        name: 'Base Test',
        url: '/api',
        headers: [{ key: 'h', value: 'v' }],
        validation: {
          mode: 'none',
          expectedFields: [{ path: '$.x' } as unknown as ExpectedField],
        },
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [source] }] });
      const { result, clearAuthVerifyResult } = setup([fg]);
      act(() => { result.current.createParameterizedCopy('fg-1', 'sc-1', source); });
      expect(result.current.editingTest?.parameterized).toBe(true);
      expect(result.current.editingTest?.testId).toBe('new');
      expect(result.current.draft.name).toBe('Base Test (Parameterized)');
      expect(result.current.draft.sourceTestId).toBe('t-1');
      expect(result.current.activeTab).toBe('data');
      expect(clearAuthVerifyResult).toHaveBeenCalled();
    });

    it('clones validation when expectedFields undefined', () => {
      const source = scenarioFixture({
        id: 't-na',
        name: 'No EF',
        url: '/api',
        validation: { mode: 'none', statusCode: 201 } as unknown as Scenario['validation'],
      });
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [source] }] });
      const { result } = setup([fg]);
      act(() => { result.current.createParameterizedCopy('fg-1', 'sc-1', source); });
      expect(result.current.draft.validation).toMatchObject({ statusCode: 201 });
      expect(result.current.draft.validation.expectedFields).toBeUndefined();
    });
  });

  describe('startNewParameterizedTest', () => {
    it('sets parameterized flag and data tab', () => {
      const { result, clearAuthVerifyResult } = setup();
      act(() => { result.current.startNewParameterizedTest('fg-1', 'sc-1'); });
      expect(result.current.editingTest?.parameterized).toBe(true);
      expect(result.current.activeTab).toBe('data');
      expect(clearAuthVerifyResult).toHaveBeenCalled();
    });
  });

  describe('auth edge cases', () => {
    it('updateFeatureAuth with globalAuthProfileId for inherit', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.updateFeatureAuth('fg-1', { type: 'inherit' }, 'profile-1'); });
      expect(getFeatureGroups()[0].auth).toEqual({ type: 'inherit' });
      expect(getFeatureGroups()[0].globalAuthProfileId).toBe('profile-1');
    });

    it('keeps existing globalAuthProfileId when renewing inherit auth without profile argument', () => {
      const fg = makeFg({ auth: { type: 'inherit' }, globalAuthProfileId: 'retain' });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.updateFeatureAuth('fg-1', { type: 'inherit' }); });
      expect(getFeatureGroups()[0].globalAuthProfileId).toBe('retain');
    });

    it('updateFeatureAuth clears globalAuthProfileId for non-inherit', () => {
      const fg = makeFg({ globalAuthProfileId: 'profile-1' });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.updateFeatureAuth('fg-1', { type: 'bearer', token: 'x' }); });
      expect(getFeatureGroups()[0].globalAuthProfileId).toBeUndefined();
    });

    it('toggleFeatureAuth initializes auth to none when missing', () => {
      const fg = makeFg({ auth: undefined });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.toggleFeatureAuth('fg-1'); });
      expect(getFeatureGroups()[0].auth).toEqual({ type: 'none' });
    });

    it('toggleFeatureAuth skips auth injection when feature already has auth configured', () => {
      const fg = makeFg({ auth: { type: 'bearer', token: 'keep' } });
      const { result, setFeatureGroups } = setup([fg]);
      setFeatureGroups.mockClear();
      act(() => { result.current.toggleFeatureAuth('fg-1'); });
      expect(setFeatureGroups).not.toHaveBeenCalled();
      expect(result.current.editingFeatureAuth).toBe('fg-1');
    });

    it('toggleFeatureAuth closes when already open', () => {
      const fg = makeFg({ auth: { type: 'none' } });
      const { result } = setup([fg]);
      act(() => { result.current.toggleFeatureAuth('fg-1'); });
      expect(result.current.editingFeatureAuth).toBe('fg-1');
      act(() => { result.current.toggleFeatureAuth('fg-1'); });
      expect(result.current.editingFeatureAuth).toBeNull();
    });

    it('toggleScenarioAuth initializes auth to none when missing', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [], auth: undefined }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.toggleScenarioAuth('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].auth).toEqual({ type: 'none' });
    });

    it('toggleScenarioAuth skips auth injection when scenario already defines auth', () => {
      const fg = makeFg({
        scenarios: [{ id: 'sc-1', name: 'Sc', tests: [], auth: { type: 'digest', username: 'u', password: 'p' } }],
      });
      const { result, setFeatureGroups } = setup([fg]);
      setFeatureGroups.mockClear();
      act(() => { result.current.toggleScenarioAuth('fg-1', 'sc-1'); });
      expect(setFeatureGroups).not.toHaveBeenCalled();
      expect(result.current.editingScenarioAuth).toBe('sc-1');
    });

    it('toggleScenarioAuth closes when already open', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [], auth: { type: 'none' } }] });
      const { result } = setup([fg]);
      act(() => { result.current.toggleScenarioAuth('fg-1', 'sc-1'); });
      expect(result.current.editingScenarioAuth).toBe('sc-1');
      act(() => { result.current.toggleScenarioAuth('fg-1', 'sc-1'); });
      expect(result.current.editingScenarioAuth).toBeNull();
    });

    it('updateScenarioAuth sets auth on scenario', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.updateScenarioAuth('fg-1', 'sc-1', { type: 'apiKey', key: 'x-api', value: '123', addTo: 'header' }); });
      expect(getFeatureGroups()[0].scenarios[0].auth).toEqual({ type: 'apiKey', key: 'x-api', value: '123', addTo: 'header' });
    });
  });

  describe('confirm dialog execution', () => {
    it('removeFeatureGroup confirm removes the group', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [scenarioFixture({ id: 't-1', name: 'T', url: '/' })] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeFeatureGroup('fg-1'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups().length).toBe(0);
    });

    it('removeFeatureGroup message omits child counts when empty', () => {
      const fg = makeFg({ scenarios: [] });
      const { result } = setup([fg]);
      act(() => { result.current.removeFeatureGroup('fg-1'); });
      expect(result.current.confirmDialog!.message).not.toContain('It contains');
    });

    it('removeScenario confirm removes the scenario', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [scenarioFixture({ id: 't-1', name: 'T', url: '/' })] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeScenario('fg-1', 'sc-1'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios.length).toBe(0);
    });

    it('removeScenario message omits test counts when scenario has zero tests', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-z', name: 'Empty Scenario', tests: [] }] });
      const { result } = setup([fg]);
      act(() => { result.current.removeScenario('fg-1', 'sc-z'); });
      expect(result.current.confirmDialog!.message).not.toContain('It contains');
    });
  });

  describe('rename edge cases', () => {
    it('renameFeatureGroup does nothing with empty name', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setEditName('  '); });
      act(() => { result.current.renameFeatureGroup('fg-1'); });
      expect(getFeatureGroups()[0].name).toBe('Feature 1');
    });

    it('renameFeatureGroup skips rename log when name unchanged', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      vi.mocked(logFgRenamed).mockClear();
      act(() => { result.current.setEditName('Feature 1'); });
      act(() => { result.current.renameFeatureGroup('fg-1'); });
      expect(getFeatureGroups()[0].name).toBe('Feature 1');
      expect(vi.mocked(logFgRenamed)).not.toHaveBeenCalled();
    });

    it('renameScenario skips rename log when scenario name unchanged', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Same', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      vi.mocked(logScenarioRenamed).mockClear();
      act(() => { result.current.setEditName('Same'); });
      act(() => { result.current.renameScenario('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].name).toBe('Same');
      expect(vi.mocked(logScenarioRenamed)).not.toHaveBeenCalled();
    });

    it('renameScenario does nothing with empty name', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Old', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setEditName(''); });
      act(() => { result.current.renameScenario('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].name).toBe('Old');
    });

    it('addScenario does nothing with empty name', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setNewName(''); });
      act(() => { result.current.addScenario('fg-1'); });
      expect(getFeatureGroups()[0].scenarios.length).toBe(0);
    });
  });

  describe('branch coverage — multi-entity map paths and guards', () => {
    const minimalTest = (id: string, name: string, url = '/a'): Scenario =>
      scenarioFixture({ id, name, url });

    it('assignFeatureGroup is a no-op when id does not match', () => {
      const a = makeFg({ id: 'fg-a', name: 'A' });
      const b = makeFg({ id: 'fg-b', name: 'B' });
      const { result, getFeatureGroups } = setup([a, b]);
      act(() => { result.current.assignFeatureGroup('ghost', 'svc-x', 'env-x'); });
      expect(getFeatureGroups()[0].microserviceId).toBe('svc-1');
      expect(getFeatureGroups()[1].microserviceId).toBe('svc-1');
    });

    it('removeFeatureGroup handles unknown id without scenario reduction expression', () => {
      const { result } = setup([makeFg()]);
      act(() => { result.current.removeFeatureGroup('no-such'); });
      expect(result.current.confirmDialog!.message).not.toContain('scenario(s)');
    });

    it('removeFeatureGroup resolves feature group in unassociatedFeatureGroups', () => {
      const orphan = makeFg({ id: 'fg-orphan', name: 'Orphan' });
      const { result } = setup([], [orphan]);
      act(() => { result.current.removeFeatureGroup('fg-orphan'); });
      expect(result.current.confirmDialog!.title).toBe('Delete Feature Group');
    });

    it('renameFeatureGroup only mutates the matching feature group', () => {
      const a = makeFg({ id: 'fg-a', name: 'Keep' });
      const b = makeFg({ id: 'fg-b', name: 'Change' });
      const { result, getFeatureGroups } = setup([a, b]);
      act(() => { result.current.setEditName('Boom'); });
      act(() => { result.current.renameFeatureGroup('fg-b'); });
      expect(getFeatureGroups().find(f => f.id === 'fg-a')!.name).toBe('Keep');
      expect(getFeatureGroups().find(f => f.id === 'fg-b')!.name).toBe('Boom');
    });

    it('addScenario does not append when featureId is unknown', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setNewName('Lonely'); });
      act(() => { result.current.addScenario('unknown-fg'); });
      expect(getFeatureGroups()[0].scenarios).toHaveLength(0);
    });

    it('removeScenario uses zero tests when scenario id is unknown', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result } = setup([fg]);
      act(() => { result.current.removeScenario('fg-1', 'ghost-sc'); });
      expect(result.current.confirmDialog!.message).not.toContain('It contains');
    });

    it('updateScenarioAuth ignores non-matching feature groups', () => {
      const sa = (id: string): TestScenario => ({ id, name: id, tests: [] });
      const a = makeFg({ id: 'fg-a', scenarios: [sa('sc-a')] });
      const b = makeFg({ id: 'fg-b', scenarios: [sa('sc-b')] });
      const { result, getFeatureGroups } = setup([a, b]);
      act(() => { result.current.updateScenarioAuth('fg-b', 'sc-b', { type: 'basic', username: 'u', password: 'p' }); });
      expect(getFeatureGroups().find(f => f.id === 'fg-a')!.scenarios[0].auth).toBeUndefined();
      expect(getFeatureGroups().find(f => f.id === 'fg-b')!.scenarios[0].auth).toEqual({ type: 'basic', username: 'u', password: 'p' });
    });

    it('removeScenario confirm only updates the matching feature group', () => {
      const s = (id: string): TestScenario => ({ id, name: id, tests: [] });
      const a = makeFg({ id: 'fg-a', scenarios: [s('sc-a')] });
      const b = makeFg({ id: 'fg-b', scenarios: [s('sc-b')] });
      const { result, getFeatureGroups } = setup([a, b]);
      act(() => { result.current.removeScenario('fg-b', 'sc-b'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups().find(f => f.id === 'fg-a')!.scenarios).toHaveLength(1);
      expect(getFeatureGroups().find(f => f.id === 'fg-b')!.scenarios).toHaveLength(0);
    });

    it('removeScenario confirm is harmless when scenario id was unknown', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Only', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeScenario('fg-1', 'no-scenario'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios).toHaveLength(1);
    });

    it('renameScenario leaves non-matching feature groups untouched', () => {
      const a = makeFg({ id: 'fg-a', scenarios: [{ id: 'sc-a', name: 'A', tests: [] }] });
      const b = makeFg({ id: 'fg-b', scenarios: [{ id: 'sc-b', name: 'B', tests: [] }] });
      const { result, getFeatureGroups } = setup([a, b]);
      act(() => { result.current.setEditName('Bee'); });
      act(() => { result.current.renameScenario('fg-b', 'sc-b'); });
      expect(getFeatureGroups().find(f => f.id === 'fg-a')!.scenarios[0].name).toBe('A');
      expect(getFeatureGroups().find(f => f.id === 'fg-b')!.scenarios[0].name).toBe('Bee');
    });

    it('renameScenario skips log when scenario id is missing', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'X', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      vi.mocked(logScenarioRenamed).mockClear();
      act(() => { result.current.setEditName('Y'); });
      act(() => { result.current.renameScenario('fg-1', 'missing'); });
      expect(getFeatureGroups()[0].scenarios[0].name).toBe('X');
      expect(vi.mocked(logScenarioRenamed)).not.toHaveBeenCalled();
    });

    it('updateFeatureAuth ignores non-matching feature groups', () => {
      const a = makeFg({ id: 'fg-a' });
      const b = makeFg({ id: 'fg-b' });
      const { result, getFeatureGroups } = setup([a, b]);
      act(() => { result.current.updateFeatureAuth('fg-b', { type: 'none' }); });
      expect(getFeatureGroups().find(f => f.id === 'fg-a')!.auth).toBeUndefined();
      expect(getFeatureGroups().find(f => f.id === 'fg-b')!.auth).toEqual({ type: 'none' });
    });

    it('updateScenarioAuth only touches the targeted scenario', () => {
      const fg = makeFg({
        scenarios: [
          { id: 'sc-1', name: 'One', tests: [] },
          { id: 'sc-2', name: 'Two', tests: [] },
        ],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.updateScenarioAuth('fg-1', 'sc-2', { type: 'basic', username: 'u', password: 'p' }); });
      expect(getFeatureGroups()[0].scenarios[0].auth).toBeUndefined();
      expect(getFeatureGroups()[0].scenarios[1].auth).toEqual({ type: 'basic', username: 'u', password: 'p' });
    });

    it('saveTest skips non-matching feature groups in the updater', () => {
      const t = minimalTest('t-1', 'T', '/x');
      const a = makeFg({ id: 'fg-a', scenarios: [{ id: 'sc-a', name: 'SA', tests: [t] }] });
      const b = makeFg({ id: 'fg-b', scenarios: [{ id: 'sc-b', name: 'SB', tests: [] }] });
      const { result, getFeatureGroups } = setup([a, b]);
      act(() => { result.current.startNewTest('fg-b', 'sc-b'); });
      act(() => { result.current.setDraft((p: Scenario) => ({ ...p, name: 'New', url: '/n' })); });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups().find(f => f.id === 'fg-a')!.scenarios[0].tests).toHaveLength(1);
      expect(getFeatureGroups().find(f => f.id === 'fg-b')!.scenarios[0].tests[0].name).toBe('New');
    });

    it('saveTest skips non-matching scenarios when adding a test', () => {
      const fg = makeFg({
        scenarios: [
          { id: 'sc-a', name: 'A', tests: [] },
          { id: 'sc-b', name: 'B', tests: [] },
        ],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-b'); });
      act(() => { result.current.setDraft((p: Scenario) => ({ ...p, name: 'Only B', url: '/b' })); });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
      expect(getFeatureGroups()[0].scenarios[1].tests[0].name).toBe('Only B');
    });

    it('saveTest maps sibling tests when updating one of several', () => {
      const tKeep = minimalTest('t-keep', 'Keep', '/k');
      const tEdit = minimalTest('t-edit', 'Edit', '/e');
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [tKeep, tEdit] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', tEdit); });
      act(() => { result.current.setDraft((p: Scenario) => ({ ...p, name: 'Edited', url: '/e2' })); });
      act(() => { result.current.saveTest(); });
      const tests = getFeatureGroups()[0].scenarios[0].tests;
      expect(tests.find(t => t.id === 't-keep')).toMatchObject({ name: 'Keep', url: '/k' });
      expect(tests.find(t => t.id === 't-edit')).toMatchObject({ name: 'Edited', url: '/e2' });
    });

    it('saveTest still logs additions when scenario lookup misses', () => {
      vi.mocked(logTestAdded).mockClear();
      const fg = makeFg({ scenarios: [{ id: 'sc-real', name: 'Real', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-ghost'); });
      act(() => { result.current.setDraft((p: Scenario) => ({ ...p, name: 'Orphan try', url: '/o' })); });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
      expect(vi.mocked(logTestAdded)).toHaveBeenCalled();
    });

    it('saveTest skips rename log when existing test id missing from scenario list', () => {
      vi.mocked(logTestRenamed).mockClear();
      const t = minimalTest('t-1', 'Old', '/a');
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [t] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', t); });
      act(() => { result.current.setDraft((p: Scenario) => ({ ...p, id: 'ghost-id', name: 'N', url: '/b' })); });
      act(() => { result.current.saveTest(); });
      expect(vi.mocked(logTestRenamed)).not.toHaveBeenCalled();
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(1);
      expect(getFeatureGroups()[0].scenarios[0].tests[0]).toMatchObject({ id: 't-1', name: 'Old' });
    });

    it('handleVersionRename uses empty definitions array when snapshot has none', () => {
      const { result } = setup();
      expect(result.current.draft.definitionVersions).toBeUndefined();
      act(() => { result.current.handleVersionRename('any', 'L'); });
      expect(result.current.draft.definitionVersions).toEqual([]);
    });

    it('removeTest onConfirm skips unrelated feature groups', () => {
      const ta = minimalTest('t-a', 'A', '/a');
      const tb = minimalTest('t-b', 'B', '/b');
      const a = makeFg({ id: 'fg-a', scenarios: [{ id: 'sc-a', name: 'SA', tests: [ta] }] });
      const b = makeFg({ id: 'fg-b', scenarios: [{ id: 'sc-b', name: 'SB', tests: [tb] }] });
      const { result, getFeatureGroups } = setup([a, b]);
      act(() => { result.current.removeTest('fg-b', 'sc-b', 't-b'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups().find(f => f.id === 'fg-a')!.scenarios[0].tests).toHaveLength(1);
      expect(getFeatureGroups().find(f => f.id === 'fg-b')!.scenarios[0].tests).toHaveLength(0);
    });

    it('removeTest onConfirm keeps sibling tests in the scenario map', () => {
      const t1 = minimalTest('t-1', 'One', '/1');
      const t2 = minimalTest('t-2', 'Two', '/2');
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [t1, t2] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios[0].tests.map(t => t.id)).toEqual(['t-2']);
    });

    it('addFeatureGroup returns early when only environment is selected', () => {
      const { result, getFeatureGroups } = setupSelectable([], { selectedEnvId: 'env-1' });
      act(() => { result.current.setNewName('Half'); });
      act(() => { result.current.addFeatureGroup(); });
      expect(getFeatureGroups()).toHaveLength(0);
    });

    it('addFeatureGroup returns early when only microservice is selected', () => {
      const { result, getFeatureGroups } = setupSelectable([], { selectedSvcId: 'svc-1' });
      act(() => { result.current.setNewName('Half'); });
      act(() => { result.current.addFeatureGroup(); });
      expect(getFeatureGroups()).toHaveLength(0);
    });

    it('startNewTest does not throw when clearAuthVerifyResult is omitted', () => {
      const { result } = setupSelectable([makeFg()], { selectedSvcId: 'svc-1', selectedEnvId: 'env-1', omitClearAuth: true });
      expect(() => act(() => { result.current.startNewTest('fg-1', 'sc-1'); })).not.toThrow();
    });
  });
});
