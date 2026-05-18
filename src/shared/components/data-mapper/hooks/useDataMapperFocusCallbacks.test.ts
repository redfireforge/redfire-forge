/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SetStateAction } from 'react';
import { useDataMapperFocusCallbacks } from './useDataMapperFocusCallbacks';

type Params = Parameters<typeof useDataMapperFocusCallbacks>[0];

function makeParams(overrides: Partial<Params> = {}): Params {
  return {
    selectMapping: vi.fn(),
    setSelectedIds: vi.fn(),
    clearHover: vi.fn(),
    rawNavigateToFailure: vi.fn(),
    setScrollToPathSignal: vi.fn(),
    setCompactMode: vi.fn(),
    setAdvancedControlsOpen: vi.fn(),
    ...overrides,
  };
}

/** Stateful mock so functional updates see real previous compact mode. */
function createStatefulCompactMode(initial: boolean) {
  let compact = initial;
  const setCompactMode = vi.fn((updater: SetStateAction<boolean>) => {
    compact = typeof updater === 'function' ? (updater as (prev: boolean) => boolean)(compact) : updater;
  });
  return {
    setCompactMode,
    getCompact: () => compact,
  };
}

describe('useDataMapperFocusCallbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handleSelectMappingExclusive selects mapping, clears selection set, clears hover', () => {
    const params = makeParams();
    const { result } = renderHook(() => useDataMapperFocusCallbacks(params));

    act(() => {
      result.current.handleSelectMappingExclusive('map-1');
    });

    expect(params.selectMapping).toHaveBeenCalledTimes(1);
    expect(params.selectMapping).toHaveBeenCalledWith('map-1');
    expect(params.setSelectedIds).toHaveBeenCalledTimes(1);
    const emptySet = params.setSelectedIds.mock.calls[0][0] as Set<string>;
    expect(emptySet).toBeInstanceOf(Set);
    expect(emptySet.size).toBe(0);
    expect(params.clearHover).toHaveBeenCalledTimes(1);
  });

  it('handleSelectMappingExclusive forwards null id', () => {
    const params = makeParams();
    const { result } = renderHook(() => useDataMapperFocusCallbacks(params));

    act(() => {
      result.current.handleSelectMappingExclusive(null);
    });

    expect(params.selectMapping).toHaveBeenCalledWith(null);
    expect(params.setSelectedIds).toHaveBeenCalledWith(expect.any(Set));
    expect(params.clearHover).toHaveBeenCalled();
  });

  it('handleNavigateToFailure navigates and sets scroll signal with current tick', () => {
    const params = makeParams();
    const { result } = renderHook(() => useDataMapperFocusCallbacks(params));
    const tick = Date.now();

    act(() => {
      result.current.handleNavigateToFailure('$.items[0].id');
    });

    expect(params.rawNavigateToFailure).toHaveBeenCalledTimes(1);
    expect(params.rawNavigateToFailure).toHaveBeenCalledWith('$.items[0].id');
    expect(params.setScrollToPathSignal).toHaveBeenCalledWith({
      path: '$.items[0].id',
      tick,
    });
  });

  it('handleJumpToNode sets scroll signal without raw navigation', () => {
    const params = makeParams();
    const { result } = renderHook(() => useDataMapperFocusCallbacks(params));
    const tick = Date.now();

    act(() => {
      result.current.handleJumpToNode('$.root');
    });

    expect(params.rawNavigateToFailure).not.toHaveBeenCalled();
    expect(params.setScrollToPathSignal).toHaveBeenCalledWith({
      path: '$.root',
      tick,
    });
  });

  it('handleToggleCompactMode closes advanced controls when entering compact mode', () => {
    const setAdvancedControlsOpen = vi.fn();
    const { setCompactMode, getCompact } = createStatefulCompactMode(false);
    const params = makeParams({
      setCompactMode,
      setAdvancedControlsOpen,
    });
    const { result } = renderHook(() => useDataMapperFocusCallbacks(params));

    act(() => {
      result.current.handleToggleCompactMode();
    });

    expect(setCompactMode).toHaveBeenCalledTimes(1);
    expect(getCompact()).toBe(true);
    expect(setAdvancedControlsOpen).toHaveBeenCalledTimes(1);
    expect(setAdvancedControlsOpen).toHaveBeenCalledWith(false);
  });

  it('handleToggleCompactMode does not toggle advanced controls when leaving compact mode', () => {
    const setAdvancedControlsOpen = vi.fn();
    const { setCompactMode, getCompact } = createStatefulCompactMode(true);
    const params = makeParams({
      setCompactMode,
      setAdvancedControlsOpen,
    });
    const { result } = renderHook(() => useDataMapperFocusCallbacks(params));

    act(() => {
      result.current.handleToggleCompactMode();
    });

    expect(setCompactMode).toHaveBeenCalledTimes(1);
    expect(getCompact()).toBe(false);
    expect(setAdvancedControlsOpen).not.toHaveBeenCalled();
  });

  it('replaces handleSelectMappingExclusive when selectMapping identity changes', () => {
    const selectMappingA = vi.fn();
    const selectMappingB = vi.fn();
    const params = makeParams({ selectMapping: selectMappingA });
    const { result, rerender } = renderHook((p: Params) => useDataMapperFocusCallbacks(p), {
      initialProps: params,
    });
    const firstRef = result.current.handleSelectMappingExclusive;

    rerender({ ...params, selectMapping: selectMappingB });

    expect(result.current.handleSelectMappingExclusive).not.toBe(firstRef);

    act(() => {
      result.current.handleSelectMappingExclusive('m');
    });
    expect(selectMappingB).toHaveBeenCalledWith('m');
    expect(selectMappingA).not.toHaveBeenCalled();
  });

  it('replaces handleNavigateToFailure when rawNavigateToFailure identity changes', () => {
    const navA = vi.fn();
    const navB = vi.fn();
    const params = makeParams({ rawNavigateToFailure: navA });
    const { result, rerender } = renderHook((p: Params) => useDataMapperFocusCallbacks(p), {
      initialProps: params,
    });
    const firstRef = result.current.handleNavigateToFailure;

    rerender({ ...params, rawNavigateToFailure: navB });

    expect(result.current.handleNavigateToFailure).not.toBe(firstRef);

    act(() => {
      result.current.handleNavigateToFailure('/p');
    });
    expect(navB).toHaveBeenCalledWith('/p');
    expect(navA).not.toHaveBeenCalled();
  });

  it('replaces handleJumpToNode when setScrollToPathSignal identity changes', () => {
    const scrollA = vi.fn();
    const scrollB = vi.fn();
    const params = makeParams({ setScrollToPathSignal: scrollA });
    const { result, rerender } = renderHook((p: Params) => useDataMapperFocusCallbacks(p), {
      initialProps: params,
    });
    const firstRef = result.current.handleJumpToNode;

    rerender({ ...params, setScrollToPathSignal: scrollB });

    expect(result.current.handleJumpToNode).not.toBe(firstRef);

    act(() => {
      result.current.handleJumpToNode('/q');
    });
    expect(scrollB).toHaveBeenCalled();
    expect(scrollA).not.toHaveBeenCalled();
  });

  it('replaces handleToggleCompactMode when setCompactMode or setAdvancedControlsOpen identity changes', () => {
    const params = makeParams();
    const { result, rerender } = renderHook((p: Params) => useDataMapperFocusCallbacks(p), {
      initialProps: params,
    });
    const firstToggle = result.current.handleToggleCompactMode;

    const nextAdvanced = vi.fn();
    rerender({ ...params, setAdvancedControlsOpen: nextAdvanced });

    expect(result.current.handleToggleCompactMode).not.toBe(firstToggle);

    const nextCompact = vi.fn((u: SetStateAction<boolean>) => {
      if (typeof u === 'function') {
        (u as (prev: boolean) => boolean)(false);
      }
    });
    rerender({ ...params, setAdvancedControlsOpen: nextAdvanced, setCompactMode: nextCompact });

    const secondToggle = result.current.handleToggleCompactMode;
    act(() => {
      secondToggle();
    });
    expect(nextCompact).toHaveBeenCalled();
  });
});
