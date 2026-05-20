/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { SetStateAction } from 'react';
import { renderHook, act } from '@testing-library/react';
import { FeatureGroup, Scenario, TestDefinitionVersion, TestDefinitionSnapshot, TestScenario } from '../../../shared/types';

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
import { logFgRenamed, logScenarioRenamed, logTestAdded, logTestRenamed } from '../utils/structureChangeLog';

function _emptySnapshot(): TestDefinitionSnapshot {
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

function _setupWithoutEnv(initialFgs: FeatureGroup[] = []) {
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

  describe('scenario kind enforcement (Phase 2)', () => {
    it('addScenario defaults to kind "standard"', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setNewName('Standard Scenario'); });
      act(() => { result.current.addScenario('fg-1'); });
      expect(getFeatureGroups()[0].scenarios[0].kind).toBe('standard');
    });

    it('addScenario uses newScenarioKind state', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setNewScenarioKind('parameterized'); });
      act(() => { result.current.setNewName('Param Scenario'); });
      act(() => { result.current.addScenario('fg-1'); });
      expect(getFeatureGroups()[0].scenarios[0].kind).toBe('parameterized');
    });

    it('addScenario accepts explicit kind parameter', () => {
      const fg = makeFg();
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.setNewName('Explicit Param'); });
      act(() => { result.current.addScenario('fg-1', 'parameterized'); });
      expect(getFeatureGroups()[0].scenarios[0].kind).toBe('parameterized');
    });

    it('addScenario resets newScenarioKind to standard after creation', () => {
      const fg = makeFg();
      const { result } = setup([fg]);
      act(() => { result.current.setNewScenarioKind('parameterized'); });
      act(() => { result.current.setNewName('Test'); });
      act(() => { result.current.addScenario('fg-1'); });
      expect(result.current.newScenarioKind).toBe('standard');
    });

    it('saveTest is blocked when parameterized scenario test has no data source', () => {
      const fg = makeFg({
        scenarios: [{ id: 'sc-1', name: 'Param', kind: 'parameterized', tests: [] }],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft({
          ...result.current.draft,
          name: 'Test Without DS',
          url: '/api',
        });
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(0);
    });

    it('saveTest succeeds when parameterized scenario test has data source', () => {
      const fg = makeFg({
        scenarios: [{ id: 'sc-1', name: 'Param', kind: 'parameterized', tests: [] }],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft({
          ...result.current.draft,
          name: 'Test With DS',
          url: '/api',
          dataSource: { columns: [{ id: 'c1', name: 'col', type: 'param' as const, mapping: 'q' }], rows: [{ id: 'r1', values: { c1: 'v' }, enabled: true }], source: { type: 'inline' as const } },
        });
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(1);
    });

    it('saveTest succeeds for standard scenario without data source', () => {
      const fg = makeFg({
        scenarios: [{ id: 'sc-1', name: 'Standard', kind: 'standard', tests: [] }],
      });
      const { result, getFeatureGroups } = setup([fg]);
      act(() => { result.current.startNewTest('fg-1', 'sc-1'); });
      act(() => {
        result.current.setDraft({
          ...result.current.draft,
          name: 'Normal Test',
          url: '/api',
        });
      });
      act(() => { result.current.saveTest(); });
      expect(getFeatureGroups()[0].scenarios[0].tests).toHaveLength(1);
    });
  });
});
