import { DEMO_HUB_STUB, type DemoHubApi } from './demoHubApi';

export const DEMO_HUB_MOUNT_ID = 'demo-hub-mount';

/** Live demo hub handle — updated by lazy `DemoShellHost`; no demo-player imports. */
export const demoHubRuntimeRef: { current: DemoHubApi } = { current: DEMO_HUB_STUB };

export function syncDemoHubRuntimeRef(hub: DemoHubApi): void {
  demoHubRuntimeRef.current = hub;
}

export function resetDemoHubRuntimeRef(): void {
  demoHubRuntimeRef.current = DEMO_HUB_STUB;
}
