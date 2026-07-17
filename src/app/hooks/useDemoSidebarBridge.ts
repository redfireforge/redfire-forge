import { useEffect, type Dispatch, type SetStateAction } from 'react';

/**
 * Demo-player bridge for the app-level workflows list sidebar.
 *   - `__demoCollapseAppSidebar()` — hide sidebar (e.g. after + New workflow)
 *   - `__demoExpandAppSidebar()` — show sidebar (e.g. demo restart before create step)
 */
export function useDemoSidebarBridge(
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    const collapse = () => setSidebarCollapsed(true);
    const expand = () => setSidebarCollapsed(false);

    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = collapse;
    (window as unknown as Record<string, unknown>).__demoExpandAppSidebar = expand;

    return () => {
      delete (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar;
      delete (window as unknown as Record<string, unknown>).__demoExpandAppSidebar;
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
