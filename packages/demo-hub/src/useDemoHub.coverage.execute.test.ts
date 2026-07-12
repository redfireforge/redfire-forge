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


describe('useDemoHub (branch coverage — execute step)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    setupUseDemoHubCoverageBeforeEach();
  });

  afterEach(async () => {
    await teardownUseDemoHubCoverageAfterEach();
  });

  it('confirmLessonComplete marks lesson complete when selected', () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    act(() => result.current.confirmLessonComplete());
    expect(result.current.progress.completedLessons).toContain(lesson.id);
  });

  it('executeCurrentStep runs verify phase when step.verify is set', async () => {
    const div = document.createElement('div');
    div.className = 'verify-target-el';
    makeVisible(div);
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Verify', description: 'Has verify', verify: '.verify-target-el', pauseAfter: 0 }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
    div.remove();
  });

  it('executeCurrentStep uses calcReadingTime when pauseAfter is not a number', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Read', description: 'Short description.', pauseAfter: true }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(100);
      result.current.skipReading();
      await vi.advanceTimersByTimeAsync(5000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('executeCurrentStep handles step with no action (highlight only)', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'NoAction', description: 'No action step', pauseAfter: 0 }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('executeCurrentStep logs warning when preAction throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'BadPre', description: 'Pre throws', pauseAfter: 0,
        preAction: async () => { throw new Error('pre fail'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] preAction failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('executeCurrentStep logs warning when action throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'BadAction', description: 'Action throws', pauseAfter: 0,
        action: async () => { throw new Error('action fail'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] action failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('restoreStateFromProgress restores lessons view with lastLesson hint', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
      lastView: 'lessons',
      lastDomain: 'protocols',
      lastLesson: 'ws-workspace',
    }));
    const { result } = renderDemoHub(navigateToTab);
    expect(result.current.state.view).toBe('lessons');
    expect(result.current.state.selectedLesson?.id).toBe('ws-workspace');
  });

  it('restoreStateFromProgress uses lastDomain without lastLesson', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
      lastDomain: 'protocols',
    }));
    const { result } = renderDemoHub(navigateToTab);
    expect(result.current.state.view).toBe('lessons');
    expect(result.current.state.selectedLesson).toBeNull();
  });

  it('exitLiveDemo handles cleanup rejection gracefully', async () => {
    const cleanup = vi.fn().mockRejectedValue(new Error('cleanup boom'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(1000);
      await p;
    });
    expect(result.current.state.view).toBe('concept');
  });

  it('buildContext fill sets textarea value with ripple', async () => {
    const textarea = document.createElement('textarea');
    textarea.className = 'ctx-textarea-fill';
    makeVisible(textarea);
    document.body.appendChild(textarea);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'FillTA', description: 'Fill textarea', pauseAfter: 0,
        action: async (ctx) => { await ctx.fill('.ctx-textarea-fill', 'hello-ta'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(textarea.value).toBe('hello-ta');
    textarea.remove();
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  it('buildQuietContext selectOption sets value via preAction', async () => {
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'quiet-select');
    makeVisible(select);
    const opt = document.createElement('option');
    opt.value = 'b';
    select.appendChild(opt);
    document.body.appendChild(select);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietSel', description: 'Quiet select', pauseAfter: 0,
        preAction: async (ctx) => { await ctx.selectOption('[data-testid="quiet-select"]', 'b'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(select.value).toBe('b');
    select.remove();
  });

  it('buildQuietContext selectOption skips when native setter is absent', async () => {
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'quiet-select-2');
    makeVisible(select);
    ['a', 'c'].forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      select.appendChild(opt);
    });
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
        id: 's1', title: 'QuietSelNoSet', description: 'No setter', pauseAfter: 0,
        preAction: async (ctx) => { await ctx.selectOption('[data-testid="quiet-select-2"]', 'c'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    vi.restoreAllMocks();
    expect(select.value).toBe('a');
    select.remove();
  });

  it('toggleAutoPlay at last step runs cleanup setup and restarts from step 0', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup, setup, initialTab: 'websocket-studio' });
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
    navigateToTab.mockClear();
    act(() => result.current.toggleAutoPlay());
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
    expect(navigateToTab).toHaveBeenCalledWith('websocket-studio');
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('waitForElement retries until a visible element appears', async () => {
    const div = document.createElement('div');
    div.className = 'wait-retry-el';
    makeVisible(div);
    div.scrollIntoView = vi.fn();

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'WaitRetry', description: 'Retry wait', highlight: '.wait-retry-el', pauseAfter: 0 }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(250);
      document.body.appendChild(div);
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    div.remove();
  });

  it('firstVisible skips zero-size element and clicks the visible match', async () => {
    const hidden = document.createElement('button');
    hidden.className = 'multi-target';
    hidden.getBoundingClientRect = () => ({
      width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => '{}',
    } as DOMRect);
    document.body.appendChild(hidden);

    const visible = document.createElement('button');
    visible.className = 'multi-target';
    makeVisible(visible);
    const clickSpy = vi.spyOn(visible, 'click');
    document.body.appendChild(visible);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Multi', description: 'Multi target', pauseAfter: 0,
        action: async (ctx) => { await ctx.click('.multi-target'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(clickSpy).toHaveBeenCalled();
    hidden.remove();
    visible.remove();
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });
});
