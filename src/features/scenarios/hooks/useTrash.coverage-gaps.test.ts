/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { TrashItem } from '@shared/types';
import {
  makeFg,
  makeScenario,
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

describe('useTrash — coverage gaps', () => {
  beforeEach(() => {
    resetAllMocks();
    mockLoadTrash.mockResolvedValue([]);
    mockLoadSettings.mockResolvedValue({ retentionDays: 30, maxItems: 100 });
  });

  it('restoreItem no-ops when trash id missing', async () => {
    const { result } = renderHook(() => useTrash(defaultParams()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.restoreItem('missing'); });
    expect(mockRemoveFromTrash).not.toHaveBeenCalled();
  });

  it('restoreTest adds to existing scenario when parent fg and sc exist', async () => {
    const fg = makeFg({ id: 'fg-1', scenarios: [makeScenario({ id: 'sc-1', tests: [] })] });
    const test = makeScenario({ id: 't1', name: 'Restored Test' });
    const item: TrashItem = {
      id: 'trash-t',
      deletedAt: Date.now(),
      expiresAt: Date.now() + 1,
      entityType: 'test',
      entityName: 'T',
      parentPath: '',
      parentFeatureGroupId: 'fg-1',
      parentScenarioId: 'sc-1',
      data: test,
    };
    mockLoadTrash.mockResolvedValue([item]);
    const params = defaultParams();
    params.featureGroups = [fg];
    const { result } = renderHook(() => useTrash(params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.restoreItem('trash-t'); });
    expect(params.setFeatureGroups).toHaveBeenCalled();
  });

  it('restoreTest creates restored scenario when parent fg exists without parent sc', async () => {
    const fg = makeFg({ id: 'fg-2', scenarios: [] });
    const test = makeScenario({ id: 't2' });
    const item: TrashItem = {
      id: 'trash-t2',
      deletedAt: Date.now(),
      expiresAt: Date.now() + 1,
      entityType: 'test',
      entityName: 'T2',
      parentPath: '',
      parentFeatureGroupId: 'fg-2',
      parentScenarioId: 'missing-sc',
      data: test,
    };
    mockLoadTrash.mockResolvedValue([item]);
    const params = defaultParams();
    params.featureGroups = [fg];
    const { result } = renderHook(() => useTrash(params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.restoreItem('trash-t2'); });
    expect(params.setFeatureGroups).toHaveBeenCalled();
  });

  it('swallows storage errors on moveToTrash, restore, delete, and empty', async () => {
    mockAddToTrash.mockRejectedValueOnce(new Error('persist fail'));
    mockRemoveFromTrash.mockRejectedValueOnce(new Error('remove fail'));
    mockEmptyTrash.mockRejectedValueOnce(new Error('empty fail'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useTrash(defaultParams()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.moveToTrash('featureGroup', makeFg(), 'X', '', {});
      await Promise.resolve();
    });
    const item: TrashItem = {
      id: 'x', deletedAt: 1, expiresAt: 2, entityType: 'featureGroup', entityName: 'X',
      parentPath: '', data: makeFg(),
    };
    mockLoadTrash.mockResolvedValue([item]);
    await act(async () => { await result.current.restoreItem('x'); });
    await act(async () => { await result.current.permanentlyDelete('x'); });
    await act(async () => { await result.current.emptyAllTrash(); });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
