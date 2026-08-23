import { useEffect, type Dispatch, type SetStateAction } from 'react';
import {
  beginDemoAppSidebarSession,
  endDemoAppSidebarSession,
  isDemoAppSidebarPinned,
} from '@shared/demoAppSidebarSession';

export {
  beginDemoAppSidebarSession,
  endDemoAppSidebarSession,
  isDemoAppSidebarSession,
  isDemoAppSidebarPinned,
  isDemoLiveSessionActive,
  markDemoAppSidebarUserCollapsed,
  markDemoAppSidebarUserExpanded,
} from '@shared/demoAppSidebarSession';

/**
 * Demo-player bridge for the app-level list sidebar.
 *   - `__demoCollapseAppSidebar()` — hide unless the user pinned it open
 *   - `__demoExpandAppSidebar()` — show sidebar
 */
export function useDemoSidebarBridge(
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    const collapse = () => {
      if (isDemoAppSidebarPinned()) return;
      setSidebarCollapsed(true);
    };
    const expand = () => setSidebarCollapsed(false);

    const win = window as unknown as Record<string, unknown>;
    win.__demoCollapseAppSidebar = collapse;
    win.__demoExpandAppSidebar = expand;
    win.__demoBeginAppSidebarSession = beginDemoAppSidebarSession;
    win.__demoEndAppSidebarSession = endDemoAppSidebarSession;

    return () => {
      delete win.__demoCollapseAppSidebar;
      delete win.__demoExpandAppSidebar;
      delete win.__demoBeginAppSidebarSession;
      delete win.__demoEndAppSidebarSession;
    };
  }, [setSidebarCollapsed]);
}

export function collapseDemoAppSidebar(): void {
  const fn = (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar as
    | (() => void)
    | undefined;
  fn?.();
}

export function expandDemoAppSidebar(): void {
  const fn = (window as unknown as Record<string, unknown>).__demoExpandAppSidebar as
    | (() => void)
    | undefined;
  fn?.();
}
