/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { makeVisible } from './lessons/protocols/ws-test-utils';
import {
  advanceToPhase,
  advanceToResumedPhase,
  makeLesson,
  renderDemoHub,
  withStubbedLessonBody,
} from './useDemoHub.coverage-helpers';
import {
  setupUseDemoHubCoverageBeforeEach,
  teardownUseDemoHubCoverageAfterEach,
} from './useDemoHub.coverage.testHelpers';
import { gqlFirstQueryLesson } from './lessons/protocols/graphql-first-query';
import {
  persistDemoLiveSession,
  resetLiveDemoResumeConsumeForTests,
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

describe('useDemoHub — coverage gaps (autoplay & steps)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    setupUseDemoHubCoverageBeforeEach();
    sessionStorage.clear();
    resetLiveDemoResumeConsumeForTests();
  });

  afterEach(async () => {
    await teardownUseDemoHubCoverageAfterEach();
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
    // Two steps: on a single-step lesson toggling at the end replays instead of pausing.
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'A'.repeat(600) },
        { id: 's2', title: 'S2', description: 'B'.repeat(600) },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => { void result.current.startLiveDemo(); });
    await advanceToPhase(result, 'reading');
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);

    act(() => result.current.toggleAutoPlay());
    expect(result.current.stepPhase).toBe('done');
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('resumeInterruptedLiveDemo sets done phase when session was not playing', async () => {
    await withStubbedLessonBody(gqlFirstQueryLesson, async () => {
      resetLiveDemoResumeConsumeForTests();
      persistDemoLiveSession({
        lessonId: gqlFirstQueryLesson.id,
        stepIndex: 0,
        isPlaying: false,
        speed: 1,
        savedAt: Date.now(),
      });
      const { result } = renderDemoHub(navigateToTab);
      await advanceToResumedPhase(result, 'done');
      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.stepPhase).toBe('done');
    });
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

});
