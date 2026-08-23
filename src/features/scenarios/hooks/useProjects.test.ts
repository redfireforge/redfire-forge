/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Environment, Microservice, FeatureGroup, GlobalAuthProfile, SharedDataSource } from '@shared/types';

const m = {
  loadEnvironments: vi.fn(),
  saveEnvironments: vi.fn(),
  loadMicroservices: vi.fn(),
  saveMicroservices: vi.fn(),
  loadFeatureGroups: vi.fn(),
  saveFeatureGroups: vi.fn(),
  loadGlobalAuthProfiles: vi.fn(),
  saveGlobalAuthProfiles: vi.fn(),
  loadSharedDataSources: vi.fn(),
  saveSharedDataSources: vi.fn(),
  loadWorkspaceDefaults: vi.fn(),
  saveWorkspaceDefaults: vi.fn(),
  loadSelectedEnvId: vi.fn(),
  saveSelectedEnvId: vi.fn(),
  loadSelectedSvcId: vi.fn(),
  saveSelectedSvcId: vi.fn(),
  migrateToFlat: vi.fn(),
  migratePerFgSharedDataSourcesToTopLevel: vi.fn(),
  getMaxRuns: vi.fn(),
  getStorageUsage: vi.fn(),
  loadTestRunsLite: vi.fn(),
  loadTheme: vi.fn(),
  ensureBrowserLargeDataMigrated: vi.fn(),
};
const mPurge = vi.fn();
const mNormalize = vi.fn();
const mIsCustom = vi.fn();
const mFindSaved = vi.fn();
const mApplyCustom = vi.fn();

vi.mock('../../../shared/utils/storage', () => ({
  loadEnvironments: (...a: unknown[]) => m.loadEnvironments(...a),
  saveEnvironments: (...a: unknown[]) => m.saveEnvironments(...a),
  loadMicroservices: (...a: unknown[]) => m.loadMicroservices(...a),
  saveMicroservices: (...a: unknown[]) => m.saveMicroservices(...a),
  loadFeatureGroups: (...a: unknown[]) => m.loadFeatureGroups(...a),
  saveFeatureGroups: (...a: unknown[]) => m.saveFeatureGroups(...a),
  loadGlobalAuthProfiles: (...a: unknown[]) => m.loadGlobalAuthProfiles(...a),
  saveGlobalAuthProfiles: (...a: unknown[]) => m.saveGlobalAuthProfiles(...a),
  loadSharedDataSources: (...a: unknown[]) => m.loadSharedDataSources(...a),
  saveSharedDataSources: (...a: unknown[]) => m.saveSharedDataSources(...a),
  loadWorkspaceDefaults: (...a: unknown[]) => m.loadWorkspaceDefaults(...a),
  saveWorkspaceDefaults: (...a: unknown[]) => m.saveWorkspaceDefaults(...a),
  loadSelectedEnvId: (...a: unknown[]) => m.loadSelectedEnvId(...a),
  saveSelectedEnvId: (...a: unknown[]) => m.saveSelectedEnvId(...a),
  loadSelectedSvcId: (...a: unknown[]) => m.loadSelectedSvcId(...a),
  saveSelectedSvcId: (...a: unknown[]) => m.saveSelectedSvcId(...a),
  migrateToFlat: (...a: unknown[]) => m.migrateToFlat(...a),
  migratePerFgSharedDataSourcesToTopLevel: (...a: unknown[]) => m.migratePerFgSharedDataSourcesToTopLevel(...a),
  getMaxRuns: (...a: unknown[]) => m.getMaxRuns(...a),
  getStorageUsage: (...a: unknown[]) => m.getStorageUsage(...a),
  loadTestRunsLite: (...a: unknown[]) => m.loadTestRunsLite(...a),
  loadTheme: (...a: unknown[]) => m.loadTheme(...a),
  ensureBrowserLargeDataMigrated: (...a: unknown[]) => m.ensureBrowserLargeDataMigrated(...a),
}));
vi.mock('../../../shared/utils/trashStorage', () => ({ purgeExpired: (...a: unknown[]) => mPurge(...a) }));
vi.mock('../../../shared/utils/scenarioMigration', () => ({ normalizeGroupActionTypes: (...a: unknown[]) => mNormalize(...a) }));
vi.mock('../../../app/themeCustomizerUtils', () => ({
  isCustomThemeId: (...a: unknown[]) => mIsCustom(...a),
  findSavedTheme: (...a: unknown[]) => mFindSaved(...a),
  applyCustomTheme: (...a: unknown[]) => mApplyCustom(...a),
}));

import { useProjects } from './useProjects';

