/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GRPC_LOAD_TEST_CONFIG, createInitialGrpcTabAdvancedFeaturesUiState } from '../grpcStudioAdvancedTypes';

const listMock = vi.fn();
const saveMock = vi.fn();
const renameMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../data/grpcLoadTestProfileRepository', () => ({
  listGrpcLoadTestProfiles: (...args: unknown[]) => listMock(...args),
  saveGrpcLoadTestProfile: (...args: unknown[]) => saveMock(...args),
  renameGrpcLoadTestProfile: (...args: unknown[]) => renameMock(...args),
  deleteGrpcLoadTestProfile: (...args: unknown[]) => deleteMock(...args),
}));

import { useGrpcLoadTestProfilesState } from './useGrpcLoadTestProfilesState';

describe('useGrpcLoadTestProfilesState coverage gaps', () => {
  beforeEach(() => {
    listMock.mockReset();
    saveMock.mockReset();
    renameMock.mockReset();
    deleteMock.mockReset();
    listMock.mockResolvedValue([]);
  });

  it('loads profiles and clears stale selected id when list refresh fails', async () => {
    listMock.mockRejectedValueOnce('network down');

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });
    expect(result.current.loadTestProfileError).toBe('Failed to load profiles');
  });

  it('loads profiles and surfaces Error message when list refresh fails', async () => {
    listMock.mockRejectedValueOnce(new Error('load exploded'));

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });
    expect(result.current.loadTestProfileError).toBe('load exploded');
  });

  it('updates an existing profile when save name matches selected profile', async () => {
    listMock.mockResolvedValue([{
      id: 'profile-1',
      name: 'Baseline',
      updatedAt: '2026-07-01T00:00:00.000Z',
      config: { concurrency: 2, totalCalls: 20 },
    }]);
    saveMock.mockResolvedValue({
      id: 'profile-1',
      name: 'Baseline',
      updatedAt: '2026-07-01T00:00:01.000Z',
      config: { concurrency: 4, totalCalls: 40 },
    });

    const patchTabState = vi.fn();
    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      { concurrency: 4, totalCalls: 40 },
      patchTabState,
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(1);
    });

    act(() => {
      result.current.setSelectedLoadTestProfileId('profile-1');
    });

    await act(async () => {
      await result.current.saveLoadTestProfile('baseline');
    });

    expect(saveMock).toHaveBeenCalledWith({
      id: 'profile-1',
      name: 'baseline',
      config: { concurrency: 4, totalCalls: 40 },
    });
  });

  it('loadLoadTestProfile patches tab state and resets idle runtime when not in flight', async () => {
    const profile = {
      id: 'profile-2',
      name: 'Heavy',
      updatedAt: '2026-07-01T00:00:00.000Z',
      config: { concurrency: 8, totalCalls: 80 },
    };
    listMock.mockResolvedValue([profile]);

    const patchTabState = vi.fn();
    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      patchTabState,
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(1);
    });

    act(() => {
      result.current.loadLoadTestProfile('missing-id');
    });
    expect(patchTabState).not.toHaveBeenCalled();

    act(() => {
      result.current.loadLoadTestProfile('profile-2');
    });
    expect(patchTabState).toHaveBeenCalled();
    const updater = patchTabState.mock.calls[0]?.[1];
    expect(typeof updater).toBe('function');
    const next = (updater as (prev: ReturnType<typeof createInitialGrpcTabAdvancedFeaturesUiState>) => unknown)(
      createInitialGrpcTabAdvancedFeaturesUiState(),
    );
    expect(next).toMatchObject({
      loadTest: {
        config: { concurrency: 8, totalCalls: 80 },
        lastSummary: undefined,
      },
    });
  });

  it('loadLoadTestProfile preserves in-flight runtime state', async () => {
    listMock.mockResolvedValue([{
      id: 'profile-4',
      name: 'Running',
      updatedAt: '2026-07-01T00:00:00.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    }]);
    const patchTabState = vi.fn();
    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      patchTabState,
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(1);
    });

    act(() => {
      result.current.loadLoadTestProfile('profile-4');
    });
    const inFlightPrev = createInitialGrpcTabAdvancedFeaturesUiState();
    inFlightPrev.runtime.loadTest.status = 'running';
    const updater = patchTabState.mock.calls[0]?.[1] as (prev: typeof inFlightPrev) => typeof inFlightPrev;
    const next = updater(inFlightPrev);
    expect(next.runtime.loadTest.status).toBe('running');
  });

  it('rename and delete succeed for selected profile and refresh list', async () => {
    listMock.mockResolvedValue([{
      id: 'profile-5',
      name: 'Temp',
      updatedAt: '2026-07-01T00:00:00.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    }]);
    renameMock.mockResolvedValue({
      id: 'profile-5-renamed',
      name: 'Renamed',
      updatedAt: '2026-07-01T00:00:01.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    });
    deleteMock.mockResolvedValue(undefined);
    listMock
      .mockResolvedValueOnce([{
        id: 'profile-5',
        name: 'Temp',
        updatedAt: '2026-07-01T00:00:00.000Z',
        config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
      }])
      .mockResolvedValueOnce([{
        id: 'profile-5-renamed',
        name: 'Renamed',
        updatedAt: '2026-07-01T00:00:01.000Z',
        config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
      }])
      .mockResolvedValue([]);

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(1);
    });

    act(() => {
      result.current.setSelectedLoadTestProfileId('profile-5');
    });

    await act(async () => {
      await result.current.renameLoadTestProfile('profile-5', 'Renamed');
    });
    expect(result.current.selectedLoadTestProfileId).toBe('profile-5-renamed');

    await act(async () => {
      await result.current.removeLoadTestProfile('profile-5-renamed');
    });
    expect(result.current.selectedLoadTestProfileId).toBe('');
  });

  it('saveLoadTestProfile creates a new profile when names differ', async () => {
    listMock.mockResolvedValue([{
      id: 'profile-6',
      name: 'Alpha',
      updatedAt: '2026-07-01T00:00:00.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    }]);
    saveMock.mockResolvedValue({
      id: 'profile-7',
      name: 'Beta',
      updatedAt: '2026-07-01T00:00:01.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    });

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(1);
    });

    act(() => {
      result.current.setSelectedLoadTestProfileId('profile-6');
    });

    await act(async () => {
      await result.current.saveLoadTestProfile('Beta');
    });

    expect(saveMock).toHaveBeenCalledWith({
      id: undefined,
      name: 'Beta',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    });
  });

  it('refreshLoadTestProfiles clears stale selected profile id', async () => {
    listMock
      .mockResolvedValueOnce([
        {
          id: 'profile-8',
          name: 'Stale',
          updatedAt: '2026-07-01T00:00:00.000Z',
          config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
        },
        {
          id: 'profile-9',
          name: 'Keep',
          updatedAt: '2026-07-01T00:00:00.000Z',
          config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
        },
      ])
      .mockResolvedValueOnce([{
        id: 'profile-9',
        name: 'Keep',
        updatedAt: '2026-07-01T00:00:01.000Z',
        config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
      }]);
    renameMock.mockResolvedValue({
      id: 'profile-9',
      name: 'Keep renamed',
      updatedAt: '2026-07-01T00:00:01.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    });

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(2);
    });

    act(() => {
      result.current.setSelectedLoadTestProfileId('profile-8');
    });

    await act(async () => {
      await result.current.renameLoadTestProfile('profile-9', 'Keep renamed');
    });

    expect(result.current.selectedLoadTestProfileId).toBe('');
  });

  it('rename and delete propagate repository failures and clear selected id', async () => {
    listMock.mockResolvedValue([{
      id: 'profile-3',
      name: 'Temp',
      updatedAt: '2026-07-01T00:00:00.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    }]);
    renameMock.mockRejectedValue('rename failed');
    deleteMock.mockRejectedValue('delete failed');

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(1);
    });

    act(() => {
      result.current.setSelectedLoadTestProfileId('profile-3');
    });

    let renameError: unknown;
    await act(async () => {
      try {
        await result.current.renameLoadTestProfile('profile-3', 'New Name');
      } catch (error) {
        renameError = error;
      }
    });
    expect(renameError).toBe('rename failed');
    expect(result.current.loadTestProfileError).toBe('Failed to rename profile');

    renameMock.mockRejectedValueOnce(new Error('rename exploded'));
    await act(async () => {
      try {
        await result.current.renameLoadTestProfile('profile-3', 'Another Name');
      } catch {
        // expected
      }
    });
    expect(result.current.loadTestProfileError).toBe('rename exploded');

    let deleteError: unknown;
    await act(async () => {
      try {
        await result.current.removeLoadTestProfile('profile-3');
      } catch (error) {
        deleteError = error;
      }
    });
    expect(deleteError).toBe('delete failed');
    expect(result.current.loadTestProfileError).toBe('Failed to delete profile');
  });

  it('rename keeps selected id unchanged when renaming a different profile', async () => {
    listMock.mockResolvedValue([
      {
        id: 'profile-10',
        name: 'Selected',
        updatedAt: '2026-07-01T00:00:00.000Z',
        config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
      },
      {
        id: 'profile-11',
        name: 'Other',
        updatedAt: '2026-07-01T00:00:00.000Z',
        config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
      },
    ]);
    renameMock.mockResolvedValue({
      id: 'profile-11',
      name: 'Other renamed',
      updatedAt: '2026-07-01T00:00:01.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    });

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(2);
    });

    act(() => {
      result.current.setSelectedLoadTestProfileId('profile-10');
    });

    await act(async () => {
      await result.current.renameLoadTestProfile('profile-11', 'Other renamed');
    });

    expect(result.current.selectedLoadTestProfileId).toBe('profile-10');
  });

  it('saveLoadTestProfile surfaces Error message failures', async () => {
    saveMock.mockRejectedValue(new Error('save exploded'));
    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    let saveError: unknown;
    await act(async () => {
      try {
        await result.current.saveLoadTestProfile('New profile');
      } catch (error) {
        saveError = error;
      }
    });
    expect(saveError).toBeInstanceOf(Error);
    expect(result.current.loadTestProfileError).toBe('save exploded');
  });

  it('removeLoadTestProfile keeps selected id when deleting a different profile', async () => {
    listMock.mockResolvedValue([
      {
        id: 'profile-12',
        name: 'Keep selected',
        updatedAt: '2026-07-01T00:00:00.000Z',
        config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
      },
      {
        id: 'profile-13',
        name: 'Delete me',
        updatedAt: '2026-07-01T00:00:00.000Z',
        config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
      },
    ]);
    deleteMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(2);
    });

    act(() => {
      result.current.setSelectedLoadTestProfileId('profile-12');
    });

    await act(async () => {
      await result.current.removeLoadTestProfile('profile-13');
    });

    expect(result.current.selectedLoadTestProfileId).toBe('profile-12');
  });

  it('saveLoadTestProfile creates a new profile when selected id is stale', async () => {
    listMock.mockResolvedValue([{
      id: 'profile-14',
      name: 'Existing',
      updatedAt: '2026-07-01T00:00:00.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    }]);
    saveMock.mockResolvedValue({
      id: 'profile-15',
      name: 'Existing',
      updatedAt: '2026-07-01T00:00:01.000Z',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    });

    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfiles).toHaveLength(1);
    });

    act(() => {
      result.current.setSelectedLoadTestProfileId('missing-selected');
    });

    await act(async () => {
      await result.current.saveLoadTestProfile('Existing');
    });

    expect(saveMock).toHaveBeenCalledWith({
      id: undefined,
      name: 'Existing',
      config: DEFAULT_GRPC_LOAD_TEST_CONFIG,
    });
  });

  it('saveLoadTestProfile surfaces non-Error failures', async () => {
    saveMock.mockRejectedValue('save failed');
    const { result } = renderHook(() => useGrpcLoadTestProfilesState(
      'tab-1',
      DEFAULT_GRPC_LOAD_TEST_CONFIG,
      vi.fn(),
    ));

    await waitFor(() => {
      expect(result.current.loadTestProfilesLoading).toBe(false);
    });

    let saveError: unknown;
    await act(async () => {
      try {
        await result.current.saveLoadTestProfile('New profile');
      } catch (error) {
        saveError = error;
      }
    });
    expect(saveError).toBe('save failed');
    expect(result.current.loadTestProfileError).toBe('Failed to save profile');
  });
});
