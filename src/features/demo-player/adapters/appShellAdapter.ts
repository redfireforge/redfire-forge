import { getDemoBridgeWindow } from './bridgeWindow';

export function collapseAppSidebar(): void {
  getDemoBridgeWindow().__demoCollapseAppSidebar?.();
}

export function expandAppSidebar(): void {
  getDemoBridgeWindow().__demoExpandAppSidebar?.();
}
