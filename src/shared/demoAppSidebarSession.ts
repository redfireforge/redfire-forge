/** Live-demo default-hide for the app list sidebar. Pin stays if the user clicks Show. */

export const DEMO_LIVE_SESSION_KEY = 'redfire-demo-live-session-v1';
export const DEMO_SIDEBAR_PIN_KEY = 'redfire-demo-sidebar-user-pinned-v1';
export const DEMO_SIDEBAR_SESSION_KEY = 'redfire-demo-sidebar-session-v1';

function readFlag(key: string): boolean {
  try {
    return Boolean(sessionStorage.getItem(key));
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    /* quota / private mode */
  }
}

export function isDemoLiveSessionActive(): boolean {
  return readFlag(DEMO_LIVE_SESSION_KEY);
}

export function isDemoAppSidebarSession(): boolean {
  return readFlag(DEMO_SIDEBAR_SESSION_KEY) || isDemoLiveSessionActive();
}

export function isDemoAppSidebarPinned(): boolean {
  return readFlag(DEMO_SIDEBAR_PIN_KEY);
}

export function markDemoAppSidebarUserExpanded(): void {
  if (!isDemoAppSidebarSession()) return;
  writeFlag(DEMO_SIDEBAR_PIN_KEY, true);
}

export function markDemoAppSidebarUserCollapsed(): void {
  writeFlag(DEMO_SIDEBAR_PIN_KEY, false);
}

export function beginDemoAppSidebarSession(): void {
  writeFlag(DEMO_SIDEBAR_PIN_KEY, false);
  writeFlag(DEMO_SIDEBAR_SESSION_KEY, true);
}

export function endDemoAppSidebarSession(): void {
  writeFlag(DEMO_SIDEBAR_PIN_KEY, false);
  writeFlag(DEMO_SIDEBAR_SESSION_KEY, false);
}
