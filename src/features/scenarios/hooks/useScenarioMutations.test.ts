/**
 * @vitest-environment jsdom
 *
 * Core useScenarioMutations tests: feature group / scenario / test CRUD, auth,
 * toggle helpers, version handling, copy, and (hard-delete) confirm-dialog
 * execution.
 *
 * Soft-delete (moveToTrash) coverage lives in
 * `useScenarioMutations.softDelete.test.ts`. Shared factories live in
 * `__test-utils__/useScenarioMutationsTestFixtures.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import type {
  FeatureGroup,
  Scenario,
  TestDefinitionVersion,
  ExpectedField,
} from '../../../shared/types';

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

import { autoSaveVersion } from '../utils/testDefinitionVersioning';
import { logTestRenamed } from '../utils/structureChangeLog';
import {
  emptySnapshot,
  scenarioFixture,
  makeFg,
  setup,
  setupWithoutEnv,
} from './__test-utils__/useScenarioMutationsTestFixtures';

describe('useScenarioMutations', () => {
  describe('feature group CRUD', () => {
    it('addFeatureGroup creates a new feature group', () => {
      const { result, getFeatureGroups } = setup();
      act(() => { result.current.setNewName('My Feature'); });
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

    it('assignFeatureGroup with multi-FG only updates target', () => {
      const fg1 = makeFg({ id: 'fg-1', name: 'F1' });
      const fg2 = makeFg({ id: 'fg-2', name: 'F2' });
      const { result, getFeatureGroups } = setup([fg1, fg2]);
      act(() => { result.current.assignFeatureGroup('fg-1', 'svc-new', 'env-new'); });
      expect(getFeatureGroups()[0].microserviceId).toBe('svc-new');
      expect(getFeatureGroups()[1].microserviceId).toBe('svc-1');
    });

    it('renameFeatureGroup with multi-FG only updates target', () => {
      const fg1 = makeFg({ id: 'fg-1', name: 'F1' });
      const fg2 = makeFg({ id: 'fg-2', name: 'F2' });
      const { result, getFeatureGroups } = setup([fg1, fg2]);
      act(() => { result.current.setEditingFeatureName('fg-1'); });
      act(() => { result.current.setEditName('Renamed'); });
      act(() => { result.current.renameFeatureGroup('fg-1'); });
      expect(getFeatureGroups()[0].name).toBe('Renamed');
      expect(getFeatureGroups()[1].name).toBe('F2');
    });

    it('renameFeatureGroup is no-op when name unchanged', () => {
      const fg1 = makeFg({ id: 'fg-1', name: 'Same' });
      const { result, getFeatureGroups } = setup([fg1]);
      act(() => { result.current.setEditingFeatureName('fg-1'); });
      act(() => { result.current.setEditName('Same'); });
      act(() => { result.current.renameFeatureGroup('fg-1'); });
      expect(getFeatureGroups()[0].name).toBe('Same');
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

    it('addScenario with multi-FG only adds to target FG', () => {
      const fg1 = makeFg({ id: 'fg-1', name: 'F1' });
      const fg2 = makeFg({ id: 'fg-2', name: 'F2' });
      const { result, getFeatureGroups } = setup([fg1, fg2]);
      act(() => { result.current.setNewName('New SC'); });
      act(() => { result.current.addScenario('fg-1'); });
      expect(getFeatureGroups()[0].scenarios).toHaveLength(1);
      expect(getFeatureGroups()[1].scenarios).toHaveLength(0);
    });

    it('removeScenario with multi-FG only removes from target FG', () => {
      const fg1 = makeFg({
        id: 'fg-1', name: 'F1',
        scenarios: [{ id: 'sc-1', name: 'SC1', tests: [] }],
      });
      const fg2 = makeFg({
        id: 'fg-2', name: 'F2',
        scenarios: [{ id: 'sc-2', name: 'SC2', tests: [] }],
      });
      const { result, getFeatureGroups } = setup([fg1, fg2]);
      act(() => { result.current.removeScenario('fg-1', 'sc-1'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios).toHaveLength(0);
      expect(getFeatureGroups()[1].scenarios).toHaveLength(1);
    });

    it('renameScenario with multi-FG only renames in target FG', () => {
      const fg1 = makeFg({
        id: 'fg-1', name: 'F1',
        scenarios: [{ id: 'sc-1', name: 'Old', tests: [] }, { id: 'sc-2', name: 'Other', tests: [] }],
      });
      const fg2 = makeFg({ id: 'fg-2', name: 'F2', scenarios: [{ id: 'sc-3', name: 'X', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg1, fg2]);
      act(() => { result.current.setEditName('Renamed SC'); });
      act(() => { result.current.renameScenario('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].name).toBe('Renamed SC');
      expect(getFeatureGroups()[0].scenarios[1].name).toBe('Other');
      expect(getFeatureGroups()[1].scenarios[0].name).toBe('X');
    });

    it('renameScenario is no-op when name unchanged', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Same', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setEditName('Same'); });
      act(() => { result.current.renameScenario('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].name).toBe('Same');
    });

    it('removeScenario with multi-SC keeps non-target SC', () => {
      const fg = makeFg({
        scenarios: [
          { id: 'sc-1', name: 'SC1', tests: [] },
          { id: 'sc-2', name: 'SC2', tests: [] },
        ],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeScenario('fg-1', 'sc-1'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios).toHaveLength(1);
      expect(getFeatureGroups()[0].scenarios[0].id).toBe('sc-2');
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

    it('updateFeatureAuth with multi-FG only updates target', () => {
      const fg1 = makeFg({ id: 'fg-1', name: 'F1' });
      const fg2 = makeFg({ id: 'fg-2', name: 'F2' });
      const { result, getFeatureGroups } = setup([fg1, fg2]);
      act(() => { result.current.updateFeatureAuth('fg-1', { type: 'bearer', token: 'x' }); });
      expect(getFeatureGroups()[0].auth).toEqual({ type: 'bearer', token: 'x' });
      expect(getFeatureGroups()[1].auth).toBeUndefined();
    });

    it('updateScenarioAuth with multi-FG/SC only updates target', () => {
      const fg1 = makeFg({
        id: 'fg-1', name: 'F1',
        scenarios: [
          { id: 'sc-1', name: 'SC1', tests: [] },
          { id: 'sc-2', name: 'SC2', tests: [] },
        ],
      });
      const fg2 = makeFg({ id: 'fg-2', name: 'F2', scenarios: [{ id: 'sc-3', name: 'SC3', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg1, fg2]);
      act(() => { result.current.updateScenarioAuth('fg-1', 'sc-1', { type: 'bearer', token: 'y' }); });
      expect(getFeatureGroups()[0].scenarios[0].auth).toEqual({ type: 'bearer', token: 'y' });
      expect(getFeatureGroups()[0].scenarios[1].auth).toBeUndefined();
      expect(getFeatureGroups()[1].scenarios[0].auth).toBeUndefined();
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

  it('handleVersionRename with undefined definitionVersions', () => {
    const test = scenarioFixture({ id: 't-1', name: 'T', url: '/api' });
    const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
    const { result } = setup([fg]);
    act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
    act(() => { result.current.handleVersionRename('v1', 'renamed'); });
    expect(result.current.draft.definitionVersions).toEqual([]);
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

    it('saveTest with multi-FG/SC only updates target', () => {
      const test = scenarioFixture({ id: 't-1', name: 'Test', url: '/api', validation: { mode: 'none' } });
      const fg1 = makeFg({
        id: 'fg-1', name: 'F1',
        scenarios: [
          { id: 'sc-1', name: 'SC1', tests: [test] },
          { id: 'sc-2', name: 'SC2', tests: [scenarioFixture({ id: 't-2', name: 'T2' })] },
        ],
      });
      const fg2 = makeFg({
        id: 'fg-2', name: 'F2',
        scenarios: [{ id: 'sc-3', name: 'SC3', tests: [scenarioFixture({ id: 't-3', name: 'T3' })] }],
      });
      const { result, getFeatureGroups } = setup([fg1, fg2]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({ ...prev, name: 'Updated', url: '/updated' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].name).toBe('Updated');
      expect(getFeatureGroups()[0].scenarios[1].tests[0].name).toBe('T2');
      expect(getFeatureGroups()[1].scenarios[0].tests[0].name).toBe('T3');
    });

    it('saveTest bails when parameterized scenario has no dataSource', () => {
      const test = scenarioFixture({ id: 't-param', name: 'Param Test', url: '/api' });
      const fg = makeFg({
        scenarios: [{ id: 'sc-param', name: 'Parameterized Sc', kind: 'parameterized', tests: [test] }],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-param', test); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({ ...prev, name: 'Changed', url: '/changed' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].name).toBe('Param Test');
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

    it('saveTest is blocked for wsConnect without url', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({
          ...prev,
          name: 'WS Connect',
          url: '',
          actionType: 'wsConnect',
          wsConnectAction: { url: '  ', headers: [], timeoutMs: 5000 },
        }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    });

    it('saveTest is blocked for wsSend without connectionRef', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({
          ...prev,
          name: 'WS Send',
          url: '',
          actionType: 'wsSend',
          wsSendAction: { connectionRef: '', payload: '{}' },
        }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    });

    it('saveTest is blocked for wsReceive without connectionRef', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({
          ...prev,
          name: 'WS Receive',
          url: '',
          actionType: 'wsReceive',
          wsReceiveAction: { connectionRef: '', timeoutMs: 10_000, matchCriteria: {} },
        }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    });

    it('saveTest is blocked for wsReceive with jsonPathValue but no jsonPathMatch', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({
          ...prev,
          name: 'WS Receive Match',
          url: '',
          actionType: 'wsReceive',
          wsReceiveAction: {
            connectionRef: 'chat',
            timeoutMs: 10_000,
            matchCriteria: { jsonPathValue: 'hello' },
          },
        }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    });

    it('saveTest succeeds for wsReceive with valid match criteria', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft((prev: Scenario) => ({
          ...prev,
          name: 'WS Receive OK',
          url: '',
          actionType: 'wsReceive',
          wsReceiveAction: {
            connectionRef: 'chat',
            timeoutMs: 10_000,
            matchCriteria: { jsonPathValue: 'hello', jsonPathMatch: '$.msg' },
          },
        }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].actionType).toBe('wsReceive');
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

  describe('SLA targets', () => {
    const makeTarget = (overrides: Partial<import('../../../shared/types').SlaTarget> = {}): import('../../../shared/types').SlaTarget => ({
      id: 'sla-1',
      metric: 'p95',
      operator: 'lte',
      value: 800,
      ...overrides,
    });

    describe('updateScenarioSlaTargets', () => {
      it('sets slaTargets on the matching scenario', () => {
        const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Cart', kind: 'standard', tests: [] }] });
        const { result, getFeatureGroups } = setup([fg]);
        const targets = [makeTarget()];
        act(() => { result.current.updateScenarioSlaTargets('fg-1', 'sc-1', targets); });
        expect(getFeatureGroups()[0].scenarios[0].slaTargets).toEqual(targets);
      });

      it('does not affect other scenarios in the same feature group', () => {
        const fg = makeFg({
          scenarios: [
            { id: 'sc-1', name: 'Cart', kind: 'standard' as const, tests: [] },
            { id: 'sc-2', name: 'Login', kind: 'standard' as const, tests: [] },
          ],
        });
        const { result, getFeatureGroups } = setup([fg]);
        act(() => { result.current.updateScenarioSlaTargets('fg-1', 'sc-1', [makeTarget()]); });
        expect(getFeatureGroups()[0].scenarios[1].slaTargets).toBeUndefined();
      });

      it('does not affect other feature groups', () => {
        const fg1 = makeFg({ id: 'fg-1', scenarios: [{ id: 'sc-1', name: 'Cart', kind: 'standard' as const, tests: [] }] });
        const fg2 = makeFg({ id: 'fg-2', scenarios: [{ id: 'sc-2', name: 'Login', kind: 'standard' as const, tests: [] }] });
        const { result, getFeatureGroups } = setup([fg1, fg2]);
        act(() => { result.current.updateScenarioSlaTargets('fg-1', 'sc-1', [makeTarget()]); });
        expect(getFeatureGroups()[1].scenarios[0].slaTargets).toBeUndefined();
      });

      it('can clear targets by passing an empty array', () => {
        const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Cart', kind: 'standard' as const, tests: [], slaTargets: [makeTarget()] }] });
        const { result, getFeatureGroups } = setup([fg]);
        act(() => { result.current.updateScenarioSlaTargets('fg-1', 'sc-1', []); });
        expect(getFeatureGroups()[0].scenarios[0].slaTargets).toEqual([]);
      });

      it('is a no-op when feature group id is unknown', () => {
        const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Cart', kind: 'standard' as const, tests: [] }] });
        const { result, getFeatureGroups } = setup([fg]);
        act(() => { result.current.updateScenarioSlaTargets('fg-NOPE', 'sc-1', [makeTarget()]); });
        expect(getFeatureGroups()[0].scenarios[0].slaTargets).toBeUndefined();
      });

      it('is a no-op when scenario id is unknown', () => {
        const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Cart', kind: 'standard' as const, tests: [] }] });
        const { result, getFeatureGroups } = setup([fg]);
        act(() => { result.current.updateScenarioSlaTargets('fg-1', 'sc-NOPE', [makeTarget()]); });
        expect(getFeatureGroups()[0].scenarios[0].slaTargets).toBeUndefined();
      });

      it('replaces the full targets array (not appends)', () => {
        const initial = [makeTarget({ id: 'sla-1', value: 800 })];
        const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Cart', kind: 'standard' as const, tests: [], slaTargets: initial }] });
        const { result, getFeatureGroups } = setup([fg]);
        const updated = [makeTarget({ id: 'sla-2', value: 500 })];
        act(() => { result.current.updateScenarioSlaTargets('fg-1', 'sc-1', updated); });
        const saved = getFeatureGroups()[0].scenarios[0].slaTargets!;
        expect(saved).toHaveLength(1);
        expect(saved[0].id).toBe('sla-2');
      });
    });

    describe('updateFeatureGroupSlaTargets', () => {
      it('sets slaTargets on the matching feature group', () => {
        const fg = makeFg();
        const { result, getFeatureGroups } = setup([fg]);
        const targets = [makeTarget()];
        act(() => { result.current.updateFeatureGroupSlaTargets('fg-1', targets); });
        expect(getFeatureGroups()[0].slaTargets).toEqual(targets);
      });

      it('does not affect other feature groups', () => {
        const fg1 = makeFg({ id: 'fg-1' });
        const fg2 = makeFg({ id: 'fg-2' });
        const { result, getFeatureGroups } = setup([fg1, fg2]);
        act(() => { result.current.updateFeatureGroupSlaTargets('fg-1', [makeTarget()]); });
        expect(getFeatureGroups()[1].slaTargets).toBeUndefined();
      });

      it('can clear targets by passing an empty array', () => {
        const fg = makeFg({ slaTargets: [makeTarget()] });
        const { result, getFeatureGroups } = setup([fg]);
        act(() => { result.current.updateFeatureGroupSlaTargets('fg-1', []); });
        expect(getFeatureGroups()[0].slaTargets).toEqual([]);
      });

      it('is a no-op when feature group id is unknown', () => {
        const fg = makeFg();
        const { result, getFeatureGroups } = setup([fg]);
        act(() => { result.current.updateFeatureGroupSlaTargets('fg-NOPE', [makeTarget()]); });
        expect(getFeatureGroups()[0].slaTargets).toBeUndefined();
      });

      it('replaces the full targets array (not appends)', () => {
        const fg = makeFg({ slaTargets: [makeTarget({ id: 'sla-old', value: 1000 })] });
        const { result, getFeatureGroups } = setup([fg]);
        const fresh = [makeTarget({ id: 'sla-new', value: 400 })];
        act(() => { result.current.updateFeatureGroupSlaTargets('fg-1', fresh); });
        const saved = getFeatureGroups()[0].slaTargets!;
        expect(saved).toHaveLength(1);
        expect(saved[0].id).toBe('sla-new');
      });
    });

    describe('updateTestSlaTargets', () => {
      it('sets slaTargets on the matching test', () => {
        const test = scenarioFixture({ id: 't-1', name: 'Login', url: '/login' });
        const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Auth', kind: 'standard', tests: [test] }] });
        const { result, getFeatureGroups } = setup([fg]);
        const targets = [makeTarget({ id: 'sla-test', value: 400 })];
        act(() => { result.current.updateTestSlaTargets('fg-1', 'sc-1', 't-1', targets); });
        expect(getFeatureGroups()[0].scenarios[0].tests[0].slaTargets).toEqual(targets);
      });

      it('does not affect sibling tests or other scenarios', () => {
        const t1 = scenarioFixture({ id: 't-1', name: 'A', url: '/a' });
        const t2 = scenarioFixture({ id: 't-2', name: 'B', url: '/b' });
        const fg = makeFg({
          scenarios: [
            { id: 'sc-1', name: 'One', kind: 'standard' as const, tests: [t1, t2] },
            { id: 'sc-2', name: 'Two', kind: 'standard' as const, tests: [scenarioFixture({ id: 't-3', name: 'C', url: '/c' })] },
          ],
        });
        const { result, getFeatureGroups } = setup([fg]);
        act(() => { result.current.updateTestSlaTargets('fg-1', 'sc-1', 't-1', [makeTarget()]); });
        expect(getFeatureGroups()[0].scenarios[0].tests[1].slaTargets).toBeUndefined();
        expect(getFeatureGroups()[0].scenarios[1].tests[0].slaTargets).toBeUndefined();
      });

      it('is a no-op when feature group, scenario, or test id is unknown', () => {
        const test = scenarioFixture({ id: 't-1', name: 'Login', url: '/login' });
        const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Auth', kind: 'standard', tests: [test] }] });
        const { result, getFeatureGroups } = setup([fg]);
        act(() => { result.current.updateTestSlaTargets('fg-NOPE', 'sc-1', 't-1', [makeTarget()]); });
        act(() => { result.current.updateTestSlaTargets('fg-1', 'sc-NOPE', 't-1', [makeTarget()]); });
        act(() => { result.current.updateTestSlaTargets('fg-1', 'sc-1', 't-NOPE', [makeTarget()]); });
        expect(getFeatureGroups()[0].scenarios[0].tests[0].slaTargets).toBeUndefined();
      });
    });
  });
});
