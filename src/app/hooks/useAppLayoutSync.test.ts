/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppLayoutSync } from './useAppLayoutSync';

describe('useAppLayoutSync', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--header-h');
    document.documentElement.style.removeProperty('--sidebar-w');
  });

  it('sets --sidebar-w to activity-bar-only width when collapsed', () => {
    renderHook(() => useAppLayoutSync({ sidebarWidth: 280, sidebarCollapsed: true }));
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('48px');
  });

  it('sets --sidebar-w to activity-bar + sidebar width when not collapsed', () => {
    renderHook(() => useAppLayoutSync({ sidebarWidth: 280, sidebarCollapsed: false }));
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('328px');
  });

  it('updates --sidebar-w when sidebarCollapsed changes', () => {
    const { rerender } = renderHook(
      ({ w, c }) => useAppLayoutSync({ sidebarWidth: w, sidebarCollapsed: c }),
      { initialProps: { w: 200, c: false } },
    );
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('248px');
    rerender({ w: 200, c: true });
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('48px');
  });

  it('updates --sidebar-w when sidebarWidth changes', () => {
    const { rerender } = renderHook(
      ({ w, c }) => useAppLayoutSync({ sidebarWidth: w, sidebarCollapsed: c }),
      { initialProps: { w: 200, c: false } },
    );
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('248px');
    rerender({ w: 300, c: false });
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('348px');
  });

  it('returns a ref (initially null before attach)', () => {
    const { result } = renderHook(() => useAppLayoutSync({ sidebarWidth: 200, sidebarCollapsed: false }));
    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull();
  });

  it('syncs --header-h from headerRef when element has offsetHeight', () => {
    const { result } = renderHook(() => useAppLayoutSync({ sidebarWidth: 200, sidebarCollapsed: false }));
    const el = document.createElement('header');
    Object.defineProperty(el, 'offsetHeight', { value: 56, configurable: true });
    // Attach the ref manually and trigger resize to re-sync
    Object.defineProperty(result.current, 'current', { value: el, writable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('56px');
  });

  it('removes resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useAppLayoutSync({ sidebarWidth: 200, sidebarCollapsed: false }));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
