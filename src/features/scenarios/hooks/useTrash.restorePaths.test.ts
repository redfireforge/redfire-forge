/**
 * @vitest-environment jsdom
 *
 * Restore-path coverage for useTrash — split out from `useTrash.test.ts` to
 * keep individual test files under the 900-line monolithic threshold.
 *
 * Shared factories live in `__test-utils__/useTrashTestFixtures.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type {
  FeatureGroup,
  SharedDataSource,
  TrashItem,
} from '../../../shared/types';
import {
  makeScenario,
  makeTestScenario,
  makeFg,
  defaultParams,
} from './__test-utils__/useTrashTestFixtures';

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
  logItemRestored: (fg: unknown) => fg,
}));

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { useTrash } from './useTrash';

describe('useTrash — restore paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadTrash.mockResolvedValue([]);
    mockLoadSettings.mockResolvedValue({ retentionDays: 30, maxItems: 100 });
    mockSaveSettings.mockResolvedValue(undefined);
  });

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
    const trashedDs = { id: 'ds-1', name: 'Colliding DS', dataSource: { mode: 'inline' as const, columns: [], rows: [] }, updatedAt: Date.now() } as SharedDataSource;
    const trashItem: TrashItem = {
      id: 'trash-ds', deletedAt: Date.now(), expiresAt: Date.now() + 86_400_000,
      entityType: 'sharedDataSource', entityName: 'Colliding DS', parentPath: '',
      data: trashedDs,
    };
    mockLoadTrash.mockResolvedValue([trashItem]);

    const params = defaultParams();
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
});
