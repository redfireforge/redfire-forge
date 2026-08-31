/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useDesktopFeatureGate } from './useDesktopFeatureGate';
import type { Tab } from '../utils/appTabUtils';

vi.mock('../utils/desktopFeatureGate', () => ({
  getBlockedDesktopFeature: (tab: string) =>
    tab === 'grpc-studio' ? 'gRPC Studio' : null,
}));

function useHarness() {
  const [tab, setTab] = useState<Tab>('requests');
  const gate = useDesktopFeatureGate(setTab);
  return { tab, ...gate };
}

describe('useDesktopFeatureGate', () => {
  it('navigates normally for allowed tabs', () => {
    const { result } = renderHook(() => useHarness());
    act(() => { result.current.gatedSetActiveTab('gallery'); });
    expect(result.current.tab).toBe('gallery');
    expect(result.current.desktopRequiredFeature).toBeNull();
  });

  it('blocks desktop-only tabs and stores feature name', async () => {
    const { result } = renderHook(() => useHarness());
    act(() => { result.current.gatedSetActiveTab('grpc-studio'); });
    expect(result.current.tab).toBe('requests');
    await act(async () => { await Promise.resolve(); });
    expect(result.current.desktopRequiredFeature).toBe('gRPC Studio');
  });

  it('dismiss clears the feature', async () => {
    const { result } = renderHook(() => useHarness());
    act(() => { result.current.gatedSetActiveTab('grpc-studio'); });
    await act(async () => { await Promise.resolve(); });
    act(() => { result.current.dismissDesktopRequired(); });
    expect(result.current.desktopRequiredFeature).toBeNull();
  });

  it('supports functional setState updates', () => {
    const { result } = renderHook(() => useHarness());
    act(() => {
      result.current.gatedSetActiveTab((prev) => (prev === 'requests' ? 'catalog' : prev));
    });
    expect(result.current.tab).toBe('catalog');
  });
});
