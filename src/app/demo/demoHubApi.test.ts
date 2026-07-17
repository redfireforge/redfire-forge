import { describe, expect, it } from 'vitest';
import { DEMO_HUB_STUB } from './demoHubApi';

describe('demoHubApi stub', () => {
  it('exposes default neutral state', () => {
    expect(DEMO_HUB_STUB.state.view).toBe('domains');
    expect(DEMO_HUB_STUB.state.selectedLesson).toBeNull();
    expect(DEMO_HUB_STUB.state.stepIndex).toBe(0);
    expect(DEMO_HUB_STUB.state.isPlaying).toBe(false);
    expect(DEMO_HUB_STUB.state.speed).toBe(1);
    expect(DEMO_HUB_STUB.stepPhase).toBe('idle');
  });

  it('executes no-op handlers safely', async () => {
    await expect(DEMO_HUB_STUB.exitLiveDemo()).resolves.toBeUndefined();
    expect(() => DEMO_HUB_STUB.nextStep()).not.toThrow();
    expect(() => DEMO_HUB_STUB.toggleAutoPlay()).not.toThrow();
    expect(() => DEMO_HUB_STUB.skipReading()).not.toThrow();
    expect(() => DEMO_HUB_STUB.restartDemo()).not.toThrow();
    expect(() => DEMO_HUB_STUB.confirmLessonComplete()).not.toThrow();
  });
});
