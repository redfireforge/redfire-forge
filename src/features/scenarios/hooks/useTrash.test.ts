/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FeatureGroup, TestScenario, Scenario, SharedDataSource, TrashItem } from '../../../shared/types';

const mockLoadTrash = vi.fn<() => Promise<TrashItem[]>>().mockResolvedValue([]);
const mockAddToTrash = vi.fn<(item: TrashItem) => Promise<void>>().mockResolvedValue(undefined);
const mockRemoveFromTrash = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
const mockEmptyTrash = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockLoadSettings = vi.fn().mockResolvedValue({ retentionDays: 30, maxItems: 100 });
const mockSaveSettings = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../shared/utils/trashStorage', () => ({
  loadTrash: (...args: unknown[]) => mockLoadTrash(...args as []),
  addToTrash: (...args: unknown[]) => mockAddToTrash(...(args as [TrashItem])),
  removeFromTrash: (...args: unknown[]) => mockRemoveFromTrash(...(args as [string])),
  emptyTrash: (...args: unknown[]) => mockEmptyTrash(...(args as [])),
  loadTrashSettings: () => mockLoadSettings(),
  saveTrashSettings: (...args: unknown[]) => mockSaveSettings(...args),
}));

vi.mock('../utils/structureChangeLog', () => ({
  logItemRestored: (fg: FeatureGroup, _name: string, _sc?: string, _detail?: string) => fg,
}));

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { useTrash } from './useTrash';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 't-1', name: 'Test 1', url: '/api', method: 'GET',
    headers: [], body: '', auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

function makeTestScenario(overrides: Partial<TestScenario> = {}): TestScenario {
  return {
    id: 'sc-1', name: 'Scenario 1', kind: 'standard',
    tests: [makeScenario()],
    ...overrides,
  };
}

function makeFg(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1', name: 'Feature 1',
    microserviceId: 'svc-1', environmentId: 'env-1',
    scenarios: [makeTestScenario()],
    ...overrides,
  };
}

function makeDs(overrides: Partial<SharedDataSource> = {}): SharedDataSource {
  return {
    id: 'ds-1', name: 'DS 1',
    dataSource: { mode: 'inline', columns: [], rows: [] },
    updatedAt: Date.now(),
    ...overrides,
  };
}

