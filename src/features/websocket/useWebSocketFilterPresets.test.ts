/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketFilterPresets } from './useWebSocketFilterPresets';
import { loadWsFilterPresets, saveWsFilterPresets } from '../../shared/websocket/websocketStorage';

vi.mock('../../shared/websocket/websocketStorage', () => ({
  loadWsFilterPresets: vi.fn().mockResolvedValue([]),
  saveWsFilterPresets: vi.fn().mockResolvedValue(undefined),
}));

const mockLoad = vi.mocked(loadWsFilterPresets);
const mockSave = vi.mocked(saveWsFilterPresets);

describe('useWebSocketFilterPresets', () => {
  const mockDeps = () => ({
    searchMode: 'text' as const,
    searchText: '',
    sizeFilter: 'all' as const,
    timeFilter: 'all' as const,
    contentTypeFilter: 'all' as const,
    setSearchMode: vi.fn(),
    setSearchText: vi.fn(),
    setSizeFilter: vi.fn(),
    setTimeFilter: vi.fn(),
    setContentTypeFilter: vi.fn(),
    setShowFilterBar: vi.fn(),
    setPresetDropdownOpen: vi.fn(),
  });

  it('initializes with empty presets', async () => {
    const deps = mockDeps();
    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    // After async load
    await vi.waitFor(() => {
      expect(result.current.filterPresets).toEqual([]);
    });
  });

  it('saves a preset with prompt name', async () => {
    const deps = mockDeps();
    deps.searchMode = 'regex';
    deps.searchText = 'test.*';
    deps.sizeFilter = 'lt1k';
    vi.spyOn(window, 'prompt').mockReturnValue('My Preset');

    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    act(() => result.current.handleSavePreset());

    expect(result.current.filterPresets).toHaveLength(1);
    expect(result.current.filterPresets[0].name).toBe('My Preset');
    expect(result.current.filterPresets[0].searchMode).toBe('regex');
    expect(result.current.filterPresets[0].searchQuery).toBe('test.*');
    expect(result.current.filterPresets[0].sizeFilter).toBe('lt1k');
  });

  it('does not save preset when prompt is cancelled', () => {
    const deps = mockDeps();
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    act(() => result.current.handleSavePreset());

    expect(result.current.filterPresets).toHaveLength(0);
  });

  it('does not save preset when prompt is empty', () => {
    const deps = mockDeps();
    vi.spyOn(window, 'prompt').mockReturnValue('  ');

    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    act(() => result.current.handleSavePreset());

    expect(result.current.filterPresets).toHaveLength(0);
  });

  it('deletes a preset by id', () => {
    const deps = mockDeps();
    vi.spyOn(window, 'prompt').mockReturnValue('Test');

    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    act(() => result.current.handleSavePreset());
    const id = result.current.filterPresets[0].id;

    act(() => result.current.handleDeletePreset(id));
    expect(result.current.filterPresets).toHaveLength(0);
  });

  it('applies a preset and sets all filter values', () => {
    const deps = mockDeps();

    const preset = {
      id: 'fp-test',
      name: 'test',
      searchMode: 'regex' as const,
      searchQuery: 'error.*',
      sizeFilter: 'gt10k' as const,
      timeFilter: 'last30s' as const,
      contentTypeFilter: 'json' as const,
      createdAt: new Date().toISOString(),
    };

    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    act(() => result.current.handleApplyPreset(preset));

    expect(deps.setSearchMode).toHaveBeenCalledWith('regex');
    expect(deps.setSearchText).toHaveBeenCalledWith('error.*');
    expect(deps.setSizeFilter).toHaveBeenCalledWith('gt10k');
    expect(deps.setTimeFilter).toHaveBeenCalledWith('last30s');
    expect(deps.setContentTypeFilter).toHaveBeenCalledWith('json');
    expect(deps.setPresetDropdownOpen).toHaveBeenCalledWith(false);
    expect(deps.setShowFilterBar).toHaveBeenCalled();
    // the updater passed to setShowFilterBar forces the bar visible
    const updater = (deps.setShowFilterBar as ReturnType<typeof vi.fn>).mock.calls[0][0] as () => boolean;
    expect(updater()).toBe(true);
  });

  it('applies a preset with defaults when fields are missing', () => {
    const deps = mockDeps();

    const preset = {
      id: 'fp-test',
      name: 'simple',
      createdAt: new Date().toISOString(),
    };

    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    act(() => result.current.handleApplyPreset(preset as any));

    expect(deps.setSearchMode).toHaveBeenCalledWith('text');
    expect(deps.setSearchText).toHaveBeenCalledWith('');
    expect(deps.setSizeFilter).toHaveBeenCalledWith('all');
    expect(deps.setTimeFilter).toHaveBeenCalledWith('all');
    expect(deps.setContentTypeFilter).toHaveBeenCalledWith('all');
  });

  it('limits presets to 20', () => {
    const deps = mockDeps();
    vi.spyOn(window, 'prompt').mockReturnValue('P');

    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    for (let i = 0; i < 25; i++) {
      act(() => result.current.handleSavePreset());
    }

    expect(result.current.filterPresets.length).toBeLessThanOrEqual(20);
  });

  it('swallows errors when the initial load rejects', async () => {
    mockLoad.mockRejectedValueOnce(new Error('load failed'));
    const deps = mockDeps();
    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    await vi.waitFor(() => {
      expect(result.current.filterPresets).toEqual([]);
    });
  });

  it('swallows errors when saving a new preset rejects', async () => {
    mockSave.mockRejectedValueOnce(new Error('save failed'));
    const deps = mockDeps();
    vi.spyOn(window, 'prompt').mockReturnValue('P');
    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    act(() => result.current.handleSavePreset());
    expect(result.current.filterPresets).toHaveLength(1);
    await Promise.resolve();
  });

  it('swallows errors when deleting a preset rejects', async () => {
    const deps = mockDeps();
    vi.spyOn(window, 'prompt').mockReturnValue('P');
    const { result } = renderHook(() => useWebSocketFilterPresets(deps));
    act(() => result.current.handleSavePreset());
    const id = result.current.filterPresets[0].id;
    mockSave.mockRejectedValueOnce(new Error('save failed'));
    act(() => result.current.handleDeletePreset(id));
    expect(result.current.filterPresets).toHaveLength(0);
    await Promise.resolve();
  });
});
