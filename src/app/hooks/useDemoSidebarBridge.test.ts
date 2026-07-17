/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import {
  useDemoSidebarBridge,
  collapseDemoAppSidebar,
  expandDemoAppSidebar,
} from './useDemoSidebarBridge';

function useSidebarHarness(initialCollapsed = false) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);
  useDemoSidebarBridge(setSidebarCollapsed);
  return { sidebarCollapsed, setSidebarCollapsed };
}

describe('useDemoSidebarBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar;
    delete (window as unknown as Record<string, unknown>).__demoExpandAppSidebar;
  });

  it('exposes collapse and expand on window', () => {
    renderHook(() => useSidebarHarness());
    expect((window as unknown as Record<string, unknown>).__demoCollapseAppSidebar).toBeTypeOf('function');
    expect((window as unknown as Record<string, unknown>).__demoExpandAppSidebar).toBeTypeOf('function');
  });

  it('collapse hides sidebar and expand shows it again', () => {
    const { result } = renderHook(() => useSidebarHarness(false));
    act(() => { collapseDemoAppSidebar(); });
    expect(result.current.sidebarCollapsed).toBe(true);
    act(() => { expandDemoAppSidebar(); });
    expect(result.current.sidebarCollapsed).toBe(false);
  });

  it('cleans up window bridges on unmount', () => {
    const { unmount } = renderHook(() => useSidebarHarness());
    unmount();
    expect((window as unknown as Record<string, unknown>).__demoCollapseAppSidebar).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoExpandAppSidebar).toBeUndefined();
  });
});
