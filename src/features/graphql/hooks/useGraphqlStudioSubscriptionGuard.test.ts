/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraphqlStudioSubscriptionGuard } from './useGraphqlStudioSubscriptionGuard';

describe('useGraphqlStudioSubscriptionGuard', () => {
  it('switches to response view and calls onSubscribe', () => {
    const onSubscribe = vi.fn();
    const setRightView = vi.fn();
    const subscription = { state: 'idle' as const, disconnect: vi.fn() };

    const { result } = renderHook(() =>
      useGraphqlStudioSubscriptionGuard({
        activeTabId: 'tab-1',
        activeTab: { operationType: 'subscription' } as never,
        subscription,
        onSubscribe,
        setRightView,
      }),
    );

    act(() => { result.current.handleSubscribe(); });
    expect(setRightView).toHaveBeenCalledWith('response');
    expect(onSubscribe).toHaveBeenCalledOnce();
  });

  it('disconnects subscription when active tab changes', () => {
    const disconnect = vi.fn();
    const subscription = { state: 'connected' as const, disconnect };

    const { rerender } = renderHook(
      ({ activeTabId }) =>
        useGraphqlStudioSubscriptionGuard({
          activeTabId,
          activeTab: { operationType: 'subscription' } as never,
          subscription,
          onSubscribe: vi.fn(),
          setRightView: vi.fn(),
        }),
      { initialProps: { activeTabId: 'tab-1' } },
    );

    rerender({ activeTabId: 'tab-2' });
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
