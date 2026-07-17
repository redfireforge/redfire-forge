/**
 * @vitest-environment jsdom
 * Isolated module-mock tests for live-demo resume (must not share a file with
 * useDemoHub.coverage-helpers static imports — vi.resetModules() is unreliable).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetLiveDemoResumeConsumeForTests } from './demoLiveSession';

vi.mock('./lessons/env-manager-lesson-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lessons/env-manager-lesson-helpers')>();
  return { ...actual, cleanupGqlDemoLessonEnvironment: vi.fn(async () => {}) };
});

vi.mock('./lessons/gql-demo-storage-cleanup', () => ({
  purgeGqlDemoEphemeralStorage: vi.fn().mockResolvedValue({
    profilesRemoved: 0,
    runnerConfigsRemoved: 0,
    staleKeysRemoved: 0,
    freedKB: 0,
  }),
}));

vi.mock('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-resume'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  closeGqlDemoWorkspaceQuiet: vi.fn(async () => {}),
}));

describe('useDemoHub — consumeLiveDemoResumeOnce mock', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
    sessionStorage.clear();
    resetLiveDemoResumeConsumeForTests();
  });

  afterEach(async () => {
    vi.doUnmock('./demoLiveSession');
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it('skips resume when consumeLiveDemoResumeOnce returns false', async () => {
    vi.doMock('./demoLiveSession', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./demoLiveSession')>();
      return {
        ...actual,
        consumeLiveDemoResumeOnce: vi.fn(() => false),
        readDemoLiveSession: vi.fn(() => null),
      };
    });
    vi.resetModules();
    const demoSession = await import('./demoLiveSession');
    const { renderHook, act } = await import('@testing-library/react');
    const { useDemoHub } = await import('./useDemoHub');
    const { result, unmount } = renderHook(() => useDemoHub({ navigateToTab }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(demoSession.consumeLiveDemoResumeOnce).toHaveBeenCalled();
    expect(result.current.state.view).not.toBe('live');
    unmount();
  });

  it('resumeInterruptedLiveDemo runs when consume returns true and session is valid', async () => {
    vi.doMock('./demoLiveSession', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./demoLiveSession')>();
      return {
        ...actual,
        consumeLiveDemoResumeOnce: vi.fn(() => true),
        readDemoLiveSession: vi.fn(() => ({
          lessonId: 'gql-first-query',
          stepIndex: 0,
          isPlaying: true,
          speed: 1 as const,
          savedAt: Date.now(),
        })),
      };
    });
    vi.resetModules();
    const { renderDemoHub, teardownActiveDemoHub } = await import('./useDemoHub.coverage-helpers');
    const { act } = await import('@testing-library/react');
    const { result } = renderDemoHub(navigateToTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current.state.view).toBe('live');
    expect(result.current.state.selectedLesson?.id).toBe('gql-first-query');
    await teardownActiveDemoHub();
  });

  it('resumeInterruptedLiveDemo uses defaults when session omits stepIndex and isPlaying', async () => {
    vi.doMock('./demoLiveSession', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./demoLiveSession')>();
      return {
        ...actual,
        consumeLiveDemoResumeOnce: vi.fn(() => true),
        readDemoLiveSession: vi.fn(() => ({
          lessonId: 'gql-first-query',
          speed: 1 as const,
          savedAt: Date.now(),
        })),
      };
    });
    vi.resetModules();
    const { renderDemoHub, teardownActiveDemoHub } = await import('./useDemoHub.coverage-helpers');
    const { act } = await import('@testing-library/react');
    const { result } = renderDemoHub(navigateToTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current.state.view).toBe('live');
    expect(result.current.state.isPlaying).toBe(false);
    await teardownActiveDemoHub();
  });

  it('exitLiveDemo resolves lesson from persisted session on fresh module load', async () => {
    const sessionPayload = {
      lessonId: 'gql-first-query',
      stepIndex: 0,
      isPlaying: false,
      speed: 1 as const,
      savedAt: Date.now(),
    };
    vi.doMock('./demoLiveSession', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./demoLiveSession')>();
      return {
        ...actual,
        consumeLiveDemoResumeOnce: vi.fn(() => false),
        readDemoLiveSession: vi.fn()
          .mockReturnValueOnce(null)
          .mockReturnValue(sessionPayload),
      };
    });
    vi.resetModules();
    const helpersMod = await import('./useDemoHubHelpers');
    const adaptersMod = await import('./adapters');
    vi.spyOn(adaptersMod, 'loadDemoSession').mockResolvedValue(null);
    vi.spyOn(adaptersMod, 'purgeOrphanDemoTabs').mockResolvedValue(undefined);
    const teardownSpy = vi.spyOn(helpersMod, 'runGqlStudioLessonTeardown').mockResolvedValue(undefined);
    const { renderHook, act } = await import('@testing-library/react');
    const { useDemoHub } = await import('./useDemoHub');
    const { result, unmount } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.state.selectedLesson).toBeNull();
    await act(async () => {
      await result.current.exitLiveDemo();
    });
    expect(teardownSpy).toHaveBeenCalled();
    unmount();
  });
});
