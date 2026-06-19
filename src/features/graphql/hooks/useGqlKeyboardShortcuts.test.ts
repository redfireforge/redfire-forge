/**
 * @vitest-environment jsdom
 *
 * Tests for useGqlKeyboardShortcuts hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../utils/envUtils', () => ({
  findUnresolvedVars: vi.fn(() => [] as string[]),
  hasUnresolvedVars: vi.fn(() => false),
}));

import { useGqlKeyboardShortcuts } from './useGqlKeyboardShortcuts';
import { isTauri } from '../../../shared/utils/platform';
import { findUnresolvedVars } from '../utils/envUtils';

const fireKey = (key: string, opts: Partial<KeyboardEventInit> = {}) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
};

const defaults = () => ({
  handleExecute: vi.fn(),
  handleSubscribe: vi.fn(),
  handleStopSubscription: vi.fn(),
  introspect: vi.fn(),
  introspecting: false,
  cancel: vi.fn(),
  addTab: vi.fn(),
  closeActiveTab: vi.fn(),
  subscriptionState: 'idle' as const,
  subscriptionDisconnect: vi.fn(),
  activeTabOperationType: 'query' as string | null | undefined,
  execStatus: 'idle',
  endpoint: 'https://example.com',
  activeEnvironment: null,
  profileModalOpen: false,
  envModalOpen: false,
});

describe('useGqlKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(findUnresolvedVars).mockReturnValue([]);
  });

  it('Cmd+Enter calls handleExecute for query operations', () => {
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Enter', { metaKey: true });
    expect(args.handleExecute).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Ctrl+Enter also calls handleExecute', () => {
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Enter', { ctrlKey: true });
    expect(args.handleExecute).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Cmd+Enter calls handleSubscribe for subscription operations in idle state', () => {
    const args = { ...defaults(), activeTabOperationType: 'subscription' };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Enter', { metaKey: true });
    expect(args.handleSubscribe).toHaveBeenCalledTimes(1);
    expect(args.handleExecute).not.toHaveBeenCalled();
    unmount();
  });

  it('Cmd+Enter calls handleStopSubscription when subscription is active', () => {
    const args = { ...defaults(), activeTabOperationType: 'subscription', subscriptionState: 'active' as const };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Enter', { metaKey: true });
    expect(args.handleStopSubscription).toHaveBeenCalledTimes(1);
    expect(args.handleSubscribe).not.toHaveBeenCalled();
    unmount();
  });

  it('Cmd+Enter calls handleStopSubscription when subscription is connecting', () => {
    const args = { ...defaults(), activeTabOperationType: 'subscription', subscriptionState: 'connecting' as const };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Enter', { metaKey: true });
    expect(args.handleStopSubscription).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Cmd+Enter calls handleStopSubscription when subscription is reconnecting', () => {
    const args = { ...defaults(), activeTabOperationType: 'subscription', subscriptionState: 'reconnecting' as const };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Enter', { metaKey: true });
    expect(args.handleStopSubscription).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Cmd+Shift+I calls introspect when no unresolved vars', () => {
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('I', { metaKey: true, shiftKey: true });
    expect(args.introspect).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Cmd+Shift+I does not introspect when already introspecting', () => {
    const args = { ...defaults(), introspecting: true };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('I', { metaKey: true, shiftKey: true });
    expect(args.introspect).not.toHaveBeenCalled();
    unmount();
  });

  it('Cmd+Shift+I does not introspect when there are unresolved vars', () => {
    vi.mocked(findUnresolvedVars).mockReturnValue(['myVar']);
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('I', { metaKey: true, shiftKey: true });
    expect(args.introspect).not.toHaveBeenCalled();
    unmount();
  });

  it('Escape cancels execution when execStatus is loading', () => {
    const args = { ...defaults(), execStatus: 'loading' };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Escape');
    expect(args.cancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Escape does not cancel when execStatus is not loading', () => {
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Escape');
    expect(args.cancel).not.toHaveBeenCalled();
    unmount();
  });

  it('Escape disconnects active subscription', () => {
    const args = { ...defaults(), subscriptionState: 'active' as const };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Escape');
    expect(args.subscriptionDisconnect).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Escape disconnects connecting subscription', () => {
    const args = { ...defaults(), subscriptionState: 'connecting' as const };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Escape');
    expect(args.subscriptionDisconnect).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Escape does not call subscriptionDisconnect when idle', () => {
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Escape');
    expect(args.subscriptionDisconnect).not.toHaveBeenCalled();
    unmount();
  });

  it('Cmd+W calls closeActiveTab in Tauri mode', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('w', { metaKey: true });
    expect(args.closeActiveTab).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Cmd+W does nothing in web mode', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('w', { metaKey: true });
    expect(args.closeActiveTab).not.toHaveBeenCalled();
    unmount();
  });

  it('Cmd+T calls addTab in Tauri mode', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('t', { metaKey: true });
    expect(args.addTab).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Cmd+T does nothing in web mode', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('t', { metaKey: true });
    expect(args.addTab).not.toHaveBeenCalled();
    unmount();
  });

  it('skips execution shortcut when profileModalOpen is true', () => {
    const args = { ...defaults(), profileModalOpen: true };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Enter', { metaKey: true });
    expect(args.handleExecute).not.toHaveBeenCalled();
    unmount();
  });

  it('skips execution shortcut when envModalOpen is true', () => {
    const args = { ...defaults(), envModalOpen: true };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Enter', { metaKey: true });
    expect(args.handleExecute).not.toHaveBeenCalled();
    unmount();
  });

  it('Escape still runs even when profileModalOpen is true', () => {
    const args = { ...defaults(), profileModalOpen: true, execStatus: 'loading' };
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    fireKey('Escape');
    expect(args.cancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('removes event listener on unmount', () => {
    const args = defaults();
    const { unmount } = renderHook(() => useGqlKeyboardShortcuts(args));
    unmount();
    fireKey('Enter', { metaKey: true });
    expect(args.handleExecute).not.toHaveBeenCalled();
  });
});
