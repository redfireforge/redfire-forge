import { useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';

interface Options {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
}

/**
 * Keeps CSS variables `--header-h` and `--sidebar-w` in sync with
 * the actual rendered dimensions of the app chrome.
 *
 * Returns a ref that must be attached to the `<header>` element so the
 * hook can read its `offsetHeight`.
 */
export function useAppLayoutSync({ sidebarWidth, sidebarCollapsed }: Options): RefObject<HTMLElement | null> {
  const headerRef = useRef<HTMLElement>(null);

  const syncHeaderHeight = useCallback(() => {
    if (headerRef.current) {
      document.documentElement.style.setProperty('--header-h', `${headerRef.current.offsetHeight}px`);
    }
  }, []);

  useEffect(() => {
    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);
    return () => window.removeEventListener('resize', syncHeaderHeight);
  }, [syncHeaderHeight]);

  // Activity bar is 48px; when the sidebar is collapsed the unified-sidebar is unmounted.
  useEffect(() => {
    const activityBar = 48;
    const total = sidebarCollapsed ? activityBar : activityBar + sidebarWidth;
    document.documentElement.style.setProperty('--sidebar-w', `${total}px`);
  }, [sidebarWidth, sidebarCollapsed]);

  return headerRef;
}