function defaultParams() {
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

describe('useTrash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadTrash.mockResolvedValue([]);
    mockLoadSettings.mockResolvedValue({ retentionDays: 30, maxItems: 100 });
    mockSaveSettings.mockResolvedValue(undefined);
  });

  it('loads trash items on mount', async () => {
    const existing: TrashItem[] = [{
      id: 'trash-1', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
      entityType: 'featureGroup', entityName: 'Old FG', parentPath: '',
      data: makeFg({ id: 'old' }),
    }];
    mockLoadTrash.mockResolvedValue(existing);

    const { result } = renderHook(() => useTrash(defaultParams()));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trashItems).toHaveLength(1);
    expect(result.current.trashCount).toBe(1);
  });

  it('moveToTrash adds item and sets lastDeleted', async () => {
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash(
        'featureGroup', makeFg(), 'Feature 1', '',
        { environmentId: 'env-1', microserviceId: 'svc-1' },
      );
      await vi.waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
    });

    expect(result.current.trashItems).toHaveLength(1);
    expect(result.current.lastDeleted).not.toBeNull();
    expect(result.current.lastDeleted!.entityName).toBe('Feature 1');
  });

  it('computes childCounts for featureGroup', async () => {
    const fg = makeFg({
      scenarios: [
        makeTestScenario({ tests: [makeScenario(), makeScenario({ id: 't-2' })] }),
        makeTestScenario({ id: 'sc-2', tests: [makeScenario({ id: 't-3' })] }),
      ],
    });
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash('featureGroup', fg, 'FG', '', {});
      await vi.waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
    });

    const item = result.current.trashItems[0];
    expect(item.childCounts).toEqual({ scenarios: 2, tests: 3 });
  });

  it('computes childCounts for scenario', async () => {
    const sc = makeTestScenario({ tests: [makeScenario(), makeScenario({ id: 't-2' })] });
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash('scenario', sc, 'Sc', 'FG', { parentFeatureGroupId: 'fg-1' });
      await vi.waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
    });

    expect(result.current.trashItems[0].childCounts).toEqual({ tests: 2 });
  });

  it('moveToTrash handles storage error gracefully', async () => {
    mockAddToTrash.mockRejectedValueOnce(new Error('persist fail'));
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      result.current.moveToTrash('test', makeScenario(), 'Fail Test', '', {});
      await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    });
    spy.mockRestore();
    expect(result.current.trashItems).toHaveLength(1);
  });

  it('permanentlyDelete removes from storage and state', async () => {
    const existing: TrashItem[] = [{
      id: 'trash-x', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
      entityType: 'test', entityName: 'Test', parentPath: 'FG > SC',
      data: makeScenario(),
    }];
    mockLoadTrash.mockResolvedValue(existing);

    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trashItems).toHaveLength(1);

    await act(async () => {
      await result.current.permanentlyDelete('trash-x');
    });

    expect(mockRemoveFromTrash).toHaveBeenCalledWith('trash-x');
    expect(result.current.trashItems).toHaveLength(0);
  });

  it('permanentlyDelete handles storage error gracefully', async () => {
    const existing: TrashItem[] = [{
      id: 'trash-perr', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
      entityType: 'test', entityName: 'Test', parentPath: 'FG > SC',
      data: makeScenario(),
    }];
    mockLoadTrash.mockResolvedValue(existing);
    mockRemoveFromTrash.mockRejectedValueOnce(new Error('storage error'));

    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      await result.current.permanentlyDelete('trash-perr');
    });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[Trash]'), expect.any(Error));
    spy.mockRestore();
    expect(result.current.trashItems).toHaveLength(0);
  });

  it('emptyAllTrash clears everything', async () => {
    mockLoadTrash.mockResolvedValue([
      { id: 'a', deletedAt: 0, expiresAt: 0, entityType: 'test' as const, entityName: 'A', parentPath: '', data: makeScenario() },
      { id: 'b', deletedAt: 0, expiresAt: 0, entityType: 'test' as const, entityName: 'B', parentPath: '', data: makeScenario() },
    ]);

    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trashItems).toHaveLength(2);

    await act(async () => {
      await result.current.emptyAllTrash();
    });

    expect(mockEmptyTrash).toHaveBeenCalled();
    expect(result.current.trashItems).toHaveLength(0);
  });

  it('emptyAllTrash handles storage error gracefully', async () => {
    mockLoadTrash.mockResolvedValue([
      { id: 'ee', deletedAt: 0, expiresAt: 0, entityType: 'test' as const, entityName: 'E', parentPath: '', data: makeScenario() },
    ]);
    mockEmptyTrash.mockRejectedValueOnce(new Error('empty fail'));

    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      await result.current.emptyAllTrash();
    });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[Trash]'), expect.any(Error));
    spy.mockRestore();
    expect(result.current.trashItems).toHaveLength(0);
  });

  it('undoLastDelete restores and clears lastDeleted', async () => {
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    // First add something to trash
    await act(async () => {
      result.current.moveToTrash(
        'sharedDataSource', makeDs({ id: 'ds-99', name: 'My DS' }), 'My DS', '', {},
      );
      await vi.waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
    });

    expect(result.current.lastDeleted).not.toBeNull();
    expect(result.current.trashItems).toHaveLength(1);

    await act(async () => {
      await result.current.undoLastDelete();
    });

    expect(result.current.lastDeleted).toBeNull();
    expect(result.current.trashItems).toHaveLength(0);
    expect(params.setSharedDataSources).toHaveBeenCalled();
  });

  it('clearLastDeleted clears without restoring', async () => {
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash('featureGroup', makeFg(), 'FG', '', {});
      await vi.waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
    });

    expect(result.current.lastDeleted).not.toBeNull();

    act(() => {
      result.current.clearLastDeleted();
    });

    expect(result.current.lastDeleted).toBeNull();
    expect(result.current.trashItems).toHaveLength(1); // still in trash
  });

  describe('restore paths', () => {
    it('restores featureGroup to featureGroups array', async () => {
      const trashedFg = makeFg({ id: 'fg-restored', name: 'Restored FG' });
      const trashItem: TrashItem = {
        id: 'trash-fg', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'featureGroup', entityName: 'Restored FG', parentPath: '',
        environmentId: 'env-1', microserviceId: 'svc-1',
        data: trashedFg,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.restoreItem('trash-fg');
      });

      expect(params.setFeatureGroups).toHaveBeenCalled();
      expect(mockRemoveFromTrash).toHaveBeenCalledWith('trash-fg');
    });

    it('restores scenario into existing parent FG', async () => {
      const trashedSc = makeTestScenario({ id: 'sc-restore', name: 'Restored SC' });
      const trashItem: TrashItem = {
        id: 'trash-sc', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'scenario', entityName: 'Restored SC', parentPath: 'Feature 1',
        parentFeatureGroupId: 'fg-1',
        data: trashedSc,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.restoreItem('trash-sc');
      });

      expect(params.setFeatureGroups).toHaveBeenCalled();
      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const parentFg = updated.find(fg => fg.id === 'fg-1');
      expect(parentFg).toBeDefined();
      expect(parentFg!.scenarios.some(s => s.id === 'sc-restore')).toBe(true);
      expect(mockRemoveFromTrash).toHaveBeenCalledWith('trash-sc');
    });

    it('restores scenario into "Restored Items" FG when parent missing', async () => {
      const trashedSc = makeTestScenario({ id: 'sc-orphan', name: 'Orphan SC' });
      const trashItem: TrashItem = {
        id: 'trash-orphan', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'scenario', entityName: 'Orphan SC', parentPath: 'Deleted FG',
        parentFeatureGroupId: 'fg-deleted',
        data: trashedSc,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.restoreItem('trash-orphan');
      });

      expect(params.setFeatureGroups).toHaveBeenCalled();
      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const restoredFg = updated.find(fg => fg.name === 'Restored Items');
      expect(restoredFg).toBeDefined();
      expect(restoredFg!.scenarios).toHaveLength(1);
    });

    it('restores sharedDataSource with new ID on collision', async () => {
      const trashedDs = makeDs({ id: 'ds-1', name: 'Colliding DS' });
      const trashItem: TrashItem = {
        id: 'trash-ds', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'sharedDataSource', entityName: 'Colliding DS', parentPath: '',
        data: trashedDs,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams(); // params.sharedDataSources has ds-1
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.restoreItem('trash-ds');
      });

      expect(params.setSharedDataSources).toHaveBeenCalled();
      const setFn = params.setSharedDataSources.mock.calls[0][0] as (prev: SharedDataSource[]) => SharedDataSource[];
      const updated = setFn(params.sharedDataSources);
      const restored = updated.find(ds => ds.name === 'Colliding DS (restored)');
      expect(restored).toBeDefined();
      expect(restored!.id).toBe('mock-uuid');
    });

    it('restores test into existing parent FG and scenario', async () => {
      const test = makeScenario({ id: 't-new', name: 'New Test' });
      const trashItem: TrashItem = {
        id: 'trash-test', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'New Test', parentPath: 'Feature 1 > Scenario 1',
        parentFeatureGroupId: 'fg-1', parentScenarioId: 'sc-1',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-test'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const sc = updated[0].scenarios[0];
      expect(sc.tests).toHaveLength(2);
      expect(sc.tests.some(t => t.id === 't-new')).toBe(true);
    });

    it('restores test into new scenario when parent scenario missing', async () => {
      const test = makeScenario({ id: 't-orphan', name: 'Orphan Test' });
      const trashItem: TrashItem = {
        id: 'trash-test2', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'Orphan Test', parentPath: 'Feature 1 > Missing SC',
        parentFeatureGroupId: 'fg-1', parentScenarioId: 'sc-missing',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-test2'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const newSc = updated[0].scenarios.find(s => s.name === 'Restored Tests');
      expect(newSc).toBeDefined();
      expect(newSc!.tests).toHaveLength(1);
    });

    it('restores test into new FG when parent FG missing', async () => {
      const test = makeScenario({ id: 't-full-orphan', name: 'Full Orphan' });
      const trashItem: TrashItem = {
        id: 'trash-test3', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'Full Orphan', parentPath: 'Missing FG > Missing SC',
        parentFeatureGroupId: 'fg-missing', parentScenarioId: 'sc-missing',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-test3'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const newFg = updated.find(fg => fg.name === 'Restored Items');
      expect(newFg).toBeDefined();
      expect(newFg!.scenarios[0].name).toBe('Restored Tests');
      expect(newFg!.scenarios[0].tests).toHaveLength(1);
    });

    it('restores test with new ID on collision', async () => {
      const test = makeScenario({ id: 't-1', name: 'Colliding Test' });
      const trashItem: TrashItem = {
        id: 'trash-collide', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'Colliding Test', parentPath: 'Feature 1 > Scenario 1',
        parentFeatureGroupId: 'fg-1', parentScenarioId: 'sc-1',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-collide'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const restored = updated[0].scenarios[0].tests.find(t => t.name === 'Colliding Test');
      expect(restored).toBeDefined();
      expect(restored!.id).toBe('mock-uuid');
    });

    it('restores FG with colliding IDs (ensureUniqueIds)', async () => {
      const trashedFg = makeFg({ id: 'fg-1', name: 'Colliding FG', scenarios: [
        makeTestScenario({ id: 'sc-1', tests: [makeScenario({ id: 't-1' })] }),
      ] });
      const trashItem: TrashItem = {
        id: 'trash-fg-collide', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'featureGroup', entityName: 'Colliding FG', parentPath: '',
        data: trashedFg,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-fg-collide'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      expect(updated).toHaveLength(2);
      const restored = updated[1];
      expect(restored.id).toBe('mock-uuid');
      expect(restored.name).toContain('(restored)');
      expect(restored.scenarios[0].id).toBe('mock-uuid');
      expect(restored.scenarios[0].tests[0].id).toBe('mock-uuid');
    });

    it('restores FG with non-colliding scenario/test IDs (ensureUniqueIds no-collision branch)', async () => {
      const trashedFg = makeFg({ id: 'fg-1', name: 'Partial Collide', scenarios: [
        makeTestScenario({ id: 'sc-unique', tests: [makeScenario({ id: 't-unique' })] }),
      ] });
      const trashItem: TrashItem = {
        id: 'trash-fg-partial', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'featureGroup', entityName: 'Partial Collide', parentPath: '',
        data: trashedFg,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-fg-partial'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const restored = updated[1];
      expect(restored.id).toBe('mock-uuid');
      expect(restored.scenarios[0].id).toBe('sc-unique');
      expect(restored.scenarios[0].tests[0].id).toBe('t-unique');
    });

    it('restores scenario with non-colliding SC ID (ensureUniqueScenarioIds no-collision branch)', async () => {
      const trashedSc = makeTestScenario({ id: 'sc-unique', name: 'No Collide SC', tests: [makeScenario({ id: 't-unique2' })] });
      const trashItem: TrashItem = {
        id: 'trash-sc-nocollide', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'scenario', entityName: 'No Collide SC', parentPath: 'Feature 1',
        parentFeatureGroupId: 'fg-1',
        data: trashedSc,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-sc-nocollide'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const parentFg = updated.find(fg => fg.id === 'fg-1');
      const restored = parentFg!.scenarios.find(s => s.name === 'No Collide SC');
      expect(restored!.id).toBe('sc-unique');
      expect(restored!.tests[0].id).toBe('t-unique2');
    });

    it('restores scenario with colliding SC ID (ensureUniqueScenarioIds)', async () => {
      const trashedSc = makeTestScenario({ id: 'sc-1', name: 'Colliding SC', tests: [makeScenario({ id: 't-1' })] });
      const trashItem: TrashItem = {
        id: 'trash-sc-collide', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'scenario', entityName: 'Colliding SC', parentPath: 'Feature 1',
        parentFeatureGroupId: 'fg-1',
        data: trashedSc,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-sc-collide'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const parentFg = updated.find(fg => fg.id === 'fg-1');
      expect(parentFg).toBeDefined();
      const restored = parentFg!.scenarios.find(s => s.name === 'Colliding SC');
      expect(restored).toBeDefined();
      expect(restored!.id).toBe('mock-uuid');
      expect(restored!.tests[0].id).toBe('mock-uuid');
    });

    it('restores test into FG (no SC) with colliding test ID', async () => {
      const test = makeScenario({ id: 't-1', name: 'Collide No SC' });
      const trashItem: TrashItem = {
        id: 'trash-test-nosc', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'Collide No SC', parentPath: 'Feature 1 > Missing',
        parentFeatureGroupId: 'fg-1', parentScenarioId: 'sc-missing',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-test-nosc'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const parentFg = updated.find(fg => fg.id === 'fg-1');
      const newSc = parentFg!.scenarios.find(s => s.name === 'Restored Tests');
      expect(newSc).toBeDefined();
      expect(newSc!.tests[0].id).toBe('mock-uuid');
    });

    it('restores test fully orphaned with colliding test ID', async () => {
      const test = makeScenario({ id: 't-1', name: 'Orphan Collide' });
      const trashItem: TrashItem = {
        id: 'trash-test-orphan-collide', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'Orphan Collide', parentPath: 'Gone > Gone',
        parentFeatureGroupId: 'fg-gone', parentScenarioId: 'sc-gone',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-test-orphan-collide'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const newFg = updated.find(fg => fg.name === 'Restored Items');
      expect(newFg).toBeDefined();
      expect(newFg!.scenarios[0].tests[0].id).toBe('mock-uuid');
    });

    it('restores test into parent FG+SC with multiple FGs and scenarios (map else branches)', async () => {
      const test = makeScenario({ id: 't-map-else', name: 'Map Else' });
      const trashItem: TrashItem = {
        id: 'trash-map-else', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'Map Else', parentPath: 'Feature 1 > Scenario 1',
        parentFeatureGroupId: 'fg-1', parentScenarioId: 'sc-1',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      params.featureGroups = [
        makeFg({ scenarios: [
          makeTestScenario(),
          makeTestScenario({ id: 'sc-other', name: 'Other SC' }),
        ] }),
        makeFg({ id: 'fg-2', name: 'Feature 2', scenarios: [makeTestScenario({ id: 'sc-2' })] }),
      ];
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-map-else'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      expect(updated).toHaveLength(2);
      expect(updated[0].scenarios[0].tests).toHaveLength(2);
      expect(updated[0].scenarios[1].tests).toHaveLength(1);
      expect(updated[1].id).toBe('fg-2');
    });

    it('restores test into parent FG (no SC) with multiple FGs', async () => {
      const test = makeScenario({ id: 't-map-else2', name: 'Map Else 2' });
      const trashItem: TrashItem = {
        id: 'trash-map-else2', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'Map Else 2', parentPath: 'Feature 1 > Missing',
        parentFeatureGroupId: 'fg-1', parentScenarioId: 'sc-missing',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      params.featureGroups = [
        makeFg(),
        makeFg({ id: 'fg-other', name: 'Other FG' }),
      ];
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-map-else2'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      expect(updated).toHaveLength(2);
      const newSc = updated[0].scenarios.find(s => s.name === 'Restored Tests');
      expect(newSc).toBeDefined();
      expect(updated[1].id).toBe('fg-other');
    });

    it('restores scenario with multiple FGs (map else branch on non-parent)', async () => {
      const trashedSc = makeTestScenario({ id: 'sc-map-else', name: 'SC Map Else' });
      const trashItem: TrashItem = {
        id: 'trash-sc-map', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'scenario', entityName: 'SC Map Else', parentPath: 'Feature 1',
        parentFeatureGroupId: 'fg-1',
        data: trashedSc,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      params.featureGroups = [
        makeFg(),
        makeFg({ id: 'fg-another', name: 'Another FG' }),
      ];
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-sc-map'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      expect(updated).toHaveLength(2);
      const parentFg = updated.find(fg => fg.id === 'fg-1');
      expect(parentFg!.scenarios.some(s => s.name === 'SC Map Else')).toBe(true);
      expect(updated[1].id).toBe('fg-another');
    });

    it('restores test with no name uses fallback label', async () => {
      const test = makeScenario({ id: 't-noname', name: undefined as unknown as string });
      const trashItem: TrashItem = {
        id: 'trash-noname', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'unnamed', parentPath: 'Gone',
        parentFeatureGroupId: 'fg-gone',
        data: test,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-noname'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const newFg = updated.find(fg => fg.name === 'Restored Items');
      expect(newFg).toBeDefined();
    });

    it('restores shared DS without collision (keeps original ID)', async () => {
      const trashedDs: SharedDataSource = {
        id: 'ds-unique', name: 'Unique DS',
        dataSource: { type: 'inline', columns: [], rows: [] },
        updatedAt: Date.now(),
      };
      const trashItem: TrashItem = {
        id: 'trash-ds-nocon', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'sharedDataSource', entityName: 'Unique DS', parentPath: '',
        data: trashedDs,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-ds-nocon'); });

      const setFn = params.setSharedDataSources.mock.calls[0][0] as (prev: SharedDataSource[]) => SharedDataSource[];
      const updated = setFn(params.sharedDataSources);
      const restored = updated.find(ds => ds.name === 'Unique DS');
      expect(restored).toBeDefined();
      expect(restored!.id).toBe('ds-unique');
    });

    it('restores FG and invokes setFn (exercises restoreFeatureGroup logic)', async () => {
      const trashedFg = makeFg({ id: 'fg-new-restore', name: 'New Restore FG' });
      const trashItem: TrashItem = {
        id: 'trash-fg-exec', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'featureGroup', entityName: 'New Restore FG', parentPath: '',
        environmentId: 'env-1', microserviceId: 'svc-1',
        data: trashedFg,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-fg-exec'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      expect(updated).toHaveLength(2);
      expect(updated[1].name).toBe('New Restore FG');
      expect(updated[1].id).toBe('fg-new-restore');
    });

    it('restoreItem is a no-op for unknown trashId', async () => {
      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('nonexistent'); });

      expect(params.setFeatureGroups).not.toHaveBeenCalled();
      expect(params.setSharedDataSources).not.toHaveBeenCalled();
    });

    it('undoLastDelete is a no-op when lastDeleted is null', async () => {
      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.undoLastDelete(); });

      expect(params.setFeatureGroups).not.toHaveBeenCalled();
      expect(mockRemoveFromTrash).not.toHaveBeenCalled();
    });

    it('restoreFeatureGroup clears invalid env/svc IDs', async () => {
      const fg = makeFg({ id: 'fg-new', name: 'Invalid Env FG', environmentId: 'env-gone', microserviceId: 'svc-gone' });
      const trashItem: TrashItem = {
        id: 'trash-invalid', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'featureGroup', entityName: 'Invalid Env FG', parentPath: '',
        data: fg,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-invalid'); });

      const setFn = params.setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
      const updated = setFn(params.featureGroups);
      const restored = updated.find(f => f.name === 'Invalid Env FG');
      expect(restored).toBeDefined();
      expect(restored!.environmentId).toBeUndefined();
      expect(restored!.microserviceId).toBeUndefined();
    });

    it('restoreItem handles storage error gracefully', async () => {
      const fg = makeFg({ id: 'fg-err' });
      const trashItem: TrashItem = {
        id: 'trash-err', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'featureGroup', entityName: 'Err FG', parentPath: '',
        data: fg,
      };
      mockLoadTrash.mockResolvedValue([trashItem]);
      mockRemoveFromTrash.mockRejectedValueOnce(new Error('storage failure'));

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.restoreItem('trash-err'); });

      expect(params.setFeatureGroups).toHaveBeenCalled();
      expect(result.current.trashItems).toHaveLength(0);
    });

    it('loads trash even when loadTrashSettings fails', async () => {
      const items: TrashItem[] = [{
        id: 'trash-ok', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test', entityName: 'OK', parentPath: '', data: makeScenario(),
      }];
      mockLoadTrash.mockResolvedValue(items);
      mockLoadSettings.mockRejectedValue(new Error('settings fail'));

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.trashItems).toHaveLength(1);
      expect(result.current.trashSettings.retentionDays).toBe(30);
    });
  });

  describe('trashSettings', () => {
    it('loads settings on mount', async () => {
      mockLoadSettings.mockResolvedValue({ retentionDays: 14, maxItems: 200 });
      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.trashSettings.retentionDays).toBe(14);
      expect(result.current.trashSettings.maxItems).toBe(200);
    });

    it('defaults to 30 days / 100 items before load completes', () => {
      mockLoadTrash.mockReturnValue(new Promise(() => {}));
      mockLoadSettings.mockReturnValue(new Promise(() => {}));
      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));

      expect(result.current.trashSettings.retentionDays).toBe(30);
      expect(result.current.trashSettings.maxItems).toBe(100);
    });

    it('updateTrashSettings persists and updates state', async () => {
      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.updateTrashSettings({ retentionDays: 7 });
      });

      expect(result.current.trashSettings.retentionDays).toBe(7);
      expect(result.current.trashSettings.maxItems).toBe(100);
      expect(mockSaveSettings).toHaveBeenCalledWith({ retentionDays: 7, maxItems: 100 });
    });

    it('updateTrashSettings survives persistence failure', async () => {
      mockSaveSettings.mockRejectedValueOnce(new Error('write fail'));
      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.updateTrashSettings({ maxItems: 50 });
      });

      expect(result.current.trashSettings.maxItems).toBe(50);
    });

    it('moveToTrash uses current settings for expiry', async () => {
      mockLoadSettings.mockResolvedValue({ retentionDays: 7, maxItems: 100 });
      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.moveToTrash('scenario', makeTestScenario(), 'SC', 'path', {});
      });
      await vi.waitFor(() => expect(result.current.trashItems.length).toBe(1));

      const item = result.current.trashItems[0];
      const expectedMs = 7 * 86_400_000;
      expect(item.expiresAt - item.deletedAt).toBe(expectedMs);
    });

    it('moveToTrash enforces maxItems in UI state', async () => {
      const items: TrashItem[] = Array.from({ length: 3 }, (_, i) => ({
        id: `trash-${i}`, deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
        entityType: 'test' as const, entityName: `T${i}`, parentPath: '',
        data: makeScenario({ id: `t-${i}` }),
      }));
      mockLoadTrash.mockResolvedValue(items);
      mockLoadSettings.mockResolvedValue({ retentionDays: 30, maxItems: 3 });

      const params = defaultParams();
      const { result } = renderHook(() => useTrash(params));
      await vi.waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.trashItems).toHaveLength(3);

      act(() => {
        result.current.moveToTrash('test', makeScenario({ id: 'new' }), 'New', '', {});
      });
      await vi.waitFor(() => expect(result.current.trashItems[0].entityName).toBe('New'));

      expect(result.current.trashItems).toHaveLength(3);
      expect(result.current.trashItems.map(i => i.entityName)).toEqual(['New', 'T0', 'T1']);
    });
  });
});