function fg(id: string, scenarios: FeatureGroup['scenarios'] = []): FeatureGroup {
  return { id, name: id, scenarios } as FeatureGroup;
}

async function setupLoaded() {
  const hook = renderHook(() => useProjects());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useProjects', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset());
    mPurge.mockReset(); mNormalize.mockReset(); mIsCustom.mockReset(); mFindSaved.mockReset(); mApplyCustom.mockReset();
    localStorage.clear();
    m.migrateToFlat.mockResolvedValue(undefined);
    m.ensureBrowserLargeDataMigrated.mockResolvedValue(undefined);
    m.migratePerFgSharedDataSourcesToTopLevel.mockResolvedValue(undefined);
    m.loadEnvironments.mockResolvedValue([{ id: 'e1' } as Environment]);
    m.loadMicroservices.mockResolvedValue([{ id: 'm1' } as Microservice]);
    m.loadFeatureGroups.mockResolvedValue([fg('fg1')]);
    m.loadGlobalAuthProfiles.mockResolvedValue([{ id: 'g1' } as GlobalAuthProfile]);
    m.loadSharedDataSources.mockResolvedValue([{ id: 's1' } as SharedDataSource]);
    m.loadWorkspaceDefaults.mockResolvedValue({ grpcHost: 'workspace:50051' });
    m.loadSelectedEnvId.mockResolvedValue('e1');
    m.loadSelectedSvcId.mockResolvedValue('m1');
    m.getMaxRuns.mockResolvedValue(99);
    m.getStorageUsage.mockResolvedValue({ usedBytes: 10, entries: { a: 1 } });
    m.loadTheme.mockResolvedValue('dark');
    m.loadTestRunsLite.mockResolvedValue([{ id: 'run1' }]);
    m.saveEnvironments.mockResolvedValue(undefined);
    m.saveMicroservices.mockResolvedValue(undefined);
    m.saveFeatureGroups.mockResolvedValue(undefined);
    m.saveGlobalAuthProfiles.mockResolvedValue(undefined);
    m.saveSharedDataSources.mockResolvedValue(undefined);
    m.saveWorkspaceDefaults.mockResolvedValue(undefined);
    m.saveSelectedEnvId.mockResolvedValue(undefined);
    m.saveSelectedSvcId.mockResolvedValue(undefined);
    mPurge.mockResolvedValue(0);
    mNormalize.mockImplementation((fgs) => fgs);
    mIsCustom.mockReturnValue(false);
  });

  it('loads all project data on mount', async () => {
    const { result } = await setupLoaded();
    expect(result.current.environments).toEqual([{ id: 'e1' }]);
    expect(result.current.microservices).toEqual([{ id: 'm1' }]);
    expect(result.current.featureGroups).toEqual([fg('fg1')]);
    expect(result.current.appGlobalAuthProfiles).toEqual([{ id: 'g1' }]);
    expect(result.current.sharedDataSources).toEqual([{ id: 's1' }]);
    expect(result.current.workspaceDefaults).toEqual({ grpcHost: 'workspace:50051' });
    expect(result.current.selectedEnvId).toBe('e1');
    expect(result.current.selectedSvcId).toBe('m1');
    expect(result.current.initialMaxRuns).toBe(99);
    expect(result.current.initialStorageUsage).toEqual({ usedBytes: 10, entries: { a: 1 } });
    expect(result.current.initialTheme).toBe('dark');
    expect(result.current.initialTestRuns).toEqual([{ id: 'run1' }]);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('seeds selected ids from localStorage initially', async () => {
    localStorage.setItem('perf-test-v3-selected-env', 'pre-env');
    localStorage.setItem('perf-test-v3-selected-svc', 'pre-svc');
    const hook = renderHook(() => useProjects());
    // before async load completes the localStorage seed is used (then overwritten)
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.selectedEnvId).toBe('e1');
  });

  it('applies a custom theme when the saved theme is custom', async () => {
    m.loadTheme.mockResolvedValue('custom-x');
    mIsCustom.mockReturnValue(true);
    mFindSaved.mockReturnValue({ id: 'custom-x' });
    await setupLoaded();
    expect(mApplyCustom).toHaveBeenCalledWith({ id: 'custom-x' });
  });

  it('falls back to dark when a custom theme is not found', async () => {
    m.loadTheme.mockResolvedValue('custom-missing');
    mIsCustom.mockReturnValue(true);
    mFindSaved.mockReturnValue(null);
    await setupLoaded();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('logs when expired trash items are purged', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    mPurge.mockResolvedValue(3);
    await setupLoaded();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Purged 3'));
    log.mockRestore();
  });

  it('persists state changes after load', async () => {
    const { result } = await setupLoaded();
    m.saveEnvironments.mockClear();
    act(() => result.current.setEnvironments([{ id: 'e2' } as Environment]));
    await waitFor(() => expect(m.saveEnvironments).toHaveBeenCalledWith([{ id: 'e2' }]));
  });

  it('persists workspaceDefaults changes', async () => {
    const { result } = await setupLoaded();
    m.saveWorkspaceDefaults.mockClear();
    act(() => result.current.setWorkspaceDefaults({ grpcHost: 'new-host:50051' }));
    await waitFor(() => expect(m.saveWorkspaceDefaults).toHaveBeenCalledWith({ grpcHost: 'new-host:50051' }));
  });

  it('persists selected env/svc changes', async () => {
    const { result } = await setupLoaded();
    m.saveSelectedEnvId.mockClear();
    act(() => result.current.setSelectedEnvId('e9'));
    await waitFor(() => expect(m.saveSelectedEnvId).toHaveBeenCalledWith('e9'));
    expect(result.current.selectedEnvId).toBe('e9');
  });

  describe('moveScenario', () => {
    it('is a no-op when source equals target', async () => {
      const { result } = await setupLoaded();
      act(() => result.current.setFeatureGroups([
        fg('a', [{ id: 'sc1', name: 'SC', tests: [] }]),
      ]));
      act(() => result.current.moveScenario('sc1', 'a', 'a'));
      expect(result.current.featureGroups[0].scenarios).toHaveLength(1);
    });

    it('moves a scenario between feature groups', async () => {
      const { result } = await setupLoaded();
      act(() => result.current.setFeatureGroups([
        fg('a', [{ id: 'sc1', name: 'SC', tests: [] }]),
        fg('b', []),
      ]));
      act(() => result.current.moveScenario('sc1', 'a', 'b'));
      expect(result.current.featureGroups[0].scenarios).toHaveLength(0);
      expect(result.current.featureGroups[1].scenarios.map((s) => s.id)).toEqual(['sc1']);
    });

    it('does nothing when the scenario or target is missing', async () => {
      const { result } = await setupLoaded();
      act(() => result.current.setFeatureGroups([fg('a', []), fg('b', [])]));
      act(() => result.current.moveScenario('ghost', 'a', 'b'));
      expect(result.current.featureGroups[1].scenarios).toHaveLength(0);
    });
  });

  describe('moveTest', () => {
    it('is a no-op when same fg and scenario', async () => {
      const { result } = await setupLoaded();
      act(() => result.current.setFeatureGroups([
        fg('a', [{ id: 'sc1', name: 'SC', tests: [{ id: 't1' }] }]),
      ] as FeatureGroup[]));
      act(() => result.current.moveTest('t1', 'sc1', 'a', 'sc1', 'a'));
      expect(result.current.featureGroups[0].scenarios[0].tests).toHaveLength(1);
    });

    it('moves a test across feature groups', async () => {
      const { result } = await setupLoaded();
      act(() => result.current.setFeatureGroups([
        fg('a', [{ id: 'sc1', name: 'SC1', tests: [{ id: 't1' }] }]),
        fg('b', [{ id: 'sc2', name: 'SC2', tests: [] }]),
      ] as FeatureGroup[]));
      act(() => result.current.moveTest('t1', 'sc1', 'a', 'sc2', 'b'));
      expect(result.current.featureGroups[0].scenarios[0].tests).toHaveLength(0);
      expect(result.current.featureGroups[1].scenarios[0].tests.map((t) => t.id)).toEqual(['t1']);
    });

    it('moves a test between scenarios within the same feature group', async () => {
      const { result } = await setupLoaded();
      act(() => result.current.setFeatureGroups([
        fg('a', [
          { id: 'sc1', name: 'SC1', tests: [{ id: 't1' }] },
          { id: 'sc2', name: 'SC2', tests: [] },
        ]),
      ] as FeatureGroup[]));
      act(() => result.current.moveTest('t1', 'sc1', 'a', 'sc2', 'a'));
      expect(result.current.featureGroups[0].scenarios[0].tests).toHaveLength(0);
      expect(result.current.featureGroups[0].scenarios[1].tests.map((t) => t.id)).toEqual(['t1']);
    });

    it('does nothing when the test is missing', async () => {
      const { result } = await setupLoaded();
      act(() => result.current.setFeatureGroups([
        fg('a', [{ id: 'sc1', name: 'SC1', tests: [] }]),
        fg('b', [{ id: 'sc2', name: 'SC2', tests: [] }]),
      ] as FeatureGroup[]));
      act(() => result.current.moveTest('ghost', 'sc1', 'a', 'sc2', 'b'));
      expect(result.current.featureGroups[1].scenarios[0].tests).toHaveLength(0);
    });
  });
});
