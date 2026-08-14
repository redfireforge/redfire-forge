/**
 * Shared helpers for useDemoHub branch-coverage tests.
 * Tracks the active hook instance and tears down live-demo state between tests.
 */
import { act, cleanup, renderHook, type RenderHookResult } from '@testing-library/react';
import { vi } from 'vitest';
import { useDemoHub } from './useDemoHub';
import type { DemoLesson, StepPhase } from './types';

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

/**
 * Advance fake timers until the pipeline reaches `phase`.
 *
 * The Preparing phase length depends on lesson setup (isolated tab session, storage
 * hygiene, preAction waits that time out under jsdom), so a fixed advance silently
 * lands tests in the wrong phase whenever a lesson gains a step. Polling keeps the
 * assertion about the phase, not about how long it happened to take.
 */
export async function advanceUntil(
  predicate: () => boolean,
  { stepMs = 500, maxMs = 150_000 }: { stepMs?: number; maxMs?: number } = {},
): Promise<boolean> {
  for (let elapsed = 0; elapsed < maxMs; elapsed += stepMs) {
    if (predicate()) return true;
    await act(async () => { await vi.advanceTimersByTimeAsync(stepMs); });
  }
  return predicate();
}

/** Advance fake timers until the step pipeline reaches `phase`. */
export async function advanceToPhase(
  result: { current: DemoHubHook },
  phase: StepPhase,
  opts?: { stepMs?: number; maxMs?: number },
): Promise<boolean> {
  return advanceUntil(() => result.current.stepPhase === phase, opts);
}

/**
 * Advance until a restored session has finished replaying its step.
 *
 * A hook mounted on a persisted session already reports `view: 'live'` and phase
 * `done` before the resume effect runs, so waiting on that state alone returns
 * immediately. Wait for the pipeline to pick the step up first, then for it to settle.
 */
export async function advanceToResumedPhase(
  result: { current: DemoHubHook },
  phase: StepPhase,
  opts?: { stepMs?: number; maxMs?: number },
): Promise<boolean> {
  await advanceUntil(() => result.current.stepPhase !== phase, opts);
  return advanceToPhase(result, phase, opts);
}

/**
 * Run `fn` with a registered lesson reduced to one inert step.
 *
 * Resume tests need a lesson the registry can find by id, but replaying that
 * lesson's real steps under jsdom means every DOM wait runs to its timeout — the
 * pipeline can sit in Preparing for minutes and leaks flags into the next test.
 * Swapping the content keeps the assertions on resume itself.
 */
export async function withStubbedLessonBody(
  lesson: DemoLesson,
  fn: () => Promise<void>,
): Promise<void> {
  const original = {
    steps: lesson.steps,
    setup: lesson.setup,
    cleanup: lesson.cleanup,
    prepareBeforeNavigate: lesson.prepareBeforeNavigate,
  };
  Object.assign(lesson, {
    // Two steps: resuming onto the last step immediately stops auto-play, which
    // would clear the `isPlaying` restore the resume path just performed.
    // The long reading pause keeps auto-play parked on step 2 so the restored
    // `isPlaying` stays observable instead of flipping back within one timer advance.
    steps: [
      { id: 'stub-step-1', title: 'Stub 1', description: 'Stub step for resume coverage.', pauseAfter: 60_000 },
      { id: 'stub-step-2', title: 'Stub 2', description: 'Stub step for resume coverage.', pauseAfter: 60_000 },
    ],
    setup: undefined,
    cleanup: undefined,
    prepareBeforeNavigate: undefined,
  });
  try {
    await fn();
  } finally {
    Object.assign(lesson, original);
  }
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
