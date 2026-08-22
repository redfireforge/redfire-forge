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
import {
  beginDemoAppSidebarSession,
  endDemoAppSidebarSession,
  DEMO_SIDEBAR_PIN_KEY,
  DEMO_SIDEBAR_SESSION_KEY,
} from '../../shared/demoAppSidebarSession';

function useSidebarHarness(initialCollapsed = false) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);
  useDemoSidebarBridge(setSidebarCollapsed);
  return { sidebarCollapsed, setSidebarCollapsed };
}

describe('useDemoSidebarBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar;
    delete (window as unknown as Record<string, unknown>).__demoExpandAppSidebar;
    delete (window as unknown as Record<string, unknown>).__demoBeginAppSidebarSession;
    delete (window as unknown as Record<string, unknown>).__demoEndAppSidebarSession;
    sessionStorage.removeItem(DEMO_SIDEBAR_PIN_KEY);
    sessionStorage.removeItem(DEMO_SIDEBAR_SESSION_KEY);
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

  it('collapse is a no-op after the user shows the sidebar in a demo', () => {
    const { result } = renderHook(() => useSidebarHarness(false));
    act(() => {
      beginDemoAppSidebarSession();
      sessionStorage.setItem(DEMO_SIDEBAR_PIN_KEY, '1');
      collapseDemoAppSidebar();
    });
    expect(result.current.sidebarCollapsed).toBe(false);
  });

  it('collapse hides again after the pin is cleared', () => {
    const { result } = renderHook(() => useSidebarHarness(false));
    act(() => {
      beginDemoAppSidebarSession();
      sessionStorage.setItem(DEMO_SIDEBAR_PIN_KEY, '1');
      endDemoAppSidebarSession();
      collapseDemoAppSidebar();
    });
    expect(result.current.sidebarCollapsed).toBe(true);
  });

  it('exposes begin/end session bridges', () => {
    renderHook(() => useSidebarHarness());
    expect((window as unknown as Record<string, unknown>).__demoBeginAppSidebarSession).toBeTypeOf('function');
    expect((window as unknown as Record<string, unknown>).__demoEndAppSidebarSession).toBeTypeOf('function');
    act(() => {
      ((window as unknown as Record<string, unknown>).__demoBeginAppSidebarSession as () => void)();
      ((window as unknown as Record<string, unknown>).__demoEndAppSidebarSession as () => void)();
    });
  });

  it('cleans up window bridges on unmount', () => {
    const { unmount } = renderHook(() => useSidebarHarness());
    unmount();
    expect((window as unknown as Record<string, unknown>).__demoCollapseAppSidebar).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoExpandAppSidebar).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoBeginAppSidebarSession).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__demoEndAppSidebarSession).toBeUndefined();
  });
});
