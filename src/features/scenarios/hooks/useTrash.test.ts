/**
 * @vitest-environment jsdom
 *
 * Core useTrash hook tests: mount, moveToTrash, permanentlyDelete, emptyAll,
 * undo/clearLastDeleted, and trashSettings.
 *
 * Restore-path coverage lives in `useTrash.restorePaths.test.ts`. Shared
 * factories live in `__test-utils__/useTrashTestFixtures.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { TrashItem } from '../../../shared/types';
import {
  makeScenario,
  makeTestScenario,
  makeFg,
  makeDs,
  defaultParams,
} from './__test-utils__/useTrashTestFixtures';
const uuidMock = vi.hoisted(() =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../../test-utils/uuidMock.ts').hoistedUuidFixed('mock-uuid'),
);

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

vi.mock('uuid', () => uuidMock);

import { useTrash } from './useTrash';

describe('useTrash — core', () => {
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
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trashItems).toHaveLength(1);
    expect(result.current.trashCount).toBe(1);
  });

  it('moveToTrash adds item and sets lastDeleted', async () => {
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash(
        'featureGroup', makeFg(), 'Feature 1', '',
        { environmentId: 'env-1', microserviceId: 'svc-1' },
      );
      await waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
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
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash('featureGroup', fg, 'FG', '', {});
      await waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
    });

    const item = result.current.trashItems[0];
    expect(item.childCounts).toEqual({ scenarios: 2, tests: 3 });
  });

  it('computes childCounts for scenario', async () => {
    const sc = makeTestScenario({ tests: [makeScenario(), makeScenario({ id: 't-2' })] });
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash('scenario', sc, 'Sc', 'FG', { parentFeatureGroupId: 'fg-1' });
      await waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
    });

    expect(result.current.trashItems[0].childCounts).toEqual({ tests: 2 });
  });

  it('moveToTrash handles storage error gracefully', async () => {
    mockAddToTrash.mockRejectedValueOnce(new Error('persist fail'));
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      result.current.moveToTrash('test', makeScenario(), 'Fail Test', '', {});
      await waitFor(() => expect(spy).toHaveBeenCalled());
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
    await waitFor(() => expect(result.current.loading).toBe(false));
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
    await waitFor(() => expect(result.current.loading).toBe(false));

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
    await waitFor(() => expect(result.current.loading).toBe(false));
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
    await waitFor(() => expect(result.current.loading).toBe(false));

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
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash(
        'sharedDataSource', makeDs({ id: 'ds-99', name: 'My DS' }), 'My DS', '', {},
      );
      await waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
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
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash('featureGroup', makeFg(), 'FG', '', {});
      await waitFor(() => expect(mockAddToTrash).toHaveBeenCalled());
    });

    expect(result.current.lastDeleted).not.toBeNull();

    await act(async () => {
      result.current.clearLastDeleted();
    });

    expect(result.current.lastDeleted).toBeNull();
    expect(result.current.trashItems).toHaveLength(1);
  });

  it('undoLastDelete is a no-op when lastDeleted is null', async () => {
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.undoLastDelete(); });

    expect(params.setFeatureGroups).not.toHaveBeenCalled();
    expect(mockRemoveFromTrash).not.toHaveBeenCalled();
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
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trashItems).toHaveLength(1);
    expect(result.current.trashSettings.retentionDays).toBe(30);
  });
});

describe('useTrash — trashSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadTrash.mockResolvedValue([]);
    mockLoadSettings.mockResolvedValue({ retentionDays: 30, maxItems: 100 });
    mockSaveSettings.mockResolvedValue(undefined);
  });

  it('loads settings on mount', async () => {
    mockLoadSettings.mockResolvedValue({ retentionDays: 14, maxItems: 200 });
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await waitFor(() => expect(result.current.loading).toBe(false));

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
    await waitFor(() => expect(result.current.loading).toBe(false));

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
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateTrashSettings({ maxItems: 50 });
    });

    expect(result.current.trashSettings.maxItems).toBe(50);
  });

  it('moveToTrash uses current settings for expiry', async () => {
    mockLoadSettings.mockResolvedValue({ retentionDays: 7, maxItems: 100 });
    const params = defaultParams();
    const { result } = renderHook(() => useTrash(params));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.moveToTrash('scenario', makeTestScenario(), 'SC', 'path', {});
    });
    await waitFor(() => expect(result.current.trashItems.length).toBe(1));

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
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trashItems).toHaveLength(3);

    await act(async () => {
      result.current.moveToTrash('test', makeScenario({ id: 'new' }), 'New', '', {});
    });
    await waitFor(() => expect(result.current.trashItems[0].entityName).toBe('New'));

    expect(result.current.trashItems).toHaveLength(3);
    expect(result.current.trashItems.map(i => i.entityName)).toEqual(['New', 'T0', 'T1']);
  });
});
