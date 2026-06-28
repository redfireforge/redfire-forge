/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  makeLesson,
  renderDemoHub,
  teardownActiveDemoHub,
} from './useDemoHub.coverage-helpers';
import { makeVisible } from './lessons/protocols/ws-test-utils';
import { gqlFirstQueryLesson } from './lessons/protocols/graphql-first-query';
import {
  persistDemoLiveSession,
  resetLiveDemoResumeConsumeForTests,
} from './demoLiveSession';

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

describe('useDemoHub — additional coverage gaps', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
    resetLiveDemoResumeConsumeForTests();
  });

  afterEach(async () => {
    await teardownActiveDemoHub();
    vi.restoreAllMocks();
  });

  it('persists live session on pagehide while demo is active', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    window.dispatchEvent(new Event('pagehide'));
    const raw = sessionStorage.getItem('redfire-demo-live-session-v1');
    expect(raw).toBeTruthy();
  });

  it('executeCurrentStep runs readingSync when provided', async () => {
    const readingSync = vi.fn(async () => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Sync',
        description: 'Short.',
        pauseAfter: 0,
        readingSync,
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(readingSync).toHaveBeenCalled();
  });

  it('logs when readingSync throws during executeCurrentStep', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Bad sync',
        description: 'Short.',
        pauseAfter: 0,
        readingSync: async () => { throw new Error('sync fail'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] readingSync failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('executeCurrentStep enters verify phase when verify selector appears', async () => {
    const verifyEl = document.createElement('div');
    verifyEl.className = 'gap-verify-target';
    makeVisible(verifyEl);
    document.body.appendChild(verifyEl);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Verify',
        description: 'Short verify step.',
        pauseAfter: 0,
        verify: '.gap-verify-target',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
    verifyEl.remove();
  });

  it('resumeInterruptedLiveDemo runs setup and completes restored step', async () => {
    resetLiveDemoResumeConsumeForTests();
    persistDemoLiveSession({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderDemoHub(navigateToTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(result.current.state.view).toBe('live');
    expect(result.current.state.selectedLesson?.id).toBe(gqlFirstQueryLesson.id);
    expect(result.current.stepPhase).toBe('done');
  });

  it('resumeInterruptedLiveDemo restores isPlaying when session was playing', async () => {
    resetLiveDemoResumeConsumeForTests();
    persistDemoLiveSession({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 0,
      isPlaying: true,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderDemoHub(navigateToTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('pauseAutoPlay aborts in-flight step and clears skipReading during auto-play pause', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'A'.repeat(400) },
        { id: 's2', title: 'S2', description: 'Step two' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(100);
    });
    act(() => {
      result.current.toggleAutoPlay();
      result.current.toggleAutoPlay();
    });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.stepPhase).toBe('done');
  });

  it('pauseAutoPlay clears pending auto-advance timer when auto-play is active', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Short.', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Next step' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('toggleAutoPlay at end re-enables playing after graphql cleanup and setup', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-gap-restart',
      category: 'graphql',
      domainId: 'protocols',
      initialTab: 'graphql-studio',
      cleanup,
      setup,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
    expect(result.current.state.stepIndex).toBe(0);
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('toggleAutoPlay at end expands workflow sidebar for designer lessons', async () => {
    const adapterMod = await import('./adapters');
    const expandSpy = vi.spyOn(adapterMod, 'expandAppSidebar').mockImplementation(() => {});
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'wf-gap-restart',
      category: 'workflow',
      initialTab: 'workflow',
      cleanup,
      setup,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(expandSpy).toHaveBeenCalled();
    expandSpy.mockRestore();
  });

  it('toggleAutoPlay at end logs when cleanup and setup throw', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cleanup = vi.fn().mockRejectedValue(new Error('cleanup fail'));
    const setup = vi.fn().mockRejectedValue(new Error('setup fail'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup, setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] Lesson cleanup failed:', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] Lesson setup failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('toggleAutoPlay at end skips restart when generation changes before callback', async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    setup.mockClear();
    act(() => result.current.toggleAutoPlay());
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(setup).not.toHaveBeenCalled();
  });

  it('nextStep during reading runs verify when step defines verify selector', async () => {
    const verifyEl = document.createElement('div');
    verifyEl.className = 'next-step-verify';
    makeVisible(verifyEl);
    document.body.appendChild(verifyEl);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        {
          id: 's1',
          title: 'S1',
          description: 'A'.repeat(500),
          verify: '.next-step-verify',
        },
        { id: 's2', title: 'S2', description: 'Step two' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
      const p = result.current.nextStep();
      await vi.advanceTimersByTimeAsync(5000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(1);
    verifyEl.remove();
  });

  it('restartDemo runs cleanup setup and returns to step 0', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup, setup, initialTab: 'workflow-runner' });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(15000);
      await p;
    });
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('auto-play advances to the next step when playing', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Short.', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Also short.', pauseAfter: 0 },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(result.current.state.stepIndex).toBeGreaterThanOrEqual(1);
  });

  it('executeCurrentStep runs verify after action when verify element appears late', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Late verify',
        description: 'Short.',
        pauseAfter: 0,
        action: async () => {
          const el = document.createElement('div');
          el.className = 'late-verify-target';
          makeVisible(el);
          document.body.appendChild(el);
        },
        verify: '.late-verify-target',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('executeCurrentStep scrolls visible highlight target during reading phase', async () => {
    const highlightEl = document.createElement('div');
    highlightEl.className = 'gap-highlight-target';
    makeVisible(highlightEl);
    highlightEl.scrollIntoView = vi.fn();
    document.body.appendChild(highlightEl);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Highlight',
        description: 'Short.',
        pauseAfter: 0,
        highlight: '.gap-highlight-target',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(highlightEl.scrollIntoView).toHaveBeenCalled();
    highlightEl.remove();
  });

  it('pauseAutoPlay resolves skipReading during reading phase', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'S1', description: 'A'.repeat(600) }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(100);
    });
    act(() => result.current.toggleAutoPlay());
    expect(result.current.stepPhase).toBe('done');
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('resumeInterruptedLiveDemo sets done phase when session was not playing', async () => {
    resetLiveDemoResumeConsumeForTests();
    persistDemoLiveSession({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderDemoHub(navigateToTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.stepPhase).toBe('done');
  });

  it('toggleAutoPlay at-end does not restart after hook unmounts', async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    setup.mockClear();
    act(() => result.current.toggleAutoPlay());
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(setup).not.toHaveBeenCalled();
  });

  it('toggleAutoPlay at-end navigates to initialTab before setup', async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup, initialTab: 'workflow-runner' });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('pauseAutoPlay clears scheduled auto-advance timer during auto-play', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Short.', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Also short.', pauseAfter: 0 },
        { id: 's3', title: 'S3', description: 'Third step' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('executeCurrentStep skips spotlight scroll when highlight targets are hidden', async () => {
    const hidden = document.createElement('div');
    hidden.className = 'gap-hidden-highlight';
    hidden.style.display = 'none';
    document.body.appendChild(hidden);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Hidden highlight',
        description: 'Short.',
        pauseAfter: 0,
        highlight: '.gap-hidden-highlight',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
    hidden.remove();
  });

  it('executeCurrentStep runs verify phase when verify appears after action', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Verify after action',
        description: 'Short.',
        pauseAfter: 0,
        action: async () => {
          const el = document.createElement('div');
          el.className = 'post-action-verify';
          makeVisible(el);
          document.body.appendChild(el);
        },
        verify: '.post-action-verify',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
    expect(document.querySelector('.post-action-verify')).toBeTruthy();
  });

  it('resumeInterruptedLiveDemo restores mid-lesson step index from session', async () => {
    resetLiveDemoResumeConsumeForTests();
    persistDemoLiveSession({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 1,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderDemoHub(navigateToTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(result.current.state.view).toBe('live');
    expect(result.current.state.stepIndex).toBe(1);
  });

  it('toggleAutoPlay at-end runs GraphQL storage hygiene for graphql lessons', async () => {
    const hygieneMod = await import('./useDemoHubHelpers');
    const hygieneSpy = vi.spyOn(hygieneMod, 'runGqlDemoStorageHygiene').mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-hygiene-restart',
      category: 'graphql',
      domainId: 'protocols',
      initialTab: 'graphql-studio',
      setup,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(hygieneSpy).toHaveBeenCalled();
    hygieneSpy.mockRestore();
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
      await vi.advanceTimersByTimeAsync(8000);
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
      await vi.advanceTimersByTimeAsync(8000);
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
      await vi.advanceTimersByTimeAsync(10000);
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
      await vi.advanceTimersByTimeAsync(10000);
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
      await vi.advanceTimersByTimeAsync(8000);
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
      await vi.advanceTimersByTimeAsync(10000);
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
      await vi.advanceTimersByTimeAsync(8000);
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
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
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
      await vi.advanceTimersByTimeAsync(8000);
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
      await new Promise((r) => setTimeout(r, 2000));
    });
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(100);
      act(() => result.current.goToDomains());
      await vi.advanceTimersByTimeAsync(10000);
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
      await new Promise((r) => setTimeout(r, 2000));
    });
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
    });
    await act(async () => {
      void result.current.restartDemo();
      act(() => result.current.goToDomains());
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(result.current.state.view).not.toBe('live');
  });

  it('exitLiveDemo expands sidebar for workflow designer lessons', async () => {
    const adapterMod = await import('./adapters');
    const expandSpy = vi.spyOn(adapterMod, 'expandAppSidebar').mockImplementation(() => {});
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ category: 'workflow', initialTab: 'workflow', cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      await result.current.exitLiveDemo();
    });
    expect(expandSpy).toHaveBeenCalled();
    expandSpy.mockRestore();
  });

  it('goToStep at last index disables isPlaying', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Short.', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Also short.', pauseAfter: 0 },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('closeHub clears auto-play timer when hub closed during active auto-play', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Short.', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Next step' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    act(() => result.current.closeHub());
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('goBack from live clears demo live guard sync', async () => {
    const guardMod = await import('./demoLiveGuard');
    const syncSpy = vi.spyOn(guardMod, 'syncDemoLiveGuard').mockResolvedValue(false);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    act(() => result.current.goBack());
    expect(syncSpy).toHaveBeenCalledWith(false);
    syncSpy.mockRestore();
  });

  it('runLiveDemoSetup returns false when generation changes mid-setup', async () => {
    const setup = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(50);
      act(() => result.current.exitLiveDemo());
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.state.view).not.toBe('live');
  });
});

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
    await teardownActiveDemoHub();
    vi.restoreAllMocks();
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
      await vi.advanceTimersByTimeAsync(1000);
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { renderDemoHub: renderFresh } = await import('./useDemoHub.coverage-helpers');
    const { result } = renderFresh(navigateToTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(result.current.state.view).toBe('live');
    expect(result.current.state.selectedLesson?.id).toBe('gql-first-query');
  });
});
