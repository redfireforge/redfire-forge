/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../utils/structureChangeLog', () => ({
  logScenarioAdded: vi.fn((...args: any[]) => args[0]),
  logScenarioRemoved: vi.fn((...args: any[]) => args[0]),
  logScenarioRenamed: vi.fn((...args: any[]) => args[0]),
  logTestAdded: vi.fn((...args: any[]) => args[0]),
  logTestRemoved: vi.fn((...args: any[]) => args[0]),
  logTestCopied: vi.fn((...args: any[]) => args[0]),
  logFgRenamed: vi.fn((...args: any[]) => args[0]),
  logTestRenamed: vi.fn((...args: any[]) => args[0]),
}));

vi.mock('../utils/testDefinitionVersioning', () => ({
  autoSaveVersion: vi.fn((t: any) => t),
}));

import { useScenarioMutations } from './useScenarioMutations';
import { autoSaveVersion } from '../utils/testDefinitionVersioning';
import { logFgRenamed, logScenarioRenamed, logTestRenamed } from '../utils/structureChangeLog';
import type { FeatureGroup } from '../../../shared/types';

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
  const setFeatureGroups = vi.fn((updater: any) => {
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

function setup(initialFgs: FeatureGroup[] = []) {
  const clearAuthVerifyResult = vi.fn();
  let fgs = initialFgs;
  const setFeatureGroups = vi.fn((updater: any) => {
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
          tests: [{ id: 't-1', name: 'T', url: '/', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200 }, extractions: [] } as any],
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
      const { result, getFeatureGroups } = setup([fg]);
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
      const { result, getFeatureGroups } = setup([fg]);
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
      const { result, getFeatureGroups, clearAuthVerifyResult } = setup();
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      expect(result.current.editingTest).toEqual({ featureId: 'fg-1', scenarioId: 'sc-1', testId: 'new' });
      expect(result.current.inputMode).toBe('builder');
      expect(clearAuthVerifyResult).toHaveBeenCalled();
    });

    it('startEditTest populates draft', () => {
      const test = { id: 't-1', name: 'Test', url: '/api', method: 'GET' as const, headers: [], body: '', bodyType: 'none' as const, bodyForm: [], auth: { type: 'none' as const }, validation: { statusCode: 200, expectedFields: [] }, extractions: [] };
      const { result, getFeatureGroups } = setup();
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test as any); });
      expect(result.current.editingTest?.testId).toBe('t-1');
      expect(result.current.draft.name).toBe('Test');
    });

    it('saveTest does nothing if no editing or missing name', () => {
      const { result, getFeatureGroups } = setup();
      act(() => { result.current.saveTest(); });
      expect(result.current.editingTest).toBeNull();
    });

    it('removeTest sets confirm dialog', () => {
      const fg = makeFg({
        scenarios: [{ id: 'sc-1', name: 'Sc', tests: [{ id: 't-1', name: 'T', url: '/a', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200 }, extractions: [] } as any] }],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
      expect(result.current.confirmDialog!.title).toBe('Delete Test');
    });
  });

  describe('auth', () => {
    it('toggleFeatureAuth calls clearAuthVerifyResult', () => {
      const fg = makeFg();
      const { result, getFeatureGroups, clearAuthVerifyResult } = setup([fg]);
      act(() => { result.current.toggleFeatureAuth('fg-1'); });
      expect(clearAuthVerifyResult).toHaveBeenCalled();
      expect(result.current.editingFeatureAuth).toBe('fg-1');
    });

    it('toggleScenarioAuth calls clearAuthVerifyResult', () => {
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups, clearAuthVerifyResult } = setup([fg]);
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
      const { result, getFeatureGroups } = setup();
      act(() => { result.current.toggleFeature('fg-1'); });
      expect(result.current.expandedFeatures.has('fg-1')).toBe(true);
      act(() => { result.current.toggleFeature('fg-1'); });
      expect(result.current.expandedFeatures.has('fg-1')).toBe(false);
    });

    it('toggleScenario expands/collapses', () => {
      const { result, getFeatureGroups } = setup();
      act(() => { result.current.toggleScenario('sc-1'); });
      expect(result.current.expandedScenarios.has('sc-1')).toBe(true);
      act(() => { result.current.toggleScenario('sc-1'); });
      expect(result.current.expandedScenarios.has('sc-1')).toBe(false);
    });
  });

  describe('version handlers', () => {
    it('handleVersionDelete removes version from draft', () => {
      const { result, getFeatureGroups } = setup();
      act(() => {
        result.current.setDraft({
          ...result.current.draft,
          definitionVersions: [{ id: 'v1', label: 'V1', timestamp: 0, snapshot: {} as any }],
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
      const { result, getFeatureGroups } = setup();
      act(() => {
        result.current.setDraft({
          ...result.current.draft,
          definitionVersions: [{ id: 'v1', label: 'Old', timestamp: 0, snapshot: {} as any }],
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
          definitionVersions: [{ id: 'v1', label: 'A', timestamp: 0, snapshot: {} as any }],
        });
      });
      act(() => { result.current.handleVersionRename('missing', 'B'); });
      expect(result.current.draft.definitionVersions!.map(v => v.label)).toEqual(['A']);
    });
  });

  describe('copy test', () => {
    it('startCopyTest and confirmCopyTest', () => {
      const test = { id: 't-1', name: 'Test', url: '/api', method: 'GET', headers: [{ key: 'k', value: 'v' }], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200, expectedFields: [] }, extractions: [] } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      expect(result.current.copyingTest).not.toBeNull();
      act(() => { result.current.confirmCopyTest('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].tests.length).toBe(1);
      expect(getFeatureGroups()[0].scenarios[0].tests[0].name).toBe('Test (copy)');
    });

    it('confirmCopyTest copies scenario without validation.expectedFields array', () => {
      const test = {
        id: 't-1',
        name: 'Bare',
        url: '/api',
        method: 'GET',
        headers: [],
        body: '',
        bodyType: 'none',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { statusCode: 200 },
        extractions: [],
      } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      act(() => { result.current.confirmCopyTest('fg-1', 'sc-1'); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].validation.expectedFields).toBeUndefined();
    });

    it('confirmCopyTest clones validation.expectedFields when present', () => {
      const test = {
        id: 't-1',
        name: 'V',
        url: '/api',
        method: 'GET',
        headers: [],
        body: '',
        bodyType: 'none',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { statusCode: 200, expectedFields: [{ path: '$.id', expected: '1' }] },
        extractions: [],
      } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      act(() => { result.current.confirmCopyTest('fg-1', 'sc-1'); });
      const copy = getFeatureGroups()[0].scenarios[0].tests[0];
      expect(copy.validation.expectedFields).toEqual([{ path: '$.id', expected: '1' }]);
      expect(copy.validation.expectedFields).not.toBe(test.validation.expectedFields);
    });

    it('confirmCopyTest does nothing when target scenario cannot be found', () => {
      const test = {
        id: 't-1',
        name: 'Orphan',
        url: '/api',
        method: 'GET',
        headers: [],
        body: '',
        bodyType: 'none',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { statusCode: 200 },
        extractions: [],
      } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startCopyTest('fg-1', 'sc-1', test); });
      act(() => { result.current.confirmCopyTest('fg-1', 'missing-scenario'); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    });

    it('confirmCopyTest does nothing when target feature group id is unknown', () => {
      const test = {
        id: 't-2',
        name: 'Misroute',
        url: '/api',
        method: 'GET',
        headers: [],
        body: '',
        bodyType: 'none',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { statusCode: 200 },
        extractions: [],
      } as any;
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
      const test = { id: 't-1', name: 'Old', url: '/old', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200 }, extractions: [], definitionVersions: [] } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      const version = { id: 'v1', label: 'v1', createdAt: 0, snapshot: { name: 'New', url: '/new', method: 'POST', headers: [{ key: 'h', value: 'v' }], body: '{}', bodyType: 'json', bodyForm: [], auth: { type: 'bearer' }, extractions: [] } };
      act(() => { result.current.handleVersionRestore(version as any); });
      expect(result.current.draft.name).toBe('New');
      expect(result.current.draft.url).toBe('/new');
      expect(result.current.draft.method).toBe('POST');
    });
  });

  describe('removeTest', () => {
    it('removeTest sets confirm dialog and onConfirm deletes test', () => {
      const test = { id: 't-1', name: 'Test', url: '/api', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200 }, extractions: [] } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeTest('fg-1', 'sc-1', 't-1'); });
      expect(result.current.confirmDialog).not.toBeNull();
      expect(result.current.confirmDialog!.title).toBe('Delete Test');
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios[0].tests.length).toBe(0);
    });

    it('removeTest confirm leaves tests unchanged when deleting an unknown id in the scenario', () => {
      const test = {
        id: 't-kept',
        name: 'Keep',
        url: '/api',
        method: 'GET',
        headers: [],
        body: '',
        bodyType: 'none',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { statusCode: 200 },
        extractions: [],
      } as any;
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
      const test = { id: 't-1', name: 'Lonely', url: '/api', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200 }, extractions: [] } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.removeTest('wrong-fg', 'sc-1', 't-1'); });
      act(() => { result.current.confirmDialog!.onConfirm(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(1);
    });
  });

  describe('saveTest', () => {
    it('saveTest updates existing test in featureGroups', () => {
      const test = { id: 't-1', name: 'Test', url: '/api', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200 }, extractions: [], definitionVersions: [] } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: any) => ({ ...prev, name: 'Updated', url: '/updated' }));
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
        result.current.setDraft((prev: any) => ({ ...prev, name: 'New Test', url: '/new' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests.length).toBe(1);
      expect(getFeatureGroups()[0].scenarios[0].tests[0].name).toBe('New Test');
    });

    it('saveTest skips versioning when autoSaveVersion returns null', () => {
      vi.mocked(autoSaveVersion).mockReturnValueOnce(null);
      const test = {
        id: 't-1',
        name: 'Test',
        url: '/api',
        method: 'GET',
        headers: [],
        body: '',
        bodyType: 'none',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { statusCode: 200 },
        extractions: [],
        definitionVersions: [],
      } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: any) => ({ ...prev, name: 'Test', url: '/api-updated' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].url).toBe('/api-updated');
    });

    it('saveTest merges definition versions returned by autoSaveVersion', () => {
      vi.mocked(autoSaveVersion).mockReturnValueOnce([{ id: 'v-auto', label: 'auto', timestamp: 0, snapshot: {} as any }] as any);
      const test = {
        id: 't-1',
        name: 'Test',
        url: '/api',
        method: 'GET',
        headers: [],
        body: '',
        bodyType: 'none',
        bodyForm: [],
        auth: { type: 'none' },
        validation: { statusCode: 200 },
        extractions: [],
      } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: any) => ({ ...prev, name: 'Test', url: '/v2' }));
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests[0].definitionVersions).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'v-auto', label: 'auto' })]),
      );
    });

    it('saveTest logs rename when updating existing test title', () => {
      vi.mocked(logTestRenamed).mockClear();
      const test = { id: 't-1', name: 'Old', url: '/a', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200 }, extractions: [] } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: any) => ({ ...prev, name: 'New Title', url: '/a' }));
      });
      act(() => { result.current.saveTest(); });
      expect(vi.mocked(logTestRenamed)).toHaveBeenCalled();
    });

    it('saveTest skips rename log when saving same test name', () => {
      vi.mocked(logTestRenamed).mockClear();
      const test = { id: 't-1', name: 'Same', url: '/a', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200 }, extractions: [] } as any;
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [test] }] });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startEditTest('fg-1', 'sc-1', test); });
      act(() => {
        result.current.setDraft((prev: any) => ({ ...prev, name: 'Same', url: '/b' }));
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
        result.current.setDraft((prev: any) => ({
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
      const source = { id: 't-1', name: 'Base Test', url: '/api', method: 'GET', headers: [{ key: 'h', value: 'v' }], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 200, expectedFields: [{ path: '$.x' }] }, extractions: [] } as any;
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
      const source = { id: 't-na', name: 'No EF', url: '/api', method: 'GET', headers: [], body: '', bodyType: 'none', bodyForm: [], auth: { type: 'none' }, validation: { statusCode: 201 }, extractions: [] } as any;
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
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [{ id: 't-1', name: 'T', url: '/' } as any] }] });
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
      const fg = makeFg({ scenarios: [{ id: 'sc-1', name: 'Sc', tests: [{ id: 't-1', name: 'T', url: '/' } as any] }] });
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
});
