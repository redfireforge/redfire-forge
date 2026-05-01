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
  });
});
