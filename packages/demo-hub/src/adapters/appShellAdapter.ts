import { getDemoBridgeWindow } from './bridgeWindow';
import {
  beginDemoAppSidebarSession as beginDemoAppSidebarSessionFlags,
  endDemoAppSidebarSession as endDemoAppSidebarSessionFlags,
} from '@shared/demoAppSidebarSession';

export function collapseAppSidebar(): void {
  getDemoBridgeWindow().__demoCollapseAppSidebar?.();
}

export function expandAppSidebar(): void {
  getDemoBridgeWindow().__demoExpandAppSidebar?.();
}

/** Start of a live lesson: default-hide, forget a previous Show pin. */
export function beginDemoAppSidebarSession(): void {
  beginDemoAppSidebarSessionFlags();
  getDemoBridgeWindow().__demoBeginAppSidebarSession?.();
}

/** End of a live lesson: drop the Show pin so product use is unaffected. */
export function endDemoAppSidebarSession(): void {
  endDemoAppSidebarSessionFlags();
  getDemoBridgeWindow().__demoEndAppSidebarSession?.();
}
