/**
 * Shared helpers for useDemoHub branch-coverage tests.
 * Tracks the active hook instance and tears down live-demo state between tests.
 */
import { act, cleanup, renderHook, type RenderHookResult } from '@testing-library/react';
import { vi } from 'vitest';
import { useDemoHub } from './useDemoHub';
import type { DemoLesson } from './types';

export function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'lesson-coverage',
    domainId: 'test-domain',
    name: 'Coverage Lesson',
    description: 'Coverage tests',
    estimatedMinutes: 3,
    concept: { title: 'Concept', body: 'Body' },
    steps: [
      { id: 's1', title: 'Step 1', description: 'Step one' },
      { id: 's2', title: 'Step 2', description: 'Step two' },
    ],
    ...overrides,
  };
}

type DemoHubHook = ReturnType<typeof useDemoHub>;

let activeHub: RenderHookResult<DemoHubHook, unknown> | null = null;

/** Render useDemoHub and register for automatic teardown in afterEach. */
export function renderDemoHub(navigateToTab: (tab: string) => void) {
  if (activeHub) {
    activeHub.unmount();
    activeHub = null;
  }
  activeHub = renderHook(() => useDemoHub({ navigateToTab }));
  return activeHub;
}

/** Exit live demo, flush timers, unmount, and reset RTL between tests. */
export async function teardownActiveDemoHub(): Promise<void> {
  if (activeHub) {
    const { result, unmount } = activeHub;
    if (result.current) {
      const hub = result.current;
      if (hub.state.isPlaying) {
        act(() => {
          hub.toggleAutoPlay();
        });
      }
      if (hub.state.view === 'live') {
        await act(async () => {
          await hub.exitLiveDemo();
        });
      }
    }
    unmount();
    activeHub = null;
  }
  cleanup();
  vi.clearAllTimers();
  vi.runOnlyPendingTimers();
}
