/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { makeVisible } from './lessons/protocols/ws-test-utils';
import {
  makeLesson,
  renderDemoHub,
} from './useDemoHub.coverage-helpers';
import {
  setupUseDemoHubCoverageBeforeEach,
  teardownUseDemoHubCoverageAfterEach,
} from './useDemoHub.coverage.testHelpers';


vi.mock('./lessons/env-manager-lesson-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lessons/env-manager-lesson-helpers')>();
  return {
    ...actual,
    cleanupGqlDemoLessonEnvironment: vi.fn(async () => {}),
  };
});

vi.mock('./lessons/gql-demo-storage-cleanup', () => ({
  purgeGqlDemoEphemeralStorage: vi.fn().mockResolvedValue({
    profilesRemoved: 0,
    runnerConfigsRemoved: 0,
    staleKeysRemoved: 0,
    freedKB: 0,
  }),
}));


describe('useDemoHub (branch coverage — hub navigation)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    setupUseDemoHubCoverageBeforeEach();
  });

  afterEach(async () => {
    await teardownUseDemoHubCoverageAfterEach();
  });

  it('closeHub runs live lesson cleanup when hub closed during live demo', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup });
    act(() => {
      result.current.openHub();
      result.current.selectLesson(lesson);
    });
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.closeHub());
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(cleanup).toHaveBeenCalled();
    expect(result.current.hubOpen).toBe(false);
  });

  it('closeHub closes graphql demo workspace when concept view has graphql lesson', async () => {
    const gqlTabMod = await import('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab');
    const closeSpy = vi.spyOn(gqlTabMod, 'closeGqlDemoWorkspaceQuiet').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-first-query',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    act(() => result.current.openHub());
    act(() => result.current.closeHub());
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(closeSpy).toHaveBeenCalledWith('gql-first-query');
    closeSpy.mockRestore();
  });

  it('goBack from domains is a no-op on view state', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('domains');
  });

  it('goToDomains resets to domain list and clears selected domain', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.selectDomain({
      id: 'protocols',
      name: 'Protocols',
      icon: '🔌',
      description: 'Protocols',
      available: true,
      lessons: [],
    }));
    act(() => result.current.goToDomains());
    expect(result.current.state.view).toBe('domains');
    expect(result.current.state.selectedDomain).toBeNull();
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('startLiveDemo returns early when lesson is desktop-only blocked on web', async () => {
    const lessonPlatform = await import('./utils/lessonPlatform');
    const blockSpy = vi.spyOn(lessonPlatform, 'isLessonDesktopOnlyBlocked').mockReturnValue(true);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ desktopOnly: true });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      await result.current.startLiveDemo();
    });
    expect(result.current.state.view).not.toBe('live');
    blockSpy.mockRestore();
  });

  it('runLiveLessonCleanup uses graphql workspace cleanup when lesson has no cleanup fn', async () => {
    const gqlTabMod = await import('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab');
    const closeSpy = vi.spyOn(gqlTabMod, 'closeGqlDemoWorkspaceQuiet').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-vars',
      category: 'graphql',
      initialTab: 'graphql-studio',
      cleanup: undefined,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(closeSpy).toHaveBeenCalledWith('gql-vars');
    closeSpy.mockRestore();
  });

  it('goBack from live runs cleanup for graphql lesson without custom cleanup', async () => {
    const gqlTabMod = await import('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab');
    const closeSpy = vi.spyOn(gqlTabMod, 'closeGqlDemoWorkspaceQuiet').mockRejectedValue(new Error('gql cleanup fail'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-sub',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] Lesson cleanup failed:', expect.any(Error));
    warnSpy.mockRestore();
    closeSpy.mockRestore();
  });

  it('confirmLessonComplete is safe when no lesson selected', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.confirmLessonComplete());
    expect(result.current.progress.completedLessons).toEqual([]);
  });

  it('buildContext selectOption no-ops when native setter missing', async () => {
    const select = document.createElement('select');
    select.className = 'no-setter-select';
    makeVisible(select);
    document.body.appendChild(select);

    const original = Object.getOwnPropertyDescriptor;
    vi.spyOn(Object, 'getOwnPropertyDescriptor').mockImplementation((proto, prop) => {
      if (proto === HTMLSelectElement.prototype && prop === 'value') {
        return { get: original(HTMLSelectElement.prototype, 'value')!.get };
      }
      return original(proto as object, prop as PropertyKey);
    });

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'SelNoSet', description: 'No setter', pauseAfter: 0,
        action: async (ctx) => { await ctx.selectOption('.no-setter-select', 'x'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    vi.restoreAllMocks();
    select.remove();
  });

  it('waitForElement returns false when aborted before element appears', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'AbortWait', description: 'Abort wait', pauseAfter: 0,
        verify: '.never-appears-abort',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('logs GQL storage hygiene summary when ephemeral keys are purged on graphql lesson start', async () => {
    const { purgeGqlDemoEphemeralStorage } = await import('./lessons/gql-demo-storage-cleanup');
    vi.mocked(purgeGqlDemoEphemeralStorage).mockResolvedValue({
      profilesRemoved: 2,
      runnerConfigsRemoved: 1,
      staleKeysRemoved: 3,
      freedKB: 12,
    });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-hygiene',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[DemoHub] GQL storage hygiene:'));
    infoSpy.mockRestore();
  });

  it('warns when GQL storage hygiene fails during graphql lesson restart', async () => {
    const { purgeGqlDemoEphemeralStorage } = await import('./lessons/gql-demo-storage-cleanup');
    vi.mocked(purgeGqlDemoEphemeralStorage).mockRejectedValue(new Error('idb unavailable'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-hygiene-fail',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      await result.current.restartDemo();
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] GQL storage hygiene failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('runLiveLessonCleanup uses custom cleanup for graphql lesson when provided', async () => {
    const cleanup = vi.fn(async () => {});
    const gqlTabMod = await import('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab');
    const closeSpy = vi.spyOn(gqlTabMod, 'closeGqlDemoWorkspaceQuiet').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-custom-cleanup',
      category: 'graphql',
      initialTab: 'graphql-studio',
      cleanup,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(cleanup).toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    closeSpy.mockRestore();
  });

  it('warns when GQL demo environment cleanup fails on graphql lesson teardown', async () => {
    const envMod = await import('./lessons/env-manager-lesson-helpers');
    vi.mocked(envMod.cleanupGqlDemoLessonEnvironment).mockRejectedValueOnce(new Error('em cleanup fail'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-em-fail',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] GQL demo environment cleanup failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('nextStep during reading phase finishes current step before advancing', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const actionFn = vi.fn();
    const lesson = makeLesson({
      steps: [
        {
          id: 's1',
          title: 'S1',
          description: 'A'.repeat(500),
          action: actionFn,
        },
        { id: 's2', title: 'S2', description: 'Step 2' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.stepPhase).toBe('reading');
    await act(async () => {
      const p = result.current.nextStep();
      await vi.advanceTimersByTimeAsync(3000);
      await p;
    });
    expect(actionFn).toHaveBeenCalled();
    expect(result.current.state.stepIndex).toBe(1);
  });

  it('pauseAutoPlay clears scheduled auto-advance timer when toggled off', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1' },
        { id: 's2', title: 'S2', description: 'Step 2' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
    act(() => result.current.toggleAutoPlay());
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('runLiveLessonCleanup logs when non-graphql lesson cleanup rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cleanup = vi.fn().mockRejectedValue(new Error('ws cleanup fail'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      domainId: 'protocols',
      cleanup,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(cleanup).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] Lesson cleanup failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('pauseAutoPlay clears pending auto-play timer when toggled off during reading', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'A'.repeat(500) },
        { id: 's2', title: 'S2', description: 'Next' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.stepPhase).toBe('reading');

    act(() => {
      result.current.toggleAutoPlay();
      result.current.toggleAutoPlay();
    });

    expect(result.current.state.isPlaying).toBe(false);
  });

  it('closeHub expands workflow sidebar for live workflow designer lesson', async () => {
    const adapterMod = await import('./adapters');
    const expandSpy = vi.spyOn(adapterMod, 'expandAppSidebar').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'wf-designer',
      initialTab: 'workflow',
      category: 'workflow',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.closeHub());
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(expandSpy).toHaveBeenCalled();
    expandSpy.mockRestore();
  });
});
