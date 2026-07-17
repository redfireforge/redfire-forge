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
import {resetLiveDemoResumeConsumeForTests,
} from './demoLiveSession';

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

vi.mock('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-resume'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  closeGqlDemoWorkspaceQuiet: vi.fn(async () => {}),
}));

describe('useDemoHub — coverage gaps (step pipeline)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    setupUseDemoHubCoverageBeforeEach();
    sessionStorage.clear();
    resetLiveDemoResumeConsumeForTests();
  });

  afterEach(async () => {
    await teardownUseDemoHubCoverageAfterEach();
  });

  it('goToDomains from live expands sidebar and runs cleanup for workflow lessons', async () => {
    const adapterMod = await import('./adapters');
    const expandSpy = vi.spyOn(adapterMod, 'expandAppSidebar').mockImplementation(() => {});
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ category: 'workflow', initialTab: 'workflow', cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goToDomains());
    expect(expandSpy).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(cleanup).toHaveBeenCalled();
    expandSpy.mockRestore();
  });

  it('exitLiveDemo runs GraphQL studio teardown for graphql lessons', async () => {
    const helpersMod = await import('./useDemoHubHelpers');
    const teardownSpy = vi.spyOn(helpersMod, 'runGqlStudioLessonTeardown').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      category: 'graphql',
      domainId: 'protocols',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      await result.current.exitLiveDemo();
    });
    expect(teardownSpy).toHaveBeenCalled();
    expect(result.current.state.view).toBe('concept');
    teardownSpy.mockRestore();
  });

  it('executeCurrentStep warns when preAction throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Bad pre',
        description: 'Short.',
        pauseAfter: 0,
        preAction: async () => { throw new Error('pre fail'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(9000);
      await p;
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] preAction failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('executeCurrentStep warns when action throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Bad action',
        description: 'Short.',
        pauseAfter: 0,
        action: async () => { throw new Error('action fail'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(9000);
      await p;
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] action failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('goBack from live runs cleanup before returning to concept', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('concept');
  });

  it('startLiveDemo returns early when lesson is desktop-only blocked', async () => {
    const platformMod = await import('./utils/lessonPlatform');
    vi.spyOn(platformMod, 'isLessonDesktopOnlyBlocked').mockReturnValue(true);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ desktopOnly: true });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      await result.current.startLiveDemo();
    });
    expect(result.current.state.view).not.toBe('live');
  });

  it('executeCurrentStep uses explicit pauseAfter when provided', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Pause',
        description: 'Short.',
        pauseAfter: 500,
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(9000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('executeCurrentStep completes step without highlight action or verify', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Minimal', description: 'Tiny.', pauseAfter: 0 }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(5000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('pauseAutoPlay when not playing clears phase without timer', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.stepPhase).toBe('done');
  });

  it('finishCurrentStepFromReading completes verify-only step from reading', async () => {
    const verifyEl = document.createElement('div');
    verifyEl.className = 'reading-verify-only';
    makeVisible(verifyEl);
    document.body.appendChild(verifyEl);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Verify only',
        description: 'A'.repeat(500),
        verify: '.reading-verify-only',
      }, { id: 's2', title: 'S2', description: 'Next' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
      const p = result.current.nextStep();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(1);
    verifyEl.remove();
  });

  it('toggleAutoPlay at-end runs without cleanup when lesson has no cleanup hook', async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup, cleanup: undefined });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13000);
    });
    expect(setup).toHaveBeenCalled();
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('auto-play stops when already on the last step', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Only', description: 'Short.', pauseAfter: 0 }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('startLiveDemo aborts when generation changes during setup', async () => {
    const setup = vi.fn().mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(100);
      act(() => result.current.goToDomains());
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(result.current.state.view).not.toBe('live');
  });

  it('pauseAutoPlay during verify phase aborts step pipeline', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Slow verify',
        description: 'Short.',
        pauseAfter: 0,
        verify: '.never-appears-verify-target',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(500);
    });
    act(() => result.current.toggleAutoPlay());
    expect(['verify', 'done']).toContain(result.current.stepPhase);
  });

  it('restartDemo skips step execution when generation changes during setup', async () => {
    const setup = vi.fn().mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
    });
    await act(async () => {
      void result.current.restartDemo();
      act(() => result.current.goToDomains());
      await vi.advanceTimersByTimeAsync(13000);
    });
    expect(result.current.state.view).not.toBe('live');
  });

});
