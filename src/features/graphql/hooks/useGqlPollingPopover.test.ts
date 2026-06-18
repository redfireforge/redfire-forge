/**
 * @vitest-environment jsdom
 *
 * useGqlPollingPopover — unit tests.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGqlPollingPopover } from './useGqlPollingPopover';

describe('useGqlPollingPopover', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('starts with popover closed', () => {
    const { result } = renderHook(() =>
      useGqlPollingPopover({ pollingEnabled: false, pollingIntervalSeconds: 30 })
    );
    expect(result.current.pollingOpen).toBe(false);
  });

  it('setPollingOpen(true) opens the popover', () => {
    const { result } = renderHook(() =>
      useGqlPollingPopover({ pollingEnabled: false, pollingIntervalSeconds: 30 })
    );
    act(() => { result.current.setPollingOpen(true); });
    expect(result.current.pollingOpen).toBe(true);
  });

  it('syncs localIntervalSeconds when pollingIntervalSeconds prop changes', () => {
    const { result, rerender } = renderHook(
      ({ intervalSeconds }) =>
        useGqlPollingPopover({ pollingEnabled: true, pollingIntervalSeconds: intervalSeconds }),
      { initialProps: { intervalSeconds: 30 } }
    );
    expect(result.current.localIntervalSeconds).toBe(30);

    rerender({ intervalSeconds: 60 });
    expect(result.current.localIntervalSeconds).toBe(60);
  });

  it('commitPollingInterval clamps to MIN_POLL_SECONDS (10)', () => {
    const onPollingChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlPollingPopover({ pollingEnabled: true, pollingIntervalSeconds: 5, onPollingChange })
    );
    act(() => { result.current.setLocalIntervalSeconds(2); });
    act(() => { result.current.commitPollingInterval(); });
    // Should have clamped to minimum (10s)
    expect(onPollingChange).toHaveBeenCalledWith(true, 10);
  });

  it('commitPollingInterval clamps to MAX_POLL_SECONDS (3600)', () => {
    const onPollingChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlPollingPopover({ pollingEnabled: true, pollingIntervalSeconds: 5000, onPollingChange })
    );
    act(() => { result.current.setLocalIntervalSeconds(5000); });
    act(() => { result.current.commitPollingInterval(); });
    expect(onPollingChange).toHaveBeenCalledWith(true, 3600);
  });

  it('closePollingPopoverViaRef closes the popover', () => {
    const { result } = renderHook(() =>
      useGqlPollingPopover({ pollingEnabled: false, pollingIntervalSeconds: 30 })
    );
    act(() => { result.current.setPollingOpen(true); });
    expect(result.current.pollingOpen).toBe(true);

    act(() => { result.current.closePollingPopoverViaRef.current(); });
    expect(result.current.pollingOpen).toBe(false);
  });

  it('closePollingPopoverViaRef commits interval when polling is enabled', () => {
    const onPollingChange = vi.fn();
    const { result } = renderHook(() =>
      useGqlPollingPopover({ pollingEnabled: true, pollingIntervalSeconds: 30, onPollingChange })
    );
    act(() => { result.current.setPollingOpen(true); });
    act(() => { result.current.setLocalIntervalSeconds(45); });
    act(() => { result.current.closePollingPopoverViaRef.current(); });
    expect(onPollingChange).toHaveBeenCalledWith(true, 45);
  });

  it('provides stable refs for buttons', () => {
    const { result } = renderHook(() =>
      useGqlPollingPopover({ pollingEnabled: false, pollingIntervalSeconds: 30 })
    );
    expect(result.current.pollingBtnRef).toBeDefined();
    expect(result.current.pollingPopoverRef).toBeDefined();
    expect(result.current.pollingSwitchRef).toBeDefined();
  });

  it('pollingPopoverPos is null initially', () => {
    const { result } = renderHook(() =>
      useGqlPollingPopover({ pollingEnabled: false, pollingIntervalSeconds: 30 })
    );
    expect(result.current.pollingPopoverPos).toBeNull();
  });
});
