import { describe, it, expect, beforeEach } from 'vitest';
import { DEMO_HUB_STUB } from './demoHubApi';
import { demoHubRuntimeRef, resetDemoHubRuntimeRef, syncDemoHubRuntimeRef } from './demoHubRuntimeRef';

describe('demoHubRuntimeRef', () => {
  beforeEach(() => {
    resetDemoHubRuntimeRef();
  });

  it('starts as stub and syncs live hub without replacing the ref object', () => {
    expect(demoHubRuntimeRef.current).toBe(DEMO_HUB_STUB);
    const liveHub = {
      ...DEMO_HUB_STUB,
      state: { ...DEMO_HUB_STUB.state, view: 'live' as const },
    };
    syncDemoHubRuntimeRef(liveHub);
    expect(demoHubRuntimeRef.current.state.view).toBe('live');
    expect(demoHubRuntimeRef.current).toBe(liveHub);
  });

  it('resetDemoHubRuntimeRef restores stub', () => {
    syncDemoHubRuntimeRef({
      ...DEMO_HUB_STUB,
      exitLiveDemo: async () => {},
    });
    resetDemoHubRuntimeRef();
    expect(demoHubRuntimeRef.current).toBe(DEMO_HUB_STUB);
  });
});
