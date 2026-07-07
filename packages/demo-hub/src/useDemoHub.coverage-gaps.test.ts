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
      await vi.advanceTimersByTimeAsync(7000);
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
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(13000);
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
      await vi.advanceTimersByTimeAsync(13000);
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
      await vi.advanceTimersByTimeAsync(7000);
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
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    setup.mockClear();
    act(() => result.current.toggleAutoPlay());
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13000);
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
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(13000);
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
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(13000);
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
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    setup.mockClear();
    act(() => result.current.toggleAutoPlay());
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13000);
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
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(9000);
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
      await vi.advanceTimersByTimeAsync(26000);
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

  it('exitLiveDemo expands sidebar for workflow designer lessons', async () => {
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
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
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
      await vi.advanceTimersByTimeAsync(7000);
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
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    expect(syncSpy).toHaveBeenCalledWith(false);
    syncSpy.mockRestore();
  });

  it('runLiveDemoSetup returns false when generation changes mid-setup', async () => {
    const setup = vi.fn().mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(500);
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

  it('goBack from lessons returns to domains', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.openHub());
    act(() => result.current.selectDomain({
      id: 'protocols',
      name: 'Protocols',
      icon: 'P',
      description: 'Protocol demos',
      lessons: [],
      available: true,
    }));
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('domains');
  });

  it('goBack from concept returns to lessons', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.selectLesson(makeLesson()));
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('lessons');
  });

  it('selectDomain ignores unavailable domains', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.openHub());
    act(() => result.current.selectDomain({
      id: 'locked',
      name: 'Locked',
      icon: 'L',
      description: 'Unavailable',
      lessons: [],
      available: false,
    }));
    expect(result.current.state.view).toBe('domains');
  });

  it('closeHub runs graphql teardown when lesson is on concept view', async () => {
    const helpersMod = await import('./useDemoHubHelpers');
    const teardownSpy = vi.spyOn(helpersMod, 'runGqlStudioLessonTeardown').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      category: 'graphql',
      domainId: 'protocols',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    act(() => result.current.closeHub());
    expect(teardownSpy).toHaveBeenCalled();
    teardownSpy.mockRestore();
  });

  it('exitLiveDemo closes graphql demo workspace when loadDemoSession returns session', async () => {
    const adaptersMod = await import('./adapters');
    const helpersMod = await import('./useDemoHubHelpers');
    vi.spyOn(adaptersMod, 'loadDemoSession').mockResolvedValue({ lessonId: 'gql-first-query' } as never);
    const closeSpy = vi.spyOn(helpersMod, 'closeGraphqlDemoWorkspaceQuiet').mockResolvedValue(undefined);
    vi.spyOn(adaptersMod, 'purgeOrphanDemoTabs').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.selectLesson(gqlFirstQueryLesson));
    // gqlFirstQueryLesson.steps[0] has pauseAfter:true → calcReadingTime returns ~34s.
    // Advance 40s of fake time so the reading pause fires within advanceTimersByTimeAsync.
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(35000);
      await p;
    });
    await act(async () => {
      const p = result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(2000);
      await p;
    });
    expect(closeSpy).toHaveBeenCalledWith('gql-first-query');
    closeSpy.mockRestore();
  });

  it('exitLiveDemo warns when gql workspace cleanup throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adaptersMod = await import('./adapters');
    vi.spyOn(adaptersMod, 'loadDemoSession').mockRejectedValue(new Error('load fail'));
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.selectLesson(makeLesson()));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      await result.current.exitLiveDemo();
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] GQL workspace force cleanup failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('goToStep on gql-auth-headers profile step syncs gql modal lock intro flags', async () => {
    const lockMod = await import('./adapters/gqlModalLockBridge');
    const syncSpy = vi.spyOn(lockMod, 'syncGqlModalLock').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const steps = Array.from({ length: 12 }, (_, i) => ({
      id: `step-${i}`,
      title: `Step ${i}`,
      description: 'Short step.',
      pauseAfter: 0,
    }));
    const lesson = makeLesson({
      id: 'gql-auth-headers',
      category: 'graphql',
      domainId: 'protocols',
      initialTab: 'graphql-studio',
      steps,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    syncSpy.mockClear();
    await act(async () => {
      const p = result.current.goToStep(11);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(syncSpy).toHaveBeenCalled();
    syncSpy.mockRestore();
  });

  it('restartDemo expands sidebar for workflow designer lessons', async () => {
    const adapterMod = await import('./adapters');
    const expandSpy = vi.spyOn(adapterMod, 'expandAppSidebar').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ category: 'workflow', initialTab: 'workflow' });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(13000);
      await p;
    });
    expect(expandSpy).toHaveBeenCalled();
    expandSpy.mockRestore();
  });

  it('executeCurrentStep aborts after preAction when pipeline is cancelled', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Slow pre',
        description: 'Short.',
        pauseAfter: 0,
        preAction: async () => {
          await vi.advanceTimersByTimeAsync(5000);
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(100);
      act(() => result.current.goToDomains());
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(result.current.state.view).not.toBe('live');
  });

  it('finishCurrentStepFromReading aborts when goToStep races nextStep', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        {
          id: 's1',
          title: 'S1',
          description: 'A'.repeat(500),
          action: async () => {
            await vi.advanceTimersByTimeAsync(5000);
          },
        },
        { id: 's2', title: 'S2', description: 'Next' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
      void result.current.nextStep();
      await vi.advanceTimersByTimeAsync(100);
      void result.current.goToStep(0);
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('goBack from live runs cleanup when auto-play timer is inactive', async () => {
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
    expect(cleanup).toHaveBeenCalled();
    expect(result.current.state.view).toBe('concept');
  });

  it('goBack from live warns when lesson cleanup rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cleanup = vi.fn().mockRejectedValue(new Error('cleanup fail'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] Lesson cleanup failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('confirmLessonComplete no-ops when no lesson is selected', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.confirmLessonComplete());
    expect(result.current.progress).toBeDefined();
  });

  it('startLiveDemo returns early when no lesson is selected', async () => {
    const { result } = renderDemoHub(navigateToTab);
    await act(async () => {
      await result.current.startLiveDemo();
    });
    expect(result.current.state.view).not.toBe('live');
  });

  it('auto-play effect clears timer on unmount during active auto-play', async () => {
    const { result, unmount } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Short.', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Next step' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
  });

  it('closeHub runs live lesson cleanup when hub closed during live demo', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.closeHub());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(cleanup).toHaveBeenCalled();
  });

  it('runLiveDemoSetup warns when lesson setup throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setup = vi.fn().mockRejectedValue(new Error('setup fail'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] Lesson setup failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('goToStep on gql-auth-headers env step syncs env modal lock intro', async () => {
    const lockMod = await import('./adapters/gqlModalLockBridge');
    const syncSpy = vi.spyOn(lockMod, 'syncGqlModalLock').mockImplementation(() => {});
    const steps = Array.from({ length: 12 }, (_, i) => ({
      id: `step-${i}`,
      title: `Step ${i}`,
      description: 'Short step.',
      pauseAfter: 0,
    }));
    const lesson = makeLesson({
      id: 'gql-auth-headers',
      category: 'graphql',
      domainId: 'protocols',
      initialTab: 'graphql-studio',
      steps,
    });
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    syncSpy.mockClear();
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(syncSpy).toHaveBeenCalled();
    syncSpy.mockRestore();
  });

  it('executeCurrentStep exits early when aborted after preAction settle', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Pre',
        description: 'Short.',
        pauseAfter: 0,
        preAction: async () => {
          await vi.advanceTimersByTimeAsync(2000);
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(2100);
      await result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.state.view).toBe('concept');
  });

  it('executeCurrentStep exits early when aborted after action settle', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Act',
        description: 'Short.',
        pauseAfter: 0,
        action: async () => {
          await vi.advanceTimersByTimeAsync(100);
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(500);
      await result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.state.view).toBe('concept');
  });

  it('executeCurrentStep exits early when aborted during verify', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Verify',
        description: 'Short.',
        pauseAfter: 0,
        verify: '.never-appears-gap-target',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(500);
      await result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.state.view).toBe('concept');
  });

  it('finishCurrentStepFromReading handles verify-only steps during reading skip', async () => {
    const verifyEl = document.createElement('div');
    verifyEl.className = 'verify-only-reading-skip';
    makeVisible(verifyEl);
    document.body.appendChild(verifyEl);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        {
          id: 's1',
          title: 'Verify only',
          description: 'A'.repeat(500),
          verify: '.verify-only-reading-skip',
        },
        { id: 's2', title: 'S2', description: 'Next' },
      ],
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

  it('finishCurrentStepFromReading aborts when exitLiveDemo races verify', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        {
          id: 's1',
          title: 'Slow verify',
          description: 'A'.repeat(500),
          verify: '.never-appears-finish-verify',
        },
        { id: 's2', title: 'S2', description: 'Next' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
      void result.current.nextStep();
      await vi.advanceTimersByTimeAsync(300);
      await result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.state.view).toBe('concept');
  });

  it('exitLiveDemo resolves lesson from persisted session when selectedLesson is cleared', async () => {
    const sessionMod = await import('./demoLiveSession');
    const helpersMod = await import('./useDemoHubHelpers');
    const teardownSpy = vi.spyOn(helpersMod, 'runGqlStudioLessonTeardown').mockResolvedValue(undefined);
    const readSpy = vi.spyOn(sessionMod, 'readDemoLiveSession').mockReturnValue({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.selectLesson(gqlFirstQueryLesson));
    // gqlFirstQueryLesson.steps[0] has pauseAfter:true → calcReadingTime returns ~34s.
    // Advance 40s of fake time so the reading pause fires within advanceTimersByTimeAsync.
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(35000);
      await p;
    });
    act(() => {
      result.current.selectDomain({
        id: gqlFirstQueryLesson.domainId,
        name: 'Protocols',
        icon: 'P',
        description: 'Protocol demos',
        lessons: [],
        available: true,
      });
    });
    await act(async () => {
      const p = result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(2000);
      await p;
    });
    expect(teardownSpy).toHaveBeenCalled();
    teardownSpy.mockRestore();
    readSpy.mockRestore();
  });

  it('toggleAutoPlay pause path invokes pauseAutoPlay when stopping playback', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Short.', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Next' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.stepPhase).toBe('done');
  });

  it('goBack from live clears pending auto-play timer', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Short.', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Next' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('concept');
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('exitLiveDemo falls back to persisted session when no lesson is selected', async () => {
    const sessionMod = await import('./demoLiveSession');
    const helpersMod = await import('./useDemoHubHelpers');
    const adaptersMod = await import('./adapters');
    vi.spyOn(sessionMod, 'readDemoLiveSession').mockReturnValue({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    vi.spyOn(adaptersMod, 'loadDemoSession').mockResolvedValue(null);
    vi.spyOn(adaptersMod, 'purgeOrphanDemoTabs').mockResolvedValue(undefined);
    const teardownSpy = vi.spyOn(helpersMod, 'runGqlStudioLessonTeardown').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    await act(async () => {
      await result.current.exitLiveDemo();
    });
    expect(teardownSpy).toHaveBeenCalled();
    teardownSpy.mockRestore();
  });

  it('executeCurrentStep exits early when aborted during verify absorb', async () => {
    const verifyEl = document.createElement('div');
    verifyEl.className = 'verify-absorb-abort-target';
    makeVisible(verifyEl);
    document.body.appendChild(verifyEl);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1',
        title: 'Verify absorb',
        description: 'Short.',
        pauseAfter: 0,
        verify: '.verify-absorb-abort-target',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(800);
      await result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.state.view).toBe('concept');
    verifyEl.remove();
  });

  it('toggleAutoPlay at-end bails out when generation changes before hygiene', async () => {
    const hygieneMod = await import('./useDemoHubHelpers');
    const hygieneSpy = vi.spyOn(hygieneMod, 'runGqlDemoStorageHygiene').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-at-end-gen',
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
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    hygieneSpy.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
      act(() => result.current.exitLiveDemo());
      await vi.advanceTimersByTimeAsync(13000);
    });
    expect(hygieneSpy).not.toHaveBeenCalled();
    hygieneSpy.mockRestore();
  });
});
